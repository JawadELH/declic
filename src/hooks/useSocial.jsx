// Contexte social : alliés, demandes, cercles, blocages, rôles.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAppData } from './useAppData.jsx';
import { isAdminUser, DAY } from '../../shared/index.js';
import { useToast } from '../components/Toast.jsx';
import { buzz } from '../lib/ui.js';
import { toMillis } from '../lib/format.js';

const Ctx = createContext(null);
const EMPTY = { allies: [], incoming: [], outgoing: [], allyIds: new Set(), blocked: new Set(), circles: [], isAdmin: false, isMod: false, banned: false, cheersWeek: 0 };

export function SocialProvider({ children }) {
  const { user } = useAppData();
  const [alliances, setAlliances] = useState([]);
  const [blocked, setBlocked] = useState(new Set());
  const [circles, setCircles] = useState([]);
  const [role, setRole] = useState(null);
  const [banned, setBanned] = useState(false);
  const [mine, setMine] = useState(null); // null = pas encore chargé
  const toast = useToast();
  const lastTotal = useRef(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const off = [
      onSnapshot(query(collection(db, 'alliances'), where('members', 'array-contains', uid)), (s) => setAlliances(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(collection(db, 'users', uid, 'blocked'), (s) => setBlocked(new Set(s.docs.map((d) => d.id))), () => {}),
      onSnapshot(query(collection(db, 'circles'), where('members', 'array-contains', uid)), (s) => setCircles(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(doc(db, 'roles', uid), (s) => setRole(s.data()?.role ?? null), () => {}),
      onSnapshot(doc(db, 'bans', uid), (s) => setBanned(s.exists()), () => {}),
      // Mes événements dans le groupe : pour compter (et fêter) les bravos reçus.
      onSnapshot(query(collection(db, 'activity'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(30)), (s) => setMine(s.docs.map((d) => d.data())), () => {}),
    ];
    return () => off.forEach((f) => f());
  }, [user]);

  // Reconnaissance sociale en direct : un petit signal quand le groupe applaudit.
  const total = mine ? mine.reduce((a, x) => a + (x.cheers ?? 0), 0) : null;
  useEffect(() => {
    if (total === null) return;
    if (lastTotal.current !== null && total > lastTotal.current) {
      const n = total - lastTotal.current;
      toast(n > 1 ? `${n} personnes viennent d’applaudir ta victoire` : 'Quelqu’un vient d’applaudir ta victoire');
      buzz([15, 30, 15]);
    }
    lastTotal.current = total;
  }, [total, toast]);
  const cheersWeek = (mine ?? []).filter((x) => Date.now() - toMillis(x.createdAt) < 7 * DAY).reduce((a, x) => a + (x.cheers ?? 0), 0);

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
      cheersWeek,
    };
  }, [user, alliances, blocked, circles, role, banned, cheersWeek]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSocial = () => useContext(Ctx) ?? EMPTY;
