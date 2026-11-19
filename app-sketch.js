// ═══════════════════════════════════════════
//  СКЕТЧ-ЛИСТ + СТАРТОВЫЙ ЭКРАН (этап 1, 19 ноября)
//  Только для пользователей, у которых в таблице mc_features стоит sketch = true (SQL: sql-sketch.sql).
//  Стартовый экран: две большие кнопки «✏️ Скетч-лист» и «🗂️ Карточки», у каждой своё приветствие.
//  Телефон вертикально — кнопки друг под другом; повёрнутый телефон и ПК — рядом.
//  Скетч-лист: «Мои листы» + редактор (Fabric.js 5.3.0 с CDN, грузится только при открытии).
//  Листы: IndexedDB «mc-sketch» на устройстве + таблица sketches в Supabase (видит только владелец).
//  Отправка: в карточку личного кабинета (PNG как запись), PNG / JPG / SVG / PDF, «Поделиться».
// ═══════════════════════════════════════════
const SK_FABRIC = 'https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js';
const SK_COLORS = ['#1f1f1f', '#ffffff', '#e86060', '#e88a3a', '#e8c56a', '#5bb87a', '#5b9ee8', '#a07de8', '#8d6e63', '#9e9e9e'];
let SK = null; // открытый лист: {id, title, links, created_at, canvas, hist, redo, tool, ...}
let _skStartShown = false, _skBootSearch = (typeof location !== 'undefined' ? location.search : '');

// ─── доступ ───
function skFeat() {
  try { return JSON.parse(localStorage.getItem('mc_feat_' + (currentUser && currentUser.id)) || '{}') || {}; } catch(e) { return {}; }
}
function skAllowed() { return !!(typeof currentUser !== 'undefined' && currentUser && skFeat().sketch); }
async function skCheckAllowed() {
  if(typeof currentUser === 'undefined' || !currentUser || typeof sb === 'undefined' || !navigator.onLine) return skAllowed();
  try {
    const q = sb.from('mc_features').select('sketch,d3').eq('user_id', currentUser.id).maybeSingle();
    const r = await Promise.race([q, new Promise(ok => setTimeout(() => ok(null), 3000))]);
    if(r && !r.error) localStorage.setItem('mc_feat_' + currentUser.id, JSON.stringify(r.data || {}));
  } catch(e) {}
  return skAllowed();
}

// ─── стили ───
function skCss() {
  if(document.getElementById('sk-css')) return;
  const st = document.createElement('style'); st.id = 'sk-css';
  st.textContent = `
#mc-start{position:fixed;inset:0;z-index:1500;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:max(20px,env(safe-area-inset-top,20px)) 18px calc(20px + var(--safe));box-sizing:border-box;transition:opacity .25s}
#mc-start.out{opacity:0;pointer-events:none}
.mcs-wrap{display:flex;flex-direction:column;gap:16px;width:100%;max-width:440px;height:100%;max-height:640px}
.mcs-btn{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;border-radius:24px;border:1px solid var(--b1);background:var(--s2);color:var(--t1);cursor:pointer;padding:22px 18px;font-family:inherit;position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform .12s}
.mcs-btn:active{transform:scale(.98)}
.mcs-btn.sk{background:linear-gradient(150deg,rgba(232,197,106,.22),var(--s2) 62%);border-color:rgba(232,197,106,.45)}
.mcs-ic{font-size:44px;line-height:1}
.mcs-t{font-size:22px;font-weight:700}
.mcs-g{font-size:14px;color:var(--t2);line-height:1.45;max-width:300px}
.mcs-g b{color:var(--t1);font-weight:600}
.mcs-sm{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.mcs-sm span{font-size:12px;padding:6px 12px;border-radius:14px;border:1px solid var(--b1);background:rgba(0,0,0,.25);color:var(--t2)}
.mcs-sm span.gold{color:var(--accent);border-color:rgba(232,197,106,.45)}
@media (orientation:landscape),(min-width:900px){.mcs-wrap{flex-direction:row;max-width:900px;max-height:440px}}
#sk-ov{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;color:var(--t1)}
.sk-hd{display:flex;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top,8px)) 10px 8px;border-bottom:1px solid var(--b1);background:var(--s1);flex:none}
.sk-ib{min-width:36px;height:36px;border-radius:10px;border:1px solid var(--b1);background:var(--s2);color:var(--t1);font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0 9px;font-family:inherit;white-space:nowrap;flex:none}
.sk-ib:disabled{opacity:.35;cursor:default}
.sk-ib.gold{border-color:var(--accent);color:var(--accent)}
.sk-ib.solid{background:var(--accent);border-color:var(--accent);color:#0f0f0f;font-weight:700}
.sk-title{flex:1;min-width:0;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--t1);font-size:16px;font-weight:600;padding:6px 8px;font-family:inherit}
.sk-title:focus{border-color:var(--b1);outline:none;background:var(--s2)}
.sk-st{font-size:11px;color:var(--t3);white-space:nowrap;flex:none}
.sk-body{flex:1;min-height:0;display:flex;overflow:hidden}
.sk-tools{flex:none;display:flex;flex-direction:column;gap:4px;padding:8px 6px;background:var(--s1);border-right:1px solid var(--b1);overflow-y:auto}
.sk-tool{width:40px;height:40px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--t1);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;font-family:inherit;padding:0}
.sk-tool.on{background:rgba(232,197,106,.16);border-color:var(--accent)}
.sk-tool svg{display:block}
.sk-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.sk-props{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--b1);background:var(--s1);overflow-x:auto;scrollbar-width:none}
.sk-props::-webkit-scrollbar{display:none}
.sk-lb{font-size:11px;color:var(--t3);flex:none}
.sk-sw{width:22px;height:22px;border-radius:50%;border:2px solid var(--b1);cursor:pointer;flex:none;box-sizing:border-box;padding:0}
.sk-sw.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--bg) inset}
.sk-sw.none{background:repeating-linear-gradient(45deg,var(--s2) 0 4px,var(--e86060,#e86060) 4px 5px)}
.sk-sep{width:1px;height:22px;background:var(--b1);flex:none}
.sk-props input[type=range]{width:90px;flex:none;accent-color:var(--accent)}
.sk-props input[type=color]{width:26px;height:26px;border:none;background:none;padding:0;flex:none;cursor:pointer}
.sk-stage{flex:1;min-height:0;position:relative;overflow:hidden;background-color:#f6f3ec;touch-action:none}
.sk-stage .canvas-container{position:absolute!important;inset:0}
.sk-grid{position:absolute;inset:0;pointer-events:none}
.sk-zoom{position:absolute;right:10px;bottom:10px;display:flex;gap:4px;z-index:3}
.sk-zoom button{height:32px;min-width:32px;border-radius:9px;border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,.92);color:#333;font-size:13px;cursor:pointer;font-family:inherit;padding:0 8px}
.sk-menu{position:fixed;z-index:2001;background:var(--s1);border:1px solid var(--b1);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.55);padding:6px;min-width:210px}
.sk-menu button{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;color:var(--t1);font-size:14px;padding:10px 12px;border-radius:8px;cursor:pointer;text-align:left;font-family:inherit}
.sk-menu button:hover{background:var(--s2)}
.sk-list{flex:1;min-height:0;overflow-y:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;align-content:start}
.sk-card{background:var(--s2);border:1px solid var(--b1);border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;position:relative}
.sk-card .th{aspect-ratio:4/3;background:#f6f3ec center/contain no-repeat}
.sk-card .nm{padding:8px 10px 2px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sk-card .dt{padding:0 10px 9px;font-size:11px;color:var(--t3)}
.sk-card .mn{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(15,15,15,.6);color:#fff;font-size:15px;cursor:pointer}
.sk-card.new{align-items:center;justify-content:center;gap:6px;min-height:170px;border-style:dashed;color:var(--accent);font-weight:600}
.sk-card.new b{font-size:34px;font-weight:400}
.sk-empty{grid-column:1/-1;text-align:center;color:var(--t3);padding:30px 10px;font-size:14px;line-height:1.5}
#sk-send .row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid transparent}
#sk-send .row:hover{background:var(--s2);border-color:var(--b1)}
#sk-send .chip{padding:5px 12px;border-radius:14px;font-size:12px;border:1px solid var(--b1);color:var(--t2);cursor:pointer;white-space:nowrap;background:none;font-family:inherit}
#sk-send .chip.on{background:rgba(232,197,106,.16);border-color:var(--accent);color:var(--accent)}
@media (max-width:699px){
  .sk-body{flex-direction:column-reverse}
  .sk-tools{flex-direction:row;border-right:none;border-top:1px solid var(--b1);overflow-x:auto;overflow-y:hidden;padding:6px 8px calc(6px + var(--safe));scrollbar-width:none}
  .sk-tools::-webkit-scrollbar{display:none}
  .sk-hide-ph{display:none!important}
  .sk-list{grid-template-columns:repeat(2,1fr);padding:10px;gap:10px}
}`;
  document.head.appendChild(st);
}

