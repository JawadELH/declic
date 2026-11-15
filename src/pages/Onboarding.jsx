import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../hooks/useAppData.jsx';
import { addHabit, saveProfile, updateUser } from '../lib/db.js';
import { AVATARS } from '../lib/format.js';
import { HABIT_TEMPLATES, TEMPLATE_LIST, newHabitFromTemplate } from '../../shared/index.js';

const toLocalInput = (ts) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export default function Onboarding({ first = false }) {
  const { user, profile } = useAppData();
  const nav = useNavigate();
  const needsProfile = first && !profile?.pseudo;
  const [step, setStep] = useState(needsProfile ? 0 : 1);
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[1]);
  const [habit, setHabit] = useState(null);
  const [startNow, setStartNow] = useState(true);
  const [startAt, setStartAt] = useState(toLocalInput(Date.now()));
  const [busy, setBusy] = useState(false);

  const tpl = habit ? HABIT_TEMPLATES[habit.templateId] : null;
  const set = (k) => (e) => setHabit((h) => ({ ...h, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  async function finish(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsProfile || pseudo !== profile?.pseudo) await saveProfile(user.uid, { pseudo, avatar });
      const startedAt = startNow ? Date.now() : new Date(startAt).getTime();
      await addHabit(user.uid, { ...habit, startedAt, motivation: habit.motivation.trim().slice(0, 300) });
      await updateUser(user.uid, { onboarded: true });
      nav('/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-page">
      <div className="card wide onboarding">
        <p className="steps muted small">Étape {needsProfile ? step + 1 : step} / {needsProfile ? 3 : 2}</p>

        {step === 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(1);
            }}
          >
            <h1>Bienvenue sur Déclic 👋</h1>
            <p className="muted">Choisis un pseudo. Par discrétion, évite ton vrai nom : la communauté te connaîtra sous ce nom.</p>
            <label>
              Pseudo
              <input required minLength={2} maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
            </label>
            <fieldset className="avatars">
              <legend>Avatar</legend>
              {AVATARS.map((a) => (
                <button type="button" key={a} className={`avatar ${a === avatar ? 'on' : ''}`} onClick={() => setAvatar(a)} aria-pressed={a === avatar}>
                  {a}
                </button>
              ))}
            </fieldset>
            <button className="btn primary">Continuer</button>
          </form>
        )}

        {step === 1 && (
          <div>
            <h1>De quoi veux-tu te libérer ?</h1>
            <p className="muted">Tu pourras suivre plusieurs habitudes plus tard.</p>
            <div className="tpl-grid">
              {TEMPLATE_LIST.map((t) => (
                <button
                  key={t.id}
                  className="tpl"
                  onClick={() => {
                    setHabit(newHabitFromTemplate(t.id));
                    setStep(2);
                  }}
                >
                  <span className="tpl-emoji" aria-hidden>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
            {!first && (
              <button className="btn ghost" onClick={() => nav('/')}>
                Annuler
              </button>
            )}
          </div>
        )}

        {step === 2 && habit && (
          <form onSubmit={finish} className="form-grid">
            <h1>
              {habit.emoji} {habit.label}
            </h1>
            {tpl?.warning && <p className="warning" role="note">⚠️ {tpl.warning}</p>}

            {habit.templateId === 'custom' && (
              <>
                <label>
                  Nom de l’habitude
                  <input required maxLength={40} value={habit.label} onChange={set('label')} />
                </label>
                <label>
                  Emoji
                  <input maxLength={4} value={habit.emoji} onChange={set('emoji')} />
                </label>
                <label>
                  Unité (singulier / pluriel)
                  <div className="row">
                    <input required maxLength={30} value={habit.unit} onChange={set('unit')} />
                    <input required maxLength={30} value={habit.unitPlural} onChange={set('unitPlural')} />
                  </div>
                </label>
              </>
            )}

            <fieldset className="segmented">
              <legend>Objectif</legend>
              <label className={habit.mode === 'quit' ? 'on' : ''}>
                <input type="radio" name="mode" value="quit" checked={habit.mode === 'quit'} onChange={set('mode')} /> Arrêter complètement
              </label>
              <label className={habit.mode === 'reduce' ? 'on' : ''}>
                <input type="radio" name="mode" value="reduce" checked={habit.mode === 'reduce'} onChange={set('mode')} /> Réduire progressivement
              </label>
            </fieldset>

            <label>
              Avant, en moyenne par jour ({habit.unitPlural})
              <input type="number" min="0" step="any" required value={habit.baselinePerDay} onChange={set('baselinePerDay')} />
            </label>
            {habit.mode === 'reduce' && (
              <label>
                Objectif maximum par jour
                <input type="number" min="0" step="any" required value={habit.targetPerDay} onChange={set('targetPerDay')} />
              </label>
            )}
            <label>
              Coût par {habit.unit} (€) <span className="muted small">— 0 si non pertinent</span>
              <input type="number" min="0" step="0.01" value={habit.costPerUnit} onChange={set('costPerUnit')} />
            </label>

            <fieldset>
              <legend>Date de départ</legend>
              <label className="inline">
                <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} /> Maintenant
              </label>
              {!startNow && <input type="datetime-local" value={startAt} max={toLocalInput(Date.now())} onChange={(e) => setStartAt(e.target.value)} />}
            </fieldset>

            <label>
              Mon pourquoi <span className="muted small">— on te le rappellera dans les moments difficiles</span>
              <textarea rows={3} maxLength={300} placeholder="Pour respirer mieux, pour mes enfants, pour économiser pour un voyage…" value={habit.motivation} onChange={set('motivation')} />
            </label>

            {tpl?.helpline && (
              <p className="muted small">
                Besoin d’un accompagnement professionnel ? {tpl.helpline.name} : <a href={`tel:${tpl.helpline.phone.replace(/\s/g, '')}`}>{tpl.helpline.phone}</a>
              </p>
            )}

            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>
                Retour
              </button>
              <button className="btn primary" disabled={busy}>
                C’est parti !
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
