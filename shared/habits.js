// Catalogue générique des habitudes.
// Ajouter une habitude = ajouter une entrée ici. Tout le reste (tableaux de bord,
// moteur de risque, notifications, communauté) s'adapte automatiquement.

const MIN = 1;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Paliers génériques (non médicaux) utilisés quand une habitude n'a pas de paliers spécifiques. */
export function genericMilestones(label) {
  const l = label.toLowerCase();
  return [
    { minutes: 1 * DAY, title: '24 heures', text: `Une journée entière sans ${l}. Le plus dur est souvent le début : c'est fait.` },
    { minutes: 3 * DAY, title: '3 jours', text: 'Les premiers jours sont souvent les plus intenses. Tu viens de les traverser.' },
    { minutes: 7 * DAY, title: '1 semaine', text: 'Une semaine : de nouveaux réflexes commencent à remplacer les anciens.' },
    { minutes: 14 * DAY, title: '2 semaines', text: 'Deux semaines de constance. Les envies deviennent en général moins fréquentes.' },
    { minutes: 30 * DAY, title: '1 mois', text: 'Un mois ! Prends un moment pour mesurer le chemin parcouru.' },
    { minutes: 90 * DAY, title: '3 mois', text: 'Trois mois : la nouvelle habitude fait désormais partie de ton quotidien.' },
    { minutes: 180 * DAY, title: '6 mois', text: 'Six mois. Tu peux être fier·e de toi.' },
    { minutes: 365 * DAY, title: '1 an', text: 'Un an. Une année entière reprise en main.' },
  ];
}

const COMMON_TIPS = [
  "Une envie passe souvent en quelques minutes : occupe tes mains en attendant qu'elle redescende.",
  "Lance l'exercice de respiration 4-4-4 dans l'app, deux minutes suffisent.",
  'Bois un grand verre d’eau, lentement.',
  'Change de pièce ou sors marcher cinq minutes.',
  'Écris à la communauté : quelqu’un est sûrement passé par là.',
  'Relis ta motivation : pourquoi as-tu commencé ?',
];

export const HABIT_TEMPLATES = {
  tabac: {
    id: 'tabac',
    usedWord: 'fumées',
    usedWordOne: 'fumée',
    cravingPhrase: 'l’envie de fumer',
    label: 'Tabac',
    emoji: '🚭',
    unit: 'cigarette',
    unitPlural: 'cigarettes',
    defaultPerDay: 15,
    defaultCostPerUnit: 0.62,
    triggers: ['Café', 'Après repas', 'Stress', 'Alcool', 'Pause', 'Ennui', 'Voiture', 'Soirée'],
    tips: [
      'Une envie de cigarette culmine puis retombe en quelques minutes : tiens jusque-là.',
      'Mâche un chewing-gum ou croque une pomme pour occuper ta bouche.',
      'Si tu utilises un substitut nicotinique, c’est le moment de le prendre.',
      ...COMMON_TIPS,
    ],
    // Repères santé communément cités (OMS, Tabac Info Service). Indicatifs, non médicaux.
    milestones: [
      { minutes: 20 * MIN, title: '20 minutes', text: 'Ta fréquence cardiaque et ta tension commencent à baisser.' },
      { minutes: 12 * HOUR, title: '12 heures', text: 'Le taux de monoxyde de carbone dans ton sang revient à la normale.' },
      { minutes: 2 * DAY, title: '48 heures', text: 'Le goût et l’odorat commencent à s’améliorer.' },
      { minutes: 14 * DAY, title: '2 semaines', text: 'Ta circulation et ta fonction respiratoire s’améliorent (jusqu’à 3 mois).' },
      { minutes: 30 * DAY, title: '1 mois', text: 'La toux et l’essoufflement diminuent progressivement (de 1 à 9 mois).' },
      { minutes: 365 * DAY, title: '1 an', text: 'Le risque de maladie coronarienne est environ divisé par deux.' },
      { minutes: 5 * 365 * DAY, title: '5 ans', text: 'Le risque d’AVC se rapproche de celui d’un non-fumeur (5 à 15 ans).' },
      { minutes: 10 * 365 * DAY, title: '10 ans', text: 'Le risque de cancer du poumon est environ divisé par deux.' },
    ],
    source: 'OMS, Tabac Info Service',
    helpline: { name: 'Tabac Info Service', phone: '39 89', url: 'https://www.tabac-info-service.fr' },
  },
  alcool: {
    id: 'alcool',
    usedWord: 'bus',
    usedWordOne: 'bu',
    cravingPhrase: 'l’envie de boire',
    label: 'Alcool',
    emoji: '🍷',
    unit: 'verre',
    unitPlural: 'verres',
    defaultPerDay: 3,
    defaultCostPerUnit: 4,
    triggers: ['Apéro', 'Soirée', 'Stress', 'Fin de journée', 'Repas', 'Solitude', 'Week-end'],
    tips: ['Prépare une boisson sans alcool que tu aimes vraiment.', ...COMMON_TIPS],
    warning:
      "En cas de forte consommation quotidienne, un arrêt brutal peut être dangereux (syndrome de sevrage). Parles-en à un médecin avant d'arrêter.",
    helpline: { name: 'Alcool Info Service', phone: '0 980 980 930', url: 'https://www.alcool-info-service.fr' },
  },
  sucre: {
    id: 'sucre',
    usedWord: 'mangées',
    usedWordOne: 'mangée',
    cravingPhrase: 'l’envie de sucré',
    label: 'Sucre',
    emoji: '🍬',
    unit: 'portion sucrée',
    unitPlural: 'portions sucrées',
    defaultPerDay: 4,
    defaultCostPerUnit: 1.5,
    triggers: ['Après repas', 'Fatigue', 'Stress', 'Ennui', 'Télé', 'Récompense'],
    tips: ['Garde un fruit ou une poignée d’oléagineux à portée de main.', ...COMMON_TIPS],
  },
  ecrans: {
    id: 'ecrans',
    usedWord: 'passées',
    usedWordOne: 'passée',
    cravingPhrase: 'l’envie de scroller',
    label: 'Réseaux sociaux',
    emoji: '📱',
    unit: 'minute',
    unitPlural: 'minutes',
    defaultPerDay: 120,
    defaultCostPerUnit: 0,
    triggers: ['Réveil', 'Au lit', 'Ennui', 'Transports', 'Procrastination', 'Notification'],
    tips: ['Pose ton téléphone dans une autre pièce pendant 20 minutes.', 'Active le mode concentration.', ...COMMON_TIPS],
  },
  jeux: {
    id: 'jeux',
    usedWord: '',
    cravingPhrase: 'l’envie de jouer',
    label: "Jeux d'argent",
    emoji: '🎰',
    unit: 'euro misé',
    unitPlural: 'euros misés',
    defaultPerDay: 20,
    defaultCostPerUnit: 1,
    triggers: ['Match', 'Paie', 'Ennui', 'Stress', 'Publicité', 'Soirée'],
    tips: ['Active l’auto-exclusion sur les sites de jeu.', ...COMMON_TIPS],
    helpline: { name: 'Joueurs Info Service', phone: '09 74 75 13 13', url: 'https://www.joueurs-info-service.fr' },
  },
  ongles: {
    id: 'ongles',
    usedWord: '',
    cravingPhrase: 'l’envie de te ronger les ongles',
    label: 'Ongles rongés',
    emoji: '💅',
    unit: 'fois',
    unitPlural: 'fois',
    defaultPerDay: 5,
    defaultCostPerUnit: 0,
    triggers: ['Stress', 'Écrans', 'Concentration', 'Ennui', 'Attente'],
    tips: ['Garde une balle anti-stress ou un objet à manipuler.', ...COMMON_TIPS],
  },
  custom: {
    id: 'custom',
    usedWord: 'consommées',
    usedWordOne: 'consommée',
    label: 'Autre habitude',
    emoji: '✨',
    unit: 'fois',
    unitPlural: 'fois',
    defaultPerDay: 3,
    defaultCostPerUnit: 0,
    triggers: ['Stress', 'Ennui', 'Fatigue', 'Soirée', 'Social'],
    tips: COMMON_TIPS,
  },
};

