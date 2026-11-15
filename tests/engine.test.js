import { describe, it, expect } from 'vitest';
import {
  DAY,
  HOUR,
  MINUTE,
  localParts,
  buildRiskProfile,
  riskAt,
  computeHabitStats,
  deriveInsights,
  newHabitFromTemplate,
  planNextNudge,
  canSendNow,
  stateAfterSend,
  computeIgnoredStreak,
  pauseDuration,
  composeNudge,
  isQuietHour,
  DEFAULT_PREFS,
  DEFAULT_STATE,
} from '../shared/index.js';

const TZ = 'Europe/Paris';
// Lundi 2 mars 2026, 9 h 00 à Paris (UTC+1)
const NOW = Date.UTC(2026, 2, 2, 8, 0);

function craving(at, extra = {}) {
  const p = localParts(at, TZ);
  return { habitId: 'h1', type: 'craving', at, localHour: p.hour, localDow: p.dow, intensity: 3, resisted: true, ...extra };
}

/** 14 jours d'envies à 13 h (après le repas) + un peu de bruit. */
function lunchCravings() {
  const out = [];
  for (let d = 1; d <= 14; d++) {
    out.push(craving(Date.UTC(2026, 2, 2 - d, 12, 5), { trigger: 'Après repas' })); // 13 h 05 Paris
    if (d % 3 === 0) out.push(craving(Date.UTC(2026, 2, 2 - d, 17, 30), { trigger: 'Stress', resisted: false }));
  }
  return out;
}

const habit = { id: 'h1', ...newHabitFromTemplate('tabac'), startedAt: NOW - 20 * DAY };

describe('time', () => {
  it('calcule heure et jour locaux', () => {
    expect(localParts(NOW, TZ)).toMatchObject({ hour: 9, minute: 0, dow: 1, dayKey: '2026-03-02' });
  });
  it('gère les heures calmes qui passent minuit', () => {
    expect(isQuietHour(23, DEFAULT_PREFS)).toBe(true);
    expect(isQuietHour(7, DEFAULT_PREFS)).toBe(true);
    expect(isQuietHour(8, DEFAULT_PREFS)).toBe(false);
    expect(isQuietHour(14, { quietStart: 13, quietEnd: 15 })).toBe(true);
  });
});

describe('profil de risque', () => {
  it('identifie le pic de 13 h', () => {
    const { scores, samples } = buildRiskProfile(lunchCravings(), NOW);
    expect(samples).toBe(18);
    expect(riskAt(scores, 1, 13)).toBeGreaterThan(0.8);
    expect(riskAt(scores, 1, 4)).toBeLessThan(0.1);
  });
});

describe('statistiques', () => {
  it('calcule série, économies et paliers', () => {
    const logs = [{ habitId: 'h1', type: 'use', at: NOW - 5 * DAY, quantity: 2 }, ...lunchCravings()];
    const s = computeHabitStats(habit, logs, NOW);
    expect(Math.round(s.streakMs / DAY)).toBe(5);
    expect(Math.round(s.longestStreakMs / DAY)).toBe(15);
    expect(s.avoided).toBeCloseTo(15 * 20 - 2, 5);
    expect(s.moneySaved).toBeCloseTo((15 * 20 - 2) * 0.62, 5);
    expect(s.nextMilestone.title).toBe('2 semaines');
    expect(s.series).toHaveLength(30);
    expect(s.triggers[0].trigger).toBe('Après repas');
  });
  it('produit des analyses lisibles', () => {
    const ins = deriveInsights(habit, lunchCravings(), NOW);
    expect(ins.some((i) => i.id === 'peak-hour')).toBe(true);
  });
});

