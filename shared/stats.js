// Calcul des statistiques d'une habitude : série, économies, envies, paliers…
import { DAY, MINUTE, dayKey, startOfDay, DOW_LONG } from './time.js';
import { milestonesOf, targetAt } from './habits.js';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const qty = (l) => (Number.isFinite(l.quantity) && l.quantity > 0 ? l.quantity : 1);

/**
 * @param {object} habit  document habitude (avec id, startedAt, mode, baselinePerDay…)
 * @param {object[]} logs journaux de l'utilisateur ({habitId, type:'craving'|'use', at, …})
 * @param {number} now    horodatage courant (ms)
 * @param {{days?: number}} opts
 */
export function computeHabitStats(habit, logs, now = Date.now(), { days = 30 } = {}) {
  const start = habit.startedAt ?? now;
  const mine = logs.filter((l) => l.habitId === habit.id);
  const uses = mine.filter((l) => l.type === 'use' && l.at >= start).sort((a, b) => a.at - b.at);
  const cravings = mine.filter((l) => l.type === 'craving');

  const lastUseFromLogs = uses.length ? uses[uses.length - 1].at : null;
  const lastUseAt = Math.max(lastUseFromLogs ?? -Infinity, habit.lastUseAt >= start ? habit.lastUseAt : -Infinity);
  const hasUse = Number.isFinite(lastUseAt);

  const elapsedMs = Math.max(0, now - start);
  const consumed = sum(uses.map(qty));
  const expected = (habit.baselinePerDay ?? 0) * (elapsedMs / DAY);
  const avoided = Math.max(0, expected - consumed);
  const moneySaved = avoided * (habit.costPerUnit ?? 0);

  // Série en cours (mode arrêt) et record
  const streakStart = hasUse ? Math.max(start, lastUseAt) : start;
  const streakMs = Math.max(0, now - streakStart);
  const points = [start, ...uses.map((u) => u.at), now];
  let longestStreakMs = 0;
  for (let i = 1; i < points.length; i++) longestStreakMs = Math.max(longestStreakMs, points[i] - points[i - 1]);

  // Consommation par jour
  const usedByDay = new Map();
  for (const u of uses) usedByDay.set(dayKey(u.at), (usedByDay.get(dayKey(u.at)) ?? 0) + qty(u));
  const todayUsed = usedByDay.get(dayKey(now)) ?? 0;

  // Mode réduction : jours consécutifs sous l'objectif (aujourd'hui compris s'il est encore dans les clous)
  let daysOnTarget = 0;
  if (habit.mode === 'reduce') {
    let cursor = startOfDay(now);
    const firstDay = startOfDay(start);
    if (todayUsed > targetAt(habit, now)) daysOnTarget = 0;
    else {
      while (cursor >= firstDay && (usedByDay.get(dayKey(cursor)) ?? 0) <= targetAt(habit, cursor + DAY / 2)) {
        daysOnTarget++;
        cursor = startOfDay(cursor - DAY / 2);
      }
    }
  }

  // Envies
  const resisted = cravings.filter((c) => c.resisted).length;
  const resistRate = cravings.length ? resisted / cravings.length : null;

  // Série quotidienne sur `days` jours
  const series = [];
  const today0 = startOfDay(now);
  let cumulative = 0;
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(today0 - i * DAY + DAY / 2); // robuste aux changements d'heure
    const key = dayKey(dayStart);
    const dayCravings = cravings.filter((c) => dayKey(c.at) === key);
    const used = usedByDay.get(key) ?? 0;
    const dayEnd = Math.min(now, startOfDay(dayStart + DAY + DAY / 2));
    const activeMs = Math.max(0, dayEnd - Math.max(dayStart, start));
    const savedUnits = Math.max(0, (habit.baselinePerDay ?? 0) * (activeMs / DAY) - used);
    cumulative += savedUnits * (habit.costPerUnit ?? 0);
    const d = new Date(dayStart);
    series.push({
      key,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      resisted: dayCravings.filter((c) => c.resisted).length,
      gaveIn: dayCravings.filter((c) => c.resisted === false).length,
      used,
      savedCumulative: Math.round(cumulative * 100) / 100,
    });
  }

  // Déclencheurs
  const triggerMap = new Map();
  for (const c of cravings) {
    const k = c.trigger || 'Non précisé';
    const t = triggerMap.get(k) ?? { trigger: k, count: 0, resisted: 0 };
    t.count++;
    if (c.resisted) t.resisted++;
    triggerMap.set(k, t);
  }
  const triggers = [...triggerMap.values()]
    .map((t) => ({ ...t, resistRate: t.resisted / t.count }))
    .sort((a, b) => b.count - a.count);

  // Carte de chaleur jour × heure (168 cases)
  const heat = new Array(168).fill(0);
  for (const c of cravings) {
    if (Number.isInteger(c.localDow) && Number.isInteger(c.localHour)) heat[c.localDow * 24 + c.localHour]++;
  }

  // Paliers (mode arrêt)
  const all = milestonesOf(habit).map((m) => ({ ...m, achieved: streakMs >= m.minutes * MINUTE }));
  const nextIdx = all.findIndex((m) => !m.achieved);
  const next = nextIdx >= 0 ? all[nextIdx] : null;
  const prevMinutes = nextIdx > 0 ? all[nextIdx - 1].minutes : 0;
  const milestoneProgress = next
    ? Math.min(1, (streakMs / MINUTE - prevMinutes) / (next.minutes - prevMinutes))
    : 1;

  return {
    elapsedMs,
    consumed,
    avoided,
    moneySaved,
    streakStart,
    streakMs,
    longestStreakMs,
    lastUseAt: hasUse ? lastUseAt : null,
    todayUsed,
    daysOnTarget,
    cravingsTotal: cravings.length,
    resisted,
    resistRate,
    series,
    triggers,
    heat,
    milestones: all,
    nextMilestone: next,
    milestoneProgress,
  };
}

