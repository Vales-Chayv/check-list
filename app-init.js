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
//  LOCK
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
function unlock(){const l=document.getElementById('lock');l.style.transition='opacity .25s';l.style.opacity='0';setTimeout(()=>{l.style.display='none';loadData().then(()=>checkURLParams());},250);}
(function(){
  const hasPwd = localStorage.getItem(PWD);
  if(!hasPwd) {
    // No password — skip lock screen
    document.getElementById('lock').style.display='none';
    loadData().then(()=>checkURLParams());
    return;
  }
  document.getElementById('lock-sub').textContent='Введи пароль для входа';
  document.getElementById('lock-note').textContent='';
  setTimeout(()=>document.getElementById('lock-inp').focus(),200);
})();
