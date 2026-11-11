// ═══════════════════════════════════════════
//  «СВЯЗИ» (11 ноября 2026)
//  Разделы (Объекты, Темы, Проекты…) → темы → подтемы → карточки ЛИЧНЫХ кабинетов
//  + прямые связи карточка ↔ карточка с подписью и заметкой (двусторонние).
//  Таблицы: link_sections, link_topics, link_items, card_links (links.sql).
//  Карточки здесь только ССЫЛКИ: удаление темы не трогает карточки, удалённая карточка просто пропадает из темы.
//  Глобальные имена: mcLk*, а также внутренние lk* (свои, не пересекаются с другими файлами).
// ═══════════════════════════════════════════
(function(){
  const st = document.createElement('style');
  st.textContent = `
  .lk-row{display:flex;align-items:center;gap:9px;padding:10px 12px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);margin-bottom:6px;cursor:pointer}
  .lk-row:active{border-color:var(--accent)}
  .lk-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
  .lk-bar{height:4px;background:var(--b1);border-radius:2px;overflow:hidden}
  .lk-bar>div{height:4px;background:var(--accent);border-radius:2px}
  .lk-sec{font-size:13px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;margin:16px 2px 8px}
  .lk-mini{background:none;border:none;color:var(--t3);font-size:13px;cursor:pointer;padding:4px 6px;font-family:inherit;border-radius:6px}
  .lk-mini:hover{color:var(--t1)}
  .lk-btn{background:var(--s2);border:1px solid var(--b1);border-radius:14px;color:var(--t1);font-size:13px;padding:7px 12px;cursor:pointer;font-family:inherit}
  .lk-btn.gold{border-color:var(--accent);color:var(--accent)}
  .lk-chip{flex-shrink:0;background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:5px 12px;font-size:12px;color:var(--t2);cursor:pointer;font-family:inherit;white-space:nowrap}
  .lk-chip.on{background:rgba(232,197,106,.15);border-color:var(--accent);color:var(--accent)}
  .lk-chip.new{border-style:dashed}
  .lk-tab{flex:1;background:var(--s2);border:1px solid var(--b1);color:var(--t2);padding:8px;font-size:13px;cursor:pointer;font-family:inherit}
  .lk-tab.on{background:var(--accent);color:#0f0f0f;border-color:var(--accent);font-weight:700}
  .lk-inp{width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px 12px;font-size:15px;color:var(--t1);font-family:inherit}
  .lk-inp:focus{outline:none;border-color:var(--accent)}
  .lk-lbl{font-size:11px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.04em;margin:12px 0 6px}
  .lk-wrap{display:flex;flex-wrap:wrap;gap:6px}
  @media(min-width:900px){
    #lk-ov{inset:0 auto 0 0;width:var(--split-left);min-width:320px;background:var(--s1);border-right:1px solid var(--b1);align-items:stretch}
    #lk-ov .sheet{transform:none;max-height:none;height:100%;width:100%;border-radius:0;overflow-y:auto}
  }`;
  document.head.appendChild(st);
})();

const LK = { sections:[], topics:[], items:[], links:[], cards:{}, loaded:0, err:'', offline:false,
             view:'home', topicId:null, mode:'list', cab:new Set(), hideDone:false };
const LK_PAL = ['#a07de8','#5bc8e8','#5bb87a','#e88a3a','#e85bb0','#5b9ee8','#e8c56a'];
const LK_ICONS = ['🏢','💡','📁','🏠','🧩','📌','🛠','🎓'];

