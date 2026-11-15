// Accès Firestore : toutes les écritures de l'app passent par ici.
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase.js';
import { localParts, DEFAULT_PREFS } from '../../shared/index.js';

export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

// ---------- Profil ----------
export async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      tz: tz(),
      lastActiveAt: Date.now(),
      notifPrefs: DEFAULT_PREFS,
      fcmTokens: [],
      onboarded: false,
    });
  }
}

export function touchActivity(uid) {
  return updateDoc(doc(db, 'users', uid), { lastActiveAt: Date.now(), tz: tz() });
}

export function updateUser(uid, data) {
  return updateDoc(doc(db, 'users', uid), data);
}

export function saveProfile(uid, { pseudo, avatar }) {
  return setDoc(doc(db, 'profiles', uid), { pseudo: pseudo.trim().slice(0, 30), avatar, updatedAt: serverTimestamp() }, { merge: true });
}

// ---------- Habitudes ----------
export function addHabit(uid, habit) {
  return addDoc(collection(db, 'users', uid, 'habits'), { ...habit, createdAt: serverTimestamp() });
}

export function updateHabit(uid, habitId, data) {
  return updateDoc(doc(db, 'users', uid, 'habits', habitId), data);
}

// ---------- Journal ----------
function baseLog(habitId, at) {
  const p = localParts(at, tz());
  return { habitId, at, localHour: p.hour, localDow: p.dow, createdAt: serverTimestamp() };
}

/** Enregistre une envie (et, si elle n'a pas été surmontée, une consommation). */
export async function logCraving(uid, habit, { intensity, trigger, resisted, quantity = 1, note = '' }) {
  const at = Date.now();
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'users', uid, 'logs')), {
    ...baseLog(habit.id, at),
    type: 'craving',
    intensity,
    trigger: trigger || null,
    resisted,
    note: note.slice(0, 280),
  });
  if (!resisted) {
    batch.set(doc(collection(db, 'users', uid, 'logs')), { ...baseLog(habit.id, at), type: 'use', quantity, trigger: trigger || null, note: '' });
    batch.update(doc(db, 'users', uid, 'habits', habit.id), { lastUseAt: at });
  }
  await batch.commit();
}

/** Enregistre une consommation / un écart. */
export async function logUse(uid, habit, { quantity = 1, trigger, note = '' }) {
  const at = Date.now();
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'users', uid, 'logs')), {
    ...baseLog(habit.id, at),
    type: 'use',
    quantity,
    trigger: trigger || null,
    note: note.slice(0, 280),
  });
  batch.update(doc(db, 'users', uid, 'habits', habit.id), { lastUseAt: at });
  await batch.commit();
}

// ---------- Communauté ----------
export function createPost(uid, profile, { text, kind = 'text', habit }) {
  return addDoc(collection(db, 'posts'), {
    authorId: uid,
    authorName: profile?.pseudo || 'Membre',
    authorAvatar: profile?.avatar || '🙂',
    habitId: habit?.templateId ?? 'custom',
    habitLabel: habit?.label ?? '',
    kind, // 'text' | 'sos' | 'victory'
    text: text.trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}

export function deletePost(postId) {
  return deleteDoc(doc(db, 'posts', postId));
}

export async function getMyReaction(postId, uid) {
  const s = await getDoc(doc(db, 'posts', postId, 'reactions', uid));
  return s.exists() ? s.data().type : null;
}

export function setReaction(postId, uid, type) {
  const ref = doc(db, 'posts', postId, 'reactions', uid);
  return type ? setDoc(ref, { type, uid, at: serverTimestamp() }) : deleteDoc(ref);
}

export function addComment(postId, uid, profile, text) {
  return addDoc(collection(db, 'posts', postId, 'comments'), {
    authorId: uid,
    authorName: profile?.pseudo || 'Membre',
    authorAvatar: profile?.avatar || '🙂',
    text: text.trim().slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export function reportContent(uid, { postId, commentId = null, reason }) {
  return addDoc(collection(db, 'reports'), { reporterId: uid, postId, commentId, reason, createdAt: serverTimestamp() });
}

// ---------- Notifications ----------
export function markNotification(uid, id, field) {
  return updateDoc(doc(db, 'users', uid, 'notifications', id), { [field]: Date.now() });
}

export async function markAllRead(uid, notifs) {
  const unread = notifs.filter((n) => !n.readAt);
  if (!unread.length) return;
  const batch = writeBatch(db);
  for (const n of unread) batch.update(doc(db, 'users', uid, 'notifications', n.id), { readAt: Date.now() });
  await batch.commit();
}

// ---------- Fonctions serveur ----------
export const sendTestNotification = () => httpsCallable(functions, 'sendTestNotification')();
export const deleteMyAccount = () => httpsCallable(functions, 'deleteMyAccount')();

// ---------- Export RGPD ----------
export async function exportMyData(uid) {
  const read = async (path) => (await getDocs(collection(db, ...path))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const user = (await getDoc(doc(db, 'users', uid))).data();
  const profile = (await getDoc(doc(db, 'profiles', uid))).data() ?? null;
  const posts = (await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(500)))).docs.map(
    (d) => ({ id: d.id, ...d.data() }),
  );
  return {
    exportedAt: new Date().toISOString(),
    user: { ...user, fcmTokens: undefined },
    profile,
    habits: await read(['users', uid, 'habits']),
    logs: await read(['users', uid, 'logs']),
    notifications: await read(['users', uid, 'notifications']),
    posts,
  };
}