// ─── хранение на устройстве (IndexedDB) ───
let _skDb = null;
function skDb() {
  if(_skDb) return _skDb;
  _skDb = new Promise((ok, bad) => {
    const r = indexedDB.open('mc-sketch', 1);
    r.onupgradeneeded = () => { if(!r.result.objectStoreNames.contains('sheets')) r.result.createObjectStore('sheets', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
  });
  return _skDb;
}
async function skIdb(mode, fn) {
  const db = await skDb();
  return new Promise((ok, bad) => {
    const tx = db.transaction('sheets', mode), st = tx.objectStore('sheets');
    let res; const rq = fn(st); if(rq) rq.onsuccess = () => { res = rq.result; };
    tx.oncomplete = () => ok(res); tx.onerror = () => bad(tx.error);
  });
}
const skLocalAll = () => skIdb('readonly', st => st.getAll()).then(a => a || []).catch(() => []);
const skLocalGet = id => skIdb('readonly', st => st.get(id)).catch(() => null);
const skLocalPut = rec => skIdb('readwrite', st => st.put(rec)).catch(e => console.log('sk idb', e));
const skLocalDel = id => skIdb('readwrite', st => st.delete(id)).catch(() => {});
function skNewId() {
  try { if(crypto.randomUUID) return crypto.randomUUID(); } catch(e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}

// ─── облако (таблица sketches) ───
let _skPushT = {};
async function skPush(rec) { // отправить лист в облако; при ошибке остаётся пометка dirty
  if(typeof sb === 'undefined' || !navigator.onLine) return false;
  try {
    const { error } = await sb.from('sketches').upsert({ id: rec.id, title: rec.title, data: rec.data, thumb: rec.thumb, links: rec.links || [], updated_at: rec.updated_at });
    if(error) throw error;
    const cur = await skLocalGet(rec.id);
    if(cur && cur.updated_at === rec.updated_at) { cur.dirty = false; await skLocalPut(cur); }
    return true;
  } catch(e) { console.log('sketch push', e.message || e); return false; }
}
function skPushLater(rec, ms) {
  clearTimeout(_skPushT[rec.id]);
  _skPushT[rec.id] = setTimeout(async () => { const ok = await skPush(rec); skSetStatus(ok ? '☁ сохранено' : '● на устройстве'); }, ms || 1500);
}
async function skSync() { // сверка списка с облаком: новое из облака — вниз, несохранённое — вверх
  const local = await skLocalAll();
  if(typeof sb === 'undefined' || !navigator.onLine) return local;
  try {
    const { data, error } = await sb.from('sketches').select('id,title,thumb,links,updated_at,created_at').order('updated_at', { ascending: false });
    if(error) throw error;
    const byId = new Map(local.map(r => [r.id, r]));
    for(const s of data || []) {
      const l = byId.get(s.id);
      if(!l) await skLocalPut({ ...s, data: null, remote: true });
      else if(!l.dirty && String(s.updated_at) > String(l.updated_at)) await skLocalPut({ ...l, ...s, data: null, remote: true });
    }
    const ids = new Set((data || []).map(s => s.id));
    for(const l of local) {
      if(l.dirty) await skPush(l);
      else if(!ids.has(l.id) && !l.remote && l.pushedOnce) await skLocalDel(l.id); // удалён на другом устройстве
    }
  } catch(e) { console.log('sketch sync', e.message || e); }
  return skLocalAll();
}
async function skLoadFull(id) { // лист целиком (если на устройстве только описание — догружаем из облака)
  let rec = await skLocalGet(id);
  if(rec && rec.data) return rec;
  if(typeof sb !== 'undefined' && navigator.onLine) {
    const { data } = await sb.from('sketches').select('*').eq('id', id).maybeSingle();
    if(data) { rec = { ...data, remote: false, pushedOnce: true, dirty: false }; await skLocalPut(rec); return rec; }
  }
  return rec;
}

// ─── СТАРТОВЫЙ ЭКРАН ───
function skWhen(ts) {
  const d = new Date(ts); if(isNaN(d)) return '';
  const now = new Date(), t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const day = 864e5, d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if(d.getTime() >= d0) return 'сегодня в ' + t;
  if(d.getTime() >= d0 - day) return 'вчера в ' + t;
  const M = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return d.getDate() + ' ' + M[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}
function skEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function skCardsInfo() { // для приветствия у кнопки «Карточки»
  let all = [];
  try { if(typeof local !== 'undefined' && local.getAll) all = await local.getAll('cards') || []; } catch(e) {}
  if(!all.length && typeof cards !== 'undefined') all = cards || [];
  const td = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);
  let due = 0;
  all.forEach(c => {
    if(c.status === 'done') return;
    if(String(c.deadline || '').startsWith(td)) due++;
    (c.entries || []).forEach(e => { if(!e.done && String(e.deadline || '').startsWith(td)) due++; });
  });
  let unread = 0;
  try { Object.values(typeof spacesUnreadCounts !== 'undefined' ? spacesUnreadCounts : {}).forEach(n => { unread += +n || 0; }); } catch(e) {}
  return { count: all.length, due, unread };
}
function skPlural(n, a, b, c) { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); }
async function mcStartShow() {
  if(!skAllowed()) return;
  skCss();
  document.getElementById('mc-start')?.remove();
  const list = (await skLocalAll()).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const last = list[0], ci = await skCardsInfo();
  const h = new Date().getHours();
  const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = (currentUser && currentUser.display_name) ? String(currentUser.display_name).split(' ')[0] : '';
  let skG, skSm = '';
  if(!last) skG = 'Нарисуй свой первый эскиз — идеи любят, когда их ловят сразу ✨';
  else if(Date.now() - new Date(last.updated_at).getTime() > 7 * 864e5) {
    skG = 'Давно не было новых эскизов — нарисуем что-нибудь? 🎨';
    skSm = `<span class="gold" data-act="new">＋ Новый лист</span><span data-act="list">Все листы · ${list.length}</span>`;
  } else {
    skG = `Продолжим <b>«${skEsc(last.title || 'Без названия')}»</b>?<br><span style="font-size:12px;color:var(--t3)">изменён ${skWhen(last.updated_at)}</span>`;
    skSm = `<span class="gold" data-act="new">＋ Новый лист</span><span data-act="list">Все листы · ${list.length}</span>`;
  }
  let cdG;
  if(!ci.count) cdG = 'Давай внесём твою первую запись — с неё всё и начнётся 🌱';
  else {
    const bits = [];
    if(ci.due) bits.push('сегодня ' + skPlural(ci.due, 'дело', 'дела', 'дел') + ' со сроком');
    if(ci.unread) bits.push(skPlural(ci.unread, 'новое сообщение', 'новых сообщения', 'новых сообщений'));
    cdG = `${hi}${name ? ', ' + skEsc(name) : ''}!<br>` + (bits.length ? bits.join(' · ').replace(/^./, c => c.toUpperCase()) : 'Сегодня спокойно — можно спланировать что-нибудь новое');
  }
  const div = document.createElement('div');
  div.id = 'mc-start';
  div.innerHTML = `<div class="mcs-wrap">
    <button class="mcs-btn sk" data-act="${last && skSm && !/Давно/.test(skG) ? 'last' : (last ? 'list' : 'new')}"><span class="mcs-ic">✏️</span><span class="mcs-t">Скетч-лист</span><span class="mcs-g">${skG}</span>${skSm ? `<span class="mcs-sm">${skSm}</span>` : ''}</button>
    <button class="mcs-btn cd" data-act="cards"><span class="mcs-ic">🗂️</span><span class="mcs-t">Карточки</span><span class="mcs-g">${cdG}</span></button>
  </div>`;
  div.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if(!t) return;
    e.stopPropagation();
    const a = t.dataset.act;
    mcStartHide();
    if(a === 'new') skOpen('new');
    else if(a === 'last' && last) skOpen(last.id);
    else if(a === 'list') skOpen();
  });
  document.body.appendChild(div);
}
function mcStartHide() {
  const el = document.getElementById('mc-start'); if(!el) return;
  el.classList.add('out'); setTimeout(() => el.remove(), 260);
}

