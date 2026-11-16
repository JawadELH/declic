// Mode développeur : remplir un historique de démo, tester les écrans, nettoyer.
// Les données de démo sont marquées « demo » et ne sont jamais publiées dans le groupe.
import { useCallback, useMemo, useRef, useState } from 'react';
import { IconCode, IconConfetti } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import { useToast } from './Toast.jsx';
import CravingFlow from './CravingFlow.jsx';
import { Celebration } from './Rewards.jsx';
import { purgeDemoHistory, seedDemoHistory, shiftHabitStart } from '../lib/db.js';
import { computeHabitStats, triggersOf } from '../../shared/index.js';

const KEY = 'declic.dev';
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** 7 appuis rapides sur le numéro de version activent (ou désactivent) le mode développeur. */
export function useDevMode() {
  const toast = useToast();
  const [on, setOn] = useState(read);
  const taps = useRef([]);
  const tap = useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    const left = 7 - taps.current.length;
    if (left > 0 && left <= 3) toast(`Encore ${left} appui${left > 1 ? 's' : ''} pour ${on ? 'quitter' : 'activer'} le mode développeur`, { duration: 1200 });
    if (left <= 0) {
      taps.current = [];
      const next = !on;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        /* indisponible */
      }
      setOn(next);
      toast(next ? 'Mode développeur activé.' : 'Mode développeur désactivé.');
    }
  }, [on, toast]);
  return [on, tap];
}

export default function DevPanel() {
  const { user, habits, logs } = useAppData();
  const { isAdmin } = useSocial();
  const toast = useToast();
  const [id, setId] = useState(habits[0]?.id);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const habit = habits.find((h) => h.id === id) ?? habits[0];
  const stats = useMemo(() => (habit ? computeHabitStats(habit, logs, Date.now()) : null), [habit, logs]);
  const demoCount = logs.filter((l) => l.demo).length;
  if (!habit) return null;

  async function run(fn, done) {
    setBusy(true);
    try {
      const r = await fn();
      toast(done(r));
    } catch (e) {
      toast(`Erreur : ${e.message}`, { duration: 6000 });
    } finally {
      setBusy(false);
    }
  }

  function forget(...keys) {
    try {
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* indisponible */
    }
  }

  return (
    <section className="card stack dev">
      <h3>
        <IconCode size={18} aria-hidden /> Mode développeur {isAdmin && <span className="tag">admin</span>}
      </h3>
      <p className="muted small">Les données générées sont marquées « démo », visibles seulement par toi, et jamais publiées dans le groupe.</p>

      <label>
        Habitude
        <select value={habit.id} onChange={(e) => setId(e.target.value)}>
          {habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
      </label>

      <span className="kicker">Générer un historique</span>
      <div className="row wrap">
        {[7, 30, 90].map((n) => (
          <button key={n} className="btn ghost" disabled={busy} onClick={() => run(() => seedDemoHistory(user.uid, habit, n, triggersOf(habit)), (c) => `${c} entrées de démo créées sur ${n} jours.`)}>
            {n} jours
          </button>
        ))}
      </div>

      <span className="kicker">Voyager dans le temps (date de départ)</span>
      <div className="row wrap">
        {[1, 7, 30].map((n) => (
          <button key={n} className="btn ghost" disabled={busy} onClick={() => run(() => shiftHabitStart(user.uid, habit, n), () => `Départ reculé de ${n} jour${n > 1 ? 's' : ''}.`)}>
            −{n} j
          </button>
        ))}
      </div>

      <span className="kicker">Aperçus</span>
      <div className="row wrap">
        <button className="btn ghost" onClick={() => setPreview('victory')}>
          Écran de victoire
        </button>
        <button className="btn ghost" onClick={() => setPreview('milestone')}>
          Célébration de cap
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            forget('declic.week', 'declic.tip', 'declic.risk');
            toast('Bilan de la semaine, astuce et rappel réaffichés sur Aujourd’hui.');
          }}
        >
          Réafficher les cartes
        </button>
      </div>

      <span className="kicker">Nettoyage</span>
      <button className="btn ghost" disabled={busy || demoCount === 0} onClick={() => run(() => purgeDemoHistory(user.uid, habits), (c) => `${c} entrées de démo supprimées.`)}>
        Supprimer les données de démo ({demoCount})
      </button>

      {preview === 'victory' && <CravingFlow habit={habit} stats={stats} initialStep="victory" onClose={() => setPreview(null)} />}
      {preview === 'milestone' && (
        <Celebration
          icon={<IconConfetti size={56} stroke={2} aria-hidden />}
          title={`${stats.nextMilestone?.title ?? '1 semaine'} !`}
          sub="Nouveau cap atteint (aperçu)"
          text={stats.nextMilestone?.text ?? 'Aperçu de la célébration.'}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
