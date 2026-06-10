// ═══════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════
let calView = 'month'; // 'month' | 'week' | 'day'
let calDate = new Date();
let calFilterCat = 'all';
let calFilterMember = 'all';
let calFilterPriority = 'all';
let calSpaceId = 'current';
let calAllCards = [];

const CAL_DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const CAL_MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// ─── OPEN / CLOSE ────────────────────────────
async function openCalendar() {
  calDate = new Date();
  calSpaceId = 'current';
  calAllCards = [];
  document.getElementById('cal-ov').classList.add('on');
  document.getElementById('cal-body').innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">⏳ Загрузка...</div>';
  try {
    const ids = spaces.map(s=>s.id);
    const {data} = await sb.from('cards').select('*').in('space_id', ids).not('deadline','is',null);
    calAllCards = data||[];
  } catch(e) { calAllCards = [...cards]; }
  renderCalFilters();
  renderCalendar();
}

function closeCalendar() {
  document.getElementById('cal-ov').classList.remove('on');
  document.getElementById('cal-popup').style.display = 'none';
}

// ─── VIEW SWITCHER ───────────────────────────
function setCalView(v) {
  calView = v;
  document.querySelectorAll('.cal-view-btn').forEach(b => {
    const on = b.dataset.calview === v;
    b.style.background = on ? 'var(--s2)' : 'transparent';
    b.style.color = on ? 'var(--t1)' : 'var(--t2)';
    b.classList.toggle('on', on);
  });
  renderCalendar();
}

function calPrev() {
  if(calView === 'month') calDate.setMonth(calDate.getMonth() - 1);
  else if(calView === 'week') calDate.setDate(calDate.getDate() - 7);
  else calDate.setDate(calDate.getDate() - 1);
  calDate = new Date(calDate);
  renderCalendar();
}

function calNext() {
  if(calView === 'month') calDate.setMonth(calDate.getMonth() + 1);
  else if(calView === 'week') calDate.setDate(calDate.getDate() + 7);
  else calDate.setDate(calDate.getDate() + 1);
  calDate = new Date(calDate);
  renderCalendar();
}

function calToday() {
  calDate = new Date();
  renderCalendar();
}

// ─── FILTERS ─────────────────────────────────
function renderCalFilters() {
  const el = document.getElementById('cal-filters');
  const members = currentSpace?.type === 'family' ? (currentSpace?.members||[]).map(m=>m.name) : [];

  let html = `<button onclick="calSetSpace('current',this)" class="cal-filter-space on" style="background:var(--s2);border:1px solid var(--accent);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--accent);cursor:pointer;white-space:nowrap;flex-shrink:0">📂 Текущий</button>`;
  html += `<button onclick="calSetSpace('all',this)" class="cal-filter-space" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--t2);cursor:pointer;white-space:nowrap;flex-shrink:0">🗂️ Все</button>`;
  spaces.forEach(s => {
    if(s.id !== currentSpaceId) html += `<button onclick="calSetSpace('${s.id}',this)" class="cal-filter-space" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--t2);cursor:pointer;white-space:nowrap;flex-shrink:0">${s.type==='family'?'👨‍👩‍👧':'🗂️'} ${esc(s.name)}</button>`;
  });
  html += `<div style="width:1px;background:var(--b1);flex-shrink:0;margin:2px 4px"></div>`;
  html += `<button onclick="calSetFilter('cat','all',this)" class="cal-filter-btn on" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--t1);cursor:pointer;white-space:nowrap;flex-shrink:0">Все рубрики</button>`;
  cats.forEach(c => {
    html += `<button onclick="calSetFilter('cat','${esc(c.name)}',this)" class="cal-filter-btn" style="background:${hex2rgba(c.color||'#888',.15)};border:1px solid ${hex2rgba(c.color||'#888',.4)};border-radius:14px;padding:4px 10px;font-size:12px;color:${c.color||'#888'};cursor:pointer;white-space:nowrap;flex-shrink:0"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${c.color||'#888'};margin-right:4px"></span>${esc(c.name)}</button>`;
  });

  if(members.length) {
    html += `<div style="width:1px;background:var(--b1);flex-shrink:0;margin:2px 4px"></div>`;
    html += `<button onclick="calSetFilter('member','all',this)" class="cal-filter-member on" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--t1);cursor:pointer;white-space:nowrap;flex-shrink:0">Все участники</button>`;
    members.forEach(m => {
      html += `<button onclick="calSetFilter('member','${esc(m)}',this)" class="cal-filter-member" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--t2);cursor:pointer;white-space:nowrap;flex-shrink:0">👤 ${esc(m)}</button>`;
    });
  }

  html += `<div style="width:1px;background:var(--b1);flex-shrink:0;margin:2px 4px"></div>`;
  html += `<button onclick="calSetFilter('priority','all',this)" class="cal-filter-priority on" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--t1);cursor:pointer;white-space:nowrap;flex-shrink:0">Все приоритеты</button>`;
  html += `<button onclick="calSetFilter('priority','urgent',this)" class="cal-filter-priority" style="background:rgba(232,96,96,.15);border:1px solid rgba(232,96,96,.4);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--red);cursor:pointer;white-space:nowrap;flex-shrink:0">🔥 Срочные</button>`;
  html += `<button onclick="calSetFilter('priority','high',this)" class="cal-filter-priority" style="background:rgba(232,197,106,.15);border:1px solid rgba(232,197,106,.4);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--accent);cursor:pointer;white-space:nowrap;flex-shrink:0">⚡ Важные</button>`;

  el.innerHTML = html;
}

