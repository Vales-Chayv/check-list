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

// ═══════════════════════════════════════════
//  РЕЗЕРВНАЯ КОПИЯ
//  Всё содержимое всех кабинетов: карточки (текст, cards.json) и файлы, разложенные по папкам кабинетов и карточек.
//  Если у файла есть оригинал 💎 — в резерв кладётся оригинал. Куда: папка на компьютере или ZIP (на телефоне — по частям через «Поделиться»).
//  Раз в месяц приложение напоминает сделать копию.
// ═══════════════════════════════════════════
const MC_BK_DAYS = 30;
const mcBkGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e) { return null; } };
const mcBkSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
const mcSafe = (s, n) => (String(s || '').replace(/[\\\/:*?"<>|\r\n\t]/g, '_').trim().slice(0, n || 80)) || '_';
const mcFmtMB = b => (b / 1048576 < 10 ? Math.round(b / 104857.6) / 10 : Math.round(b / 1048576)) + ' МБ';
let _mcBkBusy = false;

function mcBkDialog(html) { // общая оболочка окон резервного копирования
  const ov = document.createElement('div');
  ov.setAttribute('data-mc-bk', '1');
  ov.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:inherit';
  ov.innerHTML = '<div style="background:#1c1c1c;color:#eee;border-radius:16px;padding:18px 16px;max-width:400px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.6);max-height:90vh;overflow:auto">' + html + '</div>';
  document.body.appendChild(ov);
  return ov;
}
const MC_BK_BTN = 'width:100%;border-radius:12px;padding:13px 12px;font-size:14px;cursor:pointer;font-family:inherit;text-align:left;line-height:1.35;border:1px solid #555;background:#2a2a2a;color:#eee;margin-top:8px';
const MC_BK_GOLD = ';background:#B8892B;color:#111;border-color:#B8892B;font-weight:600';

async function mcVaultGet(url) { // оригинал и его описание по адресу копии в облаке
  try {
    if(!url || !MC_ATT_RE.test(url)) return null;
    const db = await mcVaultDb();
    const m = await _mcIdb(db.transaction('meta').objectStore('meta').index('url').get(url));
    if(!m) return null;
    const f = await _mcVaultFile(db, m.id, m);
    return f ? { meta: m, file: f } : null;
  } catch(e) { return null; }
}
async function mcBkBlob(url) {
  const o = await mcVaultGet(url);
  if(o) return { blob: o.file, name: o.meta.name, vid: o.meta.id };
  const r = await fetch(url, url.startsWith('data:') ? undefined : { mode: 'cors' });
  if(!r.ok) throw new Error('http ' + r.status);
  return { blob: await r.blob() };
}

// ── куда писать ──
function mcBkFolderSink(root) {
  return {
    async write(path, blob) {
      const parts = path.split('/'); let d = root;
      for(let i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i], { create: true });
      const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
    },
    async finish() { return true; }
  };
}
async function mcBkDeliver(out, fileName) { // отдать готовый ZIP: родное «Поделиться» → системное «Поделиться» → скачивание
  try {
    if(typeof window.isNativeApp === 'function' && window.isNativeApp() && typeof mcNativeShareFile === 'function') { if(await mcNativeShareFile(out, 'mycards_backup.zip', fileName)) return true; }
  } catch(e) {}
  try {
    const f = new File([out], fileName, { type: 'application/zip' });
    if(mcIsMobile() && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: fileName }); return true; }
  } catch(e) { if(e && e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(out); a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}
function mcBkZipSink(limit, date, deliver) {
  let z = new (window.JSZip)(), bytes = 0, part = 0, ok = true;
  const flush = async final => {
    if(!bytes && !final) return;
    const out = await z.generateAsync({ type: 'blob', compression: 'STORE' });
    part++;
    const name = 'Резерв ' + date + (final && part === 1 ? '' : ' часть ' + part) + '.zip';
    try { toast('📦 Сохраняю ' + name + ' (' + mcFmtMB(out.size) + ')'); } catch(e) {}
    if(!(await deliver(out, name))) ok = false;
    z = new (window.JSZip)(); bytes = 0;
  };
  return {
    async write(path, blob) { z.file(path, blob); bytes += blob.size; if(bytes >= limit) await flush(false); },
    async finish() { await flush(true); return ok; }
  };
}

// ── окно выбора места ──
function mcBkAskDest(stats) {
  return new Promise(resolve => {
    const canDir = !!window.showDirectoryPicker, mobile = mcIsMobile();
    const ov = mcBkDialog(
      '<div style="font-size:16px;font-weight:700">🛡 Куда сохранить резервную копию?</div>' +
      '<div style="font-size:12px;opacity:.7;margin-top:4px">Все карточки и файлы всех кабинетов' + (stats.orig ? ', оригиналы 💎: ' + stats.orig + ' (' + mcFmtMB(stats.origBytes) + ')' : '') + '. Файлы разложатся по папкам кабинетов и карточек.</div>' +
      (canDir ? '<button id="bk-dir" style="' + MC_BK_BTN + MC_BK_GOLD + '">📁 Папка на этом устройстве<br><span style="font-weight:400;font-size:12px">выбери любую папку, внутри создам «Мои карточки — резерв»</span></button>' : '') +
      '<button id="bk-zip" style="' + MC_BK_BTN + (canDir ? '' : MC_BK_GOLD) + '">' + (mobile ? '📤 Отправить / сохранить файлами<br><span style="font-weight:400;font-size:12px">откроется меню телефона: Google Диск, Файлы, Telegram… Копия идёт частями по ~100 МБ' : '📦 ZIP-файл(ы)<br><span style="font-weight:400;font-size:12px">скачаются в «Загрузки», большие копии — несколькими частями') + '</span></button>' +
      (mobile && !canDir ? '<div style="font-size:11px;opacity:.6;margin-top:8px">Выбор папки на телефоне появится в следующем обновлении приложения.</div>' : '') +
      '<button id="bk-x" style="' + MC_BK_BTN + ';text-align:center">Отмена</button>');
    const done = v => { ov.remove(); resolve(v); };
    ov.querySelector('#bk-x').onclick = () => done(null);
    ov.querySelector('#bk-zip').onclick = () => done({ mode: 'zip', limit: (mobile ? 100 : 500) * 1048576 });
    const bd = ov.querySelector('#bk-dir');
    if(bd) bd.onclick = async () => { try { const dir = await window.showDirectoryPicker({ mode: 'readwrite' }); done({ mode: 'folder', dir }); } catch(e) { /* выбор папки отменён: остаёмся в окне */ } };
  });
}
function mcBkProgress() {
  const ov = mcBkDialog('<div style="font-size:16px;font-weight:700">🛡 Делаю резервную копию</div><div id="bk-t" style="font-size:13px;margin:10px 0 6px;word-break:break-all">Готовлю…</div><div style="height:8px;background:#333;border-radius:4px;overflow:hidden"><div id="bk-b" style="height:100%;width:0;background:#B8892B"></div></div><div style="font-size:11px;opacity:.6;margin-top:8px">Не закрывай приложение, пока копия не готова.</div><button id="bk-c" style="' + MC_BK_BTN + ';text-align:center">Отменить</button>');
  const o = { cancelled: false, set(i, n, t) { ov.querySelector('#bk-t').textContent = i + ' из ' + n + ' · ' + t; ov.querySelector('#bk-b').style.width = Math.round(n ? i / n * 100 : 0) + '%'; }, close() { ov.remove(); } };
  ov.querySelector('#bk-c').onclick = () => { o.cancelled = true; ov.querySelector('#bk-t').textContent = 'Останавливаю…'; };
  return o;
}

// ── сама копия ──
async function mcBackupRun(dest) {
  const ui = mcBkProgress(), now = Date.now(), date = new Date(now).toISOString().slice(0, 10);
  const root = 'Мои карточки — резерв ' + date;
  const manifest = { app: 'Мои карточки', version: 1, created: new Date(now).toISOString(), spaces: [], files: [], missing: [] };
  let sink;
  try {
    sink = dest.mode === 'folder' ? mcBkFolderSink(await dest.dir.getDirectoryHandle(root, { create: true })) : mcBkZipSink(dest.limit, date, mcBkDeliver);
    if(dest.mode === 'zip' && typeof window.JSZip === 'undefined') throw new Error('Архиватор не загрузился');
    const all = await mcAllCardsForMedia(true);
    const names = new Map((typeof spaces !== 'undefined' ? spaces : []).map(s => [s.id, s.name || 'Кабинет']));
    const by = new Map();
    all.forEach(c => { const k = c.space_id || 'personal'; if(!by.has(k)) by.set(k, []); by.get(k).push(c); });
    // список задач
    const usedSp = new Set(), tasks = [], seenUrl = new Set();
    for(const [k, list] of by) {
      let sp = mcSafe(k === 'personal' ? 'Личный кабинет' : names.get(k) || 'Кабинет', 50);
      if(usedSp.has(sp)) sp += ' (' + String(k).slice(0, 4) + ')'; usedSp.add(sp);
      manifest.spaces.push({ id: k, name: sp, cards: list.length });
      tasks.push({ json: sp + '/cards.json', data: list });
      list.forEach(c => {
        const dir = sp + '/' + mcSafe(c.title || 'Без названия', 50) + ' [' + String(c.id).slice(0, 6) + ']', used = new Set();
        mcAttsOfCard(c).forEach(a => {
          const u = String(a.data || ''); if(!u || seenUrl.has(u)) return; seenUrl.add(u);
          if(!MC_ATT_RE.test(u) && !u.startsWith('data:')) return;
          let raw = a.name; if(!raw) { try { raw = decodeURIComponent(u.split('?')[0].split('/').pop() || 'file').replace(/^[A-Za-z0-9]{6,}_/, ''); } catch(_) { raw = 'file'; } }
          let n = mcSafe(raw, 90);
          tasks.push({ url: u, dir, n, used });
        });
      });
    }
    // оригиналы без привязки к карточке
    const loose = (await mcVaultMeta()).filter(m => !m.url);
    const total = tasks.filter(t => t.url).length + loose.length;
    let i = 0, bytes = 0; const vids = [];
    const uniq = (n, used) => { if(!used.has(n)) { used.add(n); return n; } const d = n.lastIndexOf('.'), a = d > 0 ? n.slice(0, d) : n, b = d > 0 ? n.slice(d) : ''; let k = 2; while(used.has(a + ' (' + k + ')' + b)) k++; const r = a + ' (' + k + ')' + b; used.add(r); return r; };
    for(const t of tasks) {
      if(ui.cancelled) break;
      if(t.json) { await sink.write(t.json, new Blob([JSON.stringify(t.data, null, 1)], { type: 'application/json' })); continue; }
      ui.set(++i, total, t.n);
      try {
        const g = await mcBkBlob(t.url);
        const name = uniq(g.name ? mcSafe(g.name, 90) : /\.[A-Za-z0-9]{2,5}$/.test(t.n) ? t.n : t.n + (g.blob.type === 'image/jpeg' ? '.jpg' : ''), t.used);
        await sink.write(t.dir + '/' + name, g.blob);
        bytes += g.blob.size; if(g.vid) vids.push(g.vid);
        manifest.files.push({ url: t.url.startsWith('data:') ? 'data' : t.url, path: t.dir + '/' + name, size: g.blob.size, original: !!g.vid });
      } catch(e) { manifest.missing.push(t.url.startsWith('data:') ? 'data' : t.url); }
    }
    const dbv = loose.length ? await mcVaultDb() : null, usedL = new Set();
    for(const m of loose) {
      if(ui.cancelled) break;
      ui.set(++i, total, m.name);
      try {
        const f = await _mcVaultFile(dbv, m.id, m);
        if(f) { await sink.write('Оригиналы без привязки/' + uniq(mcSafe(m.name, 90), usedL), f); bytes += f.size; vids.push(m.id); manifest.files.push({ url: null, path: 'Оригиналы без привязки/' + m.name, size: f.size, original: true }); }
      } catch(e) { manifest.missing.push(m.name); }
    }
    if(ui.cancelled) { ui.close(); try { toast('Резервная копия отменена'); } catch(e) {} return; }
    await sink.write('backup.json', new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' }));
    const ok = await sink.finish();
    ui.close();
    if(!ok) { toast('Копия не сохранена: отправка была отменена', true); return; }
    await mcVaultMark(vids, now);
    mcBkSet('mc_bk_last', { ts: now, files: manifest.files.length, bytes, mode: dest.mode, missing: manifest.missing.length });
    toast('✓ Резервная копия готова: ' + manifest.files.length + ' файлов, ' + mcFmtMB(bytes) + (manifest.missing.length ? '. Не удалось взять: ' + manifest.missing.length : ''), !!manifest.missing.length);
  } catch(e) {
    try { ui.close(); } catch(_) {}
    try { toast('Не удалось сделать копию: ' + String((e && e.message) || e).slice(0, 100), true); } catch(_) {}
  }
}
const mcIsApk = () => typeof window.isNativeApp === 'function' && window.isNativeApp();
async function mcBackupStart() {
  if(_mcBkBusy) return;
  if(mcIsApk()) { // в APK большие файлы нельзя передавать через мост Android: приложение вылетает по памяти. Включим вместе с плагином «Поделиться» в следующей сборке APK
    const ov = mcBkDialog('<div style="font-size:16px;font-weight:700">🛡 Резервная копия на телефоне</div><div style="font-size:13px;margin-top:8px;line-height:1.5">В приложении на телефоне резервная копия пока недоступна: для неё нужен новый компонент, он войдёт в следующее обновление APK. Сделай копию на компьютере: в Галерее ⚙ → «Резерв».</div><button id="bk-ok" style="' + MC_BK_BTN + ';text-align:center">Понятно</button>');
    ov.querySelector('#bk-ok').onclick = () => ov.remove();
    return;
  }
  _mcBkBusy = true;
  try {
    const v = await mcVaultStats();
    const dest = await mcBkAskDest({ orig: v.count, origBytes: v.bytes });
    if(!dest) { mcBkSet('mc_bk_snooze', Date.now() + 864e5); return; }
    await mcBackupRun(dest);
  } finally { _mcBkBusy = false; }
}

// ── какие оригиналы уже в резерве, и освобождение места ──
async function mcVaultMark(ids, ts) {
  if(!ids.length) return;
  const db = await mcVaultDb();
  const t = db.transaction('meta', 'readwrite'), st = t.objectStore('meta');
  ids.forEach(id => { const g = st.get(id); g.onsuccess = () => { if(g.result) st.put({ ...g.result, bk: ts }); }; });
  await _mcTx(t);
}
async function mcVaultBacked() {
  const m = (await mcVaultMeta()).filter(x => x.bk);
  return { count: m.length, bytes: m.reduce((s, x) => s + (x.size || 0), 0), ids: m.map(x => x.id) };
}
async function mcVaultFreeBacked() { // удаляет оригиналы, которые попали в резервную копию
  const b = await mcVaultBacked();
  if(!b.ids.length) return b;
  const db = await mcVaultDb();
  const t = db.transaction(['orig', 'meta'], 'readwrite');
  b.ids.forEach(id => { t.objectStore('orig').delete(id); t.objectStore('meta').delete(id); });
  await _mcTx(t);
  return b;
}

// ── напоминание раз в месяц ──
async function mcBackupRemind() {
  try {
    if(_mcBkBusy || mcIsApk() || document.hidden || typeof currentUser === 'undefined' || !currentUser || document.querySelector('[data-mc-bk]')) return;
    let first = mcBkGet('mc_bk_first');
    if(!first) { first = Date.now() - (MC_BK_DAYS - 7) * 864e5; mcBkSet('mc_bk_first', first); } // первое напоминание — через неделю после обновления
    const last = mcBkGet('mc_bk_last'), base = last ? last.ts : first;
    if(Date.now() < base + MC_BK_DAYS * 864e5 || Date.now() < (mcBkGet('mc_bk_snooze') || 0)) return;
    mcBkSet('mc_bk_snooze', Date.now() + 864e5); // пока окно открыто или закрыто крестиком — не чаще раза в сутки
    const v = await mcVaultStats();
    const ov = mcBkDialog(
      '<div style="font-size:16px;font-weight:700">🛡 Пора сделать резервную копию</div>' +
      '<div style="font-size:13px;margin-top:8px;line-height:1.5">' + (last ? 'Последняя копия была ' + new Date(last.ts).toLocaleDateString('ru') + '.' : 'Копию ещё ни разу не делали.') + ' Если удалить приложение или очистить данные браузера, файлы, которых нет в облаке' + (v.count ? ' (в том числе ' + v.count + ' оригиналов 💎)' : '') + ', будут утрачены. Советуем сохранить копию.</div>' +
      '<button id="bk-go" style="' + MC_BK_BTN + MC_BK_GOLD + '">Сохранить сейчас</button>' +
      '<button id="bk-w" style="' + MC_BK_BTN + ';text-align:center">Напомнить через неделю</button>');
    ov.querySelector('#bk-go').onclick = () => { ov.remove(); mcBackupStart(); };
    ov.querySelector('#bk-w').onclick = () => { mcBkSet('mc_bk_snooze', Date.now() + 7 * 864e5); ov.remove(); };
  } catch(e) {}
}
setTimeout(mcBackupRemind, 30000);
setInterval(mcBackupRemind, 3600000);

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
