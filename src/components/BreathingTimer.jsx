// Respiration carrée 4-4-4-4 pendant 2 minutes : de quoi laisser passer le pic d'une envie.
import { useEffect, useState } from 'react';

const PHASES = ['Inspire', 'Retiens', 'Expire', 'Retiens'];
const PHASE_S = 4;
const TOTAL_S = 120;

export default function BreathingTimer({ onDone }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (t >= TOTAL_S) {
      onDone?.();
      return;
    }
    const id = setTimeout(() => setT((x) => x + 1), 1000);
    return () => clearTimeout(id);
  }, [t, onDone]);

  const phase = Math.floor(t / PHASE_S) % 4;
  const left = TOTAL_S - t;
  return (
    <div className="breathing">
      <div className={`breath-circle phase-${phase}`} aria-hidden />
      <p className="breath-label" aria-live="polite">
        {t >= TOTAL_S ? 'Bien joué 🌿' : PHASES[phase]}
      </p>
      <p className="muted small">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} restantes
      </p>
    </div>
  );
}
