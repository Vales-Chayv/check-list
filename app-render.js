// ═══════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════
let memberFilterOn = false;
function applyMemberFilter(arr) {
  if(!memberFilterOn) return arr;
  const name = localStorage.getItem('mc_current_member')||'';
  return arr.filter(c => c.assigned_to === name);
}
function render() {
  // Inject pulse animation once
  if(!document.getElementById('dl-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'dl-pulse-style';
    s.textContent = '@keyframes dl-pulse{0%,100%{opacity:1}50%{opacity:.35}} .dl-pulse{animation:dl-pulse 1.8s ease-in-out infinite}';
    document.head.appendChild(s);
  }
  renderCats(); renderMain();
  desktopCalSync();
}
function openPinStrip(){ document.getElementById('pin-strip-ov').classList.add('on'); }
function closePinStrip(){ document.getElementById('pin-strip-ov').classList.remove('on'); }
function closePinPopup(){ document.getElementById('pin-popup-ov').classList.remove('on'); }
async function openPinPopup(){
  document.getElementById('pin-popup-ov').classList.add('on');
  document.getElementById('pin-popup-list').innerHTML = '<div style="text-align:center;color:var(--t3);padding:30px">Загрузка…</div>';
  let pinned = [];
  try {
    const ids = spaces.map(s=>s.id);
    const { data } = await sb.from('cards').select('*').in('space_id', ids).eq('pinned', true);
    pinned = data||[];
  } catch(e) { pinned = (cards||[]).filter(c=>c.pinned); }
  window._pinnedCache = pinned;
  renderPinList();
}
function renderPinList(){
  const listEl = document.getElementById('pin-popup-list'); if(!listEl) return;
  const pinned = window._pinnedCache||[];
  if(!pinned.length){ listEl.innerHTML = '<div style="text-align:center;color:var(--t3);padding:30px">Нет закреплённых карточек</div>'; return; }
  const spaceName = id => (spaces.find(s=>s.id===id)?.name)||'';
  listEl.innerHTML = pinned.map(c=>{
    const ents = c.entries||[];
    const doneN = ents.filter(e=>e.done).length;
    return `<div style="display:flex;align-items:center;gap:8px;padding:11px 12px;border-radius:var(--rsm);border:1px solid var(--b1);background:var(--s2);margin-bottom:8px">
      <div onclick="openPinnedCard('${c.id}')" style="flex:1;min-width:0;cursor:pointer">
        <div style="font-size:14px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📌 ${esc(c.title)}</div>
        <div style="font-size:12px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🗂️ ${esc(spaceName(c.space_id))}${ents.length?` · записи ${doneN}/${ents.length}`:''}</div>
      </div>
      <button onclick="unpinFromPopup('${c.id}',event)" style="flex-shrink:0;background:var(--s1);border:1px solid var(--b1);color:var(--t2);border-radius:12px;padding:4px 10px;font-size:12px;cursor:pointer">Открепить</button>
    </div>`;
  }).join('');
}
async function unpinFromPopup(id, ev){
  if(ev) ev.stopPropagation();
  const inCurrent = (cards||[]).find(c=>c.id===id);
  const card = inCurrent || (window._pinnedCache||[]).find(c=>c.id===id);
  if(!card) return;
  card.pinned = false;
  if((card.entries||[]).length>0 && (card.entries||[]).every(e=>e.done)) card.status='done';
  try { await dbUpdate(card); } catch(e) {}
  if(inCurrent) render();
  window._pinnedCache = (window._pinnedCache||[]).filter(c=>c.id!==id);
  renderPinList();
}
async function openPinnedCard(id){
  const cached = (window._pinnedCache||[]).find(c=>c.id===id);
  const card = cached || (cards||[]).find(c=>c.id===id);
  closePinPopup(); closePinStrip();
  if(!card) return;
  const inCurrent = card.space_id === currentSpaceId;
  const sp = spaces.find(s=>s.id===card.space_id);
  const famLike = sp && (sp.type==='family' || sp.type==='group');
  if(inCurrent){
    openView(id);
  } else if(!famLike){
    // личный чужой кабинет: открыть без переключения (временно подложим карточку)
    if(!cards.some(c=>c.id===id)){ window._foreignCardId = id; cards.push(card); }
    openView(id);
  } else {
    // семейный чужой кабинет: пока со старым переключением
    await setCurrentSpace(card.space_id, true);
    let tries=0;
    (function waitOpen(){ if((cards||[]).some(c=>c.id===id)){ openView(id); return; } if(++tries>25) return; setTimeout(waitOpen,120); })();
  }
}

let filterNoDeadline = localStorage.getItem('mc_no_dl')==='1';
function cardHasNoDeadline(c){ return !c.deadline && (c.entries||[]).every(e=>!e.deadline); }
function toggleNoDeadline(){ filterNoDeadline=!filterNoDeadline; localStorage.setItem('mc_no_dl', filterNoDeadline?'1':'0'); render(); }
function renderCats() {
  const bar = document.getElementById('cats');
  const all = filterCat==='all';
  let html = `<button class="cat-btn${all?' on':''}" style="${all?'border-color:rgba(255,255,255,.25)':''}" onclick="handleAllCatClick()">Все ▾</button>`;
  if(view==='cards') html += `<button class="cat-btn${filterNoDeadline?' on':''}" style="${filterNoDeadline?'background:rgba(232,197,106,.15);border-color:var(--accent);color:var(--accent)':''}" onclick="toggleNoDeadline()">📅✕ Без срока</button>`;
  cats.forEach((c,i) => {
    const col = c.color||'#888';
    const active = filterCat===c.name;
    const bg = active ? hex2rgba(col,.15) : 'transparent';
    const border = active ? hex2rgba(col,.5) : 'rgba(255,255,255,.08)';
    html += `<button class="cat-btn${active?' on':''}" style="background:${bg};border-color:${border}" draggable="true"
      onclick="App.setCat(${i})"
      oncontextmenu="event.preventDefault();event.stopPropagation();App.deleteCat(${i});return false"
      ondragstart="App.startCatDrag(${i})"
      ondragover="event.preventDefault();App.dragCatOver(${i})"
      ondrop="event.preventDefault();App.dropCat(${i})"
      ontouchstart="App.startCatHold(${i},this);App.touchStartCat(${i},event)"
      ontouchend="App.cancelCatHold();App.touchEndCat(event)"
      ontouchmove="App.cancelCatHold();App.touchMoveCat(event)">
    <span class="cat-dot" style="background:${col}"></span>${esc(c.name)}</button>`;
  });
  bar.innerHTML = html;
}

function renderMain() {
  if(view==='cards') renderCards();
  else if(view==='today') renderToday();
  else if(view==='checklist') renderChecklist();
  else renderDone();
}

function renderCards() {
  const el=document.getElementById('scroll');
  const PO={urgent:0,high:1,normal:2};
 const filtered=applyMemberFilter(cards.filter(c=>c.status!=='done'&&(filterCat==='all'||c.category===filterCat)&&(!filterNoDeadline||cardHasNoDeadline(c))));
  if(!filtered.length){el.innerHTML=emptyHTML(filterNoDeadline?'Нет карточек без срока':'Нет карточек', filterNoDeadline?'Все карточки имеют дату':'Создай первую карточку');return;}

  // Separate urgent/high from normal
  const priority=filtered.filter(c=>c.priority==='urgent'||c.priority==='high')
    .sort((a,b)=>{
      const pd=PO[a.priority]-PO[b.priority];
      if(pd!==0) return pd;
      const da=a.deadline||'9999', db=b.deadline||'9999';
      return da.localeCompare(db);
    });
  const normal=filtered.filter(c=>!c.priority||c.priority==='normal');

  let html='';

  // Priority section always on top
  if(priority.length){
    html+=`<div class="date-lbl" style="color:var(--red)">🔥 Срочные и важные</div>`;
    html+=priority.map(c=>cardHTML(c)).join('');
  }

  // Normal cards grouped by date
  const grouped={};
  normal.forEach(c=>{const d=(c.created_at||today()).slice(0,10);(grouped[d]=grouped[d]||[]).push(c);});
  const dates=Object.keys(grouped).sort((a,b)=>a.localeCompare(b));
  html+=dates.map(d=>grouped[d].map(c=>cardHTML(c)).join('')).join('');

  el.innerHTML=html;
}
function renderToday() {
	function isCardOverdue(c) {
  const ent = c.entries || [];
  const dls = [c.deadline, ...ent.filter(e=>!e.done).map(e=>e.deadline)].filter(Boolean).sort();
  const info = dls.length ? deadlineInfo(dls[0]) : null;
  return !!(info && info.days < 0);
}
  const el = document.getElementById('scroll');
  const todayCards = applyMemberFilter(cards.filter(c=>(c.today || isCardOverdue(c)) && c.status!=='done'));
  if(!todayCards.length) { el.innerHTML = emptyHTML('Нет задач на сегодня', 'Добавь карточки кнопкой ☆ На сегодня'); return; }
  const PO = {urgent:0, high:1, normal:2};
  const priority = todayCards.filter(c=>c.priority==='urgent'||c.priority==='high')
    .sort((a,b)=>{ const pd=PO[a.priority]-PO[b.priority]; if(pd!==0) return pd; return (a.deadline||'9999').localeCompare(b.deadline||'9999'); });
  const normal = todayCards.filter(c=>!c.priority||c.priority==='normal');
  let html = '';
  if(priority.length) { html += `<div class="date-lbl" style="color:var(--red)">🔥 Срочные и важные</div>`; html += priority.map(c=>cardHTML(c)).join(''); }
  html += normal.map(c=>cardHTML(c)).join('');
  el.innerHTML = html;
}

function renderChecklist() {
  const el = document.getElementById('scroll');
  const PO = {urgent:0, high:1, normal:2};
  const rem = applyMemberFilter(cards.filter(c=>c.reminder?.enabled && c.status!=='done' && (filterCat==='all'||c.category===filterCat)));
  if(!rem.length){el.innerHTML=emptyHTML('Чек-лист пуст','Включи напоминание в карточке');return;}

  // Sort: urgent/high first, then by deadline
  rem.sort((a,b) => {
    const pa = PO[a.priority||'normal'], pb = PO[b.priority||'normal'];
    if(pa !== pb) return pa - pb;
    const da = a.deadline||'9999', db = b.deadline||'9999';
    return da.localeCompare(db);
  });

  const priority = rem.filter(c=>c.priority==='urgent'||c.priority==='high');
  const normal = rem.filter(c=>!c.priority||c.priority==='normal');

  function clItemHTML(card) {
    const col = catColor(card.category);
    const bg = hex2rgba(col,.12), border = hex2rgba(col,.3);
    const done = card.status==='done';
    const dl = deadlineInfo(card.deadline);
    const pBorder = card.priority==='urgent'?';border-left:4px solid var(--red)':card.priority==='high'?';border-left:4px solid var(--accent)':'';
    return `<div class="cl-item" style="background:${bg};border-color:${border}${pBorder}" onclick="App.openView('${card.id}')">
      <div class="cl-cb${done?' on':''}" onclick="event.stopPropagation();App.toggleDone('${card.id}')">${done?checkSVG():''}</div>
      <div style="flex:1">
        <div class="cl-title${done?' done':''}" style="color:${col}">${card.priority==='urgent'?'🔥 ':card.priority==='high'?'⚡ ':''}${esc(card.title)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
          ${card.category?`<span style="font-size:11px;opacity:.6">${esc(card.category)}</span>`:''}
          ${dl?`<span class="dl-badge ${dl.cls}${dl.days<=3?' dl-pulse':''}" style="font-size:11px">${dl.text}</span>`:''}
        </div>
      </div>
      <span class="badge" style="color:${col}">${ST_LABELS[card.status]||''}</span>
    </div>`;
  }

  let html = '';
  if(priority.length) {
    html += `<div class="date-lbl" style="color:var(--red)">🔥 Срочные и важные</div>`;
    html += priority.map(clItemHTML).join('');
    if(normal.length) html += `<div style="height:1px;background:var(--b1);margin:4px 0 8px"></div>`;
  }
  html += normal.map(clItemHTML).join('');
  el.innerHTML = html;
}

function renderDone() {
  const el = document.getElementById('scroll');
  const done = applyMemberFilter(cards.filter(c=>c.status==='done'&&(filterCat==='all'||c.category===filterCat)));
  if(!done.length){el.innerHTML=emptyHTML('Нет выполненных','Карточки со статусом «Готово» появятся здесь');return;}
  const grouped={};
  done.forEach(c=>{const d=(c.created_at||today()).slice(0,10);(grouped[d]=grouped[d]||[]).push(c);});
  const dates=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
  el.innerHTML=dates.map(d=>grouped[d].map(c=>cardHTML(c,true)).join('')).join('');
}

function emptyHTML(h,p) {
  return`<div class="empty"><div class="empty-icon">🗂️</div><h3>${h}</h3><p>${p}</p><button onclick="openEdit()" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:11px;padding:11px 26px;font-size:15px;font-weight:700;cursor:pointer">＋ Создать</button></div>`;
}

function checkSVG() { return'<svg width="11" height="9" viewBox="0 0 11 9"><path d="M1 4l3 3 6-6" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

function cardHTML(card, isDone=false) {
  const col = catColor(card.category);
  const bg = hex2rgba(col, isDone?.09:.13);
  const border = hex2rgba(col, isDone?.2:.35);
  const entries = [...(card.entries||[])].sort((a,b)=>(a.done===b.done)?0:a.done?1:-1);
  const doneEntries = entries.filter(e=>e.done).length;
  // Find nearest deadline among card and all undone entries
  const allDeadlines = [card.deadline, ...entries.filter(e=>!e.done).map(e=>e.deadline)]
    .filter(Boolean).sort();
  const dl = allDeadlines.length ? deadlineInfo(allDeadlines[0]) : null;
  const pcls = card.priority==='urgent'?'p-urgent':card.priority==='high'?'p-high':'';
  const pBadge = card.priority==='urgent'?'🔥':card.priority==='high'?'⚡':'';
  const isExp = expandedCards.has(card.id);
  const body = card.body||'';
  const bodyHTML = body ? `<div class="card-body${isExp?' exp':''}">${esc(body)}</div>${body.length>120?`<button class="read-more" onclick="event.stopPropagation();App.toggleExpand('${card.id}')">${isExp?'Свернуть ▲':'Читать далее ▼'}</button>`:''}` : '';
  const imgs = (card.attachments||[]).filter(a=>a.type?.startsWith('image/'));
  const files = (card.attachments||[]).filter(a=>!a.type?.startsWith('image/'));
  const imgsHTML = imgs.length?`<div class="imgs">${imgs.slice(0,4).map((a,i)=>`<img class="img-t" src="${a.data}" onclick="event.stopPropagation();App.viewImg('${card.id}',${i})">`).join('')}${imgs.length>4?`<div style="width:52px;height:52px;border-radius:7px;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">+${imgs.length-4}</div>`:''}</div>`:'';
  const filesHTML = files.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${files.map(f=>`<span class="file-chip">📎${esc(f.name.length>18?f.name.slice(0,16)+'…':f.name)}</span>`).join('')}</div>`:'';
  const entriesHTML = entries.length?`<div class="entries-mini"><div style="font-size:11px;opacity:.55;margin-bottom:2px">Записи: ${doneEntries}/${entries.length}</div>${entries.slice(0,3).map(e=>`<div class="em-row"><div class="em-cb${e.done?' on':''}" onclick="event.stopPropagation();App.toggleEntry('${card.id}','${e.id}')">${e.done?checkSVG():''}</div><span class="em-text${e.done?' done':''}">${esc((t=>t.length>40?t.slice(0,38)+'…':t)(stripTags(e.text)))}</span></div>`).join('')}${entries.length>3?`<div style="font-size:11px;opacity:.4;padding-left:20px">...+${entries.length-3}</div>`:''}</div>`:'';
  const hist=card.history||[];
  const lastChg=hist.length?`<span style="font-size:10px;opacity:.45;margin-left:auto">${hist[hist.length-1].date}</span>`:'';

  return`<div class="card ${pcls}" style="background:${bg};border-color:${border}${isDone?';opacity:.75':''}" onclick="App.openView('${card.id}')">
<div style="display:flex;justify-content:space-between;gap:7px;align-items:flex-start">
      <button onclick="event.stopPropagation();App.togglePin('${card.id}')" title="${card.pinned?'Открепить':'Закрепить'}" style="background:none;border:none;cursor:pointer;font-size:16px;padding:0;line-height:1;flex-shrink:0;margin-top:1px;${card.pinned?'':'opacity:.28;filter:grayscale(1)'}">📌</button>
      <div style="flex:1;min-width:0">
        <div class="card-title" style="color:${col};${isDone?'text-decoration:line-through;opacity:.7':''}">${card.reminder?.enabled?'🔔 ':''}${pBadge}${esc(card.title)}</div>
        ${bodyHTML}${entriesHTML}${imgsHTML}${filesHTML}
        <div class="card-meta">
          ${card.category?`<span class="cat-tag">${esc(card.category)}</span>`:''}
          ${currentSpace?.type==='family'
            ? (card.assigned_to?`<span style="font-size:11px;background:rgba(232,197,106,.15);color:var(--accent);padding:2px 8px;border-radius:10px">👤 ${esc(card.assigned_to)}</span>`:'<span style="font-size:11px;opacity:.5">👨‍👩‍👧 Для всех</span>')
            : (card.ball==='mine'?'<span style="font-size:11px;opacity:.7">⚽ У меня</span>':card.ball==='theirs'?'<span style="font-size:11px;opacity:.7">⚽ У них</span>':'')}
          ${lastChg}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        <span class="badge" style="color:${col}">${ST_LABELS[card.status]||''}</span>
        ${dl&&!isDone?`<span class="dl-badge ${dl.cls}${dl.days<=3?' dl-pulse':''}" style="font-size:11px">${dl.text}</span>`:''}
        ${(currentSpace?.type!=='family'||(card.created_by&&card.created_by===localStorage.getItem('mc_current_member')))?`<button class="edit-btn" onclick="event.stopPropagation();openEdit('${card.id}')">✏️</button><button class="edit-btn" onclick="event.stopPropagation();moveCardToSpace('${card.id}')" title="Переместить в кабинет">↪️</button>`:''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
//  APP ACTIONS (called from inline HTML via App.*)
// ═══════════════════════════════════════════
const App = {
  setCat(idx) { filterCat = idx===-1 ? 'all' : cats[idx].name; render(); },
  _catHoldTimer: null,
  _dragIdx: null,
  _touchDragIdx: null, _touchStartX: 0, _touchStartY: 0, _touchDragging: false, _touchOverIdx: undefined,
  startCatDrag(idx) { App._dragIdx = idx; },
  dragCatOver(idx) { App._dragOverIdx = idx; },
  dropCat(idx) {
    if(App._dragIdx === null || App._dragIdx === idx) { App._dragIdx = null; return; }
    const moved = cats.splice(App._dragIdx, 1)[0];
    cats.splice(idx, 0, moved);
    App._dragIdx = null;
    render(); saveCatsOrder();
  },
  touchStartCat(idx, e) {
    App._touchDragIdx = idx;
    App._touchStartX = e.touches[0].clientX;
    App._touchStartY = e.touches[0].clientY;
    App._touchDragging = false;
  },
  touchMoveCat(e) {
    if(App._touchDragIdx === null) return;
    const dx = e.touches[0].clientX - App._touchStartX;
    const dy = e.touches[0].clientY - App._touchStartY;
    if(Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      App._touchDragging = true;
      const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      const btn = el?.closest('.cat-btn');
      if(btn) {
        const btns = [...document.querySelectorAll('#cats .cat-btn')].slice(1);
        App._touchOverIdx = btns.indexOf(btn);
      }
    }
  },
  touchEndCat(e) {
    if(App._touchDragging && App._touchDragIdx !== null && App._touchOverIdx !== undefined && App._touchOverIdx !== -1 && App._touchDragIdx !== App._touchOverIdx) {
      const moved = cats.splice(App._touchDragIdx, 1)[0];
      cats.splice(App._touchOverIdx, 0, moved);
      render(); saveCatsOrder();
    }
    App._touchDragIdx = null; App._touchDragging = false; App._touchOverIdx = undefined;
  },
  startCatHold(idx, el) {
    App._catHoldTimer = setTimeout(() => { App._catHoldTimer=null; App.deleteCat(idx); }, 1800);
  },
  cancelCatHold() {
    if(App._catHoldTimer) { clearTimeout(App._catHoldTimer); App._catHoldTimer=null; }
  },
  deleteCat(idx) {
    const cat = cats[idx]; if(!cat) return;
    const active = cards.filter(c=>c.category===cat.name && c.status!=='done');
    if(active.length) { toast('Нельзя удалить — есть ' + active.length + ' активных карточек', true); return; }
    if(!confirm('Удалить рубрику «' + cat.name + '»?')) return;
    cats.splice(idx, 1);
    if(filterCat === cat.name) filterCat = 'all';
    render();
    // Remove from DB
    const delCat = sb.from('categories').delete().eq('name', cat.name);
    (currentSpaceId ? delCat.eq('space_id', currentSpaceId) : delCat.is('space_id', null)).then(()=>{});
    local.delete('categories', cat.name);
    toast('Рубрика удалена');
  },
  toggleExpand(id) { expandedCards.has(id)?expandedCards.delete(id):expandedCards.add(id); render(); },
  viewImg(cardId,i) {
    const card=cards.find(c=>c.id===cardId); if(!card)return;
    const imgs=(card.attachments||[]).filter(a=>a.type?.startsWith('image/'));
    if(!imgs[i])return;
    const img=document.getElementById('viewer-img');
    img.src=imgs[i].data;
    img.style.transform='scale(1)';
    imgScale=1;
    document.getElementById('img-viewer').style.display='flex';
    history.pushState({app:true,viewer:true},'');
  },
  openView(id) { openView(id); },
  toggleDone(id) { toggleDone(id); },
 togglePin(id) {
    const card = cards.find(c=>c.id===id); if(!card) return;
    card.pinned = !card.pinned;
    if(!card.pinned && (card.entries||[]).length>0 && (card.entries||[]).every(e=>e.done)) card.status='done';
    render(); dbUpdate(card);
    toast(card.pinned?'📌 Закреплено':'Откреплено');
  },
  toggleEntry(cardId,entryId) {
    if(currentSpace?.type==='family') {
      const card = cards.find(c=>c.id===cardId);
      if(card?.assigned_to) {
        const myName = currentUser?.display_name||'';
        if(myName.toLowerCase() !== card.assigned_to.toLowerCase()) {
          toast('Эта задача для ' + card.assigned_to, true); return;
        }
      }
    }
    toggleEntry(cardId,entryId);
  },
};

function closeImgViewer() { document.getElementById('img-viewer').style.display='none'; imgScale=1; imgTransX=0; imgTransY=0; }

function saveCatsOrder() {
  const key = 'mc_cats_order_' + (currentSpaceId||'personal');
  localStorage.setItem(key, JSON.stringify(cats.map(c=>c.name)));
}

function applyCatsOrder() {
  const key = 'mc_cats_order_' + (currentSpaceId||'personal');
  const order = JSON.parse(localStorage.getItem(key)||'[]');
  if(!order.length) return;
  cats.sort((a,b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    if(ia===-1&&ib===-1) return 0;
    if(ia===-1) return 1;
    if(ib===-1) return -1;
    return ia-ib;
  });
}

// Pinch zoom for image viewer
let imgScale=1, imgLastDist=0;
(function setupImgZoom(){
  const viewer=document.getElementById('img-viewer');
  const img=document.getElementById('viewer-img');
  viewer.addEventListener('touchstart',e=>{
    if(e.touches.length===2)
      imgLastDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  },{passive:true});
  viewer.addEventListener('touchmove',e=>{
    if(e.touches.length===2){
      e.preventDefault();
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      imgScale=Math.min(Math.max(0.5,imgScale*(d/imgLastDist)),6);
      imgLastDist=d;
      img.style.transform=`scale(${imgScale})`;
    }
  },{passive:false});
  viewer.addEventListener('click',e=>{if(e.target===viewer)closeImgViewer();});
})();
function handleAllCatClick() {
  if(filterCat === 'all') {
    toggleCatsDropdown();
  } else {
    App.setCat(-1);
  }
}
function toggleCatsDropdown() {
  const dropdown = document.getElementById('cats-dropdown');
  const catsBar = document.getElementById('cats');
  if(!dropdown) return;
  if(dropdown.style.display !== 'none') { dropdown.style.display = 'none'; return; }
  // Fill with categories
  const all = filterCat==='all';
  let html = `<button class="cat-btn${all?' on':''}" style="display:block;width:100%;text-align:left;${all?'border-color:rgba(255,255,255,.25)':''}" onclick="App.setCat(-1);document.getElementById('cats-dropdown').style.display='none'">Все</button>`;
  cats.forEach((c,i) => {
    const col = c.color||'#888';
    const active = filterCat===c.name;
    html += `<button class="cat-btn${active?' on':''}" style="display:block;width:100%;text-align:left;background:${active?hex2rgba(col,.15):'transparent'};border-color:${active?hex2rgba(col,.5):'rgba(255,255,255,.08)'}" onclick="App.setCat(${i});document.getElementById('cats-dropdown').style.display='none'"><span class="cat-dot" style="background:${col}"></span>${esc(c.name)}</button>`;
  });
  dropdown.innerHTML = html;
  // Position below cats bar
  const rect = catsBar.getBoundingClientRect();
  dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.display = 'block';
  // Close on outside click
  setTimeout(()=>document.addEventListener('click', function h(e){
    if(!dropdown.contains(e.target)){dropdown.style.display='none';document.removeEventListener('click',h);}
  }), 150);
}

