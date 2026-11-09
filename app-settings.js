// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
async function openSettings() {
  try {
    const {data:prof} = await sb.from('profiles').select('phone').eq('id', currentUser?.id).single();
    const phoneInp = document.getElementById('set-phone');
    if(phoneInp) phoneInp.value = prof?.phone || '';
  } catch(e) {}
  checkPushStatus();
  updatePwdUI();
  mcWifiRow();
  document.getElementById('set-ov').classList.add('on');
}
async function savePhone() {
  const phone = document.getElementById('set-phone').value.trim();
  try {
    const {error} = await sb.from('profiles').update({phone: phone||null}).eq('id', currentUser.id);
    if(error) throw error;
    toast('✓ Телефон сохранён');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}
function closeSettings() { document.getElementById('set-ov').classList.remove('on'); }
async function saveSettings() { closeSettings(); }
function changePwd() {
  const v=document.getElementById('set-pwd').value.trim(); if(!v)return;
  localStorage.setItem('mc_pwd',v); document.getElementById('set-pwd').value='';
  updatePwdUI();
  toast('✓ Пароль сохранён');
}

function removePwd() {
  if(!confirm('Убрать пароль? Приложение будет открываться без пароля.')) return;
  localStorage.removeItem('mc_pwd');
  updatePwdUI();
  toast('✓ Пароль убран');
}

function updatePwdUI() {
  const hasPwd = !!localStorage.getItem('mc_pwd');
  document.getElementById('pwd-label').textContent = hasPwd ? 'Сменить пароль' : 'Добавить пароль';
  const removeBtn = document.getElementById('pwd-remove-btn');
  if(removeBtn) removeBtn.style.display = hasPwd ? 'block' : 'none';
}

// ═══════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ═══════════════════════════════════════════
function b64toUint8(b64){const p='='.repeat((4-b64.length%4)%4),b=(b64+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b);return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));}

async function checkPushStatus() {
  const txt=document.getElementById('push-txt'),on=document.getElementById('push-on-btn'),off=document.getElementById('push-off-btn');
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){txt.textContent='Не поддерживается этим браузером';return;}
  if(Notification.permission==='denied'){txt.textContent='⛔ Заблокировано в настройках браузера';return;}
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if(sub){txt.textContent='✅ Включены на этом устройстве';on.style.display='none';off.style.display='block';}
  else{txt.textContent='⭕ Не включены';on.style.display='block';off.style.display='none';}
}

async function subscribePush() {
  try {
    const perm = await Notification.requestPermission();
    if(perm !== 'granted') { toast('Разрешение не дано', true); return; }
    const ok = await subscribeToPush();
    if(!ok) { toast('Не удалось включить уведомления. Проверь, что ты вошла в аккаунт', true); return; }
    toast('✅ Уведомления включены!'); checkPushStatus();
  } catch(e) { toast('Ошибка: ' + (e.message || String(e)), true); }
}

async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub) {
      try {
        await fetch(FUNC_URL, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'apikey': SB_ANON, 'Authorization': 'Bearer ' + SB_ANON },
          body: JSON.stringify({ unsubscribe: true, endpoint: sub.endpoint })
        });
      } catch(e) {}
      await sub.unsubscribe();
    }
    toast('Уведомления отключены'); checkPushStatus();
  } catch(e) { toast('Ошибка', true); }
}


// ═══════════════════════════════════════════
//  БОЛЬШИЕ ФАЙЛЫ ТОЛЬКО ПО WI-FI (строка появляется только в приложении для телефона)
// ═══════════════════════════════════════════
function mcWifiRow() {
  try {
    const w = window.mcWifiOnly;
    if (!w || !w.available) return;
    let row = document.getElementById('wifi-row');
    if (!row) {
      const ph = document.getElementById('set-phone');
      const anchor = ph && ph.closest('.fld');
      if (!anchor || !anchor.parentNode) return;
      row = document.createElement('div');
      row.id = 'wifi-row';
      row.style.cssText = 'background:var(--s2);border-radius:var(--rsm);padding:13px 14px';
      row.innerHTML = '<div class="toggle-row"><span style="font-size:15px;font-weight:600">📶 Большие файлы — только по Wi-Fi</span><div class="tog-track" id="wifi-track" onclick="toggleWifiBig()"><div class="tog-knob" id="wifi-knob"></div></div></div>' +
        '<div style="font-size:12px;color:var(--t2);margin-top:6px;line-height:1.5">Файлы больше 50 МБ ждут Wi-Fi и не тратят мобильный интернет. В журнале загрузок такой файл можно отправить сразу кнопкой «Загрузить сейчас».</div>';
      anchor.parentNode.insertBefore(row, anchor);
    }
    mcWifiPaint();
  } catch (e) {}
}
function mcWifiPaint() {
  const on = !!(window.mcWifiOnly && window.mcWifiOnly.get());
  const t = document.getElementById('wifi-track'), k = document.getElementById('wifi-knob');
  if (t) t.style.background = on ? 'var(--accent)' : '#555';
  if (k) k.style.left = on ? '23px' : '3px';
}
function toggleWifiBig() {
  const w = window.mcWifiOnly; if (!w) return;
  w.set(!w.get());
  mcWifiPaint();
  toast(w.get() ? '📶 Большие файлы — только по Wi-Fi' : 'Большие файлы грузятся по любой сети');
}
