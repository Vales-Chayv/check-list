// ═══════════════════════════════════════════
//  VIEW MODAL
// ═══════════════════════════════════════════
let viewGroupState = new Map(); // groupId -> развёрнут(true)/свёрнут(false), по умолчанию развёрнут

function viewToggleGroup(cardId, groupId) {
  const cur = viewGroupState.get(groupId);
  viewGroupState.set(groupId, cur === false ? true : false);
  openView(cardId);
}

function openView(id) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  (card.entryGroups||[]).forEach(g => { if(!viewGroupState.has(g.id)) viewGroupState.set(g.id, true); });
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
        ${currentSpace?.type==='family'&&card.created_by?`<div style="margin-top:8px;font-size:13px;color:var(--t2)">✍️ ${esc(card.created_by)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        <button onclick="closeView()" style="background:var(--s2);border:none;color:var(--t2);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px">✕</button>
      ${(currentSpace?.type==='family'||currentSpace?.type==='group')?`
        <div style="display:flex;gap:6px">
          <button onclick="closeView();setTimeout(()=>openChatCompose('${id}'),200)" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:9px 14px;font-size:15px;font-weight:700;cursor:pointer">💬 Написать в чат</button>
          <button onclick="closeView();setTimeout(()=>openChatVoice('${id}'),200)" style="background:var(--s2);color:var(--accent);border:1px solid var(--b1);border-radius:8px;padding:9px 12px;font-size:15px;cursor:pointer">🎙️</button>
        </div>`:`<div style="display:flex;gap:6px">
          <button onclick="closeView();setTimeout(()=>openAddEntry('${id}'),200)" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:9px 14px;font-size:15px;font-weight:700;cursor:pointer">＋ Запись</button>
          <button onclick="closeView();setTimeout(()=>openBulkTransferPicker('${id}'),200)" style="background:var(--s2);color:var(--accent);border:1px solid var(--b1);border-radius:8px;padding:9px 12px;font-size:15px;cursor:pointer" title="Перенести несколько">📤</button>
        </div>`}
        ${card.pinned?`<button onclick="resetCardChecks('${id}')" style="background:var(--s2);color:var(--t1);border:1px solid var(--b1);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">↺ Сбросить</button>`:''}
		${(card.status!=='done'&&view!=='today'&&currentSpace?.type!=='family'&&currentSpace?.type!=='group')?`<button onclick="toggleToday('${id}')" style="background:${card.today?'rgba(232,197,106,.3)':'rgba(232,197,106,.1)'};color:var(--accent);border:1px solid rgba(232,197,106,.3);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">${card.today?'✕ Убрать из списка':'☆ На сегодня'}</button>`:''}
		${card.status==='done'?`<button onclick="restoreCard('${id}')" style="background:rgba(91,184,122,.15);color:var(--green);border:1px solid rgba(91,184,122,.25);border-radius:8px;padding:9px 16px;font-size:15px;cursor:pointer">↩ Вернуть</button>`:''}
      ${(currentSpace?.type!=='family'||(card.created_by&&card.created_by.toLowerCase()===localStorage.getItem('mc_current_member')?.toLowerCase()))?
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
	  const borderCol = textColor ? 'rgba(0,0,0,.4)' : 'var(--t2)';
const doneCol = textColor ? 'rgba(0,0,0,.4)' : 'var(--green)';
const dateCol = textColor ? 'rgba(0,0,0,.4)' : 'var(--t3)';
      const myName = (localStorage.getItem('mc_current_member')||'').toLowerCase();
      const isAll = e.assigned_to==='all' && e.completions?.length;
      const myComp = isAll ? e.completions.find(c=>c.name.toLowerCase()===myName) : null;
      const doneCount = isAll ? e.completions.filter(c=>c.done).length : 0;

      // Left checkbox
      const checkboxHTML = isAll
        ? (myComp
            ? `<div onclick="toggleMyCompletion('${id}','${e.id}','${esc(myComp.name)}')" style="width:16px;height:16px;border-radius:3px;border:2px solid ${borderCol};flex-shrink:0;margin-top:2px;background:${myComp.done?doneCol:'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer">${myComp.done?'<svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>':''}</div>`
            : `<div style="font-size:13px;flex-shrink:0;margin-top:1px">👥</div>`)
        : `<div style="width:16px;height:16px;border-radius:3px;border:2px solid ${borderCol};flex-shrink:0;margin-top:2px;background:${e.done?doneCol:'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="viewToggleEntry('${id}','${e.id}')">${e.done?'<svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>':''}</div>`;

      // Circles for completions (read-only, shown on click)
      const circlesHTML = isAll ? `
        <div id="comp_${e.id}" style="display:none;flex-direction:row;gap:3px;align-items:center;margin-left:4px">
          ${e.completions.map(c=>`<div style="width:18px;height:18px;border-radius:50%;background:${c.done?'rgba(0,0,0,.45)':'rgba(0,0,0,.08)'};border:${c.done?'none':'1px dashed rgba(0,0,0,.25)'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:${c.done?'white':'rgba(0,0,0,.4)'}" title="${esc(c.name)}">${esc(c.name.slice(0,1).toUpperCase())}</div>`).join('')}
        </div>` : '';

      return `<div class="swipe-entry-wrap" style="position:relative;overflow:hidden;border-bottom:1px solid ${borderCol}22">
        <div class="swipe-actions" style="position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;gap:4px;padding:0 8px;opacity:0;transition:opacity .2s">
          <button onclick="deleteEntry('${id}','${e.id}')" style="background:rgba(232,96,96,.85);border:none;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer">🗑️</button>
          <button onclick="editEntry('${id}','${e.id}')" style="background:rgba(91,158,232,.85);border:none;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer">📝</button>
          <button onclick="moveEntry('${id}','${e.id}')" style="background:rgba(91,184,122,.85);border:none;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer">📤</button>
        </div>
        <div class="swipe-content" data-cardid="${id}" data-entryid="${e.id}" style="position:relative;display:flex;align-items:flex-start;gap:8px;padding:5px 0;background:transparent;will-change:transform;transition:transform .2s">
          ${checkboxHTML}
          <div style="flex:1">
            <div style="font-size:13px;color:${col};${e.done?'text-decoration:line-through;opacity:.5':''};word-break:break-word;overflow-wrap:break-word" dir="auto">${sanitizeRich(e.text)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <div style="font-size:10px;color:${dateCol};margin-top:1px">${e.date}</div>
                ${e.assigned_to&&e.assigned_to!=='all'?`<span style="font-size:10px;color:${dateCol};font-weight:600">👤 ${esc(e.assigned_to)}</span>`:e.assigned_to==='all'?`<span style="font-size:10px;color:${dateCol}">👥 Для всех</span>`:''}
                ${isAll?`<div style="display:flex;align-items:center;gap:3px"><span onclick="toggleCompletions('${e.id}')" style="font-size:11px;font-weight:700;color:${col};cursor:pointer;background:${borderCol}22;border-radius:10px;padding:1px 6px">${doneCount}/${e.completions.length}</span>${circlesHTML}</div>`:''}
              </div>
              ${eDl?`<span style="font-size:10px;opacity:.7">⏰ ${eDl.text}</span>`:''}
            </div>
          </div>
          <button class="entry-menu-btn" onclick="toggleEntryMenu(this,'${id}','${e.id}')">⋮</button>
        </div>
      </div>`;
    }

    // Color pairs: top → bottom
    const colorPairs = {'#5bb87a':'#e85bb0','#a07de8':'#5bb87a','#e8c56a':'#e86060','#5b9ee8':'#e8a83a','#e85bb0':'#5bc8e8','#e86060':'#a07de8','#5bc8e8':'#e8c56a','#e8a83a':'#5b9ee8'};
    const clipColors = ['#e8c56a','#e86060','#5b9ee8','#a07de8','#e85bb0','#5bc8e8','#5bb87a','#e8a83a'];
    // Find index of last "my" sticker
    const myLastIdx = sessions.reduce((first, s, i) => (first===-1 && (!s.creator||s.creator===myName)) ? i : first, -1);

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
        <div style="max-width:88%;min-width:55%;position:relative;${hasFiles?'padding-bottom:14px':''}">
           ${hasFiles?`<div id="${stkId}_peek" style="position:absolute;bottom:-5px;left:-5px;right:8px;height:90%;background:${bottomColor};border-radius:10px;transform:rotate(1.2deg);z-index:0"></div>`:''}
          <div style="position:relative;z-index:1;background:linear-gradient(${hex2rgba(memberColor,.7)},${hex2rgba(memberColor,.7)}),#eaeaea;border-radius:10px;padding:14px 14px 16px;box-shadow:2px 3px 10px rgba(0,0,0,.3)">
            <div style="position:absolute;top:-16px;${isMe?'left:14px':'right:14px'};transform:rotate(${isMe?'-12':'12'}deg);filter:drop-shadow(1px 1px 3px rgba(0,0,0,.4))"><svg width="20" height="32" viewBox="0 0 20 32" fill="none"><path d="M10 1C6.1 1 3 4.1 3 8v14c0 3.9 3.1 7 7 7s7-3.1 7-7V6h-2.5v16c0 2.5-2 4.5-4.5 4.5S5.5 24.5 5.5 22V8c0-1.9 1.6-3.5 3.5-3.5S12.5 6.1 12.5 8v14h2.5V8c0-3.9-3.1-7-7-7z" fill="${clipColor}"/></svg></div>
            <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,.7);margin-bottom:6px;margin-top:8px">${creator?esc(creator):'?'}</div>
