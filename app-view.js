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

  let html = `<div style="background:${hex2rgba(col,.15)};border-bottom:3px solid ${hex2rgba(col,.5)};padding:16px 20px">
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
		${card.status==='done'?`<button onclick="restoreCard('${id}')" style="background:rgba(91,184,122,.15);color:var(--green);border:1px solid rgba(91,184,122,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">↩ Вернуть</button>`:''}
        <button onclick="if(confirm('Удалить карточку?')){closeView();deleteCardById('${id}')}" style="background:rgba(232,96,96,.15);color:var(--red);border:1px solid rgba(232,96,96,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">🗑 Удалить</button>
      </div>
    </div>
  </div>`;


  if(entries.length) {
    const dc = entries.filter(e=>e.done).length;
    // Group by sessionId (entries without sessionId = individual groups)
    const sessionMap = new Map();
    entries.forEach(e => {
      const sid = e.sessionId || e.id;
      if(!sessionMap.has(sid)) sessionMap.set(sid, {note:e.sessionNote||null, atts:e.sessionAtts||[], entries:[]});
      sessionMap.get(sid).entries.push(e);
    });
    const sessions = [...sessionMap.values()];
	if(card.body && sessions.length) sessions[sessions.length-1].note = sessions[sessions.length-1].note || card.body;
    function entryRowHTML(e) {
      const eDl = e.deadline ? deadlineInfo(e.deadline) : null;
      if(!e.text) return '';
      return `<div class="entry-row">
        <div class="entry-cb${e.done?' on':''}" onclick="viewToggleEntry('${id}','${e.id}')">${e.done?checkSVG():''}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
            <div style="font-size:14px${e.done?';text-decoration:line-through;opacity:.45':''};flex:1" dir="auto">${esc(e.text)}</div>
            ${eDl?`<span class="dl-badge ${eDl.cls}${eDl.days<=3?' dl-pulse':''}" style="font-size:11px;white-space:nowrap;flex-shrink:0">⏰ ${eDl.text}</span>`:''}
          </div>
          <div class="entry-date">${e.date}</div>
        </div>
      </div>`;
    }
    const sessionsHTML = sessions.map((s, si) => {
      const sep = si > 0 ? '<div style="height:1px;background:var(--b1);margin:8px 0"></div>' : '';
      const noteHTML = s.note ? `<div style="font-size:13px;color:var(--t1);padding:5px 0 4px;font-style:italic">${esc(s.note)}</div>` : '';
      const entriesHTML = s.entries.map(entryRowHTML).join('');
      const sAtts = s.atts||[];
      const sImgs = sAtts.filter(a=>a.type?.startsWith('image/'));
      const sAudios = sAtts.filter(a=>a.type?.startsWith('audio/'));
      const sFiles = sAtts.filter(a=>!a.type?.startsWith('image/')&&!a.type?.startsWith('audio/'));
      let sAttHTML = '';
      if(sImgs.length) sAttHTML+=`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">${sImgs.map(a=>`<img src="${a.data}" style="width:80px;height:80px;object-fit:cover;border-radius:7px;cursor:pointer" onclick="openImgDirect('${a.data}')">`).join('')}</div>`;
      const sVideos = sAtts.filter(a=>a.type?.startsWith('video/'));
if(sVideos.length) sAttHTML+=sVideos.map(a=>`<div style="width:95px;height:95px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;display:inline-block" onclick="openVideoViewer('${a.data}')"><video src="${a.data}" style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);font-size:24px">▶</div></div>`).join('');
if(sAudios.length) sAttHTML+=sAudios.map(a=>`<audio controls src="${a.data}" style="width:100%;height:32px;margin-top:5px"></audio>`).join('');
      if(sFiles.length) sAttHTML+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${sFiles.map(f=>`<a href="${f.data}" download="${esc(f.name)}" class="file-action">📎${esc(f.name)}</a>`).join('')}</div>`;
      return sep + noteHTML + entriesHTML + sAttHTML;
    }).join('');
    html+=`<div class="view-sec"><div class="view-lbl">Записи (${dc}/${entries.filter(e=>e.text).length})</div>${sessionsHTML}</div>`;
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
  if((card.entries||[]).length>0&&(card.entries||[]).every(x=>x.done)){
    card.status='done';
    card.history=[...(card.history||[]),{date:nowStr(),text:'Все записи выполнены → Готово',type:'status'}];
  }
  render(); openView(cardId);
  try{await dbUpdate(card);}catch(err){toast('Ошибка синхронизации',true);}
}


// ─── QUICK ADD ENTRY ───────────────────────
let aeCardId = null, aeAtts = [], aeIsVoice = false, aeVoiceRec = null, aeWakeLock = null, aeStopResolve = null;

function openAddEntry(cardId) {
  aeCardId = cardId;
  aeAtts = [];
  const card = cards.find(c => c.id === cardId);
  const title = card ? (card.title.length > 22 ? card.title.slice(0,20)+'…' : card.title) : '';
  document.getElementById('ae-card-title').textContent = '＋ Запись' + (title ? ' в «'+title+'»' : '');
  const noteEl = document.getElementById('ae-note');
  if(noteEl) { noteEl.value = ''; }
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
  const sessionId = uid();
  const deadline = document.getElementById('ae-entry-deadline')?.value||null;
  const sessionEntries = [];
  const texts = entryTexts.length ? entryTexts : [''];
  texts.forEach((text, i) => {
    sessionEntries.push({
      id: uid(), text, date: nowStr(), done: false, attachments: [],
      sessionId,
      sessionNote: i === 0 ? (sessionNote||null) : null,
      sessionAtts: i === 0 ? [...aeAtts] : [],
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
