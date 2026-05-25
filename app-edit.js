// ═══════════════════════════════════════════
//  EDIT MODAL
// ═══════════════════════════════════════════
function openEdit(id) {
  editId=id||null;
  const card=id?cards.find(c=>c.id===id):null;
  tempAtt=JSON.parse(JSON.stringify(card?.attachments||[]));
  tempEntries=JSON.parse(JSON.stringify(card?.entries||[])).map(e=>({...e,_saved:true}));
  tempHist=JSON.parse(JSON.stringify(card?.history||[]));
  tempRelIds=[...(card?.related_ids||[])];
  remOn=card?.reminder?.enabled||false;
  ballVal=card?.ball||'';
  freqVal=card?.reminder?.freq||'daily';
  customDays=[...(card?.reminder?.days||[])];

  const isFamily = currentSpace?.type === 'family';

  document.getElementById('edit-title').textContent=card?'Редактировать':'Новая карточка';
  document.getElementById('e-title').value=card?.title||'';
  document.getElementById('e-body').value=card?.body||'';
  document.getElementById('e-deadline').value=card?.deadline||'';
  document.getElementById('e-priority').value=card?.priority||'normal';
  populateCatSel(card?.category);

  // Family vs personal fields
  document.getElementById('status-fld').style.display   = isFamily ? 'none' : '';
  document.getElementById('assigned-fld').style.display = isFamily ? '' : 'none';
  document.getElementById('ball-fld').style.display     = isFamily ? 'none' : '';

  if(isFamily) {
    const members = getSpaceMembers();
    const sel = document.getElementById('e-assigned');
    sel.innerHTML = '<option value="">👨‍👩‍👧 Для всех</option>' +
      members.map(m=>`<option value="${esc(m)}"${card?.assigned_to===m?' selected':''}>${esc(m)}</option>`).join('');
  } else {
    document.getElementById('e-status').value=card?.status||'new';
  }

  renderBall();
  renderAttPrev();
  renderEntriesEdit();
  renderHistList();
  renderRelatedList();
  updateRemUI();

  document.getElementById('del-btn').style.display=card?'block':'none';
  setSaveBtns(!!(card?.title));

  // Reset to first tab
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.querySelector('.mtab').classList.add('on');
  document.getElementById('p-main').classList.add('on');

  document.getElementById('edit-ov').classList.add('on');
  setTimeout(()=>{document.getElementById('e-title').focus(); originalState=getState();},300);
}

function getState() {
  return JSON.stringify({
    title:document.getElementById('e-title')?.value||'',
    body:document.getElementById('e-body')?.value||'',
    entries:tempEntries, deadline:document.getElementById('e-deadline')?.value||''
  });
}

function isDirty() { return originalState!==null && getState()!==originalState; }

// ═══════════════════════════════════════════
//  VOICE RECORDING
// ═══════════════════════════════════════════
let mediaRecorder=null, audioChunks=[], isRecording=false;

async function toggleVoice() {
  if(isRecording) {
    stopVoice();
  } else {
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      audioChunks=[];
      mediaRecorder=new MediaRecorder(stream);
      mediaRecorder.ondataavailable=e=>audioChunks.push(e.data);
      mediaRecorder.onstop=()=>{
        const blob=new Blob(audioChunks,{type:'audio/webm'});
        const r=new FileReader();
        r.onload=ev=>{
          tempAtt.push({id:uid(),name:`Голосовое_${nowStr().replace(/[,:]/g,'-')}.webm`,type:'audio/webm',data:ev.target.result});
          renderAttPrev();
        };
        r.readAsDataURL(blob);
        stream.getTracks().forEach(t=>t.stop());
      };
      mediaRecorder.start();
      isRecording=true;
      const btn=document.getElementById('voice-btn');
      btn.classList.add('recording');
      btn.innerHTML='⏹ Стоп';
    } catch(e) { toast('Нет доступа к микрофону',true); }
  }
}

