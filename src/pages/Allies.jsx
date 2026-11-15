// Alliés : les personnes qui se soutiennent mutuellement (invitation, recherche, demandes).
import { useEffect, useState } from 'react';
import { IconCheck, IconLink, IconSearch, IconX } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import { useToast } from '../components/Toast.jsx';
import Avatar from '../components/Avatar.jsx';
import ProfileSheet, { cardLine } from '../components/ProfileSheet.jsx';
import { acceptAlliance, getInviteCode, getProfile, removeAlliance, searchProfiles } from '../lib/db.js';

export async function shareInvite(uid, userDoc, pseudo, toast) {
  const code = await getInviteCode(uid, userDoc);
  const url = `${window.location.origin}/allie/${uid}?c=${code}`;
  const text = `${pseudo || 'Un membre'} t’invite à devenir son allié sur Déclic, pour se libérer ensemble de nos mauvaises habitudes.`;
  try {
    if (navigator.share) return await navigator.share({ title: 'Déclic', text, url });
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Lien d’invitation copié.');
  } catch {
    /* partage annulé */
  }
}

export default function Allies() {
  const { user, profile, userDoc } = useAppData();
  const { allies, incoming, outgoing, blocked } = useSocial();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [cards, setCards] = useState({});
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((r) => setResults(r.filter((p) => p.uid !== user.uid && !blocked.has(p.uid))))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, user.uid, blocked]);

  // Cartes publiques des alliés (série en cours)
  useEffect(() => {
    allies.forEach((a) => {
      if (cards[a.uid] === undefined) getProfile(a.uid).then((p) => setCards((c) => ({ ...c, [a.uid]: p?.card ?? null }))).catch(() => {});
    });
  }, [allies]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <section className="invite">
        <div>
          <strong>Ensemble, on tient mieux.</strong>
          <p className="muted small">Tes alliés voient ta progression, reçoivent tes SOS en priorité et peuvent former un cercle avec toi.</p>
        </div>
        <button className="btn primary" onClick={() => shareInvite(user.uid, userDoc, profile?.pseudo, toast).catch(() => toast('Partage impossible pour le moment.'))}>
          <IconLink size={18} aria-hidden /> Inviter
        </button>
      </section>

      <label className="search">
        <IconSearch size={18} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un pseudo" aria-label="Chercher un membre" />
      </label>
      {q.trim().length >= 2 && (
        <ul className="people">
          {results.length === 0 && <li className="muted small">Personne avec ce pseudo.</li>}
          {results.map((p) => (
            <li key={p.uid}>
              <button className="person" onClick={() => setSheet(p)}>
                <Avatar uid={p.uid} pseudo={p.pseudo} size={40} />
                <span className="grow">
                  <strong>{p.pseudo}</strong>
                  {cardLine(p.card) && <span className="muted small block">{cardLine(p.card)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <section>
          <h3 className="section-title">Demandes reçues</h3>
          <ul className="people">
            {incoming.map((a) => (
              <li key={a.allianceId} className="person">
                <Avatar uid={a.uid} pseudo={a.pseudo} size={40} />
                <strong className="grow">{a.pseudo}</strong>
                <button className="icon-round" onClick={() => acceptAlliance(a.allianceId).then(() => toast(`Vous êtes alliés avec ${a.pseudo}.`))} aria-label={`Accepter ${a.pseudo}`}>
                  <IconCheck size={20} />
                </button>
                <button className="icon-round ghost" onClick={() => removeAlliance(a.allianceId)} aria-label={`Refuser ${a.pseudo}`}>
                  <IconX size={20} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="section-title">
          Mes alliés <span className="muted">· {allies.length}</span>
        </h3>
        {allies.length === 0 ? (
          <p className="empty-note">Pas encore d’allié. Invite un proche qui veut aussi arrêter, ou cherche un membre croisé dans le direct.</p>
        ) : (
          <ul className="people">
            {allies.map((a) => (
              <li key={a.uid}>
                <button className="person" onClick={() => setSheet(a)}>
                  <Avatar uid={a.uid} pseudo={a.pseudo} size={40} />
                  <span className="grow">
                    <strong>{a.pseudo}</strong>
                    <span className="muted small block">{cardLine(cards[a.uid]) ?? 'Allié'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h3 className="section-title">En attente</h3>
          <ul className="people">
            {outgoing.map((a) => (
              <li key={a.allianceId} className="person">
                <Avatar uid={a.uid} pseudo={a.pseudo} size={32} />
                <span className="grow">{a.pseudo}</span>
                <button className="link small" onClick={() => removeAlliance(a.allianceId)}>
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet && <ProfileSheet uid={sheet.uid} pseudo={sheet.pseudo} onClose={() => setSheet(null)} />}
    </>
  );
}
