/* Service worker Firebase Cloud Messaging.
 * La configuration Firebase est passée en paramètres d'URL lors de l'enregistrement
 * (voir src/lib/messaging.js), ce qui évite de la dupliquer ici. */

/* ---------- Mode hors ligne : coquille de l'application en cache ---------- */
const CACHE = 'declic-v1.2.0';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon-192.png']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('declic-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return; // Firebase, Google… : jamais intercepté
  if (req.mode === 'navigate') {
    // Réseau d'abord (pour avoir la dernière version), cache si hors ligne.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    // Fichiers versionnés : cache d'abord.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

/* ---------- Notifications push ---------- */
let messaging = null;
try {
  importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js');
  const params = Object.fromEntries(new URL(self.location.href).searchParams);
  if (params.apiKey) {
    firebase.initializeApp(params);
    messaging = firebase.messaging();
  }
} catch {
  // Hors ligne au premier chargement : le cache fonctionne quand même, le push reviendra au prochain démarrage.
}

// Les messages « notification » + webpush.fcmOptions.link sont affichés automatiquement.
// Messages « data » seuls (repli) : on les affiche nous-mêmes, sans son ni vibration.
messaging?.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const { title, body, link } = payload.data || {};
  if (!title) return;
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: true,
    data: { link: link || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  const link = event.notification?.data?.link || event.notification?.data?.FCM_MSG?.fcmOptions?.link;
  if (!link) return;
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(link);
          return c.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
