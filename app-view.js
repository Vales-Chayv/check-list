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
  const dl = deadlineInfo(card.deadline);
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
        ${currentSpace?.type==='family'?`<div style="margin-top:8px;font-size:13px;color:var(--t2)">👤 ${card.assigned_to?`Задача для: <strong style="color:var(--accent)">${esc(card.assigned_to)}</strong>`:'<span style="opacity:.6">Для всех</span>'}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        <button onclick="closeView()" style="background:var(--s2);border:none;color:var(--t2);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px">✕</button>
        <button onclick="closeView();setTimeout(()=>openAddEntry('${id}'),200)" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:9px 16px;font-size:15px;font-weight:700;cursor:pointer">＋ Запись</button>
        <button onclick="if(confirm('Удалить карточку?')){closeView();deleteCardById('${id}')}" style="background:rgba(232,96,96,.15);color:var(--red);border:1px solid rgba(232,96,96,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">🗑 Удалить</button>
      </div>
    </div>
  </div>`;

  if(card.body) html+=`<div class="view-sec"><div class="view-lbl">Заметка</div><div style="font-size:15px;line-height:1.6;color:var(--t2)">${esc(card.body)}</div></div>`;

  if(entries.length) {
    const dc=entries.filter(e=>e.done).length;
    const sorted=[...entries.filter(e=>!e.done), ...entries.filter(e=>e.done)];
    html+=`<div class="view-sec"><div class="view-lbl">Записи (${dc}/${entries.length})</div>${sorted.map(e=>{
      const eAtts = e.attachments||[];
      const eImgs = eAtts.filter(a=>a.type?.startsWith('image/'));
      const eAudios = eAtts.filter(a=>a.type?.startsWith('audio/'));
      const eFiles = eAtts.filter(a=>!a.type?.startsWith('image/')&&!a.type?.startsWith('audio/'));
      let attHTML = '';
      if(eImgs.length) attHTML += `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">${eImgs.map(a=>`<img src="${a.data}" style="width:80px;height:80px;object-fit:cover;border-radius:7px;cursor:pointer" onclick="openImgDirect('${a.data}')">`).join('')}</div>`;
      if(eAudios.length) attHTML += eAudios.map(a=>`<audio controls src="${a.data}" style="width:100%;height:32px;margin-top:5px"></audio>`).join('');
      if(eFiles.length) attHTML += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${eFiles.map(f=>`<a href="${f.data}" download="${esc(f.name)}" class="file-action">📎${esc(f.name)}</a>`).join('')}</div>`;
      return `<div class="entry-row">
        <div class="entry-cb${e.done?' on':''}" onclick="viewToggleEntry('${id}','${e.id}')">${e.done?checkSVG():''}</div>
        <div style="flex:1">
          <div style="font-size:14px${e.done?';text-decoration:line-through;opacity:.45':''}" dir="auto">${esc(e.text)}</div>
          <div class="entry-date">${e.date}</div>
          ${attHTML}
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  if(imgs.length) html+=`<div class="view-sec"><div class="view-lbl">Фото (${imgs.length})</div><div style="display:flex;flex-wrap:wrap;gap:7px">${imgs.map((a,i)=>`<img src="${a.data}" style="width:95px;height:95px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,.1)" onclick="App.viewImg('${id}',${i})">`).join('')}</div></div>`;

  if(files.length) html+=`<div class="view-sec"><div class="view-lbl">Файлы</div><div style="display:flex;flex-wrap:wrap;gap:7px">${files.map(f=>{
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
  document.getElementById('ae-text').value = '';
  document.getElementById('ae-att-prev').innerHTML = '';

  // Populate extra fields with current card values
  if(card) {
    const catSel = document.getElementById('ae-cat');
    catSel.innerHTML = cats.map(c=>`<option value="${esc(c.name)}"${c.name===card.category?' selected':''}>${esc(c.name)}</option>`).join('');
    document.getElementById('ae-status').value = card.status||'new';
    document.getElementById('ae-priority').value = card.priority||'normal';
    document.getElementById('ae-deadline').value = card.deadline||'';
    // Ball
    document.querySelectorAll('#ae-seg-ball .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.ball===(card.ball||'')));
  }

  // Hide extra section
  document.getElementById('ae-extra').style.display = 'none';
  document.getElementById('ae-extra-arrow').textContent = '▼';

  document.getElementById('ae-ov').classList.add('on');
  setTimeout(() => { const ta = document.getElementById('ae-text'); ta.style.height='100px'; ta.focus(); }, 300);
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

function handleAEFiles(inp) {
  Array.from(inp.files).forEach(f => {
    if (f.size > 5*1024*1024) { alert(f.name+': макс 5МБ'); return; }
    const r = new FileReader();
    r.onload = ev => { aeAtts.push({id:uid(), name:f.name, type:f.type, data:ev.target.result}); renderAEPrev(); };
    r.readAsDataURL(f);
  });
  inp.value = '';
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
    aeVoiceRec.onstop = () => {
      const blob = new Blob(chunks, {type:'audio/webm'});
      const r = new FileReader();
      r.onload = ev => {
        aeAtts.push({id:uid(), name:'Голос.webm', type:'audio/webm', data:ev.target.result});
        renderAEPrev();
        if(aeStopResolve) { aeStopResolve(); aeStopResolve = null; }
      };
      r.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
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

async function saveAddEntry() {
  // If recording — stop and wait for audio to be added to aeAtts
  if (aeIsVoice) {
    await new Promise(resolve => {
      aeStopResolve = resolve;
      stopAEVoice();
    });
  }

  const text = document.getElementById('ae-text').value.trim();
  if (!text && !aeAtts.length) { toast('Введи текст или прикрепи файл', true); return; }
  const card = cards.find(c => c.id === aeCardId); if (!card) return;

  // Save entry
  const entry = {id:uid(), text, date:nowStr(), done:false, attachments:[...aeAtts]};
  card.entries = [entry, ...(card.entries||[])];

  // Save extra settings if expanded
  if(document.getElementById('ae-extra').style.display !== 'none') {
    card.category = document.getElementById('ae-cat').value;
    card.status = document.getElementById('ae-status').value;
    card.priority = document.getElementById('ae-priority').value;
    card.deadline = document.getElementById('ae-deadline').value || null;
    const ballBtn = document.querySelector('#ae-seg-ball .seg-btn.on');
    if(ballBtn) card.ball = ballBtn.dataset.ball;
  }

  // Auto-done if all entries checked
  if((card.entries||[]).length && (card.entries||[]).every(e=>e.done)) card.status='done';

  closeAddEntry();
  render();
  toast('✓ Запись добавлена');
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