export const TEMPLATE_LIST = Object.values(HABIT_TEMPLATES);

/** Renvoie le modèle d'une habitude (avec repli sur « custom »). */
export function templateOf(habit) {
  return HABIT_TEMPLATES[habit?.templateId] ?? HABIT_TEMPLATES.custom;
}

/** Paliers applicables à une habitude (spécifiques si le modèle en a, génériques sinon). */
export function milestonesOf(habit) {
  const t = templateOf(habit);
  return t.milestones ?? genericMilestones(habit?.label ?? t.label);
}

/** Déclencheurs proposés : ceux du modèle + ceux déjà saisis par l'utilisateur. */
export function triggersOf(habit) {
  const t = templateOf(habit);
  return Array.from(new Set([...(t.triggers ?? []), ...(habit?.customTriggers ?? [])]));
}

/** « l’envie de fumer », « l’envie de boire »… */
export function cravingPhrase(habit) {
  const t = templateOf(habit);
  return t.cravingPhrase ?? `l’envie (${(habit?.label ?? t.label).toLowerCase()})`;
}

/** « cigarettes fumées », « verres bus »… (accord porté par le modèle). */
export function usedLabel(habit, n = 2) {
  const t = templateOf(habit);
  if (Math.abs(n) <= 1) return `${habit?.unit ?? t.unit} ${t.usedWordOne ?? t.usedWord ?? 'consommée'}`.trim();
  return `${habit?.unitPlural ?? t.unitPlural} ${t.usedWord ?? 'consommées'}`.trim();
}

export function tipsOf(habit) {
  return templateOf(habit).tips ?? COMMON_TIPS;
}

/** Crée l'objet habitude par défaut à partir d'un modèle. */
export function newHabitFromTemplate(templateId, overrides = {}) {
  const t = HABIT_TEMPLATES[templateId] ?? HABIT_TEMPLATES.custom;
  return {
    templateId: t.id,
    label: t.label,
    emoji: t.emoji,
    unit: t.unit,
    unitPlural: t.unitPlural,
    mode: 'quit', // 'quit' (arrêt total) | 'reduce' (réduction)
    baselinePerDay: t.defaultPerDay,
    targetPerDay: Math.max(0, Math.round(t.defaultPerDay / 2)),
    costPerUnit: t.defaultCostPerUnit,
    currency: 'EUR',
    motivation: '',
    active: true,
    ...overrides,
  };
}
