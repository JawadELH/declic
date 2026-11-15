/* Service worker Firebase Cloud Messaging.
 * La configuration Firebase est passée en paramètres d'URL lors de l'enregistrement
 * (voir src/lib/messaging.js), ce qui évite de la dupliquer ici. */
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js');

const params = Object.fromEntries(new URL(self.location.href).searchParams);
firebase.initializeApp(params);
const messaging = firebase.messaging();

// Les messages « notification » + webpush.fcmOptions.link sont affichés automatiquement.
// Messages « data » seuls (repli) : on les affiche nous-mêmes, sans son ni vibration.
messaging.onBackgroundMessage((payload) => {
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
