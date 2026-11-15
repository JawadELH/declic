// Démarrage en 4 écrans courts, avec une projection motivante à la fin.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconBell, IconMinus, IconPlus } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { addHabit, publishActivity, saveProfile, updateUser } from '../lib/db.js';
import { enablePush, pushSupported } from '../lib/messaging.js';
import { habitIcon } from '../lib/ui.js';
import { money, num } from '../lib/format.js';
import { HABIT_TEMPLATES, TEMPLATE_LIST, newHabitFromTemplate } from '../../shared/index.js';

const REASONS = ['Ma santé', 'Mon argent', 'Ma famille', 'Le sport', 'Ma liberté', 'Être fier·e de moi', 'Mieux dormir', 'Montrer l’exemple'];

const toLocalInput = (ts) => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function Onboarding({ first = false }) {
  const { user, profile, userDoc } = useAppData();
  const nav = useNavigate();
  const needsProfile = first && !profile?.pseudo;
  const steps = needsProfile ? ['pseudo', 'habit', 'amount', 'why', 'ready'] : ['habit', 'amount', 'why', 'ready'];
  const [i, setI] = useState(0);
  const step = steps[i];
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '');
  const [habit, setHabit] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [already, setAlready] = useState(false);
  const [startAt, setStartAt] = useState(toLocalInput(Date.now() - 86400000));
  const [wantPush, setWantPush] = useState(false);
  const [busy, setBusy] = useState(false);
  const tpl = habit ? HABIT_TEMPLATES[habit.templateId] : null;
  const set = (k, v) => setHabit((h) => ({ ...h, [k]: v }));
  const next = () => setI((x) => Math.min(steps.length - 1, x + 1));
  const back = () => (i === 0 ? nav('/moi') : setI((x) => x - 1));

  async function finish() {
    setBusy(true);
    try {
      if (needsProfile) await saveProfile(user.uid, { pseudo });
      const motivation = [reasons.join(', '), habit.motivation?.trim()].filter(Boolean).join(' — ').slice(0, 300);
      const startedAt = already ? Math.min(Date.now(), new Date(startAt).getTime()) : Date.now();
      const h = { ...habit, motivation, startedAt };
      await addHabit(user.uid, h);
      await updateUser(user.uid, { onboarded: true });
      if (userDoc?.shareActivity !== false) publishActivity(user.uid, { pseudo: pseudo || profile?.pseudo }, { kind: 'start', habit: h }).catch(() => {});
      if (wantPush) await enablePush(user.uid).catch(() => {});
      let target = '/';
      try {
        target = sessionStorage.getItem('declic.invite') || '/';
      } catch {
        /* indisponible */
      }
      nav(target);
    } finally {
      setBusy(false);
    }
  }

  const yearUnits = habit ? (habit.mode === 'quit' ? habit.baselinePerDay : Math.max(0, habit.baselinePerDay - habit.targetPerDay)) * 365 : 0;

  return (
    <main className="onb">
      <div className="onb-top">
        {(i > 0 || !first) && (
          <button className="icon-btn" onClick={back} aria-label="Retour">
            <IconArrowLeft size={22} />
          </button>
        )}
        <div className="progress-dots" aria-label={`Étape ${i + 1} sur ${steps.length}`}>
          {steps.map((s, k) => (
            <span key={s} className={k <= i ? 'on' : ''} />
          ))}
        </div>
      </div>

      {step === 'pseudo' && (
        <form
          className="onb-step"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <h1 className="onb-title">Comment on t’appelle ?</h1>
          <p className="muted">Un pseudo suffit. Le groupe et tes alliés te connaîtront sous ce nom.</p>
          <input className="big-input" autoFocus required minLength={2} maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Alex" />
          <button className="btn primary xl">Continuer</button>
        </form>
      )}

      {step === 'habit' && (
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
                    next();
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

      {step === 'amount' && habit && (
        <form
          className="onb-step"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {habit.templateId === 'custom' ? (
            <>
              <h1 className="onb-title">Ton habitude</h1>
              <input className="big-input" required maxLength={40} value={habit.label === 'Autre habitude' ? '' : habit.label} onChange={(e) => set('label', e.target.value)} placeholder="Grignoter le soir" />
              <p className="muted">Combien de fois par jour, en moyenne ?</p>
            </>
          ) : (
            <h1 className="onb-title">Combien de {habit.unitPlural} par jour, en moyenne ?</h1>
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
          {(habit.costPerUnit > 0 || ['custom', 'sucre'].includes(habit.templateId)) && (
            <label className="inline-field">
              Prix par {habit.unit}
              <span>
                <input type="number" min="0" step="0.01" value={habit.costPerUnit} onChange={(e) => set('costPerUnit', Number(e.target.value))} /> €
              </span>
            </label>
          )}
          <div className="segmented">
            <button type="button" className={habit.mode === 'quit' ? 'on' : ''} onClick={() => set('mode', 'quit')}>
              Arrêter
            </button>
            <button type="button" className={habit.mode === 'reduce' ? 'on' : ''} onClick={() => set('mode', 'reduce')}>
              Réduire d’abord
            </button>
          </div>
          {habit.mode === 'reduce' && (
            <label className="inline-field">
              Mon maximum par jour
              <input type="number" min="0" step="any" value={habit.targetPerDay} onChange={(e) => set('targetPerDay', Number(e.target.value))} />
            </label>
          )}
          {tpl?.warning && <p className="warning small">{tpl.warning}</p>}
          <button className="btn primary xl">Continuer</button>
        </form>
      )}

      {step === 'why' && habit && (
        <div className="onb-step">
          <h1 className="onb-title">Pourquoi tu le fais ?</h1>
          <p className="muted">On te le rappellera quand l’envie sera forte. Choisis autant que tu veux.</p>
          <div className="chips">
            {REASONS.map((r) => (
              <button key={r} className={`chip ${reasons.includes(r) ? 'on' : ''}`} onClick={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} aria-pressed={reasons.includes(r)}>
                {r}
              </button>
            ))}
          </div>
          <input maxLength={200} value={habit.motivation} onChange={(e) => set('motivation', e.target.value)} placeholder="En une phrase (facultatif) : pour courir avec mes enfants" />
          <div className="segmented">
            <button type="button" className={!already ? 'on' : ''} onClick={() => setAlready(false)}>
              Je commence maintenant
            </button>
            <button type="button" className={already ? 'on' : ''} onClick={() => setAlready(true)}>
              J’ai déjà commencé
            </button>
          </div>
          {already && (
            <label>
              Depuis quand ?
              <input type="datetime-local" value={startAt} max={toLocalInput(Date.now())} onChange={(e) => setStartAt(e.target.value)} />
            </label>
          )}
          <button className="btn primary xl" onClick={next}>
            Continuer
          </button>
        </div>
      )}

      {step === 'ready' && habit && (
        <div className="onb-step">
          <h1 className="onb-title">Dans un an, tu auras…</h1>
          <div className="projection">
            {habit.costPerUnit > 0 && (
              <div>
                <span className="proj-num">{money(yearUnits * habit.costPerUnit)}</span>
                <span className="muted">gardés</span>
              </div>
            )}
            <div>
              <span className="proj-num">{num(yearUnits)}</span>
              <span className="muted">{habit.unitPlural} en moins</span>
            </div>
          </div>
          <p className="muted">Quand l’envie arrive, un seul geste : « J’ai une envie ». On respire 90 secondes ensemble, et le groupe peut t’envoyer de la force.</p>
          <PushOptIn value={wantPush} onChange={setWantPush} />
          <button className="btn primary xl" onClick={finish} disabled={busy}>
            C’est parti
          </button>
        </div>
      )}
    </main>
  );
}

function PushOptIn({ value, onChange }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    pushSupported().then(setOk);
  }, []);
  if (!ok) return null;
  return (
    <label className="toggle card">
      <span className="row">
        <IconBell size={20} aria-hidden /> Me prévenir avant mes moments difficiles (1 rappel max par jour)
      </span>
      <input type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden />
    </label>
  );
}
