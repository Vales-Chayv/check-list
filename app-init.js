// ═══════════════════════════════════════════
//  PWA
// ═══════════════════════════════════════════
const mf={name:'Мои карточки',short_name:'Карточки',start_url:'./',display:'standalone',background_color:'#0f0f0f',theme_color:'#0f0f0f',orientation:'portrait',icons:[{src:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f0f0f'/><text y='.9em' font-size='80' x='10'>🗂</text></svg>",sizes:'192x192',type:'image/svg+xml',purpose:'any maskable'}]};
document.getElementById('manifest-link').href=URL.createObjectURL(new Blob([JSON.stringify(mf)],{type:'application/json'}));
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/check-list/sw.js').catch(()=>{});
  // Listen for message from service worker to open checklist
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'OPEN_CHECKLIST') switchToChecklist();
  });
}

// Check URL param on load
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'checklist') switchToChecklist();
}

function switchToChecklist() {
  view = 'checklist';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === 'checklist'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.view === 'checklist'));
  render();
}

// ═══════════════════════════════════════════
//  ANDROID BACK BUTTON
// ═══════════════════════════════════════════
// Push a history state so back button can be intercepted
history.pushState({app:true}, '');
window.addEventListener('popstate', e => {
  // Close whichever modal is open, in priority order
  if(document.getElementById('ae-ov').classList.contains('on')) { closeAddEntry(); history.pushState({app:true},''); return; }
  if(document.getElementById('view-ov').classList.contains('on')) { closeView(); history.pushState({app:true},''); return; }
  if(document.getElementById('edit-ov').classList.contains('on')) { tryClose(); history.pushState({app:true},''); return; }
  if(document.getElementById('arch-ov').classList.contains('on')) { closeArchive(); history.pushState({app:true},''); return; }
  if(document.getElementById('set-ov').classList.contains('on')) { closeSettings(); history.pushState({app:true},''); return; }
  if(document.getElementById('img-viewer').style.display==='flex') { closeImgViewer(); history.pushState({app:true},''); return; }
  // Nothing open — push state again to prevent exit
  history.pushState({app:true}, '');
});

// ═══════════════════════════════════════════
//  LOCK (personal space password — handled by spaces)
// ═══════════════════════════════════════════
const PWD='mc_pwd';
function onLockInput(){document.getElementById('lock-btn').disabled=!document.getElementById('lock-inp').value;document.getElementById('lock-err').textContent='';document.getElementById('lock-inp').classList.remove('err');}
function toggleLockEye(){const i=document.getElementById('lock-inp'),h=i.type==='password';i.type=h?'text':'password';document.getElementById('lock-eye').textContent=h?'🙈':'👁';}
function doLogin(){
  const v=document.getElementById('lock-inp').value; if(!v)return;
  const s=localStorage.getItem(PWD);
  if(!s){localStorage.setItem(PWD,v);unlock();}
  else if(v===s){unlock();}
  else{const i=document.getElementById('lock-inp');i.classList.add('err');document.getElementById('lock-err').textContent='❌ Неверный пароль';i.value='';document.getElementById('lock-btn').disabled=true;setTimeout(()=>i.classList.remove('err'),600);}
}
function unlock(){const l=document.getElementById('lock');l.style.transition='opacity .25s';l.style.opacity='0';setTimeout(()=>{l.style.display='none';},250);}

// Hide lock screen — auth handles login now
document.getElementById('lock').style.display='none';

// Start with auth check
initAuth();
// ═══════════════════════════════════════════
//  INTERVAL REMINDERS
// ═══════════════════════════════════════════
let _intervalRemTimer = null;

let remQueue = [];
let remCurrentId = null;
let remCards = [];

async function loadReminderCards() {
  try {
    if(!spaces || !spaces.length) return;
    const { data } = await sb.from('cards').select('*').in('space_id', spaces.map(s=>s.id));
    remCards = (data||[]).filter(c => c.reminder && c.reminder.enabled);
  } catch(e) {}
}

