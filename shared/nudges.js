// Moteur de notifications intelligentes et non intrusives.
//
// Principes :
//  1. Silence par défaut : aucune notif de « risque » tant qu'on n'a pas assez de données.
//  2. Budget quotidien strict (1 ou 2 max selon le niveau choisi) + écart minimal entre deux notifs.
//  3. Heures calmes respectées (par défaut 22 h → 8 h).
//  4. Anticipation : on prévient ~15 min AVANT un moment à risque, jamais au hasard.
//  5. Auto-régulation : si les notifs sont ignorées, le moteur devient plus sélectif puis se met en pause.
//  6. Pas de notif si l'utilisateur est déjà dans l'app.
//  7. Les célébrations (paliers) passent en priorité mais restent soumises aux heures calmes.
import { MINUTE, HOUR, DAY, localParts } from './time.js';
import { riskAt, MIN_SAMPLES } from './risk.js';
import { milestonesOf, tipsOf, cravingPhrase } from './habits.js';

export const NOTIF_LEVELS = {
  off: {
    label: 'Désactivées',
    budget: 0,
    minRisk: Infinity,
    minGapH: Infinity,
    description: 'Aucune notification. Tu gardes l’historique dans l’app.',
  },
  discret: {
    label: 'Discret',
    budget: 1,
    minRisk: 0.7,
    minGapH: 18,
    description: 'Au plus 1 rappel par jour, seulement avant tes moments les plus difficiles, et tes paliers.',
  },
  equilibre: {
    label: 'Équilibré',
    budget: 2,
    minRisk: 0.5,
    minGapH: 5,
    description: 'Au plus 2 rappels par jour, espacés d’au moins 5 h, et tes paliers.',
  },
};

export const DEFAULT_PREFS = {
  level: 'discret',
  quietStart: 22,
  quietEnd: 8,
  milestones: true,
  social: false, // réponses de la communauté en push (sinon : seulement dans l'app)
  push: false, // activé uniquement quand l'utilisateur clique sur « Activer »
};

export const DEFAULT_STATE = {
  dayKey: null,
  sentToday: 0,
  lastSentAt: 0,
  sentTotal: 0,
  ignoredStreak: 0,
  pausedUntil: 0,
  milestonesDone: {},
};

export const LEAD = 15 * MINUTE; // avance sur le moment à risque
const SLOT = 15 * MINUTE;
const HORIZON = 40 * HOUR;
export const ACTIVE_WINDOW = 45 * MINUTE;
const JUDGE_AFTER = 6 * HOUR; // délai avant de considérer une notif comme ignorée
const OPEN_WINDOW = 12 * HOUR;

const levelOf = (prefs) => NOTIF_LEVELS[prefs?.level] ?? NOTIF_LEVELS.discret;

export function isQuietHour(hour, prefs = DEFAULT_PREFS) {
  const qs = prefs.quietStart ?? 22;
  const qe = prefs.quietEnd ?? 8;
  if (qs === qe) return false;
  return qs > qe ? hour >= qs || hour < qe : hour >= qs && hour < qe;
}

/** Premier créneau ≥ ts hors des heures calmes. */
export function nextAllowedTime(ts, tz, prefs) {
  let t = Math.ceil(ts / SLOT) * SLOT;
  for (let i = 0; i < (24 * HOUR) / SLOT + 1; i++) {
    if (!isQuietHour(localParts(t, tz).hour, prefs)) return t;
    t += SLOT;
  }
  return t;
}

/**
 * Nombre de notifications push consécutives ignorées (les plus récentes d'abord).
 * Une notif est « vue » si elle a été ouverte ou lue dans l'app dans les 12 h.
 */
export function computeIgnoredStreak(recent, now = Date.now()) {
  const sorted = [...recent].filter((n) => n.pushed).sort((a, b) => b.createdAt - a.createdAt);
  let streak = 0;
  for (const n of sorted) {
    const seenAt = Math.min(n.openedAt ?? Infinity, n.readAt ?? Infinity);
    const seen = seenAt - n.createdAt <= OPEN_WINDOW;
    if (seen) break;
    if (now - n.createdAt < JUDGE_AFTER) continue; // trop tôt pour juger
    streak++;
  }
  return streak;
}