// после обычного запуска (лобби, без ссылок из уведомлений) — стартовый экран, один раз за запуск
(function skHookStart() {
  if(typeof initSpaces !== 'function') return;
  const orig = initSpaces;
  initSpaces = async function() {
    const r = await orig.apply(this, arguments);
    try {
      const ok = await skCheckAllowed();
      skLobbyButton();
      const plain = !_skBootSearch || !/(space|openCard|openSpace|showEv|showDay|showDue|showReq|evId)=/.test(_skBootSearch);
      const inLobby = document.body.classList.contains('in-lobby') && !(typeof currentSpace !== 'undefined' && currentSpace);
      if(ok && plain && inLobby && !_skStartShown && !document.querySelector('.overlay.on')) { _skStartShown = true; mcStartShow(); }
    } catch(e) { console.log('start screen', e); }
    return r;
  };
})();
function skLobbyButton() { // кнопка «✏️ Скетч-лист» в строке быстрых кнопок лобби
  const q = document.getElementById('lobby-quick'); if(!q) return;
  const ex = document.getElementById('lobby-sk-btn');
  if(!skAllowed()) { ex?.remove(); return; }
  if(ex) return;
  const b = document.createElement('button');
  b.className = 'lobby-pill'; b.id = 'lobby-sk-btn'; b.textContent = '✏️ Скетч-лист';
  b.onclick = () => skOpen();
  q.insertBefore(b, q.firstChild);
}

// ─── ОКНО СКЕТЧ-ЛИСТА ───
function skLoadFabric() {
  if(window.fabric) return Promise.resolve();
  if(window._skFabP) return window._skFabP;
  window._skFabP = new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = SK_FABRIC;
    s.onload = () => window.fabric ? ok() : bad(new Error('fabric'));
    s.onerror = () => { window._skFabP = null; bad(new Error('Нет связи: редактор не загрузился')); };
    document.head.appendChild(s);
  });
  return window._skFabP;
}
function skOv() {
  skCss();
  let ov = document.getElementById('sk-ov');
  if(!ov) {
    ov = document.createElement('div'); ov.id = 'sk-ov';
    ov.setAttribute('style', 'z-index:2000'); // общий «назад» закрывает такие окна
    document.body.appendChild(ov);
    new MutationObserver((m, obs) => { if(!document.body.contains(ov)) { obs.disconnect(); skFlush(); SK = null; } }).observe(document.body, { childList: true });
  }
  return ov;
}
async function skOpen(id) { // без id — список; 'new' — новый лист; иначе — открыть лист
  if(!skAllowed()) { toast('Скетч-лист недоступен', true); return; }
  mcStartHide();
  if(id === 'new') return skCreate();
  if(id) return skEdit(id);
  return skShowList();
}
function skClose() { skFlush(); SK = null; document.getElementById('sk-ov')?.remove(); }

// ─── список листов ───
async function skShowList() {
  skFlush(); SK = null;
  const ov = skOv();
  ov.innerHTML = `<div class="sk-hd"><span style="font-size:18px;font-weight:700;flex:1">✏️ Мои листы</span><span class="sk-st" id="sk-sync">${navigator.onLine ? 'сверяю…' : 'без связи'}</span><button class="sk-ib" onclick="skClose()" aria-label="Закрыть">✕</button></div><div class="sk-list" id="sk-grid"></div>`;
  const paint = list => {
    const g = document.getElementById('sk-grid'); if(!g) return;
    list.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    g.innerHTML = `<div class="sk-card new" onclick="skCreate()"><b>＋</b>Новый лист</div>` + (list.length ? list.map(r => `
      <div class="sk-card" data-id="${skEsc(r.id)}"><div class="th" style="background-image:${r.thumb ? `url('${r.thumb}')` : 'none'}"></div>
      <div class="nm">${skEsc(r.title || 'Без названия')}</div><div class="dt">${skWhen(r.updated_at)}${r.dirty ? ' · ● не в облаке' : ''}</div>
      <button class="mn" data-mn="${skEsc(r.id)}" aria-label="Ещё">⋯</button></div>`).join('') : `<div class="sk-empty">Здесь будут твои эскизы.<br>Нажми «＋ Новый лист», чтобы начать.</div>`);
    g.onclick = e => {
      const mn = e.target.closest('[data-mn]');
      if(mn) { e.stopPropagation(); skCardMenu(mn.dataset.mn, mn); return; }
      const c = e.target.closest('.sk-card[data-id]'); if(c) skEdit(c.dataset.id);
    };
  };
  paint(await skLocalAll());
  const synced = await skSync();
  if(document.getElementById('sk-grid')) { paint(synced); const s = document.getElementById('sk-sync'); if(s) s.textContent = navigator.onLine ? '☁ в облаке' : 'без связи'; }
}
function skMenu(anchor, items) { // маленькое меню под кнопкой: items = [[текст, функция], …]
  document.getElementById('sk-menu-bk')?.remove();
  const bk = document.createElement('div'); bk.id = 'sk-menu-bk';
  bk.setAttribute('style', 'position:fixed;inset:0;z-index:2001');
  const m = document.createElement('div'); m.className = 'sk-menu';
  items.forEach(([t, fn]) => { const b = document.createElement('button'); b.innerHTML = t; b.onclick = ev => { ev.stopPropagation(); bk.remove(); fn(); }; m.appendChild(b); });
  bk.appendChild(m); bk.onclick = () => bk.remove();
  document.body.appendChild(bk);
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, hgt = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  m.style.top = (r.bottom + 6 + hgt > innerHeight ? Math.max(8, r.top - hgt - 6) : r.bottom + 6) + 'px';
}
function skCardMenu(id, anchor) {
  skMenu(anchor, [
    ['✏️ Открыть', () => skEdit(id)],
    ['🔤 Переименовать', () => skRename(id)],
    ['📑 Сделать копию', () => skDuplicateSheet(id)],
    ['<span style="color:var(--red)">🗑 Удалить</span>', () => skDelete(id)]
  ]);
}
async function skRename(id) {
  const rec = await skLocalGet(id); if(!rec) return;
  const t = prompt('Название листа', rec.title || ''); if(t == null) return;
  rec.title = t.trim() || 'Без названия'; rec.updated_at = new Date().toISOString(); rec.dirty = true;
  await skLocalPut(rec); skPushLater(rec, 50);
  skShowList();
}
async function skDuplicateSheet(id) {
  const rec = await skLoadFull(id); if(!rec) return;
  const now = new Date().toISOString();
  const cp = { ...rec, id: skNewId(), title: (rec.title || 'Без названия') + ' (копия)', links: [], created_at: now, updated_at: now, dirty: true, remote: false, pushedOnce: false };
  await skLocalPut(cp); skPushLater(cp, 50);
  skShowList();
}
async function skDelete(id) {
  const rec = await skLocalGet(id);
  if(!confirm('Удалить лист «' + ((rec && rec.title) || 'Без названия') + '»? Его нельзя будет вернуть.')) return;
  await skLocalDel(id);
  if(typeof sb !== 'undefined' && navigator.onLine) { try { await sb.from('sketches').delete().eq('id', id); } catch(e) {} }
  toast('🗑 Лист удалён');
  skShowList();
}
async function skCreate() {
  const now = new Date().toISOString();
  const n = (await skLocalAll()).length + 1;
  const rec = { id: skNewId(), title: 'Эскиз ' + n, data: null, thumb: '', links: [], created_at: now, updated_at: now, dirty: true };
  await skLocalPut(rec);
  return skEdit(rec.id, rec);
}

