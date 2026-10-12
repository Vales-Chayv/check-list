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

  // ── старт: при каждом запуске обновляем токен, при первом запуске сами просим разрешение ──
  window.subscribeToPush();
})();
