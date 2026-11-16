// Récompenses : arbre qui pousse, cartes surprises, tirelire, bilan de la semaine.
// Principe : récompenser l'effort, jamais punir. Rien ne « se perd » après un écart.
import { milestonesOf, templateOf } from './habits.js';
import { DAY } from './time.js';

// ---------- L'arbre ----------
export const TREE_STAGES = [
  { min: 0, name: 'Graine' },
  { min: 1, name: 'Pousse' },
  { min: 3, name: 'Jeune pousse' },
  { min: 7, name: 'Arbuste' },
  { min: 15, name: 'Jeune arbre' },
  { min: 30, name: 'Arbre' },
  { min: 60, name: 'Grand arbre' },
  { min: 100, name: 'Arbre en fleurs' },
  { min: 200, name: 'Forêt' },
];

/** Stade de l'arbre selon le nombre total d'envies battues. */
export function treeStage(victories = 0) {
  let index = 0;
  for (let i = 0; i < TREE_STAGES.length; i++) if (victories >= TREE_STAGES[i].min) index = i;
  const next = TREE_STAGES[index + 1] ?? null;
  return { index, name: TREE_STAGES[index].name, next, toNext: next ? next.min - victories : 0, max: TREE_STAGES.length - 1 };
}

// ---------- Les cartes surprises ----------
export const RARE_BADGES = [
  { id: 'main-de-fer', name: 'Main de fer', text: 'Tu as tenu quand ça comptait.' },
  { id: 'souffle-long', name: 'Souffle long', text: 'Quatre-vingt-dix secondes de calme, maîtrisées.' },
  { id: 'phare', name: 'Phare', text: 'Ta constance éclaire le chemin des autres.' },
  { id: 'racines', name: 'Racines', text: 'Chaque victoire ancre un peu plus la nouvelle habitude.' },
  { id: 'aube', name: 'Aube', text: 'Une envie battue, une journée qui commence mieux.' },
  { id: 'boussole', name: 'Boussole', text: 'Tu sais où tu vas, et pourquoi.' },
  { id: 'rempart', name: 'Rempart', text: 'Le déclencheur est venu. Il est reparti sans rien.' },
  { id: 'etincelle', name: 'Étincelle', text: 'Le déclic, c’était toi.' },
];

const WORDS = [
  'L’envie a frappé, tu as tenu. C’est exactement comme ça que le cerveau réapprend.',
  'Chaque envie battue affaiblit la suivante. Tu viens d’en affaiblir une.',
  'Ce n’était pas de la chance : c’était un choix. Le tien.',
  'Tu viens de prouver que l’envie ne décide pas à ta place.',
  'Respire : tu viens de faire quelque chose de difficile.',
  'Une victoire de plus dans la colonne des bonnes décisions.',
  'Ce moment-là, beaucoup le ratent. Pas toi.',
  'Ton futur toi te remercie pour ces quatre-vingt-dix secondes.',
  'Petit pas, vraie victoire. Garde le rythme.',
  'Tu es plus fort·e que ce réflexe. La preuve : maintenant.',
];

/**
 * Tire une carte surprise (récompense variable).
 * @param {object} habit
 * @param {{rng?: () => number, pulse?: number}} opts
 */
export function drawCard(habit, { rng = Math.random, pulse = 0 } = {}) {
  const r = rng();
  if (r < 1 / 12) {
    const b = RARE_BADGES[Math.floor(rng() * RARE_BADGES.length)];
    return { kind: 'rare', title: `Carte rare : ${b.name}`, text: b.text, badgeId: b.id };
  }
  if (r < 0.4) {
    const ms = milestonesOf(habit);
    const m = ms[Math.floor(rng() * ms.length)];
    const sourced = Boolean(templateOf(habit).source);
    return { kind: 'sante', title: sourced ? `Ce qui se répare : ${m.title}` : `En route vers : ${m.title}`, text: m.text };
  }
  if (r < 0.55 && pulse > 1) {
    return { kind: 'collectif', title: 'Tu n’es pas seul·e', text: `Aujourd’hui, ${pulse} envies ont été battues par le groupe. Tu en fais partie.` };
  }
  return { kind: 'mot', title: 'Le mot du jour', text: WORDS[Math.floor(rng() * WORDS.length)] };
}

// ---------- La tirelire ----------
/** Progression vers l'objectif d'achat (l'argent compte à partir de la création de l'objectif). */
export function goalProgress(moneySaved, goal) {
  if (!goal?.amount) return null;
  const saved = Math.max(0, moneySaved - (goal.base ?? 0));
  return { saved, remaining: Math.max(0, goal.amount - saved), pct: Math.min(1, saved / goal.amount), reached: saved >= goal.amount };
}

// ---------- Le bilan de la semaine ----------
/** Identifiant de semaine (lundi = début), dans le fuseau du runtime. */
export function weekKey(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Résumé des 7 derniers jours vs les 7 précédents. */
export function weeklyRecap(habit, logs, now = Date.now()) {
  const mine = logs.filter((l) => l.habitId === habit.id);
  const inW = (k) => (l) => l.at > now - (k + 1) * 7 * DAY && l.at <= now - k * 7 * DAY;
  const qty = (l) => (Number.isFinite(l.quantity) && l.quantity > 0 ? l.quantity : 1);
  const sum = (arr) => arr.reduce((a, l) => a + qty(l), 0);
  const week = (k) => {
    const list = mine.filter(inW(k));
    const cravings = list.filter((l) => l.type === 'craving');
    const used = sum(list.filter((l) => l.type === 'use' && l.at >= (habit.startedAt ?? 0)));
    const activeDays = Math.max(0, Math.min(7, (now - k * 7 * DAY - (habit.startedAt ?? now)) / DAY));
    const savedUnits = Math.max(0, (habit.baselinePerDay ?? 0) * activeDays - used);
    return { won: cravings.filter((c) => c.resisted).length, lost: cravings.filter((c) => c.resisted === false).length, used, money: savedUnits * (habit.costPerUnit ?? 0), units: savedUnits };
  };
  const cur = week(0);
  const prev = week(1);
  // meilleur jour : le plus d'envies battues
  const byDay = new Map();
  for (const c of mine.filter(inW(0)).filter((l) => l.type === 'craving' && l.resisted)) {
    const k = new Date(c.at).toLocaleDateString('fr-FR', { weekday: 'long' });
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const best = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  return { cur, prev, bestDay: best ? { day: best[0], won: best[1] } : null };
}