/**
 * Petites phrases d'analyse personnalisées, sans jugement.
 * @returns {{id:string, icon:string, text:string}[]}
 */
export function deriveInsights(habit, logs, now = Date.now()) {
  const cravings = logs.filter((l) => l.habitId === habit.id && l.type === 'craving');
  const out = [];
  if (cravings.length < 5) {
    out.push({
      id: 'more-data',
      icon: '🌱',
      text: `Note tes envies quand elles arrivent : dès 5 envies notées, Déclic repère tes moments à risque (${cravings.length}/5).`,
    });
    return out;
  }

  // Tendance : 7 derniers jours vs 7 précédents
  const last7 = cravings.filter((c) => c.at > now - 7 * DAY).length;
  const prev7 = cravings.filter((c) => c.at <= now - 7 * DAY && c.at > now - 14 * DAY).length;
  if (prev7 >= 3) {
    const delta = Math.round(((last7 - prev7) / prev7) * 100);
    if (delta <= -10) out.push({ id: 'trend', icon: '📉', text: `${-delta} % d’envies en moins cette semaine que la précédente. Ça paie !` });
    else if (delta >= 25) out.push({ id: 'trend', icon: '🧭', text: `Semaine plus chargée en envies (+${delta} %). C’est normal par moments : tiens bon, ça redescend.` });
  }

  // Créneau horaire le plus fréquent (fenêtre de 2 h)
  const byHour = new Array(24).fill(0);
  for (const c of cravings) if (Number.isInteger(c.localHour)) byHour[c.localHour]++;
  let bestH = 0;
  let bestV = -1;
  for (let h = 0; h < 24; h++) {
    const v = byHour[h] + byHour[(h + 1) % 24];
    if (v > bestV) [bestH, bestV] = [h, v];
  }
  if (bestV / cravings.length >= 0.2) {
    out.push({ id: 'peak-hour', icon: '⏰', text: `Tes envies se concentrent entre ${bestH} h et ${(bestH + 2) % 24} h. Prévois une parade pour ce moment-là.` });
  }

  // Jour de semaine le plus difficile
  const byDow = new Array(7).fill(0);
  for (const c of cravings) if (Number.isInteger(c.localDow)) byDow[c.localDow]++;
  const maxDow = byDow.indexOf(Math.max(...byDow));
  const avg = cravings.length / 7;
  if (byDow[maxDow] >= avg * 1.6 && byDow[maxDow] >= 3) {
    out.push({ id: 'peak-day', icon: '📅', text: `Le ${DOW_LONG[maxDow]} est ton jour le plus délicat. Bon à savoir pour t’organiser.` });
  }

  // Déclencheurs : meilleur et plus difficile
  const stats = new Map();
  for (const c of cravings) {
    if (!c.trigger) continue;
    const s = stats.get(c.trigger) ?? { n: 0, r: 0 };
    s.n++;
    if (c.resisted) s.r++;
    stats.set(c.trigger, s);
  }
  const ranked = [...stats.entries()].filter(([, s]) => s.n >= 3).map(([t, s]) => ({ t, rate: s.r / s.n }));
  if (ranked.length >= 2) {
    ranked.sort((a, b) => a.rate - b.rate);
    const hard = ranked[0];
    const easy = ranked[ranked.length - 1];
    if (easy.rate - hard.rate >= 0.25) {
      out.push({
        id: 'triggers',
        icon: '🎯',
        text: `Tu résistes ${Math.round(easy.rate * 100)} % du temps face à « ${easy.t} », mais ${Math.round(hard.rate * 100)} % face à « ${hard.t} ». C’est là que se joue la suite.`,
      });
    }
  }

  const resisted = cravings.filter((c) => c.resisted).length;
  if (resisted >= 10) out.push({ id: 'resisted', icon: '💪', text: `${resisted} envies surmontées depuis le début. Chacune compte.` });
  return out;
}
