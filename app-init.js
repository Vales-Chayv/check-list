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

function startIntervalReminders() {
  if(_intervalRemTimer) clearInterval(_intervalRemTimer);
  _intervalRemTimer = setInterval(() => {
    if(!cards) return;
    const now = Date.now();
    cards.forEach(card => {
      if(!card.reminder?.enabled || card.reminder?.freq !== 'interval') return;
      if(card.status === 'done') return;
      const mins = card.reminder.intervalMin || 30;
      const key = 'rem_last_' + card.id;
      const last = parseInt(localStorage.getItem(key)||'0');
      if(now - last >= mins * 60 * 1000) {
        localStorage.setItem(key, now);
        if(Notification.permission === 'granted') {
          new Notification('🔔 Мои карточки', {
            body: card.title,
            icon: 'https://vales-chayv.github.io/check-list/icon-192.png'
          });
        }
      }
    });
  }, 60 * 1000); // проверка каждую минуту
}
function askPushPermission() {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:16px;z-index:1000;box-shadow:0 4px 20px rgba(0,0,0,.4)';
  div.innerHTML = `<div style="font-size:15px;font-weight:700;margin-bottom:6px">🔔 Включить уведомления?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Получай напоминания о важных карточках</div>
    <div style="display:flex;gap:8px">
      <button onclick="subscribePush();this.closest('div[style*=fixed]').remove()" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:10px;font-size:14px;font-weight:700;cursor:pointer">Включить</button>
      <button onclick="toast('Можно включить в настройках ⚙️');this.closest('div[style*=fixed]').remove()" style="background:var(--s1);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:10px 14px;font-size:14px;cursor:pointer">Не сейчас</button>
    </div>`;
  document.body.appendChild(div);
}