// ── помощники ──
function lkPersonalIds(){ return (typeof spaces!=='undefined'&&spaces||[]).filter(s=>s.type!=='family'&&s.type!=='group'&&s.status!=='closed').map(s=>s.id); }
function lkIsChat(card){ return Array.isArray(card&&card.chatParticipants) && card.chatParticipants.length>0; } // пустой [] — обычная карточка
function lkIsPersonal(card){ return !!card && !lkIsChat(card) && lkPersonalIds().includes(card.space_id); }
function lkSpName(id){ return ((typeof spaces!=='undefined'&&spaces||[]).find(s=>s.id===id)?.name) || 'Кабинет'; }
function lkCabCol(id){ const l=(typeof spaces!=='undefined'&&spaces)||[]; const i=l.findIndex(s=>s.id===id); return (i>=0&&l[i].color) || LK_PAL[(i<0?0:i)%LK_PAL.length]; }
function lkCatCol(c){ return (window._clCatColors && window._clCatColors[c.space_id+'||'+(c.category||'')]) || 'var(--t1)'; }
function lkE(s){ return (typeof esc==='function') ? esc(s==null?'':String(s)) : String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function lkToast(t,bad){ if(typeof toast==='function') toast(t,bad); }
function lkCacheKey(){ return 'mc_lk_cache_'+((typeof currentUser!=='undefined'&&currentUser&&currentUser.id)||''); }
function lkCard(id){ const m=(typeof cards!=='undefined'&&cards||[]).find(c=>c.id===id); const c=LK.cards[id]; if(m&&c) return {...c,title:m.title,status:m.status,category:m.category,deadline:m.deadline}; return c||null; }
function lkTopic(id){ return LK.topics.find(t=>t.id===id); }
function lkSubs(topicId){ return LK.topics.filter(t=>t.parent_id===topicId); }
function lkRootOf(t){ return t && t.parent_id ? lkTopic(t.parent_id) : t; }
function lkNoTables(e){ const s=((e&&(e.code||''))+' '+(e&&(e.message||''))); return /42P01|PGRST205|does not exist|Could not find the table/i.test(s); }
// карточки темы (сама тема + подтемы), только существующие карточки личных кабинетов
function lkTopicCardIds(topicId, withSubs){
  const ids = new Set([topicId, ...(withSubs ? lkSubs(topicId).map(s=>s.id) : [])]);
  return [...new Set(LK.items.filter(i=>ids.has(i.topic_id)).map(i=>i.card_id))];
}
function lkStats(topicId){
  const ids = lkTopicCardIds(topicId, true).map(lkCard).filter(c=>c&&lkIsPersonal(c));
  return { total: ids.length, done: ids.filter(c=>c.status==='done').length };
}

// сроки темы: ближайший срок у невыполненных и число просроченных
function lkToday(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function lkDue(topicId, withSubs){
  const t0=lkToday();
  const open=lkTopicCardIds(topicId, withSubs).map(lkCard).filter(c=>c&&lkIsPersonal(c)&&c.status!=='done'&&c.deadline);
  const over=open.filter(c=>String(c.deadline).slice(0,10)<t0).length;
  const next=open.map(c=>String(c.deadline).slice(0,10)).filter(d=>d>=t0).sort()[0]||null;
  return {over, next};
}
function lkDueHTML(topicId, withSubs){
  const d=lkDue(topicId, withSubs);
  if(d.over) return `<span style="font-size:11px;font-weight:700;color:var(--red)">⚠ просрочено ${d.over}</span>`;
  if(d.next){ const di=(typeof deadlineInfo==='function')?deadlineInfo(d.next):null;
    return di?`<span class="dl-badge ${di.cls}" style="font-size:11px">${di.text}</span>`:`<span style="font-size:11px;color:var(--t2)">до ${d.next.slice(8,10)}.${d.next.slice(5,7)}</span>`; }
  return '';
}

// ── 3. порядок: «↑ Выше» / «↓ Ниже» среди соседей ──
function lkSortArr(a){ return a.sort((x,y)=>((x.sort||0)-(y.sort||0)) || String(x.created_at||'').localeCompare(String(y.created_at||''))); }
async function lkMove(kind, id, dir){
  if(lkNeedNet()) return;
  const table = kind==='sec' ? 'link_sections' : 'link_topics';
  const me = kind==='sec' ? LK.sections.find(x=>x.id===id) : lkTopic(id); if(!me) return;
  const sibs = lkSortArr(kind==='sec' ? [...LK.sections] : LK.topics.filter(t=>t.section_id===me.section_id && (t.parent_id||null)===(me.parent_id||null)));
  const i=sibs.indexOf(me), j=i+dir; if(i<0||j<0||j>=sibs.length) return;
  [sibs[i],sibs[j]]=[sibs[j],sibs[i]];
  const changed=sibs.map((x,k)=>({x,k})).filter(o=>(o.x.sort||0)!==o.k);
  try {
    const rs=await Promise.all(changed.map(o=>sb.from(table).update({sort:o.k}).eq('id',o.x.id)));
    for(const r of rs) if(r.error) throw r.error;
    changed.forEach(o=>{ o.x.sort=o.k; });
    lkSortArr(LK.sections); lkSortArr(LK.topics); lkSaveCache(); lkRender();
  } catch(e){ lkToast('Не удалось сохранить порядок: '+(e.message||e), true); }
}

// ── загрузка ──
async function lkLoad(force){
  if(!force && LK.loaded && Date.now()-LK.loaded < 30000) return;
  LK.err=''; LK.offline=false;
  try {
    if(!navigator.onLine) throw {offline:true};
    const r = await Promise.all([
      sb.from('link_sections').select('*').order('sort').order('created_at'),
      sb.from('link_topics').select('*').order('sort').order('created_at'),
      sb.from('link_items').select('*').order('created_at'),
      sb.from('card_links').select('*').order('created_at')
    ]);
    for(const x of r) if(x.error) throw x.error;
    LK.sections=r[0].data||[]; LK.topics=r[1].data||[]; LK.items=r[2].data||[]; LK.links=r[3].data||[];
    const ids=[...new Set([...LK.items.map(i=>i.card_id), ...LK.links.flatMap(l=>[l.a_id,l.b_id])])];
    const map={};
    for(let k=0;k<ids.length;k+=150){ // только нужные поля, не select('*')
      const q = await sb.from('cards').select('id,title,status,space_id,category,deadline,chatParticipants').in('id', ids.slice(k,k+150));
      if(q.error) throw q.error;
      (q.data||[]).forEach(c=>{ map[c.id]=c; });
    }
    LK.cards=map;
    const pids=lkPersonalIds();
    if(pids.length && !window._clCatColors){
      try { const { data: cd } = await sb.from('categories').select('name,color,space_id').in('space_id', pids);
        window._clCatColors={}; (cd||[]).forEach(c=>{ window._clCatColors[c.space_id+'||'+(c.name||'')]=c.color; }); } catch(_){}
    }
    LK.loaded=Date.now();
    lkSaveCache();
  } catch(e) {
    if(lkNoTables(e)) { LK.err='nosql'; return; }
    try { const c=JSON.parse(localStorage.getItem(lkCacheKey())||'null'); if(c){ Object.assign(LK,{sections:c.sections||[],topics:c.topics||[],items:c.items||[],links:c.links||[],cards:c.cards||{}}); } } catch(_){}
    LK.offline=true;
  }
}
function lkSaveCache(){ try { localStorage.setItem(lkCacheKey(), JSON.stringify({sections:LK.sections,topics:LK.topics,items:LK.items,links:LK.links,cards:LK.cards})); } catch(_){} }
async function lkIns(table,row){ const {data,error}=await sb.from(table).insert(row).select().single(); if(error) throw error; return data; }
function lkNeedNet(){ if(!navigator.onLine){ lkToast('Нужен интернет, чтобы менять связи', true); return true; } return false; }

// ── маленькие окна: ввод имени и подтверждение (закрываются кнопкой «назад», z-index:2000) ──
function lkAsk(title, val, withIcons, icon){
  return new Promise(res=>{
    let ic = icon || LK_ICONS[0];
    const d=document.createElement('div');
    d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML=`<div style="background:var(--s1);border-radius:var(--r);padding:18px;max-width:360px;width:100%">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">${lkE(title)}</div>
      ${withIcons?`<div class="lk-wrap" style="margin-bottom:10px">${LK_ICONS.map(i=>`<button type="button" class="lk-chip${i===ic?' on':''}" data-ic="${i}" style="font-size:18px;padding:4px 10px">${i}</button>`).join('')}</div>`:''}
      <input class="lk-inp" dir="auto" value="${lkE(val||'')}" placeholder="Название">
      <div style="display:flex;gap:8px;margin-top:14px">
        <button type="button" class="btn-s" style="flex:1" data-x="0">Отмена</button>
        <button type="button" class="btn-p" style="flex:1" data-x="1">Готово</button>
      </div></div>`;
    document.body.appendChild(d);
    const inp=d.querySelector('input'); setTimeout(()=>{ inp.focus(); inp.select(); },60);
    d.querySelectorAll('[data-ic]').forEach(b=>b.onclick=()=>{ ic=b.dataset.ic; d.querySelectorAll('[data-ic]').forEach(x=>x.classList.toggle('on',x===b)); });
    const done=ok=>{ const v=inp.value.trim(); d.remove(); res(ok&&v?{name:v,icon:ic}:null); };
    d.querySelector('[data-x="0"]').onclick=()=>done(false);
    d.querySelector('[data-x="1"]').onclick=()=>done(true);
    inp.onkeydown=e=>{ if(e.key==='Enter') done(true); };
    d.onclick=e=>{ if(e.target===d) done(false); };
  });
}
function lkConfirm(text, yes){
  return new Promise(res=>{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML=`<div style="background:var(--s1);border-radius:var(--r);padding:18px;max-width:360px;width:100%">
      <div style="font-size:15px;line-height:1.5;margin-bottom:14px">${text}</div>
      <div style="display:flex;gap:8px"><button type="button" class="btn-s" style="flex:1" data-x="0">Отмена</button>
      <button type="button" class="btn-d" style="flex:1" data-x="1">${lkE(yes||'Удалить')}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector('[data-x="0"]').onclick=()=>{ d.remove(); res(false); };
    d.querySelector('[data-x="1"]').onclick=()=>{ d.remove(); res(true); };
    d.onclick=e=>{ if(e.target===d){ d.remove(); res(false); } };
  });
}
function lkMenu(anchor, items){ // небольшое меню «⋯»
  document.getElementById('lk-menu')?.remove();
  const r=anchor.getBoundingClientRect();
  const m=document.createElement('div'); m.id='lk-menu';
  m.style.cssText=`position:fixed;z-index:2000;top:${Math.max(8, Math.min(r.bottom+4, innerHeight-(items.length*44+12)))}px;left:${Math.max(8, Math.min(r.right-190, innerWidth-200))}px;width:190px;background:var(--s2);border:1px solid var(--b2);border-radius:var(--rsm);box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden`;
  m.innerHTML=items.map((it,i)=>`<div data-i="${i}" style="padding:11px 14px;font-size:14px;cursor:pointer;${it.red?'color:var(--red);':''}${i?'border-top:1px solid var(--b1);':''}">${it.t}</div>`).join('');
  document.body.appendChild(m);
  m.querySelectorAll('[data-i]').forEach(el=>el.onclick=()=>{ m.remove(); items[+el.dataset.i].f(); });
  setTimeout(()=>document.addEventListener('click', function h(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('click',h,true); } }, true), 0);
}

// ═══════════ Окно «Связи» ═══════════
function lkEnsure(){
  if(document.getElementById('lk-ov')) return;
  const ov=document.createElement('div');
  ov.className='overlay'; ov.id='lk-ov';
  ov.onclick=e=>{ if(e.target===ov) mcLkClose(); };
  ov.innerHTML=`<div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-head" style="gap:8px">
      <button id="lk-back" onclick="mcLkBack('close')" title="Назад" style="display:none;background:none;border:none;color:var(--t1);font-size:20px;cursor:pointer;padding:0 6px 0 0">←</button>
      <span class="sheet-title" id="lk-title" dir="auto" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔗 Связи</span>
      <span id="lk-head-act"></span>
      <button class="close-btn" onclick="mcLkClose()">✕</button>
    </div>
    <div id="lk-body" style="padding:12px 16px 20px"></div>
  </div>`;
  document.body.appendChild(ov);
}
async function mcLkOpen(){
  lkEnsure();
  document.getElementById('lk-ov').classList.add('on');
  if(!LK.loaded) document.getElementById('lk-body').innerHTML='<div style="text-align:center;color:var(--t3);padding:24px">Загрузка…</div>';
  else lkRender();
  await lkLoad(false);
  if(LK.view==='topic' && !lkTopic(LK.topicId)) LK.view='home';
  lkRender();
}
function mcLkClose(){ document.getElementById('lk-ov')?.classList.remove('on'); }
// «назад»: из темы — к разделам, с разделов — закрыть (кнопка нарочно содержит слово close: её нажимает общий обработчик «назад»)
function mcLkBack(){ if(LK.view==='topic'){ LK.view='home'; lkRender(); } else mcLkClose(); }
function mcLkReopen(){ mcLkOpen(); }
function lkRender(){ if(!document.getElementById('lk-ov')) return; if(LK.view==='topic') lkRenderTopic(); else lkRenderHome(); }

function lkNotice(){
  if(LK.err==='nosql') return `<div style="background:rgba(232,96,96,.1);border:1px solid rgba(232,96,96,.3);border-radius:var(--rsm);padding:12px;font-size:13px;line-height:1.5;color:var(--t1)">Таблицы связей ещё не созданы. Выполните файл <b>links.sql</b> в Supabase (SQL Editor) и откройте окно снова.</div>`;
  if(LK.offline) return `<div style="font-size:12px;color:var(--orange);margin-bottom:8px">Нет сети: показана сохранённая копия, изменения недоступны.</div>`;
  return '';
}

function lkRenderHome(){
  document.getElementById('lk-back').style.display='none';
  document.getElementById('lk-title').textContent='🔗 Связи';
  document.getElementById('lk-head-act').innerHTML='';
  const el=document.getElementById('lk-body');
  if(LK.err==='nosql'){ el.innerHTML=lkNotice(); return; }
  let h=lkNotice();
  if(!LK.sections.length){
    h+=`<div style="text-align:center;padding:30px 10px"><div style="font-size:40px;margin-bottom:10px">🔗</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">Соберите карточки по смыслу</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:16px">Создайте раздел (например, «Объекты»), в нём тему «Здание №1» и подтемы. В тему можно положить карточки из разных личных кабинетов.</div>
      <button class="lk-btn gold" onclick="lkNewSection()">＋ Первый раздел</button></div>`;
    el.innerHTML=h; return;
  }
  LK.sections.forEach(s=>{
    const tops=LK.topics.filter(t=>t.section_id===s.id && !t.parent_id);
    h+=`<div class="lk-sec"><span>${lkE(s.icon||'📁')}</span><span dir="auto" style="flex:1">${lkE(s.name)}</span>
      <button class="lk-mini" onclick="lkNewTopic('${s.id}',null)">＋ Тема</button>
      <button class="lk-mini" onclick="lkSectionMenu(this,'${s.id}')">⋯</button></div>`;
    if(!tops.length) h+=`<div style="font-size:12px;color:var(--t3);margin:0 2px 6px">Пока нет тем</div>`;
    tops.forEach(t=>{
      const s2=lkStats(t.id), pc=s2.total?Math.round(s2.done/s2.total*100):0, nsub=lkSubs(t.id).length;
      h+=`<div class="lk-row" onclick="lkOpenTopic('${t.id}')"><div style="flex:1;min-width:0">
        <div dir="auto" style="font-size:15px;font-weight:600">${lkE(t.name)}</div>
        <div class="lk-bar" style="margin-top:6px"><div style="width:${pc}%"></div></div></div>
        <div style="text-align:right;flex-shrink:0"><div style="font-size:12px;color:var(--t2)">${s2.done} из ${s2.total}</div>
        <div style="font-size:11px;color:var(--t3)">${nsub?nsub+' подт.':''}</div>${lkDueHTML(t.id,true)?`<div style="margin-top:3px">${lkDueHTML(t.id,true)}</div>`:''}</div></div>`;
    });
  });
  h+=`<div style="margin-top:16px"><button class="lk-btn" onclick="lkNewSection()">＋ Раздел</button></div>`;
  el.innerHTML=h;
}

function lkOpenTopic(id){ LK.view='topic'; LK.topicId=id; LK.cab.clear(); lkRender(); { const _s=document.querySelector('#lk-ov .sheet'); if(_s) _s.scrollTop=0; } }

function lkCardRowHTML(c, itemId){
  const dl=(typeof deadlineInfo==='function' && c.deadline && c.status!=='done') ? deadlineInfo(c.deadline) : null;
  const right = c.status==='done' ? '<span style="color:var(--green);font-size:15px">✓</span>'
    : dl ? `<span class="dl-badge ${dl.cls}" style="font-size:11px">${dl.text}</span>`
    : (c.status==='in_progress' ? '<span style="font-size:11px;color:var(--t3)">в процессе</span>' : '');
  return `<div class="lk-row" onclick="lkOpenCard('${c.id}')" style="${c.status==='done'?'opacity:.6':''}">
    <span class="lk-dot" style="background:${lkCabCol(c.space_id)}"></span>
    <div style="flex:1;min-width:0"><div dir="auto" style="font-size:14px;color:${lkCatCol(c)};${c.status==='done'?'text-decoration:line-through;':''}overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lkE(c.title||'Без названия')}</div>
    <div style="font-size:11px;color:var(--t3);margin-top:2px">${lkE(lkSpName(c.space_id))}${c.category?' › '+lkE(c.category):''}</div></div>
    ${right}
    ${itemId?`<button class="lk-mini" title="Перенести или убрать" style="font-size:16px" onclick="event.stopPropagation();lkItemMenu(this,'${itemId}')">⋯</button>`:''}
  </div>`;
}

function lkRenderTopic(){
  const t=lkTopic(LK.topicId); if(!t){ LK.view='home'; lkRenderHome(); return; }
  const sec=LK.sections.find(s=>s.id===t.section_id);
  document.getElementById('lk-back').style.display='';
  document.getElementById('lk-title').textContent=t.name;
  document.getElementById('lk-head-act').innerHTML=`<button class="lk-mini" style="font-size:18px" onclick="lkTopicMenu(this,'${t.id}')">⋯</button>`;
  const subs=lkSubs(t.id);
  const groups=[...subs.map(s=>({t:s, name:s.name})), {t:t, name:'Без подтемы', direct:true}];
  // все карточки темы → фильтры кабинетов
  const allCards=lkTopicCardIds(t.id,true).map(lkCard).filter(c=>c&&lkIsPersonal(c));
  const cabs=[...new Set(allCards.map(c=>c.space_id))];
  LK.cab=new Set([...LK.cab].filter(id=>cabs.includes(id)));
  const pass=c=>(!LK.cab.size||LK.cab.has(c.space_id)) && !(LK.hideDone&&c.status==='done');
  const s2=lkStats(t.id);
  let h=lkNotice();
  h+=`<div style="font-size:12px;color:var(--t3);margin-bottom:10px">${lkE(sec?.icon||'')} ${lkE(sec?.name||'')} · ${s2.done} из ${s2.total} готово</div>
    <div style="display:flex;margin-bottom:10px;border-radius:var(--rsm);overflow:hidden">
      <button class="lk-tab${LK.mode==='list'?' on':''}" style="border-radius:var(--rsm) 0 0 var(--rsm)" onclick="LK.mode='list';lkRender()">☰ Список</button>
      <button class="lk-tab${LK.mode==='map'?' on':''}" style="border-radius:0 var(--rsm) var(--rsm) 0" onclick="LK.mode='map';lkRender()">◎ Карта</button></div>
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none">
      ${cabs.length>1?`<button class="lk-chip${!LK.cab.size?' on':''}" onclick="LK.cab.clear();lkRender()">Все кабинеты</button>`+cabs.map(id=>`<button class="lk-chip${LK.cab.has(id)?' on':''}" onclick="lkToggleCab('${id}')"><span class="lk-dot" style="display:inline-block;background:${lkCabCol(id)};margin-right:5px;vertical-align:1px;width:7px;height:7px"></span>${lkE(lkSpName(id))}</button>`).join(''):''}
      <button class="lk-chip${LK.hideDone?' on':''}" onclick="LK.hideDone=!LK.hideDone;lkRender()">Скрыть готовые</button></div>`;
  if(!subs.length && !LK.items.some(i=>i.topic_id===t.id)){
    h+=`<div style="text-align:center;padding:26px 12px;border:1px dashed var(--b2);border-radius:var(--r);margin-top:10px">
      <div style="font-size:34px;margin-bottom:8px">🗂</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">Тема пока пустая</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:14px">Разбейте её на подтемы (например, «Проверка», «Электрика») или сразу добавьте карточки из любых личных кабинетов.</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="lk-btn" onclick="lkNewTopic('${t.section_id}','${t.id}')">＋ Подтема</button><button class="lk-btn gold" onclick="lkAddCards('${t.id}')">＋ Карточки</button></div></div>`;
    document.getElementById('lk-body').innerHTML=h; return;
  }
  if(LK.mode==='map'){ h+=lkMapSVG(t, groups, pass); document.getElementById('lk-body').innerHTML=h; return; }
  groups.forEach(g=>{
    const its=LK.items.filter(i=>i.topic_id===g.t.id);
    const rows=its.map(i=>({i, c:lkCard(i.card_id)}));
    const live=rows.filter(r=>r.c&&lkIsPersonal(r.c));
    if(g.direct && !rows.length) return;
    const done=live.filter(r=>r.c.status==='done').length, pc=live.length?Math.round(done/live.length*100):0;
    h+=`<div style="margin-top:14px"><div style="display:flex;align-items:center;gap:6px">
      <span dir="auto" style="font-size:14px;font-weight:700;color:${g.direct?'var(--t2)':'var(--accent)'};flex:1">${lkE(g.name)}</span>
      ${lkDue(g.t.id,false).over?`<span style="font-size:11px;font-weight:700;color:var(--red)">⚠ ${lkDue(g.t.id,false).over}</span>`:''}
      <span style="font-size:12px;color:var(--t3)">${done} из ${live.length}</span>
      <button class="lk-mini" title="Добавить карточки сюда" style="color:var(--accent);font-size:18px;padding:0 6px" onclick="lkAddCards('${t.id}','${g.t.id}')">＋</button>
      ${g.direct?'':`<button class="lk-mini" onclick="lkSubMenu(this,'${g.t.id}')">⋯</button>`}</div>
      ${g.direct?'':`<div class="lk-bar" style="margin:6px 0 8px"><div style="width:${pc}%"></div></div>`}
      ${live.filter(r=>pass(r.c)).map(r=>lkCardRowHTML(r.c, r.i.id)).join('')}
      ${rows.filter(r=>!r.c && !LK.offline).map(r=>`<div class="lk-row" style="opacity:.5;cursor:default"><span style="flex:1;font-size:13px">🗑 Карточка удалена</span><button class="lk-mini" onclick="lkRemoveItem('${r.i.id}')">✕</button></div>`).join('')}
      ${!live.length&&!g.direct?'<div style="font-size:12px;color:var(--t3);padding:4px 2px 2px">Пусто: добавьте карточки</div>':''}
    </div>`;
  });
  h+=`<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
    <button class="lk-btn" onclick="lkNewTopic('${t.section_id}','${t.id}')">＋ Подтема</button>
    <button class="lk-btn gold" onclick="lkAddCards('${t.id}')">＋ Карточки</button>
    <button class="lk-btn" onclick="mcLkExportTopicWord('${t.id}')">📄 В Word</button></div>`;
  document.getElementById('lk-body').innerHTML=h;
}
function lkToggleCab(id){ if(LK.cab.has(id)) LK.cab.delete(id); else LK.cab.add(id); lkRender(); }

// ── карта связей ──
function lkMapSVG(t, groups, pass){
  const W=360, H=440, cx=W/2, cy=H/2;
  const gs=groups.map(g=>({g, cards:LK.items.filter(i=>i.topic_id===g.t.id).map(i=>lkCard(i.card_id)).filter(c=>c&&lkIsPersonal(c)&&pass(c))}))
                 .filter(x=>!x.g.direct || x.cards.length);
  if(!gs.length) return '<div style="text-align:center;color:var(--t3);padding:30px">Добавьте подтемы и карточки, и здесь появится карта</div>';
  const n=gs.length, R1=n===1?0:105, pos={};
  let lines='', nodes='', labels='';
  const short=s=>{ s=String(s||''); return s.length>12?s.slice(0,11)+'…':s; };
  gs.forEach((x,k)=>{
    const a=-Math.PI/2 + k*2*Math.PI/n, sx=cx+R1*Math.cos(a), sy=cy+R1*Math.sin(a);
    if(R1) lines+=`<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="rgba(255,255,255,.25)" stroke-width="1.2"/>`;
    const m=x.cards.length, show=x.cards.slice(0,8), R2=R1?58:110, spread=Math.min(Math.PI*1.1, 0.55*Math.max(1,show.length-1));
    show.forEach((c,j)=>{
      const ang = R1 ? a + (show.length>1 ? -spread/2 + j*spread/(show.length-1) : 0) // веером наружу от подтемы
                     : (-Math.PI/2 + j*2*Math.PI/Math.max(1,show.length));               // одна группа — кругом
      const px=sx+R2*Math.cos(ang), py=sy+R2*Math.sin(ang);
      pos[c.id]={x:px,y:py};
      lines+=`<line x1="${sx}" y1="${sy}" x2="${px}" y2="${py}" stroke="rgba(255,255,255,.18)" stroke-width="1"/>`;
      nodes+=`<g style="cursor:pointer" onclick="lkOpenCard('${c.id}')"><circle cx="${px}" cy="${py}" r="11" fill="${lkCabCol(c.space_id)}" ${c.status==='done'?'opacity=".45"':''}/>
        <text x="${px}" y="${py+23}" fill="#ccc" font-size="10" text-anchor="middle">${lkE(short(c.title))}</text></g>`;
    });
    if(m>show.length) nodes+=`<text x="${sx}" y="${sy+40}" fill="#888" font-size="10" text-anchor="middle">+${m-show.length}</text>`;
    if(R1) nodes+=`<g><circle cx="${sx}" cy="${sy}" r="24" fill="#1a1a1a" stroke="${x.g.direct?'#555':'#e8c56a'}" stroke-width="1.2"/>
      <text x="${sx}" y="${sy+4}" fill="${x.g.direct?'#999':'#e8c56a'}" font-size="10" text-anchor="middle">${lkE(short(x.g.direct?'без подт.':x.g.name))}</text></g>`;
  });
  // прямые связи карточка ↔ карточка (пунктир с подписью)
  LK.links.forEach(l=>{
    const A=pos[l.a_id], B=pos[l.b_id]; if(!A||!B) return;
    lines+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#e8c56a" stroke-width="1" stroke-dasharray="4 4" opacity=".75"/>`;
    if(l.label) labels+=`<text x="${(A.x+B.x)/2}" y="${(A.y+B.y)/2-4}" fill="#e8c56a" font-size="10" text-anchor="middle">«${lkE(l.label.length>20?l.label.slice(0,19)+'…':l.label)}»</text>`;
  });
  const center=`<circle cx="${cx}" cy="${cy}" r="${R1?32:0}" fill="#2a2414" stroke="#e8c56a"/>${R1?`<text x="${cx}" y="${cy+4}" fill="#e8c56a" font-size="11" text-anchor="middle">${lkE(short(t.name))}</text>`:''}`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:520px;margin:6px auto 0">${lines}${R1?center:''}${nodes}${labels}</svg>
    <div style="font-size:11px;color:var(--t3);text-align:center">Цвет кружка — кабинет. Пунктир — прямая связь с подписью. Нажмите на кружок, чтобы открыть карточку.</div>`;
}

// ── создание / правка / удаление ──
async function lkNewSection(){
  if(lkNeedNet()) return;
  const r=await lkAsk('Новый раздел', '', true); if(!r) return;
  try { const s=await lkIns('link_sections',{name:r.name, icon:r.icon, sort:LK.sections.length}); LK.sections.push(s); lkSaveCache(); lkRender(); }
  catch(e){ lkToast('Не удалось сохранить: '+(e.message||e), true); }
}
async function lkNewTopic(sectionId, parentId){
  if(lkNeedNet()) return null;
  const r=await lkAsk(parentId?'Новая подтема':'Новая тема', ''); if(!r) return null;
  try { const t=await lkIns('link_topics',{section_id:sectionId, parent_id:parentId||null, name:r.name, sort:LK.topics.length});
    LK.topics.push(t); lkSaveCache(); if(document.getElementById('lk-ov')?.classList.contains('on')) lkRender(); return t; }
  catch(e){ lkToast('Не удалось сохранить: '+(e.message||e), true); return null; }
}
function lkSectionMenu(btn, id){
  const s=LK.sections.find(x=>x.id===id); if(!s) return;
  lkMenu(btn,[
    {t:'↑ Выше', f:()=>lkMove('sec', id, -1)},
    {t:'↓ Ниже', f:()=>lkMove('sec', id, 1)},
    {t:'✎ Переименовать', f:async()=>{ if(lkNeedNet()) return; const r=await lkAsk('Раздел', s.name, true, s.icon); if(!r) return;
      const {error}=await sb.from('link_sections').update({name:r.name, icon:r.icon}).eq('id',id); if(error){ lkToast('Ошибка: '+error.message,true); return; }
      s.name=r.name; s.icon=r.icon; lkSaveCache(); lkRender(); }},
    {t:'🗑 Удалить раздел', red:true, f:async()=>{ if(lkNeedNet()) return;
      if(!await lkConfirm(`Удалить раздел «${lkE(s.name)}» со всеми темами?<br><span style="color:var(--t2);font-size:13px">Сами карточки останутся на своих местах.</span>`)) return;
      const {error}=await sb.from('link_sections').delete().eq('id',id); if(error){ lkToast('Ошибка: '+error.message,true); return; }
      const tids=new Set(LK.topics.filter(t=>t.section_id===id).map(t=>t.id));
      LK.sections=LK.sections.filter(x=>x.id!==id); LK.topics=LK.topics.filter(t=>!tids.has(t.id)); LK.items=LK.items.filter(i=>!tids.has(i.topic_id));
      lkSaveCache(); lkRender(); }}
  ]);
}
function lkTopicMenu(btn, id){ lkSubMenu(btn, id); }
function lkSubMenu(btn, id){
  const t=lkTopic(id); if(!t) return;
  const what=t.parent_id?'подтему':'тему';
  lkMenu(btn,[
    ...(t.parent_id?[]:[{t:'📄 В Word', f:()=>mcLkExportTopicWord(id)}]),
    {t:'↑ Выше', f:()=>lkMove('top', id, -1)},
    {t:'↓ Ниже', f:()=>lkMove('top', id, 1)},
    {t:'✎ Переименовать', f:async()=>{ if(lkNeedNet()) return; const r=await lkAsk(t.parent_id?'Подтема':'Тема', t.name); if(!r) return;
      const {error}=await sb.from('link_topics').update({name:r.name}).eq('id',id); if(error){ lkToast('Ошибка: '+error.message,true); return; }
      t.name=r.name; lkSaveCache(); lkRender(); }},
    {t:'🗑 Удалить '+what, red:true, f:async()=>{ if(lkNeedNet()) return;
      if(!await lkConfirm(`Удалить ${what} «${lkE(t.name)}»?<br><span style="color:var(--t2);font-size:13px">Сами карточки останутся на своих местах.</span>`)) return;
      const {error}=await sb.from('link_topics').delete().eq('id',id); if(error){ lkToast('Ошибка: '+error.message,true); return; }
      const tids=new Set([id, ...lkSubs(id).map(s=>s.id)]);
      LK.topics=LK.topics.filter(x=>!tids.has(x.id)); LK.items=LK.items.filter(i=>!tids.has(i.topic_id));
      if(tids.has(LK.topicId)) LK.view='home';
      lkSaveCache(); lkRender(); }}
  ]);
}
async function lkRemoveItem(itemId){
  if(lkNeedNet()) return;
  const {error}=await sb.from('link_items').delete().eq('id',itemId); if(error){ lkToast('Ошибка: '+error.message,true); return; }
  LK.items=LK.items.filter(i=>i.id!==itemId); lkSaveCache();
  if(document.getElementById('lk-ov')?.classList.contains('on')) lkRender();
  lkRefreshView();
}
async function lkRemoveLink(id){
  if(lkNeedNet()) return;
  if(!await lkConfirm('Убрать эту связь между карточками?','Убрать')) return;
  const {error}=await sb.from('card_links').delete().eq('id',id); if(error){ lkToast('Ошибка: '+error.message,true); return; }
  LK.links=LK.links.filter(l=>l.id!==id); lkSaveCache(); lkRefreshView();
}
function lkItemMenu(btn, itemId){
  lkMenu(btn,[
    {t:'↪ Перенести в…', f:()=>lkMoveItem(itemId)},
    {t:'✕ Убрать из темы', red:true, f:()=>lkRemoveItem(itemId)}
  ]);
}
function lkMoveItem(itemId){
  const it=LK.items.find(i=>i.id===itemId); if(!it) return;
  if(lkNeedNet()) return;
  const cur=lkTopic(it.topic_id), root=lkRootOf(cur); if(!root) return;
  const c=lkCard(it.card_id);
  const opts=[...lkSubs(root.id).map(s=>({id:s.id,name:s.name})), {id:root.id,name:'Без подтемы'}].filter(o=>o.id!==it.topic_id);
  if(!opts.length){ lkToast('Сначала создайте ещё одну подтему'); return; }
  const d=lkSheet(`<div style="display:flex;align-items:center;margin-bottom:10px"><div dir="auto" style="flex:1;font-size:16px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Перенести «${lkE(c?.title||'карточку')}»</div>
      <button class="close-btn" onclick="this.closest('.lk-sheet-ov').remove()">✕</button></div>
    <div class="lk-lbl" style="margin-top:0">Куда в «${lkE(root.name)}»</div>
    <div class="lk-wrap">${opts.map(o=>`<button class="lk-chip" data-to="${o.id}" dir="auto">${lkE(o.name)}</button>`).join('')}</div>`);
  d.querySelectorAll('[data-to]').forEach(b=>b.onclick=async()=>{
    const to=b.dataset.to;
    if(LK.items.some(i=>i.topic_id===to&&i.card_id===it.card_id)){ lkToast('Карточка уже там'); return; }
    const {error}=await sb.from('link_items').update({topic_id:to}).eq('id',itemId);
    if(error){ lkToast('Ошибка: '+error.message,true); return; }
    it.topic_id=to; lkSaveCache(); d.remove(); lkToast('✓ Перенесено'); lkRender(); lkRefreshView();
  });
}
async function lkAddItem(topicId, card){
  if(LK.items.some(i=>i.topic_id===topicId&&i.card_id===card.id)){ lkToast('Карточка уже здесь'); return false; }
  try { const it=await lkIns('link_items',{topic_id:topicId, card_id:card.id, space_id:card.space_id});
    LK.items.push(it); LK.cards[card.id]=LK.cards[card.id]||{id:card.id,title:card.title,status:card.status,space_id:card.space_id,category:card.category,deadline:card.deadline};
    lkSaveCache(); return true; }
  catch(e){ lkToast('Не удалось сохранить: '+(e.message||e), true); return false; }
}

// ── открыть карточку из «Связей» (подтягиваем полную карточку, потом обычный путь лобби) ──
async function lkFullCard(id){
  let full=(typeof cards!=='undefined'&&cards||[]).find(c=>c.id===id);
  if(!full){ try { const {data}=await sb.from('cards').select('*').eq('id',id).maybeSingle(); full=data; } catch(_){} }
  if(!full){ try { full=(await local.getAll('cards')).find(c=>c.id===id); } catch(_){} }
  return full||null;
}
async function lkOpenCard(id){
  const full=await lkFullCard(id); if(!full){ lkToast('Карточка недоступна', true); return; }
  window._clCache=[full];
  mcLkClose();
  window._backTo='mcLkReopen'; // из карточки вернёмся в это окно
  clOpenCard(id);
}

// ═══════════ Добавить карточки в тему (из окна темы) ═══════════
async function lkSearchCards(q, exclude){
  const pids=lkPersonalIds(); LK.searchErr=''; if(!pids.length){ LK.searchErr='не найдено ни одного личного кабинета'; return []; }
  let res=[];
  try {
    if(!navigator.onLine) throw 0;
    let qq=sb.from('cards').select('id,title,status,space_id,category,deadline,chatParticipants').in('space_id',pids).order('created_at',{ascending:false}).limit(25);
    if(q) qq=qq.ilike('title','%'+q.replace(/[%_]/g,'')+'%');
    const {data,error}=await qq; if(error) throw error; res=data||[]; LK.searchErr='';
  } catch(_e){
    LK.searchErr=(_e&&(_e.message||_e.code))?String(_e.message||_e.code):(navigator.onLine?'':'нет сети');
    try { const ql=q.toLowerCase(); res=(await local.getAll('cards')).filter(c=>pids.includes(c.space_id)&&(!q||String(c.title||'').toLowerCase().includes(ql))).slice(0,25); } catch(__){ res=[]; }
  }
  return res.filter(c=>!lkIsChat(c) && !(exclude||[]).includes(c.id)).slice(0,15);
}
function lkSheet(html){ // нижнее окно поверх всего (закрывается кнопкой «назад», z-index:2000)
  const d=document.createElement('div');
  d.className='lk-sheet-ov';
  d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000;display:flex;align-items:flex-end;justify-content:center';
  d.innerHTML=`<div style="background:var(--s1);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:16px 16px calc(18px + var(--safe))">${html}</div>`;
  d.onclick=e=>{ if(e.target===d) d.remove(); };
  document.body.appendChild(d);
  return d;
}
function lkAddCards(topicId, preTarget){
  const t=lkTopic(topicId); if(!t) return;
  if(lkNeedNet()) return;
  const subs=lkSubs(topicId);
  let target=preTarget||subs[0]?.id||topicId, timer=null;
  const d=lkSheet(`<div style="display:flex;align-items:center;margin-bottom:10px"><div dir="auto" style="flex:1;font-size:16px;font-weight:700">Карточки в «${lkE(t.name)}»</div>
      <button class="close-btn" onclick="this.closest('.lk-sheet-ov').remove()">✕</button></div>
    ${subs.length?`<div class="lk-lbl" style="margin-top:0">Куда</div><div class="lk-wrap" id="lka-sub"></div>`:''}
    <div class="lk-lbl">Поиск по всем личным кабинетам</div>
    <input class="lk-inp" id="lka-q" dir="auto" placeholder="Название карточки">
    <div id="lka-res" style="margin-top:8px"></div>`);
  const paintSubs=()=>{ const w=d.querySelector('#lka-sub'); if(!w) return;
    w.innerHTML=subs.map(s=>`<button class="lk-chip${target===s.id?' on':''}" data-s="${s.id}">${lkE(s.name)}</button>`).join('')+`<button class="lk-chip${target===topicId?' on':''}" data-s="${topicId}">Без подтемы</button>`;
    w.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ target=b.dataset.s; paintSubs(); run(); }); };
  const run=async()=>{
    const q=d.querySelector('#lka-q').value.trim();
    const list=await lkSearchCards(q, LK.items.filter(i=>i.topic_id===target).map(i=>i.card_id));
    const box=d.querySelector('#lka-res'); if(!box) return;
    box.innerHTML=list.length?list.map(c=>`<div class="lk-row" data-id="${c.id}"><span class="lk-dot" style="background:${lkCabCol(c.space_id)}"></span>
      <div style="flex:1;min-width:0"><div dir="auto" style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lkE(c.title||'Без названия')}</div><div style="font-size:11px;color:var(--t3)">${lkE(lkSpName(c.space_id))}${c.category?' › '+lkE(c.category):''}</div></div>
      <span style="color:var(--accent);font-size:20px">＋</span></div>`).join(''):lkNothing();
    box.querySelectorAll('[data-id]').forEach(row=>row.onclick=async()=>{
      const c=list.find(x=>x.id===row.dataset.id); if(!c) return;
      if(await lkAddItem(target, c)){ row.remove(); lkToast('✓ Добавлено'); lkRender(); }
    });
  };
  paintSubs();
  d.querySelector('#lka-q').oninput=()=>{ clearTimeout(timer); timer=setTimeout(run,250); };
  run();
}

function lkNothing(){ // пустой результат поиска: где искали и почему могло не найтись
  const names=lkPersonalIds().map(lkSpName);
  return `<div style="font-size:13px;color:var(--t3);padding:8px 2px;line-height:1.5">Ничего не найдено.<br><span style="font-size:11px">Искала в кабинетах: ${names.length?names.map(lkE).join(', '):'—'}${LK.searchErr?'<br><span style="color:var(--red)">Ошибка: '+lkE(LK.searchErr)+'</span>':''}</span></div>`;
}
// ═══════════ Поиск 🔍: темы и подтемы «Связей» (вызывается из srchRun в app-search.js) ═══════════
async function mcLkSearchHTML(q){
  try {
    q=String(q||'').trim(); if(q.length<2) return {html:'',n:0};
    await lkLoad(false); if(LK.err) return {html:'',n:0};
    const ql=q.toLowerCase(), has=t=>String(t||'').toLowerCase().includes(ql);
    const hits=new Map(); // корневая тема → что совпало
    LK.topics.forEach(t=>{
      const sec=LK.sections.find(s=>s.id===t.section_id), root=lkRootOf(t); if(!root) return;
      if(has(t.name)) { const h=hits.get(root.id)||{root,subs:[]}; if(t.parent_id) h.subs.push(t.name); else h.self=true; hits.set(root.id,h); }
      else if(!t.parent_id && sec && has(sec.name) && !hits.has(t.id)) hits.set(t.id,{root:t,subs:[],bySec:true});
    });
    if(!hits.size) return {html:'',n:0};
    const mark=t=>{ t=String(t||''); const i=t.toLowerCase().indexOf(ql); return i<0?lkE(t):lkE(t.slice(0,i))+'<mark>'+lkE(t.slice(i,i+q.length))+'</mark>'+lkE(t.slice(i+q.length)); };
    const list=[...hits.values()];
    const html=`<div style="font-size:12px;color:var(--accent);font-weight:700;margin:4px 0 2px">🔗 Связи</div>`+list.map(h=>{
      const sec=LK.sections.find(s=>s.id===h.root.section_id), st=lkStats(h.root.id), due=lkDueHTML(h.root.id,true);
      return `<div onclick="mcLkOpenTopicFromSearch('${h.root.id}')" style="padding:10px 4px;border-top:1px solid var(--b1);cursor:pointer">
        <div style="font-size:14px;font-weight:600" dir="auto">${lkE(sec?.icon||'🔗')} ${mark(h.root.name)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:1px">${sec?mark(sec.name)+' · ':''}карточек: ${st.total}, готово ${st.done}${due?' · '+due:''}</div>
        ${h.subs.length?`<div style="font-size:13px;color:var(--t2)" dir="auto"><span style="font-size:10px;color:var(--t3)">подтема</span> ${h.subs.map(mark).join(', ')}</div>`:''}
      </div>`;
    }).join('');
    return {html, n:list.length};
  } catch(e){ return {html:'',n:0}; }
}
function mcLkOpenTopicFromSearch(id){
  if(typeof closeSearch==='function') closeSearch();
  LK.view='topic'; LK.topicId=id; LK.cab.clear(); LK.mode='list';
  mcLkOpen();
}

// ═══════════ Блок «Связи» в карточке (вызывается из openView) ═══════════
function mcLkViewBlock(card){
  if(!lkIsPersonal(card)) return '';
  setTimeout(()=>lkFillView(card.id), 0);
  return `<div class="view-sec" id="lk-vsec" data-cid="${card.id}"><div class="view-lbl">🔗 Связи</div><div id="lk-vbody" style="font-size:13px;color:var(--t3)">…</div></div>`;
}
function lkRefreshView(){ const s=document.getElementById('lk-vsec'); if(s) lkFillView(s.dataset.cid, true); }
async function lkFillView(cid, noLoad){
  if(!noLoad) await lkLoad(false);
  const box=document.getElementById('lk-vbody'), sec=document.getElementById('lk-vsec');
  if(!box || !sec || sec.dataset.cid!==cid) return;
  if(LK.err==='nosql'){ box.innerHTML='Чтобы связи заработали, выполните links.sql в Supabase.'; return; }
  let h='';
  // темы, в которых лежит карточка
  const its=LK.items.filter(i=>i.card_id===cid);
  if(its.length) h+=`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">`+its.map(i=>{
    const t=lkTopic(i.topic_id); if(!t) return ''; const root=lkRootOf(t), s=LK.sections.find(x=>x.id===t.section_id);
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 6px 4px 11px;border-radius:16px;font-size:13px;background:rgba(232,197,106,.13);border:1px solid rgba(232,197,106,.35);color:var(--accent)">
      <span style="cursor:pointer" dir="auto" onclick="lkFromCard('${root.id}')">${lkE(s?.icon||'')} ${lkE(root.name)}${t.parent_id?' › '+lkE(t.name):''}</span>
      <button onclick="lkRemoveItem('${i.id}')" title="Убрать" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:12px;padding:0 3px">✕</button></span>`;
  }).join('')+`</div>`;
  // прямые связи
  const ls=LK.links.filter(l=>l.a_id===cid||l.b_id===cid);
  ls.forEach(l=>{
    const oid=l.a_id===cid?l.b_id:l.a_id, o=lkCard(oid);
    h+=`<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-top:1px solid var(--b1)">
      <span class="lk-dot" style="margin-top:5px;background:${o?lkCabCol(o.space_id):'#555'}"></span>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="lkOpenOther('${oid}')">
        <div dir="auto" style="font-size:14px;color:var(--t1)">${o?lkE(o.title||'Без названия'):'🗑 Карточка удалена'} <span style="font-size:11px;color:var(--t3)">${o?'· '+lkE(lkSpName(o.space_id)):''}</span></div>
        ${l.label?`<div dir="auto" style="font-size:12px;color:var(--accent)">«${lkE(l.label)}»</div>`:''}
        ${l.note?`<div dir="auto" style="font-size:12px;color:var(--t2)">${lkE(l.note)}</div>`:''}
      </div>
      <button onclick="lkRemoveLink('${l.id}')" title="Убрать связь" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:12px">✕</button></div>`;
  });
  // соседи по подтеме (подсказка)
  const near=[...new Set(LK.items.filter(i=>its.some(x=>x.topic_id===i.topic_id)&&i.card_id!==cid).map(i=>i.card_id))]
    .filter(id=>!ls.some(l=>l.a_id===id||l.b_id===id)).map(lkCard).filter(c=>c&&lkIsPersonal(c)).slice(0,6);
  if(near.length) h+=`<div style="font-size:12px;color:var(--t3);margin-top:6px">Рядом в теме: `+near.map(c=>`<span onclick="lkOpenOther('${c.id}')" style="cursor:pointer;color:${lkCabCol(c.space_id)}" dir="auto">${lkE(c.title)}</span>`).join(' · ')+`</div>`;
  if(!its.length && !ls.length) h+=`<div style="font-size:13px;color:var(--t3)">Карточка пока ни с чем не связана.</div>`;
  if(LK.offline) h+=`<div style="font-size:11px;color:var(--orange);margin-top:6px">Нет сети: сохранённая копия.</div>`;
  h+=`<button onclick="mcLkPicker('${cid}')" style="margin-top:10px;background:var(--s2);border:1px solid var(--accent);color:var(--accent);border-radius:14px;padding:7px 14px;font-size:13px;cursor:pointer;font-family:inherit">＋ В связи</button>`;
  box.innerHTML=h;
}
function lkFromCard(topicId){
  window._backTo=null;
  if(typeof closeView==='function') closeView();
  LK.view='topic'; LK.topicId=topicId; LK.cab.clear();
  setTimeout(mcLkOpen, 150);
}
async function lkOpenOther(id){
  const full=await lkFullCard(id); if(!full){ lkToast('Карточка недоступна', true); return; }
  window._clCache=[full];
  const back=window._backTo; window._backTo=null;
  if(typeof closeView==='function') closeView();
  setTimeout(()=>{ window._backTo=back||null; clOpenCard(id); }, 220);
}

