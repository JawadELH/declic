// Lien d'invitation /allie/:uid : devenir alliés en un tap.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { IconCheck, IconUserPlus } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import Avatar from '../components/Avatar.jsx';
import { cardLine } from '../components/ProfileSheet.jsx';
import { acceptAlliance, getProfile, requestAlliance } from '../lib/db.js';

export default function InviteAlly() {
  const { uid } = useParams();
  const [params] = useSearchParams();
  const code = params.get('c');
  const [error, setError] = useState(false);
  const { user, profile } = useAppData();
  const social = useSocial();
  const [p, setP] = useState(undefined);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem('declic.invite');
    } catch {
      /* indisponible */
    }
    getProfile(uid).then(setP).catch(() => setP(null));
  }, [uid]);

  const ally = social.allyIds.has(uid);
  const incoming = social.incoming.find((a) => a.uid === uid);
  const outgoing = social.outgoing.some((a) => a.uid === uid);

  return (
    <div className="page center-col invite-page">
      {p === undefined ? (
        <p className="muted">Chargement…</p>
      ) : p === null || uid === user.uid ? (
        <>
          <h1>{uid === user.uid ? 'C’est ton propre lien' : 'Invitation introuvable'}</h1>
          <p className="muted">{uid === user.uid ? 'Partage-le à un proche pour devenir alliés.' : 'Ce membre n’existe plus.'}</p>
          <Link to="/" className="btn primary xl">
            Retour
          </Link>
        </>
      ) : (
        <>
          <Avatar uid={uid} pseudo={p.pseudo} size={88} />
          <h1>{p.pseudo} t’invite</h1>
          {cardLine(p.card) && <p className="profile-line">{cardLine(p.card)}</p>}
          <p className="muted">Devenez alliés : vous verrez vos progressions et recevrez vos SOS en priorité.</p>
          {ally ? (
            <p className="tag ok big">
              <IconCheck size={16} aria-hidden /> Vous êtes alliés
            </p>
          ) : incoming ? (
            <button className="btn primary xl" onClick={() => acceptAlliance(incoming.allianceId)}>
              <IconCheck size={20} aria-hidden /> Accepter l’alliance
            </button>
          ) : outgoing || (sent && !code) ? (
            <p className="tag big">Demande envoyée</p>
          ) : (
            <>
              <button
                className="btn primary xl"
                onClick={() =>
                  requestAlliance(user.uid, profile?.pseudo, uid, p.pseudo, code)
                    .then(() => setSent(true))
                    .catch(() => (code ? requestAlliance(user.uid, profile?.pseudo, uid, p.pseudo).then(() => setSent(true)) : setError(true)))
                }
              >
                <IconUserPlus size={20} aria-hidden /> Devenir alliés
              </button>
              {error && <p className="error small">Impossible pour le moment. Réessaie plus tard.</p>}
            </>
          )}
          <Link to="/" className="link">
            Aller à mon tableau de bord
          </Link>
        </>
      )}
    </div>
  );
}
