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

  const PN = cap.Plugins && cap.Plugins.PushNotifications;
  if (!PN) { console.log('[native] плагин PushNotifications не найден'); return; }

  const TOKEN_KEY = 'mc_fcm_token';
  const ON_KEY = 'mc_native_push'; // '1' — включены, '0' — выключены вручную, пусто — ещё не выбирали
  const SITE_PREFIX = 'https://vales-chayv.github.io/check-list/';
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
    if (url && url.indexOf(SITE_PREFIX) === 0 && url !== location.href) location.href = url;
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
      if (url && url.indexOf(SITE_PREFIX) === 0 && url !== location.href) location.href = url;
    });
    setInterval(alarmsSync, 60000);
    setTimeout(alarmsSync, 8000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) alarmsSync(); });
  }
  // ── старт: при каждом запуске обновляем токен, при первом запуске сами просим разрешение ──
  window.subscribeToPush();
})();
