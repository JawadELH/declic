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
  orderBy,
  startAt,
  endAt,
  increment,
  runTransaction,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
  deleteField,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { localParts, dayKey, DEFAULT_PREFS, MINUTE, DAY, allianceId } from '../../shared/index.js';

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
  const p = pseudo.trim().slice(0, 30);
  return setDoc(doc(db, 'profiles', uid), { pseudo: p, pseudoLower: p.toLowerCase(), avatar: 'initiale', updatedAt: serverTimestamp() }, { merge: true });
}

/** Carte publique (visible des membres) : habitude principale, début de série, victoires. */
export function saveProfileCard(uid, profile, card) {
  return setDoc(
    doc(db, 'profiles', uid),
    { pseudo: profile.pseudo, pseudoLower: profile.pseudo.toLowerCase(), avatar: profile.avatar || 'initiale', card },
    { merge: true },
  );
}

export async function getProfile(uid) {
  const s = await getDoc(doc(db, 'profiles', uid));
  return s.exists() ? { uid, ...s.data() } : null;
}

/** Recherche de membres par début de pseudo. */
export async function searchProfiles(text) {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  const snap = await getDocs(query(collection(db, 'profiles'), orderBy('pseudoLower'), startAt(q), endAt(`${q}\uf8ff`), limit(15)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ---------- Habitudes ----------
export function addHabit(uid, habit) {
  return addDoc(collection(db, 'users', uid, 'habits'), { ...habit, createdAt: serverTimestamp() });
}

/** Ajoute un déclencheur personnel à l'habitude (et le ré-affiche s'il avait été masqué). */
export function addCustomTrigger(uid, habitId, trigger) {
  return updateDoc(doc(db, 'users', uid, 'habits', habitId), { customTriggers: arrayUnion(trigger), hiddenTriggers: arrayRemove(trigger) });
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

/** Lance un SOS visible par tout le groupe pendant 10 minutes (renvoie son identifiant tout de suite). */
export function startSos(uid, profile, habit, trigger, onError = () => {}) {
  const ref = doc(collection(db, 'sos'));
  setDoc(ref, {
    uid,
    pseudo: profile?.pseudo || 'Membre',
    habitId: habit?.templateId ?? 'custom',
    habitLabel: habit?.label ?? '',
    trigger: trigger || null,
    status: 'open',
    outcome: null,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + SOS_DURATION,
  }).catch(onError);
  return ref.id;
}

/** Badge rare gagné grâce à une carte surprise (collection). */
export function saveBadge(uid, badgeId) {
  return updateDoc(doc(db, 'users', uid), { [`badges.${badgeId}`]: increment(1) });
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

// ---------- Alliés, cercles, blocage ----------
export function requestAlliance(me, myPseudo, other, otherPseudo, code = null) {
  return setDoc(doc(db, 'alliances', allianceId(me, other)), {
    members: [me, other],
    from: me,
    to: other,
    fromPseudo: myPseudo || 'Membre',
    toPseudo: otherPseudo || 'Membre',
    status: code ? 'accepted' : 'pending',
    ...(code ? { code } : {}),
    createdAt: serverTimestamp(),
  });
}

/** Code d'invitation personnel (créé au premier partage). */
export async function getInviteCode(uid, userDoc) {
  if (userDoc?.inviteCode) return userDoc.inviteCode;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const code = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  await setDoc(doc(db, 'invites', code), { uid, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'users', uid), { inviteCode: code });
  return code;
}

export function acceptAlliance(id) {
  return updateDoc(doc(db, 'alliances', id), { status: 'accepted' });
}

export function removeAlliance(id) {
  return deleteDoc(doc(db, 'alliances', id));
}

export async function blockUser(me, other) {
  await setDoc(doc(db, 'users', me, 'blocked', other), { at: Date.now() });
  await deleteDoc(doc(db, 'alliances', allianceId(me, other))).catch(() => {});
}

export function unblockUser(me, other) {
  return deleteDoc(doc(db, 'users', me, 'blocked', other));
}

export async function createCircle(uid, name, members) {
  const ref = await addDoc(collection(db, 'circles'), {
    name: name.trim().slice(0, 30),
    ownerId: uid,
    members: Array.from(new Set([uid, ...members])).slice(0, 12),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateCircle(id, data) {
  return updateDoc(doc(db, 'circles', id), data);
}

export function addCircleMembers(id, uids) {
  return updateDoc(doc(db, 'circles', id), { members: arrayUnion(...uids) });
}

export async function leaveCircle(id, uid, members) {
  return updateDoc(doc(db, 'circles', id), { members: members.filter((m) => m !== uid) });
}

export function deleteCircle(id) {
  return deleteDoc(doc(db, 'circles', id));
}

export function sendCircleMessage(circleId, uid, pseudo, text) {
  return addDoc(collection(db, 'circles', circleId, 'messages'), {
    uid,
    pseudo: pseudo || 'Membre',
    text: text.trim().slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export function deleteCircleMessage(circleId, id) {
  return deleteDoc(doc(db, 'circles', circleId, 'messages', id));
}

// ---------- Administration / modération ----------
export function banUser(uid, by, reason = 'modération') {
  return setDoc(doc(db, 'bans', uid), { by, reason, at: Date.now() });
}

export async function isBanned(uid) {
  return (await getDoc(doc(db, 'bans', uid))).exists();
}

export function unbanUser(uid) {
  return deleteDoc(doc(db, 'bans', uid));
}

export function setModerator(uid, on, pseudo) {
  return on ? setDoc(doc(db, 'roles', uid), { role: 'moderator', pseudo: pseudo || '', at: Date.now() }) : deleteDoc(doc(db, 'roles', uid));
}

export function deleteReport(id) {
  return deleteDoc(doc(db, 'reports', id));
}

export async function getActivity(id) {
  const s = await getDoc(doc(db, 'activity', id));
  return s.exists() ? { id, ...s.data() } : null;
}

/** Chiffres globaux pour l'admin. */
export async function adminOverview() {
  const now = Date.now();
  const count = async (q) => (await getCountFromServer(q)).data().count;
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(now - i * DAY));
  const pulses = await Promise.all(keys.map(async (k) => (await getDoc(doc(db, 'pulse', k))).data()?.resisted ?? 0));
  return {
    members: await count(collection(db, 'profiles')),
    active24h: await count(query(collection(db, 'presence'), where('lastSeen', '>', now - DAY))),
    active7d: await count(query(collection(db, 'presence'), where('lastSeen', '>', now - 7 * DAY))),
    reports: await count(collection(db, 'reports')),
    bans: await count(collection(db, 'bans')),
    pulseToday: pulses[0],
    pulseWeek: pulses.reduce((a, b) => a + b, 0),
    pulseDays: keys.map((k, i) => ({ key: k, value: pulses[i] })).reverse(),
  };
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

// ---------- Réinitialisation et mode développeur ----------
async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/** Recommencer une habitude : efface son historique et repart d'aujourd'hui. */
export async function resetHabit(uid, habitId) {
  const logs = await getDocs(query(collection(db, 'users', uid, 'logs'), where('habitId', '==', habitId)));
  await deleteRefs(logs.docs.map((d) => d.ref));
  await updateDoc(doc(db, 'users', uid, 'habits', habitId), { startedAt: Date.now(), lastUseAt: deleteField(), goal: deleteField() });
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('declic.ms.') || k.startsWith('declic.goal.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* indisponible */
  }
}

/** Tout réinitialiser : habitudes, historique, notifications. Le compte, le pseudo et les alliés sont conservés. */
export async function resetAllData(uid) {
  const refs = [
    ...(await getDocs(collection(db, 'users', uid, 'logs'))).docs,
    ...(await getDocs(collection(db, 'users', uid, 'notifications'))).docs,
    ...(await getDocs(collection(db, 'users', uid, 'habits'))).docs,
  ].map((d) => d.ref);
  await deleteRefs(refs);
  await updateDoc(doc(db, 'users', uid), { onboarded: false, badges: deleteField() });
  await setDoc(doc(db, 'profiles', uid), { card: null }, { merge: true }).catch(() => {});
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('declic.') && k !== 'declic.dev')
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* indisponible */
  }
}

const HOURS_PEAK = [8, 8, 10, 13, 13, 14, 16, 18, 18, 21, 21, 23];
/** Génère un historique de démonstration réaliste (jamais publié dans le groupe). */
export async function seedDemoHistory(uid, habit, days, triggers) {
  const now = Date.now();
  const rand = (a, b) => a + Math.random() * (b - a);
  const logs = [];
  let lastUse = 0;
  for (let d = days; d >= 0; d--) {
    const progress = 1 - d / Math.max(1, days); // on s'améliore avec le temps
    const n = Math.round(rand(2, 6) * (1 - progress * 0.45));
    for (let i = 0; i < n; i++) {
      const day = new Date(now - d * DAY);
      day.setHours(HOURS_PEAK[Math.floor(Math.random() * HOURS_PEAK.length)], Math.floor(rand(0, 59)), 0, 0);
      const at = day.getTime();
      if (at > now - MINUTE) continue;
      const p = localParts(at, tz());
      const trigger = triggers[Math.floor(Math.random() * Math.min(triggers.length, 5))] ?? null;
      // En mode arrêt, pas d'écart sur les 3 derniers jours : la série en cours reste visible.
      const resisted = (habit.mode === 'quit' && d < 3) || Math.random() < 0.55 + progress * 0.35;
      const base = { habitId: habit.id, at, localHour: p.hour, localDow: p.dow, trigger, note: '', demo: true, createdAt: serverTimestamp() };
      logs.push({ ...base, type: 'craving', intensity: Math.ceil(rand(1, 5)), resisted });
      if (!resisted) {
        logs.push({ ...base, type: 'use', quantity: Math.random() < 0.8 ? 1 : 2 });
        lastUse = Math.max(lastUse, at);
      }
    }
  }
  for (let i = 0; i < logs.length; i += 400) {
    const batch = writeBatch(db);
    logs.slice(i, i + 400).forEach((l) => batch.set(doc(collection(db, 'users', uid, 'logs')), l));
    await batch.commit();
  }
  const patch = { startedAt: Math.min(habit.startedAt ?? now, now - days * DAY) };
  if (lastUse > (habit.lastUseAt ?? 0)) patch.lastUseAt = lastUse;
  await updateDoc(doc(db, 'users', uid, 'habits', habit.id), patch);
  return logs.length;
}

/** Supprime uniquement les données de démonstration, et recalcule la dernière consommation réelle. */
export async function purgeDemoHistory(uid, habits) {
  const snap = await getDocs(query(collection(db, 'users', uid, 'logs'), where('demo', '==', true)));
  await deleteRefs(snap.docs.map((d) => d.ref));
  const real = await getDocs(query(collection(db, 'users', uid, 'logs'), where('type', '==', 'use')));
  for (const h of habits) {
    const last = Math.max(0, ...real.docs.map((d) => d.data()).filter((l) => l.habitId === h.id).map((l) => l.at));
    await updateDoc(doc(db, 'users', uid, 'habits', h.id), { lastUseAt: last > 0 ? last : deleteField() });
  }
  return snap.size;
}

export function shiftHabitStart(uid, habit, days) {
  return updateDoc(doc(db, 'users', uid, 'habits', habit.id), { startedAt: (habit.startedAt ?? Date.now()) - days * DAY });
}

export function setHabitGoal(uid, habitId, goal) {
  return updateDoc(doc(db, 'users', uid, 'habits', habitId), { goal: goal ?? deleteField() });
}

export function goalReached(uid, habitId) {
  return updateDoc(doc(db, 'users', uid, 'habits', habitId), { goal: deleteField(), goalsReached: increment(1) });
}

/** Supprime une entrée ; si c'était la dernière consommation, la série est recalculée. */
export async function deleteLog(uid, log, habit, logs) {
  await deleteDoc(doc(db, 'users', uid, 'logs', log.id));
  if (log.type === 'use' && habit?.lastUseAt === log.at) {
    const last = Math.max(0, ...logs.filter((l) => l.habitId === habit.id && l.type === 'use' && l.id !== log.id).map((l) => l.at));
    await updateDoc(doc(db, 'users', uid, 'habits', habit.id), { lastUseAt: last > 0 ? last : deleteField() });
  }
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
  const inviteCode = (await getDoc(doc(db, 'users', uid))).data()?.inviteCode;
  if (inviteCode) await deleteDoc(doc(db, 'invites', inviteCode)).catch(() => {});
  const refs = [
    ...(await readAll(collection(db, 'users', uid, 'logs'))),
    ...(await readAll(collection(db, 'users', uid, 'habits'))),
    ...(await readAll(collection(db, 'users', uid, 'notifications'))),
    ...(await readAll(query(collection(db, 'activity'), where('uid', '==', uid)))),
    ...(await readAll(query(collection(db, 'sos'), where('uid', '==', uid)))),
    ...(await readAll(query(collection(db, 'posts'), where('authorId', '==', uid)))),
    ...(await readAll(query(collection(db, 'alliances'), where('members', 'array-contains', uid)))),
    ...(await readAll(collection(db, 'users', uid, 'blocked'))),
  ].map((d) => d.ref);
  for (const c of await readAll(query(collection(db, 'circles'), where('members', 'array-contains', uid)))) {
    const data = c.data();
    if (data.ownerId === uid) refs.push(c.ref);
    else await leaveCircle(c.id, uid, data.members).catch(() => {});
  }
  refs.push(doc(db, 'presence', uid), doc(db, 'profiles', uid), doc(db, 'users', uid));
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteUser(auth.currentUser);
}