// ═══════════ Окно «В связи»: в тему или с карточкой ═══════════
function mcLkPicker(cid){
  if(lkNeedNet()) return;
  const me=lkCard(cid) || (typeof cards!=='undefined'&&cards||[]).find(c=>c.id===cid);
  if(!me){ lkToast('Карточка не найдена', true); return; }
  const P={tab:'topic', sec:LK.sections[0]?.id||null, top:null, sub:null, pick:null, list:[]};
  const d=lkSheet(`<div style="display:flex;align-items:center;margin-bottom:10px"><div dir="auto" style="flex:1;font-size:16px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">«${lkE(me.title)}» в связи</div>
      <button class="close-btn" onclick="this.closest('.lk-sheet-ov').remove()">✕</button></div>
    <div style="display:flex;margin-bottom:6px"><button class="lk-tab on" data-tab="topic" style="border-radius:var(--rsm) 0 0 var(--rsm)">В тему</button><button class="lk-tab" data-tab="card" style="border-radius:0 var(--rsm) var(--rsm) 0">С карточкой</button></div>
    <div id="lkp-body"></div>
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn-s" style="flex:1" id="lkp-cancel">Отмена</button><button type="button" class="btn-p" style="flex:1" id="lkp-save">Сохранить</button></div>`);
  const body=d.querySelector('#lkp-body');
  d.querySelector('#lkp-cancel').onclick=()=>d.remove();
  d.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ P.tab=b.dataset.tab; d.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x===b)); paint(); });
  let timer=null;
  const chips=(arr,sel,attr,newLbl)=>arr.map(x=>`<button class="lk-chip${sel===x.id?' on':''}" data-${attr}="${x.id}" dir="auto">${lkE(x.icon?x.icon+' ':'')}${lkE(x.name)}</button>`).join('')+(newLbl?`<button class="lk-chip new" data-${attr}="__new">＋ ${newLbl}</button>`:'');
  const paint=()=>{
    if(P.tab==='topic'){
      const tops=LK.topics.filter(t=>t.section_id===P.sec&&!t.parent_id);
      if(P.top && !tops.some(t=>t.id===P.top)) P.top=null;
      const subs=P.top?lkSubs(P.top):[];
      if(P.sub && !subs.some(s=>s.id===P.sub)) P.sub=null;
      body.innerHTML=`<div class="lk-lbl">Раздел</div><div class="lk-wrap">${chips(LK.sections,P.sec,'sec','раздел')}</div>
        ${P.sec?`<div class="lk-lbl">Тема</div><div class="lk-wrap">${chips(tops,P.top,'top','тема')}</div>`:''}
        ${P.top?`<div class="lk-lbl">Подтема</div><div class="lk-wrap"><button class="lk-chip${!P.sub?' on':''}" data-sub="">Без подтемы</button>${chips(subs,P.sub,'sub','подтема')}</div>`:''}`;
      body.querySelectorAll('[data-sec]').forEach(b=>b.onclick=async()=>{ if(b.dataset.sec==='__new'){ await lkNewSection(); P.sec=LK.sections[LK.sections.length-1]?.id||P.sec; } else P.sec=b.dataset.sec; P.top=null; P.sub=null; paint(); });
      body.querySelectorAll('[data-top]').forEach(b=>b.onclick=async()=>{ if(b.dataset.top==='__new'){ const t=await lkNewTopic(P.sec,null); if(t) P.top=t.id; } else P.top=b.dataset.top; P.sub=null; paint(); });
      body.querySelectorAll('[data-sub]').forEach(b=>b.onclick=async()=>{ if(b.dataset.sub==='__new'){ const t=await lkNewTopic(P.sec,P.top); if(t) P.sub=t.id; } else P.sub=b.dataset.sub||null; paint(); });
    } else {
      body.innerHTML=`<div class="lk-lbl">Карточка из любого личного кабинета</div>
        <input class="lk-inp" id="lkp-q" dir="auto" placeholder="Поиск по названию">
        <div id="lkp-res" style="margin-top:8px"></div>
        <div class="lk-lbl">Подпись связи</div><input class="lk-inp" id="lkp-label" dir="auto" placeholder="Например: та же проводка" maxlength="60">
        <div class="lk-lbl">Заметка (по желанию)</div><textarea class="lk-inp" id="lkp-note" dir="auto" rows="2" style="resize:none" placeholder="Почему связаны"></textarea>`;
      const run=async()=>{
        const q=(body.querySelector('#lkp-q')?.value||'').trim();
        const linked=LK.links.filter(l=>l.a_id===cid||l.b_id===cid).map(l=>l.a_id===cid?l.b_id:l.a_id);
        P.list=await lkSearchCards(q,[cid,...linked]);
        const box=body.querySelector('#lkp-res'); if(!box) return;
        box.innerHTML=P.list.length?P.list.map(c=>`<div class="lk-row" data-id="${c.id}" style="${P.pick===c.id?'border-color:var(--accent);background:rgba(232,197,106,.1)':''}"><span class="lk-dot" style="background:${lkCabCol(c.space_id)}"></span>
          <div style="flex:1;min-width:0"><div dir="auto" style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lkE(c.title||'Без названия')}</div><div style="font-size:11px;color:var(--t3)">${lkE(lkSpName(c.space_id))}${c.category?' › '+lkE(c.category):''}</div></div>
          ${P.pick===c.id?'<span style="color:var(--accent)">✓</span>':''}</div>`).join(''):lkNothing();
        box.querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>{ P.pick=r.dataset.id; run(); });
      };
      body.querySelector('#lkp-q').oninput=()=>{ clearTimeout(timer); timer=setTimeout(run,250); };
      run();
    }
  };
  d.querySelector('#lkp-save').onclick=async()=>{
    if(lkNeedNet()) return;
    const meCard={id:cid, title:me.title, status:me.status, space_id:me.space_id, category:me.category, deadline:me.deadline};
    if(P.tab==='topic'){
      const tid=P.sub||P.top; if(!tid){ lkToast('Выберите тему', true); return; }
      if(await lkAddItem(tid, meCard)){ d.remove(); lkToast('✓ Добавлено в связи'); lkRefreshView(); }
    } else {
      const o=P.list.find(c=>c.id===P.pick); if(!o){ lkToast('Выберите карточку', true); return; }
      const label=(body.querySelector('#lkp-label')?.value||'').trim(), note=(body.querySelector('#lkp-note')?.value||'').trim();
      const [a,b]=cid<o.id?[meCard,o]:[o,meCard];
      try { const l=await lkIns('card_links',{a_id:a.id, b_id:b.id, a_space:a.space_id, b_space:b.space_id, label:label||null, note:note||null});
        LK.links.push(l); LK.cards[o.id]=LK.cards[o.id]||{id:o.id,title:o.title,status:o.status,space_id:o.space_id,category:o.category,deadline:o.deadline};
        LK.cards[cid]=LK.cards[cid]||meCard; lkSaveCache(); d.remove(); lkToast('✓ Карточки связаны'); lkRefreshView(); }
      catch(e){ lkToast(/duplicate|23505/i.test((e.code||'')+(e.message||''))?'Эти карточки уже связаны':'Не удалось сохранить: '+(e.message||e), true); }
    }
  };
  paint();
}

