// Espace administrateur / modérateur.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { IconArrowLeft, IconBan, IconCheck, IconFlag, IconShieldCheck, IconTrash } from '@tabler/icons-react';
import { db } from '../firebase.js';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import { useToast } from '../components/Toast.jsx';
import Avatar from '../components/Avatar.jsx';
import { cardLine } from '../components/ProfileSheet.jsx';
import { adminOverview, banUser, deleteActivity, deleteReport, getActivity, searchProfiles, setModerator, unbanUser } from '../lib/db.js';
import { timeAgo } from '../lib/format.js';
import { DAY } from '../../shared/index.js';

const TABS = [
  { id: 'vue', label: 'Vue d’ensemble' },
  { id: 'signalements', label: 'Signalements' },
  { id: 'membres', label: 'Membres' },
];

export default function Admin() {
  const social = useSocial();
  const [tab, setTab] = useState('vue');
  if (!social.isMod)
    return (
      <div className="page">
        <p className="empty-note">Cet espace est réservé à l’équipe de modération.</p>
      </div>
    );
  return (
    <div className="page admin">
      <Link to="/moi" className="back">
        <IconArrowLeft size={18} aria-hidden /> Moi
      </Link>
      <h1>
        <IconShieldCheck size={26} aria-hidden /> {social.isAdmin ? 'Administration' : 'Modération'}
      </h1>
      <div className="segmented">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'vue' && <Overview />}
      {tab === 'signalements' && <Reports />}
      {tab === 'membres' && <Members />}
    </div>
  );
}