<div style="font-size:10px;color:rgba(0,0,0,.45);margin-bottom:4px">${s.date}</div>
            ${s.note?`<div style="font-size:13px;color:rgba(0,0,0,.75);margin-bottom:8px;font-style:italic;line-height:1.5;word-break:break-word;white-space:pre-wrap" dir="auto">${esc(s.note)}</div>`:''}
            ${s.entries.map(e=>entryRowHTML(e,'rgba(0,0,0,0.75)')).join('')}
            ${showAddBtn?`<button onclick="openAddEntry('${id}','${s.sid}',true)" style="margin-top:8px;background:rgba(0,0,0,.1);border:none;border-radius:20px;padding:4px 12px;font-size:12px;color:rgba(0,0,0,.6);cursor:pointer;font-family:inherit">＋ Добавить</button>`:''}
            ${cornerHTML}
          </div>
          ${hasFiles?`<div id="${stkId}" style="display:none;position:relative;z-index:1;background:${bottomColor};border-radius:0 0 10px 10px;padding:12px 14px;margin:0 -4px">${filesHTML}</div>`:''}
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

   const entryGroups = card.entryGroups||[];
    let sessionsHTML;
    if(!isFamily && entryGroups.length) {
      sessionsHTML = entryGroups.map(g => {
        const gEntries = entries.filter(e => e.groupId === g.id && e.text);
        const expanded = viewGroupState.get(g.id) !== false;
        return `<div style="border:1px solid var(--b1);border-radius:var(--rsm);margin-bottom:8px;overflow:hidden">
          <div onclick="viewToggleGroup('${id}','${g.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--s2);cursor:pointer">
            <span style="font-size:13px;font-weight:700;color:var(--accent)">${esc(g.name)||'Без названия'}</span>
            <span style="font-size:11px;color:var(--t3)">${gEntries.length} ${expanded?'▲':'▼'}</span>
          </div>
          ${expanded ? `<div style="padding:0 12px">${gEntries.map(e=>entryRowHTML(e,null)).join('')}</div>` : ''}
        </div>`;
      }).join('');
    } else {
      sessionsHTML = sessions.map((s,si) => isFamily ? stickerHTML(s,si) : plainSessionHTML(s,si)).join('');
    }
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
// Сэндвич-градиент: шапка сверху перекрывает верх градиента, "хвост" торчит под шапкой
  const _vc = document.getElementById('view-content');
  const _head = _vc.firstElementChild;
  if(_head) {
    const _fade = document.createElement('div');
    _fade.id = 'view-fade';
    _vc.insertBefore(_fade, _head);              // перед шапкой в потоке, но шапка (z:10) ляжет сверху
    const _setFadeH = () => { _fade.style.setProperty('--head-h', _head.offsetHeight + 'px'); };
    setTimeout(_setFadeH, 450);                   // после анимации выезда листа
    const _sheet = _fade.closest('.sheet');
    if(_sheet) _sheet.addEventListener('scroll', _setFadeH, { passive: true });
  }
  document.getElementById('view-ov').classList.add('on');
  setTimeout(()=>setupEntrySwipe(), 100);
}

function closeView() {
  document.getElementById('view-ov').classList.remove('on');
  if(window._foreignCat){ cats = cats.filter(k=>k.name!==window._foreignCat); window._foreignCat=null; }
  if(window._foreignCardId){ const fid=window._foreignCardId; window._foreignCardId=null; cards=cards.filter(c=>c.id!==fid); }
  if(window._pinFromLobby){ window._pinFromLobby=false; if(typeof showSpaceSelector==='function'){ showSpaceSelector(); return; } }
  render();
}

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

