// Statistiques « utiles » : projections, comparaison de semaines, moments de la journée, calendrier.
import { DAY, dayKey, startOfDay } from './time.js';

const qty = (l) => (Number.isFinite(l.quantity) && l.quantity > 0 ? l.quantity : 1);

export const DAYPARTS = [
  { id: 'matin', label: 'Matin', from: 5, to: 12 },
  { id: 'aprem', label: 'Après-midi', from: 12, to: 18 },
  { id: 'soir', label: 'Soir', from: 18, to: 23 },
  { id: 'nuit', label: 'Nuit', from: 23, to: 5 },
];

const inPart = (h, p) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to);

/**
 * @returns {{
 *  projection: {perDay:number, month:{money:number, units:number}, year:{money:number, units:number}},
 *  week: {cravings:[number,number], resisted:[number,number], used:[number,number]},
 *  dayparts: {id:string,label:string,count:number,resisted:number,rate:number|null}[],
 *  calendar: {key:string, day:number, status:'before'|'clean'|'ok'|'over'|'used'|'future'}[],
 *  cleanDays:number
 * }}
 */
export function computeExtraStats(habit, logs, now = Date.now()) {
  const start = habit.startedAt ?? now;
  const mine = logs.filter((l) => l.habitId === habit.id);
  const uses = mine.filter((l) => l.type === 'use' && l.at >= start);
  const cravings = mine.filter((l) => l.type === 'craving');
  const baseline = habit.baselinePerDay ?? 0;
  const cost = habit.costPerUnit ?? 0;

  // Projection au rythme des 14 derniers jours (ou depuis le début si plus récent)
  const windowStart = Math.max(start, now - 14 * DAY);
  const windowDays = Math.max(1, (now - windowStart) / DAY);
  const recentUse = uses.filter((u) => u.at >= windowStart).reduce((a, u) => a + qty(u), 0) / windowDays;
  const unitsPerDay = Math.max(0, baseline - recentUse);
  const projection = {
    perDay: unitsPerDay,
    month: { units: unitsPerDay * 30, money: unitsPerDay * 30 * cost },
    year: { units: unitsPerDay * 365, money: unitsPerDay * 365 * cost },
  };

  // Cette semaine (7 derniers jours) vs la précédente
  const span = (from, to) => (l) => l.at > from && l.at <= to;
  const thisW = span(now - 7 * DAY, now);
  const lastW = span(now - 14 * DAY, now - 7 * DAY);
  const week = {
    cravings: [cravings.filter(thisW).length, cravings.filter(lastW).length],
    resisted: [cravings.filter((c) => c.resisted && thisW(c)).length, cravings.filter((c) => c.resisted && lastW(c)).length],
    used: [uses.filter(thisW).reduce((a, u) => a + qty(u), 0), uses.filter(lastW).reduce((a, u) => a + qty(u), 0)],
  };

  // Réussite par moment de la journée
  const dayparts = DAYPARTS.map((p) => {
    const list = cravings.filter((c) => Number.isInteger(c.localHour) && inPart(c.localHour, p));
    const resisted = list.filter((c) => c.resisted).length;
    return { id: p.id, label: p.label, count: list.length, resisted, rate: list.length ? resisted / list.length : null };
  });

  // Calendrier des 8 dernières semaines (lundi → dimanche)
  const usedByDay = new Map();
  for (const u of uses) usedByDay.set(dayKey(u.at), (usedByDay.get(dayKey(u.at)) ?? 0) + qty(u));
  const today0 = startOfDay(now);
  const dow = (new Date(today0).getDay() + 6) % 7; // 0 = lundi
  const firstDay = startOfDay(today0 - (7 * 7 + dow) * DAY + DAY / 2);
  const startDay = startOfDay(start);
  const calendar = [];
  let cleanDays = 0;
  for (let i = 0; i < 56; i++) {
    const d = startOfDay(firstDay + i * DAY + DAY / 2);
    const key = dayKey(d);
    const used = usedByDay.get(key) ?? 0;
    let status;
    if (d > today0) status = 'future';
    else if (d < startDay) status = 'before';
    else if (habit.mode === 'reduce') status = used <= (habit.targetPerDay ?? 0) ? 'ok' : 'over';
    else status = used > 0 ? 'used' : 'clean';
    calendar.push({ key, day: new Date(d).getDate(), status });
  }
  for (let d = startDay; d <= today0; d = startOfDay(d + DAY + DAY / 2)) {
    const used = usedByDay.get(dayKey(d)) ?? 0;
    if (habit.mode === 'reduce' ? used <= (habit.targetPerDay ?? 0) : used === 0) cleanDays++;
  }

  return { projection, week, dayparts, calendar, cleanDays };
}
