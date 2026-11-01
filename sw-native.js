// Облегчённый воркер для APK: только локальное хранение вложений (sw-media.js).
// Файлы сайта он не кэширует, поэтому не мешает автообновлению встроенной копии.
importScripts('sw-media.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