// ─── редактор ───
const SK_TOOLS = [
  ['sel', 'Выбор', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z" fill="currentColor"/></svg>'],
  ['hand', 'Рука — двигать лист', '✋'],
  ['pen', 'Карандаш', '✏️'],
  ['line', 'Линия', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 20L20 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'],
  ['arrow', 'Стрелка', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 20L19 5M11 5h8v8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
  ['rect', 'Прямоугольник', '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>'],
  ['ellipse', 'Круг / эллипс', '<svg width="20" height="20" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>'],
  ['tri', 'Треугольник', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>'],
  ['text', 'Текст', '<span style="font-weight:700;font-family:serif;font-size:20px">T</span>'],
  ['eraser', 'Ластик — стирает фигуры, по которым проведёшь', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 17l9-11 8 7-7 8H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 21h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>']
];
async function skEdit(id, recIn) {
  const ov = skOv();
  ov.innerHTML = `<div class="sk-hd"><span style="flex:1;text-align:center;color:var(--t3)">Открываю…</span></div>`;
  let rec;
  try { await skLoadFabric(); rec = recIn || await skLoadFull(id); }
  catch(e) { ov.innerHTML = `<div class="sk-hd"><button class="sk-ib" onclick="skShowList()">←</button><span style="flex:1;padding:0 8px">${skEsc(e.message || e)}</span><button class="sk-ib" onclick="skClose()">✕</button></div>`; return; }
  if(!rec) { toast('Лист не найден', true); return skShowList(); }
  const st = { stroke: localStorage.getItem('mc_sk_stroke') || '#1f1f1f', fill: localStorage.getItem('mc_sk_fill') || '', width: +localStorage.getItem('mc_sk_w') || 3 };
  ov.innerHTML = `
  <div class="sk-hd">
    <button class="sk-ib" onclick="skShowList()" title="Мои листы" aria-label="Мои листы">←</button>
    <input class="sk-title" id="sk-title" value="${skEsc(rec.title || '')}" placeholder="Название" maxlength="80">
    <span class="sk-st sk-hide-ph" id="sk-status"></span>
    <button class="sk-ib" id="sk-undo" onclick="skUndo()" title="Отменить (Ctrl+Z)" aria-label="Отменить">↶</button>
    <button class="sk-ib" id="sk-redo" onclick="skRedo()" title="Повторить (Ctrl+Y)" aria-label="Повторить">↷</button>
    <button class="sk-ib solid" id="sk-send-btn" onclick="skSendMenu(this)">Отправить ▾</button>
    <button class="sk-ib sk-hide-ph" onclick="skClose()" aria-label="Закрыть">✕</button>
  </div>
  <div class="sk-body">
    <div class="sk-tools" id="sk-tools">${SK_TOOLS.map(t => `<button class="sk-tool" data-tool="${t[0]}" title="${t[1]}" aria-label="${t[1]}">${t[2]}</button>`).join('')}</div>
    <div class="sk-main">
      <div class="sk-props" id="sk-props"></div>
      <div class="sk-stage" id="sk-stage"><canvas class="sk-grid" id="sk-gridc"></canvas><canvas id="sk-canvas"></canvas>
        <div class="sk-zoom"><button onclick="skZoomBy(1/1.25)" aria-label="Мельче">−</button><button id="sk-zv" onclick="skFit()" title="Показать всё">100%</button><button onclick="skZoomBy(1.25)" aria-label="Крупнее">＋</button></div>
      </div>
    </div>
  </div>`;
  if(!fabric.Object.prototype._skStyled) { // ручки выделения: золотые и крупнее (удобно пальцем)
    Object.assign(fabric.Object.prototype, { _skStyled: true, transparentCorners: false, cornerColor: '#e8c56a', cornerStrokeColor: '#1f1f1f', borderColor: '#c9a640', cornerSize: 11, touchCornerSize: 26, cornerStyle: 'circle', borderScaleFactor: 1.5, padding: 4 });
  }
  const stage = document.getElementById('sk-stage');
  const canvas = new fabric.Canvas('sk-canvas', { width: stage.clientWidth, height: stage.clientHeight, preserveObjectStacking: true, selection: true, targetFindTolerance: 6, fireRightClick: false, stopContextMenu: true });
  SK = { id: rec.id, title: rec.title, links: rec.links || [], created_at: rec.created_at, canvas, hist: [], redo: [], tool: 'sel', st, mute: false, pushedOnce: !!rec.pushedOnce };
  document.getElementById('sk-title').oninput = e => { SK.title = e.target.value.trim() || 'Без названия'; skSaveSoon(); };
  document.getElementById('sk-tools').onclick = e => { const b = e.target.closest('[data-tool]'); if(b) skSetTool(b.dataset.tool); };
  const done = () => {
    SK.hist = [JSON.stringify(canvas.toJSON())];
    skSetTool('sel'); skPaintProps(); skUndoBtns();
    if(canvas.getObjects().length) skFit(); else { canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); skGrid(); }
    skSetStatus(rec.dirty ? '● на устройстве' : '☁ сохранено');
  };
  if(rec.data) canvas.loadFromJSON(rec.data, () => { canvas.renderAll(); done(); }); else done();
  skBindCanvas(canvas, stage);
  new ResizeObserver(() => { if(!SK || SK.canvas !== canvas) return; canvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight }); skGrid(); }).observe(stage);
}
function skSetStatus(t) { const s = document.getElementById('sk-status'); if(s) s.textContent = t; }

// сетка под рисунком (двигается и масштабируется вместе с листом)
function skGrid() {
  if(!SK) return;
  const c = document.getElementById('sk-gridc'), stg = document.getElementById('sk-stage'); if(!c || !stg) return;
  const W = stg.clientWidth, H = stg.clientHeight, dpr = window.devicePixelRatio || 1;
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const v = SK.canvas.viewportTransform, z = v[0];
  let step = 20 * z; while(step < 10) step *= 5;
  const big = step * 5;
  const draw = (s, col) => {
    g.strokeStyle = col; g.lineWidth = 1; g.beginPath();
    for(let x = ((v[4] % s) + s) % s; x < W; x += s) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, H); }
    for(let y = ((v[5] % s) + s) % s; y < H; y += s) { g.moveTo(0, Math.round(y) + .5); g.lineTo(W, Math.round(y) + .5); }
    g.stroke();
  };
  draw(step, '#e8e3d7'); draw(big, '#d9d2c2');
  const zv = document.getElementById('sk-zv'); if(zv) zv.textContent = Math.round(z * 100) + '%';
}
function skZoomAt(z, x, y) {
  const c = SK.canvas; z = Math.min(20, Math.max(.05, z));
  c.zoomToPoint(new fabric.Point(x, y), z); skGrid();
}
function skZoomBy(k) { if(!SK) return; const c = SK.canvas; skZoomAt(c.getZoom() * k, c.width / 2, c.height / 2); }
function skFit() {
  if(!SK) return; const c = SK.canvas, objs = c.getObjects();
  if(!objs.length) { c.setViewportTransform([1, 0, 0, 1, 0, 0]); skGrid(); return; }
  const b = skBounds(); const pad = 40;
  const z = Math.min(3, Math.max(.05, Math.min((c.width - pad * 2) / Math.max(b.w, 1), (c.height - pad * 2) / Math.max(b.h, 1))));
  c.setViewportTransform([z, 0, 0, z, (c.width - b.w * z) / 2 - b.x * z, (c.height - b.h * z) / 2 - b.y * z]);
  skGrid();
}
function skBounds(cv) { // границы всего рисунка в координатах листа
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  (cv || SK.canvas).getObjects().forEach(o => { const r = o.getBoundingRect(true, true); x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.left + r.width); y2 = Math.max(y2, r.top + r.height); });
  if(!isFinite(x1)) return { x: 0, y: 0, w: 800, h: 600 };
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// инструменты
function skSetTool(t) {
  if(!SK) return;
  const c = SK.canvas; SK.tool = t;
  document.querySelectorAll('#sk-tools .sk-tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  c.isDrawingMode = t === 'pen';
  if(t === 'pen') { c.freeDrawingBrush = new fabric.PencilBrush(c); c.freeDrawingBrush.color = SK.st.stroke; c.freeDrawingBrush.width = SK.st.width; c.freeDrawingBrush.decimate = 2; }
  const sel = t === 'sel';
  c.selection = sel; c.skipTargetFind = !(sel || t === 'eraser');
  c.getObjects().forEach(o => { o.selectable = sel; o.hoverCursor = sel ? 'move' : (t === 'eraser' ? 'not-allowed' : 'crosshair'); });
  if(!sel) c.discardActiveObject();
  c.defaultCursor = t === 'hand' ? 'grab' : sel ? 'default' : 'crosshair';
  c.requestRenderAll(); skPaintProps();
}
function skPaintProps() {
  const el = document.getElementById('sk-props'); if(!el || !SK) return;
  const st = SK.st, act = SK.canvas.getActiveObjects();
  const sw = (key, list) => list.map(col => `<button class="sk-sw${col === '' ? ' none' : ''}${st[key] === col ? ' on' : ''}" data-k="${key}" data-c="${col}" style="${col ? 'background:' + col : ''}" title="${col || 'без заливки'}"></button>`).join('');
  el.innerHTML = `<span class="sk-lb">Линия</span>${sw('stroke', SK_COLORS)}<input type="color" data-k="stroke" value="${/^#[0-9a-f]{6}$/i.test(st.stroke) ? st.stroke : '#1f1f1f'}" title="Свой цвет">
    <span class="sk-sep"></span><span class="sk-lb">Заливка</span>${sw('fill', [''].concat(SK_COLORS.slice(1, 8).map(c => c)))}
    <span class="sk-sep"></span><span class="sk-lb">Толщина</span><input type="range" min="1" max="30" value="${st.width}" data-k="width"><span class="sk-lb" id="sk-wv">${st.width}</span>
    ${act.length ? `<span class="sk-sep"></span><button class="sk-ib" onclick="skDup()" title="Копия (Ctrl+D)">⧉</button><button class="sk-ib" onclick="skOrder(1)" title="Вперёд">⬆</button><button class="sk-ib" onclick="skOrder(-1)" title="Назад">⬇</button><button class="sk-ib" onclick="skDel()" title="Удалить (Delete)" style="color:var(--red)">🗑</button>` : ''}`;
  el.onclick = e => { const b = e.target.closest('.sk-sw'); if(b) skSetStyle(b.dataset.k, b.dataset.c); };
  el.oninput = e => {
    const k = e.target.dataset.k; if(!k) return;
    if(k === 'width') { const v = +e.target.value; document.getElementById('sk-wv').textContent = v; skSetStyle('width', v, true); }
    else skSetStyle(k, e.target.value, true);
  };
  el.onchange = e => { if(e.target.dataset.k) skCommit(); };
}
function skSetStyle(k, v, live) {
  const st = SK.st; st[k] = v;
  try { localStorage.setItem(k === 'width' ? 'mc_sk_w' : 'mc_sk_' + k, v); } catch(e) {}
  const c = SK.canvas;
  if(c.freeDrawingBrush && SK.tool === 'pen') { c.freeDrawingBrush.color = st.stroke; c.freeDrawingBrush.width = st.width; }
  const act = c.getActiveObjects();
  act.forEach(o => {
    if(o.type === 'i-text' || o.type === 'text') { if(k === 'stroke') o.set('fill', v); }
    else if(k === 'stroke') o.set('stroke', v);
    else if(k === 'width') o.set('strokeWidth', v);
    else if(k === 'fill' && o.type !== 'line' && o.type !== 'path') o.set('fill', v || '');
  });
  c.requestRenderAll();
  if(!live) { skPaintProps(); if(act.length) skCommit(); }
  else if(k !== 'width') skPaintProps();
}

// рисование мышью и пальцем
function skBindCanvas(c, stage) {
  let draft = null, p0 = null, pan = null, erasing = false, strokeAt = 0;
  const base = () => ({ stroke: SK.st.stroke, strokeWidth: SK.st.width, fill: SK.st.fill || '', strokeUniform: true, strokeLineCap: 'round', strokeLineJoin: 'round', objectCaching: false });
  const arrowPath = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), L = Math.max(10, SK.st.width * 4);
    const h1 = [x2 - L * Math.cos(a - .45), y2 - L * Math.sin(a - .45)], h2 = [x2 - L * Math.cos(a + .45), y2 - L * Math.sin(a + .45)];
    return `M ${x1} ${y1} L ${x2} ${y2} M ${h1[0]} ${h1[1]} L ${x2} ${y2} L ${h2[0]} ${h2[1]}`;
  };
  const snap = (e, p) => { // Shift — ровно: квадрат, круг, линия под 45°
    if(!e.shiftKey || !p0) return p;
    const dx = p.x - p0.x, dy = p.y - p0.y;
    if(SK.tool === 'line' || SK.tool === 'arrow') { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(dx, dy); return { x: p0.x + l * Math.cos(a), y: p0.y + l * Math.sin(a) }; }
    const m = Math.max(Math.abs(dx), Math.abs(dy)); return { x: p0.x + Math.sign(dx || 1) * m, y: p0.y + Math.sign(dy || 1) * m };
  };
  const place = (p) => {
    const t = SK.tool, x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y), w = Math.abs(p.x - p0.x), h = Math.abs(p.y - p0.y);
    if(t === 'line') draft.set({ x2: p.x, y2: p.y });
    else if(t === 'rect' || t === 'tri') draft.set({ left: x, top: y, width: w, height: h });
    else if(t === 'ellipse') draft.set({ left: x, top: y, rx: w / 2, ry: h / 2 });
    else if(t === 'arrow') { c.remove(draft); draft = new fabric.Path(arrowPath(p0.x, p0.y, p.x, p.y), { ...base(), fill: '' }); c.add(draft); }
    draft.setCoords(); c.requestRenderAll();
  };
  c.on('mouse:down', o => {
    const e = o.e, t = SK.tool;
    if(SK.pinch) return;
    if(t === 'hand' || e.button === 1 || (e.altKey && t === 'sel') || SK.space) {
      const pt = e.touches ? e.touches[0] : e; pan = { x: pt.clientX, y: pt.clientY }; c.defaultCursor = 'grabbing'; c.selection = false; return;
    }
    if(t === 'eraser') { erasing = true; if(o.target) { c.remove(o.target); SK.erased = true; } return; }
    if(t === 'text') {
      const p = c.getPointer(e);
      const it = new fabric.IText('Текст', { left: p.x, top: p.y, fontSize: Math.round(22 / c.getZoom()), fill: SK.st.stroke, fontFamily: 'system-ui, sans-serif' });
      c.add(it); skSetTool('sel'); c.setActiveObject(it); it.enterEditing(); it.selectAll(); c.requestRenderAll();
      return;
    }
    if(['line', 'arrow', 'rect', 'ellipse', 'tri'].includes(t)) {
      p0 = c.getPointer(e); strokeAt = Date.now();
      const b = base();
      if(t === 'line') draft = new fabric.Line([p0.x, p0.y, p0.x, p0.y], { ...b, fill: '' });
      else if(t === 'rect') draft = new fabric.Rect({ ...b, left: p0.x, top: p0.y, width: 0, height: 0 });
      else if(t === 'tri') draft = new fabric.Triangle({ ...b, left: p0.x, top: p0.y, width: 0, height: 0 });
      else if(t === 'ellipse') draft = new fabric.Ellipse({ ...b, left: p0.x, top: p0.y, rx: 0, ry: 0 });
      else draft = new fabric.Path(arrowPath(p0.x, p0.y, p0.x + .1, p0.y), { ...b, fill: '' });
      draft.selectable = false; c.add(draft);
    }
    if(t === 'pen') strokeAt = Date.now();
  });
  c.on('mouse:move', o => {
    const e = o.e;
    if(pan) { const pt = e.touches ? e.touches[0] : e; c.relativePan(new fabric.Point(pt.clientX - pan.x, pt.clientY - pan.y)); pan = { x: pt.clientX, y: pt.clientY }; skGrid(); return; }
    if(erasing && SK.tool === 'eraser') { const tg = c.findTarget(e, false); if(tg) { c.remove(tg); SK.erased = true; } return; }
    if(draft && p0) place(snap(e, c.getPointer(e)));
  });
  c.on('mouse:up', () => {
    if(pan) { pan = null; c.defaultCursor = SK.tool === 'hand' ? 'grab' : 'default'; c.selection = SK.tool === 'sel'; return; }
    if(erasing) { erasing = false; if(SK.erased) { SK.erased = false; skCommit(); } return; }
    if(draft) {
      const d = draft; draft = null; p0 = null;
      const r = d.getBoundingRect(true, true);
      if(SK.pinchAt > strokeAt || (r.width < 3 && r.height < 3)) { c.remove(d); c.requestRenderAll(); return; } // случайное касание или два пальца
      d.set({ objectCaching: true }); d.setCoords(); skCommit();
    }
  });
  c.on('path:created', o => {
    if(SK.pinchAt > strokeAt) { c.remove(o.path); c.requestRenderAll(); return; }
    o.path.set({ strokeLineCap: 'round', strokeLineJoin: 'round', selectable: false }); skCommit();
  });
  c.on('object:modified', () => skCommit());
  c.on('text:editing:exited', o => { if(o.target && !o.target.text.trim()) c.remove(o.target); skCommit(); });
  c.on('selection:created', () => skPaintProps());
  c.on('selection:updated', () => skPaintProps());
  c.on('selection:cleared', () => skPaintProps());
  // колесо: масштаб (ПК); с Shift — прокрутка вбок
  c.on('mouse:wheel', o => {
    const e = o.e; e.preventDefault(); e.stopPropagation();
    if(e.ctrlKey) { skZoomAt(c.getZoom() * Math.pow(.99, e.deltaY), e.offsetX, e.offsetY); return; } // щипок на тачпаде
    if(e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { c.relativePan(new fabric.Point(-(e.deltaX || e.deltaY), 0)); skGrid(); return; }
    skZoomAt(c.getZoom() * Math.pow(.999, e.deltaY), e.offsetX, e.offsetY);
  });
  // два пальца: двигать и масштабировать лист (рисунок под пальцами не появляется)
  let pz = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const mid = t => { const r = stage.getBoundingClientRect(); return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top }; };
  stage.addEventListener('touchstart', e => {
    if(e.touches.length !== 2) return;
    e.preventDefault(); e.stopPropagation();
    SK.pinch = true; SK.pinchAt = Date.now();
    if(c.isDrawingMode) { c.isDrawingMode = false; c._isCurrentlyDrawing = false; c.contextTop && c.clearContext(c.contextTop); }
    if(draft) { c.remove(draft); draft = null; p0 = null; }
    pz = { d: dist(e.touches), m: mid(e.touches), z: c.getZoom() };
  }, { capture: true, passive: false });
  stage.addEventListener('touchmove', e => {
    if(!pz || e.touches.length !== 2) return;
    e.preventDefault(); e.stopPropagation();
    const m = mid(e.touches);
    c.relativePan(new fabric.Point(m.x - pz.m.x, m.y - pz.m.y));
    skZoomAt(pz.z * dist(e.touches) / pz.d, m.x, m.y);
    pz.m = m;
  }, { capture: true, passive: false });
  const tEnd = e => {
    if(!pz) return;
    if(e.touches.length < 2) { pz = null; setTimeout(() => { if(!SK) return; SK.pinch = false; if(SK.tool === 'pen') skSetTool('pen'); }, 50); }
    e.stopPropagation();
  };
  stage.addEventListener('touchend', tEnd, { capture: true });
  stage.addEventListener('touchcancel', tEnd, { capture: true });
}

