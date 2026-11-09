// ═══════════════════════════════════════════
//  НАТИВНЫЙ СЛОЙ ДЛЯ ANDROID-ПРИЛОЖЕНИЯ (Capacitor + Firebase)
//  Работает только внутри APK. В браузере и в PWA этот файл ничего не делает.
//  Заменяет функции пушей из app-init.js / app-settings.js, потому что
//  веб-пуши (PushManager) в оболочке Android не работают.
// ═══════════════════════════════════════════
(function () {
  const cap = window.Capacitor;
  let native = false;
  try {
    native = !!(cap && (typeof cap.isNativePlatform === 'function'
      ? cap.isNativePlatform()
      : (cap.getPlatform && cap.getPlatform() !== 'web')));
  } catch (e) {}
  window.isNativeApp = () => native;
  if (!native) return;

  // ═══ Встроенная копия сайта: сама подтягивает свежую версию, без пересборки APK ═══
  (function () {
    const CU = cap.Plugins && cap.Plugins.CapacitorUpdater;
    // сообщения об ошибках обновления: короткая строка сверху, нажатием убирается
    let dbgEl = null, dbgT = null;
    const dbg = t => {
      try {
        if (!dbgEl) {
          dbgEl = document.createElement('div');
          dbgEl.style.cssText = 'position:fixed;left:8px;right:8px;top:70px;background:rgba(0,0,0,.9);color:#9f9;padding:8px 10px;border-radius:8px;font:12px/1.4 monospace;z-index:2147483647;white-space:pre-wrap';
          document.body.appendChild(dbgEl);
        }
        dbgEl.textContent += (dbgEl.textContent ? '\n' : '') + t;
        clearTimeout(dbgT); dbgT = setTimeout(() => { if (dbgEl) { dbgEl.remove(); dbgEl = null; } }, 30000);
        dbgEl.onclick = () => { dbgEl.remove(); dbgEl = null; };
      } catch (e) {}
    };
    if (!CU) { setTimeout(() => dbg('upd: плагин обновления НЕ найден'), 3000); return; }
    const REL = 'https://api.github.com/repos/vales-chayv/check-list/releases/tags/bundle';
    try { CU.notifyAppReady(); } catch (e) {} // «страница запустилась нормально» — иначе плагин откатит версию
    let lastCheck = 0, busy = false;
    async function check(force) {
      if (busy || (!force && Date.now() - lastCheck < 20 * 60000)) return;
      busy = true; lastCheck = Date.now();
      try {
        let have = '';
        try { have = (await (await fetch('mc-bundle.json', { cache: 'no-store' })).json()).version; } catch (e) { dbg('upd: нет mc-bundle.json'); }
        const r = await fetch(REL, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
        if (!r.ok) { dbg('upd: GitHub ответил ' + r.status); return; }
        const rel = await r.json();
        const ver = String(rel.name || '').trim();
        const asset = (rel.assets || []).find(a => a.name === 'app.zip');
        if (!ver || !asset) return;
        if (have === ver) return;
        const sum = String(rel.body || '').trim().toLowerCase(); // контрольная сумма архива (SHA-256), её кладёт в релиз Publish site bundle
        if (!/^[0-9a-f]{64}$/.test(sum)) { dbg('upd: у релиза нет контрольной суммы'); return; }
        const list = ((await CU.list()).bundles) || [];
        let b = list.find(x => x.version === ver);
        if (!b) { b = await CU.download({ url: asset.browser_download_url, version: ver, checksum: sum }); }
        await CU.next({ id: b.id }); // включится, когда приложение свернут
        const cur = (await CU.current()).bundle || {};
        for (const x of list) { if (x.id !== b.id && x.id !== cur.id && x.id !== 'builtin') { try { await CU.delete({ id: x.id }); } catch (e) {} } }
      } catch (e) { dbg('upd: ошибка ' + ((e && e.message) || String(e)).slice(0, 140)); }
      finally { busy = false; }
    }
    setTimeout(() => check(true), 6000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  })();

  // ═══ Сжатие видео перед отправкой (нативный плагин McVideo, только APK) ═══
  (function () {
    const McV = (cap.Plugins && cap.Plugins.McVideo) || (cap.registerPlugin && cap.registerPlugin('McVideo'));
    const FS = cap.Plugins && cap.Plugins.Filesystem;
    if (!McV || !FS) return;
    const MIN = 6 * 1024 * 1024, MAX = 400 * 1024 * 1024, CH = 3 * 1024 * 1024;
    let ui = null;
    const show = t => {
      if (window.mcUpStage) { window.mcUpStage(t); return; } // статус живёт в верхней капсуле загрузки
      if (!ui) {
        ui = document.createElement('div');
        ui.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(20,20,20,.92);color:#fff;padding:10px 16px;border-radius:14px;font:600 14px system-ui,sans-serif;z-index:99999;box-shadow:0 4px 18px rgba(0,0,0,.4)';
        document.body.appendChild(ui);
      }
      ui.textContent = t;
    };
    const hide = () => { if (window.mcUpStage) { window.mcUpStage(null); return; } if (ui) { ui.remove(); ui = null; } };
    const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут: ' + label)), ms))]);
    const mb = n => (n / 1048576).toFixed(1) + ' МБ';

    // вернёт сжатый File, а при любой неудаче — исходный файл
    window.mcCompressVideo = async function (file) {
      if (file.size < MIN || file.size > MAX) return file;
      const inName = 'mcv_' + Date.now() + '.mp4';
      const outName = inName + '.out.mp4';
      let h = null;
      window._mcCompressing = true; try { if (window.mcKeepSync) window.mcKeepSync(); } catch (e) {}
      try {
        show('🎞 Готовлю видео…');
        for (let off = 0, i = 0; off < file.size; off += CH, i++) {
          const data = await b64(file.slice(off, off + CH));
          if (i === 0) await FS.writeFile({ path: inName, directory: 'CACHE', data });
          else await FS.appendFile({ path: inName, directory: 'CACHE', data });
          show('🎞 Готовлю видео… ' + Math.min(99, Math.round((off + CH) / file.size * 100)) + '%');
        }
        show('🎞 Сжимаю видео…');
        h = await McV.addListener('progress', p => show('🎞 Сжимаю видео… ' + Math.round(p.percent || 0) + '%'));
        await withTimeout(McV.compress({ name: inName, maxShort: 720, bitrate: 2500000 }), 15 * 60000, 'сжатие');
        show('🎞 Читаю результат…');
        const { uri } = await FS.getUri({ path: outName, directory: 'CACHE' });
        let blob;
        try {
          const rr = await withTimeout(fetch(cap.convertFileSrc(uri)), 15000, 'чтение файла');
          if (!rr.ok) throw new Error('http ' + rr.status);
          blob = await withTimeout(rr.blob(), 90000, 'загрузка в память');
        } catch (e) {
          show('🎞 Читаю другим способом…');
          const rd = await withTimeout(FS.readFile({ path: outName, directory: 'CACHE' }), 180000, 'readFile');
          blob = await (await fetch('data:video/mp4;base64,' + rd.data)).blob();
        }
        if (!blob || !blob.size) throw new Error('пустой результат');
        // переносим данные в обычную память: файл из временного файла Android при отправке может «зависать»
        show('🎞 Копирую в память…');
        blob = new Blob([await withTimeout(blob.arrayBuffer(), 90000, 'копирование')], { type: 'video/mp4' });
        show('🎞 Готово: ' + mb(file.size) + ' → ' + mb(blob.size));
        await sleep(900);
        if (blob.size >= file.size * 0.95) return file; // не стало меньше — оставляем исходный
        return new File([blob], (file.name || 'video').replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4', lastModified: Date.now() });
      } catch (e) {
        console.log('[video]', e && e.message);
        show('⚠ Видео: ' + ((e && e.message) || String(e)).slice(0, 120));
        await sleep(6000);
        return file;
      } finally {
        window._mcCompressing = false;
        hide();
        try { if (h) h.remove(); } catch (e) {}
        // временные файлы удаляем в фоне, не дожидаясь: отправка ролика не должна от этого зависеть
        for (const n of [inName, outName]) { try { FS.deleteFile({ path: n, directory: 'CACHE' }).catch(() => {}); } catch (e) {} }
      }
    };
    window.mcNativeStatus = t => { if (t) show(t); else hide(); };
  })();

  // ═══ Служба «идёт загрузка»: пока грузятся или сжимаются файлы, Android не усыпляет приложение (только APK) ═══
  (function () {
    const McS = (cap.Plugins && cap.Plugins.McSys) || (cap.registerPlugin && cap.registerPlugin('McSys'));
    if (!McS) return;
    let on = false, text = '', dead = false, idle = 0, busy = false;
    async function set(want, t) {
      if (dead || busy) return;
      if (want === on && (!want || t === text)) return;
      busy = true;
      try { await McS.keepAlive({ on: want, text: t }); on = want; text = t; }
      catch (e) { if (/implemented|unavailable/i.test(String((e && e.message) || e))) dead = true; } // старое приложение без службы — молчим
      finally { busy = false; }
    }
    function sync() {
      let n = 0;
      try {
        const l = window.mcPendList && window.mcPendList();
        n = l ? l.active.filter(r => r.state !== 'err').length : 0;
      } catch (e) {}
      const comp = !!window._mcCompressing;
      if (n > 0 || comp) {
        idle = 0;
        set(true, comp ? 'Сжимаю видео…' : 'Загружается файлов: ' + n);
      } else if (on && ++idle >= 2) { // выключаем не сразу: между сжатием и отправкой бывает пауза
        set(false, '');
      }
    }
    window.mcKeepSync = sync;
    setInterval(sync, 2500);
    // перед выходом из приложения службу выключаем явно
    window.mcKeepOff = async () => { try { await McS.keepAlive({ on: false }); on = false; } catch (e) {} };
  })();

  // ═══ Запись голоса в фоне: пока идёт запись с микрофона, держим службу переднего плана (только APK) ═══
  (function () {
    const McR = (cap.Plugins && cap.Plugins.McRec) || (cap.registerPlugin && cap.registerPlugin('McRec'));
    const md = navigator.mediaDevices;
    if (!McR || !md || !md.getUserMedia || !window.MediaStreamTrack) return;
    const live = new Set();
    const svcStart = async () => { try { await McR.start(); } catch (e) { console.log('[rec] start', e && e.message); } };
    const svcStop = async () => { try { await McR.stop(); } catch (e) { console.log('[rec] stop', e && e.message); } };
    const forget = t => { if (live.delete(t) && live.size === 0) svcStop(); };
    const origGUM = md.getUserMedia.bind(md);
    md.getUserMedia = async function (c) {
      const s = await origGUM(c);                       // разрешение на микрофон уже получено
      try {
        if (c && c.audio) {
          const tr = s.getAudioTracks();
          if (tr.length) {
            tr.forEach(t => { live.add(t); t.addEventListener('ended', () => forget(t)); });
            await svcStart();
          }
        }
      } catch (e) {}
      return s;
    };
    const origStop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function () { origStop.call(this); forget(this); };
  })();

  const PN = cap.Plugins && cap.Plugins.PushNotifications;
  if (!PN) { console.log('[native] плагин PushNotifications не найден'); return; }

  const TOKEN_KEY = 'mc_fcm_token';
  const ON_KEY = 'mc_native_push'; // '1' — включены, '0' — выключены вручную, пусто — ещё не выбирали
  const SITE_PREFIX = 'https://vales-chayv.github.io/check-list/';
  // ссылка из уведомления: берём из неё только параметры и открываем их на нашей (встроенной) странице
  function openSiteUrl(url) {
    if (!url || url.indexOf(SITE_PREFIX) !== 0) return;
    const q = url.slice(SITE_PREFIX.length).replace(/^\/?/, '');
    const target = location.pathname + (q ? (q.charAt(0) === '?' ? q : '?' + q) : '');
    if (target !== location.pathname + location.search) location.href = target;
  }
  const post = body => fetch(FUNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_ANON, 'Authorization': 'Bearer ' + SB_ANON },
    body: JSON.stringify(body)
  });

  // ждём, пока приложение узнает, кто вошёл (иначе подписка сохранится без владельца)
  async function waitForUser() {
    for (let i = 0; i < 600 && !currentUser?.id; i++) await new Promise(r => setTimeout(r, 500));
    return !!currentUser?.id;
  }

  async function sendTokenToServer(token) {
    if (!(await waitForUser())) return;
    await post({
      fcmToken: token,
      deviceName: 'Android-приложение',
      userId: currentUser.id,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || null)
    });
  }

  async function registerNative(ask) {
    let perm = await PN.checkPermissions();
    if (perm.receive !== 'granted') {
      if (!ask) return false;
      perm = await PN.requestPermissions();
    }
    if (perm.receive !== 'granted') return false;
    try {
      await PN.createChannel({ id: 'mc_default', name: 'Мои карточки', description: 'Напоминания и сообщения', importance: 5, visibility: 1, vibration: true });
    } catch (e) {}
    await PN.register(); // токен придёт в событие 'registration'
    return true;
  }

  // ── события от Firebase ──
  PN.addListener('registration', t => {
    try { localStorage.setItem(TOKEN_KEY, t.value); } catch (e) {}
    sendTokenToServer(t.value)
      .then(() => { if (typeof checkPushStatus === 'function') checkPushStatus(); })
      .catch(e => console.log('[native] ошибка отправки токена', e && e.message));
  });
  PN.addListener('registrationError', e => console.log('[native] ошибка регистрации FCM', JSON.stringify(e)));
  // тап по уведомлению — открываем нужный чат/карточку
  PN.addListener('pushNotificationActionPerformed', a => {
    const url = a && a.notification && a.notification.data && a.notification.data.url;
    openSiteUrl(url);
  });

  // ── подмена функций из app-init.js / app-settings.js ──
  window.subscribeToPush = async function () {
    try {
      const st = localStorage.getItem(ON_KEY);
      if (st === '0') return;
      if (!(await waitForUser())) return;
      const ok = await registerNative(st === null);
      if (ok && st === null) localStorage.setItem(ON_KEY, '1');
    } catch (e) { console.log('[native] subscribeToPush', e && e.message); }
  };

  window.checkPushStatus = async function () {
    const txt = document.getElementById('push-txt');
    const on = document.getElementById('push-on-btn');
    const off = document.getElementById('push-off-btn');
    if (!txt || !on || !off) return;
    let perm = { receive: 'prompt' };
    try { perm = await PN.checkPermissions(); } catch (e) {}
    if (perm.receive === 'denied') {
      txt.textContent = '⛔ Запрещено в настройках телефона';
      on.style.display = 'none'; off.style.display = 'none';
      return;
    }
    const enabled = localStorage.getItem(ON_KEY) === '1' && perm.receive === 'granted';
    txt.textContent = enabled ? '✅ Включены на этом устройстве' : '⭕ Не включены';
    on.style.display = enabled ? 'none' : 'block';
    off.style.display = enabled ? 'block' : 'none';
  };

  window.subscribePush = async function () {
    try {
      const ok = await registerNative(true);
      if (!ok) { toast('Разрешение не дано', true); return; }
      localStorage.setItem(ON_KEY, '1');
      toast('✅ Уведомления включены!');
      checkPushStatus();
    } catch (e) { toast('Ошибка: ' + (e.message || String(e)), true); }
  };

  window.unsubscribePush = async function () {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      localStorage.setItem(ON_KEY, '0');
      if (token) { try { await post({ unsubscribe: true, fcmToken: token }); } catch (e) {} }
      try { await PN.unregister(); } catch (e) {}
      localStorage.removeItem(TOKEN_KEY);
      toast('Уведомления отключены');
      checkPushStatus();
    } catch (e) { toast('Ошибка: ' + (e.message || String(e)), true); }
  };

  // ── открыли чат — убираем именно его пуши из шторки Android ──
  window.mcClearNative = async function (cardId, cardTitle) {
    try {
      const r = await PN.getDeliveredNotifications();
      const mine = (r.notifications || []).filter(n =>
        String((n.data && n.data.url) || '').includes('openCard=' + cardId) ||
        (cardTitle && (n.title === '💬 ' + cardTitle || String(n.body || '').includes('«' + cardTitle + '»')))
      );
      if (mine.length) await PN.removeDeliveredNotifications({ notifications: mine });
    } catch (e) { console.warn('clear native', e); }
  };
  // ── локальные будильники для интервальных напоминаний ──
  const LN = cap.Plugins && cap.Plugins.LocalNotifications;
  const ALARMS_KEY = 'mc_alarms';   // {cardId: номер последнего поставленного будильника}
  const ALARMS_AHEAD = 100;         // сколько будильников ставим вперёд
  const alarmsLoad = () => { try { return JSON.parse(localStorage.getItem(ALARMS_KEY) || '{}'); } catch (e) { return {}; } };
  const alarmsSave = m => { try { localStorage.setItem(ALARMS_KEY, JSON.stringify(m)); } catch (e) {} };
  function alarmBase(cardId) {
    let h = 0;
    for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) >>> 0;
    return (h % 20000) * 100000;
  }
  const alarmId = (cardId, k) => alarmBase(cardId) + (k % 100000);

  async function alarmsPerm(ask) {
    try {
      let p = await LN.checkPermissions();
      if (p.display !== 'granted' && ask) p = await LN.requestPermissions();
      if (p.display !== 'granted') return false;
    } catch (e) { return false; }
    try {
      const ex = await LN.checkExactNotificationSetting();
      if (ex.exact_alarm !== 'granted' && ask) {
        toast('Разреши «Будильники и напоминания» для этого приложения');
        await LN.changeExactNotificationSetting();
      }
    } catch (e) {}
    return true;
  }

  async function alarmsCancel(cardId) {
    const map = alarmsLoad();
    const lastK = map[cardId] || 0;
    try {
      const list = [];
      for (let k = 1; k <= lastK; k++) list.push({ id: alarmId(cardId, k) });
      if (list.length) await LN.cancel({ notifications: list });
    } catch (e) { console.log('[native] alarms cancel', e && e.message); }
    delete map[cardId];
    alarmsSave(map);
  }

  async function alarmsFill(card, run) {
    const every = parseInt(run.everyMin, 10);
    const start = Date.parse(run.startedAt);
    if (!every || isNaN(start)) return 0;
    const step = every * 60000;
    const now = Date.now();
    const kNow = Math.floor((now - start) / step);
    const map = alarmsLoad();
    const lastK = map[card.id] || 0;
    if (lastK - kNow >= 50) return 0; // запас ещё большой
    const end = new Date(); end.setHours(24, 0, 0, 0);
    const url = SITE_PREFIX + '?openSpace=' + encodeURIComponent(card.space_id) + '&openCard=' + encodeURIComponent(card.id);
    const items = [];
    let lastUsed = lastK;
    for (let k = Math.max(lastK + 1, kNow + 1); items.length < ALARMS_AHEAD; k++) {
      const t = start + k * step;
      if (t >= end.getTime()) break;
      if (t <= now + 3000) continue;
      items.push({
        id: alarmId(card.id, k),
        title: card.title || 'Напоминание',
        body: 'Напоминание · каждые ' + every + ' мин',
        channelId: 'mc_default',
        schedule: { at: new Date(t), allowWhileIdle: true },
        extra: { url }
      });
      lastUsed = k;
    }
    if (!items.length) return 0;
    await LN.schedule({ notifications: items });
    map[card.id] = lastUsed;
    alarmsSave(map);
    return items.length;
  }

  // проверка: что стоит — актуально ли, при необходимости снять или дозавести
  async function alarmsSync() {
    if (!LN || typeof cards === 'undefined' || !Array.isArray(cards)) return;
    const token = localStorage.getItem(TOKEN_KEY);
    const map = alarmsLoad();
    for (const cardId of Object.keys(map)) {
      const card = cards.find(c => c.id === cardId);
      if (!card) continue; // карточка из другого кабинета — не трогаем
      const run = (typeof intervalRunActive === 'function') ? intervalRunActive(card) : null;
      if (!run || card.status === 'done' || !token || run.localToken !== token) { await alarmsCancel(cardId); continue; }
      try { await alarmsFill(card, run); } catch (e) {}
    }
  }

  window.mcAlarmsStart = async function (card, run) {
    try {
      if (!LN || !localStorage.getItem(TOKEN_KEY)) return null;
      if (!(await alarmsPerm(true))) return null;
      await alarmsCancel(card.id);
      const n = await alarmsFill(card, run);
      return n > 0 ? localStorage.getItem(TOKEN_KEY) : null;
    } catch (e) { console.log('[native] alarms start', e && e.message); return null; }
  };
  window.mcAlarmsCancel = alarmsCancel;
  window.mcAlarmsSync = alarmsSync;

  if (LN) {
    LN.addListener('localNotificationActionPerformed', a => {
      const url = a && a.notification && a.notification.extra && a.notification.extra.url;
      openSiteUrl(url);
    });
    setInterval(alarmsSync, 60000);
    setTimeout(alarmsSync, 8000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) alarmsSync(); });
  }
  // ── старт: при каждом запуске обновляем токен, при первом запуске сами просим разрешение ──
  window.subscribeToPush();
})();
