// ═══════════════════════════════════════════
//  СЖАТИЕ ВЛОЖЕНИЙ И ЛИМИТЫ (перед загрузкой в облако)
//  Подключается после app-config.js и оборачивает uploadToStorage.
//  Все загрузки в приложении идут через uploadToStorage, поэтому правила действуют везде.
// ═══════════════════════════════════════════
const MC_IMG_MAX = 1920;            // длинная сторона фото, px
const MC_IMG_QUALITY = 0.82;        // качество JPEG
const MC_IMG_SKIP = 350 * 1024;     // меньше — не трогаем
const MC_MB = 1024 * 1024;
const MC_LIMITS = { video: 40 * MC_MB, audio: 15 * MC_MB, image: 30 * MC_MB, other: 20 * MC_MB };

async function mcCompressImage(file) {
  if(!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) return file; // gif, svg, heic оставляем как есть
  if(file.size <= MC_IMG_SKIP) return file;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch(e) { return file; }
  try {
    const k = Math.min(1, MC_IMG_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', MC_IMG_QUALITY));
    if(!blob || blob.size >= file.size) return file;
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch(e) { return file; }
  finally { try { bmp.close(); } catch(_) {} }
}

async function mcPrepareFile(file) {
  const t = file.type || '';
  if(t.startsWith('image/')) file = await mcCompressImage(file);
  const kind = t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : t.startsWith('image/') ? 'image' : 'other';
  const lim = MC_LIMITS[kind];
  if(file.size > lim) {
    const mb = Math.round(lim / MC_MB);
    const names = { video: 'Ролик', audio: 'Аудио', image: 'Фото', other: 'Файл' };
    setTimeout(() => { try { toast(names[kind] + ' слишком большой: максимум ' + mb + ' МБ', true); } catch(_) {} }, 400);
    throw new Error('file_too_big');
  }
  return file;
}

// оборачиваем загрузку: сначала сжимаем и проверяем размер, потом грузим
const mcOrigUpload = uploadToStorage;
uploadToStorage = async function(file, cardId, entryId) {
  file = await mcPrepareFile(file);
  const att = await mcOrigUpload(file, cardId, entryId);
  if(att && typeof att === 'object' && !att.ts) att.ts = Date.now(); // время загрузки: нужно для галереи
  return att;
};

// ═══════════════════════════════════════════
//  ЛОКАЛЬНАЯ КОПИЯ ВЛОЖЕНИЙ (работает вместе с sw-media.js в service worker)
//  Фоновая «прогревка»: фото из карточек и чатов скачиваются на устройство один раз.
// ═══════════════════════════════════════════
const MC_ATT_RE = /\/storage\/v1\/object\/(public|sign)\/attachments\//;
const _mcWarmed = new Set();
function mcMediaDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('mc-media', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('files', { keyPath: 'url' }); d.createObjectStore('idx', { keyPath: 'url' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
// сколько места занимают сохранённые на устройстве вложения (байты)
function mcGalCfg() {
  const d = { videosWifi: false, photosAuto: true, capMB: 500 };
  try { return Object.assign(d, JSON.parse(localStorage.getItem('mc_gal_cfg') || '{}')); } catch(e) { return d; }
}
// лимит места на устройстве: записываем туда, откуда его читает service worker
async function mcApplyCap() {
  try {
    const db = await mcMediaDb();
    const t = db.transaction('idx', 'readwrite');
    t.objectStore('idx').put({ url: '__cap__', size: 0, t: 0, cap: mcGalCfg().capMB * 1024 * 1024 });
  } catch(e) {}
}
async function mcMediaUsage() {
  try {
    const db = await mcMediaDb();
    const all = (await new Promise((res, rej) => { const q = db.transaction('idx').objectStore('idx').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })).filter(x => x.url !== '__cap__');
    return { files: all.length, bytes: all.reduce((s, x) => s + x.size, 0) };
  } catch(e) { return { files: 0, bytes: 0 }; }
}
async function mcWarmMedia() {
  try {
    if(!navigator.onLine || document.hidden || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    if(typeof cards === 'undefined' || typeof cardAttsOf !== 'function') return;
    const cfg = mcGalCfg();
    const conn = navigator.connection;
    const onWifi = !conn || !conn.type || conn.type === 'wifi' || conn.type === 'ethernet';
    const urls = [];
    (cards || []).forEach(c => cardAttsOf(c).forEach(a => {
      const u = String(a.data || '');
      if(!MC_ATT_RE.test(u) || _mcWarmed.has(u)) return;
      const vid = (a.type || '').startsWith('video/');
      if(vid ? !(cfg.videosWifi && onWifi) : !cfg.photosAuto) return;
      urls.push(u);
    }));
    for(const u of urls.slice(0, 40)) {
      _mcWarmed.add(u);
      try { const r = await fetch(u, { mode: 'cors' }); await r.arrayBuffer(); } catch(e) { _mcWarmed.delete(u); }
    }
  } catch(e) {}
}
setInterval(mcWarmMedia, 25000);
setTimeout(mcWarmMedia, 6000);
setTimeout(mcApplyCap, 1500);