/** Durée de pause après des notifs ignorées : 3 → 2 j, 4 → 4 j, 5+ → 6-7 j. */
export function pauseDuration(ignoredStreak) {
  if (ignoredStreak < 3) return 0;
  return Math.min(7, 2 * (ignoredStreak - 2)) * DAY;
}

/** Prochain palier à célébrer pour une habitude en mode arrêt. */
export function upcomingMilestone(habit, streakStart, state, now) {
  if (habit.mode !== 'quit' || !Number.isFinite(streakStart)) return null;
  const done = state.milestonesDone?.[habit.id];
  const doneMinutes = done && done.streakStart === streakStart ? done.minutes : -1;
  for (const m of milestonesOf(habit)) {
    if (m.minutes <= doneMinutes) continue;
    const at = streakStart + m.minutes * MINUTE;
    if (at < now - 12 * HOUR) continue; // trop ancien : on ne fête pas en retard
    return { ...m, at };
  }
  return null;
}

/**
 * Planifie la prochaine notification.
 * @param {object} p
 * @param {number} p.now
 * @param {string} p.tz                 fuseau IANA de l'utilisateur
 * @param {object} p.prefs              préférences de notif
 * @param {object} p.state              état du moteur (budget, pause…)
 * @param {object[]} p.habits           habitudes actives, avec `streakStart`
 * @param {Record<string,{scores:number[],samples:number}>} p.risk profils par habitude
 * @returns {null | {at:number, kind:'risk'|'milestone'|'recheck', habitId?:string, hour?:number, score?:number, milestone?:object, streakStart?:number}}
 */
export function planNextNudge({ now, tz, prefs = DEFAULT_PREFS, state = DEFAULT_STATE, habits = [], risk = {} }) {
  const level = levelOf(prefs);
  if (prefs.level === 'off') return null;
  const candidates = [];

  // 1. Paliers
  if (prefs.milestones !== false) {
    for (const h of habits) {
      const m = upcomingMilestone(h, h.streakStart, state, now);
      if (m) {
        candidates.push({
          at: nextAllowedTime(Math.max(m.at, now), tz, prefs),
          kind: 'milestone',
          habitId: h.id,
          milestone: { minutes: m.minutes, title: m.title, text: m.text },
          streakStart: h.streakStart,
        });
      }
    }
  }

  // 2. Moments à risque
  const usable = habits.filter((h) => (risk[h.id]?.samples ?? 0) >= MIN_SAMPLES);
  if (usable.length) {
    const ignored = state.ignoredStreak ?? 0;
    const minRisk = Math.min(0.95, level.minRisk + 0.1 * Math.max(0, ignored - 1));
    const todayKey = localParts(now, tz).dayKey;
    const sentToday = state.dayKey === todayKey ? state.sentToday ?? 0 : 0;
    const from = Math.max(now + MINUTE, state.pausedUntil ?? 0, (state.lastSentAt ?? 0) + level.minGapH * HOUR);
    const bestPerDay = new Map();

    for (let s = Math.ceil(from / SLOT) * SLOT; s <= now + HORIZON; s += SLOT) {
      const p = localParts(s, tz);
      if (isQuietHour(p.hour, prefs)) continue;
      if (p.dayKey === todayKey && sentToday >= level.budget) continue;
      const target = localParts(s + LEAD, tz);
      if (target.minute >= 15) continue; // on ne vise que le début d'une heure
      let best = { score: 0, habitId: null };
      for (const h of usable) {
        const score = riskAt(risk[h.id].scores, target.dow, target.hour);
        if (score > best.score) best = { score, habitId: h.id };
      }
      if (best.score < minRisk) continue;
      const prev = bestPerDay.get(p.dayKey);
      if (!prev || best.score > prev.score) {
        bestPerDay.set(p.dayKey, { at: s, kind: 'risk', habitId: best.habitId, hour: target.hour, score: best.score });
      }
    }
    const risky = [...bestPerDay.values()].sort((a, b) => a.at - b.at)[0];
    candidates.push(risky ?? { at: Math.max(now + 12 * HOUR, state.pausedUntil ?? 0), kind: 'recheck' });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.at - b.at);
  const first = candidates[0];
  // Une simple réévaluation ne doit pas masquer un palier déjà prévu (affiché à l'utilisateur).
  if (first.kind === 'recheck') {
    const upcoming = candidates.find((c) => c.kind !== 'recheck');
    if (upcoming) return { ...first, upcoming };
  }
  return first;
}