// история: отмена / повтор
function skCommit() {
  if(!SK || SK.mute) return;
  const c = SK.canvas;
  if(SK.tool !== 'sel') c.getObjects().forEach(o => { o.selectable = false; });
  const js = JSON.stringify(c.toJSON());
  if(SK.hist[SK.hist.length - 1] === js) return;
  SK.hist.push(js); if(SK.hist.length > 80) SK.hist.shift();
  SK.redo = []; skUndoBtns(); skSaveSoon(js);
}
function skRestore(js) {
  const c = SK.canvas; SK.mute = true;
  c.loadFromJSON(js, () => { c.renderAll(); SK.mute = false; skSetTool(SK.tool); skSaveSoon(js); });
}
function skUndo() { if(!SK || SK.hist.length < 2) return; SK.redo.push(SK.hist.pop()); skRestore(SK.hist[SK.hist.length - 1]); skUndoBtns(); }
function skRedo() { if(!SK || !SK.redo.length) return; const js = SK.redo.pop(); SK.hist.push(js); skRestore(js); skUndoBtns(); }
function skUndoBtns() { const u = document.getElementById('sk-undo'), r = document.getElementById('sk-redo'); if(u) u.disabled = !SK || SK.hist.length < 2; if(r) r.disabled = !SK || !SK.redo.length; }
function skDel() { if(!SK) return; const c = SK.canvas, a = c.getActiveObjects(); if(!a.length) return; a.forEach(o => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); skCommit(); skPaintProps(); }
function skDup() {
  if(!SK) return; const c = SK.canvas, a = c.getActiveObject(); if(!a) return;
  a.clone(cl => {
    c.discardActiveObject();
    cl.set({ left: cl.left + 20, top: cl.top + 20, evented: true });
    if(cl.type === 'activeSelection') { cl.canvas = c; cl.forEachObject(o => c.add(o)); cl.setCoords(); } else c.add(cl);
    c.setActiveObject(cl); c.requestRenderAll(); skCommit();
  });
}
function skOrder(dir) { if(!SK) return; const c = SK.canvas; c.getActiveObjects().forEach(o => dir > 0 ? c.bringForward(o) : c.sendBackwards(o)); c.requestRenderAll(); skCommit(); }

