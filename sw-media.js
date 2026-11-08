// ═══════════════════════════════════════════
//  Локальное хранение вложений на устройстве (подключается из sw.js строкой importScripts('sw-media.js'))
//  Фото и файлы из облака сохраняются в IndexedDB и дальше открываются с устройства, без нового скачивания.
//  Ролики при просмотре идут из облака потоком; целиком на устройство их скачивает фоновая догрузка (app-media.js).
//  Вытеснение при нехватке места: сначала то, что дольше всего не открывали; закреплённое (pin) не трогаем никогда.
//  Вытесненный файл оставляет метку '__ev__…': приложение по ней снимает отметку «получено», чтобы облако не стёрло последнюю копию.
// ═══════════════════════════════════════════
(function(){
  const DB = 'mc-media', DEFAULT_CAP = 500 * 1024 * 1024;
  const RE = /\/storage\/v1\/object\/(public|sign)\/attachments\//;
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  let dbp = null;
  function open() {
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('files', { keyPath: 'url' }); d.createObjectStore('idx', { keyPath: 'url' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
    });
    return dbp;
  }
  async function getFile(url) { const db = await open(); return rq(db.transaction('files').objectStore('files').get(url)); }
  async function getCap(db) {
    try { const r = await rq(db.transaction('idx').objectStore('idx').get('__cap__')); return (r && r.cap) || DEFAULT_CAP; } catch(e) { return DEFAULT_CAP; }
  }
  const isRec = x => x.url !== '__cap__' && x.url.indexOf('__ev__') !== 0;
  async function trim(db) {
    const CAP = await getCap(db);
    const all = (await rq(db.transaction('idx').objectStore('idx').getAll())).filter(isRec);
    let tot = all.reduce((s, x) => s + x.size, 0);
    if(tot <= CAP) return;
    const free = all.filter(x => !x.pin).sort((a, b) => (a.a || a.t) - (b.a || b.t)); // давно не открывали — уходят первыми
    const t = db.transaction(['files', 'idx'], 'readwrite');
    for(const x of free) {
      if(tot <= CAP * 0.9) break;
      t.objectStore('files').delete(x.url); t.objectStore('idx').delete(x.url);
      t.objectStore('idx').put({ url: '__ev__' + x.url, size: 0, t: Date.now() });
      tot -= x.size;
    }
    await done(t);
  }
  const lastTouch = new Map();
  async function touch(url) { // запоминаем, когда файл открывали в последний раз (не чаще раза в час)
    const now = Date.now();
    if(now - (lastTouch.get(url) || 0) < 3600000) return;
    lastTouch.set(url, now);
    try {
      const db = await open();
      const t = db.transaction('idx', 'readwrite'), st = t.objectStore('idx');
      const r = await rq(st.get(url));
      if(r) st.put({ ...r, a: now });
      await done(t);
    } catch(e) {}
  }
  async function putFile(url, blob, type) {
    const db = await open();
    const t = db.transaction(['files', 'idx'], 'readwrite');
    t.objectStore('files').put({ url, blob, type });
    t.objectStore('idx').put({ url, size: blob.size, t: Date.now(), a: Date.now() });
    t.objectStore('idx').delete('__ev__' + url);
    await done(t);
    await trim(db);
  }
  const inflight = new Map();
  function fetchAndStore(url) {
    if(inflight.has(url)) return inflight.get(url);
    const p = (async () => {
      const r = await fetch(url, { mode: 'cors' });
      if(!r.ok) return null;
      const blob = await r.blob();
      const type = r.headers.get('content-type') || blob.type || 'application/octet-stream';
      try { await putFile(url, blob, type); } catch(e) {}
      return { blob, type };
    })().finally(() => inflight.delete(url));
    inflight.set(url, p);
    return p;
  }
  function serve(blob, type, range) {
    const size = blob.size;
    const m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if(m) {
      let s, e;
      if(m[1] === '') { s = Math.max(0, size - parseInt(m[2], 10)); e = size - 1; }
      else { s = parseInt(m[1], 10); e = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
      if(isNaN(s) || isNaN(e) || s > e || s >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      return new Response(blob.slice(s, e + 1), { status: 206, headers: { 'Content-Type': type, 'Content-Length': String(e - s + 1), 'Content-Range': 'bytes ' + s + '-' + e + '/' + size, 'Accept-Ranges': 'bytes' } });
    }
    return new Response(blob, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
  }
  self.addEventListener('fetch', e => {
    const req = e.request;
    if(req.method !== 'GET' || !RE.test(req.url)) return;
    e.respondWith((async () => {
      try {
        const range = req.headers.get('range');
        const rec = await getFile(req.url);
        if(rec) { touch(req.url); return serve(rec.blob, rec.type, range); }
        if(range) return fetch(req); // потоковое воспроизведение ролика: из облака, без сохранения
        const got = await fetchAndStore(req.url);
        if(got) return serve(got.blob, got.type, null);
        return fetch(req);
      } catch(err) { return fetch(req); }
    })());
  });
})();
