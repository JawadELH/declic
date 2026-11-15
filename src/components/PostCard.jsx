import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAppData } from '../hooks/useAppData.jsx';
import { useToast } from './Toast.jsx';
import { addComment, deletePost, getMyReaction, reportContent, setReaction } from '../lib/db.js';
import { timeAgo } from '../lib/format.js';
import { HABIT_TEMPLATES } from '../../shared/index.js';

export const REACTIONS = [
  { id: 'courage', icon: '💪', label: 'Courage' },
  { id: 'bravo', icon: '👏', label: 'Bravo' },
  { id: 'merci', icon: '🙏', label: 'Merci' },
];

const KIND_BADGE = { sos: '🆘 Besoin de soutien', victory: '🎉 Victoire' };

export default function PostCard({ post }) {
  const { user, profile } = useAppData();
  const toast = useToast();
  const [mine, setMine] = useState(null);
  const [counts, setCounts] = useState(post.reactions ?? {});
  const [open, setOpen] = useState(false);
  const isAuthor = post.authorId === user.uid;
  const tpl = HABIT_TEMPLATES[post.habitId];

  useEffect(() => setCounts(post.reactions ?? {}), [post.reactions]);
  useEffect(() => {
    getMyReaction(post.id, user.uid).then(setMine).catch(() => {});
  }, [post.id, user.uid]);

  async function react(type) {
    const next = mine === type ? null : type;
    // Mise à jour optimiste ; le compteur réel est tenu par une Cloud Function.
    setCounts((c) => {
      const n = { ...c };
      if (mine) n[mine] = Math.max(0, (n[mine] ?? 1) - 1);
      if (next) n[next] = (n[next] ?? 0) + 1;
      return n;
    });
    setMine(next);
    await setReaction(post.id, user.uid, next);
  }

  async function report() {
    await reportContent(user.uid, { postId: post.id, reason: 'inapproprié' });
    toast('Merci, la modération va regarder.', { icon: '🛡️' });
  }

  return (
    <article className={`card post ${post.kind === 'sos' ? 'sos' : ''}`}>
      <header className="post-head">
        <span className="avatar sm" aria-hidden>
          {post.authorAvatar}
        </span>
        <div className="grow">
          <strong>{post.authorName}</strong>
          <span className="muted small">
            {' '}
            · {tpl ? `${tpl.emoji} ${post.habitId === 'custom' ? post.habitLabel : tpl.label}` : ''} · {timeAgo(post.createdAt)}
          </span>
        </div>
        {KIND_BADGE[post.kind] && <span className="pill">{KIND_BADGE[post.kind]}</span>}
      </header>
      <p className="post-text">{post.text}</p>
      <footer className="row wrap between">
        <div className="row wrap">
          {REACTIONS.map((r) => (
            <button key={r.id} className={`react ${mine === r.id ? 'on' : ''}`} onClick={() => react(r.id)} aria-pressed={mine === r.id} title={r.label}>
              <span aria-hidden>{r.icon}</span> {counts[r.id] ? counts[r.id] : r.label}
            </button>
          ))}
          <button className="react" onClick={() => setOpen(!open)} aria-expanded={open}>
            💬 {post.commentCount ? post.commentCount : 'Répondre'}
          </button>
        </div>
        <div className="row">
          {isAuthor ? (
            <button className="link small" onClick={() => deletePost(post.id)}>
              Supprimer
            </button>
          ) : (
            <button className="link small muted" onClick={report}>
              Signaler
            </button>
          )}
        </div>
      </footer>
      {open && <Comments postId={post.id} uid={user.uid} profile={profile} />}
    </article>
  );
}

function Comments({ postId, uid, profile }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(100)), (s) =>
        setComments(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [postId],
  );
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await addComment(postId, uid, profile, text);
    setText('');
  }
  return (
    <div className="comments">
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <span aria-hidden>{c.authorAvatar}</span>
          <div>
            <strong>{c.authorName}</strong> <span className="muted small">{timeAgo(c.createdAt)}</span>
            <p>{c.text}</p>
          </div>
        </div>
      ))}
      <form className="row" onSubmit={send}>
        <input className="grow" maxLength={500} placeholder="Un mot d’encouragement…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary" disabled={!text.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}