async function resetCardChecks(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  (card.entries||[]).forEach(e=>{ e.done=false; if(e.completions) e.completions.forEach(c=>c.done=false); });
  if(card.status==='done') card.status='in_progress';
  const dls=(card.entries||[]).filter(x=>x.deadline).map(x=>x.deadline).sort();
  card.deadline = dls[0]||null;
  render();
  if(document.getElementById('view-ov')?.classList.contains('on')) openView(cardId);
  try{await dbUpdate(card);}catch(e){toast('Ошибка',true);}
  toast('↺ Галочки сброшены');
}
function maybeOfferReset(cardId, justChecked) {
  const card = cards.find(c=>c.id===cardId); if(!card || !card.pinned || !justChecked) return;
  const allDone = (card.entries||[]).length>0 && (card.entries||[]).every(x=>x.done);
  if(allDone) setTimeout(()=>{ if(confirm('Все записи отмечены. Сбросить галочки?')) resetCardChecks(cardId); }, 120);
}
async function viewToggleEntry(cardId, entryId) {
  const card=cards.find(c=>c.id===cardId); if(!card)return;
  const e=(card.entries||[]).find(x=>x.id===entryId); if(!e)return;
  if(e.assigned_to && e.assigned_to !== 'all') {
    const myName = localStorage.getItem('mc_current_member')||'';
    if(myName.toLowerCase() !== e.assigned_to.toLowerCase()) {
      toast('Эта задача для ' + e.assigned_to, true); return;
    }
  }
  e.done=!e.done;
  const activeDls = (card.entries||[]).filter(x=>!x.done&&x.deadline).map(x=>x.deadline).sort();
  if(activeDls.length) card.deadline = activeDls[0];
  if(!card.pinned && (card.entries||[]).length>0&&(card.entries||[]).every(x=>x.done)){
    card.status='done';
    card.history=[...(card.history||[]),{date:nowStr(),text:'Все записи выполнены → Готово',type:'status'}];
  }
  render(); openView(cardId);
  try{await dbUpdate(card);}catch(err){toast('Ошибка синхронизации',true);}
  maybeOfferReset(cardId, e.done);
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
    document.querySelectorAll('#ae-seg-ball .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.ball===(card.ball||'')));
  }

 const groupSel = document.getElementById('ae-group-select');
  if(groupSel) {
    if(card?.entryGroups?.length) {
      groupSel.style.display = 'block';
      groupSel.innerHTML = card.entryGroups.map(g=>`<option value="${g.id}">${esc(g.name)||'Без названия'}</option>`).join('') + `<option value="__new__">+ Новый раздел</option>`;
      groupSel.value = card.entryGroups[0].id;
    } else {
      groupSel.style.display = 'none';
    }
  }
  const newGroupInp = document.getElementById('ae-new-group-name');
  if(newGroupInp) { newGroupInp.style.display = 'none'; newGroupInp.value = ''; }

  document.getElementById('ae-extra').style.display = 'none';
  document.getElementById('ae-extra-arrow').textContent = '▼';
 document.getElementById('ae-ov').classList.add('on');
  aeAddEntryRow();                                   // авто-первая пустая строка записи
  setTimeout(() => { if(noteEl) noteEl.focus(); }, 300);
}

function aeToggleNewGroupInput() {
  const sel = document.getElementById('ae-group-select');
  const inp = document.getElementById('ae-new-group-name');
  if(!sel || !inp) return;
  inp.style.display = sel.value === '__new__' ? 'block' : 'none';
  if(sel.value === '__new__') setTimeout(()=>inp.focus(), 50);
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
      <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center">
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('bold')" title="Жирный" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 9px;color:var(--t1);cursor:pointer;font-family:inherit;font-size:13px;min-width:30px"><b>Ж</b></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('underline')" title="Подчеркнуть" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 9px;color:var(--t1);cursor:pointer;font-family:inherit;font-size:13px;min-width:30px"><u>Ч</u></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('fontSize','5')" title="Крупнее" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 9px;color:var(--t1);cursor:pointer;font-family:inherit;font-size:13px;min-width:30px">A↑</button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#e8c56a')" title="Жёлтый" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#e8c56a"></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#e86060')" title="Красный" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#e86060"></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#5bb87a')" title="Зелёный" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#5bb87a"></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#5b9ee8')" title="Синий" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#5b9ee8"></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#a07de8')" title="Фиолетовый" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#a07de8"></button>
        <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('removeFormat')" title="Убрать оформление" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 9px;color:var(--t2);cursor:pointer;font-family:inherit;font-size:13px;min-width:30px">⌫</button>
      </div>
      <div class="ae-entry-edit" contenteditable="true" dir="auto" style="background:transparent;border:none;border-bottom:1px solid var(--b1);color:var(--t1);font-size:14px;font-family:inherit;min-height:36px;line-height:1.6;width:100%;padding:4px 0;outline:none;overflow-wrap:break-word;word-break:break-word"></div>
      ${currentSpace?.type==='family'?`<div style="margin-top:6px">
  <div style="font-size:11px;color:rgba(var(--t2-rgb),.7);margin-bottom:4px">Назначить:</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px">
    <button type="button" class="ae-assign-btn on" data-val="" onclick="aeToggleAssign(this,'',event)" style="font-size:11px;padding:3px 8px;border-radius:12px;border:1px solid var(--b1);background:var(--accent);color:#0f0f0f;cursor:pointer">👤 Никому</button>
    <button type="button" class="ae-assign-btn" data-val="all" onclick="aeToggleAssign(this,'all',event)" style="font-size:11px;padding:3px 8px;border-radius:12px;border:1px solid var(--b1);background:transparent;color:var(--t2);cursor:pointer">👥 Все</button>
    ${(currentSpace?.members||[]).map(m=>`<button type="button" class="ae-assign-btn" data-val="${esc(m.name)}" onclick="aeToggleAssign(this,'${esc(m.name)}',event)" style="font-size:11px;padding:3px 8px;border-radius:12px;border:1px solid var(--b1);background:transparent;color:var(--t2);cursor:pointer">${esc(m.name)}</button>`).join('')}
  </div>
</div>`:''}
    </div>
    <button onclick="this.closest('.entry-row').remove()" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:16px;padding:0 4px">✕</button>`;
  wrap.prepend(div);
  setTimeout(()=>{ const ta=div.querySelector('.ae-entry-edit'); if(ta){ta.focus();} },50);
}

