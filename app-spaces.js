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
      const memberFilter = `members_auth.cs.[{"user_id":"${currentUser.id}"}]`;
      const inviteFilter = `pendingInvites.cs.[{"user_id":"${currentUser.id}"}]`;
      query = query.or(`owner_id.eq.${currentUser.id}${joinedIds.length?',id.in.('+joinedIds.join(',')+')'  :''},${memberFilter},${inviteFilter}`);
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
  if(typeof subscribeRealtimeSpaces === 'function') subscribeRealtimeSpaces();
   // Handle invite link — теперь тоже через приглашение с подтверждением, не тихое вступление
  if(urlToken) {
    try {
      const {data} = await sb.from('spaces').select('*').eq('share_token', urlToken).single();
      if(data) {
        if(!spaces.find(s=>s.id===data.id)) spaces.push(data);
        const isMember = (data.members_auth||[]).some(m=>m.user_id===currentUser?.id);
        const hasInvite = (data.pendingInvites||[]).some(p=>p.user_id===currentUser?.id);

        if(data.password && !isMember) {
          pendingSpaceId = data.id;
          document.getElementById('space-pwd-name').textContent = data.name;
          document.getElementById('space-pwd-inp').value = '';
          document.getElementById('space-pwd-err').textContent = '';
          document.getElementById('space-pwd-ov').classList.add('on');
          setTimeout(()=>document.getElementById('space-pwd-inp').focus(), 300);
          return;
        }
        if(isMember) { setCurrentSpace(data.id, true); return; }
        if(!hasInvite && currentUser) {
          let inviterName = 'Кто-то';
          try {
            const {data:ownerProf} = await sb.from('profiles').select('display_name').eq('id', data.owner_id).single();
            inviterName = ownerProf?.display_name || 'Кто-то';
          } catch(e) {}
          data.pendingInvites = [...(data.pendingInvites||[]), {user_id: currentUser.id, name: currentUser.display_name||'', invitedBy: inviterName, invitedAt: new Date().toISOString()}];
          try { await sb.from('spaces').update({pendingInvites: data.pendingInvites}).eq('id', data.id); } catch(e) {}
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
  document.body.classList.add('in-lobby');
}
function hideSpaceSelector() {
  document.getElementById('space-selector').style.display = 'none';
  document.body.classList.remove('in-lobby');
}
function hideSpaceSelector() {
  document.getElementById('space-selector').style.display = 'none';
}
function openCalendarFromLobby() {
  calFromLobby = true;
  hideSpaceSelector();
  openCalendar();
}
let showClosedSpaces = false;
function toggleClosedSpaces(){ showClosedSpaces = !showClosedSpaces; renderSpacesList(); }

function spaceRowHTML(s) {
  const icon = s.type==='family' ? '👨‍👩‍👧' : '🗂️';
  const members = (s.members||[]).length;
  const isOwner = s.owner_id===currentUser?.id;
  const isClosed = s.status==='closed';
  const myInvite = (s.pendingInvites||[]).find(p=>p.user_id===currentUser?.id);
  if(myInvite) {
    return `<div style="background:var(--s2);border:1px solid var(--accent);border-radius:var(--r);padding:18px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
        <div style="font-size:32px">👋</div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:700">${esc(s.name)}</div>
          <div style="font-size:13px;color:var(--t2);margin-top:2px">${esc(myInvite.invitedBy)} зовёт тебя в группу</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="acceptGroupInvite('${s.id}')" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:10px;font-size:14px;font-weight:700;cursor:pointer">✓ Принять</button>
        <button onclick="declineGroupInvite('${s.id}')" style="flex:1;background:var(--s1);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:10px;font-size:14px;cursor:pointer">✕ Отклонить</button>
      </div>
    </div>`;
  }
  return `<div style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:18px 16px;display:flex;align-items:center;gap:14px;margin-bottom:10px;opacity:${isClosed?.7:1}">
      <div onclick="onSpaceClick('${s.id}')" style="display:flex;align-items:center;gap:14px;flex:1;cursor:pointer">
        <div style="font-size:32px">${isClosed?'🔒':icon}</div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:700">${esc(s.name)}${isClosed?' <span style="font-size:11px;color:var(--t3);font-weight:400">(закрыта)</span>':''}</div>
          ${s.type==='family'&&members?`<div style="font-size:12px;color:var(--t3);margin-top:2px">👥 ${members} участников</div>`:''}
        </div>
        ${s.password?'<span style="font-size:16px;opacity:.5">🔒</span>':'<span style="font-size:12px;color:var(--t3)">Открыть</span>'}
      </div>
      ${(!isClosed && s.type==='family' && isOwner)?`<button onclick="getShareLink('${s.id}')" style="background:rgba(232,197,106,.15);border:1px solid rgba(232,197,106,.3);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--accent);cursor:pointer" title="Пригласить">🔗</button><button onclick="openManageMembers('${s.id}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--t2);cursor:pointer" title="Участники">👥</button>`:''}
      ${(!isClosed && s.type==='family' && isOwner)?`<button onclick="closeGroupSpace('${s.id}')" style="background:rgba(232,96,96,.12);border:1px solid rgba(232,96,96,.3);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--red);cursor:pointer" title="Закрыть группу">🔒</button>`:''}
      ${!isClosed?`<button onclick="openEditSpace('${s.id}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--t2);cursor:pointer" title="Редактировать">✏️</button>`:''}
    </div>`;
}

function renderSpacesList() {
  document.getElementById('space-selector')?.classList.toggle('has-space', !!(spaces && spaces.length));
  const ownsGroup = (spaces||[]).some(s => (s.type==='family'||s.type==='group') && s.owner_id === currentUser?.id);
  document.body.classList.toggle('owns-group', ownsGroup);
  if(ownsGroup && typeof renderLobbyPanelB === 'function') renderLobbyPanelB();
  const list = document.getElementById('spaces-list');
  const active = spaces.filter(s=>s.status!=='closed');
  const closed = spaces.filter(s=>s.status==='closed');
  list.innerHTML = active.map(spaceRowHTML).join('')
    + (closed.length ? `<div onclick="toggleClosedSpaces()" style="text-align:center;font-size:13px;color:var(--t3);cursor:pointer;padding:10px 0">🔒 Закрытые группы (${closed.length}) ${showClosedSpaces?'▲':'▼'}</div>` : '')
    + (showClosedSpaces ? closed.map(spaceRowHTML).join('') : '');
}
async function closeGroupSpace(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  if(!confirm('Закрыть группу «' + space.name + '»? Все её чаты станут доступны только для просмотра.')) return;
  space.status = 'closed';
  try { await sb.from('spaces').update({status:'closed'}).eq('id', id); } catch(e) {}
  localStorage.setItem('mc_spaces', JSON.stringify(spaces));
  renderSpacesList();
  const closedTitle = '🔒 Группа закрыта';
  const closedBody = `«${space.name}» закрыта и перемещена в архив`;
  if(typeof showChatNotice === 'function') showChatNotice(closedTitle, closedBody, null);
  const authIds = (space.members_auth||[]).map(m=>m.user_id).filter(Boolean);
  if(authIds.length && typeof notifyUsers === 'function') await notifyUsers(authIds, closedTitle, closedBody);
  toast('✓ Группа закрыта');
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
  if(loadNew) { loadData(); }
  if(currentSpace?.type === 'family') {
    subscribeRealtimeCards(id);
    subscribePresence(id);
  }
}
function switchSpace() {
  localStorage.removeItem('mc_current_space');
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
async function ensureUserHasPhone() {
  try {
    const { data } = await sb.from('profiles').select('phone').eq('id', currentUser?.id).single();
    if(data?.phone) return true;
  } catch(e) {}
  const phone = prompt('Для группового кабинета нужен номер телефона (для общения в группе):');
  if(!phone || !phone.trim()) { toast('Номер телефона обязателен для групповых кабинетов', true); return false; }
  try {
    await sb.from('profiles').update({phone: phone.trim()}).eq('id', currentUser.id);
    return true;
  } catch(e) { toast('Ошибка сохранения телефона: '+e.message, true); return false; }
}

async function createSpace() {
  const name = document.getElementById('new-space-name').value.trim(); if(!name) return;
  const type = document.getElementById('new-space-type').value;
  if(type === 'family') { if(!(await ensureUserHasPhone())) return; }
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
async function afterPasswordOrDirect(id) {
  const space = spaces.find(s=>s.id===id); if(!space) return;
  if(space.type==='family') { if(!(await ensureUserHasPhone())) return; }
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
async function pickFromContacts() {
  if(!('contacts' in navigator) || !('ContactsManager' in window)) return;
  try {
    const contacts = await navigator.contacts.select(['name','tel'], {multiple:false});
    if(!contacts.length) return;
    const c = contacts[0];
    const phone = (c.tel && c.tel[0]) ? c.tel[0].replace(/[^\d+]/g,'') : '';
    if(!phone) { toast('У выбранного контакта нет номера телефона', true); return; }
    document.getElementById('manage-member-inp').value = phone;
    addMemberToSpace();
  } catch(e) { /* пользователь отменил выбор контакта */ }
}

function openManageMembers(id) {
  const btn = document.getElementById('contacts-pick-btn');
  if(btn) btn.style.display = ('contacts' in navigator && 'ContactsManager' in window) ? 'block' : 'none';
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
async function searchUserByLoginOrPhone(query) {
  const q = query.trim(); if(!q) return null;
  try {
    const { data } = await sb.from('profiles').select('id,display_name,login,phone,email').or(`login.eq.${q},phone.eq.${q}`).maybeSingle();
    return data;
  } catch(e) { return null; }
}

function offerInvite(query, space) {
  const link = `${location.origin}${location.pathname}?space=${space.share_token}`;
  const text = encodeURIComponent(`Присоединяйся к группе «${space.name}» в Моих карточках: ${link}`);
  const isPhone = /^\+?\d[\d\s\-()]{6,}$/.test(query);
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:20px';
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:24px;max-width:380px;width:100%">
    <div style="font-size:17px;font-weight:700;margin-bottom:10px">Пользователь не найден</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:14px">«${esc(query)}» ещё не зарегистрирован(а) в приложении. Отправь приглашение:</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${isPhone ? `<a href="https://wa.me/${query.replace(/\D/g,'')}?text=${text}" target="_blank" style="text-decoration:none;background:#25D366;color:#fff;border-radius:var(--rsm);padding:12px;font-size:14px;font-weight:700;text-align:center">📱 Отправить в WhatsApp</a>` : ''}
      <a href="mailto:?subject=Приглашение в группу&body=${text}" style="text-decoration:none;background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:var(--rsm);padding:12px;font-size:14px;text-align:center">✉️ Отправить по почте</a>
      <button onclick="navigator.clipboard.writeText(decodeURIComponent('${text}')).then(()=>toast('✓ Скопировано'))" style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:12px;font-size:14px;cursor:pointer">📋 Скопировать текст</button>
    </div>
    <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;margin-top:10px;background:none;border:none;color:var(--t3);font-size:13px;cursor:pointer;padding:8px">Закрыть</button>
  </div>`;
  document.body.appendChild(div);
}

async function addMemberToSpace() {
  const inp = document.getElementById('manage-member-inp'); // логин или телефон
  const query = inp.value.trim(); if(!query) return;
  const space = spaces.find(s=>s.id===managingSpaceId); if(!space) return;

  const found = await searchUserByLoginOrPhone(query);
  const alreadyMember = (space.members||[]).find(m=>found ? m.user_id===found.id : m.name===query);
  const alreadyPending = (space.pendingInvites||[]).find(p=>found && p.user_id===found.id);
  if(alreadyMember) { toast('Участник уже есть', true); inp.value=''; return; }
  if(alreadyPending) { toast('Приглашение уже отправлено', true); inp.value=''; return; }

  inp.value = '';

  if(!found) { offerInvite(query, space); return; }

  const invitedBy = localStorage.getItem('mc_current_member') || currentUser?.display_name || 'Кто-то';
  space.pendingInvites = [...(space.pendingInvites||[]), {user_id: found.id, name: found.display_name, invitedBy, invitedAt: new Date().toISOString()}];
  try {
    await sb.from('spaces').update({pendingInvites: space.pendingInvites}).eq('id', managingSpaceId);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    const title = '👋 Приглашение в группу';
    const body = `${invitedBy} зовёт тебя в «${space.name}»`;
    if(typeof notifyUsers === 'function') await notifyUsers([found.id], title, body);
    toast('✓ Приглашение отправлено ' + found.display_name);
  } catch(e) { toast('Ошибка: '+e.message, true); }
}

async function acceptGroupInvite(spaceId) {
  const space = spaces.find(s=>s.id===spaceId); if(!space) return;
  const invite = (space.pendingInvites||[]).find(p=>p.user_id===currentUser?.id); if(!invite) return;
  const memberColors = ['#e8a83a','#5b9ee8','#a07de8','#5bb87a','#e85bb0','#5bc8e8','#e86060','#c8e85b'];
  const usedColors = (space.members||[]).map(m=>m.color);
  const freeColors = memberColors.filter(c=>!usedColors.includes(c));
  const color = freeColors.length ? freeColors[0] : memberColors[Math.floor(Math.random()*memberColors.length)];
  space.members = [...(space.members||[]), {name: invite.name, color, user_id: currentUser.id}];
  space.members_auth = [...(space.members_auth||[]), {user_id: currentUser.id, name: invite.name}];
  space.pendingInvites = (space.pendingInvites||[]).filter(p=>p.user_id!==currentUser.id);
  try {
    await sb.from('spaces').update({members: space.members, members_auth: space.members_auth, pendingInvites: space.pendingInvites}).eq('id', spaceId);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    renderSpacesList();
    toast('✓ Ты в группе «' + space.name + '»');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}

async function declineGroupInvite(spaceId) {
  const space = spaces.find(s=>s.id===spaceId); if(!space) return;
  space.pendingInvites = (space.pendingInvites||[]).filter(p=>p.user_id!==currentUser?.id);
  try {
    await sb.from('spaces').update({pendingInvites: space.pendingInvites}).eq('id', spaceId);
    spaces = spaces.filter(s=>s.id!==spaceId || (s.owner_id===currentUser?.id));
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    renderSpacesList();
    toast('Приглашение отклонено');
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
function updateMyPresenceCard(cardId, cardTitle) {
  if(!presenceChannel) return;
  const myName = localStorage.getItem('mc_current_member') || '';
  presenceChannel.track(cardId ? { name: myName, cardId, cardTitle } : { name: myName });
}

// ── Presence «подглядыванием» для дашборда владельца (не заходя в кабинет) ──
let ownerPresenceChannel = null, ownerPresenceSpaceId = null;
function subscribeOwnerPresence(spaceId) {
  if(ownerPresenceSpaceId === spaceId && ownerPresenceChannel) return;
  if(ownerPresenceChannel) { sb.removeChannel(ownerPresenceChannel); ownerPresenceChannel = null; }
  ownerPresenceSpaceId = spaceId;
  ownerPresenceChannel = sb.channel('presence:' + spaceId)
    .on('presence', { event: 'sync' }, () => renderOwnerPresence())
    .subscribe();
}
function renderOwnerPresence() {
  const box = document.getElementById('lobby-presence-list');
  if(!box || !ownerPresenceChannel) return;
  const state = ownerPresenceChannel.presenceState();
  const people = Object.values(state).flatMap(arr=>arr);
  box.innerHTML = people.length
    ? people.map(p => `<div style="font-size:13px;padding:4px 0">🟢 ${esc(p.name)}${p.cardTitle?` · <span style="color:var(--t3)">${esc(p.cardTitle)}</span>`:''}</div>`).join('')
    : '<div style="color:var(--t3);font-size:12px">Никого нет онлайн</div>';
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