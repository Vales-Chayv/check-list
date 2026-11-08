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
  if(t.startsWith('video/') && typeof window.mcCompressVideo === 'function') { try { file = await window.mcCompressVideo(file); } catch(e) {} } // сжатие видео работает только в APK
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
  const _capKey = mcCapKey(file), _capId = _mcCapPend.get(_capKey); // если это снимок из камеры приложения — у него есть оригинал в 💎
  file = await mcPrepareFile(file);
  const _vid = (file.type || '').startsWith('video/') && typeof window.mcNativeStatus === 'function';
  const _t0 = Date.now();
  const _say = () => window.mcNativeStatus('⬆ Отправляю ролик (' + (file.size / MC_MB).toFixed(1) + ' МБ)… ' + Math.round((Date.now() - _t0) / 1000) + ' с');
  let _tm = null;
  if(_vid) { _say(); _tm = setInterval(_say, 1000); }
  let att;
  try {
    att = await Promise.race([mcOrigUpload(file, cardId, entryId), new Promise((_, rej) => setTimeout(() => rej(new Error('отправка заняла больше 5 минут')), 5 * 60000))]);
  } catch(e) {
    if(_tm) clearInterval(_tm);
    if(_vid) { window.mcNativeStatus('⚠ Отправка: ' + String((e && e.message) || e).slice(0, 120)); setTimeout(() => window.mcNativeStatus(null), 6000); }
    throw e;
  }
  if(_tm) clearInterval(_tm);
  if(_vid) window.mcNativeStatus(null);
  if(att && typeof att === 'object' && !att.ts) att.ts = Date.now(); // время загрузки: нужно для галереи
  try { if(att && att.data && MC_ATT_RE.test(String(att.data))) mcCacheOwn(String(att.data), file).catch(() => {}); } catch(e) {}
  try { if(_capId && att && att.data && MC_ATT_RE.test(String(att.data))) { _mcCapPend.delete(_capKey); mcVaultLink(_capId, String(att.data)).catch(() => {}); } } catch(e) {}
  try { // у отправителя файл уже есть: отмечаем получение сразу
    const p = att && mcPathOf(att.data);
    if(p && typeof currentUser !== 'undefined' && currentUser && currentUser.id) sb.from('attachment_receipts').upsert([{ path: p, user_id: currentUser.id }], { onConflict: 'path,user_id', ignoreDuplicates: true }).then(() => {}, () => {});
  } catch(e) {}
  return att;
};

