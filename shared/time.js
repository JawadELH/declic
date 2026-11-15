// Outils de temps indépendants du runtime (navigateur ou Cloud Functions).

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtCache = new Map();

function formatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      }),
    );
  }
  return fmtCache.get(tz);
}

/** Heure, minute, jour de semaine (0 = dimanche) et clé de jour dans un fuseau donné. */
export function localParts(ts, tz = 'Europe/Paris') {
  const parts = {};
  for (const p of formatter(tz).formatToParts(new Date(ts))) parts[p.type] = p.value;
  return {
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    dow: DOW[parts.weekday],
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Clé de jour (AAAA-MM-JJ) dans le fuseau local du runtime. */
export function dayKey(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Minuit local du jour contenant ts (fuseau du runtime). */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const DOW_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Durée lisible : « 3 j 4 h 12 min ». */
export function formatDuration(ms) {
  if (ms < MINUTE) return 'moins d’une minute';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  const out = [];
  if (d) out.push(`${d} j`);
  if (h || d) out.push(`${h} h`);
  if (!d) out.push(`${m} min`);
  return out.join(' ');
}