function stopVoice() {
  if(mediaRecorder&&mediaRecorder.state!=='inactive') mediaRecorder.stop();
  isRecording=false;
  const btn=document.getElementById('voice-btn');
  btn.classList.remove('recording');
  btn.innerHTML='🎙';
}

// ═══════════════════════════════════════════
//  EXIT WARNING (system language)
// ═══════════════════════════════════════════
const EXIT_MSGS = {
  ru:'Вы действительно хотите выйти?',
  he:'האם אתה בטוח שברצונך לצאת?',
  en:'Are you sure you want to exit?',
  ar:'هل أنت متأكد أنك تريد الخروج؟',
};
function getExitMsg() {
  const lang=(navigator.language||'en').slice(0,2);
  return EXIT_MSGS[lang]||EXIT_MSGS.en;
}
window.addEventListener('beforeunload',e=>{
  if(isDirty()){e.preventDefault();e.returnValue=getExitMsg();}
});

function tryClose() {
  if(isDirty()&&!confirm('Есть несохранённые изменения. Выйти?'))return;
  originalState=null;
  document.getElementById('edit-ov').classList.remove('on');
  document.getElementById('new-cat-box').style.display='none';
}

function checkDirty() { setSaveBtns(!!(document.getElementById('e-title').value.trim())); }
function setSaveBtns(en) { ['save-btn','save-btn2','save-btn3'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=!en;}); }

// Cat select
function populateCatSel(sel) {
  const s=document.getElementById('e-cat');
  s.innerHTML=cats.map(c=>`<option value="${esc(c.name)}"${c.name===sel?' selected':''}>${esc(c.name)}</option>`).join('')+'<option value="__new">+ Новая рубрика</option>';
}
function onCatChange() { if(document.getElementById('e-cat').value==='__new'){document.getElementById('new-cat-box').style.display='flex';initPalette();} }
function initPalette() {
  document.getElementById('cat-pal').innerHTML=COLORS.map(c=>`<div class="swatch${c===newCatColor?' on':''}" style="background:${c}" onclick="pickColor('${c}',this)"></div>`).join('');
}
function pickColor(c,el) { newCatColor=c; document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('on')); el.classList.add('on'); }
async function addCat() {
  const nm=document.getElementById('e-new-cat').value.trim(); if(!nm)return;
  if(cats.find(c=>c.name===nm))return;
  const cat={name:nm,color:newCatColor};
  cats.push(cat); await dbAddCat(cat);
  populateCatSel(nm); document.getElementById('e-cat').value=nm;
  document.getElementById('new-cat-box').style.display='none';
  document.getElementById('e-new-cat').value='';
  renderCats();
}

// Ball
function renderBall() {
  document.querySelectorAll('#seg-ball .seg-btn').forEach(b=>{ b.classList.toggle('on', b.dataset.ball===ballVal); });
}
document.getElementById('seg-ball').addEventListener('click',e=>{
  const btn=e.target.closest('.seg-btn'); if(!btn)return;
  ballVal=btn.dataset.ball; renderBall();
});

// Reminder
function toggleRem() { remOn=!remOn; updateRemUI(); }
function updateRemUI() {
  const track=document.getElementById('rem-track');
  track.querySelector('.tog-knob').style.left=remOn?'23px':'3px';
  track.style.background=remOn?'var(--accent)':'var(--s1)';
  document.getElementById('rem-opts').style.display=remOn?'flex':'none';
  if(remOn){
    document.querySelectorAll('#seg-freq .seg-btn').forEach(b=>b.classList.toggle('on',b.dataset.freq===freqVal));
    document.getElementById('day-picker').style.display=freqVal==='custom'?'flex':'none';
    document.querySelectorAll('.day-btn').forEach(b=>b.classList.toggle('on',customDays.includes(+b.dataset.d)));
  }
}
document.getElementById('seg-freq').addEventListener('click',e=>{
  const btn=e.target.closest('.seg-btn'); if(!btn)return;
  freqVal=btn.dataset.freq;
  document.querySelectorAll('#seg-freq .seg-btn').forEach(b=>b.classList.toggle('on',b===btn));
  document.getElementById('day-picker').style.display=freqVal==='custom'?'flex':'none';
});
document.getElementById('days-row').addEventListener('click',e=>{
  const btn=e.target.closest('.day-btn'); if(!btn)return;
  const d=+btn.dataset.d; const i=customDays.indexOf(d);
  if(i>=0)customDays.splice(i,1); else{customDays.push(d);customDays.sort();}
  btn.classList.toggle('on',customDays.includes(d));
});

