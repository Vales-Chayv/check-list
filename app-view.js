// ═══════════════════════════════════════════
//  VIEW MODAL
// ═══════════════════════════════════════════
function openView(id) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  const col = catColor(card.category);
  const entries = card.entries||[];
  const atts = card.attachments||[];
  const imgs = atts.filter(a=>a.type?.startsWith('image/'));
  const files = atts.filter(a=>!a.type?.startsWith('image/'));
  const allDeadlines = [card.deadline, ...(card.entries||[]).filter(e=>!e.done&&e.deadline).map(e=>e.deadline)].filter(Boolean).sort();
  const dl = allDeadlines.length ? deadlineInfo(allDeadlines[0]) : null;
  const related = card.related_ids||[];
  const hist = card.history||[];

  let html = `<div style="background:${hex2rgba(col,.15)};border-bottom:3px solid ${hex2rgba(col,.5)};padding:16px 20px;position:sticky;top:0;z-index:10">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:9px">
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700;color:${col};line-height:1.3">${esc(card.title)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
          ${card.category?`<span style="font-size:12px;background:rgba(0,0,0,.2);padding:2px 10px;border-radius:10px;color:${col}">${esc(card.category)}</span>`:''}
          <span class="badge" style="color:${col}">${ST_LABELS[card.status]||''}</span>
          ${dl?`<span class="dl-badge ${dl.cls}">${dl.text}</span>`:''}
          ${card.ball==='mine'?'<span style="font-size:12px;opacity:.7">⚽ У меня</span>':card.ball==='theirs'?'<span style="font-size:12px;opacity:.7">⚽ У них</span>':''}
        </div>
        ${currentSpace?.type!=='family'?`<div style="display:flex;gap:5px;margin-top:8px">
          <button onclick="toggleBall('${id}','')" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;border:1px solid var(--b2);background:${!card.ball?'var(--s2)':'transparent'};color:${!card.ball?'var(--t1)':'var(--t3)'}">—</button>
          <button onclick="toggleBall('${id}','mine')" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;border:1px solid var(--b2);background:${card.ball==='mine'?'var(--s2)':'transparent'};color:${card.ball==='mine'?'var(--t1)':'var(--t3)'}">⚽ У меня</button>
          <button onclick="toggleBall('${id}','theirs')" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;border:1px solid var(--b2);background:${card.ball==='theirs'?'var(--s2)':'transparent'};color:${card.ball==='theirs'?'var(--t1)':'var(--t3)'}">⚽ У них</button>
        </div>`:''}
        ${currentSpace?.type==='family'?`<div style="margin-top:8px;font-size:13px;color:var(--t2)">👤 ${card.assigned_to?`Задача для: <strong style="color:var(--accent)">${esc(card.assigned_to)}</strong>`:'<span style="opacity:.6">Для всех</span>'}${card.created_by?`<span style="opacity:.5;margin-left:10px">✍️ ${esc(card.created_by)}</span>`:''}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        <button onclick="closeView()" style="background:var(--s2);border:none;color:var(--t2);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px">✕</button>
        <button onclick="closeView();setTimeout(()=>openAddEntry('${id}'),200)" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:9px 16px;font-size:15px;font-weight:700;cursor:pointer">＋ Запись</button>
		${card.status!=='done'&&view!=='today'?`<button onclick="toggleToday('${id}')" style="background:${card.today?'rgba(232,197,106,.3)':'rgba(232,197,106,.1)'};color:var(--accent);border:1px solid rgba(232,197,106,.3);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">${card.today?'✕ Убрать из списка':'☆ На сегодня'}</button>`:''}
		${card.status==='done'?`<button onclick="restoreCard('${id}')" style="background:rgba(91,184,122,.15);color:var(--green);border:1px solid rgba(91,184,122,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">↩ Вернуть</button>`:''}
        ${(currentSpace?.type!=='family'||(card.created_by&&card.created_by===localStorage.getItem('mc_current_member')))?
  (view==='today'
    ? `<button onclick="toggleToday('${id}');closeView()" style="background:rgba(232,96,96,.15);color:var(--red);border:1px solid rgba(232,96,96,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">✕ Убрать из списка</button>`
    : `<button onclick="if(confirm('Удалить карточку?')){closeView();deleteCardById('${id}')}" style="background:rgba(232,96,96,.15);color:var(--red);border:1px solid rgba(232,96,96,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">🗑 Удалить</button>`)
  :''}
      </div>
    </div>
  </div>`;


  if(entries.length) {
    const dc = entries.filter(e=>e.done).length;
    const sessionMap = new Map();
    entries.forEach(e => {
      const sid = e.sessionId || e.id;
      if(!sessionMap.has(sid)) sessionMap.set(sid, {sid, note:e.sessionNote||null, atts:e.sessionAtts||[], entries:[], creator:e.sessionCreator||'', date:e.date||''});
      sessionMap.get(sid).entries.push(e);
    });
    const sessions = [...sessionMap.values()];
    if(card.body && sessions.length) sessions[sessions.length-1].note = sessions[sessions.length-1].note || card.body;

    const isFamily = currentSpace?.type==='family' || currentSpace?.type==='group';
    const myName = localStorage.getItem('mc_current_member')||'';

    function entryRowHTML(e, textColor) {
      const eDl = e.deadline ? deadlineInfo(e.deadline) : null;
      if(!e.text) return '';
      const col = textColor||'var(--t1)';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid rgba(0,0,0,.1)">
        <div style="width:16px;height:16px;border-radius:3px;border:2px solid rgba(0,0,0,.4);flex-shrink:0;margin-top:2px;background:${e.done?'rgba(0,0,0,.4)':'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="viewToggleEntry('${id}','${e.id}')">${e.done?'<svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>':''}</div>
        <div style="flex:1">
          <div style="font-size:13px;color:${col};${e.done?'text-decoration:line-through;opacity:.5':''}" dir="auto">${esc(e.text)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:10px;color:rgba(0,0,0,.4);margin-top:1px">${e.date}</div>
            ${eDl?`<span style="font-size:10px;opacity:.7">⏰ ${eDl.text}</span>`:''}
          </div>
        </div>
      </div>`;
    }

    // Color pairs: top → bottom
    const colorPairs = {'#5bb87a':'#e85bb0','#a07de8':'#5bb87a','#e8c56a':'#e86060','#5b9ee8':'#e8a83a','#e85bb0':'#5bc8e8','#e86060':'#a07de8','#5bc8e8':'#e8c56a','#e8a83a':'#5b9ee8'};
    const clipColors = ['#e8c56a','#e86060','#5b9ee8','#a07de8','#e85bb0','#5bc8e8','#5bb87a','#e8a83a'];
    // Find index of last "my" sticker
    const myLastIdx = sessions.reduce((last, s, i) => (!s.creator||s.creator===myName) ? i : last, -1);

    function stickerHTML(s, si) {
      const creator = s.creator||'';
      const isMe = !creator || creator===myName;
      const memberColor = isMe ? '#5bb87a' : ((currentSpace?.members||[]).find(m=>m.name===creator)?.color||'#5b9ee8');
      const bottomColor = colorPairs[memberColor] || '#e8c56a';
      const clipColor = clipColors.find(c=>c!==memberColor&&c!==bottomColor) || '#e8c56a';
      const align = isMe ? 'flex-start' : 'flex-end';
      const sAtts = s.atts||[];
      const hasFiles = sAtts.length > 0;
      const stkId = 'stk_'+id+'_'+si;
      const showAddBtn = isMe && si === myLastIdx;
      const sImgs = sAtts.filter(a=>a.type?.startsWith('image/'));
      const sVideos = sAtts.filter(a=>a.type?.startsWith('video/'));
      const sAudios = sAtts.filter(a=>a.type?.startsWith('audio/'));
      const sFiles = sAtts.filter(a=>!a.type?.startsWith('image/')&&!a.type?.startsWith('video/')&&!a.type?.startsWith('audio/'));
      let filesHTML = '';
      if(sImgs.length) filesHTML+=`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">${sImgs.map(a=>`<img src="${a.data}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="openImgDirect('${a.data}')">`).join('')}</div>`;
      if(sVideos.length) filesHTML+=sVideos.map(a=>`<div style="width:80px;height:80px;border-radius:6px;overflow:hidden;cursor:pointer;position:relative;display:inline-block;margin:3px" onclick="openVideoViewer('${a.data}')"><video src="${a.data}" style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);font-size:20px">▶</div></div>`).join('');
      if(sAudios.length) filesHTML+=sAudios.map(a=>`<audio controls src="${a.data}" style="width:100%;height:32px;margin-top:4px"></audio>`).join('');
      if(sFiles.length) filesHTML+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${sFiles.map(f=>`<a href="${f.data}" download="${esc(f.name)}" style="font-size:12px;color:rgba(0,0,0,.7);background:rgba(0,0,0,.1);padding:3px 8px;border-radius:10px;text-decoration:none">📎${esc(f.name)}</a>`).join('')}</div>`;

      // Folded corner SVG
      const cornerHTML = hasFiles ? `<div onclick="toggleStickerFiles('${stkId}')" style="position:absolute;bottom:0;right:0;width:28px;height:28px;cursor:pointer;overflow:hidden;border-radius:0 0 10px 0">
        <div style="position:absolute;bottom:0;right:0;width:0;height:0;border-style:solid;border-width:28px 28px 0 0;border-color:transparent rgba(0,0,0,.25) transparent transparent"></div>
        <div style="position:absolute;bottom:2px;right:2px;width:0;height:0;border-style:solid;border-width:24px 24px 0 0;border-color:transparent ${bottomColor} transparent transparent"></div>
      </div>` : '';

      return `<div style="display:flex;justify-content:${align};margin:16px 0 4px">
        <div style="max-width:88%;min-width:55%">
          <!-- Top sticker -->
          <div style="background:${memberColor};border-radius:10px;padding:14px 14px 16px;box-shadow:2px 3px 10px rgba(0,0,0,.3);position:relative;z-index:2">
            <div style="position:absolute;top:-16px;${isMe?'left:14px':'right:14px'};transform:rotate(${isMe?'-12':'12'}deg);filter:drop-shadow(1px 1px 3px rgba(0,0,0,.4))"><svg width="20" height="32" viewBox="0 0 20 32" fill="none"><path d="M10 1C6.1 1 3 4.1 3 8v14c0 3.9 3.1 7 7 7s7-3.1 7-7V6h-2.5v16c0 2.5-2 4.5-4.5 4.5S5.5 24.5 5.5 22V8c0-1.9 1.6-3.5 3.5-3.5S12.5 6.1 12.5 8v14h2.5V8c0-3.9-3.1-7-7-7z" fill="${clipColor}"/></svg></div>
            ${creator?`<div style="font-size:10px;font-weight:700;color:rgba(0,0,0,.5);margin-bottom:6px;margin-top:8px">${esc(creator)} • ${s.date}</div>`:'<div style="margin-top:16px"></div>'}
            ${s.note?`<div style="font-size:13px;color:rgba(0,0,0,.75);margin-bottom:8px;font-style:italic;line-height:1.5;word-break:break-word;white-space:pre-wrap" dir="auto">${esc(s.note)}</div>`:''}
            ${s.entries.map(e=>entryRowHTML(e,'rgba(0,0,0,0.75)')).join('')}
            ${showAddBtn?`<button onclick="openAddEntry('${id}','${s.sid}',true)" style="margin-top:8px;background:rgba(0,0,0,.1);border:none;border-radius:20px;padding:4px 12px;font-size:12px;color:rgba(0,0,0,.6);cursor:pointer;font-family:inherit">＋ Добавить</button>`:''}
            ${cornerHTML}
          </div>
          <!-- Bottom layer peek + content -->
          ${hasFiles?`
            <div style="height:14px;background:${bottomColor};border-radius:0 0 8px 8px;transform:rotate(-1.5deg);transform-origin:left bottom;margin-top:-4px;position:relative;z-index:1"></div>
            <div id="${stkId}" style="display:none;background:${bottomColor};border-radius:0 0 10px 10px;padding:12px 14px;position:relative;z-index:1;margin-top:-4px">${filesHTML}</div>
          `:''}
        </div>
      </div>`;
    }

    function plainSessionHTML(s, si) {
      const sep = si > 0 ? '<div style="height:1px;background:var(--b1);margin:8px 0"></div>' : '';
      const noteHTML = s.note ? `<div style="font-size:13px;color:var(--t1);padding:5px 0 4px;font-style:italic">${esc(s.note)}</div>` : '';
      const entriesHTML = s.entries.map(e=>entryRowHTML(e,null)).join('');
      const sAtts = s.atts||[];
      const sImgs = sAtts.filter(a=>a.type?.startsWith('image/'));
      const sAudios = sAtts.filter(a=>a.type?.startsWith('audio/'));
      const sVideos = sAtts.filter(a=>a.type?.startsWith('video/'));
      const sFiles = sAtts.filter(a=>!a.type?.startsWith('image/')&&!a.type?.startsWith('video/')&&!a.type?.startsWith('audio/'));
      let sAttHTML = '';
      if(sImgs.length) sAttHTML+=`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">${sImgs.map(a=>`<img src="${a.data}" style="width:80px;height:80px;object-fit:cover;border-radius:7px;cursor:pointer" onclick="openImgDirect('${a.data}')">`).join('')}</div>`;
      if(sVideos.length) sAttHTML+=sVideos.map(a=>`<div style="width:95px;height:95px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;display:inline-block" onclick="openVideoViewer('${a.data}')"><video src="${a.data}" style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);font-size:24px">▶</div></div>`).join('');
      if(sAudios.length) sAttHTML+=sAudios.map(a=>`<audio controls src="${a.data}" style="width:100%;height:32px;margin-top:5px"></audio>`).join('');
      if(sFiles.length) sAttHTML+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${sFiles.map(f=>`<a href="${f.data}" download="${esc(f.name)}" class="file-action">📎${esc(f.name)}</a>`).join('')}</div>`;
      return sep + noteHTML + entriesHTML + sAttHTML;
    }

    const sessionsHTML = sessions.map((s,si) => isFamily ? stickerHTML(s,si) : plainSessionHTML(s,si)).join('');
    html+=`<div class="view-sec">${!isFamily?`<div class="view-lbl">Записи (${dc}/${entries.filter(e=>e.text).length})</div>`:''}${sessionsHTML}</div>`;
  }

  if(imgs.length) html+=`<div class="view-sec"><div class="view-lbl">Фото (${imgs.length})</div><div style="display:flex;flex-wrap:wrap;gap:7px">${imgs.map((a,i)=>`<img src="${a.data}" style="width:95px;height:95px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,.1)" onclick="App.viewImg('${id}',${i})">`).join('')}</div></div>`;

  if(files.length) html+=`<div class="view-sec"><div class="view-lbl">Файлы</div><div style="display:flex;flex-wrap:wrap;gap:7px">${files.map(f=>{
	if(f.type?.startsWith('video/')) return`<div style="width:95px;height:95px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;display:inline-block" onclick="openVideoViewer('${f.data}')"><video src="${f.data}" style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);font-size:24px">▶</div></div>`;
    if(f.type?.startsWith('audio/')) return`<div style="width:100%"><div style="font-size:12px;color:var(--t3);margin-bottom:4px">🎙 ${esc(f.name)}</div><audio controls src="${f.data}" style="width:100%;height:36px"></audio></div>`;
    if(f.type?.includes('pdf')) return`<a href="${f.data}" target="_blank" class="file-action">📄${esc(f.name)}</a>`;
    return`<a href="${f.data}" download="${esc(f.name)}" class="file-action">📎${esc(f.name)} ⬇</a>`;
  }).join('')}</div></div>`;

  if(related.length) {
    const chips=related.map(rid=>{const rc=cards.find(x=>x.id===rid);if(!rc)return'';const rc_col=catColor(rc.category);return`<div onclick="closeView();setTimeout(()=>openView('${rid}'),200)" style="cursor:pointer;padding:4px 11px;border-radius:18px;font-size:13px;background:${hex2rgba(rc_col,.15)};border:1px solid ${hex2rgba(rc_col,.35)};color:${rc_col}">🔗${esc(rc.title)}</div>`;}).join('');
    if(chips) html+=`<div class="view-sec"><div class="view-lbl">Связанные</div><div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div></div>`;
  }

  document.getElementById('view-content').innerHTML=html;
  document.getElementById('view-ov').classList.add('on');
}

function closeView() { document.getElementById('view-ov').classList.remove('on'); }

async function toggleBall(cardId, val) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  card.ball = val;
  render(); openView(cardId);
  try { await dbUpdate(card); } catch(e) { toast('Ошибка синхронизации', true); }
}

function openImgDirect(src) {
  imgScale = 1;
  const img = document.getElementById('viewer-img');
  img.src = src;
  img.style.transform = 'scale(1)';
  document.getElementById('img-viewer').style.display = 'flex';
}

async function viewToggleEntry(cardId, entryId) {
  const card=cards.find(c=>c.id===cardId); if(!card)return;
  // In family space: only assigned person (or everyone if null) can toggle
  if(currentSpace?.type==='family' && card.assigned_to) {
    const myName = currentUser?.display_name||'';
    if(myName.toLowerCase() !== card.assigned_to.toLowerCase()) {
      toast('Эта задача для ' + card.assigned_to, true); return;
    }
  }
  const e=(card.entries||[]).find(x=>x.id===entryId); if(!e)return;
  e.done=!e.done;
  // Обновляем дедлайн карточки на ближайший среди невыполненных записей
const activeDls = (card.entries||[]).filter(x=>!x.done&&x.deadline).map(x=>x.deadline).sort();
if(activeDls.length) card.deadline = activeDls[0];
  if((card.entries||[]).length>0&&(card.entries||[]).every(x=>x.done)){
    card.status='done';
    card.history=[...(card.history||[]),{date:nowStr(),text:'Все записи выполнены → Готово',type:'status'}];
  }
  render(); openView(cardId);
  try{await dbUpdate(card);}catch(err){toast('Ошибка синхронизации',true);}
}


// ─── QUICK ADD ENTRY ───────────────────────
let aeCardId = null, aeAtts = [], aeIsVoice = false, aeVoiceRec = null, aeWakeLock = null, aeStopResolve = null;
let aeStickerSessionId = null;

function openAddEntry(cardId, sessionId = null, hideNote = false) {
  aeCardId = cardId;
  aeStickerSessionId = sessionId;
  aeAtts = [];
  const card = cards.find(c => c.id === cardId);
  const title = card ? (card.title.length > 22 ? card.title.slice(0,20)+'…' : card.title) : '';
  document.getElementById('ae-card-title').textContent = '＋ Запись' + (title ? ' в «'+title+'»' : '');
  const noteEl = document.getElementById('ae-note');
  if(noteEl) { noteEl.value = ''; }
  if(noteEl) noteEl.style.display = (currentSpace?.type==='family' && !hideNote) ? 'block' : 'none';
  const noteLbl = noteEl?.previousElementSibling;
  if(noteLbl) noteLbl.style.display = (currentSpace?.type==='family' && !hideNote) ? 'block' : 'none';
  const listEl = document.getElementById('ae-entries-list');
  if(listEl) { listEl.innerHTML = ''; }
  document.getElementById('ae-att-prev').innerHTML = '';
  const dlEl = document.getElementById('ae-entry-deadline');
  if(dlEl) dlEl.value = card?.deadline||'';

  if(card) {
    const catSel = document.getElementById('ae-cat');
    catSel.innerHTML = cats.map(c=>`<option value="${esc(c.name)}"${c.name===card.category?' selected':''}>${esc(c.name)}</option>`).join('');
    document.getElementById('ae-status').value = card.status||'new';
    document.getElementById('ae-priority').value = card.priority||'normal';
    document.getElementById('ae-deadline').value = card.deadline||'';
    document.querySelectorAll('#ae-seg-ball .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.ball===(card.ball||'')));
  }

  document.getElementById('ae-extra').style.display = 'none';
  document.getElementById('ae-extra-arrow').textContent = '▼';
  document.getElementById('ae-ov').classList.add('on');
  setTimeout(() => { if(noteEl) noteEl.focus(); }, 300);
}

function toggleAEExtra(btn) {
  const el = document.getElementById('ae-extra');
  const arrow = document.getElementById('ae-extra-arrow');
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'flex';
  arrow.textContent = isOpen ? '▼' : '▲';
}

function closeAddEntry() {
  document.getElementById('ae-ov').classList.remove('on');
  if (aeIsVoice) stopAEVoice();
}

async function handleAEFiles(inp) {
  const files = Array.from(inp.files);
  inp.value = '';
  for(const f of files) {
    try {
      toast('⏳ Загрузка ' + f.name + '...');
      const att = await uploadToStorage(f);
      aeAtts.push(att);
      renderAEPrev();
    } catch(e) {
      toast('Ошибка загрузки: ' + e.message, true);
    }
  }
}

function renderAEPrev() {
  document.getElementById('ae-att-prev').innerHTML = aeAtts.map(a => {
    if (a.type?.startsWith('image/')) return `<div class="att-img"><img src="${a.data}" style="width:68px;height:68px;object-fit:cover;border-radius:7px"><button class="att-del" onclick="aeAtts=aeAtts.filter(x=>x.id!=='${a.id}');renderAEPrev()">✕</button></div>`;
    if (a.type?.startsWith('audio/')) return `<div class="att-file"><span style="color:var(--green)">🎙 ${esc(a.name)}</span></div>`;
    return `<div class="att-file">📎${esc(a.name.length>18?a.name.slice(0,16)+'…':a.name)}</div>`;
  }).join('');
}

function toggleAEVoice() {
  if (aeIsVoice) { stopAEVoice(); return; }
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
    const chunks = [];
    aeVoiceRec = new MediaRecorder(stream);
    aeVoiceRec.ondataavailable = e => chunks.push(e.data);
    aeVoiceRec.onstop = async () => {
  const blob = new Blob(chunks, {type:'audio/webm'});
  stream.getTracks().forEach(t => t.stop());
  try {
    const name = `Голос_${nowStr().replace(/[,:]/g,'-')}.webm`;
    const file = new File([blob], name, {type:'audio/webm'});
    const att = await uploadToStorage(file);
    aeAtts.push(att);
    renderAEPrev();
  } catch(e) {
    toast('Ошибка загрузки голоса: ' + e.message, true);
  }
  if(aeStopResolve) { aeStopResolve(); aeStopResolve = null; }
};
    aeVoiceRec.start(); aeIsVoice = true;
    if('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(wl => { aeWakeLock = wl; }).catch(()=>{});
    }
    const btn = document.getElementById('ae-voice-btn');
    btn.classList.add('recording'); btn.innerHTML = '⏹';
  }).catch(() => toast('Нет доступа к микрофону', true));
}

function stopAEVoice() {
  if (aeVoiceRec && aeVoiceRec.state !== 'inactive') aeVoiceRec.stop();
  aeIsVoice = false;
  if (aeWakeLock) { aeWakeLock.release(); aeWakeLock = null; }
  const btn = document.getElementById('ae-voice-btn');
  btn.classList.remove('recording'); btn.innerHTML = '🎙';
}

function aeAddEntryRow() {
  const wrap = document.getElementById('ae-entries-list'); if(!wrap) return;
  const div = document.createElement('div');
  div.className = 'entry-row';
  div.innerHTML = `<div class="entry-cb"></div>
    <div style="flex:1">
      <textarea dir="auto" placeholder="Текст записи..." oninput="autoResize(this)" style="background:transparent;border:none;border-bottom:1px solid var(--b1);color:var(--t1);font-size:14px;font-family:inherit;resize:none;min-height:36px;line-height:1.6;width:100%;padding:4px 0"></textarea>
    </div>
    <button onclick="this.closest('.entry-row').remove()" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:16px;padding:0 4px">✕</button>`;
  wrap.appendChild(div);
  setTimeout(()=>{ const ta=div.querySelector('textarea'); if(ta){ta.focus();autoResize(ta);} },50);
}