async function saveAddEntry() {
  if (aeIsVoice) {
    await new Promise(resolve => { aeStopResolve = resolve; stopAEVoice(); });
  }

 const sessionNote = (document.getElementById('ae-note')?.value||'').trim();
  const entryRows = document.getElementById('ae-entries-list')?.querySelectorAll('.entry-row')||[];
  const entryTexts = [...entryRows].map(r=>sanitizeRich(r.querySelector('.ae-entry-edit')?.innerHTML||'')).filter(t=>stripTags(t).trim());
  if(!sessionNote && !entryTexts.length && !aeAtts.length) { toast('Введи заметку или добавь запись', true); return; }
  const card = cards.find(c => c.id === aeCardId); if (!card) return;

  // Раздел (если у карточки уже есть группировка записей)
  let targetGroupId = null;
  const groupSel = document.getElementById('ae-group-select');
  if(groupSel && groupSel.style.display !== 'none') {
    if(groupSel.value === '__new__') {
      const newName = (document.getElementById('ae-new-group-name')?.value||'').trim();
      targetGroupId = uid();
      card.entryGroups = [...(card.entryGroups||[]), {id: targetGroupId, name: newName}];
    } else {
      targetGroupId = groupSel.value;
    }
  }

  // Build session
  const sessionId = aeStickerSessionId || uid();
  const isNewSession = !aeStickerSessionId;
  const deadline = document.getElementById('ae-entry-deadline')?.value||null;
  const sessionEntries = [];
  const texts = entryTexts.length ? entryTexts : [''];
  texts.forEach((text, i) => {
  const entryRow = [...entryRows][i];
const onBtns = [...(entryRow?.querySelectorAll('.ae-assign-btn.on')||[])];
const onVals = onBtns.map(b=>b.dataset.val).filter(v=>v);
let assignedTo = null, completions = null;
if(onVals.includes('all')) {
  assignedTo = 'all';
  completions = (currentSpace?.members||[]).map(m=>({name:m.name, done:false}));
} else if(onVals.length > 1) {
  assignedTo = 'all';
  completions = onVals.map(name=>({name, done:false}));
} else if(onVals.length === 1) {
  assignedTo = onVals[0];
  completions = null;
}
   sessionEntries.push({
      id: uid(), text: text, date: nowStr(), done: false, attachments: [],
      sessionId,
      sessionNote: (i === 0 && isNewSession) ? (sessionNote||null) : null,
      sessionAtts: (i === 0) ? [...aeAtts] : [],
      sessionCreator: isNewSession ? (localStorage.getItem('mc_current_member')||currentUser?.display_name||'') : (localStorage.getItem('mc_current_member')||currentUser?.display_name||''),
      assigned_to: assignedTo,
completions: completions,
      deadline,
      groupId: targetGroupId
    });
  });
  card.entries = [...sessionEntries, ...(card.entries||[])];
  card.deadline = ([...(card.entries||[])].filter(e=>!e.done&&e.deadline).map(e=>e.deadline).sort()[0])||null;

  // Save extra settings if expanded
  if(document.getElementById('ae-extra').style.display !== 'none') {
    card.category = document.getElementById('ae-cat').value;
    card.status = document.getElementById('ae-status').value;
    card.priority = document.getElementById('ae-priority').value;
    const ballBtn = document.querySelector('#ae-seg-ball .seg-btn.on');
    if(ballBtn) card.ball = ballBtn.dataset.ball;
  }

  if(card.status === 'new') card.status = 'in_progress';
  if(!card.pinned && (card.entries||[]).filter(e=>e.text).length && (card.entries||[]).filter(e=>e.text).every(e=>e.done)) card.status='done';

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
  const content = document.getElementById(id);
  const peek = document.getElementById(id + '_peek');
  if(!content) return;
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  if(peek) peek.style.display = isOpen ? 'block' : 'none';
}

// ─── ENTRY SWIPE ─────────────────────────────
function setupEntrySwipe() {
  document.querySelectorAll('.swipe-content').forEach(el => {
    let startX = 0, startY = 0, swiped = false;
    const wrap = el.closest('.swipe-entry-wrap');
    const actions = wrap?.querySelector('.swipe-actions');
    const THRESHOLD = 60;

    function reset() {
      el.style.transform = 'translateX(0)';
      if(actions) actions.style.opacity = '0';
      swiped = false;
    }
el.addEventListener('mousedown', e => {
  startX = e.clientX;
  startY = e.clientY;
  swiped = false;
  const onMove = e => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if(Math.abs(dy) > Math.abs(dx)) return;
    if(dx > 0) {
      el.style.transform = `translateX(${Math.min(dx, 120)}px)`;
      if(actions) actions.style.opacity = Math.min(dx/THRESHOLD, 1).toString();
    }
  };
  const onUp = e => {
    const dx = e.clientX - startX;
    if(dx >= THRESHOLD) {
      el.style.transform = 'translateX(120px)';
      if(actions) actions.style.opacity = '1';
      swiped = true;
      document.querySelectorAll('.swipe-content').forEach(other => {
        if(other !== el) { other.style.transform='translateX(0)'; other.closest('.swipe-entry-wrap')?.querySelector('.swipe-actions')?.style.setProperty('opacity','0'); }
      });
    } else { reset(); }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});
    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiped = false;
    }, {passive:true});

    el.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if(Math.abs(dy) > Math.abs(dx)) return;
      if(dx > 0) {
        el.style.transform = `translateX(${Math.min(dx, 120)}px)`;
        if(actions) actions.style.opacity = Math.min(dx/THRESHOLD, 1).toString();
        e.preventDefault();
      }
    }, {passive:false});

    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if(dx >= THRESHOLD) {
        el.style.transform = 'translateX(120px)';
        if(actions) actions.style.opacity = '1';
        swiped = true;
        document.querySelectorAll('.swipe-content').forEach(other => {
          if(other !== el) { other.style.transform='translateX(0)'; other.closest('.swipe-entry-wrap')?.querySelector('.swipe-actions')?.style.setProperty('opacity','0'); }
        });
      } else { reset(); }
    }, {passive:true});
  });

  document.getElementById('view-content')?.addEventListener('click', e => {
    if(!e.target.closest('.swipe-actions') && !e.target.closest('.swipe-content')) return;
    if(!e.target.closest('.swipe-actions')) {
      document.querySelectorAll('.swipe-content').forEach(el => {
        el.style.transform='translateX(0)';
        el.closest('.swipe-entry-wrap')?.querySelector('.swipe-actions')?.style.setProperty('opacity','0');
      });
    }
  });
  if('ontouchstart' in window) {
    document.querySelectorAll('.entry-menu-btn').forEach(b=>b.style.display='none');
  }
}

