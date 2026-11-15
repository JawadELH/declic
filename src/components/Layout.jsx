import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { IconChartLine, IconSun, IconUser, IconUsers } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { heartbeat } from '../lib/db.js';

const NAV = [
  { to: '/', label: 'Aujourd’hui', Icon: IconSun, end: true },
  { to: '/progres', label: 'Progrès', Icon: IconChartLine },
  { to: '/groupe', label: 'Groupe', Icon: IconUsers },
  { to: '/moi', label: 'Moi', Icon: IconUser, badge: true },
];

export default function Layout() {
  const { user, profile, unread } = useAppData();

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
  );
}