describe('planification des notifications', () => {
  const risk = { h1: buildRiskProfile(lunchCravings(), NOW) };
  const habits = [{ ...habit, mode: 'reduce', streakStart: NOW - 5 * DAY }];

  it('reste silencieux sans données suffisantes', () => {
    const plan = planNextNudge({ now: NOW, tz: TZ, prefs: DEFAULT_PREFS, state: DEFAULT_STATE, habits, risk: {} });
    expect(plan).toBeNull();
  });

  it('prévient 15 min avant le pic du midi', () => {
    const plan = planNextNudge({ now: NOW, tz: TZ, prefs: DEFAULT_PREFS, state: DEFAULT_STATE, habits, risk });
    expect(plan.kind).toBe('risk');
    expect(localParts(plan.at, TZ)).toMatchObject({ hour: 12, minute: 45 });
    expect(plan.hour).toBe(13);
  });

  it('respecte le budget quotidien (mode discret = 1/jour)', () => {
    const state = { ...DEFAULT_STATE, dayKey: '2026-03-02', sentToday: 1, lastSentAt: NOW - 20 * HOUR };
    const plan = planNextNudge({ now: NOW, tz: TZ, prefs: DEFAULT_PREFS, state, habits, risk });
    expect(localParts(plan.at, TZ).dayKey).toBe('2026-03-03');
  });

  it('se met en pause quand les notifs sont ignorées', () => {
    const recent = [1, 2, 3].map((d) => ({ pushed: true, createdAt: NOW - d * DAY }));
    const ignored = computeIgnoredStreak(recent, NOW);
    expect(ignored).toBe(3);
    expect(pauseDuration(ignored)).toBe(2 * DAY);
    const state = { ...DEFAULT_STATE, ignoredStreak: ignored, pausedUntil: NOW + 2 * DAY };
    const plan = planNextNudge({ now: NOW, tz: TZ, prefs: DEFAULT_PREFS, state, habits, risk });
    expect(plan.at).toBeGreaterThanOrEqual(NOW + 2 * DAY);
  });

  it('une notif ouverte remet le compteur à zéro', () => {
    const recent = [
      { pushed: true, createdAt: NOW - DAY, openedAt: NOW - DAY + 10 * MINUTE },
      { pushed: true, createdAt: NOW - 2 * DAY },
    ];
    expect(computeIgnoredStreak(recent, NOW)).toBe(0);
  });

  it('ne dérange pas un utilisateur déjà dans l’app', () => {
    const plan = { kind: 'risk', at: NOW, hour: 13, score: 1, habitId: 'h1' };
    const res = canSendNow({ plan, now: NOW, tz: TZ, prefs: { ...DEFAULT_PREFS, push: true }, state: DEFAULT_STATE, lastActiveAt: NOW - 10 * MINUTE });
    expect(res).toEqual({ ok: false, reason: 'active' });
  });

  it('ne notifie jamais pendant les heures calmes', () => {
    const night = Date.UTC(2026, 2, 2, 22, 30); // 23 h 30 Paris
    const plan = { kind: 'milestone', at: night, habitId: 'h1', milestone: { minutes: 20, title: 't', text: 't' } };
    expect(canSendNow({ plan, now: night, tz: TZ, prefs: DEFAULT_PREFS, state: DEFAULT_STATE }).reason).toBe('quiet');
  });

  it('célèbre un palier puis passe au suivant', () => {
    const quit = [{ ...habit, streakStart: NOW - 10 * MINUTE }];
    const plan = planNextNudge({ now: NOW, tz: TZ, prefs: DEFAULT_PREFS, state: DEFAULT_STATE, habits: quit, risk: {} });
    expect(plan.kind).toBe('milestone');
    expect(plan.milestone.title).toBe('20 minutes');
    const state = stateAfterSend(DEFAULT_STATE, plan, plan.at, TZ);
    const next = planNextNudge({ now: plan.at, tz: TZ, prefs: DEFAULT_PREFS, state, habits: quit, risk: {} });
    expect(next.milestone.title).toBe('12 heures');
    const msg = composeNudge({ plan: next, habit });
    expect(msg.title).toContain('12 heures');
  });

  it('rédige un message de risque sans culpabiliser', () => {
    const msg = composeNudge({ plan: { kind: 'risk', hour: 13 }, habit, topTrigger: 'Après repas' });
    expect(msg.body).toMatch(/Vers 13 h, l’envie de fumer se manifeste souvent \(souvent : après repas\)/);
  });
});

describe('transparence', () => {
  it('une réévaluation ne masque pas un palier prévu', async () => {
    const { describePlan } = await import('../shared/index.js');
    const risk = { h1: buildRiskProfile(lunchCravings(), NOW) };
    const quit = [{ ...habit, streakStart: NOW - 9 * DAY }];
    const state = { ...DEFAULT_STATE, pausedUntil: NOW + 3 * DAY };
    const plan = planNextNudge({ now: NOW, tz: TZ, prefs: DEFAULT_PREFS, state, habits: quit, risk });
    expect(plan.kind).toBe('recheck');
    expect(plan.upcoming.kind).toBe('milestone');
    expect(describePlan(plan, TZ)).toMatch(/2 semaines/);
  });
});

describe('défi du jour', () => {
  it('change chaque jour et reste stable dans la journée', async () => {
    const { challengeOf, CHALLENGES } = await import('../shared/index.js');
    expect(challengeOf('2026-11-16')).toBe(challengeOf('2026-11-16'));
    expect(challengeOf('2026-11-16')).not.toBe(challengeOf('2026-11-17'));
    expect(CHALLENGES).toContain(challengeOf('2030-01-01'));
  });
});