async function deleteEntry(cardId, entryId) {
  if(!confirm('Удалить запись?')) return;
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  card.entries = (card.entries||[]).filter(e=>e.id!==entryId);
  if(!card.entries.length && confirm('Записей в карточке не осталось. Удалить карточку?')) {
    closeView(); deleteCardById(cardId); return;
  }
  render(); openView(cardId);
  try { await dbUpdate(card); } catch(e) { toast('Ошибка синхронизации', true); }
}

function editEntry(cardId, entryId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  const entry = (card.entries||[]).find(e=>e.id===entryId); if(!entry) return;
  const div = document.createElement('div');
  div.id = 'edit-entry-dialog';
div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;width:100%;max-width:420px">
    <div style="font-size:16px;font-weight:700;margin-bottom:12px">Редактировать запись</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('bold')" title="Жирный" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:6px 10px;color:var(--t1);cursor:pointer;font-family:inherit;font-size:14px;min-width:32px"><b>Ж</b></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('underline')" title="Подчеркнуть" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:6px 10px;color:var(--t1);cursor:pointer;font-family:inherit;font-size:14px;min-width:32px"><u>Ч</u></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('fontSize','5')" title="Крупнее" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:6px 10px;color:var(--t1);cursor:pointer;font-family:inherit;font-size:14px;min-width:32px">A↑</button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#e8c56a')" title="Жёлтый" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#e8c56a"></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#e86060')" title="Красный" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#e86060"></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#5bb87a')" title="Зелёный" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#5bb87a"></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#5b9ee8')" title="Синий" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#5b9ee8"></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('foreColor','#a07de8')" title="Фиолетовый" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--b1);cursor:pointer;padding:0;background:#a07de8"></button>
      <button type="button" onmousedown="event.preventDefault()" onclick="applyFmt('removeFormat')" title="Убрать оформление" style="background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:6px 10px;color:var(--t2);cursor:pointer;font-family:inherit;font-size:14px;min-width:32px">⌫</button>
    </div>
    <div id="edit-entry-txt" contenteditable="true" dir="auto" style="width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px;font-size:15px;color:var(--t1);font-family:inherit;min-height:80px;outline:none;overflow-wrap:break-word;word-break:break-word">${sanitizeRich(entry.text)}</div>
    <div style="margin-top:8px">
      <label style="font-size:12px;color:var(--t2)">Срок выполнения</label>
      <input type="date" id="edit-entry-dl" value="${entry.deadline||''}" style="width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:8px;font-size:14px;color:var(--t1);font-family:inherit;margin-top:4px">
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button onclick="saveEntryEdit('${cardId}','${entryId}')" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:11px;font-size:14px;font-weight:700;cursor:pointer">Сохранить</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px 16px;cursor:pointer">Отмена</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  setTimeout(()=>document.getElementById('edit-entry-txt')?.focus(),100);
}

async function saveEntryEdit(cardId, entryId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  const entry = (card.entries||[]).find(e=>e.id===entryId); if(!entry) return;
  const el = document.getElementById('edit-entry-txt');
  const txt = sanitizeRich(el?.innerHTML || '');
  if(!stripTags(txt).trim()) return;
  entry.text = txt;
  const dl = document.getElementById('edit-entry-dl')?.value;
entry.deadline = dl || null;
  document.getElementById('edit-entry-dialog')?.remove();
  render(); openView(cardId);
  try { await dbUpdate(card); } catch(e) { toast('Ошибка синхронизации', true); }
}

let _mcTargetSpace = null;
function moveCardToSpace(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  _mcTargetSpace = null;
  const curFam = currentSpace?.type==='family' || currentSpace?.type==='group';
  const famLike = t => t==='family' || t==='group';
  const targets = spaces.filter(s => s.id!==currentSpaceId && famLike(s.type)===curFam);
  const div = document.createElement('div');
  div.id = 'move-card-dialog';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  const spaceBtns = targets.length ? targets.map(s =>
    `<button onclick="mcSelectSpace('${cardId}','${s.id}',this)" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t1);cursor:pointer;text-align:left;font-family:inherit">${famLike(s.type)?'👨‍👩‍👧':'🗂️'} ${esc(s.name)}</button>`
  ).join('') : `<div style="font-size:13px;color:var(--t3)">Нет других кабинетов того же типа</div>`;
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;width:100%;max-width:420px;max-height:80vh;overflow-y:auto">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">📦 Переместить карточку</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:10px">«${esc(card.title)}» → выбери кабинет</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">${spaceBtns}</div>
    <div id="mc-cat-section" style="display:none">
      <div style="font-size:13px;color:var(--t2);margin-bottom:8px">Рубрика в новом кабинете</div>
      <div style="display:flex;flex-direction:column;gap:6px" id="mc-cat-list"></div>
    </div>
    <button onclick="document.getElementById('move-card-dialog')?.remove()" style="width:100%;margin-top:12px;background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px;cursor:pointer">Отмена</button>
  </div>`;
  document.body.appendChild(div);
}
async function mcSelectSpace(cardId, spaceId, btn) {
  _mcTargetSpace = spaceId;
  document.querySelectorAll('#move-card-dialog button[onclick^="mcSelectSpace"]').forEach(b=>{ b.style.borderColor='var(--b1)'; b.style.color='var(--t1)'; });
  if(btn){ btn.style.borderColor='var(--accent)'; btn.style.color='var(--accent)'; }
  const sec = document.getElementById('mc-cat-section');
  const list = document.getElementById('mc-cat-list');
  if(!sec || !list) return;
  sec.style.display='block';
  list.innerHTML = '<div style="font-size:13px;color:var(--t3)">Загрузка рубрик…</div>';
  let targetCats = [];
  try { const { data } = await sb.from('categories').select('name,color').eq('space_id', spaceId); targetCats = data||[]; } catch(e) {}
  const catBtns = targetCats.map(c =>
    `<button onclick="mcConfirm('${cardId}','${esc(c.name)}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t1);cursor:pointer;text-align:left;font-family:inherit"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color||'#888'};margin-right:8px;vertical-align:middle"></span>${esc(c.name)}</button>`
  ).join('');
  list.innerHTML = catBtns + `<button onclick="mcConfirm('${cardId}','')" style="background:transparent;border:1px dashed var(--b2);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t2);cursor:pointer;text-align:left;font-family:inherit">— Без рубрики</button>`;
}
async function mcConfirm(cardId, catName) {
  const card = cards.find(c=>c.id===cardId);
  const target = _mcTargetSpace;
  if(!card || !target) return;
  document.getElementById('move-card-dialog')?.remove();
  const updated = { ...card, space_id: target, category: catName || '' };
  try { await dbUpdate(updated); } catch(e) { toast('Ошибка переноса', true); return; }
  cards = cards.filter(c => c.id !== cardId);
  try { await local.delete('cards', cardId); } catch(e) {}
  if(typeof closeView === 'function') closeView();
  render();
  toast('✓ Карточка перемещена');
}
let moveAssignedTo = null, moveAssignedCompletions = null, moveDeleteSource = false, moveSelection = null, moveTargetCard = null;

