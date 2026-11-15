// Cloud Functions de Déclic (2e génération).
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/options';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/firestore';
import { onSchedule } from 'firebase-functions/scheduler';
import { onCall, HttpsError } from 'firebase-functions/https';
import { logger } from 'firebase-functions';
import { appUrl, dispatchDue, replan, sendPush } from './src/engine.js';
import { handleCommentCreated, handleReactionWrite } from './src/social.js';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });
const db = getFirestore();

// ---------- Moteur de notifications ----------

/** Chaque envie / consommation notée affine le profil de risque et replanifie. */
export const onLogCreated = onDocumentCreated('users/{uid}/logs/{logId}', (event) => replan(event.params.uid));

/** Nouvelle habitude, changement d'objectif, écart (lastUseAt) : replanifie. */
export const onHabitWritten = onDocumentWritten('users/{uid}/habits/{habitId}', (event) => replan(event.params.uid));

/** Préférences ou fuseau horaire modifiés : replanifie. */
export const onUserUpdated = onDocumentUpdated('users/{uid}', (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const changed = JSON.stringify(before.notifPrefs) !== JSON.stringify(after.notifPrefs) || before.tz !== after.tz;
  return changed ? replan(event.params.uid) : null;
});

/** Toutes les 15 minutes : envoie les notifications dues (le moteur décide si c'est pertinent). */
export const dispatchNudges = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Europe/Paris', timeoutSeconds: 300 }, async () => {
  const n = await dispatchDue(Date.now());
  logger.info(`Passe du moteur : ${n} utilisateur(s) traité(s)`);
});

// ---------- Communauté ----------

export const onReactionWritten = onDocumentWritten('posts/{postId}/reactions/{uid}', (event) =>
  handleReactionWrite(event.params.postId, event.data.before?.data(), event.data.after?.data()),
);

export const onCommentCreated = onDocumentCreated('posts/{postId}/comments/{commentId}', (event) =>
  handleCommentCreated(event.params.postId, event.data.data()),
);

export const onCommentDeleted = onDocumentDeleted('posts/{postId}/comments/{commentId}', (event) =>
  db.doc(`posts/${event.params.postId}`).update({ commentCount: FieldValue.increment(-1) }).catch(() => {}),
);

// ---------- Fonctions appelables ----------

/** Notification de test (limitée à une par minute). */
export const sendTestNotification = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const ref = db.doc(`users/${uid}`);
  const user = (await ref.get()).data();
  if (Date.now() - (user?.lastTestAt ?? 0) < 60_000) throw new HttpsError('resource-exhausted', 'Patiente une minute avant un nouveau test.');
  await ref.update({ lastTestAt: Date.now() });
  const notifRef = ref.collection('notifications').doc();
  const msg = { title: 'Test réussi 🔔', body: 'Les notifications fonctionnent. On ne te dérangera qu’à bon escient.' };
  const pushed = await sendPush(uid, user?.fcmTokens, { ...msg, link: `${appUrl()}/notifications?open=${notifRef.id}`, notifId: notifRef.id });
  await notifRef.set({ kind: 'test', ...msg, pushed, createdAt: Date.now(), readAt: null, openedAt: null });
  if (!pushed) throw new HttpsError('failed-precondition', 'Aucun appareil joignable. Réactive les notifications sur cet appareil.');
  return { ok: true };
});

/** Suppression complète du compte (RGPD). */
export const deleteMyAccount = onCall({ timeoutSeconds: 300 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const posts = await db.collection('posts').where('authorId', '==', uid).get();
  const comments = await db.collectionGroup('comments').where('authorId', '==', uid).get();
  const reactions = await db.collectionGroup('reactions').where('uid', '==', uid).get();
  await Promise.all([
    ...posts.docs.map((d) => db.recursiveDelete(d.ref)),
    ...comments.docs.map((d) => d.ref.delete()),
    ...reactions.docs.map((d) => d.ref.delete()),
  ]);
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await Promise.all([db.doc(`engine/${uid}`).delete(), db.doc(`profiles/${uid}`).delete()]);
  await getAuth().deleteUser(uid);
  logger.info('Compte supprimé', { uid });
  return { ok: true };
});
