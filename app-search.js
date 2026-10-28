// ═══ Поиск по карточкам, записям, чатам, файлам и событиям ═══
// Открывается лупой 🔍 (лобби и шапка кабинета). Серверная часть — SQL-функция search_cards.
const SRCH_PREF_KEY = 'mc_search_prefs';
let _srch = { flagOnly: false, scope: 'all', types: { cards: 1, entries: 1, chats: 1, files: 1, events: 1, done: 1 }, timer: null, seq: 0 };

function srchLoadPrefs() {
  try { const p = JSON.parse(localStorage.getItem(SRCH_PREF_KEY) || 'null'); if(p && p.types) _srch.types = { ..._srch.types, ...p.types }; } catch(e) {}
}
function srchSavePrefs() { try { localStorage.setItem(SRCH_PREF_KEY, JSON.stringify({ types: _srch.types })); } catch(e) {} }

function srchInCabinet() { return document.body.classList.contains('in-cabinet') && !!currentSpaceId && spaces.some(s => s.id === currentSpaceId); }
function srchScopeIds() {
  const isFam = s => s.type === 'family' || s.type === 'group';
  if(_srch.scope === 'cab') return [currentSpaceId];
  if(_srch.scope === 'personal') return spaces.filter(s => s.type === 'personal').map(s => s.id);
  if(_srch.scope === 'groups') return spaces.filter(isFam).map(s => s.id);
  return spaces.map(s => s.id);
}

