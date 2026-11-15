// Page d'un cercle : classement des séries, discussion privée, gestion des membres.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { IconArrowLeft, IconCrown, IconDoorExit, IconSend, IconTrash, IconUserPlus } from '@tabler/icons-react';
import { db } from '../firebase.js';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import { useToast } from '../components/Toast.jsx';
import Avatar from '../components/Avatar.jsx';
import Sheet from '../components/Sheet.jsx';
import ProfileSheet from '../components/ProfileSheet.jsx';
import { AllyPicker } from './Circles.jsx';
import { addCircleMembers, deleteCircle, deleteCircleMessage, getProfile, leaveCircle, sendCircleMessage, updateCircle } from '../lib/db.js';
import { timeAgo } from '../lib/format.js';
import { DAY } from '../../shared/index.js';

const streakDays = (card) => (card?.mode === 'quit' && card.streakStart ? Math.floor((Date.now() - card.streakStart) / DAY) : null);

export default function CirclePage() {
  const { id } = useParams();
  const { user, profile } = useAppData();
  const social = useSocial();
  const toast = useToast();
  const nav = useNavigate();
  const [circle, setCircle] = useState(undefined);
  const [profiles, setProfiles] = useState({});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const endRef = useRef(null);

  useEffect(() => onSnapshot(doc(db, 'circles', id), (s) => setCircle(s.exists() ? { id, ...s.data() } : null), () => setCircle(null)), [id]);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'circles', id, 'messages'), orderBy('createdAt', 'desc'), limit(80)),
        (s) => setMessages(s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()),
        () => {},
      ),
    [id],
  );
  useEffect(() => {
    circle?.members?.forEach((uid) => {
      if (!profiles[uid]) getProfile(uid).then((p) => p && setProfiles((x) => ({ ...x, [uid]: p }))).catch(() => {});
    });
  }, [circle?.members]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [messages.length]);

  if (circle === undefined) return <p className="muted">Chargement…</p>;
  if (circle === null || !circle.members.includes(user.uid))
    return (
      <div className="page">
        <Link to="/groupe?vue=cercles" className="back">
          <IconArrowLeft size={18} aria-hidden /> Cercles
        </Link>
        <p className="empty-note">Ce cercle n’existe plus ou tu n’en fais plus partie.</p>
      </div>
    );

  const owner = circle.ownerId === user.uid;
  const ranking = circle.members
    .map((uid) => ({ uid, p: profiles[uid], days: streakDays(profiles[uid]?.card) }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text;
    setText('');
    await sendCircleMessage(id, user.uid, profile?.pseudo, t).catch(() => toast('Message non envoyé.'));
  }

  return (
    <div className="page circle">
      <Link to="/groupe?vue=cercles" className="back">
        <IconArrowLeft size={18} aria-hidden /> Cercles
      </Link>
      <header className="row between">
        <h1>{circle.name}</h1>
        {owner && circle.members.length < 12 && (
          <button className="btn ghost" onClick={() => setAdding(true)}>
            <IconUserPlus size={18} aria-hidden /> Ajouter
          </button>
        )}
      </header>

      <section className="card">
        <h3>Classement des séries</h3>
        <ol className="ranking">
          {ranking.map((r, i) => (
            <li key={r.uid}>
              <span className="rank">{i + 1}</span>
              <button className="avatar-btn" onClick={() => setSheet({ uid: r.uid, pseudo: r.p?.pseudo })}>
                <Avatar uid={r.uid} pseudo={r.p?.pseudo} size={34} />
              </button>
              <span className="grow">
                <strong>{r.p?.pseudo ?? '…'}</strong>
                {r.uid === circle.ownerId && <IconCrown size={14} className="crown" aria-label="Créateur" />}
                <span className="muted small block">{r.p?.card?.habitLabel ?? ''}</span>
              </span>
              <span className="rank-days">{r.days != null ? `${r.days} j` : '–'}</span>
              {owner && r.uid !== user.uid && (
                <button
                  className="icon-btn"
                  aria-label={`Retirer ${r.p?.pseudo ?? ''}`}
                  onClick={() => updateCircle(id, { members: circle.members.filter((m) => m !== r.uid) })}
                >
                  <IconTrash size={16} />
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="chat" aria-live="polite">
        {messages.length === 0 && <p className="empty-note">Lance la discussion : un objectif commun pour la semaine ?</p>}
        {messages
          .filter((m) => !social.blocked.has(m.uid))
          .map((m) => (
            <div key={m.id} className={`bubble-row ${m.uid === user.uid ? 'me' : ''}`}>
              {m.uid !== user.uid && <Avatar uid={m.uid} pseudo={m.pseudo} size={28} />}
              <div className="bubble">
                {m.uid !== user.uid && <span className="bubble-name">{m.pseudo}</span>}
                <p>{m.text}</p>
                <span className="bubble-time">
                  {timeAgo(m.createdAt)}
                  {(m.uid === user.uid || social.isMod) && (
                    <button className="link tiny" onClick={() => deleteCircleMessage(id, m.id)}>
                      supprimer
                    </button>
                  )}
                </span>
              </div>
            </div>
          ))}
        <div ref={endRef} />
      </section>

      {social.banned ? (
        <p className="notice">Ton accès aux discussions est suspendu par la modération.</p>
      ) : (
        <form className="composer" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Écris au cercle…" aria-label="Message au cercle" />
          <button className="icon-round" disabled={!text.trim()} aria-label="Envoyer">
            <IconSend size={20} />
          </button>
        </form>
      )}

      <div className="circle-foot">
        {confirm ? (
          <button
            className="btn danger"
            onClick={async () => {
              if (owner) await deleteCircle(id);
              else await leaveCircle(id, user.uid, circle.members);
              nav('/groupe?vue=cercles');
            }}
          >
            {owner ? 'Confirmer la suppression du cercle' : 'Confirmer : quitter le cercle'}
          </button>
        ) : (
          <button className="link danger-link" onClick={() => setConfirm(true)}>
            <IconDoorExit size={16} aria-hidden /> {owner ? 'Supprimer le cercle' : 'Quitter le cercle'}
          </button>
        )}
      </div>

      {adding && (
        <Sheet title="Ajouter des alliés" onClose={() => setAdding(false)}>
          <div className="stack">
            <AllyPicker
              selected={picked}
              exclude={circle.members}
              onToggle={(uid) => setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : circle.members.length + p.length < 12 ? [...p, uid] : p))}
            />
            <button
              className="btn primary xl"
              disabled={!picked.length}
              onClick={async () => {
                await addCircleMembers(id, picked);
                setPicked([]);
                setAdding(false);
              }}
            >
              Ajouter {picked.length || ''}
            </button>
          </div>
        </Sheet>
      )}
      {sheet && <ProfileSheet uid={sheet.uid} pseudo={sheet.pseudo} onClose={() => setSheet(null)} />}
    </div>
  );
}
