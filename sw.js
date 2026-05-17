const CACHE = 'mc-v6';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.map(k => caches.delete(k)))
      )
    ])
  );
});

// Always fetch fresh — no caching of HTML
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener('push', e => {
  let data = { title: '🔔 Напоминание', body: 'Есть карточки на сегодня' };
  try { if (e.data) data = e.data.json(); } catch {}
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

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // If app already open — focus and switch to checklist
      for (const c of list) {
        if (c.url.includes('check-list') && 'focus' in c) {
          c.focus();
          c.postMessage({ type: 'OPEN_CHECKLIST' });
          return;
        }
      }
      // Otherwise open app on checklist
      return clients.openWindow('https://vales-chayv.github.io/check-list/?view=checklist');
    })
  );
});