function openBulkTransferPicker(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  const groups = card.entryGroups||[];
  const entries = (card.entries||[]).filter(e=>e.text);
  const div = document.createElement('div');
  div.id = 'bulk-transfer-ov';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  const groupBlocks = groups.map(g => {
    const gEntries = entries.filter(e=>e.groupId===g.id);
    return `<label style="display:flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 12px;cursor:pointer;margin-bottom:6px">
      <input type="checkbox" class="bt-group-cb" data-groupid="${g.id}">
      <div><div style="font-weight:700;color:var(--accent);font-size:13px">${esc(g.name)||'Без названия'}</div><div style="font-size:11px;color:var(--t3)">${gEntries.length} записей — весь раздел</div></div>
    </label>`;
  }).join('');
  const ungrouped = entries.filter(e=>!e.groupId);
  const entryBlocks = ungrouped.map(e => `<label style="display:flex;align-items:flex-start;gap:8px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 12px;cursor:pointer;margin-bottom:6px">
      <input type="checkbox" class="bt-entry-cb" data-entryid="${e.id}" style="margin-top:2px">
      <div style="font-size:13px">${esc(stripTags(e.text))}</div>
    </label>`).join('');
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;width:100%;max-width:420px;max-height:80vh;overflow-y:auto">
    <div style="font-size:16px;font-weight:700;margin-bottom:12px">Что перенести?</div>
    ${groupBlocks}
    ${entryBlocks}
    ${!groups.length && !ungrouped.length ? '<div style="color:var(--t3);font-size:13px">Нет записей</div>' : ''}
    <div style="display:flex;gap:8px;margin-top:14px">
      <button onclick="document.getElementById('bulk-transfer-ov')?.remove()" style="flex:1;background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px;cursor:pointer">Отмена</button>
      <button onclick="confirmBulkSelection('${cardId}')" style="flex:1;background:var(--accent);border:none;color:#0f0f0f;font-weight:700;border-radius:var(--rsm);padding:11px;cursor:pointer">Далее →</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}
function confirmBulkSelection(cardId) {
  const entryIds = [...document.querySelectorAll('.bt-entry-cb:checked')].map(cb=>cb.dataset.entryid);
  const groupIds = [...document.querySelectorAll('.bt-group-cb:checked')].map(cb=>cb.dataset.groupid);
  if(!entryIds.length && !groupIds.length) { toast('Выбери хотя бы одну запись или раздел', true); return; }
  document.getElementById('bulk-transfer-ov')?.remove();
  moveEntry(cardId, {entryIds, groupIds});
}

