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
    const db = await mcMediaDb();
    const all = await new Promise((res, rej) => { const q = db.transaction('idx').objectStore('idx').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const fresh = all.filter(x => x.url !== '__cap__' && !x.rep && mcPathOf(x.url)).slice(0, 200);
    if(!fresh.length) return;
    const rows = fresh.map(x => ({ path: mcPathOf(x.url), user_id: currentUser.id }));
    const { error } = await sb.from('attachment_receipts').upsert(rows, { onConflict: 'path,user_id', ignoreDuplicates: true });
    if(error) { console.log('receipts error:', error.message); return; }
    const t = db.transaction('idx', 'readwrite');
    fresh.forEach(x => t.objectStore('idx').put({ ...x, rep: true }));
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
  const useInput = () => {
    if (typeof target === 'string') { const i = document.getElementById(target); if (i) i.click(); return; }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = kind === 'video' ? 'video/*' : 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = () => { if (inp.files && inp.files[0]) target(inp.files[0]); };
    inp.click();
  };
  if (mcIsMobile() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { useInput(); return; }
  mcCamOpen(kind, f => mcCamDeliver(target, f), useInput);
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
