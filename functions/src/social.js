// Fonctions de la communauté : compteurs et notifications sociales (discrètes).
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PREFS, HOUR, isQuietHour, localParts } from '../shared/index.js';
import { appUrl, sendPush } from './engine.js';

const db = () => getFirestore();
const REACTIONS = ['courage', 'bravo', 'merci'];
const SOCIAL_PUSH_GAP = 2 * HOUR; // regroupe : au plus un push social toutes les 2 h

/** Tient à jour posts/{id}.reactions.{type} quand une réaction est ajoutée, changée ou retirée. */
export async function handleReactionWrite(postId, before, after) {
  const prev = before?.type;
  const next = after?.type;
  if (prev === next) return;
  const update = {};
  if (REACTIONS.includes(prev)) update[`reactions.${prev}`] = FieldValue.increment(-1);
  if (REACTIONS.includes(next)) update[`reactions.${next}`] = FieldValue.increment(1);
  if (Object.keys(update).length) await db().doc(`posts/${postId}`).update(update).catch(() => {}); // post supprimé : on ignore
}

/** Nouveau commentaire : compteur + notification à l'auteur du message. */
export async function handleCommentCreated(postId, comment, now = Date.now()) {
  const postRef = db().doc(`posts/${postId}`);
  const post = (await postRef.get()).data();
  if (!post) return;
  await postRef.update({ commentCount: FieldValue.increment(1) });
  if (comment.authorId === post.authorId) return;

  const authorRef = db().doc(`users/${post.authorId}`);
  const author = (await authorRef.get()).data();
  if (!author) return;
  const prefs = { ...DEFAULT_PREFS, ...(author.notifPrefs ?? {}) };
  const title = `${comment.authorAvatar ?? '💬'} ${comment.authorName} t’a répondu`;
  const body = comment.text.length > 120 ? `${comment.text.slice(0, 117)}…` : comment.text;
  const ref = authorRef.collection('notifications').doc();

  const canPush =
    prefs.push &&
    prefs.social &&
    prefs.level !== 'off' &&
    !isQuietHour(localParts(now, author.tz || 'Europe/Paris').hour, prefs) &&
    now - (author.lastSocialPushAt ?? 0) > SOCIAL_PUSH_GAP &&
    now - (author.lastActiveAt ?? 0) > 15 * 60 * 1000;

  const pushed = canPush
    ? await sendPush(post.authorId, author.fcmTokens, { title, body, link: `${appUrl()}/communaute`, notifId: ref.id }).catch(() => false)
    : false;
  if (pushed) await authorRef.update({ lastSocialPushAt: now });
  await ref.set({ kind: 'social', postId, title, body, pushed, createdAt: now, readAt: null, openedAt: null });
}