// ═══════════ Выгрузка темы в Word (ZIP: документ + папка files). Оформление и помощники — из app-export.js ═══════════
function mcLkExportTopicWord(topicId){
  const t=lkTopic(topicId); if(!t) return;
  const root=lkRootOf(t);
  if(typeof JSZip==='undefined' || typeof mcDocPara!=='function'){ lkToast('Модуль Word не загрузился. Проверьте интернет и обновите страницу', true); return; }
  if(window._mcExporting){ lkToast('Документ уже собирается'); return; }
  const subs=lkSubs(root.id);
  const groups=[...subs.map(s=>({id:s.id,name:s.name})), {id:root.id,name:'Без подтемы',direct:true}]
    .map(g=>({...g, n:LK.items.filter(i=>i.topic_id===g.id).map(i=>lkCard(i.card_id)).filter(c=>c&&lkIsPersonal(c)).length}))
    .filter(g=>!g.direct||g.n);
  if(!groups.some(g=>g.n)){ lkToast('В теме пока нет карточек', true); return; }
  const P=(typeof mcExpPrefsLoad==='function')?mcExpPrefsLoad():{};
  const O={sel:new Set(groups.filter(g=>g.n).map(g=>g.id)), cards:'all', entries:'all', files:true, links:true, cab:true, signs:!!P.signs};
  const d=lkSheet(`<div style="display:flex;align-items:center;margin-bottom:6px"><div dir="auto" style="flex:1;font-size:16px;font-weight:700">📄 «${lkE(root.name)}» в Word</div>
      <button class="close-btn" onclick="this.closest('.lk-sheet-ov').remove()">✕</button></div>
    <div id="lkw-body"></div>
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn-s" style="flex:1" id="lkw-x">Отмена</button><button type="button" class="btn-p" style="flex:1" id="lkw-go">Выгрузить</button></div>`);
  const body=d.querySelector('#lkw-body');
  const seg=(key,opts)=>`<div class="lk-wrap">${opts.map(([v,l])=>`<button class="lk-chip${O[key]===v?' on':''}" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const chk=(key,label)=>`<label style="display:flex;gap:8px;align-items:center;font-size:14px;padding:5px 0;cursor:pointer"><input type="checkbox" data-c="${key}"${O[key]?' checked':''}> ${label}</label>`;
  const paint=()=>{
    body.innerHTML=`<div class="lk-lbl" style="margin-top:4px">Подтемы</div>
      ${groups.map(g=>`<label style="display:flex;gap:8px;align-items:center;font-size:14px;padding:4px 0;cursor:pointer"><input type="checkbox" data-g="${g.id}"${O.sel.has(g.id)?' checked':''}${g.n?'':' disabled'}> <span dir="auto">${lkE(g.name)}</span> <span style="color:var(--t3);font-size:12px">(${g.n})</span></label>`).join('')}
      <div class="lk-lbl">Карточки</div>${seg('cards',[['all','Все'],['open','Невыполненные']])}
      <div class="lk-lbl">Записи карточек</div>${seg('entries',[['all','Все'],['open','Только открытые'],['none','Без записей']])}
      <div class="lk-lbl">Что ещё</div>
      ${chk('files','Фото и файлы (папка files)')}${chk('links','Связи между карточками')}${chk('cab','Кабинет и рубрика у карточки')}${chk('signs','Строки для подписей')}
      <div style="font-size:12px;color:var(--t3);margin-top:8px;line-height:1.5">🎨 Оформление (логотип, студия, сайт, цвет разделителя) — то же, что в «📄 Word» у карточки${P.studio?': '+lkE(P.studio):''}.</div>`;
    body.querySelectorAll('[data-g]').forEach(i=>i.onchange=()=>{ i.checked?O.sel.add(i.dataset.g):O.sel.delete(i.dataset.g); });
    body.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ O[b.dataset.k]=b.dataset.v; paint(); });
    body.querySelectorAll('[data-c]').forEach(i=>i.onchange=()=>{ O[i.dataset.c]=i.checked; });
  };
  paint();
  d.querySelector('#lkw-x').onclick=()=>d.remove();
  d.querySelector('#lkw-go').onclick=()=>{
    if(!O.sel.size){ lkToast('Выберите хотя бы одну подтему', true); return; }
    d.remove();
    lkWordRun(root, groups.filter(g=>O.sel.has(g.id)), O, P);
  };
}