function openSearch() {
  document.getElementById('srch-ov')?.remove();
  srchLoadPrefs();
  _srch.scope = srchInCabinet() ? 'cab' : 'all';
  _srch.flagOnly = false;
  if(!document.getElementById('srch-style')) {
    const st = document.createElement('style');
    st.id = 'srch-style';
    st.textContent = '#srch-ov mark{background:rgba(232,197,106,.35);color:inherit;border-radius:2px;padding:0 1px}@media(min-width:900px){#srch-ov{right:auto!important;width:var(--split-left)}}';
    document.head.appendChild(st);
  }
  const ov = document.createElement('div');
  ov.id = 'srch-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:2500;display:flex;flex-direction:column;padding:max(12px,env(safe-area-inset-top,12px)) 14px 0';
  ov.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <input id="srch-q" type="search" dir="auto" placeholder="Поиск…" autocomplete="off" oninput="srchDebounce()" style="flex:1;background:var(--s2);border:1px solid var(--b1);border-radius:18px;padding:10px 14px;font-size:15px;color:var(--t1);font-family:inherit;outline:none">
      <button onclick="closeSearch()" style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:50%;width:38px;height:38px;font-size:16px;cursor:pointer">✕</button>
    </div>
    <div id="srch-chips" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;flex-shrink:0"></div>
    <div id="srch-filter-wrap" style="margin-bottom:6px">
      <button onclick="srchToggleFilter()" style="background:none;border:none;color:var(--t2);font-size:12px;cursor:pointer;padding:2px 0;font-family:inherit">Фильтр <span id="srch-farrow">▾</span></button>
      <div id="srch-filter" style="display:none;flex-wrap:wrap;gap:6px;margin-top:6px"></div>
    </div>
    <div id="srch-info" style="font-size:12px;color:var(--t3);margin-bottom:4px"></div>
    <div id="srch-res" style="flex:1;min-height:0;overflow-y:auto;padding-bottom:calc(16px + var(--safe,0px))"></div>`;
  document.body.appendChild(ov);
  srchRenderChips(); srchRenderFilter();
  document.getElementById('srch-res').innerHTML = '<div style="text-align:center;padding:40px 10px;color:var(--t3);font-size:13px">Введи минимум 2 буквы</div>';
  setTimeout(() => document.getElementById('srch-q')?.focus(), 80);
}
function closeSearch() { document.getElementById('srch-ov')?.remove(); }

function srchRenderChips() {
  const box = document.getElementById('srch-chips'); if(!box) return;
  const chips = [];
  if(srchInCabinet()) chips.push(['cab', 'Этот кабинет']);
  chips.push(['all', 'Везде'], ['personal', 'Личное'], ['groups', 'Группы']);
  box.innerHTML = chips.map(([k, l]) => `<button onclick="srchSetScope('${k}')" style="flex-shrink:0;border-radius:14px;padding:5px 12px;font-size:13px;cursor:pointer;font-family:inherit;border:1px solid var(--b1);${_srch.scope === k ? 'background:var(--accent);color:#0f0f0f;font-weight:700' : 'background:transparent;color:var(--t2)'}">${l}</button>`).join('');
}
function srchSetScope(k) { _srch.scope = k; srchRenderChips(); srchRun(); }
function srchRenderFilter() {
  const box = document.getElementById('srch-filter'); if(!box) return;
  const items = [['cards', 'Карточки'], ['entries', 'Записи'], ['chats', 'Чаты'], ['files', 'Файлы'], ['events', 'События'], ['done', 'Завершённые']];
  const flagBtn = `<button onclick="srchToggleFlag()" style="border-radius:14px;padding:4px 11px;font-size:12px;cursor:pointer;font-family:inherit;border:1px solid ${_srch.flagOnly ? 'var(--accent)' : 'var(--b1)'};${_srch.flagOnly ? 'background:var(--accent);color:#0f0f0f;font-weight:700' : 'background:transparent;color:var(--t2)'}">🚩 Только отмеченные</button>`;
  box.innerHTML = flagBtn + items.map(([k, l]) => `<button onclick="srchToggleType('${k}')" style="border-radius:14px;padding:4px 11px;font-size:12px;cursor:pointer;font-family:inherit;border:1px solid var(--b1);${_srch.types[k] ? 'background:rgba(232,197,106,.2);color:var(--accent)' : 'background:transparent;color:var(--t3);text-decoration:line-through'}">${l}</button>`).join('');
}
function srchToggleFilter() {
  const f = document.getElementById('srch-filter'); const open = f.style.display === 'none';
  f.style.display = open ? 'flex' : 'none';
  document.getElementById('srch-farrow').textContent = open ? '▴' : '▾';
}
function srchToggleFlag() { _srch.flagOnly = !_srch.flagOnly; srchRenderFilter(); srchRun(); }
function srchToggleType(k) { _srch.types[k] = _srch.types[k] ? 0 : 1; srchSavePrefs(); srchRenderFilter(); srchRun(); }
function srchDebounce() { clearTimeout(_srch.timer); _srch.timer = setTimeout(srchRun, 350); }

// ── разбор текста ──
function srchPlain(t) { return String(typeof stripTags === 'function' ? stripTags(t || '') : (t || '')).replace(/\s+/g, ' ').trim(); }
function srchSnip(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if(i < 0) return esc(text.slice(0, 90));
  const s = Math.max(0, i - 30), e = Math.min(text.length, i + q.length + 60);
  return (s > 0 ? '…' : '') + esc(text.slice(s, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length, e)) + (e < text.length ? '…' : '');
}
function srchCardHits(c, q) {
  const T = _srch.types, ql = q.toLowerCase(), has = t => String(t || '').toLowerCase().includes(ql);
  const isChat = Array.isArray(c.chatParticipants), hits = [];
  if(_srch.flagOnly) { // только отмеченные записи (в личных кабинетах)
    (c.entries || []).forEach(e => {
      if(!e || !e.flag) return;
      const txt = srchPlain(e.text);
      if(q && !has(txt)) return;
      hits.push({ label: '🚩 запись', text: txt || '(без текста)', entryId: e.id });
    });
    return { hits, titleHit: false };
  }
  let titleHit = false;
  if(T.cards) {
    if(has(c.title)) { titleHit = true; hits.push({ label: 'название', text: c.title }); }
    const body = srchPlain(c.body); if(body && has(body)) hits.push({ label: 'текст', text: body });
    if(has(c.category)) hits.push({ label: 'рубрика', text: c.category });
  }
  (c.entries || []).forEach(e => {
    if(!e) return;
    const who = e.sessionCreator ? (typeof aliasedName === 'function' ? aliasedName(e.sessionCreator) : e.sessionCreator) : '';
    const txt = srchPlain(e.text);
    if(txt && has(txt) && (isChat ? T.chats : T.entries)) hits.push({ label: isChat ? 'сообщение' + (who ? ' · ' + who : '') : 'запись', text: txt, entryId: e.id });
    const note = srchPlain(e.sessionNote);
    if(isChat && T.chats && note && has(note)) hits.push({ label: 'сообщение' + (who ? ' · ' + who : ''), text: note, entryId: e.id });
    if(T.files) [...(e.attachments || []), ...(e.sessionAtts || [])].forEach(a => { if(a && has(a.name)) hits.push({ label: 'файл', text: a.name, entryId: e.id }); });
  });
  if(T.files) (c.attachments || []).forEach(a => { if(a && has(a.name)) hits.push({ label: 'файл', text: a.name }); });
  return { hits, titleHit };
}

// ── запуск поиска ──
async function srchRun() {
  const q = (document.getElementById('srch-q')?.value || '').trim();
  const res = document.getElementById('srch-res'), info = document.getElementById('srch-info');
  if(!res) return;
  if(q.length < 2 && !_srch.flagOnly) { info.textContent = ''; res.innerHTML = '<div style="text-align:center;padding:40px 10px;color:var(--t3);font-size:13px">Введи минимум 2 буквы</div>'; return; }
  const my = ++_srch.seq;
  info.textContent = 'Ищу…';
  const ids = srchScopeIds();
  const like = q.replace(/[\\%_]/g, m => '\\' + m);
  const useFlagRpc = _srch.flagOnly && q.length < 2;
  let cardsRaw = [], evsRaw = [];
  try {
    if(!navigator.onLine) throw new Error('offline');
    const [r1, r2] = await Promise.all([
      useFlagRpc ? sb.rpc('search_flagged', { space_ids: ids, lim: 100 }) : sb.rpc('search_cards', { q: like, space_ids: ids, lim: 60 }),
      (_srch.types.events && !_srch.flagOnly) ? sb.from('events').select('*').in('space_id', ids).or(`title.ilike."%${like.replace(/"/g, '')}%",note.ilike."%${like.replace(/"/g, '')}%"`).limit(30) : Promise.resolve({ data: [] })
    ]);
    if(r1.error) throw r1.error;
    cardsRaw = r1.data || []; evsRaw = (r2 && r2.data) || [];
  } catch(e) {
    try { // офлайн или функции ещё нет — ищем в том, что сохранено на устройстве
      cardsRaw = (await local.getAll('cards')).filter(c => ids.includes(c.space_id));
      evsRaw = (_srch.types.events && !_srch.flagOnly) ? (await local.getAll('events')).filter(ev => ids.includes(ev.space_id) && (String(ev.title || '').toLowerCase().includes(q.toLowerCase()) || String(ev.note || '').toLowerCase().includes(q.toLowerCase()))) : [];
    } catch(_) {}
  }
  if(my !== _srch.seq) return; // пришёл более новый запрос
  const rows = [];
  cardsRaw.forEach(c => {
    if(c.status === 'done' && !_srch.types.done) return;
    if(_srch.flagOnly && Array.isArray(c.chatParticipants)) return;
    const { hits, titleHit } = srchCardHits(c, q);
    if(hits.length) rows.push({ c, hits, titleHit });
  });
  rows.sort((a, b) => (b.titleHit - a.titleHit) || String(b.c.created_at || '').localeCompare(String(a.c.created_at || '')));
  const spName = id => { const s = spaces.find(x => x.id === id); return s ? (s.type === 'personal' ? 'Личное' : s.name) : ''; };
  const total = rows.length + evsRaw.length;
  info.textContent = total ? 'Найдено: ' + total : '';
  if(!total) { res.innerHTML = '<div style="text-align:center;padding:40px 10px;color:var(--t3);font-size:13px">Ничего не найдено</div>'; return; }
  window._srchRows = rows; window._srchEvs = evsRaw;
  const cardHtml = rows.map((r, i) => `<div onclick="srchOpenRow(${i})" style="padding:10px 4px;border-top:1px solid var(--b1);cursor:pointer;${r.c.status === 'done' ? 'opacity:.6' : ''}">
      <div style="font-size:14px;font-weight:600;word-break:break-word" dir="auto">${esc(r.c.title || '')}</div>
      <div style="font-size:11px;color:var(--t3);margin:1px 0 3px">${esc(spName(r.c.space_id))}${r.c.category ? ' · ' + esc(r.c.category) : ''}${r.c.status === 'done' ? ' · завершена' : ''}</div>
      ${r.hits.slice(0, 3).map(h => `<div style="font-size:13px;color:var(--t2);word-break:break-word" dir="auto"><span style="font-size:10px;color:var(--t3)">${esc(h.label)}</span> ${q ? srchSnip(h.text, q) : esc(h.text.slice(0, 120))}</div>`).join('')}
      ${r.hits.length > 3 ? `<div style="font-size:11px;color:var(--t3)">…и ещё ${r.hits.length - 3}</div>` : ''}
    </div>`).join('');
  const evHtml = evsRaw.length ? `<div style="font-size:12px;color:var(--accent);font-weight:700;margin:12px 0 2px">События</div>` + evsRaw.map((ev, i) => `<div onclick="srchOpenEvent(${i})" style="padding:10px 4px;border-top:1px solid var(--b1);cursor:pointer">
      <div style="font-size:14px;font-weight:600;word-break:break-word" dir="auto">${srchSnip(ev.title || '', q)}</div>
      <div style="font-size:11px;color:var(--t3)">${esc(ev.event_date || '')}${ev.event_time ? ' · ' + esc(String(ev.event_time).slice(0, 5)) : ''} · ${esc(spName(ev.space_id))}</div></div>`).join('') : '';
  res.innerHTML = cardHtml + evHtml;
}

// ── открыть найденное ──
async function srchOpenRow(i) {
  const r = (window._srchRows || [])[i]; if(!r) return;
  const entryId = (r.hits.find(h => h.entryId) || {}).entryId;
  closeSearch();
  if(!(document.body.classList.contains('in-cabinet') && currentSpaceId === r.c.space_id)) await setCurrentSpace(r.c.space_id, true);
  setTimeout(() => openView(r.c.id), 300);
  if(entryId) setTimeout(() => {
    const el = document.querySelector('#view-ov .swipe-content[data-entryid="' + String(entryId).replace(/"/g, '') + '"]');
    if(el) { el.scrollIntoView({ block: 'center' }); el.style.background = 'rgba(232,197,106,.28)'; el.style.borderRadius = '6px'; setTimeout(() => { el.style.background = 'transparent'; }, 3000); }
  }, 900);
}
function srchOpenEvent(i) {
  const ev = (window._srchEvs || [])[i]; if(!ev) return;
  closeSearch();
  if(typeof calAllEvents !== 'undefined' && !calAllEvents.find(e => e.id === ev.id)) calAllEvents.push(ev);
  if(typeof openEventModal === 'function') openEventModal(ev.event_date, ev.id);
}