// сохранение: сразу на устройство, в облако — через 1,5 с после последней правки
let _skSaveT = null;
function skSaveSoon(js) {
  if(!SK) return;
  const snap = { id: SK.id, title: SK.title, links: SK.links, created_at: SK.created_at, data: js ? JSON.parse(js) : SK.canvas.toJSON(), canvas: SK.canvas };
  skSetStatus('сохраняю…');
  clearTimeout(_skSaveT);
  _skSaveT = setTimeout(() => skWrite(snap), 600);
  SK._pending = snap;
}
async function skWrite(snap) {
  if(SK && SK._pending === snap) SK._pending = null;
  const rec = { id: snap.id, title: snap.title, links: snap.links, created_at: snap.created_at, data: snap.data, thumb: skThumb(snap.canvas), updated_at: new Date().toISOString(), dirty: true, pushedOnce: true };
  await skLocalPut(rec);
  skSetStatus('● на устройстве');
  skPushLater(rec, 900);
}
function skFlush() { // при закрытии — не терять последнюю правку
  if(SK && SK._pending) { clearTimeout(_skSaveT); const p = SK._pending; SK._pending = null; skWrite(p); }
}
function skThumb(c) {
  try {
    if(!c || !c.getObjects().length) return '';
    const b = skBounds(c);
    return skRender(c, b, 'jpeg', Math.min(1, 360 / Math.max(b.w + 40, (b.h + 40) * 4 / 3)), .7);
  } catch(e) { return ''; }
}
function skRender(c, b, fmt, mult, q) { // картинка рисунка с белым фоном, без сетки и без сдвига/масштаба экрана
  const vpt = c.viewportTransform.slice(), bg = c.backgroundColor, act = c.getActiveObject();
  if(act) c.discardActiveObject();
  c.setViewportTransform([1, 0, 0, 1, 0, 0]); c.backgroundColor = '#ffffff';
  const pad = 20;
  const url = c.toDataURL({ format: fmt, quality: q || .92, multiplier: mult || 2, left: b.x - pad, top: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2 });
  c.backgroundColor = bg; c.setViewportTransform(vpt);
  if(act) c.setActiveObject(act);
  c.requestRenderAll();
  return url;
}
window.addEventListener('visibilitychange', () => { if(document.hidden) skFlush(); });
window.addEventListener('online', () => { skLocalAll().then(l => l.filter(r => r.dirty).forEach(r => skPush(r))); });

