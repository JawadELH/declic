import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppData } from '../hooks/useAppData.jsx';
import { markAllRead, markNotification } from '../lib/db.js';
import { timeAgo } from '../lib/format.js';
import { describePlan, NOTIF_LEVELS } from '../../shared/index.js';

const ICONS = { risk: '🧭', milestone: '🎉', social: '💬', test: '🔔' };

export default function Notifications() {
  const { user, userDoc, notifications, engine } = useAppData();
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');

  // Ouverture depuis une notification push : sert au moteur pour mesurer l'utilité des rappels.
  useEffect(() => {
    if (!openId) return;
    markNotification(user.uid, openId, 'openedAt').catch(() => {});
    setParams({}, { replace: true });
  }, [openId, user.uid, setParams]);

  useEffect(() => {
    const t = setTimeout(() => markAllRead(user.uid, notifications).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [user.uid, notifications]);

  const prefs = userDoc?.notifPrefs ?? {};
  const plan = describePlan(engine?.nextNudge, userDoc?.tz);
  const paused = (engine?.state?.pausedUntil ?? 0) > Date.now();

  return (
    <div className="notifications">
      <h1>Notifications</h1>

      <section className="card explain">
        <h3>Comment fonctionnent tes rappels</h3>
        <p className="muted">
          Mode <strong>{NOTIF_LEVELS[prefs.level]?.label ?? 'Discret'}</strong> : {NOTIF_LEVELS[prefs.level]?.description}
          {' '}Jamais entre {prefs.quietStart ?? 22} h et {prefs.quietEnd ?? 8} h, jamais quand tu es déjà dans l’app.
        </p>
        {paused && (
          <p className="muted">
            ⏸️ Tes derniers rappels n’ont pas été ouverts : Déclic fait une pause jusqu’au{' '}
            {new Date(engine.state.pausedUntil).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.
          </p>
        )}
        <p>{plan ?? 'Aucun rappel prévu pour le moment.'}</p>
        <Link to="/reglages">Modifier mes préférences</Link>
      </section>

      {notifications.length === 0 ? (
        <p className="empty card">Rien de neuf. Profite du calme 🌿</p>
      ) : (
        <ul className="notif-list">
          {notifications.map((n) => (
            <li key={n.id} className={`card notif ${n.readAt ? '' : 'unread'}`}>
              <span className="notif-icon" aria-hidden>
                {ICONS[n.kind] ?? '🔔'}
              </span>
              <div className="grow">
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <span className="muted small">
                  {timeAgo(n.createdAt)}
                  {n.pushed ? '' : ' · dans l’app uniquement'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
