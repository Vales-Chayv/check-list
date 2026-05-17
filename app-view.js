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
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        <button onclick="closeView()" style="background:var(--s2);border:none;color:var(--t2);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px">✕</button>
        <button onclick="closeView();setTimeout(()=>openEdit('${id}'),200)" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:7px;padding:5px 11px;font-size:13px;font-weight:700;cursor:pointer">✏️ Изменить</button>
        <button onclick="if(confirm(getExitMsg().replace('выйти','удалить карточку').replace('לצאת','למחוק כרטיס').replace('exit','delete'))){closeView();deleteCardById('${id}')}" style="background:rgba(232,96,96,.15);color:var(--red);border:1px solid rgba(232,96,96,.25);border-radius:7px;padding:5px 11px;font-size:13px;cursor:pointer">🗑</button>
      </div>
    </div>
  </div>`;

  if(card.body) html+=`<div class="view-sec"><div class="view-lbl">Заметка</div><div style="font-size:15px;line-height:1.6;color:var(--t2)">${esc(card.body)}</div></div>`;

  if(entries.length) {
    const dc=entries.filter(e=>e.done).length;
    html+=`<div class="view-sec"><div class="view-lbl">Записи (${dc}/${entries.length})</div>${entries.map(e=>`
      <div class="entry-row">
        <div class="entry-cb${e.done?' on':''}" onclick="viewToggleEntry('${id}','${e.id}')">${e.done?checkSVG():''}</div>
        <div style="flex:1"><div style="font-size:14px${e.done?';text-decoration:line-through;opacity:.45':''}">${esc(e.text)}</div><div class="entry-date">${e.date}</div></div>
      </div>`).join('')}</div>`;
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

  if(hist.length) html+=`<div class="view-sec"><div class="view-lbl">История</div>${hist.slice().reverse().slice(0,6).map(h=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--b1)"><div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px"></div><div><div style="font-size:13px">${esc(h.text)}</div><div style="font-size:11px;color:var(--t3)">${h.date}</div></div></div>`).join('')}</div>`;

  document.getElementById('view-content').innerHTML=html;
  document.getElementById('view-ov').classList.add('on');
}

function closeView() { document.getElementById('view-ov').classList.remove('on'); }

async function viewToggleEntry(cardId, entryId) {
  const card=cards.find(c=>c.id===cardId); if(!card)return;
  const e=(card.entries||[]).find(x=>x.id===entryId); if(!e)return;
  e.done=!e.done;
  if((card.entries||[]).length>0&&(card.entries||[]).every(x=>x.done)){
    card.status='done';
    card.history=[...(card.history||[]),{date:nowStr(),text:'Все записи выполнены → Готово',type:'status'}];
  }
  render(); openView(cardId);
  try{await dbUpdate(card);}catch(err){toast('Ошибка синхронизации',true);}
}