/**
 * Vérifie au moment de l'envoi que tout est toujours OK (les conditions ont pu changer).
 * @returns {{ok:boolean, reason?:string, inAppOnly?:boolean}}
 */
export function canSendNow({ plan, now, tz, prefs = DEFAULT_PREFS, state = DEFAULT_STATE, lastActiveAt = 0 }) {
  if (!plan || plan.kind === 'recheck') return { ok: false, reason: 'recheck' };
  if (prefs.level === 'off') return { ok: false, reason: 'off' };
  const p = localParts(now, tz);
  if (isQuietHour(p.hour, prefs)) return { ok: false, reason: 'quiet' };
  const isActive = now - (lastActiveAt ?? 0) < ACTIVE_WINDOW;

  if (plan.kind === 'milestone') {
    // L'utilisateur est dans l'app : la célébration s'affiche dans l'app, sans push.
    return { ok: true, inAppOnly: isActive || !prefs.push };
  }

  const level = levelOf(prefs);
  if ((state.pausedUntil ?? 0) > now) return { ok: false, reason: 'paused' };
  const sentToday = state.dayKey === p.dayKey ? state.sentToday ?? 0 : 0;
  if (sentToday >= level.budget) return { ok: false, reason: 'budget' };
  if (now - (state.lastSentAt ?? 0) < level.minGapH * HOUR) return { ok: false, reason: 'gap' };
  if (isActive) return { ok: false, reason: 'active' };
  return { ok: true, inAppOnly: !prefs.push };
}

/** Met à jour l'état après un envoi. */
export function stateAfterSend(state, plan, now, tz) {
  const key = localParts(now, tz).dayKey;
  const next = { ...DEFAULT_STATE, ...state };
  if (plan.kind === 'risk') {
    next.sentToday = (state.dayKey === key ? state.sentToday ?? 0 : 0) + 1;
    next.dayKey = key;
    next.lastSentAt = now;
  }
  if (plan.kind === 'milestone') {
    next.milestonesDone = {
      ...(state.milestonesDone ?? {}),
      [plan.habitId]: { streakStart: plan.streakStart, minutes: plan.milestone.minutes },
    };
  }
  next.sentTotal = (state.sentTotal ?? 0) + 1;
  return next;
}

const RISK_TITLES = ['Petit rappel bienveillant', 'Moment délicat en approche', 'Un coup de pouce ?', 'Tu as ce qu’il faut'];

/** Rédige le message (ton doux, jamais culpabilisant, varié). */
export function composeNudge({ plan, habit, state = DEFAULT_STATE, topTrigger = null }) {
  const n = state.sentTotal ?? 0;
  if (plan.kind === 'milestone') {
    return {
      title: `${habit.emoji ?? '🎉'} ${plan.milestone.title} : bravo !`,
      body: plan.milestone.text,
    };
  }
  const tips = tipsOf(habit);
  const tip = tips[n % tips.length];
  const trig = topTrigger ? ` (souvent : ${topTrigger.toLowerCase()})` : '';
  return {
    title: RISK_TITLES[n % RISK_TITLES.length],
    body: `Vers ${plan.hour} h, ${cravingPhrase(habit)} se manifeste souvent${trig}. ${tip}`,
  };
}

/** Explication lisible du prochain rappel prévu (transparence). */
export function describePlan(plan, tz) {
  if (!plan) return null;
  if (plan.kind === 'recheck') {
    return plan.upcoming
      ? describePlan(plan.upcoming, tz)
      : 'Déclic surveille tes moments à risque : aucun rappel n’est utile pour l’instant.';
  }
  const d = new Date(plan.at);
  const when = d.toLocaleString('fr-FR', { timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit' });
  if (plan.kind === 'milestone') return `Prochaine célébration ${when} : palier « ${plan.milestone.title} ».`;
  return `Prochain rappel possible ${when}, juste avant un moment où tes envies sont fréquentes (${Math.round(plan.score * 100)} % de ton pic).`;
}
