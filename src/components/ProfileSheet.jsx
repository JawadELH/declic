// Fiche d'un membre : sa progression, devenir alliés, bloquer, modérer.
import { useEffect, useState } from 'react';
import { IconBan, IconCheck, IconHourglass, IconUserPlus, IconShieldCheck } from '@tabler/icons-react';
import Sheet from './Sheet.jsx';
import Avatar from './Avatar.jsx';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import { useToast } from './Toast.jsx';
import { acceptAlliance, banUser, blockUser, getProfile, isBanned, removeAlliance, requestAlliance, unbanUser, unblockUser } from '../lib/db.js';
import { DAY } from '../../shared/index.js';

export function cardLine(card, now = Date.now()) {
  if (!card) return null;
  if (card.mode === 'quit' && card.streakStart) {
    const d = Math.floor((now - card.streakStart) / DAY);
    return `${d} jour${d > 1 ? 's' : ''} sans ${String(card.habitLabel || '').toLowerCase()}`;
  }
  return card.habitLabel ? `Réduit : ${String(card.habitLabel).toLowerCase()}` : null;
}

export default function ProfileSheet({ uid, pseudo, onClose }) {
  const { user, profile: me } = useAppData();
  const social = useSocial();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [bannedState, setBannedState] = useState(null);

  useEffect(() => {
    getProfile(uid).then(setP).catch(() => {});
    if (social.isMod) isBanned(uid).then(setBannedState).catch(() => {});
  }, [uid, social.isMod]);

  const isMe = uid === user.uid;
  const ally = social.allies.find((a) => a.uid === uid);
  const incoming = social.incoming.find((a) => a.uid === uid);
  const outgoing = social.outgoing.find((a) => a.uid === uid);
  const isBlocked = social.blocked.has(uid);
  const name = p?.pseudo ?? pseudo ?? 'Membre';
  const line = cardLine(p?.card);

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="profile-top">
        <Avatar uid={uid} pseudo={name} size={72} />
        {line && <p className="profile-line">{line}</p>}
        {p?.card?.resisted > 0 && (
          <p className="muted small">
            {p.card.resisted} envie{p.card.resisted > 1 ? 's' : ''} battue{p.card.resisted > 1 ? 's' : ''}
          </p>
        )}
        {ally && (
          <span className="tag ok">
            <IconCheck size={14} aria-hidden /> Allié
          </span>
        )}
      </div>

      {!isMe && (
        <div className="stack">
          {!isBlocked && !ally && !incoming && !outgoing && (
            <button
              className="btn primary xl"
              onClick={() => requestAlliance(user.uid, me?.pseudo, uid, name).then(() => toast('Demande envoyée.')).catch(() => toast('Impossible pour le moment.'))}
            >
              <IconUserPlus size={20} aria-hidden /> Devenir alliés
            </button>
          )}
          {incoming && (
            <button className="btn primary xl" onClick={() => acceptAlliance(incoming.allianceId).then(() => toast(`Vous êtes alliés avec ${name}.`))}>
              <IconCheck size={20} aria-hidden /> Accepter son alliance
            </button>
          )}
          {outgoing && (
            <button className="btn ghost" onClick={() => removeAlliance(outgoing.allianceId)}>
              <IconHourglass size={18} aria-hidden /> Demande envoyée · Annuler
            </button>
          )}
          {ally && (
            <button className="btn ghost" onClick={() => removeAlliance(ally.allianceId).then(() => toast('Alliance retirée.'))}>
              Retirer des alliés
            </button>
          )}
          {isBlocked ? (
            <button className="btn ghost" onClick={() => unblockUser(user.uid, uid).then(() => toast('Débloqué.'))}>
              Débloquer
            </button>
          ) : confirmBlock ? (
            <button
              className="btn danger"
              onClick={() =>
                blockUser(user.uid, uid).then(() => {
                  toast(`${name} est bloqué. Tu ne verras plus ses messages.`);
                  onClose();
                })
              }
            >
              Confirmer le blocage
            </button>
          ) : (
            <button className="link danger-link" onClick={() => setConfirmBlock(true)}>
              Bloquer
            </button>
          )}

          {social.isMod && (
            <div className="mod-zone">
              <span className="kicker">
                <IconShieldCheck size={14} aria-hidden /> Modération
              </span>
              {bannedState ? (
                <button className="btn ghost" onClick={() => unbanUser(uid).then(() => setBannedState(false) || toast('Accès rétabli.'))}>
                  Rétablir l’accès au groupe
                </button>
              ) : (
                <button className="btn ghost" onClick={() => banUser(uid, user.uid).then(() => setBannedState(true) || toast(`${name} ne peut plus publier.`))}>
                  <IconBan size={18} aria-hidden /> Suspendre du groupe
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
