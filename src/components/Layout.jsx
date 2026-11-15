import { NavLink, Outlet } from 'react-router-dom';
import { useAppData } from '../hooks/useAppData.jsx';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: '📊', end: true },
  { to: '/communaute', label: 'Communauté', icon: '🤝' },
  { to: '/notifications', label: 'Notifications', icon: '🔔', badge: true },
  { to: '/reglages', label: 'Réglages', icon: '⚙️' },
];

export default function Layout() {
  const { unread, profile } = useAppData();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo">Déclic</span>
        <span className="me" title={profile?.pseudo}>
          <span aria-hidden>{profile?.avatar ?? '🙂'}</span> {profile?.pseudo ?? ''}
        </span>
      </header>
      <nav className="nav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-item">
            <span className="nav-icon" aria-hidden>
              {n.icon}
              {n.badge && unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
            </span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