// Files
function handleFiles(inp) {
  Array.from(inp.files).forEach(f=>{
    if(f.size>5*1024*1024){alert(f.name+': макс 5МБ');return;}
    const r=new FileReader(); r.onload=ev=>{tempAtt.push({id:uid(),name:f.name,type:f.type,data:ev.target.result});renderAttPrev();}; r.readAsDataURL(f);
  }); inp.value='';
}
async function deleteCardById(id) {
  cards=cards.filter(c=>c.id!==id);
  render(); toast('Карточка удалена');
  await dbDelete(id);
}

function renderAttPrev() {
  document.getElementById('att-prev').innerHTML=tempAtt.map(a=>{
    if(a.type?.startsWith('image/'))
      return`<div class="att-img"><img src="${a.data}"><button class="att-del" onclick="rmAtt('${a.id}')">✕</button></div>`;
    if(a.type?.startsWith('audio/'))
      return`<div class="att-file"><span class="audio-chip">🎙 ${esc(a.name)}</span><button onclick="rmAtt('${a.id}')" style="background:none;border:none;cursor:pointer;color:var(--t3);margin-left:4px">✕</button></div>`;
    return`<div class="att-file">📎${esc(a.name.length>20?a.name.slice(0,18)+'…':a.name)}<button onclick="rmAtt('${a.id}')" style="background:none;border:none;cursor:pointer;color:var(--t3);margin-left:4px">✕</button></div>`;
  }).join('');
}
function rmAtt(id) { tempAtt=tempAtt.filter(a=>a.id!==id); renderAttPrev(); }

// Entries
function autoResize(el) {
  if(!el) return;
  el.style.height='auto';
  el.style.height=el.scrollHeight+'px';
}

function renderEntriesEdit() {
  const wrap = document.getElementById('e-entries-wrap');
  const el = document.getElementById('e-entries');
  const newArea = document.getElementById('e-new-entry-area');
  if(!wrap || !el || !newArea) return;

  const existing = tempEntries.filter(e => e._saved);
  const newEntries = tempEntries.filter(e => !e._saved);

  // Existing entries at bottom
  if(existing.length) {
    wrap.style.display='block';
    el.innerHTML=existing.map(e=>`<div class="entry-row">
      <div class="entry-cb${e.done?' on':''}" onclick="toggleEditEntry('${e.id}')">${e.done?checkSVG():''}</div>
      <div style="flex:1">
        <textarea class="entry-textarea" oninput="autoResize(this);updateEntry('${e.id}',this.value)" dir="auto">${esc(e.text)}</textarea>
        <div class="entry-date">${e.date}</div>
      </div>
      <button class="entry-del" onclick="rmEntry('${e.id}')">✕</button>
    </div>`).join('');
    el.querySelectorAll('.entry-textarea').forEach(t=>autoResize(t));
  } else {
    wrap.style.display='none';
    el.innerHTML='';
  }

  // New entries above notes
  if(newEntries.length) {
    newArea.innerHTML=`<div style="background:var(--s2);border-radius:var(--rsm);padding:2px 12px;margin-bottom:4px">${
      newEntries.map(e=>`<div class="entry-row">
        <div class="entry-cb${e.done?' on':''}" onclick="toggleEditEntry('${e.id}')">${e.done?checkSVG():''}</div>
        <div style="flex:1">
          <textarea class="entry-textarea" oninput="autoResize(this);updateEntry('${e.id}',this.value)" placeholder="Текст записи..." dir="auto">${esc(e.text)}</textarea>
          <div class="entry-date">${e.date}</div>
        </div>
        <button class="entry-del" onclick="rmEntry('${e.id}')">✕</button>
      </div>`).join('')
    }</div>`;
    newArea.querySelectorAll('.entry-textarea').forEach(t=>autoResize(t));
  } else {
    newArea.innerHTML='';
  }
}
function addEntry() {
  tempEntries.unshift({id:uid(),text:'',date:nowStr(),done:false,_saved:false});
  renderEntriesEdit();
  setTimeout(()=>{const ta=document.querySelector('#e-new-entry-area .entry-textarea');if(ta)ta.focus();},50);
}
function toggleEditEntry(id) { const e=tempEntries.find(x=>x.id===id);if(e){e.done=!e.done;renderEntriesEdit();} }
function updateEntry(id,val) { const e=tempEntries.find(x=>x.id===id);if(e)e.text=val; }
function rmEntry(id) { tempEntries=tempEntries.filter(e=>e.id!==id); renderEntriesEdit(); }

