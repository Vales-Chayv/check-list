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
function lkIsPersonal(card){ return !!card && !Array.isArray(card.chatParticipants) && lkPersonalIds().includes(card.space_id); }
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
  m.style.cssText=`position:fixed;z-index:2000;top:${Math.min(r.bottom+4, innerHeight-140)}px;left:${Math.max(8, Math.min(r.right-190, innerWidth-200))}px;width:190px;background:var(--s2);border:1px solid var(--b2);border-radius:var(--rsm);box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden`;
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
        <div style="font-size:11px;color:var(--t3)">${nsub?nsub+' подт.':''}</div></div></div>`;
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
    ${itemId?`<button class="lk-mini" title="Убрать из темы" onclick="event.stopPropagation();lkRemoveItem('${itemId}')">✕</button>`:''}
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
  if(LK.mode==='map'){ h+=lkMapSVG(t, groups, pass); document.getElementById('lk-body').innerHTML=h; return; }
  groups.forEach(g=>{
    const its=LK.items.filter(i=>i.topic_id===g.t.id);
    const rows=its.map(i=>({i, c:lkCard(i.card_id)}));
    const live=rows.filter(r=>r.c&&lkIsPersonal(r.c));
    if(g.direct && !rows.length) return;
    const done=live.filter(r=>r.c.status==='done').length, pc=live.length?Math.round(done/live.length*100):0;
    h+=`<div style="margin-top:14px"><div style="display:flex;align-items:center;gap:6px">
      <span dir="auto" style="font-size:14px;font-weight:700;color:${g.direct?'var(--t2)':'var(--accent)'};flex:1">${lkE(g.name)}</span>
      <span style="font-size:12px;color:var(--t3)">${done} из ${live.length}</span>
      ${g.direct?'':`<button class="lk-mini" onclick="lkSubMenu(this,'${g.t.id}')">⋯</button>`}</div>
      ${g.direct?'':`<div class="lk-bar" style="margin:6px 0 8px"><div style="width:${pc}%"></div></div>`}
      ${live.filter(r=>pass(r.c)).map(r=>lkCardRowHTML(r.c, r.i.id)).join('')}
      ${rows.filter(r=>!r.c && !LK.offline).map(r=>`<div class="lk-row" style="opacity:.5;cursor:default"><span style="flex:1;font-size:13px">🗑 Карточка удалена</span><button class="lk-mini" onclick="lkRemoveItem('${r.i.id}')">✕</button></div>`).join('')}
      ${!live.length&&!g.direct?'<div style="font-size:12px;color:var(--t3);padding:4px 2px 2px">Пусто: добавьте карточки</div>':''}
    </div>`;
  });
  h+=`<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
    <button class="lk-btn" onclick="lkNewTopic('${t.section_id}','${t.id}')">＋ Подтема</button>
    <button class="lk-btn gold" onclick="lkAddCards('${t.id}')">＋ Карточки</button></div>`;
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
  const pids=lkPersonalIds(); if(!pids.length) return [];
  let res=[];
  try {
    if(!navigator.onLine) throw 0;
    let qq=sb.from('cards').select('id,title,status,space_id,category,deadline,chatParticipants').in('space_id',pids).order('created_at',{ascending:false}).limit(25);
    if(q) qq=qq.ilike('title','%'+q.replace(/[%_]/g,'')+'%');
    const {data,error}=await qq; if(error) throw error; res=data||[];
  } catch(_){
    try { const ql=q.toLowerCase(); res=(await local.getAll('cards')).filter(c=>pids.includes(c.space_id)&&(!q||String(c.title||'').toLowerCase().includes(ql))).slice(0,25); } catch(__){ res=[]; }
  }
  return res.filter(c=>!Array.isArray(c.chatParticipants) && !(exclude||[]).includes(c.id)).slice(0,15);
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
function lkAddCards(topicId){
  const t=lkTopic(topicId); if(!t) return;
  if(lkNeedNet()) return;
  const subs=lkSubs(topicId);
  let target=subs[0]?.id||topicId, timer=null;
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
      <span style="color:var(--accent);font-size:20px">＋</span></div>`).join(''):'<div style="font-size:13px;color:var(--t3);padding:8px 2px">Ничего не найдено</div>';
    box.querySelectorAll('[data-id]').forEach(row=>row.onclick=async()=>{
      const c=list.find(x=>x.id===row.dataset.id); if(!c) return;
      if(await lkAddItem(target, c)){ row.remove(); lkToast('✓ Добавлено'); lkRender(); }
    });
  };
  paintSubs();
  d.querySelector('#lka-q').oninput=()=>{ clearTimeout(timer); timer=setTimeout(run,250); };
  run();
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
          ${P.pick===c.id?'<span style="color:var(--accent)">✓</span>':''}</div>`).join(''):'<div style="font-size:13px;color:var(--t3);padding:8px 2px">Ничего не найдено</div>';
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
