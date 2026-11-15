// Notifications push (Firebase Cloud Messaging).
// La permission n'est JAMAIS demandée automatiquement : uniquement après un clic explicite.
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { app, db, firebaseConfig } from '../firebase.js';

async function registerSW() {
  const params = new URLSearchParams(Object.entries(firebaseConfig).filter(([, v]) => v));
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);
}

export async function pushSupported() {
  try {
    return 'Notification' in window && 'serviceWorker' in navigator && (await isSupported());
  } catch {
    return false;
  }
}

/** Demande la permission, récupère le jeton et l'enregistre. Renvoie 'granted' | 'denied' | 'default' | 'unsupported'. */
export async function enablePush(uid) {
  if (!(await pushSupported())) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  const registration = await registerSW();
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token), 'notifPrefs.push': true });
  return 'granted';
}

export async function disablePush(uid) {
  await updateDoc(doc(db, 'users', uid), { 'notifPrefs.push': false });
}

/** Messages reçus quand l'app est au premier plan : on affiche un simple toast. */
export async function listenForeground(callback) {
  if (!(await pushSupported()) || Notification.permission !== 'granted') return () => {};
  return onMessage(getMessaging(app), (payload) => callback(payload.notification ?? payload.data ?? {}));
}
