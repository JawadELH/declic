// Accès Firestore : toutes les écritures de l'app passent par ici.
// Tout fonctionne avec la formule gratuite (Spark) : aucune Cloud Function n'est nécessaire
// pour l'app et le groupe en direct. Les Cloud Functions (formule Blaze) ajoutent les notifications push planifiées.
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
  limit,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { localParts, dayKey, DEFAULT_PREFS, MINUTE } from '../../shared/index.js';

export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
export const SOS_DURATION = 10 * MINUTE;

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
      shareActivity: true,
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

export function saveProfile(uid, { pseudo }) {
  return setDoc(doc(db, 'profiles', uid), { pseudo: pseudo.trim().slice(0, 30), avatar: 'initiale', updatedAt: serverTimestamp() }, { merge: true });
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

/** Envie surmontée : journal + compteur collectif du jour. */
export async function logResisted(uid, habit, { trigger = null, intensity = 3 } = {}) {
  const at = Date.now();
  await addDoc(collection(db, 'users', uid, 'logs'), { ...baseLog(habit.id, at), type: 'craving', intensity, trigger, resisted: true, note: '' });
  bumpPulse().catch(() => {});
}

/** Envie non surmontée ou consommation : journal + date de dernière consommation. */
export async function logUse(uid, habit, { quantity = 1, trigger = null, fromCraving = false } = {}) {
  const at = Date.now();
  const batch = writeBatch(db);
  if (fromCraving) {
    batch.set(doc(collection(db, 'users', uid, 'logs')), { ...baseLog(habit.id, at), type: 'craving', intensity: 3, trigger, resisted: false, note: '' });
  }
  batch.set(doc(collection(db, 'users', uid, 'logs')), { ...baseLog(habit.id, at), type: 'use', quantity, trigger, note: '' });
  batch.update(doc(db, 'users', uid, 'habits', habit.id), { lastUseAt: at });
  await batch.commit();
}

// ---------- Groupe en direct ----------

/** Compteur collectif « envies battues aujourd'hui ». */
async function bumpPulse() {
  const ref = doc(db, 'pulse', dayKey(Date.now()));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) tx.update(ref, { resisted: increment(1) });
    else tx.set(ref, { resisted: 1 });
  });
}

/** Publie un événement dans le fil du groupe. */
export function publishActivity(uid, profile, { kind, habit, text = '' }) {
  return addDoc(collection(db, 'activity'), {
    uid,
    pseudo: profile?.pseudo || 'Membre',
    kind, // 'resisted' | 'milestone' | 'start' | 'message' | 'challenge'
    habitId: habit?.templateId ?? 'custom',
    habitLabel: habit?.label ?? '',
    text: text.trim().slice(0, 280),
    createdAt: serverTimestamp(),
  });
}

export function deleteActivity(id) {
  return deleteDoc(doc(db, 'activity', id));
}

/** Encourager un événement (une fois par personne) : sous-document + compteur, dans le même lot. */
export async function cheer(activityId, uid) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'activity', activityId, 'cheers', uid), { uid, at: serverTimestamp() });
  batch.update(doc(db, 'activity', activityId), { cheers: increment(1) });
  await batch.commit();
}

export async function hasCheered(activityId, uid) {
  return (await getDoc(doc(db, 'activity', activityId, 'cheers', uid))).exists();
}

/** Lance un SOS visible par tout le groupe pendant 10 minutes. */
export async function startSos(uid, profile, habit, trigger) {
  const ref = await addDoc(collection(db, 'sos'), {
    uid,
    pseudo: profile?.pseudo || 'Membre',
    habitId: habit?.templateId ?? 'custom',
    habitLabel: habit?.label ?? '',
    trigger: trigger || null,
    status: 'open',
    outcome: null,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + SOS_DURATION,
  });
  return ref.id;
}

export function closeSos(sosId, outcome) {
  return updateDoc(doc(db, 'sos', sosId), { status: 'done', outcome });
}

/** Envoyer de la force à quelqu'un en SOS (une fois par personne). */
export async function sendForce(sosId, uid, profile) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'sos', sosId, 'force', uid), { uid, pseudo: profile?.pseudo || 'Membre', at: serverTimestamp() });
  batch.update(doc(db, 'sos', sosId), { force: increment(1) });
  await batch.commit();
}

/** Relever le défi du jour (une fois par personne et par jour). */
export async function takeChallenge(uid, key) {
  const ref = doc(db, 'challenges', key);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    tx.set(doc(db, 'challenges', key, 'takers', uid), { uid, at: serverTimestamp() });
    if (snap.exists()) tx.update(ref, { count: increment(1) });
    else tx.set(ref, { count: 1 });
  });
}

export async function hasTakenChallenge(uid, key) {
  return (await getDoc(doc(db, 'challenges', key, 'takers', uid))).exists();
}

/** Présence : « X en ligne ». */
export function heartbeat(uid, profile) {
  return setDoc(doc(db, 'presence', uid), { lastSeen: Date.now(), pseudo: profile?.pseudo || 'Membre' });
}

export function reportContent(uid, { activityId, reason = 'inapproprié' }) {
  return addDoc(collection(db, 'reports'), { reporterId: uid, postId: activityId, collection: 'activity', reason, createdAt: serverTimestamp() });
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

// ---------- Données personnelles (RGPD) ----------
const readAll = async (q) => (await getDocs(q)).docs;

export async function exportMyData(uid) {
  const rows = async (q) => (await readAll(q)).map((d) => ({ id: d.id, ...d.data() }));
  return {
    exportedAt: new Date().toISOString(),
    user: { ...(await getDoc(doc(db, 'users', uid))).data(), fcmTokens: undefined },
    profile: (await getDoc(doc(db, 'profiles', uid))).data() ?? null,
    habits: await rows(collection(db, 'users', uid, 'habits')),
    logs: await rows(collection(db, 'users', uid, 'logs')),
    notifications: await rows(collection(db, 'users', uid, 'notifications')),
    activity: await rows(query(collection(db, 'activity'), where('uid', '==', uid), limit(1000))),
  };
}

/** Suppression complète du compte, sans serveur. */
export async function deleteMyAccount(uid) {
  const refs = [
    ...(await readAll(collection(db, 'users', uid, 'logs'))),
    ...(await readAll(collection(db, 'users', uid, 'habits'))),
    ...(await readAll(collection(db, 'users', uid, 'notifications'))),
    ...(await readAll(query(collection(db, 'activity'), where('uid', '==', uid)))),
    ...(await readAll(query(collection(db, 'sos'), where('uid', '==', uid)))),
    ...(await readAll(query(collection(db, 'posts'), where('authorId', '==', uid)))),
  ].map((d) => d.ref);
  refs.push(doc(db, 'presence', uid), doc(db, 'profiles', uid), doc(db, 'users', uid));
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteUser(auth.currentUser);
}
