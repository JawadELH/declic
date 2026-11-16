// Réglage de l'arrêt progressif par paliers (mode réduction).
import { Toggle } from './Toggle.jsx';
import { num } from '../lib/format.js';
import { planInfo } from '../../shared/index.js';

/** Plan normalisé à enregistrer (le premier palier suit toujours le maximum par jour). */
export function planToSave(h) {
  if (h.mode !== 'reduce' || !h.plan) return null;
  return { start: h.plan.start ?? Date.now(), from: Number(h.targetPerDay) || 0, step: Math.max(0.1, Number(h.plan.step) || 1), stepDays: Math.max(1, Math.round(Number(h.plan.stepDays) || 7)) };
}

export default function PlanFields({ habit, onChange }) {
  const plan = habit.plan;
  const preview = plan ? planInfo({ ...habit, plan: planToSave(habit) }, planToSave(habit).start) : null;
  const set = (k, v) => onChange({ ...plan, [k]: v });
  return (
    <div className="plan-fields full">
      <Toggle
        checked={!!plan}
        onChange={(on) => onChange(on ? { start: Date.now(), step: Math.max(1, Math.round((habit.targetPerDay || 1) / 5)), stepDays: 7 } : null)}
        label="Arrêter progressivement, par paliers"
      />
      {plan && (
        <>
          <div className="row wrap plan-inline">
            Baisser de
            <input type="number" min="0.1" step="any" value={plan.step} onChange={(e) => set('step', e.target.value)} aria-label="Baisse à chaque palier" />
            tous les
            <input type="number" min="1" step="1" value={plan.stepDays} onChange={(e) => set('stepDays', e.target.value)} aria-label="Durée d’un palier en jours" />
            jours
          </div>
          {preview && (
            <p className="muted small">
              {preview.ladder.slice(0, 8).map((v) => num(v, 1)).join(' → ')}
              {preview.ladder.length > 8 ? ' → … → 0' : ''} par jour. Arrêt complet prévu le{' '}
              {new Date(preview.endAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
