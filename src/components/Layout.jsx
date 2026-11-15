import { useEffect, useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { IconChartLine, IconSun, IconUser, IconUsers } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { heartbeat, saveProfileCard } from '../lib/db.js';
import { SocialProvider } from '../hooks/useSocial.jsx';
import { computeHabitStats } from '../../shared/index.js';

const NAV = [
  { to: '/', label: 'Aujourd’hui', Icon: IconSun, end: true },
  { to: '/progres', label: 'Progrès', Icon: IconChartLine },
  { to: '/groupe', label: 'Groupe', Icon: IconUsers },
  { to: '/moi', label: 'Moi', Icon: IconUser, badge: true },
];

export default function Layout() {
  const { user, profile, unread, habits, logs, userDoc } = useAppData();

  // Carte publique (série en cours, victoires) visible des alliés et des cercles.
  const main = habits?.[0];
  const card = useMemo(() => {
    if (!main || userDoc?.shareActivity === false) return null;
    const st = computeHabitStats(main, logs, Date.now(), { days: 1 });
    return { habitId: main.templateId, habitLabel: main.label, mode: main.mode, streakStart: st.streakStart, resisted: st.resisted };
  }, [main, logs, userDoc?.shareActivity]);
  useEffect(() => {
    if (!user || !profile?.pseudo || !userDoc) return;
    const cur = profile.card ?? null;
    const keys = ['habitId', 'habitLabel', 'mode', 'streakStart', 'resisted'];
    const same = cur === card || (cur && card && keys.every((k) => cur[k] === card[k]));
    if (same && profile.pseudoLower) return;
    saveProfileCard(user.uid, profile, card).catch(() => {});
  }, [user, profile, card, userDoc]);

  // Présence : alimente le « X en ligne » du groupe.
  useEffect(() => {
    if (!user) return;
    const beat = () => document.visibilityState === 'visible' && heartbeat(user.uid, profile).catch(() => {});
    beat();
    const t = setInterval(beat, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [user, profile]);

  return (
    <SocialProvider>
    <div className="shell">
      <main className="content">
        <Outlet />
      </main>
      <nav className="nav" aria-label="Navigation principale">
        {NAV.map(({ to, label, Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <span className="nav-icon">
              <Icon size={24} stroke={1.75} aria-hidden />
              {badge && unread > 0 && <span className="dot" aria-label={`${unread} notifications`} />}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
    </SocialProvider>
  );
}