function showReminderPopup(card) {
  const wrap = document.getElementById('rem-popups'); if(!wrap) return;
  if(remCurrentId) { // уже висит попап — ставим в очередь
    if(remCurrentId !== card.id && !remQueue.some(c => c.id === card.id)) remQueue.push(card);
    return;
  }
  remCurrentId = card.id;
  wrap.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'rem-pop';
  el.style.cssText = 'background:var(--s2);border:1px solid var(--accent);border-radius:var(--r);padding:14px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
  const more = remQueue.length;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">
      <span style="font-size:18px">🔔</span>
      <div style="flex:1;font-size:14px;font-weight:700;color:var(--t1);line-height:1.3">${esc(card.title)}</div>
      <button onclick="remDismiss()" style="background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer;line-height:1;padding:0">✕</button>
    </div>
    ${more ? `<div style="font-size:11px;color:var(--t3);margin-bottom:8px">Ещё напоминаний: ${more}</div>` : ''}
    <div style="display:flex;gap:6px">
      <button onclick="remPopupOpen('${esc(card.id)}')" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:8px;font-size:13px;font-weight:700;cursor:pointer">Открыть</button>
      <button onclick="remPopupSnooze('${esc(card.id)}',${(card.reminder&&card.reminder.intervalMin)||30})" style="background:var(--s1);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:8px 10px;font-size:13px;cursor:pointer;white-space:nowrap">Отложить 10 мин</button>
    </div>`;
  wrap.appendChild(el);
}

function showNextReminder() {
  remCurrentId = null;
  const wrap = document.getElementById('rem-popups'); if(wrap) wrap.innerHTML = '';
  const next = remQueue.shift();
  if(next) showReminderPopup(next);
}

function remDismiss() { showNextReminder(); }

async function remPopupOpen(id) {
  const card = remCards.find(c => c.id === id) || (cards||[]).find(c => c.id === id);
  showNextReminder();
  if(card && card.space_id && typeof currentSpaceId !== 'undefined' && card.space_id !== currentSpaceId && typeof setCurrentSpace === 'function') {
    await setCurrentSpace(card.space_id, true);
    setTimeout(() => { if(typeof openView === 'function') openView(id); }, 600);
  } else if(typeof openView === 'function') {
    openView(id);
  }
}

function remPopupSnooze(id, mins) {
  localStorage.setItem('rem_last_' + id, Date.now() + 10*60000 - (mins||30)*60000);
  toast('Отложено на 10 минут');
  showNextReminder();
}

function startIntervalReminders() {
  if(_intervalRemTimer) clearInterval(_intervalRemTimer);
  loadReminderCards();
  let remTick = 0;
  _intervalRemTimer = setInterval(() => {
    if(remTick % 5 === 0 || !remCards.length) loadReminderCards();
    remTick++;
    const now = Date.now();
    remCards.forEach(card => {
      if(!card.reminder || !card.reminder.enabled || card.reminder.freq !== 'interval') return;
      if(card.status === 'done') return;
      const mins = card.reminder.intervalMin || 30;
      const key = 'rem_last_' + card.id;
      const last = parseInt(localStorage.getItem(key)||'0');
      if(now - last >= mins * 60 * 1000) {
        localStorage.setItem(key, now);
        showReminderPopup(card);
        if(typeof Notification !== 'undefined' && Notification.permission === 'granted' && navigator.serviceWorker) {
          navigator.serviceWorker.ready.then(reg => reg.showNotification('🔔 Мои карточки', {
            body: card.title,
            icon: 'https://vales-chayv.github.io/check-list/icon-192.png',
            tag: 'card-' + card.id,
            renotify: true
          })).catch(()=>{});
        }
      }
    });
  }, 60 * 1000);
}

function askPushPermission() {
  if(typeof Notification === 'undefined') return;
  if(Notification.permission === 'granted') { startIntervalReminders(); return; }
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:16px;z-index:1000;box-shadow:0 4px 20px rgba(0,0,0,.4)';
  div.innerHTML = `<div style="font-size:15px;font-weight:700;margin-bottom:6px">🔔 Включить уведомления?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Получай напоминания о важных карточках</div>
    <div style="display:flex;gap:8px">
      <button onclick="enableReminders();this.closest('div[style*=fixed]').remove()" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:10px;font-size:14px;font-weight:700;cursor:pointer">Включить</button>
      <button onclick="toast('Можно включить в настройках ⚙️');this.closest('div[style*=fixed]').remove()" style="background:var(--s1);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:10px 14px;font-size:14px;cursor:pointer">Не сейчас</button>
    </div>`;
document.body.appendChild(div);
}
function enableReminders() {
  if(typeof Notification === 'undefined') { toast('Уведомления не поддерживаются', true); return; }
  Notification.requestPermission().then(p => {
    if(p === 'granted') { startIntervalReminders(); toast('🔔 Напоминания включены'); }
    else toast('Уведомления заблокированы', true);
  });
}
// запустить таймер при старте, если разрешение уже выдано
if(typeof Notification !== 'undefined' && Notification.permission === 'granted') startIntervalReminders();

// ── ПК: календарь как правая колонка (авто-открытие ≥900px) ──
let _deskCalOpened = false;
function desktopCalSync() {
if(window.innerWidth >= 900) {
    if(_deskCalOpened) { desktopCalRefresh(); return; }
    if(typeof spaces === 'undefined' || !spaces || !spaces.length) return;
    const ss = document.getElementById('space-selector');
    if(ss && ss.style.display !== 'none') return; // ещё в лобби — ждём входа в кабинет
    _deskCalOpened = true;
    if(typeof openCalendar === 'function') openCalendar();
  } else {
    if(_deskCalOpened) { _deskCalOpened = false; if(typeof closeCalendar === 'function') closeCalendar(); }
  }
}
window.addEventListener('resize', desktopCalSync);
let _deskCalRefreshT = null;
function desktopCalRefresh() {
  if(_deskCalRefreshT) clearTimeout(_deskCalRefreshT);
 _deskCalRefreshT = setTimeout(() => { if(typeof calRefreshData === 'function') calRefreshData(); }, 1000);
}

// ── Ручка-разделитель пропорций (ПК) ──
(function initSplitHandle() {
  const saved = localStorage.getItem('mc_split');
  if(saved) document.documentElement.style.setProperty('--split-left', saved);
  const h = document.getElementById('split-handle');
  if(!h) return;
  let dragging = false;
  const onMove = e => {
    if(!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    let pct = x / window.innerWidth * 100;
    pct = Math.max(25, Math.min(70, pct)); // границы 25%–70%
    document.documentElement.style.setProperty('--split-left', pct.toFixed(1) + '%');
    if(e.cancelable) e.preventDefault();
  };
  const onUp = () => {
    if(!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    localStorage.setItem('mc_split', getComputedStyle(document.documentElement).getPropertyValue('--split-left').trim());
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
    if(typeof renderCalendar === 'function') renderCalendar();
  };
  const onDown = e => {
    if(window.innerWidth < 900) return;
    dragging = true;
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    e.preventDefault();
  };
  h.addEventListener('mousedown', onDown);
  h.addEventListener('touchstart', onDown, { passive: false });
})();