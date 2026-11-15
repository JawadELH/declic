// Orchestration serveur du moteur de notifications.
// Toute la logique de décision est dans ../shared (testée unitairement) ; ici on ne fait que lire,
// appeler le moteur, envoyer et enregistrer.
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import {
  DAY,
  DEFAULT_PREFS,
  DEFAULT_STATE,
  buildRiskProfile,
  canSendNow,
  composeNudge,
  computeHabitStats,
  computeIgnoredStreak,
  pauseDuration,
  planNextNudge,
  stateAfterSend,
} from '../shared/index.js';

const db = () => getFirestore();
const RISK_WINDOW_DAYS = 60;

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const projectId = JSON.parse(process.env.FIREBASE_CONFIG ?? '{}').projectId ?? process.env.GCLOUD_PROJECT;
  return `https://${projectId}.web.app`;
}

/** Charge tout ce dont le moteur a besoin pour un utilisateur. */
export async function loadContext(uid, now) {
  const userRef = db().doc(`users/${uid}`);
  const [userSnap, habitsSnap, logsSnap, engineSnap] = await Promise.all([
    userRef.get(),
    userRef.collection('habits').where('active', '==', true).get(),
    userRef.collection('logs').where('at', '>=', now - RISK_WINDOW_DAYS * DAY).get(),
    db().doc(`engine/${uid}`).get(),
  ]);
  const user = userSnap.data() ?? null;
  const engine = engineSnap.data() ?? {};
  return {
    uid,
    user,
    habits: habitsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    logs: logsSnap.docs.map((d) => d.data()),
    engine,
    prefs: { ...DEFAULT_PREFS, ...(user?.notifPrefs ?? {}) },
    tz: user?.tz || 'Europe/Paris',
    state: { ...DEFAULT_STATE, ...(engine.state ?? {}) },
  };
}

/** Recalcule le profil de risque et planifie la prochaine notification. */
export async function replan(uid, now = Date.now(), ctx = null) {
  const c = ctx ?? (await loadContext(uid, now));
  const ref = db().doc(`engine/${uid}`);
  if (!c.user) {
    await ref.delete().catch(() => {});
    return null;
  }
  const risk = {};
  const habits = c.habits.map((h) => {
    const cravings = c.logs.filter((l) => l.habitId === h.id && l.type === 'craving');
    risk[h.id] = buildRiskProfile(cravings, now);
    return { ...h, streakStart: computeHabitStats(h, c.logs, now, { days: 1 }).streakStart };
  });
  const plan = planNextNudge({ now, tz: c.tz, prefs: c.prefs, state: c.state, habits, risk });
  await ref.set({ risk, state: c.state, nextNudge: plan, nextNudgeAt: plan?.at ?? null, updatedAt: now });
  return plan;
}

/** Envoie une notification push à tous les appareils de l'utilisateur ; nettoie les jetons morts. */
export async function sendPush(uid, tokens, { title, body, link, notifId }) {
  if (!tokens?.length) return false;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { notifId: notifId ?? '', link },
    webpush: {
      fcmOptions: { link },
      notification: { icon: '/icon-192.png', badge: '/icon-192.png', tag: 'declic', renotify: false },
      headers: { Urgency: 'normal', TTL: String(2 * 3600) }, // un rappel périmé n'a plus de sens
    },
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length) await db().doc(`users/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
  return res.successCount > 0;
}

/** Déclencheur le plus fréquent autour d'une heure donnée (pour personnaliser le message). */
function topTriggerAround(logs, habitId, hour) {
  const counts = new Map();
  for (const l of logs) {
    if (l.habitId !== habitId || l.type !== 'craving' || !l.trigger) continue;
    const diff = (((l.localHour - hour) % 24) + 24) % 24;
    if (Math.min(diff, 24 - diff) > 1) continue; // garde hour-1, hour, hour+1
    counts.set(l.trigger, (counts.get(l.trigger) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

/** Traite un utilisateur dont la notification planifiée est due. */
export async function processDueUser(uid, now = Date.now()) {
  const ctx = await loadContext(uid, now);
  if (!ctx.user) return replan(uid, now, ctx);
  const plan = ctx.engine.nextNudge;

  // Auto-régulation : notifications ignorées → plus sélectif, puis pause progressive.
  const recentSnap = await db().collection(`users/${uid}/notifications`).orderBy('createdAt', 'desc').limit(8).get();
  const recent = recentSnap.docs.map((d) => d.data()).filter((n) => n.kind === 'risk' || n.kind === 'milestone');
  const ignored = computeIgnoredStreak(recent, now);
  let state = { ...ctx.state, ignoredStreak: ignored };
  const pauseEnd = (state.lastSentAt || now) + pauseDuration(ignored);
  if (pauseEnd > now && pauseEnd > (state.pausedUntil ?? 0)) state.pausedUntil = pauseEnd;

  const check = canSendNow({ plan, now, tz: ctx.tz, prefs: ctx.prefs, state, lastActiveAt: ctx.user.lastActiveAt });
  if (check.ok) {
    const habit = ctx.habits.find((h) => h.id === plan.habitId);
    if (habit) {
      const topTrigger = plan.kind === 'risk' ? topTriggerAround(ctx.logs, habit.id, plan.hour) : null;
      const msg = composeNudge({ plan, habit, state, topTrigger });
      const ref = db().collection(`users/${uid}/notifications`).doc();
      const pushed = check.inAppOnly
        ? false
        : await sendPush(uid, ctx.user.fcmTokens, { ...msg, link: `${appUrl()}/notifications?open=${ref.id}`, notifId: ref.id }).catch((e) => {
            logger.warn('Échec push', { uid, error: e.message });
            return false;
          });
      await ref.set({ kind: plan.kind, habitId: habit.id, ...msg, pushed, createdAt: now, readAt: null, openedAt: null });
      state = stateAfterSend(state, plan, now, ctx.tz);
      logger.info('Notification envoyée', { uid, kind: plan.kind, pushed });
    }
  } else {
    logger.debug('Notification reportée', { uid, reason: check.reason });
  }
  return replan(uid, now, { ...ctx, state });
}

/** Passe planifiée : traite tous les utilisateurs dont la prochaine notification est due. */
export async function dispatchDue(now = Date.now()) {
  const due = await db().collection('engine').where('nextNudgeAt', '<=', now).limit(400).get();
  const ids = due.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 25) {
    const results = await Promise.allSettled(ids.slice(i, i + 25).map((uid) => processDueUser(uid, now)));
    results.forEach((r, j) => r.status === 'rejected' && logger.error('Erreur moteur', { uid: ids[i + j], error: r.reason?.message }));
  }
  return ids.length;
}