function moveEntry(cardId, selection) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  moveSelection = typeof selection === 'string' ? {entryIds:[selection], groupIds:[]} : selection;
  moveAssignedTo = null; moveAssignedCompletions = null; moveDeleteSource = false; moveTargetCard = null;
  const div = document.createElement('div');
  div.id = 'move-entry-dialog';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  const spaceList = spaces.filter(s=>s.id!==currentSpaceId).map(s=>
    `<button onclick="selectMoveSpace('${cardId}','${s.id}',this)" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t1);cursor:pointer;text-align:left;font-family:inherit">${s.type==='family'?'👨‍👩‍👧':'🗂️'} ${esc(s.name)}</button>`
  ).join('');
  const n = moveSelection.entryIds.length + moveSelection.groupIds.length;
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;width:100%;max-width:420px;max-height:80vh;overflow-y:auto">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">Перенести${n>1?` (${n})`:' запись'}</div>
    <label style="display:flex;align-items:center;gap:8px;margin:8px 0 14px;font-size:13px;color:var(--t2);cursor:pointer">
      <input type="checkbox" id="move-delete-source" onchange="moveDeleteSource=this.checked">
      Стереть в источнике после переноса
    </label>
    <div style="font-size:13px;color:var(--t2);margin-bottom:8px">Кабинет</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      <button onclick="selectMoveSpace('${cardId}','${currentSpaceId}',this)" style="background:var(--s2);border:1px solid var(--accent);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--accent);cursor:pointer;text-align:left;font-family:inherit">📂 Текущий кабинет</button>
      ${spaceList}
    </div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:8px">Рубрика</div>
    <div style="display:flex;flex-direction:column;gap:6px" id="move-cat-list"></div>
    <div id="move-card-list" style="margin-top:12px;display:flex;flex-direction:column;gap:6px"></div>
    <div id="move-assign-block"></div>
    <div id="move-confirm-block"></div>
    <button onclick="document.getElementById('move-entry-dialog')?.remove()" style="width:100%;margin-top:12px;background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px;cursor:pointer">Отмена</button>
  </div>`;
  document.body.appendChild(div);
}

function renderMoveAssignBlock(targetSpace, chatParticipants) {
  const block = document.getElementById('move-assign-block'); if(!block) return;
  moveAssignedTo = null; moveAssignedCompletions = null;
  if(!targetSpace || !(targetSpace.type==='family' || targetSpace.type==='group')) { block.innerHTML = ''; return; }
  const pool = (chatParticipants && chatParticipants.length) ? chatParticipants : (targetSpace.members||[]).map(m=>m.name);
  block.innerHTML = `<div style="margin:12px 0">
    <div style="font-size:13px;color:var(--t2);margin-bottom:8px">Назначить (участники этого чата)</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button type="button" class="move-assign-btn on" data-val="" onclick="moveToggleAssign(this,'',event)" style="font-size:11px;padding:3px 8px;border-radius:12px;border:1px solid var(--b1);background:var(--accent);color:#0f0f0f;cursor:pointer">👤 Никому</button>
      <button type="button" class="move-assign-btn" data-val="all" onclick="moveToggleAssign(this,'all',event)" style="font-size:11px;padding:3px 8px;border-radius:12px;border:1px solid var(--b1);background:transparent;color:var(--t2);cursor:pointer">👥 Все</button>
      ${pool.map(name=>`<button type="button" class="move-assign-btn" data-val="${esc(name)}" onclick="moveToggleAssign(this,'${esc(name)}',event)" style="font-size:11px;padding:3px 8px;border-radius:12px;border:1px solid var(--b1);background:transparent;color:var(--t2);cursor:pointer">${esc(name)}</button>`).join('')}
    </div>
  </div>`;
  block.dataset.pool = JSON.stringify(pool);
}

function moveToggleAssign(btn, val, event) {
  event.stopPropagation();
  const wrap = document.getElementById('move-assign-block');
  const allBtns = wrap.querySelectorAll('.move-assign-btn');
  if(val === '' || val === 'all') {
    allBtns.forEach(b => { b.style.background='transparent'; b.style.color='var(--t2)'; b.classList.remove('on'); });
    btn.style.background = 'var(--accent)'; btn.style.color = '#0f0f0f'; btn.classList.add('on');
  } else {
    const noneBtns = wrap.querySelectorAll('[data-val=""], [data-val="all"]');
    noneBtns.forEach(b => { b.style.background='transparent'; b.style.color='var(--t2)'; b.classList.remove('on'); });
    btn.classList.toggle('on');
    btn.style.background = btn.classList.contains('on') ? 'var(--accent)' : 'transparent';
    btn.style.color = btn.classList.contains('on') ? '#0f0f0f' : 'var(--t2)';
  }
  const onVals = [...wrap.querySelectorAll('.move-assign-btn.on')].map(b=>b.dataset.val).filter(v=>v);
  const pool = JSON.parse(wrap.dataset.pool || '[]');
  if(onVals.includes('all')) {
    moveAssignedTo = 'all';
    moveAssignedCompletions = pool.map(name=>({name, done:false}));
  } else if(onVals.length > 1) {
    moveAssignedTo = 'all';
    moveAssignedCompletions = onVals.map(name=>({name, done:false}));
  } else if(onVals.length === 1) {
    moveAssignedTo = onVals[0];
    moveAssignedCompletions = null;
  } else {
    moveAssignedTo = null; moveAssignedCompletions = null;
  }
}

async function selectMoveSpace(cardId, spaceId, btn) {
  document.querySelectorAll('[onclick*="selectMoveSpace"]').forEach(b=>b.style.borderColor='var(--b1)');
  btn.style.borderColor = 'var(--accent)';
  document.getElementById('move-assign-block').innerHTML = '';
  document.getElementById('move-confirm-block').innerHTML = '';
  moveTargetCard = null;
  const catListEl = document.getElementById('move-cat-list');
  const cardListEl = document.getElementById('move-card-list');
  cardListEl.innerHTML = '';
  if(spaceId === currentSpaceId) {
    catListEl.innerHTML = cats.map(c=>`<button onclick="selectMoveCat('${cardId}','${spaceId}','${esc(c.name)}',this)" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t1);cursor:pointer;text-align:left;font-family:inherit"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color||'#888'};margin-right:8px"></span>${esc(c.name)}</button>`).join('');
  } else {
    catListEl.innerHTML = '<div style="font-size:13px;color:var(--t3)">Загрузка...</div>';
    try {
      const {data} = await sb.from('categories').select('*').eq('space_id', spaceId);
      const spaceCats = data||[];
      catListEl.innerHTML = spaceCats.length
        ? spaceCats.map(c=>`<button onclick="selectMoveCat('${cardId}','${spaceId}','${esc(c.name)}',this)" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t1);cursor:pointer;text-align:left;font-family:inherit"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color||'#888'};margin-right:8px"></span>${esc(c.name)}</button>`).join('')
        : '<div style="font-size:13px;color:var(--t3)">Нет рубрик</div>';
    } catch(e) { catListEl.innerHTML = '<div style="font-size:13px;color:var(--red)">Ошибка загрузки</div>'; }
  }
}

async function selectMoveCat(cardId, spaceId, catName, btn) {
  document.querySelectorAll('#move-cat-list button').forEach(b=>b.style.background='var(--s2)');
  if(btn) btn.style.background='var(--s3,rgba(255,255,255,.1))';
  const cardListEl = document.getElementById('move-card-list'); if(!cardListEl) return;
  document.getElementById('move-assign-block').innerHTML = '';
  document.getElementById('move-confirm-block').innerHTML = '';
  moveTargetCard = null;
  let targetCards = [];
  if(spaceId === currentSpaceId) {
    targetCards = cards.filter(c=>c.category===catName && c.id!==cardId && c.status!=='done').map(c=>({id:c.id, title:c.title, chatParticipants:c.chatParticipants}));
  } else {
    cardListEl.innerHTML = '<div style="font-size:13px;color:var(--t3)">Загрузка...</div>';
    try {
      const {data} = await sb.from('cards').select('id,title,chatParticipants').eq('space_id', spaceId).eq('category', catName).neq('status','done');
      targetCards = data||[];
    } catch(e) { cardListEl.innerHTML = '<div style="font-size:13px;color:var(--red)">Ошибка загрузки</div>'; return; }
  }
  window._moveTargetCards = targetCards;
  cardListEl.innerHTML = targetCards.length
    ? `<div style="font-size:12px;color:var(--t3);margin-bottom:4px">Выбери карточку:</div>` +
      targetCards.map((c,i)=>`<button onclick="selectMoveTarget('${cardId}','${spaceId}',${i},this)" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 14px;font-size:14px;color:var(--t1);cursor:pointer;text-align:left;font-family:inherit">${esc(c.title)}</button>`).join('')
    : `<div style="font-size:13px;color:var(--t3);margin-bottom:8px">Нет карточек в этой рубрике</div>
   <button onclick="createCardAndMove('${cardId}','${spaceId}','${esc(catName)}')" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer;width:100%">＋ Создать карточку и перенести</button>`;
}

function selectMoveTarget(cardId, spaceId, idx, btn) {
  document.querySelectorAll('#move-card-list button').forEach(b=>b.style.borderColor='var(--b1)');
  if(btn) btn.style.borderColor='var(--accent)';
  const targetCard = (window._moveTargetCards||[])[idx];
  if(!targetCard) return;
  moveTargetCard = {id: targetCard.id, spaceId};
  const targetSpace = spaces.find(s=>s.id===spaceId);
  renderMoveAssignBlock(targetSpace, targetCard.chatParticipants);
  document.getElementById('move-confirm-block').innerHTML = `<button onclick="confirmMove('${cardId}')" style="width:100%;margin-top:10px;background:var(--accent);border:none;color:#0f0f0f;font-weight:700;border-radius:var(--rsm);padding:11px;cursor:pointer">Перенести</button>`;
}

function collectMoveEntries(fromCard) {
  const picked = [];
  (fromCard.entries||[]).forEach(e => {
    if(moveSelection.entryIds.includes(e.id) || (e.groupId && moveSelection.groupIds.includes(e.groupId))) {
      const copy = {...e, id: uid()};
      if(moveAssignedTo !== null) { copy.assigned_to = moveAssignedTo; copy.completions = moveAssignedCompletions; copy.done = false; }
      picked.push(copy);
    }
  });
  return picked;
}

