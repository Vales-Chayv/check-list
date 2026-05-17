// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
async function openSettings() {
  try {
    const {data}=await sb.from('settings').select('*').eq('id',1).single();
    if(data){
      notifEnabled=data.notification_enabled;
      document.getElementById('set-hour').value=String(data.notification_hour);
      updateNotifToggleUI();
    }
  }catch{}
  checkPushStatus();
  document.getElementById('set-ov').classList.add('on');
}
function closeSettings() { document.getElementById('set-ov').classList.remove('on'); }
function toggleNotif() { notifEnabled=!notifEnabled; updateNotifToggleUI(); }
function updateNotifToggleUI() {
  const t=document.getElementById('notif-track');
  t.querySelector('.tog-knob').style.left=notifEnabled?'23px':'3px';
  t.style.background=notifEnabled?'var(--accent)':'var(--s1)';
}
async function saveSettings() {
  const hour=parseInt(document.getElementById('set-hour').value);
  try{
    const{error}=await sb.from('settings').update({notification_hour:hour,notification_enabled:notifEnabled}).eq('id',1);
    if(error)throw error;
    closeSettings(); toast('✓ Настройки сохранены');
  }catch(e){toast('Ошибка: '+e.message,true);}
}
function changePwd() {
  const v=document.getElementById('set-pwd').value.trim(); if(!v)return;
  localStorage.setItem('mc_pwd',v); document.getElementById('set-pwd').value='';
  toast('✓ Пароль изменён');
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
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('Разрешение не дано',true);return;}
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64toUint8(VAPID_PUB)});
    const device=/iPhone/.test(navigator.userAgent)?'iPhone':/Android/.test(navigator.userAgent)?'Android':'ПК';
    const res=await fetch(FUNC_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON},body:JSON.stringify({subscription:sub.toJSON(),deviceName:device})});
    if(!res.ok){const t=await res.text();throw new Error(`${res.status}: ${t.slice(0,120)}`);}
    toast('✅ Уведомления включены!'); checkPushStatus();
  }catch(e){toast('Ошибка: '+(e.message||String(e)),true);}
}

async function unsubscribePush() {
  try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();toast('Уведомления отключены');checkPushStatus();}
  catch(e){toast('Ошибка',true);}
}

