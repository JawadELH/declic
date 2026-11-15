// Profil de risque : quand les envies ont-elles tendance à survenir ?
// Matrice aplatie de 168 cases (7 jours × 24 h) car Firestore n'accepte pas les tableaux imbriqués.
import { DAY } from './time.js';

export const MIN_SAMPLES = 5; // en dessous, on ne fait aucune prédiction (pas de notif de risque)
export const idx = (dow, hour) => ((dow + 7) % 7) * 24 + ((hour + 24) % 24);

/**
 * Construit le profil de risque à partir des envies.
 * - décroissance exponentielle (demi-vie 14 j) : les habitudes récentes comptent plus ;
 * - pondération par intensité, et bonus quand l'envie n'a pas été surmontée ;
 * - lissage sur les heures voisines et sur la même heure des autres jours.
 * @returns {{scores:number[], samples:number}} scores normalisés entre 0 et 1
 */
export function buildRiskProfile(cravings, now = Date.now(), { halfLifeDays = 14 } = {}) {
  const raw = new Array(168).fill(0);
  const lambda = Math.LN2 / (halfLifeDays * DAY);
  let samples = 0;
  for (const c of cravings) {
    if (!Number.isInteger(c.localDow) || !Number.isInteger(c.localHour)) continue;
    const age = Math.max(0, now - c.at);
    const intensity = Number.isFinite(c.intensity) ? c.intensity : 3;
    const w = Math.exp(-lambda * age) * (0.5 + intensity / 5) * (c.resisted === false ? 1.5 : 1);
    raw[idx(c.localDow, c.localHour)] += w;
    samples++;
  }

  const smooth = new Array(168).fill(0);
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let sameHourOtherDays = 0;
      for (let o = 0; o < 7; o++) if (o !== d) sameHourOtherDays += raw[idx(o, h)];
      smooth[idx(d, h)] =
        raw[idx(d, h)] + 0.5 * (raw[idx(d, h - 1)] + raw[idx(d, h + 1)]) + 0.35 * (sameHourOtherDays / 6);
    }
  }
  const max = Math.max(...smooth);
  const scores = smooth.map((v) => (max > 0 ? Math.round((v / max) * 1000) / 1000 : 0));
  return { scores, samples };
}

export function riskAt(scores, dow, hour) {
  return scores?.[idx(dow, hour)] ?? 0;
}
