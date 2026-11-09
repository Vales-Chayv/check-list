// ═══════════════════════════════════════════
//  ЗАПИСЬ ЭКРАНА (компьютер). Кнопка 🖥 рядом с 🎙 в новой карточке и в добавлении записи.
//  Запись идёт без ограничения по времени. После «Стоп»:
//   • ролик до 40 МБ — выбор: прикрепить / скачать / и то и другое;
//   • больше 40 МБ — сам скачивается на компьютер (в облако такой файл не пройдёт).
//  Телефон (приложение): запись идёт через системную службу Android, можно переключаться в другие приложения;
//  остановить можно в шторке уведомлений или кнопкой «Стоп» здесь. После записи: прикрепить / в папку.
// ═══════════════════════════════════════════
(function () {
  if (window._mcScreenRec) return; window._mcScreenRec = true;
  const LIMIT = 40 * 1024 * 1024, Z = 100030;
  const isApk = () => typeof window.isNativeApp === 'function' && window.isNativeApp();
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  // телефон (приложение): нативный плагин McScreen
  const cap = window.Capacitor;
  const McSc = isApk() && cap ? ((cap.Plugins && cap.Plugins.McScreen) || (cap.registerPlugin && cap.registerPlugin('McScreen'))) : null;
  let nativeOK = false;
  const can = () => nativeOK || (!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && window.MediaRecorder && !isApk() && !mobile);
  const tst = (m, e) => { try { toast(m, e); } catch (_) {} };
  let R = null; // идущая запись

  const GOLD = '#e8c56a';
  const bs = 'border-radius:20px;padding:10px 18px;font-size:14px;cursor:pointer;font-family:inherit;border:1px solid #555;background:#2a2a2a;color:#eee';
  const pad = n => String(n).padStart(2, '0');
  const stamp = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()); };
  const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' МБ';

  function modal(html) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML = '<div style="background:#1c1c1c;color:#eee;border-radius:16px;padding:18px;max-width:380px;width:100%;font-family:inherit">' + html + '</div>';
    document.body.appendChild(d);
    return d;
  }

  // ── окно перед стартом ──
  function askStart(nat) {
    return new Promise(res => {
      const d = modal(
        '<div style="font-size:16px;font-weight:700">🖥 Запись экрана</div>' +
        '<div style="font-size:13px;opacity:.75;margin-top:6px;line-height:1.4">' + (nat ? 'Android спросит разрешение на запись экрана. Дальше можно переключаться в другие приложения. Чтобы остановить, нажми «Остановить» в шторке уведомлений или вернись сюда и нажми «Стоп».' : 'Дальше браузер спросит, что записывать: весь экран, окно или вкладку. Чтобы остановить, нажми «Стоп» в плашке внизу.') + '</div>' +
        '<label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;cursor:pointer"><input type="checkbox" id="sr-mic" style="width:18px;height:18px"> 🎙 Добавить голос с микрофона</label>' +
        '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button data-x style="' + bs + '">Отмена</button><button data-go style="' + bs + ';background:' + GOLD + ';border-color:' + GOLD + ';color:#111;font-weight:700">Начать</button></div>');
      d.onclick = e => {
        if (e.target.closest('[data-go]')) { const mic = d.querySelector('#sr-mic').checked; d.remove(); res({ mic }); }
        else if (e.target.closest('[data-x]')) { d.remove(); res(null); }
      };
    });
  }

  async function start(target) {
    if (nativeOK) return startNative(target);
    if (R) { tst('Запись уже идёт'); return; }
    const o = await askStart(); if (!o) return;
    let disp, mic = null;
    try { disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 20 }, audio: true }); }
    catch (e) { tst('Запись не началась: экран не выбран', true); return; }
    if (o.mic) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { tst('Микрофон недоступен, пишу без голоса', true); } }
    let stream = disp, ac = null;
    const dispAudio = disp.getAudioTracks().length > 0;
    if (mic && dispAudio) { // звук вкладки и голос смешиваем
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const dst = ac.createMediaStreamDestination();
        ac.createMediaStreamSource(new MediaStream(disp.getAudioTracks())).connect(dst);
        ac.createMediaStreamSource(mic).connect(dst);
        stream = new MediaStream([...disp.getVideoTracks(), ...dst.stream.getAudioTracks()]);
      } catch (e) { stream = new MediaStream([...disp.getVideoTracks(), ...mic.getAudioTracks()]); }
    } else if (mic) stream = new MediaStream([...disp.getVideoTracks(), ...mic.getAudioTracks()]);
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 2500000 }, mime ? { mimeType: mime } : {})); }
    catch (e) { [disp, mic].forEach(s => s && s.getTracks().forEach(t => t.stop())); tst('Браузер не умеет записывать экран', true); return; }
    R = { rec, chunks: [], size: 0, t0: Date.now(), target, disp, mic, ac, mime: mime || 'video/webm', cancelled: false };
    rec.ondataavailable = e => { if (e.data && e.data.size) { R.chunks.push(e.data); R.size += e.data.size; } };
    rec.onstop = onStop;
    rec.onerror = () => stop(false);
    disp.getVideoTracks()[0].addEventListener('ended', () => stop(true)); // нажали «Прекратить доступ» в браузере
    rec.start(1000);
    pill();
  }

  function pill() {
    const p = document.createElement('div');
    p.id = 'sr-pill';
    p.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:' + Z + ';background:#1c1c1c;color:#eee;border:1px solid #444;border-radius:28px;padding:8px 10px 8px 16px;display:flex;align-items:center;gap:12px;font-size:14px;box-shadow:0 4px 18px rgba(0,0,0,.5);font-family:inherit';
    p.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:#e53935;animation:srblink 1s infinite"></span><span id="sr-t">0:00</span><span id="sr-s" style="opacity:.6;font-size:12px"></span><button data-c style="' + bs + ';padding:7px 12px;font-size:13px">Отмена</button><button data-s style="' + bs + ';padding:7px 14px;background:#e53935;border-color:#e53935;color:#fff;font-weight:700">⏹ Стоп</button>';
    if (!document.getElementById('sr-css')) { const st = document.createElement('style'); st.id = 'sr-css'; st.textContent = '@keyframes srblink{50%{opacity:.25}}'; document.head.appendChild(st); }
    document.body.appendChild(p);
    p.onclick = e => { if (e.target.closest('[data-s]')) stop(true); else if (e.target.closest('[data-c]')) { if (confirm('Отменить запись? Записанное пропадёт.')) stop(false); } };
    R.tick = setInterval(() => {
      if (!R) return;
      const s = Math.floor((Date.now() - R.t0) / 1000);
      p.querySelector('#sr-t').textContent = Math.floor(s / 60) + ':' + pad(s % 60);
      p.querySelector('#sr-s').textContent = R.native ? '' : mb(R.size);
    }, 500);
    R.pill = p;
  }

  function stop(keep) {
    if (!R) return;
    if (R.native) { stopNative(keep); return; }
    R.cancelled = !keep;
    if (R.rec.state !== 'inactive') { try { R.rec.stop(); } catch (e) { onStop(); } } else onStop();
  }

  function cleanup() {
    if (!R) return;
    clearInterval(R.tick);
    if (R.pill) R.pill.remove();
    [R.disp, R.mic].forEach(s => s && s.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }));
    if (R.ac) { try { R.ac.close(); } catch (e) {} }
  }

  async function onStop() {
    const r = R; if (!r || r.done) return; r.done = true;
    cleanup(); R = null;
    if (r.cancelled || !r.chunks.length) { if (!r.cancelled) tst('Запись пустая', true); return; }
    const blob = new Blob(r.chunks, { type: r.mime.split(';')[0] });
    const file = new File([blob], 'Экран_' + stamp() + '.webm', { type: 'video/webm', lastModified: Date.now() });
    if (file.size > LIMIT) {
      download(file);
      tst('Ролик ' + mb(file.size) + ' — больше 40 МБ, в облако не пройдёт. Скачала на компьютер.');
      return;
    }
    const d = modal(
      '<div style="font-size:16px;font-weight:700">Запись готова · ' + mb(file.size) + '</div>' +
      '<div style="font-size:13px;opacity:.75;margin-top:4px">Что сделать с роликом?</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
      '<button data-m="att" style="' + bs + ';text-align:left;border-radius:12px">📎 Прикрепить к записи</button>' +
      '<button data-m="dl" style="' + bs + ';text-align:left;border-radius:12px">⬇ Скачать на компьютер</button>' +
      '<button data-m="both" style="' + bs + ';text-align:left;border-radius:12px">📎 + ⬇ И прикрепить, и скачать</button>' +
      '<button data-m="no" style="' + bs + ';text-align:center;border-radius:12px;opacity:.8">Не сохранять</button></div>');
    d.onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = b.dataset.m;
      if (m === 'no' && !confirm('Удалить запись?')) return;
      d.remove();
      if (m === 'dl' || m === 'both') download(file);
      if (m === 'att' || m === 'both') await attach(file, r.target, m === 'att');
    };
  }

  function download(file) {
    const u = URL.createObjectURL(file), a = document.createElement('a');
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }

  async function attach(file, target, offerDl) {
    const cfg = { new: [() => typeof tempAtt !== 'undefined' ? tempAtt : null, 'renderAttPrev', 'att-prev'], ae: [() => typeof aeAtts !== 'undefined' ? aeAtts : null, 'renderAEPrev', 'ae-att-prev'] }[target];
    const arr = cfg && cfg[0](), holder = cfg && document.getElementById(cfg[2]);
    if (!arr || !holder || !holder.offsetParent) { download(file); tst('Форма уже закрыта, скачала ролик на компьютер', true); return; }
    try {
      tst('⏳ Загружаю ролик…');
      const att = await (window.uploadDeferred || uploadToStorage)(file);
      arr.push(att);
      try { window[cfg[1]](); } catch (e) {}
      tst('✓ Ролик прикреплён');
    } catch (e) {
      if (!(e && e.message === 'file_too_big')) tst('Не удалось загрузить: ' + String((e && e.message) || e).slice(0, 80), true);
      if (offerDl) { download(file); tst('В облако не загрузилось, скачала ролик на компьютер', true); }
    }
  }

  // ═══ Телефон: запись экрана через службу Android ═══
  const msgOf = e => String((e && e.message) || e || '').slice(0, 100);
  async function startNative(target) {
    if (R) { tst('Запись уже идёт'); return; }
    const o = await askStart(true); if (!o) return;
    let audio = !!o.mic;
    if (audio) { // просим доступ к микрофону заранее: без него Android запишет экран без голоса
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
      catch (e) { audio = false; tst('Микрофон недоступен, пишу без голоса', true); }
    }
    let r;
    try { r = await McSc.start({ audio }); } catch (e) { tst('Запись не началась: ' + msgOf(e), true); return; }
    if (!r || !r.started) { tst('Запись не началась: доступ к экрану не дан', true); return; }
    if (audio && !r.audio) tst('Голос не записывается: нет доступа к микрофону', true);
    R = { native: true, t0: Date.now(), target, size: 0 };
    pill();
  }
  async function stopNative(keep) {
    const r = R; if (!r || r.stopping) return;
    r.stopping = true;
    let res = null;
    try { res = await McSc.stop(); }
    catch (e) { try { const st = await McSc.status(); res = st && st.last || null; } catch (_) {} if (!res) tst('Не удалось остановить запись: ' + msgOf(e), true); }
    finishNative(res, keep);
  }
  function finishNative(res, keep) {
    const r = R; if (!r || r.done) return; r.done = true;
    cleanup(); R = null;
    if (!keep) { if (res && res.name) { try { McSc.discard({ name: res.name }); } catch (_) {} } return; }
    if (!res || !res.name) { tst((res && res.error) || 'Запись пустая', true); return; }
    nativeDone(res, r.target);
  }
  async function readNative(res) { // ролик из кэша приложения → обычный файл в памяти
    const FS = cap.Plugins && cap.Plugins.Filesystem;
    const wt = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут чтения ролика')), ms))]);
    const { uri } = await FS.getUri({ path: res.name, directory: 'CACHE' });
    const rr = await wt(fetch(cap.convertFileSrc(uri)), 20000);
    if (!rr.ok) throw new Error('http ' + rr.status);
    const blob = await wt(rr.blob(), 120000);
    if (!blob || !blob.size) throw new Error('пустой файл');
    return new Blob([await wt(blob.arrayBuffer(), 120000)], { type: 'video/mp4' });
  }
  function nativeDone(res, target) {
    const form = { new: 'att-prev', ae: 'ae-att-prev' }[target], holder = form && document.getElementById(form);
    const big = res.size > 100 * 1048576;
    const canAtt = !!(holder && holder.offsetParent) && !big, f = window.mcSysFolder, canDir = !!(f && f.available);
    const name = 'Экран_' + stamp() + '.mp4', sec = Math.round((res.ms || 0) / 1000);
    const b = ';text-align:left;border-radius:12px';
    const d = modal(
      '<div style="font-size:16px;font-weight:700">Запись готова · ' + mb(res.size) + (sec ? ' · ' + Math.floor(sec / 60) + ':' + pad(sec % 60) : '') + '</div>' +
      '<div id="sr-body"><div style="font-size:13px;opacity:.75;margin-top:4px">Что сделать с роликом?' + (big ? ' Он большой, в облако не прикрепляется.' : !canAtt ? ' Форма уже закрыта, прикрепить не получится.' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
      (canAtt ? '<button data-m="att" style="' + bs + b + '">📎 Прикрепить к записи</button>' : '') +
      (canDir ? '<button data-m="dir" style="' + bs + b + '">📁 Сохранить в папку' + (f.get() ? ' «' + String(f.get().name).replace(/[<>&"]/g, '') + '»' : '') + '</button>' : '') +
      (canAtt && canDir ? '<button data-m="both" style="' + bs + b + '">📎 + 📁 И прикрепить, и в папку</button>' : '') +
      '<button data-m="no" style="' + bs + ';text-align:center;border-radius:12px;opacity:.8">Не сохранять</button></div></div>');
    let busy = false;
    d.onclick = async e => {
      const bt = e.target.closest('[data-m]'); if (!bt || busy) return;
      const m = bt.dataset.m;
      if (m === 'no') { if (!confirm('Удалить запись?')) return; d.remove(); try { McSc.discard({ name: res.name }); } catch (_) {} return; }
      busy = true;
      const body = d.querySelector('#sr-body'), keepHtml = body.innerHTML, say = t => { body.innerHTML = '<div style="font-size:14px;margin-top:10px">' + t + '</div>'; };
      try {
        if (m === 'dir' || m === 'both') {
          const fd = await f.ensure();
          if (!fd) { busy = false; return; } // выбор папки отменили: окно остаётся
          say('⏳ Сохраняю в папку…');
          await f.copy(fd, res.name, name, 'video/mp4');
          tst('✓ Сохранено в «' + fd.name + '»');
        }
        if (m === 'att' || m === 'both') {
          say('⏳ Готовлю ролик…');
          const blob = await readNative(res);
          d.remove();
          await attach(new File([blob], name, { type: 'video/mp4', lastModified: Date.now() }), target, false);
        }
      } catch (err) { // не вышло: окно остаётся, ролик цел, можно выбрать другое
        body.innerHTML = keepHtml; busy = false; tst('Не получилось: ' + msgOf(err), true); return;
      }
      d.remove();
      try { McSc.discard({ name: res.name }); } catch (_) {}
    };
  }
  if (McSc) {
    try { McSc.addListener('finished', ev => { if (R && R.native && !R.stopping) { R.stopping = true; finishNative(ev && (ev.name || ev.error) ? ev : null, true); } }); } catch (e) {}
    try { McSc.status().then(() => { nativeOK = true; init(); }).catch(() => {}); } catch (e) {}
    // вернулись в приложение, а запись уже остановили в шторке
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden || !R || !R.native || R.stopping) return;
      try { const st = await McSc.status(); if (st && !st.recording && R && !R.stopping) { R.stopping = true; finishNative(st.last || null, true); } } catch (e) {}
    });
  }

  // ── кнопки ──
  function addBtn(afterId, target) {
    const v = document.getElementById(afterId);
    if (!v || v.parentNode.querySelector('[data-sr="' + target + '"]')) return;
    const b = document.createElement('button');
    b.className = v.className; b.type = 'button'; b.textContent = '🖥'; b.title = 'Запись экрана'; b.dataset.sr = target;
    b.onclick = () => start(target);
    v.parentNode.insertBefore(b, v.nextSibling);
  }
  function init() { if (!can()) return; addBtn('voice-btn', 'new'); addBtn('ae-voice-btn', 'ae'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.mcScreenRecStart = start;
})();
