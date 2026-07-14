const CACHE = 'mc-v75';
const APP_FILES = [
  '/check-list/',
  '/check-list/index.html',
  '/check-list/style.css',
  '/check-list/app-config.js',
  '/check-list/app-i18n.js',
  '/check-list/app-auth.js',
  '/check-list/app-spaces.js',
  '/check-list/app-db.js',
  '/check-list/app-render.js',
  '/check-list/app-view.js',
  '/check-list/app-edit.js',
  '/check-list/app-archive.js',
  '/check-list/app-settings.js',
  '/check-list/app-init.js',
  '/check-list/app-utils.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_FILES).catch(()=>{}))
  );
});
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase API — network only, no cache
  if(url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(()=>new Response('{}',{headers:{'Content-Type':'application/json'}})));
    return;
  }
  // App files — cache first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if(res.ok) { const clone = res.clone(); caches.open(CACHE).then(c=>c.put(e.request,clone)); }
return res;
      }).catch(()=>cached);
      return cached || network.catch(()=>new Response('', {status: 404}));
    })
  );
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
