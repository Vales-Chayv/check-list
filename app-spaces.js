// ═══════════════════════════════════════════
//  SPACES — КАБИНЕТЫ
// ═══════════════════════════════════════════
let spaces = [], currentSpaceId = null, currentSpace = null;
let pendingSpaceId = null;
// ─── INIT ───────────────────────────────────
async function initSpaces() {
  const urlToken = new URLSearchParams(window.location.search).get('space');
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
    spaces = JSON.parse(localStorage.getItem('mc_spaces')||'[]');
    if(!spaces.length) spaces = [{id:'personal',name:'Личный',type:'personal',members:[]}];
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
  document.getElementById('space-selector').style.display = 'flex';
}
function hideSpaceSelector() {
  document.getElementById('space-selector').style.display = 'none';
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
      ${s.type==='family'?`<button onclick="getShareLink('${s.id}')" style="background:rgba(232,197,106,.15);border:1px solid rgba(232,197,106,.3);border-radius:7px;padding:7px 10px;font-size:14px;color:var(--accent);cursor:pointer" title="Пригласить">🔗</button>`:''}
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
  if(loadNew) { cards=[]; cats=[]; render(); loadData(); }
}
function switchSpace() {
  localStorage.removeItem('mc_current_space');
  localStorage.removeItem('mc_current_member');
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
    showMemberSelector(id);
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