async function saveAddEntry() {
  if (aeIsVoice) {
    await new Promise(resolve => { aeStopResolve = resolve; stopAEVoice(); });
  }

  const sessionNote = (document.getElementById('ae-note')?.value||'').trim();
  const entryRows = document.getElementById('ae-entries-list')?.querySelectorAll('.entry-row')||[];
  const entryTexts = [...entryRows].map(r=>r.querySelector('textarea')?.value?.trim()).filter(Boolean);
  if(!sessionNote && !entryTexts.length && !aeAtts.length) { toast('Введи заметку или добавь запись', true); return; }
  const card = cards.find(c => c.id === aeCardId); if (!card) return;

  // Build session
  const sessionId = aeStickerSessionId || uid();
  const isNewSession = !aeStickerSessionId;
  const deadline = document.getElementById('ae-entry-deadline')?.value||null;
  const sessionEntries = [];
  const texts = entryTexts.length ? entryTexts : [''];
  texts.forEach((text, i) => {
    sessionEntries.push({
      id: uid(), text: text, date: nowStr(), done: false, attachments: [],
      sessionId,
      sessionNote: (i === 0 && isNewSession) ? (sessionNote||null) : null,
      sessionAtts: (i === 0) ? [...aeAtts] : [],
      sessionCreator: isNewSession ? (localStorage.getItem('mc_current_member')||currentUser?.display_name||'') : null,
      deadline
    });
  });
  card.entries = [...sessionEntries, ...(card.entries||[])];

  // Save extra settings if expanded
  if(document.getElementById('ae-extra').style.display !== 'none') {
    card.category = document.getElementById('ae-cat').value;
    card.status = document.getElementById('ae-status').value;
    card.priority = document.getElementById('ae-priority').value;
    card.deadline = document.getElementById('ae-deadline').value || null;
    const ballBtn = document.querySelector('#ae-seg-ball .seg-btn.on');
    if(ballBtn) card.ball = ballBtn.dataset.ball;
  }

  if(card.status === 'new') card.status = 'in_progress';
  if((card.entries||[]).filter(e=>e.text).length && (card.entries||[]).filter(e=>e.text).every(e=>e.done)) card.status='done';

  closeAddEntry();
  render();
  toast('✓ Сохранено');
  await dbUpdate(card);
  setTimeout(() => openView(aeCardId), 300);
}

async function deleteCardById(id) {
  cards = cards.filter(c => c.id !== id);
  render(); toast('Карточка удалена');
  await dbDelete(id);
}

// Ball segment in ae panel
document.getElementById('ae-seg-ball').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn'); if(!btn) return;
  document.querySelectorAll('#ae-seg-ball .seg-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
});
function toggleStickerFiles(id) {
  const el = document.getElementById(id);
  if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function openVideoViewer(src) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  div.innerHTML = `<video controls autoplay src="${src}" style="max-width:100%;max-height:90vh;border-radius:8px"></video>`;
  div.onclick = e => { if(e.target===div) div.remove(); };
  document.body.appendChild(div);
}
async function restoreCard(id) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  card.status = 'in_progress';
  card.history = [...(card.history||[]), {date:nowStr(), text:'Возвращена в работу', type:'status'}];
  render(); openView(id);
  try { await dbUpdate(card); } catch(e) { toast('Ошибка синхронизации', true); }
}
async function toggleToday(id) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  card.today = !card.today;
  render(); openView(id);
  try { await dbUpdate(card); } catch(e) { toast('Ошибка синхронизации', true); }
}
