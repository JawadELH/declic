/** Montant : centimes affichés sous 100 € (ou toujours si `digits` = 2). */
export const money = (v, currency = 'EUR', digits = null) => {
  const d = digits ?? (Math.abs(v || 0) >= 100 ? 0 : 2);
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(v || 0);
};

export const num = (v, digits = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(v || 0);

export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)} %`);

/** « il y a 5 min », « hier »… */
export function timeAgo(ts) {
  if (!ts) return '';
  const t = typeof ts === 'number' ? ts : ts.toMillis?.() ?? Date.now();
  const s = Math.round((Date.now() - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  if (s < 60) return 'à l’instant';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 7 * 86400) return rtf.format(-Math.round(s / 86400), 'day');
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export const toMillis = (v) => (typeof v === 'number' ? v : v?.toMillis?.() ?? 0);

export const AVATARS = ['🙂', '🦊', '🐻', '🐼', '🦁', '🐢', '🦉', '🐬', '🌻', '🌵', '🍀', '⭐', '🌊', '🔥', '🚀', '🎈'];