async function lkWordRun(root, groups, O, P){
  if(window._mcExporting) return;
  window._mcExporting=true;
  try {
    lkToast('⏳ Собираю документ…');
    // 1. полные карточки (с записями и файлами)
    const ids=[...new Set(groups.flatMap(g=>LK.items.filter(i=>i.topic_id===g.id).map(i=>i.card_id)))];
    const full={};
    (typeof cards!=='undefined'&&cards||[]).forEach(c=>{ if(ids.includes(c.id)) full[c.id]=c; });
    const need=ids.filter(id=>!full[id]);
    try { for(let k=0;k<need.length;k+=100){ const r=await sb.from('cards').select('*').in('id',need.slice(k,k+100)); if(r.error) throw r.error; (r.data||[]).forEach(c=>{ full[c.id]=c; }); } }
    catch(e){ try { (await local.getAll('cards')).forEach(c=>{ if(need.includes(c.id)) full[c.id]=c; }); } catch(_){} }
    // 2. структура
    const allAtts=[], reg=(a,tag)=>{ const o={a,tag}; allAtts.push(o); return o; };
    let total=0, doneCnt=0;
    const G=groups.map((g,gi)=>{
      const list=LK.items.filter(i=>i.topic_id===g.id).map(i=>full[i.card_id]).filter(c=>c&&lkIsPersonal(c)&&(O.cards==='all'||c.status!=='done'));
      const cs=list.map((c,ci)=>{
        const tag=String(gi+1)+'-'+String(ci+1);
        let ents=O.entries==='none'?[]:mcExportEntries(c).sort((a,b)=>(a.ts-b.ts)||(a.i-b.i));
        if(O.entries==='open') ents=ents.filter(x=>!x.e.done);
        const E=ents.map(x=>({e:x.e, atts:O.files?[...(x.e.sessionAtts||[]),...(x.e.attachments||[])].filter(a=>a&&a.data).map(a=>reg(a,tag)):[]}));
        const cardAtts=O.files?(c.attachments||[]).filter(a=>a&&a.data).map(a=>reg(a,tag)):[];
        total++; if(c.status==='done') doneCnt++;
        return {c, E, cardAtts, num:(gi+1)+'.'+(ci+1)};
      });
      return {...g, num:gi+1, cs};
    }).filter(g=>g.cs.length);
    if(!G.length){ lkToast('По выбранным условиям карточек нет', true); return; }
    // 3. файлы (по 3 одновременно)
    const zip=new JSZip(), folder=_safeName(root.name,60), rootDir=zip.folder(folder), filesDir=rootDir.folder('files');
    const used=new Set(), queue=allAtts.slice(); let got=0;
    const worker=async()=>{ while(queue.length){ const o=queue.shift(), a=o.a;
      let base=_safeName(a.name||'file',90);
      if(!/\.[A-Za-z0-9]{1,5}$/.test(base)){ const ext=((a.type||'').split('/')[1]||'').replace(/[^a-z0-9].*$/i,''); if(ext) base+='.'+ext; }
      let name=o.tag+'_'+base, k=1; while(used.has(name.toLowerCase())) name=o.tag+'_'+(++k)+'_'+base; used.add(name.toLowerCase()); o.name=name;
      const ty=a.type||'';
      try { const blob=await mcFetchBlob(a.data), t2=ty||blob.type||''; o.size=blob.size; o.isImg=t2.startsWith('image/'); o.isVid=t2.startsWith('video/'); o.isAud=t2.startsWith('audio/');
        filesDir.file(name, blob, {compression:'STORE'}); if(o.isImg) o.thumb=await mcThumb(blob); }
      catch(e){ o.err=true; o.isImg=ty.startsWith('image/'); o.isVid=ty.startsWith('video/'); o.isAud=ty.startsWith('audio/'); }
      got++; lkToast('⏳ Собираю документ: файл '+got+' из '+allAtts.length); } };
    await Promise.all([worker(),worker(),worker()]);
    // 4. документ
    const GOLD='B8892B', TW=9906, rels=[], media=[]; let docPrId=1, mediaN=0;
    const relId=()=>'rId'+(rels.length+10);
    const extRel=name=>{ const id=relId(); rels.push('<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="'+_XE('files/'+encodeURIComponent(name))+'" TargetMode="External"/>'); return id; };
    const addMedia=(buf,ext)=>{ const fn='img'+(++mediaN)+'.'+ext; media.push({name:fn,buf}); const id=relId(); rels.push('<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+fn+'"/>'); return id; };
    const drawing=(rid,cx,cy,nm)=>{ const did=docPrId++, n2=_XE(nm);
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+did+'" name="'+n2+'" descr="'+n2+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+did+'" name="'+n2+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'; };
    const imgXml=o=>{ let cx=1980000, cy=Math.round(cx*o.thumb.h/o.thumb.w); if(cy>2520000){ cy=2520000; cx=Math.round(cy*o.thumb.w/o.thumb.h); }
      return '<w:hyperlink r:id="'+extRel(o.name)+'" w:history="1">'+drawing(addMedia(o.thumb.buf,'jpg'),cx,cy,o.name)+'</w:hyperlink>'+mcDocRun(' ',{size:8}); };
    const sizeTxt=b=>b==null?'':(b>1048576?(b/1048576).toFixed(1)+' МБ':Math.max(1,Math.round(b/1024))+' КБ');
    const icon=o=>o.isImg?'📷 ':o.isVid?'🎥 ':o.isAud?'🎙 ':'📎 ';
    const attXml=list=>{ if(!list.length) return ''; let x='';
      const imgs=list.filter(o=>o.thumb);
      for(let i=0;i<imgs.length;i+=3) x+=mcDocPara(imgs.slice(i,i+3).map(imgXml).join(''),{keep:true,after:60});
      if(P.names==='show'){ list.forEach(o=>{
          if(o.err){ x+=mcDocPara(mcDocRun(icon(o),{size:19})+mcDocRun((o.a.name||'файл')+' — файл недоступен',{size:19,color:'C0392B'}),{after:30}); return; }
          x+=mcDocPara(mcDocRun(icon(o),{size:19})+'<w:hyperlink r:id="'+extRel(o.name)+'" w:history="1">'+mcDocRun(o.name,{size:19,color:'1F5FA8',u:true})+'</w:hyperlink>'+mcDocRun('  ('+sizeTxt(o.size)+')',{size:17,color:'8A8A8A'}),{after:30}); });
      } else { const cnt={v:0,a:0,f:0,p:0}; let line='';
        list.forEach(o=>{ if(o.thumb&&!o.err) return;
          if(o.err){ line+=mcDocRun('⚠ '+(o.a.name||'файл')+' — недоступен   ',{size:18,color:'C0392B'}); return; }
          const lbl=o.isVid?'Видео '+(++cnt.v):o.isAud?'Голосовое '+(++cnt.a):o.isImg?'Фото '+(++cnt.p):'Файл '+(++cnt.f);
          line+=mcDocRun(icon(o),{size:18})+'<w:hyperlink r:id="'+extRel(o.name)+'" w:history="1">'+mcDocRun(lbl,{size:18,color:'1F5FA8',u:true})+'</w:hyperlink>'+mcDocRun('    ',{size:18}); });
        if(line) x+=mcDocPara(line,{after:30}); }
      return x; };
    const checkbox=on=>'<w:sdt><w:sdtPr><w:alias w:val="Выполнено"/><w14:checkbox><w14:checked w14:val="'+(on?1:0)+'"/><w14:checkedState w14:val="2611" w14:font="Segoe UI Symbol"/><w14:uncheckedState w14:val="2610" w14:font="Segoe UI Symbol"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:eastAsia="Segoe UI Symbol" w:cs="Segoe UI Symbol"/><w:sz w:val="24"/></w:rPr><w:t>'+(on?'☑':'☐')+'</w:t></w:r></w:sdtContent></w:sdt>'+mcDocRun(' ',{size:22});
    const cell=(inner,w,o)=>{ o=o||{}; return '<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(o.borders||'')+(o.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+o.fill+'"/>':'')+'<w:vAlign w:val="'+(o.v||'center')+'"/></w:tcPr>'+inner+'</w:tc>'; };
    const rich=(html,size)=>{ const parts=mcRichToParts(html||''), rtl=_isRTL(parts.map(x=>x.t||'').join('')); return {rtl, xml:parts.map(x=>x.br?'<w:r><w:br/></w:r>':mcDocRun(x.t,{...x,rtl,size})).join('')}; };
    let body='';
    // шапка (как у выгрузки карточки)
    if(P.logo||P.studio||P.slogan||P.site){
      let lw=0, logoXml='';
      if(P.logo){ try { const bmp=await createImageBitmap(await mcFetchBlob(P.logo)); const cy=720000, cx=Math.round(cy*bmp.width/bmp.height);
          const bin=await (await fetch(P.logo)).arrayBuffer(); logoXml=mcDocPara(drawing(addMedia(bin,'png'),Math.min(cx,2160000),cy,'logo'),{after:0});
          lw=Math.min(cx,2160000)/635+200; if(bmp.close) bmp.close(); } catch(e){} }
      lw=Math.round(lw); const rw=P.site?2900:0, mw=TW-lw-rw;
      const bb='<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="DDDDDD"/></w:tcBorders>';
      const mid=(P.studio?mcDocPara(mcDocRun(P.studio.toUpperCase(),{b:true,size:24}),{after:0,bidi:_isRTL(P.studio)}):'')+(P.slogan?mcDocPara(mcDocRun(P.slogan,{size:17,color:'777777',rtl:_isRTL(P.slogan)}),{after:0,bidi:_isRTL(P.slogan)}):'')||mcDocPara('',{after:0});
      let cells=''; if(lw) cells+=cell(logoXml,lw,{borders:bb}); cells+=cell(mid,mw,{borders:bb});
      if(rw) cells+=cell(mcDocPara(mcDocRun(P.site,{size:17,color:'777777'}),{after:0,jc:'right'}),rw,{borders:bb});
      body+='<w:tbl><w:tblPr><w:tblW w:w="'+TW+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+(lw?'<w:gridCol w:w="'+lw+'"/>':'')+'<w:gridCol w:w="'+mw+'"/>'+(rw?'<w:gridCol w:w="'+rw+'"/>':'')+'</w:tblGrid><w:tr>'+cells+'</w:tr></w:tbl>';
    }
    body+=mcDocPara(mcDocRun(root.name,{b:true,size:40}),{before:240,after:120,bidi:_isRTL(root.name)});
    // таблица данных
    const sec=LK.sections.find(s=>s.id===root.section_id), dt=new Date(), p2=x=>String(x).padStart(2,'0');
    const pairs=[['Раздел',((sec&&sec.icon)?sec.icon+' ':'')+(sec?sec.name:'')],['Дата',p2(dt.getDate())+'.'+p2(dt.getMonth()+1)+'.'+dt.getFullYear()]];
    if(P.author) pairs.push(['Составил(а)',P.author]);
    pairs.push(['Готово',doneCnt+' из '+total+' карточек']);
    const bAll='<w:tcBorders>'+['top','left','bottom','right'].map(s=>'<w:'+s+' w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>').join('')+'</w:tcBorders>';
    let trs='';
    for(let i=0;i<pairs.length;i+=2){ const a=pairs[i], b2=pairs[i+1];
      const mk=pr=>cell(mcDocPara(mcDocRun(pr[0],{b:true,size:19}),{after:0}),1500,{borders:bAll,fill:'F6EFD9'})+cell(mcDocPara(mcDocRun(pr[1],{size:20,rtl:_isRTL(pr[1])}),{after:0,bidi:_isRTL(pr[1])}),3453,{borders:bAll});
      trs+='<w:tr>'+(b2?mk(a)+mk(b2):mk(a)+cell(mcDocPara('',{after:0}),4953,{borders:bAll}))+'</w:tr>'; }
    body+='<w:tbl><w:tblPr><w:tblW w:w="'+TW+'" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="3453"/><w:gridCol w:w="1500"/><w:gridCol w:w="3453"/></w:tblGrid>'+trs+'</w:tbl>';
    body+=mcDocPara('',{after:40});
    const fmtD=s=>{ s=String(s||'').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(0,4):s; };
    const divC=(P.divColor||'#B8892B').replace('#','');
    G.forEach(g=>{
      const gd=g.cs.filter(x=>x.c.status==='done').length, rtlG=_isRTL(g.name);
      // золотая плашка подтемы
      body+='<w:p><w:pPr><w:keepNext/><w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="'+GOLD+'"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F6EFD9"/>'+(rtlG?'<w:bidi/>':'')+'<w:spacing w:before="320" w:after="120"/></w:pPr>'+
        mcDocRun(g.num+'. '+g.name,{b:true,size:28,rtl:rtlG})+mcDocRun('   · '+gd+' из '+g.cs.length+' готово',{size:18,color:'8A6A1F'})+'</w:p>';
      g.cs.forEach((x,ci)=>{
        const c=x.c, rtl=_isRTL(c.title);
        if(ci && P.divider) body+=mcDocPara('',{before:80,after:80,line:120,divider:divC});
        const meta=[];
        if(O.cab) meta.push(lkSpName(c.space_id)+(c.category?' › '+c.category:''));
        if(c.status==='done') meta.push('готово'); else if(c.deadline) meta.push('срок '+fmtD(c.deadline));
        body+=mcDocPara(mcDocRun(x.num+'  ',{b:true,color:GOLD,size:24})+mcDocRun(c.status==='done'?'☑ ':'☐ ',{size:24})+mcDocRun(c.title||'Без названия',{b:true,size:24,rtl})+(meta.length?mcDocRun('   · '+meta.join(' · '),{size:17,color:'888888'}):''),{before:120,after:40,keep:true,bidi:rtl});
        if(c.body){ const r=rich(c.body,20); body+=mcDocPara(r.xml,{after:60,bidi:r.rtl}); }
        if(x.cardAtts.length) body+=attXml(x.cardAtts);
        x.E.forEach(y=>{ const e=y.e, r=rich(e.text||e.sessionNote||'',22);
          body+=mcDocPara((P.checks!==false?checkbox(!!e.done):mcDocRun(e.done?'☑ ':'☐ ',{size:22}))+r.xml+(e.date?mcDocRun('   '+e.date,{size:16,color:'999999'}):''),{after:30,keep:!!y.atts.length,bidi:r.rtl});
          if(y.atts.length) body+=attXml(y.atts);
        });
        if(O.links){ LK.links.filter(l=>l.a_id===c.id||l.b_id===c.id).forEach(l=>{
          const oid=l.a_id===c.id?l.b_id:l.a_id, o=full[oid]||lkCard(oid); if(!o) return;
          body+=mcDocPara(mcDocRun('🔗 связана с «'+(o.title||'')+'»'+(O.cab?' ('+lkSpName(o.space_id)+')':'')+(l.label?' — «'+l.label+'»':''),{size:18,color:GOLD})+(l.note?mcDocRun('  '+l.note,{size:17,color:'888888'}):''),{after:30});
        }); }
      });
    });
    if(O.signs){
      const top='<w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/></w:tcBorders>';
      const sg=tx=>cell(mcDocPara(mcDocRun(tx,{size:17,color:'666666'}),{after:0}),4400,{borders:top,v:'top'});
      body+=mcDocPara('',{before:700,after:0,keep:true});
      body+='<w:tbl><w:tblPr><w:tblW w:w="'+TW+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4400"/><w:gridCol w:w="1106"/><w:gridCol w:w="4400"/></w:tblGrid><w:tr>'+sg('Подпись исполнителя')+cell(mcDocPara('',{after:0}),1106)+sg('Подпись заказчика')+'</w:tr></w:tbl>';
    }
    const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"';
    const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+'<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const footTxt=[P.studio,P.site].filter(Boolean).join('  ·  '), FR='<w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr>';
    const footXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="DDDDDD"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="'+TW+'"/></w:tabs></w:pPr><w:r>'+FR+'<w:t xml:space="preserve">'+_XE(footTxt)+'</w:t></w:r><w:r>'+FR+'<w:tab/></w:r><w:r>'+FR+'<w:fldChar w:fldCharType="begin"/></w:r><w:r>'+FR+'<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>'+FR+'<w:fldChar w:fldCharType="separate"/></w:r><w:r>'+FR+'<w:t>1</w:t></w:r><w:r>'+FR+'<w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
    const stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:bidi="he-IL"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    const docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'+rels.join('')+'</Relationships>';
    const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>';
    const topRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const dz=new JSZip();
    dz.file('[Content_Types].xml',ct); dz.file('_rels/.rels',topRels); dz.file('word/document.xml',docXml); dz.file('word/styles.xml',stylesXml); dz.file('word/footer1.xml',footXml); dz.file('word/_rels/document.xml.rels',docRels);
    media.forEach(m=>dz.file('word/media/'+m.name,m.buf));
    rootDir.file(folder+'.docx', await dz.generateAsync({type:'uint8array',compression:'DEFLATE'}));
    if(!allAtts.length) zip.remove(folder+'/files');
    lkToast('⏳ Упаковываю архив…');
    const out=await zip.generateAsync({type:'blob',compression:'STORE'});
    window._lkLastWord={docXml, out}; // для проверки
    const url=URL.createObjectURL(out), a=document.createElement('a');
    a.href=url; a.download=folder+'.zip'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    const bad=allAtts.filter(o=>o.err).length;
    lkToast('✓ Готово: '+folder+'.zip'+(bad?' (не удалось скачать файлов: '+bad+')':''));
  } catch(e){ lkToast('Не удалось собрать документ: '+(e&&e.message||e), true); }
  finally { window._mcExporting=false; }
}
