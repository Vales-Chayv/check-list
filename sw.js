const CACHE = 'mc-v6';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Всегда загружать свежее с сервера
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener('push', e => {
  let data = {title:'🔔 Напоминания', body:'Есть карточки на сегодня'};
  try { if(e.data) data = e.data.json(); } catch{}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'https://vales-chayv.github.io/check-list/icon-192.png',
    tag: 'reminders', renotify: true,
    data: {url: 'https://vales-chayv.github.io/check-list/'}
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    for(const c of list) if(c.url.includes('check-list') && 'focus' in c) return c.focus();
    return clients.openWindow('https://vales-chayv.github.io/check-list/?view=checklist');
  }));
});
