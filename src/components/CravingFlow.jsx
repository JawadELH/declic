// Flux plein écran « J'ai une envie » : le minuteur de respiration démarre tout seul,
// le groupe peut envoyer de la force en direct, puis récompense immédiate.
// Les écritures ne sont jamais attendues : l'app reste fluide même hors ligne
// (Firestore applique tout de suite en local et synchronise au retour du réseau).
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconX, IconHeartHandshake, IconPlant2 } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { usePulse, useSosSupport } from '../hooks/useGroup.js';
import { useToast } from './Toast.jsx';
import Avatar from './Avatar.jsx';
import { Confetti, SurpriseCard, TreeArt } from './Rewards.jsx';
import { addCustomTrigger, closeSos, logResisted, logUse, publishActivity, saveBadge, startSos } from '../lib/db.js';
import { buzz } from '../lib/ui.js';
import { money } from '../lib/format.js';
import { cravingPhrase, formatDuration, MINUTE, qtyOptions, treeStage, triggersOf } from '../../shared/index.js';

const TOTAL = 90; // secondes : une envie redescend en général en quelques minutes
const PHASE = 4;
const SHARE_GAP = 30 * MINUTE;

function shareAllowed(key) {
  try {
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < SHARE_GAP) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* stockage indisponible */
  }
  return true;
}

