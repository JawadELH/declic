// Cercles : petits groupes privés entre alliés (12 personnes max).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconChevronRight, IconCircles, IconPlus } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import Sheet from '../components/Sheet.jsx';
import Avatar from '../components/Avatar.jsx';
import { createCircle } from '../lib/db.js';

export default function Circles() {
  const { circles } = useSocial();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <section className="invite">
        <div>
          <strong>Ton cercle, ta petite équipe.</strong>
          <p className="muted small">Un espace privé avec tes alliés : on discute, on suit la série de chacun, on se tire vers le haut.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <IconPlus size={18} aria-hidden /> Créer
        </button>
      </section>

      {circles.length === 0 ? (
        <div className="empty-feed">
          <IconCircles size={28} aria-hidden />
          <p>Aucun cercle pour l’instant. Crée le premier avec tes alliés : famille, collègues, amis qui arrêtent en même temps que toi.</p>
        </div>
      ) : (
        <ul className="people">
          {circles.map((c) => (
            <li key={c.id}>
              <Link to={`/cercle/${c.id}`} className="person">
                <span className="circle-badge" aria-hidden>
                  <IconCircles size={20} />
                </span>
                <span className="grow">
                  <strong>{c.name}</strong>
                  <span className="muted small block">
                    {c.members.length} membre{c.members.length > 1 ? 's' : ''}
                  </span>
                </span>
                <IconChevronRight size={18} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateCircle onClose={() => setCreating(false)} />}
    </>
  );
}

export function AllyPicker({ selected, onToggle, exclude = [] }) {
  const { allies } = useSocial();
  const list = allies.filter((a) => !exclude.includes(a.uid));
  if (!list.length) return <p className="empty-note">Ajoute d’abord des alliés (onglet Alliés) pour les inviter dans un cercle.</p>;
  return (
    <ul className="people">
      {list.map((a) => (
        <li key={a.uid}>
          <label className="person pick">
            <Avatar uid={a.uid} pseudo={a.pseudo} size={36} />
            <span className="grow">{a.pseudo}</span>
            <input type="checkbox" checked={selected.includes(a.uid)} onChange={() => onToggle(a.uid)} />
          </label>
        </li>
      ))}
    </ul>
  );
}

function CreateCircle({ onClose }) {
  const { user } = useAppData();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (uid) => setMembers((m) => (m.includes(uid) ? m.filter((x) => x !== uid) : m.length < 11 ? [...m, uid] : m));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createCircle(user.uid, name, members);
      nav(`/cercle/${id}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="Nouveau cercle" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du cercle : Les poumons libres" aria-label="Nom du cercle" />
        <AllyPicker selected={members} onToggle={toggle} />
        <button className="btn primary xl" disabled={busy || !name.trim()}>
          Créer le cercle{members.length ? ` (${members.length + 1})` : ''}
        </button>
      </form>
    </Sheet>
  );
}