// History
function renderHistList() {
  const el=document.getElementById('hist-list');
  if(!tempHist.length){el.innerHTML='<p style="color:var(--t3);font-size:13px;padding:10px 0">Появится после первого сохранения.</p>';return;}
  el.innerHTML=tempHist.slice().reverse().map(h=>`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--b1)"><div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px"></div><div><div style="font-size:13px">${esc(h.text)}</div><div style="font-size:11px;color:var(--t3)">${h.date}</div></div></div>`).join('');
}
function addHistNote() {
  const v=document.getElementById('e-note').value.trim(); if(!v)return;
  tempHist.push({date:nowStr(),text:v,type:'note'});
  document.getElementById('e-note').value=''; renderHistList();
}

// Related
function searchRelated(q) {
  const el=document.getElementById('rel-results');
  if(!q.trim()){el.style.display='none';return;}
  const res=cards.filter(c=>c.id!==editId&&!tempRelIds.includes(c.id)&&c.title.toLowerCase().includes(q.toLowerCase())).slice(0,6);
  if(!res.length){el.style.display='none';return;}
  el.innerHTML=res.map(c=>`<div onclick="addRelated('${c.id}')" style="padding:9px 13px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--b1)">${esc(c.title)}<span style="font-size:11px;color:var(--t3);margin-left:5px">${c.category||''}</span></div>`).join('');
  el.style.display='block';
}
function addRelated(id) { if(!tempRelIds.includes(id))tempRelIds.push(id); document.getElementById('rel-search').value=''; document.getElementById('rel-results').style.display='none'; renderRelatedList(); }
function rmRelated(id) { tempRelIds=tempRelIds.filter(x=>x!==id); renderRelatedList(); }
function renderRelatedList() {
  const el=document.getElementById('rel-list');
  if(!tempRelIds.length){el.innerHTML='<span style="font-size:13px;color:var(--t3)">Нет связанных карточек</span>';return;}
  el.innerHTML=tempRelIds.map(id=>{const c=cards.find(x=>x.id===id);if(!c)return'';const col=catColor(c.category);return`<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:18px;border:1px solid ${hex2rgba(col,.4)};margin:3px;font-size:13px"><span style="color:${col}">🔗</span>${esc(c.title.length>24?c.title.slice(0,22)+'…':c.title)}<button onclick="rmRelated('${id}')" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:12px;padding:0;margin-left:2px">✕</button></div>`;}).join('');
}

