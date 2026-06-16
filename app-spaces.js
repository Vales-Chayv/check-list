// ═══════════════════════════════════════════
//  SPACES — КАБИНЕТЫ
// ═══════════════════════════════════════════
let spaces = [], currentSpaceId = null, currentSpace = null;
let pendingSpaceId = null;
let presenceChannel = null;
// ─── INIT ───────────────────────────────────
async function initSpaces() {
  const urlToken = new URLSearchParams(window.location.search).get('space');
  if(!navigator.onLine) {
    const saved = JSON.parse(localStorage.getItem('mc_spaces')||'[]');
    spaces = Array.isArray(saved) ? saved : [{id:'personal',name:'Личный',type:'personal',members:[]}];
    showSpaceSelector();
    return;
  }
  if(currentUser) {
    const el = document.getElementById('lobby-user');
    if(el) el.textContent = 'Привет, ' + (currentUser.display_name||'') + ' 👋';
  }
  try {
    const joinedIds = JSON.parse(localStorage.getItem('mc_joined_spaces')||'[]');
    let query = sb.from('spaces').select('*').order('created_at');
    if(currentUser) {
      query = query.or(`owner_id.eq.${currentUser.id}${joinedIds.length?',id.in.('+joinedIds.join(',')+')'  :''}`);
    }
    const {data, error} = await query;
    if(error) throw error;
    spaces = data || [];
 } catch(e) {
    const saved = JSON.parse(localStorage.getItem('mc_spaces')||'[]');
spaces = Array.isArray(saved) ? saved : [];
    if(!spaces.length) spaces = [{id:'personal',name:'Личный',type:'personal',members:[]}];
    showSpaceSelector();
    return;
  }
  localStorage.setItem('mc_spaces', JSON.stringify(spaces));
  // Handle invite link
  if(urlToken) {
    try {
      const {data} = await sb.from('spaces').select('*').eq('share_token', urlToken).single();
      if(data) {
        const joined = JSON.parse(localStorage.getItem('mc_joined_spaces')||'[]');
        if(!joined.includes(data.id)) {
          joined.push(data.id);
          localStorage.setItem('mc_joined_spaces', JSON.stringify(joined));
        }
        if(!spaces.find(s=>s.id===data.id)) spaces.push(data);
        if(data.password) {
          pendingSpaceId = data.id;
          document.getElementById('space-pwd-name').textContent = data.name;
          document.getElementById('space-pwd-inp').value = '';
          document.getElementById('space-pwd-err').textContent = '';
          document.getElementById('space-pwd-ov').classList.add('on');
          setTimeout(()=>document.getElementById('space-pwd-inp').focus(), 300);
          return;
        } else {
          setCurrentSpace(data.id, true);
          return;
        }
      }
    } catch(e) {}
  }
  // Always show lobby — no auto-enter
  showSpaceSelector();
}
// ─── SELECTOR ───────────────────────────────
function showSpaceSelector() {
  renderSpacesList();
  const cb = document.getElementById('lobby-cal-btn');
  if(cb) { cb.style.display = currentUser ? 'block' : 'none'; cb.textContent = '📅 ' + t('Календарь'); }
  document.getElementById('space-selector').style.display = 'flex';
}
function hideSpaceSelector() {
  document.getElementById('space-selector').style.display = 'none';
}
function openCalendarFromLobby() {
  calFromLobby = true;
  hideSpaceSelector();
  openCalendar();
}
function renderSpacesList() {
  const list = document.getElementById('spaces-list');
  list.innerHTML = spaces.map(s => {
    const icon = s.type==='family' ? '👨‍👩‍👧' : '🗂️';
    const members = (s.members||[]).length;
    return `<div style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:18px 16px;display:flex;align-items:center;gap:14px;margin-bottom:10px">
      <div onclick="onSpaceClick('${s.id}')" style="display:flex;align-items:center;gap:14px;flex:1;cursor:pointer">
        <div style="font-size:32px">${icon}</div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:700">${esc(s.name)}</div>
          ${s.type==='family'&&members?`<div style="font-size:12px;color:var(--t3);margin-top:2px">👥 ${members} участников</div>`:''}
        </div>
        ${s.password?'<span style="font-size:16px;opacity:.5">🔒</span>':'<span style="font-size:12px;color:var(--t3)">Открыть</span>'}
      </div>
      ${s.type==='family'?`<button onclick="getShareLink('${s.id}')" style="background:rgba(232,197,106,.15);border:1px solid rgba(232,197,106,.3);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--accent);cursor:pointer" title="Пригласить">🔗</button><button onclick="openManageMembers('${s.id}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--t2);cursor:pointer" title="Участники">👥</button>`:''}
      <button onclick="openEditSpace('${s.id}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--t2);cursor:pointer" title="Редактировать">✏️</button>
    </div>`;
  }).join('');
}
function onSpaceClick(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  if(space.password) {
    pendingSpaceId = id;
    document.getElementById('space-pwd-name').textContent = space.name;
    document.getElementById('space-pwd-inp').value = '';
    document.getElementById('space-pwd-err').textContent = '';
    document.getElementById('space-pwd-ov').classList.add('on');
    setTimeout(()=>document.getElementById('space-pwd-inp').focus(), 300);
  } else {
    afterPasswordOrDirect(id);
  }
}
function enterSpacePwd() {
  const space = spaces.find(s=>s.id===pendingSpaceId); if(!space) return;
  const v = document.getElementById('space-pwd-inp').value;
  if(v === space.password) {
    document.getElementById('space-pwd-ov').classList.remove('on');
    afterPasswordOrDirect(pendingSpaceId);
  } else {
    document.getElementById('space-pwd-err').textContent = '❌ Неверный пароль';
    const inp = document.getElementById('space-pwd-inp');
    inp.value = ''; inp.classList.add('err');
    setTimeout(()=>inp.classList.remove('err'), 600);
  }
}
function setCurrentSpace(id, loadNew) {
  currentSpaceId = id;
  currentSpace = spaces.find(s=>s.id===id);
  localStorage.setItem('mc_current_space', id);
  hideSpaceSelector();
  document.getElementById('space-pwd-ov').classList.remove('on');
  document.getElementById('space-member-ov').classList.remove('on');
document.getElementById('current-space-name').textContent = currentSpace.name;
  const btn = document.getElementById('current-member-btn');
  const lbl = document.getElementById('current-member-label');
  if(btn && lbl) {
    const member = localStorage.getItem('mc_current_member');
    if(currentSpace.type === 'family' && member) {
      lbl.textContent = member + ' онлайн';
      btn.style.display = 'inline-flex';
    } else {
      btn.style.display = 'none';
    }
  }
  if(loadNew) { cards=[]; cats=[]; render(); loadData(); }
  if(currentSpace?.type === 'family') {
    subscribeRealtimeCards(id);
    subscribePresence(id);
  }
}
function switchSpace() {
  localStorage.removeItem('mc_current_space');
  localStorage.removeItem('mc_current_member');
  unsubscribeRealtimeCards();
  unsubscribePresence();
  currentSpaceId = null; currentSpace = null;
  cards = []; cats = [];
  render();
  renderSpacesList();
  showSpaceSelector();
}
// ─── CREATE SPACE ────────────────────────────
function openCreateSpace() {
  document.getElementById('new-space-name').value = '';
  document.getElementById('new-space-pwd').value = '';
  document.getElementById('new-space-type').value = 'personal';
  document.getElementById('members-section').style.display = 'none';
  renderNewMembersList();
  document.getElementById('create-space-ov').classList.add('on');
  setTimeout(()=>document.getElementById('new-space-name').focus(), 300);
}
function closeCreateSpace() { document.getElementById('create-space-ov').classList.remove('on'); }
let newSpaceMembers = [];
function renderNewMembersList() {
  const el = document.getElementById('new-members-list');
  newSpaceMembers = [];
  el.innerHTML = '';
}
function addNewMember() {
  const inp = document.getElementById('new-member-inp');
  const name = inp.value.trim(); if(!name) return;
const email = (document.getElementById('manage-member-email')?.value||'').trim().toLowerCase();
  if(newSpaceMembers.find(m=>m.name===name)) { inp.value=''; return; }
  newSpaceMembers.push({name});
  inp.value='';
  const el = document.getElementById('new-members-list');
  el.innerHTML = newSpaceMembers.map((m,i)=>`<div style="display:inline-flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--b1);border-radius:18px;padding:4px 10px;margin:3px;font-size:13px">${esc(m.name)}<button onclick="newSpaceMembers.splice(${i},1);renderNewMembersEdit()" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:11px;margin-left:2px">✕</button></div>`).join('');
}
function renderNewMembersEdit() {
  const el = document.getElementById('new-members-list');
  el.innerHTML = newSpaceMembers.map((m,i)=>`<div style="display:inline-flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--b1);border-radius:18px;padding:4px 10px;margin:3px;font-size:13px">${esc(m.name)}<button onclick="newSpaceMembers.splice(${i},1);renderNewMembersEdit()" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:11px;margin-left:2px">✕</button></div>`).join('');
}
async function createSpace() {
  const name = document.getElementById('new-space-name').value.trim(); if(!name) return;
  const type = document.getElementById('new-space-type').value;
  const pwd  = document.getElementById('new-space-pwd').value.trim() || null;
  const id   = 'sp_' + uid();
  const share_token = uid().slice(0,12);
  const owner_id = currentUser?.id || null;
  const space = {id, name, type, password:pwd, members:newSpaceMembers, share_token, owner_id};
  try {
    const {error} = await sb.from('spaces').insert(space);
    if(error) throw error;
    // Стартовые рубрики нового кабинета — записываем в базу как реальные
    const defaultCats = type === 'family'
      ? [{name:'Еда',color:'#5bb87a'},{name:'Уборка',color:'#5b9ee8'},{name:'Дети',color:'#a07de8'},{name:'Покупки',color:'#e8c56a'},{name:'Финансы',color:'#e88a3a'},{name:'Ремонт',color:'#e86060'}]
      : [{name:'Работа',color:'#e8c56a'},{name:'Личное',color:'#5b9ee8'},{name:'Проекты',color:'#5bb87a'}];
    await sb.from('categories').insert(defaultCats.map(c => ({...c, space_id: id})));
    spaces.push(space);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    closeCreateSpace();
    renderSpacesList();
    toast('✓ Кабинет «'+name+'» создан');
    if(type === 'family') showShareLink(space);
  } catch(e) { toast('Ошибка: '+e.message, true); }
}
function showShareLink(space) {
  const link = `${location.origin}${location.pathname}?space=${space.share_token}`;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:20px';
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:24px;max-width:380px;width:100%">
    <div style="font-size:18px;font-weight:700;margin-bottom:10px">🔗 Пригласить в «${esc(space.name)}»</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Отправь ссылку — человек сразу попадёт в этот кабинет</div>
    <div style="background:var(--s2);border-radius:var(--rsm);padding:11px;font-size:12px;word-break:break-all;color:var(--accent);margin-bottom:10px">${link}</div>
    ${space.password?`<div style="font-size:13px;color:var(--t2);margin-bottom:12px">🔒 Пароль: <strong style="color:var(--t1)">${esc(space.password)}</strong></div>`:''}
    <div style="display:flex;gap:8px">
      <button onclick="navigator.clipboard.writeText('${link}').then(()=>toast('✓ Скопировано'))" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:11px;font-size:14px;font-weight:700;cursor:pointer">Скопировать</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px 16px;font-size:14px;cursor:pointer">Закрыть</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}
