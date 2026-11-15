// Défis du jour : génériques, valables pour toutes les habitudes.
// Un défi différent chaque jour, identique pour tout le groupe.

export const CHALLENGES = [
  'Bois un grand verre d’eau à chaque envie aujourd’hui.',
  'Marche 10 minutes après le déjeuner.',
  'Repère ton premier déclencheur de la journée et note-le.',
  'Envoie de la force à au moins une personne du groupe.',
  'Mets de côté l’argent économisé aujourd’hui.',
  'Change une petite routine liée à ton habitude : autre chemin, autre tasse, autre place.',
  'Respire 2 minutes avant chaque repas.',
  'Couche-toi 30 minutes plus tôt ce soir.',
  'Écris 3 bénéfices que tu ressens déjà.',
  'Tiens une heure loin de l’endroit ou de l’objet qui te tente le plus.',
  'Raconte ta journée au groupe en une phrase.',
  'Garde les mains occupées pendant ta pause : balle, stylo, carnet.',
  'Prépare à l’avance ta parade pour ton moment le plus difficile.',
  'Fête une petite victoire : offre-toi quelque chose avec l’argent gardé.',
];

/** Défi du jour pour une clé de jour AAAA-MM-JJ. */
export function challengeOf(dayKeyStr) {
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return CHALLENGES[((n % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}
