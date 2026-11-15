import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppData } from './hooks/useAppData.jsx';
import { useToast } from './components/Toast.jsx';
import { listenForeground } from './lib/messaging.js';
import { isConfigured } from './firebase.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Community from './pages/Community.jsx';
import Notifications from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { user, habits, loading } = useAppData();
  const toast = useToast();

  useEffect(() => {
    if (!user) return;
    let unsub = () => {};
    listenForeground((n) => n.title && toast(`${n.title} — ${n.body ?? ''}`, { icon: '🔔', duration: 6000 })).then((u) => (unsub = u));
    return () => unsub();
  }, [user, toast]);

  if (!isConfigured) return <MissingConfig />;
  if (loading) return <div className="splash" aria-busy="true"><span className="logo">Déclic</span></div>;
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
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="communaute" element={<Community />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="reglages" element={<Settings />} />
        <Route path="nouvelle-habitude" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function MissingConfig() {
  return (
    <main className="center-page">
      <div className="card narrow">
        <h1>Configuration Firebase manquante</h1>
        <p>
          Copie <code>.env.example</code> en <code>.env.local</code> et renseigne les clés de ton projet Firebase,
          puis relance <code>npm run dev</code>. Tout est expliqué dans le README.
        </p>
      </div>
    </main>
  );
}
