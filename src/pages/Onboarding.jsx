import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconMinus, IconPlus } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { addHabit, publishActivity, saveProfile, updateUser } from '../lib/db.js';
import { habitIcon } from '../lib/ui.js';
import { HABIT_TEMPLATES, TEMPLATE_LIST, newHabitFromTemplate } from '../../shared/index.js';

/** Onboarding en 3 écrans très courts : pseudo → habitude → combien par jour. */
export default function Onboarding({ first = false }) {
  const { user, profile, userDoc } = useAppData();
  const nav = useNavigate();
  const needsProfile = first && !profile?.pseudo;
  const [step, setStep] = useState(needsProfile ? 0 : 1);
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '');
  const [habit, setHabit] = useState(null);
  const [busy, setBusy] = useState(false);
  const tpl = habit ? HABIT_TEMPLATES[habit.templateId] : null;
  const set = (k, v) => setHabit((h) => ({ ...h, [k]: v }));

  async function finish(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsProfile) await saveProfile(user.uid, { pseudo });
      const h = { ...habit, startedAt: Date.now(), motivation: (habit.motivation ?? '').trim().slice(0, 300) };
      await addHabit(user.uid, h);
      await updateUser(user.uid, { onboarded: true });
      if (userDoc?.shareActivity !== false) publishActivity(user.uid, { pseudo: pseudo || profile?.pseudo }, { kind: 'start', habit: h }).catch(() => {});
      nav('/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onb">
      {step > (needsProfile ? 0 : 1) && (
        <button className="back" onClick={() => setStep(step - 1)}>
          <IconArrowLeft size={18} aria-hidden /> Retour
        </button>
      )}
      {!first && step === 1 && (
        <button className="back" onClick={() => nav('/moi')}>
          <IconArrowLeft size={18} aria-hidden /> Annuler
        </button>
      )}

      {step === 0 && (
        <form
          className="onb-step"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(1);
          }}
        >
          <h1 className="onb-title">Comment on t’appelle ?</h1>
          <p className="muted">Un pseudo suffit. Le groupe te connaîtra sous ce nom.</p>
          <input className="big-input" autoFocus required minLength={2} maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Alex" />
          <button className="btn primary xl">Continuer</button>
        </form>
      )}

      {step === 1 && (
        <div className="onb-step">
          <h1 className="onb-title">De quoi veux-tu te libérer ?</h1>
          <div className="tpl-list">
            {TEMPLATE_LIST.map((t) => {
              const Icon = habitIcon(t.id);
              return (
                <button
                  key={t.id}
                  className="tpl-row"
                  onClick={() => {
                    setHabit(newHabitFromTemplate(t.id));
                    setStep(2);
                  }}
                >
                  <Icon size={24} aria-hidden />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && habit && (
        <form className="onb-step" onSubmit={finish}>
          {habit.templateId === 'custom' ? (
            <>
              <h1 className="onb-title">Ton habitude</h1>
              <input className="big-input" required maxLength={40} value={habit.label === 'Autre habitude' ? '' : habit.label} onChange={(e) => set('label', e.target.value)} placeholder="Grignoter le soir" />
            </>
          ) : (
            <h1 className="onb-title">Avant, combien de {habit.unitPlural} par jour ?</h1>
          )}

          <div className="stepper">
            <button type="button" onClick={() => set('baselinePerDay', Math.max(0, habit.baselinePerDay - 1))} aria-label="Moins">
              <IconMinus size={24} />
            </button>
            <input type="number" min="0" step="any" value={habit.baselinePerDay} onChange={(e) => set('baselinePerDay', Number(e.target.value))} aria-label="Quantité par jour" />
            <button type="button" onClick={() => set('baselinePerDay', habit.baselinePerDay + 1)} aria-label="Plus">
              <IconPlus size={24} />
            </button>
          </div>
          {habit.templateId === 'custom' && <p className="muted small center">fois par jour</p>}

          {habit.costPerUnit > 0 || habit.templateId === 'custom' ? (
            <label className="inline-field">
              Prix par {habit.unit}
              <span>
                <input type="number" min="0" step="0.01" value={habit.costPerUnit} onChange={(e) => set('costPerUnit', Number(e.target.value))} /> €
              </span>
            </label>
          ) : null}

          <div className="segmented">
            <button type="button" className={habit.mode === 'quit' ? 'on' : ''} onClick={() => set('mode', 'quit')}>
              Arrêter
            </button>
            <button type="button" className={habit.mode === 'reduce' ? 'on' : ''} onClick={() => set('mode', 'reduce')}>
              Réduire
            </button>
          </div>
          {habit.mode === 'reduce' && (
            <label className="inline-field">
              Maximum par jour
              <input type="number" min="0" step="any" value={habit.targetPerDay} onChange={(e) => set('targetPerDay', Number(e.target.value))} />
            </label>
          )}

          <input maxLength={300} value={habit.motivation} onChange={(e) => set('motivation', e.target.value)} placeholder="Ton pourquoi (facultatif) : pour mes enfants, pour courir…" />

          {tpl?.warning && <p className="warning small">{tpl.warning}</p>}

          <button className="btn primary xl" disabled={busy}>
            Je commence maintenant
          </button>
        </form>
      )}
    </main>
  );
}
