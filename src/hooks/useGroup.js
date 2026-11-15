// Abonnements temps réel du groupe.
import { useEffect, useState } from 'react';
import { collection, doc, getCountFromServer, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { dayKey, MINUTE } from '../../shared/index.js';

/** Compteur collectif des envies battues aujourd'hui. */
export function usePulse() {
  const [n, setN] = useState(0);
  useEffect(() => onSnapshot(doc(db, 'pulse', dayKey(Date.now())), (s) => setN(s.data()?.resisted ?? 0), () => {}), []);
  return n;
}

/** Nombre de membres actifs ces 5 dernières minutes (rafraîchi chaque minute). */
export function useOnline() {
  const [n, setN] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getCountFromServer(query(collection(db, 'presence'), where('lastSeen', '>', Date.now() - 5 * MINUTE)))
        .then((r) => alive && setN(r.data().count))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return n;
}

/** SOS en cours (non expirés, non terminés). */
export function useOpenSos() {
  const [list, setList] = useState([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'sos'), where('expiresAt', '>', Date.now() - MINUTE), orderBy('expiresAt', 'asc'), limit(10)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {},
      ),
    [],
  );
  return { list: list.filter((x) => x.status === 'open' && x.expiresAt > now), now };
}

/** Fil d'activité en direct. */
export function useActivity(size = 40) {
  const [items, setItems] = useState(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(size)),
        (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setItems([]),
      ),
    [size],
  );
  return items;
}

/** Document du défi du jour. */
export function useChallengeCount(key) {
  const [n, setN] = useState(0);
  useEffect(() => onSnapshot(doc(db, 'challenges', key), (s) => setN(s.data()?.count ?? 0), () => {}), [key]);
  return n;
}

/** Un SOS précis + les personnes qui envoient de la force (pour l'auteur, pendant sa respiration). */
export function useSosSupport(sosId) {
  const [supporters, setSupporters] = useState([]);
  useEffect(() => {
    if (!sosId) return;
    return onSnapshot(
      query(collection(db, 'sos', sosId, 'force'), limit(20)),
      (s) => setSupporters(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
  }, [sosId]);
  return supporters;
}