function Overview() {
  const [o, setO] = useState(null);
  useEffect(() => {
    adminOverview().then(setO).catch(() => setO(false));
  }, []);
  if (o === null) return <p className="muted">Chargement…</p>;
  if (o === false) return <p className="error">Impossible de charger les chiffres. As-tu bien déployé les règles Firestore ?</p>;
  const max = Math.max(1, ...o.pulseDays.map((d) => d.value));
  return (
    <>
      <div className="tiles">
        <Tile label="Membres" value={o.members} />
        <Tile label="Actifs 24 h" value={o.active24h} />
        <Tile label="Actifs 7 jours" value={o.active7d} />
        <Tile label="Envies battues aujourd’hui" value={o.pulseToday} />
        <Tile label="Signalements en attente" value={o.reports} warn={o.reports > 0} />
        <Tile label="Comptes suspendus" value={o.bans} />
      </div>
      <section className="card">
        <h3>Envies battues · 7 jours ({o.pulseWeek})</h3>
        <div className="mini-bars" role="img" aria-label="Envies battues par jour sur 7 jours">
          {o.pulseDays.map((d) => (
            <div key={d.key} className="mini-bar" title={`${d.key} : ${d.value}`}>
              <span className="mini-value">{d.value}</span>
              <span className="mini-fill" style={{ height: `${(d.value / max) * 100}%` }} />
              <span className="mini-label">{d.key.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Tile({ label, value, warn }) {
  return (
    <div className={`tile ${warn ? 'warn' : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
    </div>
  );
}

function Reports() {
  const { user } = useAppData();
  const toast = useToast();
  const [items, setItems] = useState(null);
  async function load() {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50)));
    const list = await Promise.all(
      snap.docs.map(async (d) => {
        const r = { id: d.id, ...d.data() };
        r.target = r.postId ? await getActivity(r.postId).catch(() => null) : null;
        return r;
      }),
    );
    setItems(list);
  }
  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  const drop = (id) => setItems((l) => l.filter((x) => x.id !== id));
  if (items === null) return <p className="muted">Chargement…</p>;
  if (!items.length) return <p className="empty-note">Aucun signalement en attente. Tout est calme.</p>;
  return (
    <ul className="report-list">
      {items.map((r) => (
        <li key={r.id} className="card stack">
          <div className="row between">
            <span className="tag">
              <IconFlag size={14} aria-hidden /> {r.reason}
            </span>
            <span className="muted small">{timeAgo(r.createdAt)}</span>
          </div>
          {r.target ? (
            <div className="reported">
              <strong>{r.target.pseudo}</strong>
              <p>{r.target.text || '(événement automatique)'}</p>
            </div>
          ) : (
            <p className="muted small">Le contenu a déjà été supprimé.</p>
          )}
          <div className="row wrap">
            {r.target && (
              <button
                className="btn danger"
                onClick={async () => {
                  await deleteActivity(r.target.id);
                  await deleteReport(r.id);
                  drop(r.id);
                  toast('Contenu supprimé.');
                }}
              >
                <IconTrash size={16} aria-hidden /> Supprimer le contenu
              </button>
            )}
            {r.target && (
              <button
                className="btn ghost"
                onClick={async () => {
                  await banUser(r.target.uid, user.uid, r.reason);
                  toast(`${r.target.pseudo} est suspendu du groupe.`);
                }}
              >
                <IconBan size={16} aria-hidden /> Suspendre l’auteur
              </button>
            )}
            <button
              className="btn ghost"
              onClick={async () => {
                await deleteReport(r.id);
                drop(r.id);
              }}
            >
              <IconCheck size={16} aria-hidden /> Classer
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Members() {
  const { user } = useAppData();
  const social = useSocial();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [flags, setFlags] = useState({});

  useEffect(() => {
    const t = setTimeout(async () => {
      const rows =
        q.trim().length >= 2
          ? await searchProfiles(q)
          : (await getDocs(query(collection(db, 'profiles'), orderBy('pseudoLower'), limit(60)))).docs.map((d) => ({ uid: d.id, ...d.data() }));
      setList(rows);
      const entries = await Promise.all(
        rows.map(async (p) => {
          const [ban, role, presence] = await Promise.all([
            getDoc(doc(db, 'bans', p.uid)),
            getDoc(doc(db, 'roles', p.uid)),
            getDoc(doc(db, 'presence', p.uid)),
          ]);
          return [p.uid, { banned: ban.exists(), mod: role.exists(), lastSeen: presence.data()?.lastSeen ?? null }];
        }),
      );
      setFlags(Object.fromEntries(entries));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const setFlag = (uid, patch) => setFlags((f) => ({ ...f, [uid]: { ...f[uid], ...patch } }));

  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un pseudo" aria-label="Chercher un membre" />
      <ul className="people">
        {list.map((p) => {
          const f = flags[p.uid] ?? {};
          const active = f.lastSeen && Date.now() - f.lastSeen < DAY;
          return (
            <li key={p.uid} className="person admin-row">
              <Avatar uid={p.uid} pseudo={p.pseudo} size={38} />
              <span className="grow">
                <strong>{p.pseudo}</strong> {f.mod && <span className="tag ok">modo</span>} {f.banned && <span className="tag bad">suspendu</span>}
                <span className="muted small block">
                  {[cardLine(p.card), f.lastSeen ? `vu ${timeAgo(f.lastSeen)}` : 'jamais vu', active ? 'actif' : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              {p.uid !== user.uid && (
                <span className="row">
                  {f.banned ? (
                    <button className="pill-btn" onClick={() => unbanUser(p.uid).then(() => setFlag(p.uid, { banned: false }))}>
                      Rétablir
                    </button>
                  ) : (
                    <button className="pill-btn" onClick={() => banUser(p.uid, user.uid).then(() => setFlag(p.uid, { banned: true }) || toast(`${p.pseudo} suspendu.`))}>
                      Suspendre
                    </button>
                  )}
                  {social.isAdmin && (
                    <button className={`pill-btn ${f.mod ? 'on' : ''}`} onClick={() => setModerator(p.uid, !f.mod, p.pseudo).then(() => setFlag(p.uid, { mod: !f.mod }))}>
                      {f.mod ? 'Modo ✓' : 'Nommer modo'}
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Suspendre empêche de publier, d’envoyer des SOS, de rejoindre des cercles et de demander des alliances. Pour supprimer définitivement un compte, utilise la
        console Firebase → Authentication.
      </p>
    </>
  );
}
