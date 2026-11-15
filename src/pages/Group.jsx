import { useEffect, useState } from 'react';
import { IconCheck, IconFlame, IconHeartHandshake, IconSend, IconTrophy, IconFlag, IconTrash, IconSparkles } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { useActivity, useChallengeCount, useOnline, useOpenSos, usePulse } from '../hooks/useGroup.js';
import { useToast } from '../components/Toast.jsx';
import Avatar from '../components/Avatar.jsx';
import { cheer, deleteActivity, hasCheered, hasTakenChallenge, publishActivity, reportContent, sendForce, takeChallenge } from '../lib/db.js';
import { buzz } from '../lib/ui.js';
import { timeAgo } from '../lib/format.js';
import { challengeOf, dayKey } from '../../shared/index.js';

export default function Group() {
  const { user, profile, habits } = useAppData();
  const toast = useToast();
  const pulse = usePulse();
  const online = useOnline();
  const { list: sos, now } = useOpenSos();
  const feed = useActivity(40);
  const key = dayKey(Date.now());
  const challenge = challengeOf(key);
  const challengeCount = useChallengeCount(key);
  const [took, setTook] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    hasTakenChallenge(user.uid, key).then(setTook).catch(() => {});
  }, [user.uid, key]);

  async function relever() {
    if (took) return;
    setTook(true);
    buzz([20]);
    await takeChallenge(user.uid, key).catch(() => setTook(false));
    publishActivity(user.uid, profile, { kind: 'challenge', habit: habits[0] }).catch(() => {});
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!profile?.pseudo) return toast('Choisis d’abord un pseudo dans « Moi ».');
    const t = text;
    setText('');
    await publishActivity(user.uid, profile, { kind: 'message', habit: habits[0], text: t });
  }

  const others = sos.filter((s) => s.uid !== user.uid);

  return (
    <div className="page group">
      <header className="row between">
        <h1>Groupe</h1>
        <span className="live">
          <span className="live-dot" aria-hidden /> {online ?? '–'} en ligne
        </span>
      </header>

      <section className="pulse-card">
        <span className="pulse-num">{pulse}</span>
        <span>envie{pulse > 1 ? 's' : ''} battue{pulse > 1 ? 's' : ''} par le groupe aujourd’hui</span>
      </section>

      {others.map((s) => (
        <SosCard key={s.id} sos={s} now={now} uid={user.uid} profile={profile} />
      ))}

      <section className="challenge">
        <span className="kicker">Défi du jour</span>
        <p>{challenge}</p>
        <button className={`pill-btn ${took ? 'on' : ''}`} onClick={relever} aria-pressed={took}>
          <IconCheck size={16} aria-hidden /> {took ? 'Relevé' : 'Je relève'} · {challengeCount}
        </button>
      </section>

      <section className="feed" aria-live="polite">
        {feed === null ? (
          <p className="muted">Chargement…</p>
        ) : feed.length === 0 ? (
          <div className="empty-feed">
            <IconSparkles size={28} aria-hidden />
            <p>Tu fais partie des premiers. Chaque envie battue apparaîtra ici et donnera de la force aux suivants.</p>
          </div>
        ) : (
          feed.map((a) => <FeedItem key={a.id} item={a} uid={user.uid} />)
        )}
      </section>

      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Écris au groupe…" aria-label="Message au groupe" />
        <button className="icon-round" disabled={!text.trim()} aria-label="Envoyer">
          <IconSend size={20} />
        </button>
      </form>
    </div>
  );
}

function SosCard({ sos, now, uid, profile }) {
  const [sent, setSent] = useState(false);
  const left = Math.max(0, Math.round((sos.expiresAt - now) / 1000));
  async function give() {
    if (sent) return;
    setSent(true);
    buzz([20]);
    await sendForce(sos.id, uid, profile).catch(() => setSent(false));
  }
  return (
    <section className="sos-card">
      <div className="row between">
        <strong>
          {sos.pseudo} a une grosse envie
        </strong>
        <span className="sos-time">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      </div>
      <p className="muted small">{[sos.trigger, sos.habitLabel.toLowerCase()].filter(Boolean).join(' · ')}</p>
      <button className={`btn sos xl ${sent ? 'sent' : ''}`} onClick={give} disabled={sent}>
        <IconHeartHandshake size={20} aria-hidden /> {sent ? 'Force envoyée' : 'Envoyer de la force'} · {sos.force ?? 0}
      </button>
    </section>
  );
}

const LABELS = {
  resisted: () => 'a battu une envie',
  milestone: (a) => `atteint un cap : ${a.text}`,
  start: (a) => `commence à se libérer (${a.habitLabel.toLowerCase()})`,
  challenge: () => 'relève le défi du jour',
};

function FeedItem({ item, uid }) {
  const toast = useToast();
  const [done, setDone] = useState(item.uid === uid);
  const mine = item.uid === uid;
  useEffect(() => {
    if (!mine) hasCheered(item.id, uid).then((v) => v && setDone(true)).catch(() => {});
  }, [item.id, uid, mine]);

  async function give() {
    if (done) return;
    setDone(true);
    buzz([15]);
    await cheer(item.id, uid).catch(() => setDone(false));
  }

  const Icon = item.kind === 'milestone' ? IconTrophy : IconFlame;
  return (
    <article className={`feed-item k-${item.kind}`}>
      <Avatar uid={item.uid} pseudo={item.pseudo} size={36} />
      <div className="grow">
        {item.kind === 'message' ? (
          <>
            <p className="feed-line">
              <strong>{item.pseudo}</strong> <span className="muted small">· {timeAgo(item.createdAt)}</span>
            </p>
            <p className="feed-text">{item.text}</p>
          </>
        ) : (
          <p className="feed-line">
            <strong>{item.pseudo}</strong> {LABELS[item.kind]?.(item) ?? ''} <span className="muted small">· {timeAgo(item.createdAt)}</span>
          </p>
        )}
        <div className="row">
          <button className={`pill-btn ${done ? 'on' : ''}`} onClick={give} disabled={mine} aria-pressed={done}>
            <Icon size={16} aria-hidden /> {item.kind === 'message' ? 'Force' : 'Bravo'} · {item.cheers ?? 0}
          </button>
          {item.kind === 'message' &&
            (mine ? (
              <button className="icon-btn" onClick={() => deleteActivity(item.id)} aria-label="Supprimer">
                <IconTrash size={16} />
              </button>
            ) : (
              <button
                className="icon-btn"
                onClick={() => reportContent(uid, { activityId: item.id }).then(() => toast('Merci, la modération va regarder.'))}
                aria-label="Signaler"
              >
                <IconFlag size={16} />
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
