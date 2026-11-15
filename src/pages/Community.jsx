import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAppData } from '../hooks/useAppData.jsx';
import { useToast } from '../components/Toast.jsx';
import PostCard from '../components/PostCard.jsx';
import { createPost } from '../lib/db.js';

const KINDS = [
  { id: 'text', label: '💬 Message' },
  { id: 'victory', label: '🎉 Victoire' },
  { id: 'sos', label: '🆘 Besoin de soutien' },
];

export default function Community() {
  const { user, profile, habits } = useAppData();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [posts, setPosts] = useState(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('text');
  const [habitId, setHabitId] = useState(habits[0]?.id);
  const [busy, setBusy] = useState(false);

  const myTemplates = [...new Map(habits.map((h) => [h.templateId, h])).values()];

  useEffect(() => {
    const base = collection(db, 'posts');
    const q =
      filter === 'all'
        ? query(base, orderBy('createdAt', 'desc'), limit(pageSize))
        : filter === 'sos'
          ? query(base, where('kind', '==', 'sos'), orderBy('createdAt', 'desc'), limit(pageSize))
          : query(base, where('habitId', '==', filter), orderBy('createdAt', 'desc'), limit(pageSize));
    return onSnapshot(q, (s) => setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [filter, pageSize]);

  async function publish(e) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!profile?.pseudo) {
      toast('Choisis d’abord un pseudo dans les réglages.', { icon: '✋' });
      return;
    }
    setBusy(true);
    try {
      await createPost(user.uid, profile, { text, kind, habit: habits.find((h) => h.id === habitId) });
      setText('');
      setKind('text');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="community">
      <h1>Communauté</h1>
      <p className="muted">Un espace bienveillant : on encourage, on partage ce qui marche, on ne juge pas.</p>

      <form className="card composer" onSubmit={publish}>
        <textarea rows={3} maxLength={1000} placeholder="Partage une victoire, une astuce, un moment difficile…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row wrap between">
          <div className="row wrap">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type de message">
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            {habits.length > 1 && (
              <select value={habitId} onChange={(e) => setHabitId(e.target.value)} aria-label="Habitude concernée">
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.emoji} {h.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button className="btn primary" disabled={busy || !text.trim()}>
            Publier
          </button>
        </div>
      </form>

      <div className="chips" role="tablist" aria-label="Filtrer">
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          Tout
        </button>
        {myTemplates.map((h) => (
          <button key={h.templateId} className={`chip ${filter === h.templateId ? 'on' : ''}`} onClick={() => setFilter(h.templateId)}>
            {h.emoji} {h.templateId === 'custom' ? 'Autres' : h.label}
          </button>
        ))}
        <button className={`chip ${filter === 'sos' ? 'on' : ''}`} onClick={() => setFilter('sos')}>
          🆘 Besoin de soutien
        </button>
      </div>

      {posts === null ? (
        <p className="muted">Chargement…</p>
      ) : posts.length === 0 ? (
        <p className="empty card">Rien ici pour l’instant. Lance la conversation !</p>
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {posts.length >= pageSize && (
            <button className="btn ghost" onClick={() => setPageSize((n) => n + 20)}>
              Voir plus
            </button>
          )}
        </>
      )}
    </div>
  );
}