// ═══════════════════════════════════════════
//  ЛОКАЛЬНАЯ КОПИЯ ВЛОЖЕНИЙ (работает вместе с sw-media.js в service worker)
//  Фоновая «прогревка»: фото из карточек и чатов скачиваются на устройство один раз.
// ═══════════════════════════════════════════
const MC_ATT_RE = /\/storage\/v1\/object\/(public|sign)\/attachments\//;
const MC_DANGER_DAYS = 46;          // облако стирает файлы через 60 дней: с этого возраста файл «под угрозой» — его скачиваем в первую очередь и закрепляем
const _mcWarmed = new Set();        // эти файлы за текущий сеанс уже пробовали скачать
const _mcGone = new Set();          // в облаке этих файлов уже нет
const mcIsRec = x => x.url !== '__cap__' && x.url.indexOf('__ev__') !== 0; // служебные записи в списке файлов: лимит и метки вытеснения
function mcMediaDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('mc-media', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('files', { keyPath: 'url' }); d.createObjectStore('idx', { keyPath: 'url' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function mcIdxAll() {
  const db = await mcMediaDb();
  return new Promise((res, rej) => { const q = db.transaction('idx').objectStore('idx').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
// дописать поля (например pin) в записи файлов
async function mcIdxPatch(urls, patch) {
  if(!urls.length) return;
  const db = await mcMediaDb();
  await new Promise((res) => {
    const t = db.transaction('idx', 'readwrite'), st = t.objectStore('idx');
    urls.forEach(u => { const g = st.get(u); g.onsuccess = () => { if(g.result) st.put({ ...g.result, ...patch }); }; });
    t.oncomplete = t.onerror = t.onabort = () => res();
  });
}
function mcGalCfg() {
  const d = { videosWifi: true, photosAuto: true, capMB: 500 };
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
// сколько места занимают сохранённые на устройстве вложения (байты); pinned — закреплённые (последние копии, не вытесняются)
async function mcMediaUsage() {
  try {
    const all = (await mcIdxAll()).filter(mcIsRec);
    const pin = all.filter(x => x.pin);
    return { files: all.length, bytes: all.reduce((s, x) => s + x.size, 0), pinned: pin.length, pinnedBytes: pin.reduce((s, x) => s + x.size, 0) };
  } catch(e) { return { files: 0, bytes: 0, pinned: 0, pinnedBytes: 0 }; }
}
// все вложения карточки (карточка, записи, файлы сеанса)
function mcAttsOfCard(c) {
  const out = [], add = a => { if(a && a.data) out.push(a); };
  (c.attachments || []).forEach(add);
  (c.entries || []).forEach(e => { (e.attachments || []).forEach(add); (e.sessionAtts || []).forEach(add); });
  return out;
}
// карточки всех кабинетов: из памяти устройства, открытого кабинета и (раз в 30 минут) с сервера
let _mcRemote = { t: 0, cards: [] };
async function mcAllCardsForMedia(force) {
  const map = new Map();
  try { if(typeof local !== 'undefined') (await local.getAll('cards')).forEach(c => map.set(c.id, c)); } catch(e) {}
  _mcRemote.cards.forEach(c => map.set(c.id, c));
  (typeof cards !== 'undefined' ? cards : []).forEach(c => map.set(c.id, c));
  if(navigator.onLine && typeof sb !== 'undefined' && typeof spaces !== 'undefined' && spaces.length && (force || Date.now() - _mcRemote.t > 30 * 60000)) {
    _mcRemote.t = Date.now();
    try {
      const { data } = await sb.from('cards').select('*').in('space_id', spaces.map(s => s.id));
      if(data) { _mcRemote.cards = data; data.forEach(c => { if(!map.has(c.id)) map.set(c.id, c); }); }
    } catch(e) {}
  }
  return [...map.values()];
}

// Догрузка файлов на устройство. Сначала те, которым меньше всего осталось жить в облаке; такие файлы закрепляются.
let _mcWarmBusy = false;
async function mcWarmMedia(force) {
  if(_mcWarmBusy) return;
  _mcWarmBusy = true;
  try {
    if(!navigator.onLine || (document.hidden && force !== true) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    await mcSyncEvictions();
    const cfg = mcGalCfg(), conn = navigator.connection || {};
    const cell = conn.type === 'cellular' || conn.saveData === true;
    const wifiLoose = !cell && (!conn.type || conn.type === 'wifi' || conn.type === 'ethernet');
    const idx = (await mcIdxAll()).filter(mcIsRec);
    const info = new Map(idx.map(x => [x.url, x]));
    let used = idx.reduce((s, x) => s + x.size, 0);
    const cap = cfg.capMB * 1024 * 1024, now = Date.now();
    const list = [], seen = new Set();
    (await mcAllCardsForMedia(force === true)).forEach(c => {
      const base = Date.parse(c.created_at || '') || 0;
      mcAttsOfCard(c).forEach(a => {
        const u = String(a.data || '');
        if(!MC_ATT_RE.test(u) || seen.has(u)) return;
        seen.add(u);
        const age = (now - (a.ts || base || now)) / 864e5;
        list.push({ u, vid: (a.type || '').startsWith('video/'), size: a.size || 0, age, urgent: age >= MC_DANGER_DAYS });
      });
    });
    // уже сохранённые файлы, которым осталось мало: закрепляем
    await mcIdxPatch(list.filter(x => x.urgent && info.has(x.u) && !info.get(x.u).pin).map(x => x.u), { pin: true });
    // что скачивать
    const todo = list.filter(x => !info.has(x.u) && !_mcWarmed.has(x.u) && !_mcGone.has(x.u)).filter(x => {
      if(x.urgent) return x.vid ? (force === true || !cell) : true;
      if(x.vid ? !(cfg.videosWifi && wifiLoose) : !cfg.photosAuto) return false;
      return used + x.size <= cap * 0.8; // обычные файлы не заполняют память больше чем на 80%: иначе они вытесняли бы друг друга по кругу
    }).sort((a, b) => (b.urgent - a.urgent) || (b.age - a.age));
    const got = [];
    for(const x of todo.slice(0, 30)) {
      _mcWarmed.add(x.u);
      try {
        const r = await fetch(x.u, { mode: 'cors' });
        if(r.status === 404 || r.status === 400) { _mcGone.add(x.u); continue; }
        if(!r.ok) { _mcWarmed.delete(x.u); continue; }
        await r.arrayBuffer();
        used += x.size; got.push(x);
      } catch(e) { _mcWarmed.delete(x.u); }
    }
    await mcIdxPatch(got.filter(x => x.urgent).map(x => x.u), { pin: true });
    // сколько файлов под угрозой и ещё не сохранено здесь
    const have = new Set((await mcIdxAll()).filter(mcIsRec).map(x => x.url));
    window._mcDanger = list.filter(x => x.urgent && !have.has(x.u) && !_mcGone.has(x.u)).length;
    await mcStorageNotice();
  } catch(e) {}
  finally { _mcWarmBusy = false; }
}
setInterval(mcWarmMedia, 25000);
setTimeout(mcWarmMedia, 6000);
setTimeout(mcApplyCap, 1500);
try { if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e) {} // просим браузер не чистить хранилище самому

// ═══════════════════════════════════════════
//  СЧЁТЧИКИ И ПРЕДУПРЕЖДЕНИЯ О ПАМЯТИ
// ═══════════════════════════════════════════
async function mcStorageStatus() {
  const u = await mcMediaUsage(), cap = mcGalCfg().capMB * 1024 * 1024;
  let dev = null;
  try { const e = await navigator.storage.estimate(); dev = { quota: e.quota, usage: e.usage }; } catch(_) {}
  return { bytes: u.bytes, files: u.files, pinned: u.pinned, pinnedBytes: u.pinnedBytes, cap, pct: cap ? u.bytes / cap : 0, danger: window._mcDanger || 0, dev };
}
function mcWarnOnce(key, msg) { // каждое предупреждение — не чаще раза в сутки
  try {
    const m = JSON.parse(localStorage.getItem('mc_warn') || '{}');
    if(Date.now() - (m[key] || 0) < 864e5) return;
    m[key] = Date.now(); localStorage.setItem('mc_warn', JSON.stringify(m));
  } catch(e) {}
  try { toast(msg, true); } catch(e) {}
}
async function mcStorageNotice() {
  const st = await mcStorageStatus(), mb = b => Math.round(b / 1048576);
  if(st.danger > 0) mcWarnOnce('danger', '⚠ ' + st.danger + ' файл(ов) скоро исчезнут из облака и ещё не сохранены на этом устройстве. Зайди в Галерею — там кнопка «Сохранить сейчас».');
  if(st.pct >= 0.95) mcWarnOnce('cap95', '🔴 Память приложения почти заполнена: ' + mb(st.bytes) + ' из ' + mb(st.cap) + ' МБ. Увеличь лимит в Галерее (⚙) или сделай резервную копию.');
  else if(st.pct >= 0.8) mcWarnOnce('cap80', '🟡 Память приложения заполнена на ' + Math.round(st.pct * 100) + '% (' + mb(st.bytes) + ' из ' + mb(st.cap) + ' МБ).');
  try { const v = await mcVaultStats(); if(v.bytes >= 1536 * 1048576) mcWarnOnce('vault', '💎 Оригиналы занимают ' + (v.bytes / 1073741824).toFixed(1) + ' ГБ на устройстве. Сделай резервную копию и освободи место (скоро появится кнопка в Галерее).'); } catch(e) {}
  if(st.dev && st.dev.quota && st.dev.quota - st.dev.usage < 300 * 1048576) mcWarnOnce('dev', '🔴 На устройстве заканчивается свободное место: осталось ' + mb(st.dev.quota - st.dev.usage) + ' МБ.');
}

// ═══════════════════════════════════════════
//  ЗАЩИТА ПОСЛЕДНЕЙ КОПИИ
//  Облако стирает файл, когда все получатели его забрали. Поэтому, если файл убрали с устройства
//  (кэш вытеснил или пользователь удалил), отметка «получено» снимается — тогда облако его не стирает.
// ═══════════════════════════════════════════
async function mcRetract(urls) {
  try {
    if(typeof sb === 'undefined' || typeof currentUser === 'undefined' || !currentUser || !currentUser.id || !navigator.onLine) return false;
    const paths = urls.map(mcPathOf).filter(Boolean);
    for(let i = 0; i < paths.length; i += 100) {
      const { error } = await sb.from('attachment_receipts').delete().eq('user_id', currentUser.id).in('path', paths.slice(i, i + 100));
      if(error) { console.log('retract error:', error.message); return false; }
    }
    return true;
  } catch(e) { return false; }
}
async function mcSyncEvictions() {
  try {
    const db = await mcMediaDb();
    const ev = (await mcIdxAll()).filter(x => x.url.indexOf('__ev__') === 0).slice(0, 200);
    if(!ev.length) return;
    if(!(await mcRetract(ev.map(x => x.url.slice(6))))) return;
    const t = db.transaction('idx', 'readwrite');
    ev.forEach(x => t.objectStore('idx').delete(x.url));
  } catch(e) {}
}
// есть ли файл ещё в облаке: dead — нет, unknown — не удалось проверить
async function mcCloudCheck(urls) {
  const dead = [], unknown = [];
  let i = 0;
  const worker = async () => {
    while(i < urls.length) {
      const u = urls[i++];
      if(!MC_ATT_RE.test(u)) continue;
      try {
        const r = await fetch(u, { method: 'HEAD', mode: 'cors', cache: 'no-store' });
        if(r.status === 404 || r.status === 400) dead.push(u); else if(!r.ok) unknown.push(u);
      } catch(e) { unknown.push(u); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, urls.length) }, worker));
  return { dead, unknown };
}
// у отправителя свой файл должен сразу лежать на устройстве (отметку «получено» мы ему ставим сразу)
async function mcCacheOwn(url, file) {
  const db = await mcMediaDb();
  const t = db.transaction(['files', 'idx'], 'readwrite');
  t.objectStore('files').put({ url, blob: file, type: file.type || 'application/octet-stream' });
  t.objectStore('idx').put({ url, size: file.size, t: Date.now(), a: Date.now(), rep: true });
  t.objectStore('idx').delete('__ev__' + url);
}

// ═══════════════════════════════════════════
//  ОТМЕТКИ «ФАЙЛ ПОЛУЧЕН НА УСТРОЙСТВО»
//  Когда файл сохранился на устройстве, в таблицу attachment_receipts пишется «этот пользователь его получил».
//  Ночная очистка стирает файл из облака, когда его получили все участники (см. функцию cleanup-attachments).
// ═══════════════════════════════════════════
function mcPathOf(url) {
  const u = String(url || '');
  if(!MC_ATT_RE.test(u)) return null;
  try { return decodeURIComponent(u.split('/attachments/')[1].split('?')[0]); } catch(e) { return null; }
}
async function mcReportReceipts() {
  try {
    if(!navigator.onLine || typeof sb === 'undefined' || typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;
    const all = await mcIdxAll();
    const fresh = all.filter(x => mcIsRec(x) && !x.rep && mcPathOf(x.url)).slice(0, 200);
    if(!fresh.length) return;
    const rows = fresh.map(x => ({ path: mcPathOf(x.url), user_id: currentUser.id }));
    const { error } = await sb.from('attachment_receipts').upsert(rows, { onConflict: 'path,user_id', ignoreDuplicates: true });
    if(error) { console.log('receipts error:', error.message); return; }
    await mcIdxPatch(fresh.map(x => x.url), { rep: true });
  } catch(e) {}
}
setInterval(mcReportReceipts, 60000);
setTimeout(mcReportReceipts, 12000);

// файл удалён из облака (срок вышел) и на этом устройстве его нет: вместо «битой» картинки показываем заглушку
const MC_GONE_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#2a2a2a"/><g fill="none" stroke="#8a8a8a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M70 150a26 26 0 0 1-3-51.8A34 34 0 0 1 132 90a28 28 0 0 1 6 60z"/><path d="M100 112l40 40M140 112l-40 40" stroke="#c85a5a"/></g><text x="120" y="196" font-size="15" fill="#aaa" text-anchor="middle" font-family="sans-serif">Файл удалён из облака</text></svg>');
document.addEventListener('error', e => {
  const el = e.target;
  if(!el || el.tagName !== 'IMG' || el.dataset.gone) return;
  if(!MC_ATT_RE.test(el.currentSrc || el.src || '')) return;
  el.dataset.gone = '1';
  el.src = MC_GONE_IMG;
  el.title = 'Файл удалён из облака и не был сохранён на этом устройстве';
}, true);

// ═══════════════════════════════════════════
//  ХРАНИЛИЩЕ ОРИГИНАЛОВ (💎)
//  Снимки и ролики, снятые камерой внутри приложения, можно оставить на устройстве в исходном качестве,
//  а в облако отправить сжатую копию. Оригиналы лежат в отдельной базе 'mc-vault' и сами никогда не удаляются.
//  meta — описание (быстро читается), orig — сам файл.
// ═══════════════════════════════════════════
let _mcVaultP = null;
function mcVaultDb() {
  if(_mcVaultP) return _mcVaultP;
  _mcVaultP = new Promise((res, rej) => {
    const r = indexedDB.open('mc-vault', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('orig', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'id' }).createIndex('url', 'url');
    };
    r.onsuccess = () => res(r.result); r.onerror = () => { _mcVaultP = null; rej(r.error); };
  });
  return _mcVaultP;
}
const _mcIdb = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const _mcTx = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
async function mcVaultPut(file, kind) {
  const db = await mcVaultDb(), id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const t = db.transaction(['orig', 'meta'], 'readwrite');
  t.objectStore('orig').put({ id, blob: file });
  t.objectStore('meta').put({ id, name: file.name || (kind === 'video' ? 'video' : 'photo'), type: file.type || '', size: file.size, ts: Date.now(), kind: kind || '', url: null });
  await _mcTx(t);
  return id;
}
async function mcVaultLink(id, url) {
  const db = await mcVaultDb();
  const t = db.transaction('meta', 'readwrite'), st = t.objectStore('meta');
  const r = await _mcIdb(st.get(id));
  if(r) st.put({ ...r, url });
  await _mcTx(t);
}
async function mcVaultMeta() {
  try { const db = await mcVaultDb(); return await _mcIdb(db.transaction('meta').objectStore('meta').getAll()); } catch(e) { return []; }
}
async function mcVaultStats() {
  const m = await mcVaultMeta();
  return { count: m.length, bytes: m.reduce((s, x) => s + (x.size || 0), 0) };
}
async function _mcVaultFile(db, id, m) {
  const o = await _mcIdb(db.transaction('orig').objectStore('orig').get(id));
  return o ? new File([o.blob], m.name, { type: m.type || o.blob.type }) : null;
}
// оригинал по адресу копии в облаке (или null)
async function mcVaultBlobByUrl(url) {
  try {
    if(!url || !MC_ATT_RE.test(url)) return null;
    const db = await mcVaultDb();
    const m = await _mcIdb(db.transaction('meta').objectStore('meta').index('url').get(url));
    return m ? await _mcVaultFile(db, m.id, m) : null;
  } catch(e) { return null; }
}
window.mcVaultBlobByUrl = mcVaultBlobByUrl;
// все оригиналы в виде {url, name} для «Сохранить в ZIP»
async function mcVaultAllItems() {
  const db = await mcVaultDb(), out = [];
  for(const m of await mcVaultMeta()) {
    const f = await _mcVaultFile(db, m.id, m);
    if(f) out.push({ url: URL.createObjectURL(f), name: m.name });
  }
  setTimeout(() => out.forEach(x => { try { URL.revokeObjectURL(x.url); } catch(e) {} }), 20 * 60000);
  return out;
}

// ── Вопрос после съёмки ──
const _mcCapPend = new Map(); // ключ файла → id оригинала, пока файл не загрузился в облако
const mcCapKey = f => (f.name || '') + '|' + f.size + '|' + f.lastModified;
function mcCapMode() { try { return localStorage.getItem('mc_cap_mode') || 'ask'; } catch(e) { return 'ask'; } }
function mcCapAsk(kind, file) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:inherit';
    const mb = (file.size / 1048576).toFixed(1);
    const b = 'width:100%;border-radius:12px;padding:13px 12px;font-size:14px;cursor:pointer;font-family:inherit;text-align:left;line-height:1.35;border:1px solid #555;background:#2a2a2a;color:#eee';
    ov.innerHTML = '<div style="background:#1c1c1c;color:#eee;border-radius:16px;padding:18px 16px;max-width:380px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.6)">' +
      '<div style="font-size:16px;font-weight:700;margin-bottom:4px">' + (kind === 'video' ? '🎥 Ролик снят' : '📷 Снимок сделан') + ' · ' + mb + ' МБ</div>' +
      '<div style="font-size:12px;opacity:.7;margin-bottom:12px">В облако всегда уходит сжатая копия (фото до 1920 px). Что сделать с оригиналом?</div>' +
      '<button id="mc-cap-o" style="' + b + ';background:#B8892B;color:#111;border-color:#B8892B;font-weight:600;margin-bottom:8px">💎 Оставить оригинал на устройстве<br><span style="font-weight:400;font-size:12px">и отправить сжатую копию</span></button>' +
      '<button id="mc-cap-s" style="' + b + '">☁ Только сжатая копия<br><span style="opacity:.7;font-size:12px">оригинал не сохранять</span></button>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;opacity:.85"><input type="checkbox" id="mc-cap-r"> Запомнить выбор (меняется в Галерее ⚙)</label></div>';
    document.body.appendChild(ov);
    const fin = mode => { const r = ov.querySelector('#mc-cap-r').checked; ov.remove(); resolve({ mode, remember: r }); };
    ov.querySelector('#mc-cap-o').onclick = () => fin('orig');
    ov.querySelector('#mc-cap-s').onclick = () => fin('small');
  });
}
// вызывается для каждого снимка/ролика, снятого через камеру приложения
async function mcCapFlow(kind, file, deliver) {
  try {
    let mode = mcCapMode();
    if(mode === 'ask') {
      const r = await mcCapAsk(kind, file);
      mode = r.mode;
      if(r.remember) { try { localStorage.setItem('mc_cap_mode', mode); } catch(e) {} }
    }
    if(mode === 'orig') {
      try { _mcCapPend.set(mcCapKey(file), await mcVaultPut(file, kind)); }
      catch(e) { try { toast('Не удалось сохранить оригинал на устройстве (нет места?). Отправляю только копию.', true); } catch(_) {} }
    }
  } catch(e) {}
  deliver(file);
}

// ===== Камера: снимок и запись ролика =====
// Телефон: родная камера Android (input capture). ПК: своё окно с веб-камерой.
// target — id скрытого input (положим файл в него и вызовем его onchange) или функция(file)
function mcIsMobile() {
  return !!window._mcNativeApp || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}
function mcCamDeliver(target, file) {
  if (typeof target === 'function') { target(file); return; }
  const inp = document.getElementById(target);
  if (!inp) return;
  try {
    const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
  } catch (e) { toast('Не удалось передать файл: ' + e.message, true); }
}
function mcCam(kind, target) {
  // снятый файл сначала проходит через вопрос «оставить оригинал?» (mcCapFlow), потом попадает в поле загрузки
  const give = f => mcCapFlow(kind, f, x => { if (typeof target === 'function') target(x); else mcCamDeliver(target, x); });
  const useInput = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = kind === 'video' ? 'video/*' : 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = () => { if (inp.files && inp.files[0]) give(inp.files[0]); };
    inp.click();
  };
  if (mcIsMobile() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { useInput(); return; }
  mcCamOpen(kind, give, useInput);
}
function mcCamOpen(kind, onFile, onFail) {
  if (document.getElementById('mc-cam-ov')) return;
  const isVid = kind === 'video';
  const ov = document.createElement('div');
  ov.id = 'mc-cam-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;font-family:inherit;color:#eee';
  const btnCss = 'border:1px solid #555;background:#2a2a2a;color:#eee;border-radius:10px;padding:11px 20px;font-size:15px;cursor:pointer;font-family:inherit';
  ov.innerHTML =
    '<div id="mc-cam-title" style="font-size:15px;opacity:.85">' + (isVid ? '🎥 Запись видео' : '📷 Фото') + '</div>' +
    '<video id="mc-cam-live" autoplay playsinline muted style="max-width:min(92vw,900px);max-height:62vh;background:#000;border-radius:12px"></video>' +
    '<video id="mc-cam-rev" playsinline controls style="display:none;max-width:min(92vw,900px);max-height:62vh;background:#000;border-radius:12px"></video>' +
    '<img id="mc-cam-img" style="display:none;max-width:min(92vw,900px);max-height:62vh;border-radius:12px">' +
    '<div id="mc-cam-info" style="font-size:14px;min-height:20px;opacity:.85"></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
      '<select id="mc-cam-dev" style="' + btnCss + ';display:none;max-width:240px"></select>' +
      '<button id="mc-cam-go" style="' + btnCss + ';background:#B8892B;color:#111;border-color:#B8892B;font-weight:600">' + (isVid ? '⏺ Начать запись' : '📸 Снять') + '</button>' +
      '<button id="mc-cam-again" style="' + btnCss + ';display:none">↺ Переснять</button>' +
      '<button id="mc-cam-use" style="' + btnCss + ';display:none;background:#B8892B;color:#111;border-color:#B8892B;font-weight:600">✓ Использовать</button>' +
      '<button id="mc-cam-x" style="' + btnCss + '">Отмена</button>' +
    '</div>';
  document.body.appendChild(ov);
  const $ = id => ov.querySelector('#' + id);
  const live = $('mc-cam-live'), rev = $('mc-cam-rev'), img = $('mc-cam-img'), info = $('mc-cam-info');
  const go = $('mc-cam-go'), again = $('mc-cam-again'), use = $('mc-cam-use'), dev = $('mc-cam-dev');
  let stream = null, rec = null, chunks = [], result = null, timer = null, t0 = 0, closed = false, url = null;
  const MAX_SEC = 300;
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };
  function stopStream() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  function close() {
    if (closed) return; closed = true;
    clearInterval(timer);
    try { if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } } catch (e) {}
    stopStream();
    if (url) URL.revokeObjectURL(url);
    document.removeEventListener('keydown', onKey, true);
    ov.remove();
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
  document.addEventListener('keydown', onKey, true);
  async function start(deviceId) {
    stopStream();
    try {
      const v = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' };
      stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: isVid });
    } catch (e) {
      close();
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      toast(denied ? 'Нет доступа к камере. Разреши её значком 🔒 или 📷 в адресной строке браузера.' : 'Камера недоступна: ' + (e && e.message || e), true);
      if (!denied && onFail) onFail();
      return;
    }
    if (closed) { stopStream(); return; }
    live.srcObject = stream;
    try {
      const all = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (all.length > 1) {
        const cur = stream.getVideoTracks()[0].getSettings().deviceId;
        dev.innerHTML = all.map((d, i) => '<option value="' + d.deviceId + '"' + (d.deviceId === cur ? ' selected' : '') + '>' + (d.label || 'Камера ' + (i + 1)) + '</option>').join('');
        dev.style.display = '';
      }
    } catch (e) {}
  }
  dev.onchange = () => start(dev.value);
  function showResult(isVideoResult) {
    live.style.display = 'none'; go.style.display = 'none'; dev.style.display = 'none';
    again.style.display = ''; use.style.display = '';
    if (isVideoResult) { rev.style.display = ''; } else { img.style.display = ''; }
  }
  function retake() {
    result = null; info.textContent = '';
    if (url) { URL.revokeObjectURL(url); url = null; }
    rev.style.display = 'none'; img.style.display = 'none'; rev.removeAttribute('src');
    live.style.display = ''; go.style.display = ''; again.style.display = 'none'; use.style.display = 'none';
    go.textContent = isVid ? '⏺ Начать запись' : '📸 Снять'; go.dataset.rec = '';
    start(dev.value || '');
  }
  function stopRec() { clearInterval(timer); try { if (rec && rec.state === 'recording') rec.stop(); } catch (e) {} }
  go.onclick = () => {
    if (!stream) return;
    if (!isVid) {
      const c = document.createElement('canvas');
      c.width = live.videoWidth || 1280; c.height = live.videoHeight || 720;
      c.getContext('2d').drawImage(live, 0, 0, c.width, c.height);
      c.toBlob(b => {
        if (!b) { toast('Не удалось сделать снимок', true); return; }
        result = new File([b], 'photo_' + stamp() + '.jpg', { type: 'image/jpeg' });
        url = URL.createObjectURL(b); img.src = url;
        stopStream(); showResult(false);
      }, 'image/jpeg', 0.92);
      return;
    }
    if (go.dataset.rec === '1') { stopRec(); return; }
    const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mt = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    try { rec = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream); }
    catch (e) { toast('Запись видео не поддерживается этим браузером', true); return; }
    chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const type = (rec.mimeType || mt || 'video/webm').split(';')[0];
      const ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
      const b = new Blob(chunks, { type });
      if (!b.size) { toast('Запись пустая, попробуй ещё раз', true); retake(); return; }
      result = new File([b], 'video_' + stamp() + '.' + ext, { type });
      url = URL.createObjectURL(b); rev.src = url;
      stopStream(); info.textContent = '≈ ' + (b.size / 1048576).toFixed(1) + ' МБ';
      showResult(true);
    };
    rec.start(1000);
    go.dataset.rec = '1'; go.textContent = '⏹ Остановить'; dev.style.display = 'none';
    t0 = Date.now();
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      info.textContent = '🔴 ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' (максимум 5 минут)';
      if (s >= MAX_SEC) stopRec();
    }, 500);
  };
  again.onclick = retake;
  use.onclick = () => { const f = result; close(); if (f) onFile(f); };
  $('mc-cam-x').onclick = close;
  start('');
}