// Save
async function saveCard() {
  const title=document.getElementById('e-title').value.trim(); if(!title)return;
  const catVal=document.getElementById('e-cat').value==='__new'?(cats[0]?.name||''):document.getElementById('e-cat').value;
  const isFamily = currentSpace?.type === 'family';
  const newStatus = isFamily ? (document.getElementById('e-status')?.value||'new') : document.getElementById('e-status').value;
  const assignedTo = isFamily ? (document.getElementById('e-assigned').value||null) : null;
  const oldCard=editId?cards.find(c=>c.id===editId):null;
  const oldStatus=oldCard?.status;
  const hist=[...tempHist];
  if(!editId) hist.push({date:nowStr(),text:'Карточка создана',type:'created'});
  else if(oldStatus&&oldStatus!==newStatus) hist.push({date:nowStr(),text:`Статус: ${ST_LABELS[oldStatus]} → ${ST_LABELS[newStatus]}`,type:'status'});
  else hist.push({date:nowStr(),text:'Обновлено',type:'note'});
  const cleanEntries=tempEntries.filter(e=>e.text.trim()).map(({_saved,...e})=>e);
  let finalStatus=isFamily ? 'new' : newStatus;
  if(cleanEntries.length>0&&cleanEntries.every(e=>e.done)) finalStatus='done';
  const data={
    title,body:document.getElementById('e-body').value.trim(),category:catVal,
    status:finalStatus,priority:document.getElementById('e-priority').value||'normal',
    deadline:document.getElementById('e-deadline').value||null,
    ball:isFamily?'':ballVal,
    assigned_to:assignedTo,
    attachments:tempAtt,entries:cleanEntries,
    reminder:{enabled:remOn,freq:freqVal,days:customDays},
    history:hist,related_ids:tempRelIds
  };
  setSaveBtns(false);
  if(editId){
    const card={...oldCard,...data};
    cards=cards.map(c=>c.id===editId?card:c);
    originalState=null;
    document.getElementById('edit-ov').classList.remove('on');
    render();
    toast('✓ Сохранено');
    await dbUpdate(card);
  } else {
    const card={id:uid(),created_at:today(),space_id:currentSpaceId||'personal',...data};
    cards.unshift(card);
    originalState=null;
    document.getElementById('edit-ov').classList.remove('on');
    render();
    toast('✓ Карточка создана');
    await dbInsert(card);
  }
  setSaveBtns(true);
}

async function deleteCard() {
  if(!confirm('Удалить карточку?'))return;
  const id = editId;
  cards=cards.filter(c=>c.id!==id);
  originalState=null;
  document.getElementById('edit-ov').classList.remove('on');
  render(); toast('Карточка удалена');
  await dbDelete(id);
}

async function toggleDone(id) {
  const card=cards.find(c=>c.id===id); if(!card)return;
  const old=card.status; card.status=card.status==='done'?'in_progress':'done';
  card.history=[...(card.history||[]),{date:nowStr(),text:`Статус: ${ST_LABELS[old]} → ${ST_LABELS[card.status]}`,type:'status'}];
  render(); try{await dbUpdate(card);}catch(e){toast('Ошибка',true);}
}

async function toggleEntry(cardId,entryId) {
  const card=cards.find(c=>c.id===cardId); if(!card)return;
  const e=(card.entries||[]).find(x=>x.id===entryId); if(!e)return;
  e.done=!e.done;
  if((card.entries||[]).length>0&&(card.entries||[]).every(x=>x.done)){
    card.status='done';
    card.history=[...(card.history||[]),{date:nowStr(),text:'Все записи выполнены → Готово',type:'status'}];
  }
  render(); try{await dbUpdate(card);}catch(e){toast('Ошибка',true);}
}

// Tabs
document.getElementById('tabs').addEventListener('click',e=>{
  const btn=e.target.closest('.tab'); if(!btn)return;
  view=btn.dataset.view;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on')); btn.classList.add('on');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('on',b.dataset.view===view));
  render();
});
document.getElementById('bnav').addEventListener('click',e=>{
  const btn=e.target.closest('.nav-btn'); if(!btn)return;
  view=btn.dataset.view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.view===view));
  render();
});
document.querySelectorAll('.mtab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById(btn.dataset.panel).classList.add('on');
  if(btn.dataset.panel==='p-history') renderHistList();
  if(btn.dataset.panel==='p-related') renderRelatedList();
}));
