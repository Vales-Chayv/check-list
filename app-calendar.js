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
let calAllEvents = [];
let calShowHols = localStorage.getItem('mc_show_hols') !== '0';   // показывать праздники
let calShowEvents = localStorage.getItem('mc_show_events') !== '0'; // показывать события
function calToggleHols() { calShowHols = !calShowHols; localStorage.setItem('mc_show_hols', calShowHols?'1':'0'); renderCalFilters(); renderCalendar(); }
function calToggleEvents() { calShowEvents = !calShowEvents; localStorage.setItem('mc_show_events', calShowEvents?'1':'0'); renderCalFilters(); renderCalendar(); }
let calEnabledCats = new Set(); // включённые пары «кабинет‖рубрика» (множественный выбор)
let calCatColors = {}; // цвета рубрик всех кабинетов: ключ «кабинет‖рубрика» → цвет
let calOpenCab = null; // какой кабинет развёрнут в панели (аккордеон)
let calShownCabs = new Set(); // кабинеты, вынесенные чипсами в верхнюю строку
let calRegion = localStorage.getItem('mc_region') || 'IL'; // регион: часовой пояс + праздники (пока только Израиль)
const CAL_REGIONS = { IL: { tz: 'Asia/Jerusalem' } }; // позже добавим другие страны
function calTZ() { return (CAL_REGIONS[calRegion] || CAL_REGIONS.IL).tz; }
function calTodayStr() { // «сегодня» как 'YYYY-MM-DD' в часовом поясе региона
  return new Intl.DateTimeFormat('en-CA', { timeZone: calTZ(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
let calPrioOpen = false; // развёрнуты ли кнопки приоритетов (🔥/⚡)
let calFromLobby = false; // календарь открыт с экрана кабинетов → вернуться туда при закрытии

const CAL_DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const CAL_MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const CAL_HOLIDAYS_IL = {
  '2026-03-03': [{ ru:"Пурим", he:"פורים", en:"Purim", type:"major" }],
  '2026-04-02': [{ ru:"Песах (1-й день)", he:"פסח א׳", en:"Pesach I", type:"major" }],
  '2026-04-08': [{ ru:"Песах (7-й день)", he:"פסח ז׳", en:"Pesach VII", type:"major" }],
  '2026-04-14': [{ ru:"Йом ха-Шоа (День Катастрофы)", he:"יום השואה", en:"Yom HaShoah", type:"modern" }],
  '2026-04-21': [{ ru:"Йом ха-Зикарон (День памяти)", he:"יום הזכרון", en:"Yom HaZikaron", type:"modern" }],
  '2026-04-22': [{ ru:"Йом ха-Ацмаут (День независимости)", he:"יום העצמאות", en:"Yom HaAtzmaut", type:"modern" }],
  '2026-05-15': [{ ru:"Йом Йерушалаим (День Иерусалима)", he:"יום ירושלים", en:"Yom Yerushalayim", type:"modern" }],
  '2026-05-22': [{ ru:"Шавуот", he:"שבועות", en:"Shavuot", type:"major" }],
  '2026-07-23': [{ ru:"Тиша бе-Ав", he:"תשעה באב", en:"Tisha B'Av", type:"major" }],
  '2026-09-12': [{ ru:"Рош ха-Шана", he:"ראש השנה", en:"Rosh Hashana", type:"major" }],
  '2026-09-13': [{ ru:"Рош ха-Шана (2-й день)", he:"ראש השנה ב׳", en:"Rosh Hashana II", type:"major" }],
  '2026-09-21': [{ ru:"Йом Кипур", he:"יום כיפור", en:"Yom Kippur", type:"major" }],
  '2026-09-26': [{ ru:"Суккот", he:"סוכות א׳", en:"Sukkot", type:"major" }],
  '2026-10-03': [{ ru:"Шмини Ацерет / Симхат Тора", he:"שמיני עצרת", en:"Shmini Atzeret", type:"major" }],
  '2026-12-04': [{ ru:"Ханука", he:"חנוכה", en:"Hanukkah", type:"major" }],
  '2027-03-23': [{ ru:"Пурим", he:"פורים", en:"Purim", type:"major" }],
  '2027-04-22': [{ ru:"Песах (1-й день)", he:"פסח א׳", en:"Pesach I", type:"major" }],
  '2027-04-28': [{ ru:"Песах (7-й день)", he:"פסח ז׳", en:"Pesach VII", type:"major" }],
  '2027-05-04': [{ ru:"Йом ха-Шоа (День Катастрофы)", he:"יום השואה", en:"Yom HaShoah", type:"modern" }],
  '2027-05-11': [{ ru:"Йом ха-Зикарон (День памяти)", he:"יום הזכרון", en:"Yom HaZikaron", type:"modern" }],
  '2027-05-12': [{ ru:"Йом ха-Ацмаут (День независимости)", he:"יום העצמאות", en:"Yom HaAtzmaut", type:"modern" }],
  '2027-06-04': [{ ru:"Йом Йерушалаим (День Иерусалима)", he:"יום ירושלים", en:"Yom Yerushalayim", type:"modern" }],
  '2027-06-11': [{ ru:"Шавуот", he:"שבועות", en:"Shavuot", type:"major" }],
  '2027-08-12': [{ ru:"Тиша бе-Ав", he:"תשעה באב", en:"Tisha B'Av", type:"major" }],
  '2027-10-02': [{ ru:"Рош ха-Шана", he:"ראש השנה", en:"Rosh Hashana", type:"major" }],
  '2027-10-03': [{ ru:"Рош ха-Шана (2-й день)", he:"ראש השנה ב׳", en:"Rosh Hashana II", type:"major" }],
  '2027-10-11': [{ ru:"Йом Кипур", he:"יום כיפור", en:"Yom Kippur", type:"major" }],
  '2027-10-16': [{ ru:"Суккот", he:"סוכות א׳", en:"Sukkot", type:"major" }],
  '2027-10-23': [{ ru:"Шмини Ацерет / Симхат Тора", he:"שמיני עצרת", en:"Shmini Atzeret", type:"major" }],
  '2027-12-24': [{ ru:"Ханука", he:"חנוכה", en:"Hanukkah", type:"major" }],
  '2028-03-12': [{ ru:"Пурим", he:"פורים", en:"Purim", type:"major" }],
  '2028-04-11': [{ ru:"Песах (1-й день)", he:"פסח א׳", en:"Pesach I", type:"major" }],
  '2028-04-17': [{ ru:"Песах (7-й день)", he:"פסח ז׳", en:"Pesach VII", type:"major" }],
  '2028-04-24': [{ ru:"Йом ха-Шоа (День Катастрофы)", he:"יום השואה", en:"Yom HaShoah", type:"modern" }],
  '2028-05-01': [{ ru:"Йом ха-Зикарон (День памяти)", he:"יום הזכרון", en:"Yom HaZikaron", type:"modern" }],
  '2028-05-02': [{ ru:"Йом ха-Ацмаут (День независимости)", he:"יום העצמאות", en:"Yom HaAtzmaut", type:"modern" }],
  '2028-05-24': [{ ru:"Йом Йерушалаим (День Иерусалима)", he:"יום ירושלים", en:"Yom Yerushalayim", type:"modern" }],
  '2028-05-31': [{ ru:"Шавуот", he:"שבועות", en:"Shavuot", type:"major" }],
  '2028-08-01': [{ ru:"Тиша бе-Ав", he:"תשעה באב", en:"Tisha B'Av", type:"major" }],
  '2028-09-21': [{ ru:"Рош ха-Шана", he:"ראש השנה", en:"Rosh Hashana", type:"major" }],
  '2028-09-22': [{ ru:"Рош ха-Шана (2-й день)", he:"ראש השנה ב׳", en:"Rosh Hashana II", type:"major" }],
  '2028-09-30': [{ ru:"Йом Кипур", he:"יום כיפור", en:"Yom Kippur", type:"major" }],
  '2028-10-05': [{ ru:"Суккот", he:"סוכות א׳", en:"Sukkot", type:"major" }],
  '2028-10-12': [{ ru:"Шмини Ацерет / Симхат Тора", he:"שמיני עצרת", en:"Shmini Atzeret", type:"major" }],
  '2028-12-12': [{ ru:"Ханука", he:"חנוכה", en:"Hanukkah", type:"major" }],
};
const CAL_HOLIDAYS = { IL: CAL_HOLIDAYS_IL }; // регион → таблица праздников (позже добавим другие страны)
function calHolidays(dateStr) { // праздники на дату (массив, или []) по текущему региону
  const src = CAL_HOLIDAYS[calRegion];
  return (src && src[dateStr]) || [];
}
function calHolHtml(dateStr, size) { // size: 'sm' месяц | 'md' неделя | 'lg' день
  if(!calShowHols) return '';
  const hols = calHolidays(dateStr);
  if(!hols.length) return '';
  return hols.map(h => {
    const col = h.type === 'modern' ? '#5fb98e' : '#7aa2f7'; // современные — зелёный, крупные — синий
    const icon = h.type === 'modern' ? '🇮🇱' : '✡️';
    if(size === 'lg') {
      return `<div style="display:flex;align-items:center;gap:8px;background:${hex2rgba(col,.15)};border-left:4px solid ${col};border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px"><span style="font-size:16px">${icon}</span><span style="font-size:14px;font-weight:700;color:${col}">${esc(h.ru)}</span></div>`;
    }
    const fs = size === 'md' ? '11px' : '9px';
 return `<div title="${esc(h.ru)}" style="font-size:${fs};line-height:1.25;color:${col};background:${hex2rgba(col,.14)};border-radius:3px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${icon} ${esc(h.ru)}</div>`;
  }).join('');
}
function calEventOccursOn(ev, dateStr) { // выпадает ли событие (с учётом повтора) на дату
  if(!ev.event_date || ev.event_date > dateStr) return false;
  if(ev.repeat_until && dateStr > ev.repeat_until) return false;
  const rep = ev.repeat || 'none';
  if(rep === 'none') return ev.event_date === dateStr;
  const [ey,em,ed] = ev.event_date.split('-').map(Number);
  const [yy,mm,dd] = dateStr.split('-').map(Number);
  if(rep === 'daily') return true;
  if(rep === 'weekly') return ((Date.UTC(yy,mm-1,dd) - Date.UTC(ey,em-1,ed)) / 86400000) % 7 === 0;
  if(rep === 'monthly') return dd === ed;
  if(rep === 'yearly') return dd === ed && mm === em;
  return false;
}
function calEventsOnDate(dateStr) { return calAllEvents.filter(ev => calEventOccursOn(ev, dateStr)); }
function calEvtHtml(dateStr, size) { // size: 'sm' месяц | 'md' неделя | 'lg' день
  if(!calShowEvents) return '';
  const evs = calEventsOnDate(dateStr);
  if(!evs.length) return '';
  const col = '#b48ef0'; // события — фиолетовый
  return evs.map(ev => {
    const rep = (ev.repeat && ev.repeat !== 'none') ? '🔁 ' : '';
    const tm = ev.event_time ? esc(ev.event_time) + ' ' : '';
    if(size === 'lg') {
      return `<div onclick="openEventModal('${dateStr}','${esc(ev.id)}')" style="background:${hex2rgba(col,.15)};border-left:4px solid ${col};border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:8px;cursor:pointer"><div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:2px">🗓️ ${rep}${tm}${esc(ev.title)}</div>${ev.note?`<div style="font-size:12px;color:var(--t3)">${esc(ev.note)}</div>`:''}</div>`;
    }
    const fs = size === 'md' ? '11px' : '10px';
    return `<div onclick="event.stopPropagation();openEventModal('${dateStr}','${esc(ev.id)}')" title="${esc(ev.title)}" style="font-size:${fs};background:${hex2rgba(col,.2)};border-left:2px solid ${col};border-radius:3px;padding:2px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--t1);cursor:pointer">🗓️ ${rep}${tm}${esc(ev.title)}</div>`;
  }).join('');
}

// ─── OPEN / CLOSE ────────────────────────────
async function openCalendar() {
  calDate = new Date();
  calSpaceId = 'current';
  calAllCards = [];
  calAllEvents = [];
  document.getElementById('cal-ov').classList.add('on');
  document.getElementById('cal-body').innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">⏳ Загрузка...</div>';
 try {
    const ids = spaces.map(s=>s.id);
    let data = null;
    if(navigator.onLine){
      const r = await sb.from('cards').select('*').in('space_id', ids).not('deadline','is',null);
      data = r.data;
    }
    if(!data){ const all = await local.getAll('cards'); data = all.filter(c => c.deadline); } // офлайн — из кэша
    calAllCards = data||[];
  } catch(e) {
    try { const all = await local.getAll('cards'); calAllCards = all.filter(c => c.deadline); }
    catch(_) { calAllCards = [...cards]; }
  }
  try {
    const ids2 = spaces.map(s=>s.id);
    let evData = null;
    if(navigator.onLine){
      const r = await sb.from('events').select('*').in('space_id', ids2);
      evData = r.data;
    }
    if(!evData) evData = (await local.getAll('events')).filter(ev => ids2.includes(ev.space_id)); // офлайн — из кэша
    calAllEvents = evData||[];
  } catch(e) {
    try { calAllEvents = (await local.getAll('events')).filter(ev => spaces.map(s=>s.id).includes(ev.space_id)); }
    catch(_) { calAllEvents = []; }
  }
  try {
    const ids3 = spaces.map(s=>s.id);
    let catData = null;
    if(navigator.onLine){
      const r = await sb.from('categories').select('name,color,space_id').in('space_id', ids3);
      catData = r.data;
    }
    if(!catData) catData = (await local.getAll('categories')).filter(c => ids3.includes(c.space_id)); // офлайн — из кэша
    calCatColors = {};
    (catData||[]).forEach(c => { calCatColors[calCatKey(c.space_id, c.name)] = c.color; });
  } catch(e) { calCatColors = {}; }
  calEnableAll();
  renderCalFilters();
  renderCalendar();
}

function closeCalendar() {
  document.getElementById('cal-ov').classList.remove('on');
  document.getElementById('cal-popup').style.display = 'none';
  if(calFromLobby) { calFromLobby = false; showSpaceSelector(); }
}
let evEditId = null;
// ── Напоминания события: [{d:N}] за N дней, [{m:N}] за N минут до времени события ──
let evRem = []; // ключи: 'd0','d1','m15'…
const EV_REM_PRESETS = ['d0','d1','d3','d7','m0','m15','m60','m120'];
function evRemLabel(k) {
  const t = k[0], n = +k.slice(1);
  if(t === 'd') return n === 0 ? 'В тот же день' : n === 1 ? 'За 1 день' : n === 7 ? 'За неделю' : 'За ' + n + ' дн.';
  if(n === 0) return 'В момент события';
  if(n >= 60 && n % 60 === 0) return 'За ' + (n/60) + ' ' + (n === 60 ? 'час' : (n/60) < 5 ? 'часа' : 'часов');
  return 'За ' + n + ' мин';
}
function evRemRender() {
  const rows = document.getElementById('ev-rem-rows'), chips = document.getElementById('ev-rem-chips');
  if(!rows || !chips) return;
  const hasTime = !!document.getElementById('ev-time')?.value;
  const keys = [...EV_REM_PRESETS, ...evRem.filter(k => !EV_REM_PRESETS.includes(k))];
  rows.innerHTML = keys.map((k, i) => {
    const on = evRem.includes(k), off = k[0] === 'm' && !hasTime;
    return `<div onclick="evRemToggle('${k}')" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;font-size:14px;cursor:pointer;${i ? 'border-top:1px solid var(--b1);' : ''}${off ? 'opacity:.4;' : ''}"><span>${evRemLabel(k)}</span><span style="color:var(--accent);font-weight:700">${on ? '✓' : ''}</span></div>`;
  }).join('');
  chips.innerHTML = evRem.map(k => `<span onclick="evRemToggle('${k}')" style="background:rgba(232,197,106,.18);color:var(--accent);border-radius:14px;padding:3px 10px;font-size:12px;cursor:pointer">${evRemLabel(k)} ✕</span>`).join('');
}
function evRemTogglePanel() {
  const p = document.getElementById('ev-rem-panel'); if(!p) return;
  const open = p.style.display === 'none';
  p.style.display = open ? 'block' : 'none';
  document.getElementById('ev-rem-arrow').textContent = open ? '▴' : '▾';
}
function evRemToggle(k) {
  if(k[0] === 'm' && !evRem.includes(k) && !document.getElementById('ev-time').value) { toast('Сначала укажи время события', true); return; }
  evRem = evRem.includes(k) ? evRem.filter(x => x !== k) : [...evRem, k];
  evRemRender();
}
function evRemAddCustom() {
  const n = parseInt(document.getElementById('ev-rem-n').value, 10), u = document.getElementById('ev-rem-u').value;
  if(!n || n < 1) { toast('Введи число', true); return; }
  if(u !== 'd' && !document.getElementById('ev-time').value) { toast('Минуты и часы — только если указано время', true); return; }
  const k = u === 'd' ? 'd' + Math.min(n, 14) : 'm' + Math.min(u === 'h' ? n * 60 : n, 20160);
  if(!evRem.includes(k)) evRem.push(k);
  document.getElementById('ev-rem-n').value = '';
  evRemRender();
}
function evRemToArray() {
  const hasTime = !!document.getElementById('ev-time').value;
  const arr = evRem.filter(k => hasTime || k[0] === 'd').map(k => k[0] === 'd' ? { d: +k.slice(1) } : { m: +k.slice(1) });
  return arr.length ? arr : null;
}
function evRepeatChanged() {
  const rep = document.getElementById('ev-repeat').value;
  document.getElementById('ev-until-wrap').style.display = (rep === 'none') ? 'none' : 'flex';
}
function openEventModal(dateStr, eventId) {
  evEditId = eventId || null;
  const sel = document.getElementById('ev-space');
  const ev = evEditId ? calAllEvents.find(e => e.id === evEditId) : null;
  if(ev) {
    document.getElementById('ev-modal-title').textContent = 'Редактировать событие';
    sel.value = ev.space_id || (spaces[0] && spaces[0].id) || '';
    { const sp = spaces.find(s => s.id === sel.value); const n = document.getElementById('ev-space-note'); if(n) n.textContent = sp ? (sp.type === 'personal' ? 'Личное событие' : 'Кабинет: ' + sp.name) : ''; }
    document.getElementById('ev-title').value = ev.title || '';
    document.getElementById('ev-date').value = ev.event_date || '';
    document.getElementById('ev-time').value = ev.event_time || '';
    document.getElementById('ev-repeat').value = ev.repeat || 'none';
    document.getElementById('ev-until').value = ev.repeat_until || '';
    document.getElementById('ev-note').value = ev.note || '';
    evRem = (Array.isArray(ev.reminders) ? ev.reminders : []).map(r => r && Number.isFinite(r.d) ? 'd' + r.d : r && Number.isFinite(r.m) ? 'm' + r.m : null).filter(Boolean);
    document.getElementById('ev-delete-btn').style.display = 'block';
  } else {
    if(!dateStr) {
      if(calView === 'day') { const d = calDate; dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
      else dateStr = calTodayStr();
    }
    document.getElementById('ev-modal-title').textContent = 'Новое событие';
    { // внутри кабинета — событие этого кабинета; из лобби — личное
      const inCab = document.body.classList.contains('in-cabinet') && spaces.some(s => s.id === currentSpaceId);
      const sp = inCab ? spaces.find(s => s.id === currentSpaceId) : (spaces.find(s => s.type === 'personal') || spaces[0]);
      sel.value = sp ? sp.id : '';
      const n = document.getElementById('ev-space-note'); if(n) n.textContent = sp ? (sp.type === 'personal' ? 'Личное событие' : 'Кабинет: ' + sp.name) : '';
    }
    document.getElementById('ev-title').value = '';
    document.getElementById('ev-date').value = dateStr;
    document.getElementById('ev-time').value = '';
    document.getElementById('ev-repeat').value = 'none';
    document.getElementById('ev-until').value = '';
    document.getElementById('ev-note').value = '';
    evRem = [];
    document.getElementById('ev-delete-btn').style.display = 'none';
  }
  evRepeatChanged();
  evRemRender();
  { const p = document.getElementById('ev-rem-panel'); if(p) { p.style.display = 'none'; document.getElementById('ev-rem-arrow').textContent = '▾'; } }
  document.getElementById('event-ov').classList.add('on');
}
function closeEventModal() {
  document.getElementById('event-ov').classList.remove('on');
}
async function calReloadEvents() {
  const ids = spaces.map(s=>s.id);
  try {
    if(navigator.onLine){
      const {data} = await sb.from('events').select('*').in('space_id', ids);
      calAllEvents = data || [];
    } else {
      calAllEvents = (await local.getAll('events')).filter(ev => ids.includes(ev.space_id));
    }
  } catch(e) {}
}
async function calRefreshData() { // лёгкое обновление колонки: данные + перерисовка, без сброса вида/фильтров
  if(!spaces || !spaces.length) return;
  const ids = spaces.map(s=>s.id);
  try {
    if(navigator.onLine){
      const {data} = await sb.from('cards').select('*').in('space_id', ids).not('deadline','is',null);
      calAllCards = data || [];
    } else {
      calAllCards = (await local.getAll('cards')).filter(c => c.deadline && ids.includes(c.space_id));
    }
  } catch(e) {}
  try {
    if(navigator.onLine){
      const {data:evData} = await sb.from('events').select('*').in('space_id', ids);
      calAllEvents = evData || [];
    } else {
      calAllEvents = (await local.getAll('events')).filter(ev => ids.includes(ev.space_id));
    }
  } catch(e) {}
  try {
    if(navigator.onLine){
      const {data:catData} = await sb.from('categories').select('name,color,space_id').in('space_id', ids);
      calCatColors = {};
      (catData||[]).forEach(c => { calCatColors[calCatKey(c.space_id, c.name)] = c.color; });
    } else {
      calCatColors = {};
      (await local.getAll('categories')).filter(c => ids.includes(c.space_id)).forEach(c => { calCatColors[calCatKey(c.space_id, c.name)] = c.color; });
    }
  } catch(e) {}
  renderCalendar();
}
async function saveEvent() {
  const space_id = document.getElementById('ev-space').value;
  const title = document.getElementById('ev-title').value.trim();
  const event_date = document.getElementById('ev-date').value;
  const repeat = document.getElementById('ev-repeat').value;
  if(!title) { toast('Введите название', true); return; }
  if(!event_date) { toast('Укажите дату', true); return; }
  if(!space_id) { toast('Выберите кабинет', true); return; }
  const isNew = !evEditId;
  const obj = {
    id: isNew ? uid() : evEditId,
    space_id, title, event_date,
    event_time: document.getElementById('ev-time').value || null,
    repeat,
    repeat_until: (repeat !== 'none' ? (document.getElementById('ev-until').value || null) : null),
    note: document.getElementById('ev-note').value.trim() || null,
    reminders: evRemToArray()
  };
  await local.put('events', obj);
  if(navigator.onLine) {
    try {
      if(isNew) { const {error} = await sb.from('events').insert(obj); if(error && error.code!=='23505') throw error; }
      else { const {id, ...data} = obj; const {error} = await sb.from('events').update(data).eq('id', id); if(error) throw error; }
    } catch(e) {
      await queueOp({type: isNew ? 'insert_event' : 'update_event', data: obj});
    }
  } else {
    await queueOp({type: isNew ? 'insert_event' : 'update_event', data: obj});
  }
  await calReloadEvents();
  renderCalendar();
  closeEventModal();
  toast('✓ Сохранено');
}
// ── Всплывающее окно напоминаний о событиях (при открытии приложения) ──
function evPopDismissed() { try { return JSON.parse(localStorage.getItem('mc_ev_dismissed') || '{}'); } catch(e) { return {}; } }
async function evPopupCheck(force) {
  if(!currentUser || document.getElementById('ev-pop-ov')) return;
  if(!force && Date.now() - (window._evPopLast || 0) < 5 * 60000) return;
  window._evPopLast = Date.now();
  const ids = spaces.map(s => s.id);
  if(!ids.length) return;
  let evs = [];
  try {
    const { data, error } = await sb.from('events').select('*').in('space_id', ids).not('reminders','is',null);
    if(error) throw error;
    evs = data || [];
  } catch(e) {
    try { evs = (await local.getAll('events')).filter(ev => ids.includes(ev.space_id) && Array.isArray(ev.reminders)); } catch(_) { evs = []; }
  }
  evs = evs.filter(ev => Array.isArray(ev.reminders) && ev.reminders.length);
  if(!evs.length) return;
  const now = new Date(), todayS = calTodayStr();
  const base = new Date(todayS + 'T00:00:00');
  const dis = evPopDismissed();
  const rows = [];
  for(let i = 0; i <= 15; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    evs.forEach(ev => {
      if(!calEventOccursOn(ev, ds)) return;
      const key = ev.id + '|' + ds;
      if(dis[key]) return;
      const time = ev.event_time ? String(ev.event_time).slice(0,5) : '';
      const fires = ev.reminders.some(r => {
        if(r && Number.isFinite(r.d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - r.d) <= now;
        if(r && Number.isFinite(r.m) && time) { const [hh, mm] = time.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm - r.m) <= now; }
        return false;
      });
      if(fires) rows.push({ ev, ds, i, time, key });
    });
  }
  if(!rows.length) return;
  rows.sort((a,b) => a.ds.localeCompare(b.ds) || a.time.localeCompare(b.time));
  window._evPopRows = rows;
  const ov = document.createElement('div');
  ov.id = 'ev-pop-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2400;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
    <div style="font-size:16px;font-weight:700;margin-bottom:2px">🔔 Напоминания</div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:10px">Сегодня и скоро</div>
    ${rows.map(r => `<div style="padding:9px 0;border-top:1px solid var(--b1);display:flex;justify-content:space-between;gap:10px;font-size:13px">
      <span style="word-break:break-word" dir="auto">${esc(r.ev.title || '')}${r.ev.note ? `<span style="display:block;font-size:11px;color:var(--t3)">${esc(r.ev.note)}</span>` : ''}</span>
      <span style="white-space:nowrap;color:${r.i === 0 ? 'var(--accent)' : 'var(--t3)'}">${r.i === 0 ? 'сегодня' : r.i === 1 ? 'завтра' : 'через ' + r.i + ' дн.'}${r.time ? ' · ' + r.time : ''}</span>
    </div>`).join('')}
    <div style="display:flex;gap:8px;margin-top:14px">
      <button onclick="document.getElementById('ev-pop-ov').remove()" style="flex:1;background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px;cursor:pointer;font-family:inherit">Позже</button>
      <button onclick="evPopOk()" style="flex:1;background:var(--accent);border:none;color:#0f0f0f;font-weight:700;border-radius:var(--rsm);padding:11px;cursor:pointer;font-family:inherit">Понятно</button>
    </div></div>`;
  document.body.appendChild(ov);
}
function evPopOk() {
  const dis = evPopDismissed(), t = Date.now();
  (window._evPopRows || []).forEach(r => { dis[r.key] = t; });
  Object.keys(dis).forEach(k => { if(t - dis[k] > 60 * 86400000) delete dis[k]; });
  try { localStorage.setItem('mc_ev_dismissed', JSON.stringify(dis)); } catch(e) {}
  document.getElementById('ev-pop-ov')?.remove();
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && typeof evPopupCheck === 'function') evPopupCheck(); });
async function deleteEvent() {
  if(!evEditId) return;
  if(!confirm('Удалить событие?')) return;
  const id = evEditId;
  await local.delete('events', id);
  if(navigator.onLine) {
    try {
      const {error} = await sb.from('events').delete().eq('id', id);
      if(error) throw error;
    } catch(e) {
      await queueOp({type:'delete_event', data:{id}});
    }
  } else {
    await queueOp({type:'delete_event', data:{id}});
  }
  await calReloadEvents();
  renderCalendar();
  closeEventModal();
  toast('✓ Удалено');
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

function calPrevYear() {
  calDate.setFullYear(calDate.getFullYear() - 1);
  calDate = new Date(calDate);
  renderCalendar();
}

function calNextYear() {
  calDate.setFullYear(calDate.getFullYear() + 1);
  calDate = new Date(calDate);
  renderCalendar();
}

// ─── FILTERS ─────────────────────────────────
function renderCalFilters() {
  const el = document.getElementById('cal-filters');
  const members = currentSpace?.type === 'family' ? (currentSpace?.members||[]).map(m=>m.name) : [];
  const cabs = calCabinetRubrics();

  let html = '';
 const allKeys = cabs.flatMap(c => c.rubrics.map(r => r.key));
  const onCount = allKeys.filter(k => calEnabledCats.has(k)).length;
  const allOn = allKeys.length > 0 && onCount === allKeys.length;
  html += `<button onclick="calSetAllCats(${!allOn})" style="background:${allOn?'rgba(232,197,106,.18)':'var(--s2)'};border:1px solid ${allOn?'var(--accent)':'var(--b1)'};border-radius:14px;padding:4px 10px;font-size:12px;color:${allOn?'var(--accent)':'var(--t3)'};opacity:${allOn?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">${t('Все')}</button>`;
  html += `<button onclick="calToggleHols()" style="background:${calShowHols?'rgba(122,162,247,.18)':'var(--s2)'};border:1px solid ${calShowHols?'#7aa2f7':'var(--b1)'};border-radius:14px;padding:4px 10px;font-size:12px;color:${calShowHols?'#7aa2f7':'var(--t3)'};opacity:${calShowHols?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">✡️ ${t('Праздники')}</button>`;
  html += `<button onclick="calToggleEvents()" style="background:${calShowEvents?'rgba(180,142,240,.18)':'var(--s2)'};border:1px solid ${calShowEvents?'#b48ef0':'var(--b1)'};border-radius:14px;padding:4px 10px;font-size:12px;color:${calShowEvents?'#b48ef0':'var(--t3)'};opacity:${calShowEvents?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">🗓️ ${t('События')}</button>`;
  html += `<button id="cal-cab-btn" onclick="openCabinetPanel()" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 12px;font-size:12px;color:var(--t1);cursor:pointer;white-space:nowrap;flex-shrink:0;font-weight:500">🗂️ ${t('Кабинеты')}${onCount<allKeys.length?` (${onCount}/${allKeys.length})`:''}</button>`;
  cabs.forEach(cab => {
    if(!calShownCabs.has(cab.spaceId)) return;
    const sp = spaces.find(s => s.id === cab.spaceId);
    const icon = sp && sp.type === 'family' ? '👨‍👩‍👧' : '🗂️';
    html += `<div style="width:1px;background:var(--b1);flex-shrink:0;margin:2px 4px"></div>`;
    html += `<button data-sp="${esc(cab.spaceId)}" onclick="calToggleCabShown(this.dataset.sp)" title="${t('Убрать из фильтра')}" style="background:var(--s2);border:1px solid var(--accent);border-radius:14px;padding:4px 12px;font-size:12px;color:var(--accent);font-weight:600;white-space:nowrap;flex-shrink:0;cursor:pointer">${icon} ${esc(cab.spaceName)}</button>`;
    cab.rubrics.forEach(r => {
      const on = calEnabledCats.has(r.key);
      html += `<button data-key="${esc(r.key)}" onclick="calToggleRubric(this.dataset.key)" style="background:${on?hex2rgba(r.color,.18):'var(--s2)'};border:1px solid ${on?hex2rgba(r.color,.5):'var(--b1)'};border-radius:14px;padding:4px 10px;font-size:12px;color:${on?r.color:'var(--t3)'};opacity:${on?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${r.color};margin-right:4px"></span>${esc(r.name||'—')}</button>`;
    });
  });

  if(members.length) {
    html += `<div style="width:1px;background:var(--b1);flex-shrink:0;margin:2px 4px"></div>`;
    html += `<button onclick="calSetFilter('member','all')" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:${calFilterMember==='all'?'var(--t1)':'var(--t3)'};opacity:${calFilterMember==='all'?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">${t('Все участники')}</button>`;
    members.forEach(m => {
      const on = calFilterMember === m;
      html += `<button onclick="calSetFilter('member','${esc(m)}')" style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:4px 10px;font-size:12px;color:${on?'var(--t1)':'var(--t3)'};opacity:${on?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">👤 ${esc(m)}</button>`;
    });
  }

  html += `<div style="width:1px;background:var(--b1);flex-shrink:0;margin:2px 4px"></div>`;
 const prioHL = calPrioOpen || calFilterPriority !== 'all';
  html += `<button onclick="calTogglePrio()" style="background:${prioHL?'rgba(232,197,106,.18)':'var(--s2)'};border:1px solid ${prioHL?'var(--accent)':'var(--b1)'};border-radius:14px;padding:4px 10px;font-size:12px;color:${prioHL?'var(--accent)':'var(--t3)'};opacity:${prioHL?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">🔥/⚡</button>`;
  if(calPrioOpen) {
    html += `<button onclick="calSetFilter('priority','${calFilterPriority==='urgent'?'all':'urgent'}')" style="background:rgba(232,96,96,.15);border:1px solid rgba(232,96,96,.4);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--red);opacity:${calFilterPriority==='urgent'?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">🔥 ${t('Срочные')}</button>`;
    html += `<button onclick="calSetFilter('priority','${calFilterPriority==='high'?'all':'high'}')" style="background:rgba(232,197,106,.15);border:1px solid rgba(232,197,106,.4);border-radius:14px;padding:4px 10px;font-size:12px;color:var(--accent);opacity:${calFilterPriority==='high'?'1':'.55'};cursor:pointer;white-space:nowrap;flex-shrink:0">⚡ ${t('Важные')}</button>`;
  }

  el.innerHTML = html;
}


function calSetFilter(type, value) {
  if(type === 'member') calFilterMember = value;
  else if(type === 'priority') calFilterPriority = value;
  renderCalFilters();
  renderCalendar();
}

function calRefreshFilters() {
  renderCalFilters();
  renderCalendar();
  if(document.getElementById('cal-cab-panel')) renderCabinetPanel();
}

function calToggleRubric(key) {
  if(calEnabledCats.has(key)) calEnabledCats.delete(key);
  else calEnabledCats.add(key);
  calRefreshFilters();
}

function calToggleCabinet(spaceId) {
  const cab = calCabinetRubrics().find(c => c.spaceId === spaceId);
  if(!cab) return;
  const allOn = cab.rubrics.every(r => calEnabledCats.has(r.key));
  cab.rubrics.forEach(r => { if(allOn) calEnabledCats.delete(r.key); else calEnabledCats.add(r.key); });
  calRefreshFilters();
}

function calSetAllCats(on) {
  if(on) calEnableAll();
  else calEnabledCats = new Set();
  calRefreshFilters();
}
function calTogglePrio() {
  calPrioOpen = !calPrioOpen;
  renderCalFilters();
}

// ─── ПАНЕЛЬ «КАБИНЕТЫ» (оверлей на телефоне, выпадающий список на ПК) ───
function openCabinetPanel() {
  closeCabinetPanel();
  const mobile = window.innerWidth < 700;
  const btn = document.getElementById('cal-cab-btn');
  const r = btn ? btn.getBoundingClientRect() : { left: 14, bottom: 150 };
  const back = document.createElement('div');
  back.id = 'cal-cab-backdrop';
  back.onclick = closeCabinetPanel;
  back.style.cssText = 'position:fixed;inset:0;z-index:200;background:' + (mobile ? 'rgba(0,0,0,.5)' : 'transparent');
  const panel = document.createElement('div');
  panel.id = 'cal-cab-panel';
  panel.onclick = e => e.stopPropagation();
  panel.style.cssText = mobile
    ? 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:90%;max-width:360px;max-height:80vh;overflow-y:auto;background:var(--s1);border:1px solid var(--b1);border-radius:12px;padding:8px;z-index:201;box-shadow:0 10px 40px rgba(0,0,0,.5)'
    : `position:fixed;left:${Math.min(r.left, window.innerWidth - 340)}px;top:${r.bottom + 6}px;width:320px;max-height:70vh;overflow-y:auto;background:var(--s1);border:1px solid var(--b1);border-radius:12px;padding:8px;z-index:201;box-shadow:0 8px 30px rgba(0,0,0,.4)`;
  back.appendChild(panel);
  document.body.appendChild(back);
  renderCabinetPanel();
}

function closeCabinetPanel() {
  const b = document.getElementById('cal-cab-backdrop');
  if(b) b.remove();
}

function calToggleCabShown(spaceId) {
  if(calShownCabs.has(spaceId)) calShownCabs.delete(spaceId);
  else calShownCabs.add(spaceId);
  calRefreshFilters();
}

function renderCabinetPanel() {
  const panel = document.getElementById('cal-cab-panel');
  if(!panel) return;
  const cabs = calCabinetRubrics();
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px 10px"><span style="font-size:15px;font-weight:600">🗂️ ${t('Кабинеты')}</span><button onclick="closeCabinetPanel()" style="background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;line-height:1">✕</button></div>`;
  cabs.forEach(cab => {
    const sp = spaces.find(s => s.id === cab.spaceId);
    const icon = sp && sp.type === 'family' ? '👨‍👩‍👧' : '🗂️';
    const shown = calShownCabs.has(cab.spaceId);
    html += `<div data-sp="${esc(cab.spaceId)}" onclick="calToggleCabShown(this.dataset.sp)" style="display:flex;align-items:center;gap:8px;padding:12px 8px;cursor:pointer;border-top:1px solid var(--b1)">`;
    html += `<span style="flex:1;font-size:14px;font-weight:500;opacity:${shown?'1':'.7'}">${icon} ${esc(cab.spaceName)}</span>`;
    html += `<span style="font-size:12px;color:${shown?'var(--accent)':'var(--t3)'}">${shown?'✓ '+t('в фильтре'):t('добавить')}</span>`;
    html += `</div>`;
  });
  panel.innerHTML = html;
}

// ─── CARD FILTERING ──────────────────────────
// Ключ пары «кабинет‖рубрика» — различает одинаковые имена рубрик в разных кабинетах
function calCatKey(spaceId, cat) { return spaceId + '||' + (cat || ''); }
function calColor(card) { return (card && calCatColors[calCatKey(card.space_id, card.category)]) || '#666666'; }

// По умолчанию включаем все кабинеты и все рубрики, что встречаются в карточках
function calEnableAll() {
  calEnabledCats = new Set(calAllCards.map(c => calCatKey(c.space_id, c.category)));
}
// Структура для фильтра: список кабинетов, у каждого — его рубрики (из реальных карточек)
function calCabinetRubrics() {
  const map = {};
  calAllCards.forEach(c => {
    if(!map[c.space_id]) map[c.space_id] = new Set();
    map[c.space_id].add(c.category || '');
  });
  return Object.keys(map).map(spaceId => {
    const sp = spaces.find(s => s.id === spaceId);
    const rubrics = [...map[spaceId]].sort().map(name => ({
      name,
      key: calCatKey(spaceId, name),
      color: calCatColors[calCatKey(spaceId, name)] || '#888'
    }));
    return { spaceId, spaceName: sp ? sp.name : 'Кабинет', rubrics };
  });
}

function calPlain(h) { // текст записи без форматирования
  const d = document.createElement('div'); d.innerHTML = h || '';
  return (d.textContent || '').replace(/\s+/g,' ').trim();
}
// Список «событий календаря»: каждая запись со сроком — отдельный пункт на своей дате;
// карточка со своим сроком (не совпадающим с записями) — пункт без записи. Выполненные остаются (_done).
function getCalCards() {
  const hasCabFilter = calShownCabs.size > 0;
  const out = [];
  calAllCards.forEach(c => {
    if(hasCabFilter && !calShownCabs.has(c.space_id)) return;
    if(!calEnabledCats.has(calCatKey(c.space_id, c.category))) return;
    if(calFilterMember !== 'all' && c.assigned_to !== calFilterMember) return;
    if(calFilterPriority !== 'all' && c.priority !== calFilterPriority) return;
    const cardDone = c.status === 'done';
    const ents = (c.entries || []).filter(e => e && e.deadline);
    ents.forEach(e => out.push({ ...c, deadline: e.deadline, _eid: e.id, _etext: calPlain(e.text), _done: !!e.done || cardDone }));
    if(c.deadline && !ents.some(e => e.deadline === c.deadline)) out.push({ ...c, _eid: '', _etext: '', _done: cardDone });
  });
  return out;
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
  const startDow = firstDay.getDay(); // 0=Вс ... 6=Сб — неделя уже начинается с воскресенья

  const todayStr = calTodayStr();
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
    const isSat = (startDow + d - 1) % 7 === 6;
    const dayCards = cardMap[dateStr] || [];
    const hasUrgent = dayCards.some(c=>c.priority==='urgent' && !c._done);
    const hasHigh = dayCards.some(c=>c.priority==='high');

    let bg = isToday ? 'rgba(232,197,106,.1)' : (isSat ? 'rgba(255,255,255,.14)' : 'var(--s2)');
    let border = isToday ? '1px solid var(--accent)' : '1px solid transparent';
    if(hasUrgent) border = '1px solid var(--red)';

    html += `<div style="min-height:72px;background:${bg};border-radius:6px;border:${border};padding:4px;cursor:pointer" onclick="calDayClick('${dateStr}',event)">
      <div style="font-size:12px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--accent)':hasUrgent?'var(--red)':'var(--t2)'};margin-bottom:3px">${d}</div>`;
    html += calHolHtml(dateStr, 'sm');
    html += calEvtHtml(dateStr, 'sm');

    dayCards.slice(0,3).forEach(c => {
      const col = calColor(c);
      const isUrgent = c.priority==='urgent';
      const isHigh = c.priority==='high';
      html += `<div onclick="event.stopPropagation();showCalPopup('${c.id}',event,'${c._eid||''}')" style="${c._done?'opacity:.45;text-decoration:line-through;':''}font-size:10px;background:${hex2rgba(col,.2)};border-left:2px solid ${isUrgent?'var(--red)':isHigh?'var(--accent)':col};border-radius:3px;padding:2px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--t1);cursor:pointer">${isUrgent?'🔥':isHigh?'⚡':''}${esc(c.title)}</div>`;
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
  const sundayOffset = -dow;
  const sunday = new Date(calDate);
  sunday.setDate(calDate.getDate() + sundayOffset);

  const days = [];
  for(let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push(d);
  }

  const fromDate = days[0].toISOString().slice(0,10);
  const toDate = days[6].toISOString().slice(0,10);
  document.getElementById('cal-title').textContent = `${days[0].getDate()} ${CAL_MONTHS_RU[days[0].getMonth()].slice(0,3)} — ${days[6].getDate()} ${CAL_MONTHS_RU[days[6].getMonth()].slice(0,3)}`;

  const todayStr = calTodayStr();
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
    const isSat = d.getDay() === 6;
    const dayCards = cardMap[dateStr] || [];
    const hasUrgent = dayCards.some(c=>c.priority==='urgent' && !c._done);

    html += `<div style="background:${isToday?'rgba(232,197,106,.1)':isSat?'rgba(255,255,255,.14)':'var(--s2)'};border-radius:8px;border:${isToday?'1px solid var(--accent)':hasUrgent?'1px solid var(--red)':'1px solid var(--b1)'};padding:6px;min-height:120px">
      <div style="font-size:11px;color:var(--t3);margin-bottom:2px">${CAL_DAYS_RU[d.getDay()]}</div>
      <div style="font-size:16px;font-weight:700;color:${isToday?'var(--accent)':hasUrgent?'var(--red)':'var(--t1)'};margin-bottom:6px">${d.getDate()}</div>`;
    html += calHolHtml(dateStr, 'md');
    html += calEvtHtml(dateStr, 'md');

    dayCards.forEach(c => {
      const col = calColor(c);
      html += `<div onclick="showCalPopup('${c.id}',event,'${c._eid||''}')" style="${c._done?'opacity:.45;text-decoration:line-through;':''}font-size:11px;background:${hex2rgba(col,.2)};border-left:2px solid ${c.priority==='urgent'?'var(--red)':c.priority==='high'?'var(--accent)':col};border-radius:3px;padding:3px 5px;margin-bottom:3px;cursor:pointer;color:var(--t1)">${c.priority==='urgent'?'🔥':c.priority==='high'?'⚡':''}${esc(c.title.length>18?c.title.slice(0,16)+'…':c.title)}</div>`;
    });

    if(!dayCards.length && !calHolHtml(dateStr,'md') && !calEvtHtml(dateStr,'md')) {
      html += `<div style="font-size:10px;color:var(--t3);text-align:center;margin-top:16px">—</div>`;
    }

    html += '</div>';
  });

  html += '</div>';
  document.getElementById('cal-body').innerHTML = html;
}

function renderCalDay() {
  const d = calDate.getDate();
  const m = calDate.getMonth();
  const y = calDate.getFullYear();
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  document.getElementById('cal-title').textContent = `${d} ${CAL_MONTHS_RU[m]} ${y}`;

  const todayStr = calTodayStr();
  const isToday = dateStr === todayStr;
  const filtered = getCalCards().filter(c => c.deadline === dateStr);

  let html = '';
  html += calHolHtml(dateStr, 'lg');
  html += calEvtHtml(dateStr, 'lg');
  if(!filtered.length) {
    html += `<div style="text-align:center;padding:${html ? 20 : 40}px;color:var(--t3)">
      ${html ? '' : '<div style="font-size:40px;margin-bottom:12px">📅</div>'}
      <div>${html ? 'Карточек на этот день нет' : 'Нет карточек на этот день'}</div>
    </div>`;
  } else {
    // Sort by priority then title
    const sorted = [...filtered].sort((a,b) => {
      const po = {urgent:0,high:1,normal:2};
      return (po[a.priority||'normal']||2) - (po[b.priority||'normal']||2);
    });
    sorted.forEach(c => {
      const col = calColor(c);
      const isUrgent = c.priority==='urgent';
      const isHigh = c.priority==='high';
      html += `<div onclick="showCalPopup('${c.id}',event,'${c._eid||''}')" style="${c._done?'opacity:.55;':''}background:${hex2rgba(col,.15)};border-left:4px solid ${isUrgent?'var(--red)':isHigh?'var(--accent)':col};border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:8px;cursor:pointer">
        <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:4px">${isUrgent?'🔥 ':isHigh?'⚡ ':''}${esc(c.title)}</div>
        ${c._etext?`<div style="font-size:13px;color:var(--t2);margin-bottom:4px;word-break:break-word;${c._done?'text-decoration:line-through':''}">${c._done?'☑':'☐'} ${esc(c._etext)}</div>`:''}
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
function showCalPopup(cardId, event, eid) {
  event.stopPropagation();
  const card = calAllCards.find(c=>c.id===cardId) || cards.find(c=>c.id===cardId); if(!card) return;
  const popup = document.getElementById('cal-popup');
  const col = calColor(card);
  const ent = eid ? (card.entries||[]).find(e=>e.id===eid) : null;
  const dlDate = ent ? ent.deadline : card.deadline;
  const dl = (dlDate && !(ent && ent.done) && card.status!=='done') ? deadlineInfo(dlDate) : null;

  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="font-size:14px;font-weight:700;color:${col};flex:1;padding-right:8px">${card.priority==='urgent'?'🔥 ':card.priority==='high'?'⚡ ':''}${esc(card.title)}</div>
      <button onclick="document.getElementById('cal-popup').style.display='none'" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:16px;flex-shrink:0">✕</button>
    </div>
    ${ent?`<div style="font-size:13px;color:var(--t1);background:var(--s2);border-radius:8px;padding:8px 10px;margin-bottom:8px;word-break:break-word;${ent.done?'text-decoration:line-through;opacity:.6':''}">${ent.done?'☑':'☐'} ${esc(calPlain(ent.text)||'(без текста)')}</div>`:''}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${card.category?`<span style="font-size:11px;background:${hex2rgba(col,.15)};color:${col};padding:2px 8px;border-radius:10px">${esc(card.category)}</span>`:''}
      ${dl?`<span style="font-size:11px;color:${dl.cls==='dl-now'?'var(--red)':'var(--accent)'}">${dl.text}</span>`:''}
      ${card.assigned_to?`<span style="font-size:11px;color:var(--accent)">👤 ${esc(card.assigned_to)}</span>`:''}
    </div>
    <div style="display:flex;gap:6px">
       <button onclick="calOpenCard('${cardId}')" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">Открыть</button>
      <button onclick="calChangeDeadline('${cardId}','${eid||''}')" style="background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:6px;padding:8px 10px;font-size:13px;cursor:pointer">📅</button>
      <button onclick="calToggleDone('${cardId}','${eid||''}')" style="background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:6px;padding:8px 10px;font-size:13px;cursor:pointer">✓</button>
    </div>
  `;

  // Position popup
  const x = event.clientX, y = event.clientY;
  const pw = 280, ph = 200;
  const left = Math.min(x, window.innerWidth - pw - 10);
  const top = Math.min(y + 10, window.innerHeight - ph - 10);
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.display = 'block';

  setTimeout(() => document.addEventListener('click', function h(e) {
    if(!popup.contains(e.target)) { popup.style.display='none'; document.removeEventListener('click',h); }
  }), 100);
}

function calFindCard(cardId) {
  return calAllCards.find(c=>c.id===cardId) || cards.find(c=>c.id===cardId);
}
function calSyncCardEverywhere(card) {
  const i1 = calAllCards.findIndex(c=>c.id===card.id); if(i1!==-1) calAllCards[i1] = card;
  const i2 = cards.findIndex(c=>c.id===card.id); if(i2!==-1) cards[i2] = card;
}

async function calChangeDeadline(cardId, eid) {
  const card = calFindCard(cardId); if(!card) return;
  const ent = eid ? (card.entries||[]).find(e=>e.id===eid) : null;
  const newDate = prompt(ent ? 'Новый срок записи (ГГГГ-ММ-ДД):' : 'Новый дедлайн (ГГГГ-ММ-ДД):', (ent ? ent.deadline : card.deadline) || '');
  if(!newDate) return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { toast('Формат: ГГГГ-ММ-ДД', true); return; }
  if(ent) {
    ent.deadline = newDate;
    const act = (card.entries||[]).filter(x=>!x.done&&x.deadline).map(x=>x.deadline).sort();
    if(act.length) card.deadline = act[0];
  } else card.deadline = newDate;
  calSyncCardEverywhere(card);
  document.getElementById('cal-popup').style.display='none';
  renderCalendar();
  try { await dbUpdate(card); toast('✓ Срок изменён'); } catch(e) { toast('Ошибка', true); }
}

async function calToggleDone(cardId, eid) {
  const card = calFindCard(cardId); if(!card) return;
  const ent = eid ? (card.entries||[]).find(e=>e.id===eid) : null;
  if(ent) {
    if(ent.completions && ent.completions.length) { toast('Эту запись отмечают участники — открой карточку', true); return; }
    ent.done = !ent.done;
    const act = (card.entries||[]).filter(x=>!x.done&&x.deadline).map(x=>x.deadline).sort();
    if(act.length) card.deadline = act[0];
    if(!card.pinned && (card.entries||[]).length>0 && (card.entries||[]).every(x=>x.done)) card.status = 'done';
    else if(!ent.done && card.status === 'done') card.status = 'in_progress';
  } else {
    card.status = card.status === 'done' ? 'in_progress' : 'done';
  }
  calSyncCardEverywhere(card);
  document.getElementById('cal-popup').style.display='none';
  renderCalendar();
  try { await dbUpdate(card); toast((ent ? ent.done : card.status==='done') ? '✓ Выполнено' : '↩ Возвращено'); } catch(e) { toast('Ошибка', true); }
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
  calFromLobby = false; // уходим в карточку, не возвращаемся на лобби
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
(function updateCalBtn() {
  const now = new Date();
  const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
  const dayEl = document.getElementById('cal-day-num');
  const monEl = document.getElementById('cal-month-txt');
  if(dayEl) dayEl.textContent = now.getDate();
  if(monEl) {
    monEl.textContent = '';
    const tMonth = document.createElementNS('http://www.w3.org/2000/svg','tspan');
    tMonth.textContent = months[now.getMonth()] + ' ';
    monEl.appendChild(tMonth);
    const tYear = document.createElementNS('http://www.w3.org/2000/svg','tspan');
    tYear.setAttribute('font-size', '10');
    tYear.textContent = now.getFullYear();
    monEl.appendChild(tYear);
  }
  setTimeout(updateCalBtn, 60000);
})();

// ── Свайп по календарю: влево = следующий период, вправо = предыдущий ──
(function initCalSwipe() {
  const el = document.getElementById('cal-body');
  if(!el) return;
  let sx = 0, sy = 0, st = 0;
  el.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    if(dt > 800) return;                       // слишком долго — не свайп
    if(Math.abs(dx) < 55) return;              // слишком короткий
    if(Math.abs(dx) < Math.abs(dy) * 1.6) return; // это вертикальная прокрутка
    if(dx < 0) calNext(); else calPrev();
  }, { passive: true });
})();