// клавиатура (ПК)
document.addEventListener('keydown', e => {
  if(!SK || !document.getElementById('sk-ov')) return;
  const c = SK.canvas, a = c.getActiveObject(), typing = (a && a.isEditing) || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
  if(e.code === 'Space' && !typing) { SK.space = true; c.defaultCursor = 'grab'; }
  if(typing) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if(mod && k === 'z' && !e.shiftKey) { e.preventDefault(); skUndo(); }
  else if(mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); skRedo(); }
  else if(mod && k === 'd') { e.preventDefault(); skDup(); }
  else if(k === 'delete' || k === 'backspace') { if(a) { e.preventDefault(); skDel(); } }
  else if(k === 'escape') { c.discardActiveObject(); c.requestRenderAll(); skSetTool('sel'); }
  else if(!mod) { const m = { v: 'sel', h: 'hand', p: 'pen', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', e: 'eraser' }[k]; if(m) skSetTool(m); }
});
document.addEventListener('keyup', e => { if(SK && e.code === 'Space') { SK.space = false; SK.canvas.defaultCursor = SK.tool === 'hand' ? 'grab' : 'default'; } });

// ─── ОТПРАВКА ───
function skFileName(ext) { return ((SK && SK.title) || 'Эскиз').replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.' + ext; }
function skSendMenu(btn) {
  if(!SK) return;
  if(!SK.canvas.getObjects().length) { toast('Лист пока пустой', true); return; }
  const canShare = !!(navigator.canShare && navigator.share) || (typeof window.isNativeApp === 'function' && window.isNativeApp());
  skMenu(btn, [
    ['🗂 В карточку…', () => skSendToCard()],
    ['🖼 Сохранить PNG', () => skExport('png')],
    ['📷 Сохранить JPG', () => skExport('jpg')],
    ['✒️ Сохранить SVG (вектор)', () => skExport('svg')],
    ['📄 Сохранить PDF', () => skExport('pdf')]
  ].concat(canShare ? [['📤 Поделиться…', () => skExport('png', true)]] : []));
}
function skDataUrlBlob(u) { const [h, d] = u.split(','), mime = /:(.*?);/.exec(h)[1], bin = atob(d), a = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); }
async function skBlob(fmt) {
  const c = SK.canvas, b = skBounds();
  if(fmt === 'svg') {
    const vpt = c.viewportTransform.slice(); c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const pad = 20, svg = c.toSVG({ viewBox: { x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2 }, width: Math.round(b.w + pad * 2), height: Math.round(b.h + pad * 2) });
    c.setViewportTransform(vpt); c.requestRenderAll();
    return new Blob([svg], { type: 'image/svg+xml' });
  }
  const mult = Math.min(4, Math.max(1, 2400 / Math.max(b.w, b.h, 1)));
  const url = skRender(c, b, fmt === 'jpg' ? 'jpeg' : 'png', mult, .92);
  if(fmt !== 'pdf') return skDataUrlBlob(url);
  const J = window.jspdf && window.jspdf.jsPDF; if(!J) throw new Error('PDF недоступен без связи');
  const land = b.w > b.h, doc = new J({ orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const PW = land ? 297 : 210, PH = land ? 210 : 297, m = 10, k = Math.min((PW - m * 2) / (b.w + 40), (PH - m * 2) / (b.h + 40));
  const w = (b.w + 40) * k, h = (b.h + 40) * k;
  doc.addImage(url, 'PNG', (PW - w) / 2, (PH - h) / 2, w, h);
  return doc.output('blob');
}
async function skExport(fmt, share) {
  try {
    const blob = await skBlob(fmt), name = skFileName(fmt);
    if(typeof mcNativeShareFile === 'function' && await mcNativeShareFile(blob, 'Sketch_' + Date.now() + '.' + fmt, name)) return;
    if(share && navigator.canShare) {
      const f = new File([blob], name, { type: blob.type });
      if(navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: SK.title }); } catch(e) {} return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('✓ Сохранено: ' + name);
  } catch(e) { toast('Не получилось: ' + (e.message || e), true); }
}

// в карточку личного кабинета
function skPersonalSpaces() {
  const list = (typeof spaces !== 'undefined' ? spaces : []).filter(s => s && (s.type === 'personal' || s.id === 'personal') && s.status !== 'closed');
  if(!list.some(s => s.id === 'personal')) list.unshift({ id: 'personal', name: 'Личный', type: 'personal', _virtual: true });
  return list;
}
async function skSendToCard() {
  if(!SK) return;
  if(!navigator.onLine || typeof sb === 'undefined') { toast('Нужен интернет, чтобы добавить эскиз в карточку', true); return; }
  const sps = skPersonalSpaces();
  document.getElementById('sk-send')?.remove();
  const div = document.createElement('div'); div.id = 'sk-send';
  div.setAttribute('style', 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px');
  div.innerHTML = `<div style="background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);width:100%;max-width:460px;max-height:90%;display:flex;flex-direction:column;overflow:hidden">
    <div style="display:flex;align-items:center;gap:8px;padding:14px 14px 8px"><b style="flex:1;font-size:16px">🗂 Эскиз в карточку</b><button class="sk-ib" id="sks-x">✕</button></div>
    <div style="font-size:12px;color:var(--t3);padding:0 14px 8px">Эскиз «${skEsc(SK.title)}» добавится в карточку новой записью с картинкой.</div>
    <div id="sks-cabs" style="display:flex;gap:6px;overflow-x:auto;padding:0 14px 8px;scrollbar-width:none"></div>
    <div style="padding:0 14px 8px"><input id="sks-q" type="search" placeholder="Найти карточку" style="width:100%;box-sizing:border-box;background:var(--s2);border:1px solid var(--b1);border-radius:10px;padding:9px 11px;color:var(--t1);font-size:14px;font-family:inherit"></div>
    <div id="sks-list" style="flex:1;min-height:120px;overflow-y:auto;padding:0 8px 10px"><div style="padding:20px;text-align:center;color:var(--t3)">Загружаю карточки…</div></div>
  </div>`;
  document.body.appendChild(div);
  const close = () => div.remove();
  div.onclick = e => { if(e.target === div) close(); };
  document.getElementById('sks-x').onclick = close;
  let all = [], cab = (typeof currentSpace !== 'undefined' && currentSpace && sps.some(s => s.id === currentSpace.id)) ? currentSpace.id : (sps[0] && sps[0].id), q = '';
  const paint = () => {
    document.getElementById('sks-cabs').innerHTML = sps.map(s => `<button class="chip${s.id === cab ? ' on' : ''}" data-cab="${skEsc(s.id)}">🗂️ ${skEsc(s.name || 'Личный')}</button>`).join('');
    const L = all.filter(c => c.space_id === cab && (!q || String(c.title || '').toLowerCase().includes(q) || String(c.category || '').toLowerCase().includes(q)));
    document.getElementById('sks-list').innerHTML =
      `<div class="row" data-new="1" style="color:var(--accent)"><b style="font-size:20px;width:24px;text-align:center">＋</b><span>Новая карточка «${skEsc(SK.title)}»</span></div>` +
      (L.length ? L.map(c => `<div class="row" data-card="${skEsc(c.id)}"><span style="width:24px;text-align:center">📋</span><span style="flex:1;min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${skEsc(c.title || 'Без названия')}</span>${c.category ? `<span style="font-size:11px;color:var(--t3)">${skEsc(c.category)}</span>` : ''}</span></div>`).join('')
        : `<div style="padding:16px;text-align:center;color:var(--t3);font-size:13px">${q ? 'Ничего не найдено' : 'В этом кабинете пока нет карточек'}</div>`);
  };
  div.addEventListener('click', async e => {
    const cb = e.target.closest('[data-cab]'); if(cb) { cab = cb.dataset.cab; paint(); return; }
    const row = e.target.closest('[data-card],[data-new]'); if(!row || div.dataset.busy) return;
    div.dataset.busy = '1'; row.style.opacity = '.5';
    const ok = await skAttach(row.dataset.new ? null : row.dataset.card, cab);
    if(ok) close(); else { delete div.dataset.busy; row.style.opacity = ''; }
  });
  document.getElementById('sks-q').oninput = e => { q = e.target.value.trim().toLowerCase(); paint(); };
  try {
    const { data, error } = await sb.from('cards').select('id,title,category,space_id,status,created_at').in('space_id', sps.map(s => s.id)).neq('status', 'done').order('created_at', { ascending: false }).limit(500);
    if(error) throw error;
    all = data || [];
  } catch(e) { all = (typeof cards !== 'undefined' ? cards : []).filter(c => sps.some(s => s.id === c.space_id) && c.status !== 'done'); }
  // «Личный» без своей строки в базе показываем, только если в нём есть карточки; открываем кабинет, где они есть
  for(let i = sps.length - 1; i >= 0; i--) if(sps[i]._virtual && !all.some(c => c.space_id === sps[i].id)) sps.splice(i, 1);
  if(!sps.some(s => s.id === cab) || !all.some(c => c.space_id === cab)) { const w = sps.find(s => all.some(c => c.space_id === s.id)); if(w) cab = w.id; else if(sps[0]) cab = sps[0].id; }
  if(document.getElementById('sks-list')) paint();
}
async function skAttach(cardId, spaceId) {
  try {
    skFlush();
    let card = null; // сначала находим карточку, потом загружаем картинку (чтобы не оставлять лишних файлов)
    if(cardId) {
      card = (typeof cards !== 'undefined' ? cards : []).find(c => c.id === cardId);
      if(!card) { const { data, error } = await sb.from('cards').select('*').eq('id', cardId).single(); if(error) throw error; card = Array.isArray(data) ? data.find(c => c.id === cardId) : data; }
      if(!card) throw new Error('карточка не найдена');
    }
    const blob = await skBlob('png');
    const path = 'sketches/' + SK.id + '/' + Date.now() + '.png';
    const { error: upErr } = await sb.storage.from('attachments').upload(path, blob, { contentType: 'image/png', upsert: true });
    if(upErr) throw upErr;
    const url = sb.storage.from('attachments').getPublicUrl(path).data.publicUrl;
    const mk = () => (typeof uid === 'function' ? uid() : skNewId());
    const now = (typeof nowStr === 'function') ? nowStr() : new Date().toLocaleString('ru-RU');
    const att = { id: mk(), type: 'image/png', name: skFileName('png'), data: url, size: blob.size, sketchId: SK.id };
    const entry = { id: mk(), text: '✏️ Эскиз «' + SK.title + '»', date: now, done: false, attachments: [att], deadline: null, completions: null, assigned_to: null };
    const curId = (typeof currentSpaceId !== 'undefined' && currentSpaceId) || (typeof currentSpace !== 'undefined' && currentSpace && currentSpace.id) || '';
    const same = spaceId === curId;
    let title;
    if(!cardId) {
      const card = {
        id: mk(), created_at: (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10)), space_id: spaceId,
        created_by: localStorage.getItem('mc_current_member') || (currentUser && currentUser.display_name) || '',
        title: SK.title, body: '', category: '', status: 'new', priority: 'normal', deadline: null, ball: '', ballWho: '', assigned_to: null, attachments: [],
        entries: [entry], entryGroups: [],
        reminder: { enabled: false, freq: 'daily', days: [], hour: 9, monthDay: 1, intervalMin: null, intervalRun: null },
        history: [{ date: now, text: 'Создана из скетч-листа', type: 'status' }], related_ids: []
      };
      if(same && typeof cards !== 'undefined') cards.unshift(card);
      await dbInsert(card); cardId = card.id; title = card.title;
    } else {
      let ents = card.entries; if(typeof ents === 'string') { try { ents = JSON.parse(ents); } catch(e) { ents = []; } }
      card.entries = (Array.isArray(ents) ? ents : []).concat([entry]);
      await dbUpdate(card); title = card.title;
    }
    if(same && typeof render === 'function') render();
    SK.links = (SK.links || []).concat([{ cardId, entryId: entry.id, spaceId, url, at: new Date().toISOString() }]);
    skSaveSoon();
    toast('✓ Эскиз добавлен в «' + (title || 'карточку') + '»');
    return true;
  } catch(e) { console.log('skAttach', e); toast('Не получилось: ' + (e.message || e), true); return false; }
}
