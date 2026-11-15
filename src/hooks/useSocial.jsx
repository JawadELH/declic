// Contexte social : alliés, demandes, cercles, blocages, rôles.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAppData } from './useAppData.jsx';
import { isAdminUser } from '../../shared/index.js';

const Ctx = createContext(null);
const EMPTY = { allies: [], incoming: [], outgoing: [], allyIds: new Set(), blocked: new Set(), circles: [], isAdmin: false, isMod: false, banned: false };

export function SocialProvider({ children }) {
  const { user } = useAppData();
  const [alliances, setAlliances] = useState([]);
  const [blocked, setBlocked] = useState(new Set());
  const [circles, setCircles] = useState([]);
  const [role, setRole] = useState(null);
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const off = [
      onSnapshot(query(collection(db, 'alliances'), where('members', 'array-contains', uid)), (s) => setAlliances(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(collection(db, 'users', uid, 'blocked'), (s) => setBlocked(new Set(s.docs.map((d) => d.id))), () => {}),
      onSnapshot(query(collection(db, 'circles'), where('members', 'array-contains', uid)), (s) => setCircles(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(doc(db, 'roles', uid), (s) => setRole(s.data()?.role ?? null), () => {}),
      onSnapshot(doc(db, 'bans', uid), (s) => setBanned(s.exists()), () => {}),
    ];
    return () => off.forEach((f) => f());
  }, [user]);

  const value = useMemo(() => {
    if (!user) return EMPTY;
    const me = user.uid;
    const other = (a) => (a.from === me ? { uid: a.to, pseudo: a.toPseudo } : { uid: a.from, pseudo: a.fromPseudo });
    const allies = alliances.filter((a) => a.status === 'accepted').map((a) => ({ allianceId: a.id, ...other(a) }));
    const isAdmin = isAdminUser(user);
    return {
      allies,
      allyIds: new Set(allies.map((a) => a.uid)),
      incoming: alliances.filter((a) => a.status === 'pending' && a.to === me).map((a) => ({ allianceId: a.id, ...other(a) })),
      outgoing: alliances.filter((a) => a.status === 'pending' && a.from === me).map((a) => ({ allianceId: a.id, ...other(a) })),
      blocked,
      circles: [...circles].sort((a, b) => a.name.localeCompare(b.name)),
      isAdmin,
      isMod: isAdmin || role === 'moderator',
      banned,
    };
  }, [user, alliances, blocked, circles, role, banned]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSocial = () => useContext(Ctx) ?? EMPTY;