// ─── MEMBER SELECTOR ────────────────────────
function afterPasswordOrDirect(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  const members = space.members||[];
 if(space.type==='family' && members.length > 0) {
    const userEmail = currentUser?.email?.toLowerCase()||'';
    const matched = members.find(m => m.email && m.email.toLowerCase() === userEmail);
    if(matched) {
      localStorage.setItem('mc_current_member', matched.name);
      setCurrentSpace(id, true);
    } else {
      showMemberSelector(id);
    }
  } else {
    setCurrentSpace(id, true);
  }
}
function showMemberSelector(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  pendingSpaceId = id;
  document.getElementById('space-member-name').textContent = space.name;
  const list = document.getElementById('space-member-list');
  list.innerHTML = (space.members||[]).map(m =>
    `<button onclick="selectMember('${esc(m.name)}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:13px 16px;font-size:16px;font-weight:600;color:var(--t1);cursor:pointer;font-family:inherit;text-align:left">${esc(m.name)}</button>`
  ).join('');
  document.getElementById('space-member-ov').classList.add('on');
}
function selectMember(name) {
  localStorage.setItem('mc_current_member', name);
  setCurrentSpace(pendingSpaceId, true);
}
function switchMember() {
  if(!currentSpaceId) return;
  memberFilterOn = !memberFilterOn;
  const btn = document.getElementById('current-member-btn');
  if(btn) btn.style.background = memberFilterOn ? 'rgba(232,197,106,.4)' : 'rgba(232,197,106,.15)';
  render();
}
// ─── DELETE SPACE ────────────────────────────
async function deleteSpace(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  if(!confirm('Удалить кабинет «'+space.name+'»? Все карточки будут удалены.')) return;
  try {
    await sb.from('cards').delete().eq('space_id', id);
    await sb.from('spaces').delete().eq('id', id);
    spaces = spaces.filter(s=>s.id!==id);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
document.getElementById('edit-space-dialog')?.remove();
    document.getElementById('manage-members-ov')?.classList.remove('on');
    if(currentSpaceId===id) switchSpace();
    else renderSpacesList();
    toast('✓ Кабинет удалён');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}
// ─── MANAGE MEMBERS ─────────────────────────
let managingSpaceId = null;
function openManageMembers(id) {
  managingSpaceId = id;
  const space = spaces.find(s=>s.id===id); if(!space) return;
  document.getElementById('manage-members-title').textContent = space.name + ' — Участники';
  document.getElementById('manage-member-inp').value = '';
  renderManageMembersList();
  document.getElementById('manage-members-ov').classList.add('on');
}
function renderManageMembersList() {
  const space = spaces.find(s=>s.id===managingSpaceId); if(!space) return;
  const el = document.getElementById('manage-members-list');
  const members = space.members||[];
  if(!members.length) { el.innerHTML = '<div style="font-size:14px;color:var(--t3)">Нет участников</div>'; return; }
  el.innerHTML = members.map(m =>
    `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:11px 14px">
      <span style="font-size:15px">${esc(m.name)}</span>
      <button onclick="removeMemberFromSpace('${esc(m.name)}')" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:18px;padding:0 4px">✕</button>
    </div>`
  ).join('');
}
async function addMemberToSpace() {
  const inp = document.getElementById('manage-member-inp');
  const name = inp.value.trim(); if(!name) return;
  const space = spaces.find(s=>s.id===managingSpaceId); if(!space) return;
  if((space.members||[]).find(m=>m.name===name)) { toast('Участник уже есть', true); inp.value=''; return; }
const memberColors = ['#e8a83a','#5b9ee8','#a07de8','#5bb87a','#e85bb0','#5bc8e8','#e86060','#c8e85b'];
const usedColors = (space.members||[]).map(m=>m.color);
const freeColors = memberColors.filter(c=>!usedColors.includes(c));
const color = freeColors.length ? freeColors[0] : memberColors[Math.floor(Math.random()*memberColors.length)];
space.members = [...(space.members||[]), {name, email: email||null, color}];
inp.value = '';
document.getElementById('manage-member-email').value = '';
  renderManageMembersList();
  renderSpacesList();
  try {
    await sb.from('spaces').update({members: space.members}).eq('id', managingSpaceId);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    toast('✓ Участник добавлен');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}
async function removeMemberFromSpace(name) {
  if(!confirm('Удалить участника «'+name+'»?')) return;
  const space = spaces.find(s=>s.id===managingSpaceId); if(!space) return;
  space.members = (space.members||[]).filter(m=>m.name!==name);
  renderManageMembersList();
  renderSpacesList();
  try {
    await sb.from('spaces').update({members: space.members}).eq('id', managingSpaceId);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    toast('✓ Участник удалён');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}
// ─── SPACE MEMBERS ───────────────────────────
function getSpaceMembers() {
  return (currentSpace?.members||[]).map(m=>m.name);
}
async function getShareLink(spaceId) {
  let space = spaces.find(s=>s.id===spaceId); if(!space) return;
  if(!space.share_token) {
    space.share_token = uid().slice(0,12);
    await sb.from('spaces').update({share_token:space.share_token}).eq('id',spaceId);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
  }
  showShareLink(space);
}
// ─── PRESENCE ────────────────────────────────
function subscribePresence(spaceId) {
  unsubscribePresence();
  const myName = localStorage.getItem('mc_current_member') || '';
  presenceChannel = sb.channel('presence:' + spaceId)
    .on('presence', { event: 'sync' }, () => updatePresenceUI())
    .subscribe(async status => {
      if(status === 'SUBSCRIBED') await presenceChannel.track({ name: myName });
    });
}
function unsubscribePresence() {
  if(presenceChannel) { sb.removeChannel(presenceChannel); presenceChannel = null; }
}
function updatePresenceUI() {
  if(!presenceChannel) return;
  const myName = localStorage.getItem('mc_current_member') || '';
  const state = presenceChannel.presenceState();
  const allNames = Object.values(state).flatMap(arr => arr.map(p => p.name));
  const others = [...new Set(allNames)].filter(n => n !== myName);
  const lbl = document.getElementById('current-member-label');
  const countBtn = document.getElementById('presence-count-btn');
  if(lbl) lbl.textContent = '👤 ' + myName;
  if(countBtn) {
    if(others.length > 0) {
      countBtn.textContent = '+' + others.length;
      countBtn.style.display = 'block';
      countBtn._others = others;
    } else {
      countBtn.style.display = 'none';
    }
  }
}
function showOnlineList() {
  const btn = document.getElementById('presence-count-btn');
  const others = btn?._others || [];
  if(!others.length) return;
  const existing = document.getElementById('online-dropdown');
  if(existing) { existing.remove(); return; }
  const div = document.createElement('div');
  div.id = 'online-dropdown';
  div.style.cssText = 'position:fixed;top:52px;right:60px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:8px;z-index:1000;min-width:140px;box-shadow:0 4px 20px rgba(0,0,0,.4)';
  div.innerHTML = '<div style="font-size:12px;color:var(--t3);margin-bottom:6px">Сейчас онлайн:</div>' +
    others.map(n => `<div style="font-size:14px;padding:4px 0">🟢 ${esc(n)}</div>`).join('');
  document.body.appendChild(div);
  setTimeout(() => document.addEventListener('click', function handler() {
    div.remove(); document.removeEventListener('click', handler);
  }), 100);
}
function openEditSpace(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  const div = document.createElement('div');
  div.id = 'edit-space-dialog';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;width:100%;max-width:420px">
    <div style="font-size:16px;font-weight:700;margin-bottom:12px">Редактировать кабинет</div>
    <input id="edit-space-name-inp" value="${esc(space.name)}" dir="auto" style="width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px;font-size:15px;color:var(--t1);font-family:inherit;margin-bottom:12px">
    <div style="display:flex;gap:8px">
      <button onclick="saveSpaceName('${id}')" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:11px;font-size:14px;font-weight:700;cursor:pointer">Сохранить</button>
      <button onclick="document.getElementById('edit-space-dialog')?.remove()" style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px 16px;cursor:pointer">Отмена</button>
    </div>
    <button onclick="deleteSpace('${id}')" style="width:100%;margin-top:10px;background:rgba(232,96,96,.15);color:var(--red);border:1px solid rgba(232,96,96,.25);border-radius:var(--rsm);padding:11px;font-size:14px;cursor:pointer">🗑 Удалить кабинет</button>
  </div>`;
  document.body.appendChild(div);
  setTimeout(()=>document.getElementById('edit-space-name-inp')?.focus(), 100);
}

async function saveSpaceName(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  const name = document.getElementById('edit-space-name-inp')?.value?.trim();
  if(!name) return;
  space.name = name;
  document.getElementById('edit-space-dialog')?.remove();
  localStorage.setItem('mc_spaces', JSON.stringify(spaces));
  renderSpacesList();
  try {
    await sb.from('spaces').update({name}).eq('id', id);
    toast('✓ Название изменено');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}