// Flux plein écran « J'ai une envie » : le minuteur de respiration démarre tout seul,
// le groupe peut envoyer de la force en direct, puis récompense immédiate.
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconX, IconHeartHandshake } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSosSupport } from '../hooks/useGroup.js';
import Avatar from './Avatar.jsx';
import { closeSos, logResisted, logUse, publishActivity, startSos } from '../lib/db.js';
import { buzz } from '../lib/ui.js';
import { money } from '../lib/format.js';
import { cravingPhrase, formatDuration, MINUTE, triggersOf } from '../../shared/index.js';

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

export default function CravingFlow({ habit, stats, mode = 'craving', onClose }) {
  const { user, profile, userDoc } = useAppData();
  const [step, setStep] = useState(mode === 'slip' ? 'slip' : 'breathe');
  const [t, setT] = useState(0);
  const [trigger, setTrigger] = useState(null);
  const [sosId, setSosId] = useState(null);
  const [busy, setBusy] = useState(false);
  const supporters = useSosSupport(sosId);
  const prevCount = useRef(0);
  const share = userDoc?.shareActivity !== false;

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
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function askGroup() {
    if (sosId || busy) return;
    setBusy(true);
    try {
      setSosId(await startSos(user.uid, profile, habit, trigger));
    } finally {
      setBusy(false);
    }
  }

  async function won() {
    setBusy(true);
    try {
      await logResisted(user.uid, habit, { trigger });
      if (sosId) closeSos(sosId, 'resisted').catch(() => {});
      if (share && shareAllowed(`declic.share.${user.uid}`)) publishActivity(user.uid, profile, { kind: 'resisted', habit }).catch(() => {});
      buzz();
      setStep('victory');
    } finally {
      setBusy(false);
    }
  }

  async function slipped(quantity) {
    setBusy(true);
    try {
      await logUse(user.uid, habit, { quantity, trigger, fromCraving: mode !== 'slip' });
      if (sosId) closeSos(sosId, 'slip').catch(() => {});
      setStep('slipDone');
    } finally {
      setBusy(false);
    }
  }

  const left = Math.max(0, TOTAL - t);
  const inhale = Math.floor(t / PHASE) % 2 === 0;

  return (
    <div className="flow" role="dialog" aria-modal="true" aria-label="J’ai une envie">
      <button className="flow-close" onClick={onClose} aria-label="Fermer">
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
            <div className="chips center">
              {triggersOf(habit)
                .slice(0, 6)
                .map((x) => (
                  <button key={x} className={`chip ${trigger === x ? 'on' : ''}`} onClick={() => setTrigger(trigger === x ? null : x)} aria-pressed={trigger === x}>
                    {x}
                  </button>
                ))}
            </div>
          )}

          <div className="flow-actions">
            {!sosId && (
              <button className="btn ghost" onClick={askGroup} disabled={busy}>
                <IconHeartHandshake size={20} aria-hidden /> Prévenir le groupe
              </button>
            )}
            <button className="btn primary xl" onClick={won} disabled={busy}>
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
          <div className="badge-win pop">
            <IconCheck size={56} stroke={2.5} aria-hidden />
          </div>
          <h1 className="win-title">Envie battue</h1>
          <p className="win-sub">{stats.resisted + 1}e victoire</p>
          <p className="muted win-detail">
            {habit.costPerUnit > 0 && `+${money(habit.costPerUnit, habit.currency)} gardés. `}
            {habit.mode === 'quit' && stats.nextMilestone
              ? `Encore ${formatDuration(Math.max(0, stats.nextMilestone.minutes * MINUTE - stats.streakMs))} avant ton prochain cap (${stats.nextMilestone.title}).`
              : 'Chaque envie battue rend la suivante plus facile.'}
          </p>
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
          <div className="qty">
            {[1, 2, 3, 5].map((q) => (
              <button key={q} className="qty-btn" onClick={() => slipped(q)} disabled={busy}>
                {q}
              </button>
            ))}
          </div>
          <p className="muted small">Sans jugement : ça sert à mieux t’aider.</p>
        </div>
      )}

      {step === 'slipDone' && (
        <div className="flow-body center-col">
          <h1 className="win-title">C’est noté</h1>
          <p className="muted win-detail">
            Tes {money(stats.moneySaved, habit.currency)} gardés et tes {stats.resisted} victoires restent acquis. On repart, maintenant.
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