function stripMovedFromSource(fromCard) {
  if(!moveDeleteSource) return;
  fromCard.entries = (fromCard.entries||[]).filter(e =>
    !moveSelection.entryIds.includes(e.id) && !(e.groupId && moveSelection.groupIds.includes(e.groupId))
  );
  if(moveSelection.groupIds.length) {
    fromCard.entryGroups = (fromCard.entryGroups||[]).filter(g => !moveSelection.groupIds.includes(g.id));
  }
}

async function confirmMove(fromCardId) {
  const fromCard = cards.find(c=>c.id===fromCardId); if(!fromCard || !moveTargetCard) return;
  const movedEntries = collectMoveEntries(fromCard);
  if(!movedEntries.length) { toast('Нечего переносить', true); return; }
  stripMovedFromSource(fromCard);
  document.getElementById('move-entry-dialog')?.remove();
  try {
    if(moveTargetCard.spaceId === currentSpaceId) {
      const toCard = cards.find(c=>c.id===moveTargetCard.id);
      if(!toCard) { toast('Карточка не найдена', true); return; }
      toCard.entries = [...movedEntries, ...(toCard.entries||[])];
      await dbUpdate(toCard);
    } else {
      const {data:toCardData} = await sb.from('cards').select('*').eq('id', moveTargetCard.id).single();
      if(!toCardData) { toast('Карточка не найдена', true); return; }
      const updatedEntries = [...movedEntries, ...(toCardData.entries||[])];
      await sb.from('cards').update({entries: updatedEntries}).eq('id', moveTargetCard.id);
    }
    if(moveDeleteSource && (fromCard.entries||[]).length === 0 && confirm('Карточка «' + fromCard.title + '» пуста. Удалить её?')) {
      deleteCardById(fromCard.id);
    } else {
      await dbUpdate(fromCard);
    }
    render(); openView(fromCardId);
    toast('✓ Перенесено');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}

async function createCardAndMove(fromCardId, spaceId, catName) {
  const fromCard = cards.find(c=>c.id===fromCardId); if(!fromCard) return;
  const movedEntries = collectMoveEntries(fromCard);
  if(!movedEntries.length) { toast('Нечего переносить', true); return; }
  const title = prompt('Название новой карточки:');
  if(!title) return;
  const targetSpace = spaces.find(s=>s.id===spaceId);
  const isChat = targetSpace?.type==='family' || targetSpace?.type==='group';
  const newCard = {
    id:uid(), title, category:catName, status:'in_progress', space_id:spaceId, created_at:today(),
    entries:movedEntries, entryGroups:[], attachments:[], history:[],
    created_by:localStorage.getItem('mc_current_member')||currentUser?.display_name||'',
    chatParticipants: isChat ? (targetSpace.members||[]).map(m=>m.name) : undefined
  };
  stripMovedFromSource(fromCard);
  try {
    await sb.from('cards').insert(newCard);
    if(moveDeleteSource && (fromCard.entries||[]).length === 0 && confirm('Карточка «' + fromCard.title + '» пуста. Удалить её?')) {
      deleteCardById(fromCard.id);
    } else {
      await dbUpdate(fromCard);
    }
    if(spaceId===currentSpaceId) { cards.unshift(newCard); }
    document.getElementById('move-entry-dialog')?.remove();
    render(); openView(fromCardId);
    toast('✓ Карточка создана и запись перенесена');
  } catch(e) { toast('Ошибка: '+e.message, true); }
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

function toggleEntryMenu(btn, cardId, entryId) {
  // Close any open menus
  document.querySelectorAll('.entry-menu-popup').forEach(p=>p.remove());
  const wrap = btn.closest('.swipe-entry-wrap');
  const popup = document.createElement('div');
  popup.className = 'entry-menu-popup';
  popup.innerHTML = `
    <button onclick="deleteEntry('${cardId}','${entryId}');this.closest('.entry-menu-popup').remove()" style="background:rgba(232,96,96,.85);border:none;border-radius:8px;width:40px;height:40px;font-size:20px;cursor:pointer">🗑️</button>
    <button onclick="editEntry('${cardId}','${entryId}');this.closest('.entry-menu-popup').remove()" style="background:rgba(91,158,232,.85);border:none;border-radius:8px;width:40px;height:40px;font-size:20px;cursor:pointer">📝</button>
    <button onclick="moveEntry('${cardId}','${entryId}');this.closest('.entry-menu-popup').remove()" style="background:rgba(91,184,122,.85);border:none;border-radius:8px;width:40px;height:40px;font-size:20px;cursor:pointer">📤</button>
  `;
  wrap.style.position = 'relative';
  wrap.appendChild(popup);
  setTimeout(()=>document.addEventListener('click', function h(e){
    if(!popup.contains(e.target)&&e.target!==btn){popup.remove();document.removeEventListener('click',h);}
  }), 100);
}

function toggleCompletions(entryId) {
  const el = document.getElementById('comp_'+entryId);
  if(!el) return;
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

async function toggleMyCompletion(cardId, entryId, memberName) {
  const myName = localStorage.getItem('mc_current_member')||'';
  if(myName.toLowerCase() !== memberName.toLowerCase()) {
    toast('Это не твоя галочка', true); return;
  }
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  const entry = (card.entries||[]).find(e=>e.id===entryId); if(!entry) return;
  const comp = (entry.completions||[]).find(c=>c.name.toLowerCase()===memberName.toLowerCase());
  if(!comp) return;
  comp.done = !comp.done;
  entry.done = entry.completions.every(c=>c.done);
  render(); openView(cardId);
  try { await dbUpdate(card); } catch(e) { toast('Ошибка синхронизации', true); }
}
function aeToggleAssign(btn, val, event) {
  event.stopPropagation();
  const wrap = btn.closest('div[style*="margin-top:6px"]');
  if(!wrap) return;
  const allBtns = wrap.querySelectorAll('.ae-assign-btn');
  if(val === '' || val === 'all') {
    allBtns.forEach(b => { b.style.background='transparent'; b.style.color='var(--t2)'; b.classList.remove('on'); });
    btn.style.background = 'var(--accent)'; btn.style.color = '#0f0f0f'; btn.classList.add('on');
  } else {
    const noneBtns = wrap.querySelectorAll('[data-val=""], [data-val="all"]');
    noneBtns.forEach(b => { b.style.background='transparent'; b.style.color='var(--t2)'; b.classList.remove('on'); });
    btn.classList.toggle('on');
    btn.style.background = btn.classList.contains('on') ? 'var(--accent)' : 'transparent';
    btn.style.color = btn.classList.contains('on') ? '#0f0f0f' : 'var(--t2)';
  }
}
