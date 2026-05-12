const CACHE = 'mc-v4';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// Handle push notifications
self.addEventListener('push', e => {
  let data = { title: '🔔 Напоминание', body: 'Есть карточки на сегодня' };
  try {
    if (e.data) data = e.data.json();
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://vales-chayv.github.io/check-list/icon-192.png',
      badge: 'https://vales-chayv.github.io/check-list/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'reminders',
      renotify: true,
      data: { url: 'https://vales-chayv.github.io/check-list/' }
    })
  );
});

// Open app on notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('check-list') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('https://vales-chayv.github.io/check-list/');
    })
  );
});
