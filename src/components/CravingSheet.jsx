import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import BreathingTimer from './BreathingTimer.jsx';
import { useToast } from './Toast.jsx';
import { useAppData } from '../hooks/useAppData.jsx';
import { createPost, logCraving, logUse } from '../lib/db.js';
import { tipsOf, triggersOf } from '../../shared/index.js';

const INTENSITY = ['Légère', 'Modérée', 'Forte', 'Très forte', 'Intense'];

/** Feuille « J'ai une envie » : noter, se faire aider, puis dire si on a tenu. */
export function CravingSheet({ habit, onClose }) {
  const { user, profile } = useAppData();
  const toast = useToast();
  const nav = useNavigate();
  const [intensity, setIntensity] = useState(3);
  const [trigger, setTrigger] = useState('');
  const [custom, setCustom] = useState('');
  const [breathing, setBreathing] = useState(false);
  const [gaveIn, setGaveIn] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const tip = useMemo(() => {
    const tips = tipsOf(habit);
    return tips[Math.floor(Math.random() * tips.length)];
  }, [habit]);

  const chosenTrigger = trigger === '__custom' ? custom.trim() : trigger;

  async function save(resisted) {
    setBusy(true);
    try {
      await logCraving(user.uid, habit, { intensity, trigger: chosenTrigger, resisted, quantity });
      toast(resisted ? 'Envie surmontée. Tu peux être fier·e de toi !' : 'C’est noté. Un écart n’efface pas tes progrès.', {
        icon: resisted ? '💪' : '🌱',
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function sos() {
    await createPost(user.uid, profile, {
      kind: 'sos',
      habit,
      text: `Grosse envie en ce moment${chosenTrigger ? ` (${chosenTrigger.toLowerCase()})` : ''}. Un petit mot d’encouragement ? 🙏`,
    });
    onClose();
    nav('/communaute');
  }

  return (
    <Modal title="J’ai une envie" onClose={onClose}>
      {breathing ? (
        <>
          <BreathingTimer />
          <button className="btn ghost" onClick={() => setBreathing(false)}>
            Revenir
          </button>
        </>
      ) : (
        <div className="stack">
          <p className="tip">💡 {tip}</p>
          {habit.motivation && <blockquote className="why">« {habit.motivation} »</blockquote>}

          <fieldset>
            <legend>Intensité : {INTENSITY[intensity - 1]}</legend>
            <div className="scale">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" className={`scale-step ${i <= intensity ? 'on' : ''}`} onClick={() => setIntensity(i)} aria-label={`Intensité ${i}`} aria-pressed={i === intensity}>
                  {i}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Qu’est-ce qui l’a déclenchée ?</legend>
            <div className="chips">
              {triggersOf(habit).map((t) => (
                <button key={t} type="button" className={`chip ${trigger === t ? 'on' : ''}`} onClick={() => setTrigger(trigger === t ? '' : t)} aria-pressed={trigger === t}>
                  {t}
                </button>
              ))}
              <button type="button" className={`chip ${trigger === '__custom' ? 'on' : ''}`} onClick={() => setTrigger('__custom')}>
                Autre…
              </button>
            </div>
            {trigger === '__custom' && <input placeholder="Précise" maxLength={30} value={custom} onChange={(e) => setCustom(e.target.value)} />}
          </fieldset>

          <div className="row wrap">
            <button className="btn soft" onClick={() => setBreathing(true)}>
              🌬️ Respirer 2 min
            </button>
            <button className="btn soft" onClick={sos}>
              🆘 Demander du soutien
            </button>
          </div>

          {!gaveIn ? (
            <div className="row">
              <button className="btn ghost" onClick={() => setGaveIn(true)} disabled={busy}>
                J’ai craqué
              </button>
              <button className="btn primary grow" onClick={() => save(true)} disabled={busy}>
                J’ai tenu bon 💪
              </button>
            </div>
          ) : (
            <div className="stack">
              <label>
                Combien ? ({habit.unitPlural})
                <input type="number" min="0.5" step="any" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </label>
              <button className="btn primary" onClick={() => save(false)} disabled={busy}>
                Enregistrer
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Feuille « J'ai consommé / J'ai craqué » : sans jugement. */
export function UseSheet({ habit, onClose }) {
  const { user } = useAppData();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [trigger, setTrigger] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const quit = habit.mode === 'quit';

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await logUse(user.uid, habit, { quantity, trigger, note });
      toast(quit ? 'Merci pour ton honnêteté. On repart, ensemble.' : 'Consommation notée.', { icon: '🌱' });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={quit ? 'J’ai fait un écart' : 'Noter une consommation'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        {quit && (
          <p className="muted">
            Un écart fait partie du chemin pour beaucoup de gens. Ton total d’économies et tes envies surmontées restent acquis ; seule la série en
            cours repart de zéro.
          </p>
        )}
        <label>
          Quantité ({habit.unitPlural})
          <input type="number" min="0.5" step="any" required value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <fieldset>
          <legend>Contexte (facultatif)</legend>
          <div className="chips">
            {triggersOf(habit).map((t) => (
              <button key={t} type="button" className={`chip ${trigger === t ? 'on' : ''}`} onClick={() => setTrigger(trigger === t ? '' : t)} aria-pressed={trigger === t}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Note pour toi (facultatif)
          <textarea rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qu’est-ce qui aurait pu t’aider ?" />
        </label>
        <button className="btn primary" disabled={busy}>
          Enregistrer
        </button>
      </form>
    </Modal>
  );
}
