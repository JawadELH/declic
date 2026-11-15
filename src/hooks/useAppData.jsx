// Contexte global : utilisateur connecté + abonnements temps réel à ses données.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { ensureUserDoc, touchActivity } from '../lib/db.js';
import { DAY } from '../../shared/index.js';
import { toMillis } from '../lib/format.js';

export const AppDataContext = createContext(null);
const Ctx = AppDataContext;
const LOG_WINDOW_DAYS = 365;

export function AppDataProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = chargement, null = déconnecté
  const [userDoc, setUserDoc] = useState(null);
  const [profile, setProfile] = useState(null);
  const [habits, setHabits] = useState(null);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [engine, setEngine] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    if (!user) {
      setUserDoc(null);
      setProfile(null);
      setHabits(user === null ? [] : null);
      setLogs([]);
      setNotifications([]);
      setEngine(null);
      return;
    }
    const uid = user.uid;
    const unsubs = [];
    ensureUserDoc(user).then(() => {
      touchActivity(uid).catch(() => {});
      unsubs.push(onSnapshot(doc(db, 'users', uid), (s) => setUserDoc(s.data() ?? null)));
    });
    unsubs.push(onSnapshot(doc(db, 'profiles', uid), (s) => setProfile(s.exists() ? s.data() : null)));
    unsubs.push(
      onSnapshot(collection(db, 'users', uid, 'habits'), (s) =>
        setHabits(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((h) => h.active !== false)
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)),
        ),
      ),
    );
    const since = Date.now() - LOG_WINDOW_DAYS * DAY;
    unsubs.push(
      onSnapshot(query(collection(db, 'users', uid, 'logs'), where('at', '>=', since), orderBy('at', 'asc')), (s) =>
        setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    );
    unsubs.push(
      onSnapshot(query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(50)), (s) =>
        setNotifications(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    );
    unsubs.push(onSnapshot(doc(db, 'engine', uid), (s) => setEngine(s.data() ?? null), () => setEngine(null)));

    // Activité : sert au moteur pour ne pas notifier quelqu'un qui est déjà dans l'app.
    const ping = () => document.visibilityState === 'visible' && touchActivity(uid).catch(() => {});
    const timer = setInterval(ping, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', ping);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      userDoc,
      profile,
      habits,
      logs,
      notifications,
      unread: notifications.filter((n) => !n.readAt).length,
      engine,
      loading: user === undefined || (user && habits === null),
    }),
    [user, userDoc, profile, habits, logs, notifications, engine],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppData = () => useContext(Ctx);

/** Horloge qui se rafraîchit (pour le compteur en direct). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