function calSetFilter(type, value, btn) {
  if(type === 'cat') {
    calFilterCat = value;
    document.querySelectorAll('.cal-filter-btn').forEach(b => {
      b.style.opacity = '0.5'; b.classList.remove('on');
    });
  } else if(type === 'member') {
    calFilterMember = value;
    document.querySelectorAll('.cal-filter-member').forEach(b => {
      b.style.opacity = '0.5'; b.classList.remove('on');
    });
  } else if(type === 'priority') {
    calFilterPriority = value;
    document.querySelectorAll('.cal-filter-priority').forEach(b => {
      b.style.opacity = '0.5'; b.classList.remove('on');
    });
  }
  btn.style.opacity = '1';
  btn.classList.add('on');
  renderCalendar();
}

// ─── CARD FILTERING ──────────────────────────
function getCalCards() {
  const source = calSpaceId === 'all' ? calAllCards : calSpaceId === 'current' ? calAllCards.filter(c=>c.space_id===currentSpaceId) : calAllCards.filter(c=>c.space_id===calSpaceId);
  return source.filter(c => {
    if(c.status === 'done') return false;
    if(!c.deadline) return false;
    if(calFilterCat !== 'all' && c.category !== calFilterCat) return false;
    if(calFilterMember !== 'all' && c.assigned_to !== calFilterMember) return false;
    if(calFilterPriority !== 'all' && c.priority !== calFilterPriority) return false;
    return true;
  });
}

// ─── RENDER ──────────────────────────────────
function renderCalendar() {
  if(calView === 'month') renderCalMonth();
  else if(calView === 'week') renderCalWeek();
  else renderCalDay();
}

function renderCalMonth() {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  document.getElementById('cal-title').textContent = CAL_MONTHS_RU[m] + ' ' + y;

  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0

  const todayStr = new Date().toISOString().slice(0,10);
  const filtered = getCalCards();

  // Build card map by date
  const cardMap = {};
  filtered.forEach(c => {
    const d = c.deadline;
    if(!cardMap[d]) cardMap[d] = [];
    cardMap[d].push(c);
  });

  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:4px">`;
  CAL_DAYS_RU.forEach(d => {
    html += `<div style="text-align:center;font-size:11px;color:var(--t3);padding:4px 0">${d}</div>`;
  });
  html += '</div>';

  html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">`;

  // Empty cells before first day
  for(let i = 0; i < startDow; i++) {
    html += `<div style="min-height:72px;background:var(--s2);border-radius:4px;opacity:.3"></div>`;
  }

  for(let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayCards = cardMap[dateStr] || [];
    const hasUrgent = dayCards.some(c=>c.priority==='urgent');
    const hasHigh = dayCards.some(c=>c.priority==='high');

    let bg = isToday ? 'rgba(232,197,106,.1)' : 'var(--s2)';
    let border = isToday ? '1px solid var(--accent)' : '1px solid transparent';
    if(hasUrgent) border = '1px solid var(--red)';

    html += `<div style="min-height:72px;background:${bg};border-radius:6px;border:${border};padding:4px;cursor:pointer" onclick="calDayClick('${dateStr}',event)">
      <div style="font-size:12px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--accent)':hasUrgent?'var(--red)':'var(--t2)'};margin-bottom:3px">${d}</div>`;

    dayCards.slice(0,3).forEach(c => {
      const col = catColor(c.category);
      const isUrgent = c.priority==='urgent';
      const isHigh = c.priority==='high';
      html += `<div onclick="event.stopPropagation();showCalPopup('${c.id}',event)" style="font-size:10px;background:${hex2rgba(col,.2)};border-left:2px solid ${isUrgent?'var(--red)':isHigh?'var(--accent)':col};border-radius:3px;padding:2px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--t1);cursor:pointer">${isUrgent?'🔥':isHigh?'⚡':''}${esc(c.title)}</div>`;
    });

    if(dayCards.length > 3) {
      html += `<div style="font-size:10px;color:var(--t3);text-align:center">+${dayCards.length-3}</div>`;
    }

    html += '</div>';
  }

  html += '</div>';
  document.getElementById('cal-body').innerHTML = html;
}

