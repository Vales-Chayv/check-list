// ═══════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════
function render() {
  // Inject pulse animation once
  if(!document.getElementById('dl-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'dl-pulse-style';
    s.textContent = '@keyframes dl-pulse{0%,100%{opacity:1}50%{opacity:.35}} .dl-pulse{animation:dl-pulse 1.8s ease-in-out infinite}';
    document.head.appendChild(s);
  }
  renderCats(); renderMain();
}

function renderCats() {
  const bar = document.getElementById('cats');
  const all = filterCat==='all';
  let html = `<button class="cat-btn${all?' on':''}" style="${all?'border-color:rgba(255,255,255,.25)':''}" onclick="App.setCat(-1)">Все</button>`;
  cats.forEach((c,i) => {
    const col = c.color||'#888';
    const active = filterCat===c.name;
    const bg = active ? hex2rgba(col,.15) : 'transparent';
    const border = active ? hex2rgba(col,.5) : 'rgba(255,255,255,.08)';
    html += `<button class="cat-btn${active?' on':''}" style="background:${bg};border-color:${border}"
      onclick="App.setCat(${i})"
      oncontextmenu="event.preventDefault();event.stopPropagation();App.deleteCat(${i});return false"
      ontouchstart="App.startCatHold(${i},this)" ontouchend="App.cancelCatHold()" ontouchmove="App.cancelCatHold()">
      <span class="cat-dot" style="background:${col}"></span>${esc(c.name)}</button>`;
  });
  bar.innerHTML = html;
}

function renderMain() {
  if(view==='cards') renderCards();
  else if(view==='checklist') renderChecklist();
  else renderDone();
}

function renderCards() {
  const el=document.getElementById('scroll');
  const PO={urgent:0,high:1,normal:2};
  const filtered=cards.filter(c=>c.status!=='done'&&(filterCat==='all'||c.category===filterCat));
  if(!filtered.length){el.innerHTML=emptyHTML('Нет карточек','Создай первую карточку');return;}

  // Separate urgent/high from normal
  const priority=filtered.filter(c=>c.priority==='urgent'||c.priority==='high')
    .sort((a,b)=>PO[a.priority]-PO[b.priority]);
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
  const dates=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
  html+=dates.map(d=>grouped[d].map(c=>cardHTML(c)).join('')).join('');

  el.innerHTML=html;
}

function renderChecklist() {
  const el = document.getElementById('scroll');
  const PO = {urgent:0, high:1, normal:2};
  const rem = cards.filter(c=>c.reminder?.enabled && c.status!=='done' && (filterCat==='all'||c.category===filterCat));
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
  const done = cards.filter(c=>c.status==='done'&&(filterCat==='all'||c.category===filterCat));
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
  const entries = card.entries||[];
  const doneEntries = entries.filter(e=>e.done).length;
  const dl = deadlineInfo(card.deadline);
  const pcls = card.priority==='urgent'?'p-urgent':card.priority==='high'?'p-high':'';
  const pBadge = card.priority==='urgent'?'🔥':card.priority==='high'?'⚡':'';
  const isExp = expandedCards.has(card.id);
  const body = card.body||'';
  const bodyHTML = body ? `<div class="card-body${isExp?' exp':''}">${esc(body)}</div>${body.length>120?`<button class="read-more" onclick="event.stopPropagation();App.toggleExpand('${card.id}')">${isExp?'Свернуть ▲':'Читать далее ▼'}</button>`:''}` : '';
  const imgs = (card.attachments||[]).filter(a=>a.type?.startsWith('image/'));
  const files = (card.attachments||[]).filter(a=>!a.type?.startsWith('image/'));
  const imgsHTML = imgs.length?`<div class="imgs">${imgs.slice(0,4).map((a,i)=>`<img class="img-t" src="${a.data}" onclick="event.stopPropagation();App.viewImg('${card.id}',${i})">`).join('')}${imgs.length>4?`<div style="width:52px;height:52px;border-radius:7px;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">+${imgs.length-4}</div>`:''}</div>`:'';
  const filesHTML = files.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${files.map(f=>`<span class="file-chip">📎${esc(f.name.length>18?f.name.slice(0,16)+'…':f.name)}</span>`).join('')}</div>`:'';
  const entriesHTML = entries.length?`<div class="entries-mini"><div style="font-size:11px;opacity:.55;margin-bottom:2px">Записи: ${doneEntries}/${entries.length}</div>${entries.slice(0,3).map(e=>`<div class="em-row"><div class="em-cb${e.done?' on':''}" onclick="event.stopPropagation();App.toggleEntry('${card.id}','${e.id}')">${e.done?checkSVG():''}</div><span class="em-text${e.done?' done':''}">${esc(e.text.length>40?e.text.slice(0,38)+'…':e.text)}</span></div>`).join('')}${entries.length>3?`<div style="font-size:11px;opacity:.4;padding-left:20px">...+${entries.length-3}</div>`:''}</div>`:'';
  const hist=card.history||[];
  const lastChg=hist.length?`<span style="font-size:10px;opacity:.45;margin-left:auto">${hist[hist.length-1].date}</span>`:'';

  return`<div class="card ${pcls}" style="background:${bg};border-color:${border}${isDone?';opacity:.75':''}" onclick="App.openView('${card.id}')">
    <div style="display:flex;justify-content:space-between;gap:7px;align-items:flex-start">
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
        <button class="edit-btn" onclick="event.stopPropagation();openEdit('${card.id}')">✏️</button>
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
  startCatHold(idx, el) {
    App._catHoldTimer = setTimeout(() => { App._catHoldTimer=null; App.deleteCat(idx); }, 600);
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
    sb.from('categories').delete().eq('name', cat.name).then(()=>{});
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

