import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppData } from './hooks/useAppData.jsx';
import { useToast } from './components/Toast.jsx';
import { listenForeground } from './lib/messaging.js';
import { isConfigured } from './firebase.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Today from './pages/Today.jsx';
import Progress from './pages/Progress.jsx';
import Group from './pages/Group.jsx';
import CirclePage from './pages/CirclePage.jsx';
import InviteAlly from './pages/InviteAlly.jsx';
import Me from './pages/Me.jsx';
import Admin from './pages/Admin.jsx';
import Notifications from './pages/Notifications.jsx';
import History from './pages/History.jsx';

export default function App() {
  const { user, habits, loading } = useAppData();
  const toast = useToast();
  const location = useLocation();

  // Lien d'invitation ouvert avant connexion / premier démarrage : on le garde pour après.
  useEffect(() => {
    if (location.pathname.startsWith('/allie/') && (!user || !habits?.length)) {
      try {
        sessionStorage.setItem('declic.invite', location.pathname + location.search);
      } catch {
        /* indisponible */
      }
    }
  }, [location, user, habits]);

  useEffect(() => {
    if (!user) return;
    let unsub = () => {};
    listenForeground((n) => n.title && toast(`${n.title} — ${n.body ?? ''}`, { duration: 6000 })).then((u) => (unsub = u));
    return () => unsub();
  }, [user, toast]);

  if (!isConfigured) return <MissingConfig />;
  if (loading)
    return (
      <div className="splash" aria-busy="true">
        <span className="logo big">Déclic</span>
      </div>
    );
  if (!user) return <Login />;
  if (!habits.length) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding first />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="nouvelle-habitude" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="progres" element={<Progress />} />
        <Route path="historique" element={<History />} />
        <Route path="groupe" element={<Group />} />
        <Route path="cercle/:id" element={<CirclePage />} />
        <Route path="allie/:uid" element={<InviteAlly />} />
        <Route path="moi" element={<Me />} />
        <Route path="admin" element={<Admin />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="communaute" element={<Navigate to="/groupe" replace />} />
        <Route path="reglages" element={<Navigate to="/moi" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function MissingConfig() {
  return (
    <main className="center-page">
      <div className="card">
        <h1>Configuration Firebase manquante</h1>
        <p className="muted">
          Copie <code>.env.example</code> en <code>.env.local</code> et renseigne les clés de ton projet Firebase, puis relance <code>npm run dev</code>.
        </p>
      </div>
    </main>
  );
}