function renderCalWeek() {
  const dow = calDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(calDate);
  monday.setDate(calDate.getDate() + mondayOffset);

  const days = [];
  for(let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  const fromDate = days[0].toISOString().slice(0,10);
  const toDate = days[6].toISOString().slice(0,10);
  document.getElementById('cal-title').textContent = `${days[0].getDate()} ${CAL_MONTHS_RU[days[0].getMonth()].slice(0,3)} — ${days[6].getDate()} ${CAL_MONTHS_RU[days[6].getMonth()].slice(0,3)}`;

  const todayStr = new Date().toISOString().slice(0,10);
  const filtered = getCalCards();
  const cardMap = {};
  filtered.forEach(c => {
    if(!cardMap[c.deadline]) cardMap[c.deadline] = [];
    cardMap[c.deadline].push(c);
  });

  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">`;
  days.forEach(d => {
    const dateStr = d.toISOString().slice(0,10);
    const isToday = dateStr === todayStr;
    const dayCards = cardMap[dateStr] || [];
    const hasUrgent = dayCards.some(c=>c.priority==='urgent');

    html += `<div style="background:${isToday?'rgba(232,197,106,.1)':'var(--s2)'};border-radius:8px;border:${isToday?'1px solid var(--accent)':hasUrgent?'1px solid var(--red)':'1px solid var(--b1)'};padding:6px;min-height:120px">
      <div style="font-size:11px;color:var(--t3);margin-bottom:2px">${CAL_DAYS_RU[d.getDay()===0?6:d.getDay()-1]}</div>
      <div style="font-size:16px;font-weight:700;color:${isToday?'var(--accent)':hasUrgent?'var(--red)':'var(--t1)'};margin-bottom:6px">${d.getDate()}</div>`;

    dayCards.forEach(c => {
      const col = catColor(c.category);
      html += `<div onclick="showCalPopup('${c.id}',event)" style="font-size:11px;background:${hex2rgba(col,.2)};border-left:2px solid ${c.priority==='urgent'?'var(--red)':c.priority==='high'?'var(--accent)':col};border-radius:3px;padding:3px 5px;margin-bottom:3px;cursor:pointer;color:var(--t1)">${c.priority==='urgent'?'🔥':c.priority==='high'?'⚡':''}${esc(c.title.length>18?c.title.slice(0,16)+'…':c.title)}</div>`;
    });

    if(!dayCards.length) {
      html += `<div style="font-size:10px;color:var(--t3);text-align:center;margin-top:16px">—</div>`;
    }

    html += '</div>';
  });

  html += '</div>';
  document.getElementById('cal-body').innerHTML = html;
}

function renderCalDay() {
  const dateStr = calDate.toISOString().slice(0,10);
  const d = calDate.getDate();
  const m = calDate.getMonth();
  const y = calDate.getFullYear();
  document.getElementById('cal-title').textContent = `${d} ${CAL_MONTHS_RU[m]} ${y}`;

  const todayStr = new Date().toISOString().slice(0,10);
  const isToday = dateStr === todayStr;
  const filtered = getCalCards().filter(c => c.deadline === dateStr);

  let html = '';
  if(!filtered.length) {
    html = `<div style="text-align:center;padding:40px;color:var(--t3)">
      <div style="font-size:40px;margin-bottom:12px">📅</div>
      <div>Нет карточек на этот день</div>
    </div>`;
  } else {
    // Sort by priority then title
    const sorted = [...filtered].sort((a,b) => {
      const po = {urgent:0,high:1,normal:2};
      return (po[a.priority||'normal']||2) - (po[b.priority||'normal']||2);
    });
    sorted.forEach(c => {
      const col = catColor(c.category);
      const isUrgent = c.priority==='urgent';
      const isHigh = c.priority==='high';
      html += `<div onclick="showCalPopup('${c.id}',event)" style="background:${hex2rgba(col,.15)};border-left:4px solid ${isUrgent?'var(--red)':isHigh?'var(--accent)':col};border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:8px;cursor:pointer">
        <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:4px">${isUrgent?'🔥 ':isHigh?'⚡ ':''}${esc(c.title)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;color:${col}">${esc(c.category||'')}</span>
          ${c.assigned_to?`<span style="font-size:12px;color:var(--accent)">👤 ${esc(c.assigned_to)}</span>`:''}
          <span style="font-size:12px;color:var(--t3)">${c.status==='in_progress'?'В процессе':c.status==='waiting'?'Ожидание':'Новая'}</span>
        </div>
        ${c.entries?.length?`<div style="font-size:11px;color:var(--t3);margin-top:4px">Записи: ${c.entries.filter(e=>e.done).length}/${c.entries.length}</div>`:''}
      </div>`;
    });
  }

  document.getElementById('cal-body').innerHTML = html;
}

// ─── DAY CLICK (month view) ──────────────────
function calDayClick(dateStr, event) {
  calDate = new Date(dateStr + 'T12:00:00');
  setCalView('day');
}

// ─── MINI POPUP ──────────────────────────────
function showCalPopup(cardId, event) {
  event.stopPropagation();
  const card = calAllCards.find(c=>c.id===cardId) || cards.find(c=>c.id===cardId); if(!card) return;
  const popup = document.getElementById('cal-popup');
  const col = catColor(card.category);
  const dl = card.deadline ? deadlineInfo(card.deadline) : null;

  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="font-size:14px;font-weight:700;color:${col};flex:1;padding-right:8px">${card.priority==='urgent'?'🔥 ':card.priority==='high'?'⚡ ':''}${esc(card.title)}</div>
      <button onclick="document.getElementById('cal-popup').style.display='none'" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:16px;flex-shrink:0">✕</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${card.category?`<span style="font-size:11px;background:${hex2rgba(col,.15)};color:${col};padding:2px 8px;border-radius:10px">${esc(card.category)}</span>`:''}
      ${dl?`<span style="font-size:11px;color:${dl.cls==='dl-now'?'var(--red)':'var(--accent)'}">${dl.text}</span>`:''}
      ${card.assigned_to?`<span style="font-size:11px;color:var(--accent)">👤 ${esc(card.assigned_to)}</span>`:''}
    </div>
    <div style="display:flex;gap:6px">
       <button onclick="calOpenCard('${cardId}')" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">Открыть</button>
      <button onclick="calChangeDeadline('${cardId}')" style="background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:6px;padding:8px 10px;font-size:13px;cursor:pointer">📅</button>
      <button onclick="calToggleDone('${cardId}')" style="background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:6px;padding:8px 10px;font-size:13px;cursor:pointer">✓</button>
    </div>
  `;

  // Position popup
  const x = event.clientX, y = event.clientY;
  const pw = 280, ph = 140;
  const left = Math.min(x, window.innerWidth - pw - 10);
  const top = Math.min(y + 10, window.innerHeight - ph - 10);
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.display = 'block';

  setTimeout(() => document.addEventListener('click', function h(e) {
    if(!popup.contains(e.target)) { popup.style.display='none'; document.removeEventListener('click',h); }
  }), 100);
}

async function calChangeDeadline(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  const newDate = prompt('Новый дедлайн (ГГГГ-ММ-ДД):', card.deadline||'');
  if(!newDate) return;
  card.deadline = newDate;
  document.getElementById('cal-popup').style.display='none';
  renderCalendar();
  try { await dbUpdate(card); toast('✓ Дедлайн изменён'); } catch(e) { toast('Ошибка', true); }
}

async function calToggleDone(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  card.status = card.status === 'done' ? 'in_progress' : 'done';
  document.getElementById('cal-popup').style.display='none';
  renderCalendar();
  try { await dbUpdate(card); toast(card.status==='done'?'✓ Выполнено':'↩ Возвращено'); } catch(e) { toast('Ошибка', true); }
}

function calSetSpace(spaceId, btn) {
  calSpaceId = spaceId;
  document.querySelectorAll('.cal-filter-space').forEach(b => {
    b.style.borderColor = 'var(--b1)';
    b.style.color = 'var(--t2)';
  });
  btn.style.borderColor = 'var(--accent)';
  btn.style.color = 'var(--accent)';
  renderCalendar();
}
async function calOpenCard(cardId) {
  const card = calAllCards.find(c=>c.id===cardId); if(!card) return;
  // If card is in different space - switch to it first
  if(card.space_id !== currentSpaceId) {
    closeCalendar();
    await setCurrentSpace(card.space_id, true);
    setTimeout(()=>openView(cardId), 800);
  } else {
    closeCalendar();
    openView(cardId);
  }
}