export default function CravingFlow({ habit, stats, mode = 'craving', initialStep = null, onClose }) {
  const { user, profile, userDoc } = useAppData();
  const toast = useToast();
  const pulse = usePulse();
  const [step, setStep] = useState(initialStep ?? (mode === 'slip' ? 'slip' : 'breathe'));
  const [t, setT] = useState(0);
  const [trigger, setTrigger] = useState(null);
  const [sosId, setSosId] = useState(null);
  const [victories, setVictories] = useState(initialStep === 'victory' ? stats.resisted + 1 : stats.resisted);
  const supporters = useSosSupport(sosId);
  const prevCount = useRef(0);
  const share = userDoc?.shareActivity !== false;

  const syncError = useCallback(() => toast('Enregistrement impossible pour le moment. Réessaie dans un instant.', { duration: 6000 }), [toast]);

  // Fermer l'écran pendant un SOS le clôture aussi (sinon il resterait visible 10 minutes chez les autres).
  const close = useCallback(() => {
    if (sosId && step === 'breathe') closeSos(sosId, 'closed').catch(() => {});
    onClose();
  }, [sosId, step, onClose]);

  useEffect(() => {
    if (step !== 'breathe' || t >= TOTAL) return;
    const id = setTimeout(() => setT((x) => x + 1), 1000);
    return () => clearTimeout(id);
  }, [step, t]);

  useEffect(() => {
    if (supporters.length > prevCount.current) buzz([20]);
    prevCount.current = supporters.length;
  }, [supporters.length]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [close]);

  function askGroup() {
    if (sosId) return;
    setSosId(startSos(user.uid, profile, habit, trigger, () => toast('Le groupe n’a pas pu être prévenu (connexion ?).')));
  }

  function won() {
    logResisted(user.uid, habit, { trigger }).catch(syncError);
    if (sosId) closeSos(sosId, 'resisted').catch(() => {});
    if (share && shareAllowed(`declic.share.${user.uid}`)) publishActivity(user.uid, profile, { kind: 'resisted', habit }).catch(() => {});
    buzz([30, 40, 60]);
    setVictories(stats.resisted + 1);
    setStep('victory');
  }

  function slipped(quantity) {
    logUse(user.uid, habit, { quantity, trigger, fromCraving: mode !== 'slip' }).catch(syncError);
    if (sosId) closeSos(sosId, 'slip').catch(() => {});
    setStep('slipDone');
  }

  const left = Math.max(0, TOTAL - t);
  const inhale = Math.floor(t / PHASE) % 2 === 0;
  const before = treeStage(stats.resisted);
  const after = treeStage(victories);
  const grew = after.index > before.index;

  return (
    <div className="flow" role="dialog" aria-modal="true" aria-label="J’ai une envie">
      <button className="flow-close" onClick={close} aria-label="Fermer">
        <IconX size={24} />
      </button>

      {step === 'breathe' && (
        <div className="flow-body">
          <p className="flow-kicker">{t >= TOTAL ? 'Le pic est passé.' : 'L’envie passe. Respire.'}</p>
          {habit.motivation && <p className="why">« {habit.motivation} »</p>}
          <div className={`breath ${inhale && t < TOTAL ? 'in' : 'out'}`} aria-live="polite">
            <span className="breath-phase">{t >= TOTAL ? 'Bravo' : inhale ? 'Inspire' : 'Expire'}</span>
            <span className="breath-time">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </span>
          </div>

          {sosId ? (
            <div className="support">
              {supporters.length ? (
                <>
                  <div className="stack-avatars">
                    {supporters.slice(0, 5).map((s) => (
                      <Avatar key={s.id} uid={s.uid} pseudo={s.pseudo} size={34} />
                    ))}
                  </div>
                  <p>
                    {supporters.length} personne{supporters.length > 1 ? 's' : ''} t’envoie{supporters.length > 1 ? 'nt' : ''} de la force
                  </p>
                </>
              ) : (
                <p className="muted">Le groupe est prévenu. Le soutien arrive ici en direct.</p>
              )}
            </div>
          ) : (
            <TriggerChips habit={habit} uid={user.uid} value={trigger} onChange={setTrigger} />
          )}

          <div className="flow-actions">
            {!sosId && (
              <button className="btn ghost" onClick={askGroup}>
                <IconHeartHandshake size={20} aria-hidden /> Prévenir le groupe
              </button>
            )}
            <button className="btn primary xl" onClick={won}>
              J’ai tenu
            </button>
            <button className="link" onClick={() => setStep('slip')}>
              J’ai craqué
            </button>
          </div>
        </div>
      )}

      {step === 'victory' && (
        <div className="flow-body center-col">
          <Confetti />
          <div className="badge-win pop">
            <IconCheck size={56} stroke={2.5} aria-hidden />
          </div>
          <h1 className="win-title">Envie battue</h1>
          <p className="win-sub">{victories}e victoire</p>
          <p className="muted win-detail">
            {habit.costPerUnit > 0 && `+${money(habit.costPerUnit, habit.currency, 2)} gardés. `}
            {habit.mode === 'quit' && stats.nextMilestone
              ? `Encore ${formatDuration(Math.max(0, stats.nextMilestone.minutes * MINUTE - stats.streakMs))} avant ton prochain cap (${stats.nextMilestone.title}).`
              : 'Chaque envie battue rend la suivante plus facile.'}
          </p>
          {grew && (
            <div className="grew pop">
              <TreeArt stage={after.index} size={64} />
              <span>
                <IconPlant2 size={16} aria-hidden /> Ton arbre a grandi : <strong>{after.name}</strong>
              </span>
            </div>
          )}
          <SurpriseCard
            habit={habit}
            pulse={pulse}
            onRare={(id) => {
              buzz([20, 30, 20, 30, 80]);
              saveBadge(user.uid, id).catch(() => {});
            }}
          />
          <div className="flow-actions">
            <button className="btn primary xl" onClick={onClose}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {step === 'slip' && (
        <div className="flow-body center-col">
          <h1 className="win-title">Combien ?</h1>
          <p className="muted">{habit.unitPlural}</p>
          {mode === 'slip' && (
            <>
              <p className="muted small">Dans quel contexte ? (facultatif)</p>
              <TriggerChips habit={habit} uid={user.uid} value={trigger} onChange={setTrigger} />
            </>
          )}
          <div className="qty">
            {qtyOptions(habit).map((q) => (
              <button key={q} className="qty-btn" onClick={() => slipped(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="row qty-other"
            onSubmit={(e) => {
              e.preventDefault();
              const q = Number(new FormData(e.currentTarget).get('q'));
              if (q > 0 && q < 10000) slipped(q);
            }}
          >
            <input name="q" type="number" min="0.1" step="any" inputMode="decimal" placeholder="Autre" aria-label={`Autre quantité (${habit.unitPlural})`} />
            <button className="btn ghost">OK</button>
          </form>
          <p className="muted small">Sans jugement : ça sert à mieux t’aider.</p>
        </div>
      )}

      {step === 'slipDone' && (
        <div className="flow-body center-col">
          <h1 className="win-title">C’est noté</h1>
          <p className="muted win-detail">
            Tes {money(stats.moneySaved, habit.currency)} gardés, tes {stats.resisted} victoires et ton arbre restent acquis. On repart, maintenant.
          </p>
          <p className="muted small">La prochaine fois que {cravingPhrase(habit)} arrive, appuie sur « J’ai une envie » avant de décider.</p>
          <div className="flow-actions">
            <button className="btn primary xl" onClick={onClose}>
              Continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Déclencheurs en un appui, avec « + Autre » pour ajouter le sien (gardé pour la suite). */
function TriggerChips({ habit, uid, value, onChange }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const list = triggersOf(habit).slice(0, 8);
  if (value && !list.includes(value)) list.unshift(value);
  function add(e) {
    e.preventDefault();
    const t = text.trim().slice(0, 30);
    if (!t) return setAdding(false);
    addCustomTrigger(uid, habit.id, t).catch(() => {});
    onChange(t);
    setText('');
    setAdding(false);
  }
  return (
    <div className="chips center">
      {list.map((x) => (
        <button key={x} className={`chip ${value === x ? 'on' : ''}`} onClick={() => onChange(value === x ? null : x)} aria-pressed={value === x}>
          {x}
        </button>
      ))}
      {adding ? (
        <form className="chip-add" onSubmit={add}>
          <input autoFocus maxLength={30} value={text} onChange={(e) => setText(e.target.value)} onBlur={add} placeholder="Ton déclencheur" aria-label="Nouveau déclencheur" />
        </form>
      ) : (
        <button className="chip ghost-chip" onClick={() => setAdding(true)}>
          + Autre
        </button>
      )}
    </div>
  );
}
