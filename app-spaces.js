// ═══════════════════════════════════════════
//  SPACES — КАБИНЕТЫ
// ═══════════════════════════════════════════
let spaces = [], currentSpaceId = null, currentSpace = null;
let pendingSpaceId = null;

// ─── INIT ───────────────────────────────────
async function initSpaces() {
  try {
    const {data, error} = await sb.from('spaces').select('*').order('created_at');
    if(error) throw error;
    spaces = data || [];
    // Migrate existing personal password to personal space
    const personalPwd = localStorage.getItem('mc_pwd');
    const personal = spaces.find(s=>s.id==='personal');
    if(personal && !personal.password && personalPwd) {
      personal.password = personalPwd;
      await sb.from('spaces').update({password:personalPwd}).eq('id','personal');
    }
  } catch(e) {
    spaces = JSON.parse(localStorage.getItem('mc_spaces')||'[]');
    if(!spaces.length) spaces = [{id:'personal',name:'Личный',type:'personal',password:localStorage.getItem('mc_pwd'),members:[]}];
  }
  localStorage.setItem('mc_spaces', JSON.stringify(spaces));

  // Restore last used space
  const saved = localStorage.getItem('mc_current_space');
  if(saved && spaces.find(s=>s.id===saved)) {
    setCurrentSpace(saved, false);
  } else {
    showSpaceSelector();
  }
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
    return `<div onclick="onSpaceClick('${s.id}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:18px 16px;cursor:pointer;display:flex;align-items:center;gap:14px;margin-bottom:10px">
      <div style="font-size:32px">${icon}</div>
      <div style="flex:1">
        <div style="font-size:17px;font-weight:700">${esc(s.name)}</div>
        ${s.type==='family'&&members?`<div style="font-size:12px;color:var(--t3);margin-top:2px">👥 ${members} участников</div>`:''}
      </div>
      ${s.password?'<span style="font-size:16px;opacity:.5">🔒</span>':'<span style="font-size:12px;color:var(--t3)">Открыть</span>'}
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
    setCurrentSpace(id, true);
  }
}

function enterSpacePwd() {
  const space = spaces.find(s=>s.id===pendingSpaceId); if(!space) return;
  const v = document.getElementById('space-pwd-inp').value;
  if(v === space.password) {
    document.getElementById('space-pwd-ov').classList.remove('on');
    setCurrentSpace(pendingSpaceId, true);
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
  // Update header
  document.getElementById('current-space-name').textContent = currentSpace.name;
  if(loadNew) { cards=[]; cats=[]; render(); loadData(); }
}

function switchSpace() {
  localStorage.removeItem('mc_current_space');
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
  const pwd = document.getElementById('new-space-pwd').value.trim() || null;
  const id = 'sp_' + uid();
  const space = {id, name, type, password:pwd, members:newSpaceMembers};
  try {
    const {error} = await sb.from('spaces').insert(space);
    if(error) throw error;
    spaces.push(space);
    localStorage.setItem('mc_spaces', JSON.stringify(spaces));
    closeCreateSpace();
    renderSpacesList();
    toast('✓ Кабинет «'+name+'» создан');
  } catch(e) { toast('Ошибка: '+e.message, true); }
}

// ─── SPACE MEMBERS ───────────────────────────
function getSpaceMembers() {
  return (currentSpace?.members||[]).map(m=>m.name);
}
