// ═══════════════════════════════════════════
//  СКЕТЧ-ЛИСТ + СТАРТОВЫЙ ЭКРАН (этап 1, 19 ноября)
//  Для всех пользователей (решение Натальи 19 ноября). Только 3D (этап 6) — для тех, у кого в mc_features стоит d3 = true.
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
function skAllowed() { return !!(typeof currentUser !== 'undefined' && currentUser); } // скетч-лист — у каждого пользователя
function skAllowed3d() { return skAllowed() && !!skFeat().d3; } // 3D — только тем, у кого d3 = true в mc_features
let _skChecked = '';
async function skCheckAllowed() {
  if(typeof currentUser !== 'undefined' && currentUser && _skChecked === currentUser.id) return skAllowed(); // в облаке — один раз за запуск
  if(typeof currentUser === 'undefined' || !currentUser || typeof sb === 'undefined' || !navigator.onLine) return skAllowed();
  try {
    const q = sb.from('mc_features').select('sketch,d3').eq('user_id', currentUser.id).maybeSingle();
    const r = await Promise.race([q, new Promise(ok => setTimeout(() => ok(null), 3000))]);
    if(r && !r.error) { localStorage.setItem('mc_feat_' + currentUser.id, JSON.stringify(r.data || {})); _skChecked = currentUser.id; }
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
#sk-ov{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;color:var(--t1);container:skov/inline-size} /* узкое окно (телефон или половина экрана) — раскладка как на телефоне */
.sk-sm{display:none}
@container skov (max-width:520px){.sk-lg{display:none}.sk-sm{display:inline}.sk-hd .sk-ib{min-width:32px;height:32px;padding:0 6px}.sk-hd{gap:4px}}
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
.sk-cell{position:absolute;left:10px;bottom:14px;font-size:11px;color:#8a8270;pointer-events:none;z-index:2}
.sk-snapmk{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid #d4a52c;border-radius:50%;background:rgba(232,197,106,.25);pointer-events:none;display:none;z-index:4}
.sk-side{position:absolute;top:10px;right:10px;width:228px;display:flex;flex-direction:column;gap:8px;max-height:calc(100% - 64px);z-index:5;pointer-events:none}
.sk-info,.sk-layers{pointer-events:auto;background:var(--s1);border:1px solid var(--b1);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:12px;color:var(--t1);overflow:hidden}
.sk-info:empty{display:none}
.sk-ih{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:pointer;font-weight:600}
.sk-ih .sm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400;color:var(--accent)}
.sk-ib2{padding:0 10px 10px}
.sk-row{display:flex;align-items:center;gap:6px;margin:5px 0}
.sk-row span.k{width:74px;color:var(--t2);flex:none}
.sk-row input[type=text]{flex:1;min-width:0;background:var(--s2);border:1px solid var(--b1);border-radius:7px;color:var(--t1);padding:5px 7px;font-size:13px;font-family:inherit}
.sk-row .u{color:var(--t3);width:22px}
.sk-res{background:rgba(232,197,106,.1);border-radius:8px;padding:6px 8px;margin-top:6px;line-height:1.7;color:var(--accent)}
.sk-res b{color:var(--t1);font-weight:600}
.sk-chk{display:flex;align-items:center;gap:6px;margin-top:6px;color:var(--t2);cursor:pointer}
.sk-ly{display:flex;align-items:center;gap:4px;padding:5px 8px;border-top:1px solid var(--b1);cursor:pointer}
.sk-ly.on{background:rgba(232,197,106,.12)}
.sk-ly .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sk-ly button{background:none;border:none;color:var(--t2);font-size:14px;cursor:pointer;padding:3px 4px;font-family:inherit}
.sk-ly button.off{opacity:.35}
.sk-lib{pointer-events:auto;background:var(--s1);border:1px solid var(--b1);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:12px;color:var(--t1);overflow:hidden;display:flex;flex-direction:column;max-height:420px}
.sk-lib .tabs{display:flex;gap:4px;padding:0 8px 6px;overflow-x:auto;scrollbar-width:none;flex:none}
.sk-lib .tabs button{flex:none;padding:4px 9px;border-radius:12px;border:1px solid var(--b1);background:none;color:var(--t2);font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap}
.sk-lib .tabs button.on{border-color:var(--accent);color:var(--accent);background:rgba(232,197,106,.14)}
.sk-lib .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:4px 8px 8px;overflow-y:auto}
.sk-lib .it{background:#f6f3ec;border-radius:8px;padding:6px 4px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;border:1px solid transparent}
.sk-lib .it:hover{border-color:var(--accent)}
.sk-lib .it svg,.sk-lib .it img{width:100%;height:46px;object-fit:contain}
.sk-lib .it span{font-size:10px;color:#333;text-align:center;line-height:1.15}
.sk-lib .it .x{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;background:rgba(15,15,15,.65);color:#fff;font-size:10px;cursor:pointer;line-height:18px;padding:0}
.sk-lib .act{display:flex;gap:6px;padding:0 8px 8px;flex-wrap:wrap}
.sk-lib .act button{flex:1;min-width:110px;font-size:11px;padding:6px;border-radius:8px;border:1px dashed var(--accent);background:none;color:var(--accent);cursor:pointer;font-family:inherit}
html.sk-bottom #sk-ov,html.sk-side #sk-ov{inset:auto}
html.sk-bottom #sk-ov{left:0;right:0;bottom:0;height:var(--sk-h,50vh);border-top:2px solid var(--accent);box-shadow:0 -8px 24px rgba(0,0,0,.35)}
html.sk-bottom body{padding-bottom:var(--sk-h,50vh)!important}
html.sk-bottom #space-selector{bottom:var(--sk-h,50vh)!important;height:auto!important;top:0!important}
html.sk-bottom .fab{bottom:calc(var(--sk-h,50vh) + 18px)!important}
html.sk-side #sk-ov{top:0;bottom:0;right:0;width:var(--sk-w,50vw);border-left:2px solid var(--accent)}
html.sk-side body{width:calc(100% - var(--sk-w,50vw))!important;min-width:0!important}
html.sk-side #space-selector{left:0!important;right:var(--sk-w,50vw)!important;width:auto!important}
html.sk-side .fab{right:calc(var(--sk-w,50vw) + 18px)!important}
.sk-dh{position:absolute;z-index:8;touch-action:none}
html.sk-bottom .sk-dh{left:0;right:0;top:-8px;height:16px;cursor:row-resize}
html.sk-side .sk-dh{top:0;bottom:0;left:-8px;width:16px;cursor:col-resize}
.sk-dh::before{content:'';position:absolute;background:var(--accent);border-radius:4px;opacity:.85}
html.sk-bottom .sk-dh::before{left:50%;top:5px;width:54px;height:6px;margin-left:-27px}
html.sk-side .sk-dh::before{top:50%;left:5px;height:54px;width:6px;margin-top:-27px}
#desktop-sk-toggle{background:var(--s2);border:1px solid var(--b1);border-radius:18px;padding:6px 12px;color:var(--t2);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
body.sk-on #desktop-sk-toggle{background:var(--accent);color:#0f0f0f;border-color:var(--accent)}
@media (min-width:900px){
  body.sk-on #sk-ov{position:fixed;inset:auto;top:40px;bottom:0;left:var(--split-left);right:0;border-left:1px solid var(--b1)}
  html.mc-swap body.sk-on #sk-ov{left:0;right:var(--split-left);border-left:none;border-right:1px solid var(--b1)}
}
#sk-edit{position:absolute;inset:0;pointer-events:none;z-index:4}
#sk-edit svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sk-h{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;background:#fff;border:2px solid #c9a640;box-sizing:border-box;pointer-events:auto;touch-action:none;cursor:move;border-radius:3px}
.sk-h.on{background:#e8c56a;border-color:#1f1f1f}
.sk-h.mid{width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:rgba(232,197,106,.55);border-width:1.5px;cursor:grab}
.sk-h.g{border-radius:50%;width:16px;height:16px;margin:-8px 0 0 -8px;background:#e8c56a;border-color:#1f1f1f}
@media (pointer:coarse){.sk-h{width:22px;height:22px;margin:-11px 0 0 -11px}.sk-h.mid{width:18px;height:18px;margin:-9px 0 0 -9px}.sk-h.g{width:24px;height:24px;margin:-12px 0 0 -12px}}
#sk-3d{position:absolute;inset:0;z-index:7;background:#e9e6df}
#sk-3d canvas{display:block;width:100%;height:100%;touch-action:none}
.sk-3dbar{position:absolute;left:10px;top:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:2}
.sk-3dbar button{height:32px;border-radius:9px;border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,.94);color:#222;font-size:13px;cursor:pointer;font-family:inherit;padding:0 10px}
.sk-3dhint{position:absolute;left:10px;bottom:10px;font-size:11px;color:#6b665c;background:rgba(255,255,255,.8);border-radius:8px;padding:5px 8px;z-index:2;max-width:70%}
.sk-pop{position:fixed;z-index:2001;background:var(--s1);border:1px solid var(--b1);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.55);padding:12px;width:270px;font-size:13px;color:var(--t1)}
.sk-pop .seg{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 10px}
.sk-pop .seg button{padding:5px 9px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--t2);cursor:pointer;font-family:inherit;font-size:12px}
.sk-pop .seg button.on{border-color:var(--accent);color:var(--accent);background:rgba(232,197,106,.14)}
@container skov (max-width:699px){
  .sk-side{top:auto;bottom:52px;left:8px;right:8px;width:auto;max-height:60%}
  .sk-info:not(.open) .sk-ib2{display:none}
  .sk-cell{bottom:56px}
}
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
@container skov (max-width:699px){
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
  const list = (await skLocalAll()).filter(r => r.title !== '__lib__').sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
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
    if(a === 'new') skOpen('new', 'full');
    else if(a === 'last' && last) skOpen(last.id, 'full');
    else if(a === 'list') skOpen(undefined, 'full');
  });
  document.body.appendChild(div);
}
function mcStartHide() {
  const el = document.getElementById('mc-start'); if(!el) return;
  el.classList.add('out'); setTimeout(() => el.remove(), 260);
}

// после обычного запуска (лобби, без ссылок из уведомлений) — стартовый экран, один раз за запуск.
// Запуск ловим тремя способами (19 ноября, v463): обёртка initSpaces, обёртка showSpaceSelector и проверка раз в 0,5 с первые 40 с.
let _skBootBusy = false, _skLastWhy = 'ещё не проверялось';
function skInLobby() {
  const sel = document.getElementById('space-selector');
  const shown = document.body.classList.contains('in-lobby') || (sel && getComputedStyle(sel).display !== 'none');
  return !!shown && !(typeof currentSpace !== 'undefined' && currentSpace && document.body.classList.contains('in-cabinet'));
}
async function skBoot() {
  if(_skBootBusy) return;
  if(typeof currentUser === 'undefined' || !currentUser || !currentUser.id) { _skLastWhy = 'пользователь ещё не вошёл'; return; }
  _skBootBusy = true;
  try {
    const ok = await skCheckAllowed();
    skLobbyButton(); skDeskButton();
    if(!ok) { _skLastWhy = 'пользователь не вошёл'; return; }
    const solo = /[?&]sketch=([\w-]+)/.exec(_skBootSearch);
    if(solo && !_skStartShown) { _skStartShown = true; window._skSolo = true; _skLastWhy = 'отдельное окно листа'; skOpen(solo[1] === 'list' ? undefined : solo[1], 'full'); return; }
    const plain = !_skBootSearch || !/(space|openCard|openSpace|showEv|showDay|showDue|showReq|evId)=/.test(_skBootSearch);
    if(_skStartShown) { _skLastWhy = 'стартовый экран уже показан в этот запуск'; return; }
    if(!plain) { _skLastWhy = 'приложение открыто из уведомления или ссылки'; _skStartShown = true; return; }
    if(!skInLobby()) { _skLastWhy = 'лобби ещё не открыто'; return; }
    _skStartShown = true; _skLastWhy = 'показан';
    mcStartShow();
  } catch(e) { _skLastWhy = 'ошибка: ' + (e.message || e); }
  finally { _skBootBusy = false; }
}
(function skHookStart() {
  if(typeof initSpaces === 'function') {
    const orig = initSpaces;
    initSpaces = async function() { const r = await orig.apply(this, arguments); skBoot(); return r; };
  }
  if(typeof showSpaceSelector === 'function') {
    const origS = showSpaceSelector;
    showSpaceSelector = function() { const r = origS.apply(this, arguments); setTimeout(skBoot, 0); return r; };
  }
  let n = 0;
  const t = setInterval(() => { if(++n > 80 || _skStartShown) { clearInterval(t); return; } skBoot(); }, 500);
})();
// проверка для Натальи: в консоли браузера (F12) набрать  skWhy()
async function skWhy() {
  const out = {
    'файл app-sketch.js': 'загружен',
    'вход': (typeof currentUser !== 'undefined' && currentUser && currentUser.id) ? 'да' : 'нет',
    '3D (mc_features)': '?',
    'кнопка в лобби': document.getElementById('lobby-sk-btn') ? 'есть' : (document.getElementById('lobby-quick') ? 'нет' : 'нет места #lobby-quick'),
    'стартовый экран': _skLastWhy
  };
  try {
    const { data, error } = await sb.from('mc_features').select('sketch,d3').eq('user_id', currentUser.id).maybeSingle();
    out['3D (mc_features)'] = error ? 'ошибка: ' + error.message : (data && data.d3 ? 'включено' : 'нет');
  } catch(e) { out['3D (mc_features)'] = 'ошибка: ' + (e.message || e); }
  console.table(out);
  return out;
}
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
    new MutationObserver((m, obs) => { if(!document.body.contains(ov)) { obs.disconnect(); skFlush(); SK = null; skUndock(); } }).observe(document.body, { childList: true });
    skApplyDock(_skWantDock || _skDock);
  }
  return ov;
}
async function skOpen(id, dock) { // без id — список; 'new' — новый лист; иначе — открыть лист; dock — 'full' | 'side' | 'bottom'
  if(!skAllowed()) { toast('Скетч-лист недоступен', true); return; }
  mcStartHide();
  _skWantDock = dock || null;
  if(dock && document.getElementById('sk-ov')) skApplyDock(dock);
  if(id === 'new') return skCreate();
  if(id) return skEdit(id);
  return skShowList();
}
function skClose() { skFlush(); SK = null; document.getElementById('sk-ov')?.remove(); skUndock(); if(window._skSolo) { try { window.close(); } catch(e) {} } }

// ─── список листов ───
async function skShowList() {
  skFlush(); SK = null;
  const ov = skOv();
  ov.innerHTML = `<div class="sk-hd"><span style="font-size:18px;font-weight:700;flex:1">✏️ Мои листы</span><span class="sk-st" id="sk-sync">${navigator.onLine ? 'сверяю…' : 'без связи'}</span><button class="sk-ib sk-dock-btn" onclick="skDockMenu(this)" title="Расположение: рядом с карточками, под ними, во весь экран, отдельное окно">${SK_DOCK_SVG}</button><button class="sk-ib" onclick="skClose()" aria-label="Закрыть">✕</button></div><div class="sk-list" id="sk-grid"></div>`;
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
  paint((await skLocalAll()).filter(r => r.title !== '__lib__'));
  const synced = await skSync();
  if(document.getElementById('sk-grid')) { paint(synced.filter(r => r.title !== '__lib__')); const s = document.getElementById('sk-sync'); if(s) s.textContent = navigator.onLine ? '☁ в облаке' : 'без связи'; }
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
  const n = (await skLocalAll()).filter(r => r.title !== '__lib__').length + 1;
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
  ['dim', 'Размер — проведи от точки до точки (D)', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 15h18M3 11v8M21 11v8M6 13l-2 4M20 13l-2 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><text x="12" y="10" font-size="7" text-anchor="middle" fill="currentColor" font-family="sans-serif">1,2</text></svg>'],
  ['img', 'Картинка или фото (JPG, PNG, SVG, PDF) — также Ctrl+V и перетаскивание файла', '🖼'],
  ['lib', 'Фигуры: двери, окна, мебель, мои фигуры', '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 21l4-7 4 7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 14v7M13.5 17.5h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'],
  ['text', 'Текст', '<span style="font-weight:700;font-family:serif;font-size:20px">T</span>'],
  ['eraser', 'Ластик — стирает фигуры, по которым проведёшь', '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 17l9-11 8 7-7 8H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 21h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>']
];
async function skEdit(id, recIn) {
  const ov = skOv();
  ov.innerHTML = `<div class="sk-hd"><span style="flex:1;text-align:center;color:var(--t3)">Открываю…</span></div>`;
  let rec;
  try { await skLoadFabric(); skDefineWarp(); rec = recIn || await skLoadFull(id); }
  catch(e) { ov.innerHTML = `<div class="sk-hd"><button class="sk-ib" onclick="skShowList()">←</button><span style="flex:1;padding:0 8px">${skEsc(e.message || e)}</span><button class="sk-ib" onclick="skClose()">✕</button></div>`; return; }
  if(!rec) { toast('Лист не найден', true); return skShowList(); }
  const st = { stroke: localStorage.getItem('mc_sk_stroke') || '#1f1f1f', fill: localStorage.getItem('mc_sk_fill') || '', width: +localStorage.getItem('mc_sk_w') || 3 };
  const meta = skMetaFix(rec.data && rec.data.skMeta);
  ov.innerHTML = `
  <div class="sk-hd">
    <button class="sk-ib" onclick="skShowList()" title="Мои листы" aria-label="Мои листы">←</button>
    <input class="sk-title" id="sk-title" value="${skEsc(rec.title || '')}" placeholder="Название" maxlength="80">
    <span class="sk-st sk-hide-ph" id="sk-status"></span>
    <button class="sk-ib" id="sk-undo" onclick="skUndo()" title="Отменить (Ctrl+Z)" aria-label="Отменить">↶</button>
    <button class="sk-ib" id="sk-redo" onclick="skRedo()" title="Повторить (Ctrl+Y)" aria-label="Повторить">↷</button>
    <button class="sk-ib" id="sk-lay-btn" onclick="skLayersToggle()" title="Слои" aria-label="Слои">${SK_LAYERS_SVG}</button>
    <button class="sk-ib" id="sk-3d-btn" onclick="sk3dToggle()" title="Объём (3D)" aria-label="3D" style="font-weight:700;font-size:13px">3D</button>
    <button class="sk-ib sk-dock-btn" onclick="skDockMenu(this)" title="Расположение: рядом с карточками, под ними, во весь экран, отдельное окно" aria-label="Расположение">${SK_DOCK_SVG}</button>
    <button class="sk-ib solid" id="sk-send-btn" onclick="skSendMenu(this)" title="Отправить"><span class="sk-lg">Отправить ▾</span><span class="sk-sm">📤</span></button>
    <button class="sk-ib sk-hide-ph" onclick="skClose()" aria-label="Закрыть">✕</button>
  </div>
  <div class="sk-body">
    <div class="sk-tools" id="sk-tools">${SK_TOOLS.map(t => `<button class="sk-tool" data-tool="${t[0]}" title="${t[1]}" aria-label="${t[1]}">${t[2]}</button>`).join('')}</div>
    <div class="sk-main">
      <div class="sk-props" id="sk-props"></div>
      <div class="sk-stage" id="sk-stage"><canvas class="sk-grid" id="sk-gridc"></canvas><canvas id="sk-canvas"></canvas>
        <div class="sk-snapmk" id="sk-snapmk"></div>
        <div class="sk-side" id="sk-side"><div class="sk-info" id="sk-info"></div><div class="sk-layers" id="sk-layers" style="display:none"></div></div>
        <div class="sk-cell" id="sk-cell"></div>
        <div class="sk-zoom"><button onclick="skZoomBy(1/1.25)" aria-label="Мельче">−</button><button id="sk-zv" onclick="skFit()" title="Показать всё">100%</button><button onclick="skZoomBy(1.25)" aria-label="Крупнее">＋</button></div>
      </div>
    </div>
  </div>`;
  if(!fabric.Object.prototype._skStyled) { // ручки выделения: золотые и крупнее (удобно пальцем)
    Object.assign(fabric.Object.prototype, { _skStyled: true, transparentCorners: false, cornerColor: '#e8c56a', cornerStrokeColor: '#1f1f1f', borderColor: '#c9a640', cornerSize: 11, touchCornerSize: 26, cornerStyle: 'circle', borderScaleFactor: 1.5, padding: 4 });
  }
  const stage = document.getElementById('sk-stage');
  const canvas = new fabric.Canvas('sk-canvas', { width: stage.clientWidth, height: stage.clientHeight, preserveObjectStacking: true, selection: true, targetFindTolerance: 6, fireRightClick: false, stopContextMenu: true });
  SK = { id: rec.id, title: rec.title, links: rec.links || [], created_at: rec.created_at, canvas, hist: [], redo: [], tool: 'sel', st, meta, mute: false, pushedOnce: !!rec.pushedOnce };
  document.getElementById('sk-title').oninput = e => { SK.title = e.target.value.trim() || 'Без названия'; skSaveSoon(); };
  document.getElementById('sk-tools').onclick = e => {
    const b = e.target.closest('[data-tool]'); if(!b) return;
    if(b.dataset.tool === 'img') return skPickImage();
    if(b.dataset.tool === 'lib') return skLibToggle();
    skSetTool(b.dataset.tool);
  };
  const done = () => {
    SK.mute = false;
    canvas.getObjects().forEach(o => skPrepObj(o)); // старым листам — номера фигур и слой
    skApplyLayers();
    SK.hist = [skJSON()];
    skSetTool('sel'); skPaintProps(); skUndoBtns(); skInfo(); skLayersPaint();
    if(canvas.getObjects().length) skFit(); else { canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); skGrid(); }
    skSetStatus(rec.dirty ? '● на устройстве' : '☁ сохранено');
  };
  if(rec.data) { SK.mute = true; canvas.loadFromJSON(rec.data, () => { canvas.renderAll(); done(); }); } else done();
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
  const gs = skGridStep(), step = gs.px * z, big = gs.bigPx * z;
  const cell = document.getElementById('sk-cell'); if(cell) cell.textContent = 'клетка ' + skFmtLen(gs.mm);
  if(SK.edit) skEditPaint();
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
  if(SK._3d) sk3dClose();
  if(SK.edit && t !== 'edit') { const E = SK.edit; SK.edit = null; document.getElementById('sk-edit')?.remove(); if(E.obj.type === 'skWarpImage') E.obj.objectCaching = true; skCommit(); }
  const c = SK.canvas; SK.tool = t;
  document.querySelectorAll('#sk-tools .sk-tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  c.isDrawingMode = t === 'pen';
  if(t === 'pen') { c.freeDrawingBrush = new fabric.PencilBrush(c); c.freeDrawingBrush.color = SK.st.stroke; c.freeDrawingBrush.width = SK.st.width; c.freeDrawingBrush.decimate = 2; }
  const sel = t === 'sel';
  c.selection = sel; c.skipTargetFind = !(sel || t === 'eraser');
  skApplyLayers();
  if(!sel) c.discardActiveObject();
  c.defaultCursor = t === 'hand' ? 'grab' : sel ? 'default' : 'crosshair';
  c.requestRenderAll(); skPaintProps();
}
function skPaintProps() {
  const el = document.getElementById('sk-props'); if(!el || !SK) return;
  const st = SK.st, act = SK.canvas.getActiveObjects();
  const sw = (key, list) => list.map(col => `<button class="sk-sw${col === '' ? ' none' : ''}${st[key] === col ? ' on' : ''}" data-k="${key}" data-c="${col}" style="${col ? 'background:' + col : ''}" title="${col || 'без заливки'}"></button>`).join('');
  el.innerHTML = `<button class="sk-ib gold" id="sk-sheet-btn" onclick="skSheetMenu(this)" title="Масштаб, единицы, привязка">📐 1:${SK.meta.scale} · ${SK_UNITS[SK.meta.unit].s}</button><span class="sk-sep"></span><span class="sk-lb">Линия</span>${sw('stroke', SK_COLORS)}<input type="color" data-k="stroke" value="${/^#[0-9a-f]{6}$/i.test(st.stroke) ? st.stroke : '#1f1f1f'}" title="Свой цвет">
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
  const snap = (e, p) => { // привязка к углам/сетке; Shift — ровно: квадрат, круг, линия под 45°
    p = skSnap(p, draft);
    if(!e.shiftKey || !p0) return p;
    const dx = p.x - p0.x, dy = p.y - p0.y;
    if(SK.tool === 'line' || SK.tool === 'arrow' || SK.tool === 'dim') { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(dx, dy); return { x: p0.x + l * Math.cos(a), y: p0.y + l * Math.sin(a) }; }
    const m = Math.max(Math.abs(dx), Math.abs(dy)); return { x: p0.x + Math.sign(dx || 1) * m, y: p0.y + Math.sign(dy || 1) * m };
  };
  const place = (p) => {
    const t = SK.tool, x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y), w = Math.abs(p.x - p0.x), h = Math.abs(p.y - p0.y);
    if(t === 'line') draft.set({ x2: p.x, y2: p.y });
    else if(t === 'rect' || t === 'tri') draft.set({ left: x, top: y, width: w, height: h });
    else if(t === 'ellipse') draft.set({ left: x, top: y, rx: w / 2, ry: h / 2 });
    else if(t === 'arrow') { c.remove(draft); draft = new fabric.Path(arrowPath(p0.x, p0.y, p.x, p.y), { ...base(), fill: '' }); c.add(draft); }
    else if(t === 'dim') { c.remove(draft); draft = skDimGroup(p0, p, 0, {}) || new fabric.Line([p0.x, p0.y, p.x, p.y], { stroke: SK_DIM_COL, strokeWidth: 1 }); draft.selectable = false; draft.evented = false; c.add(draft); }
    draft.setCoords();
    if(t !== 'dim' && t !== 'arrow') { draft.skDims = SK.meta.autoDims; skDimsFor(draft); }
    c.requestRenderAll();
  };
  c.on('mouse:down', o => {
    const e = o.e, t = SK.tool;
    if(SK.pinch) return;
    if(t === 'hand' || e.button === 1 || (e.altKey && t === 'sel') || SK.space) {
      const pt = e.touches ? e.touches[0] : e; pan = { x: pt.clientX, y: pt.clientY }; c.defaultCursor = 'grabbing'; c.selection = false; return;
    }
    if(t === 'calib') { skCalibPoint(c.getPointer(e)); return; }
    if(t === 'eraser') { erasing = true; if(o.target) { c.remove(o.target); SK.erased = true; } return; }
    if(t === 'text') {
      const p = c.getPointer(e);
      const it = new fabric.IText('Текст', { left: p.x, top: p.y, fontSize: Math.round(22 / c.getZoom()), fill: SK.st.stroke, fontFamily: 'system-ui, sans-serif' });
      c.add(it); skSetTool('sel'); c.setActiveObject(it); it.enterEditing(); it.selectAll(); c.requestRenderAll();
      return;
    }
    if(['line', 'arrow', 'rect', 'ellipse', 'tri', 'dim'].includes(t)) {
      SK.snapCands = null; p0 = skSnap(c.getPointer(e)); strokeAt = Date.now();
      const b = base();
      if(t === 'line') draft = new fabric.Line([p0.x, p0.y, p0.x, p0.y], { ...b, fill: '' });
      else if(t === 'rect') draft = new fabric.Rect({ ...b, left: p0.x, top: p0.y, width: 0, height: 0 });
      else if(t === 'tri') draft = new fabric.Triangle({ ...b, left: p0.x, top: p0.y, width: 0, height: 0 });
      else if(t === 'ellipse') draft = new fabric.Ellipse({ ...b, left: p0.x, top: p0.y, rx: 0, ry: 0 });
      else if(t === 'dim') draft = new fabric.Line([p0.x, p0.y, p0.x, p0.y], { stroke: SK_DIM_COL, strokeWidth: 1, fill: '' });
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
    else if(!pan && ['line', 'arrow', 'rect', 'ellipse', 'tri', 'dim'].includes(SK.tool) && !(e.touches)) { SK.snapCands = null; skSnap(c.getPointer(e)); } // показать точку привязки до нажатия
  });
  c.on('mouse:up', () => {
    if(pan) { pan = null; c.defaultCursor = SK.tool === 'hand' ? 'grab' : 'default'; c.selection = SK.tool === 'sel'; return; }
    if(erasing) { erasing = false; if(SK.erased) { SK.erased = false; skCommit(); } return; }
    if(draft) {
      const d = draft; draft = null; p0 = null;
      const r = d.getBoundingRect(true, true);
      skSnapMark(null); SK.snapCands = null;
      if(SK.pinchAt > strokeAt || (r.width < 3 && r.height < 3)) { c.remove(d); c.requestRenderAll(); return; } // случайное касание или два пальца
      if(SK.tool === 'dim') { d.set({ selectable: SK.tool === 'sel', evented: true }); skApplyLayers(); skCommit(); return; }
      d.set({ objectCaching: true }); d.setCoords(); skDimsFor(d); skApplyLayers(); skCommit();
    }
  });
  c.on('path:created', o => {
    if(SK.pinchAt > strokeAt) { c.remove(o.path); c.requestRenderAll(); return; }
    o.path.set({ strokeLineCap: 'round', strokeLineJoin: 'round', strokeUniform: true, selectable: false }); skCommit();
  });
  // номер фигуры и слой — каждой новой; размеры следуют за фигурой; удалили фигуру — уходят и её размеры
  c.on('object:added', o => { if(!SK.mute && o.target) skPrepObj(o.target); });
  c.on('object:removed', o => { if(SK.mute || SK.dimBusy || !o.target || !o.target.skId || o.target.skDim) return; skDimsRemove(o.target.skId); });
  const follow = o => { if(!o.target) return; skDimsForTarget(o.target); skInfo(); };
  c.on('object:moving', o => { skGridMove(o.target); follow(o); });
  c.on('object:scaling', follow);
  c.on('object:rotating', follow);
  c.on('object:modified', o => { const t = o.target; if(t && t.skDim && !t.skDimOf) skDimRebuild(t); else skDimsForTarget(t); skInfo(); skCommit(); });
  c.on('text:editing:exited', o => { if(o.target && !o.target.text.trim()) c.remove(o.target); skCommit(); });
  c.on('selection:created', () => { skPaintProps(); skInfo(); });
  c.on('selection:updated', () => { skPaintProps(); skInfo(); });
  c.on('selection:cleared', () => { skPaintProps(); skInfo(); });
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
  skApplyLayers();
  const js = skJSON();
  if(SK.hist[SK.hist.length - 1] === js) return;
  SK.hist.push(js); if(SK.hist.length > 80) SK.hist.shift();
  SK.redo = []; skUndoBtns(); skSaveSoon(js);
}
function skRestore(js) {
  const c = SK.canvas; SK.mute = true;
  try { SK.meta = skMetaFix(JSON.parse(js).skMeta); } catch(e) {}
  c.loadFromJSON(js, () => { c.renderAll(); SK.mute = false; skSetTool(SK.tool); skPaintProps(); skInfo(); skLayersPaint(); skGrid(); skSaveSoon(js); });
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
  const snap = { id: SK.id, title: SK.title, links: SK.links, created_at: SK.created_at, data: JSON.parse(js || skJSON()), canvas: SK.canvas };
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
  if(SK.edit) { if(e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); skEditDone(); } else if((e.key === 'Delete' || e.key === 'Backspace') && SK.edit.mode === 'nodes') { e.preventDefault(); skNodeDel(); } return; }
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if(mod && k === 'z' && !e.shiftKey) { e.preventDefault(); skUndo(); }
  else if(mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); skRedo(); }
  else if(mod && k === 'd') { e.preventDefault(); skDup(); }
  else if(k === 'delete' || k === 'backspace') { if(a) { e.preventDefault(); skDel(); } }
  else if(k === 'escape') { c.discardActiveObject(); c.requestRenderAll(); skSetTool('sel'); }
  else if(!mod) { const m = { v: 'sel', h: 'hand', p: 'pen', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', e: 'eraser', d: 'dim' }[k]; if(m) skSetTool(m); }
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


// ═══════════════════════════════════════════
//  ЭТАП 2 (19 ноября): масштаб и единицы, размеры цифрами, площадь/периметр/объём,
//  размерные линии (инструмент «Размер» и размеры у фигур), слои, привязка к сетке и углам.
//  1 пиксель листа = 0,25 мм на бумаге (SK_PX_MM = 4); в натуре: мм = пиксели × масштаб / 4.
//  Настройки листа хранятся в рисунке: data.skMeta = {scale, unit, snapGrid, snapObj, autoDims, layers, active}.
// ═══════════════════════════════════════════
const SK_PX_MM = 4;
const SK_PROPS = ['skId', 'skLayer', 'skH', 'skDims', 'skDim', 'skDimOf', 'skDimL', 'skDimOff', 'skName', 'skGrid', 'skN'];
const SK_DIM_COL = '#c0392b';
const SK_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
const SK_UNITS = { mm: { s: 'мм', k: 1, d: 0 }, cm: { s: 'см', k: 10, d: 1 }, m: { s: 'м', k: 1000, d: 2 } };
const SK_LAYERS_SVG = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 13l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
function skMetaFix(m) {
  m = Object.assign({ scale: 50, unit: 'cm', snapGrid: false, snapObj: true, autoDims: true, layers: null, active: 'l1' }, m || {});
  if(!SK_UNITS[m.unit]) m.unit = 'cm';
  if(!(+m.scale > 0)) m.scale = 50;
  if(!Array.isArray(m.layers) || !m.layers.length) m.layers = [{ id: 'l1', name: 'Слой 1', vis: true, lock: false }];
  const free = l => l.id !== 'dims' && l.id !== 'under';
  if(!m.layers.some(l => l.id === m.active && free(l))) m.active = (m.layers.find(free) || m.layers[0]).id;
  return m;
}
function skJSON() { const j = SK.canvas.toJSON(SK_PROPS); j.skMeta = SK.meta; return JSON.stringify(j); }
const skMmPx = () => SK.meta.scale / SK_PX_MM; // мм в натуре на 1 пиксель листа
function skNum(v, d) { return (+v).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function skFmtLen(mm) { // длина в единицах листа: «4,20 м», «420 см», «4200 мм»
  const u = SK_UNITS[SK.meta.unit]; let v = mm / u.k;
  let d = u.d; if(u.k === 10 && Math.abs(v - Math.round(v)) < .05) d = 0;
  return skNum(v, d) + ' ' + u.s;
}
function skFmtPer(mm) { return SK.meta.unit === 'cm' && mm >= 1000 ? skNum(mm / 1000, 2) + ' м' : skFmtLen(mm); } // периметр: в сантиметрах длинно — показываем в метрах
function skFmtArea(mm2) { const m2 = mm2 / 1e6; return m2 >= .01 ? skNum(m2, 2) + ' м²' : skNum(mm2 / 100, 1) + ' см²'; }
function skFmtVol(mm3) { const m3 = mm3 / 1e9; return m3 >= .01 ? skNum(m3, 2) + ' м³' : skNum(mm3 / 1e6, 1) + ' л'; }
function skParseLen(str) { // «420», «4,2», «420-12», «2*1,5» → мм
  const t = String(str || '').replace(/,/g, '.').replace(/\s+/g, '').replace(/[×х]/g, '*');
  if(!t || !/^[\d.+\-*/()]+$/.test(t)) return null;
  let v; try { v = Function('"use strict";return (' + t + ')')(); } catch(e) { return null; }
  return isFinite(v) && v > 0 ? v * SK_UNITS[SK.meta.unit].k : null;
}
function skGridStep() { // шаг клетки в натуре, чтобы на экране клетка была не мельче ~12 px
  const z = SK.canvas.getZoom(), mpp = skMmPx();
  const list = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  let mm = list.find(v => v / mpp * z >= 12) || list[list.length - 1];
  const big = mm * (String(mm)[0] === '5' ? 2 : 5);
  return { mm, px: mm / mpp, bigPx: big / mpp };
}

// номер фигуры и слой
function skPrepObj(o) {
  if(!o || !SK) return;
  if(!o.skId) o.skId = skNewId().slice(0, 12);
  if(o.skDim) { o.skLayer = 'dims'; skDimsLayer(); }
  else if(!o.skLayer || !SK.meta.layers.some(l => l.id === o.skLayer)) o.skLayer = SK.meta.active;
  if(o.type === 'path' && o.strokeUniform !== true && o.skNew) o.strokeUniform = true;
}

// ── геометрия фигуры (в пикселях листа) ──
function skLocalBox(o) {
  if(o.type === 'ellipse') return { w: o.rx * 2, h: o.ry * 2 };
  return { w: o.width, h: o.height };
}
function skCorners(o) { // углы рамки фигуры без толщины линии, в координатах листа: tl, tr, br, bl
  const M = o.calcTransformMatrix(), b = skLocalBox(o), P = (x, y) => fabric.util.transformPoint(new fabric.Point(x, y), M);
  return [P(-b.w / 2, -b.h / 2), P(b.w / 2, -b.h / 2), P(b.w / 2, b.h / 2), P(-b.w / 2, b.h / 2)];
}
function skLineEnds(o) {
  const lp = o.calcLinePoints(), M = o.calcTransformMatrix();
  return [fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), M), fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), M)];
}
function skPathLen(o) { // длина линии карандаша (по точкам), с учётом масштаба фигуры
  let L = 0, prev = null; const sx = o.scaleX || 1, sy = o.scaleY || 1;
  (o.path || []).forEach(cmd => {
    const n = cmd.length; if(n < 3) return;
    const pt = { x: cmd[n - 2] * sx, y: cmd[n - 1] * sy };
    if(prev && cmd[0] !== 'M') L += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  });
  return L;
}
function skShape(o) { // что умеем мерить: {kind, w, h, len, area, per} — в мм
  if(!o) return null;
  const k = skMmPx(), sx = Math.abs(o.scaleX || 1), sy = Math.abs(o.scaleY || 1);
  if(o.type === 'rect') { const w = o.width * sx * k, h = o.height * sy * k; return { kind: 'rect', name: 'Прямоугольник', w, h, area: w * h, per: 2 * (w + h) }; }
  if(o.type === 'ellipse') { const a = o.rx * sx * k, b = o.ry * sy * k; return { kind: 'ellipse', name: a === b ? 'Круг' : 'Эллипс', w: a * 2, h: b * 2, area: Math.PI * a * b, per: Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) }; }
  if(o.type === 'triangle') { const w = o.width * sx * k, h = o.height * sy * k; return { kind: 'tri', name: 'Треугольник', w, h, area: w * h / 2, per: w + 2 * Math.hypot(w / 2, h) }; }
  if(o.type === 'line') { const e = skLineEnds(o); return { kind: 'line', name: 'Линия', len: Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y) * k, ang: Math.round(Math.atan2(-(e[1].y - e[0].y), e[1].x - e[0].x) * 180 / Math.PI) }; }
  if(o.type === 'path' && !o.skDim) { // замкнутый контур (после «Узлов» или «Искажения») — площадь и периметр
    const sub = skFlatten(o);
    if(sub.length === 1 && sub[0].closed && sub[0].pts.length > 2) { const pp = sub[0].pts; let a = 0, per = 0; pp.forEach((p, i) => { const q = pp[(i + 1) % pp.length]; a += p.x * q.y - q.x * p.y; per += Math.hypot(q.x - p.x, q.y - p.y); }); return { kind: 'poly', name: o.skName || 'Контур', area: Math.abs(a) / 2 * k * k, per: per * k }; }
    return { kind: 'path', name: o.skName || 'Линия от руки', len: skPathLen(o) * k };
  }
  if(o.type === 'image' || o.type === 'skWarpImage') { const w = o.width * sx * k, h = o.height * sy * k; return { kind: 'img', name: o.skName || 'Картинка', w, h }; }
  if(o.type === 'group' && !o.skDim) { const w = o.width * sx * k, h = o.height * sy * k; return { kind: 'grp', name: o.skName || 'Группа', w, h, area: w * h }; }
  if(o.skDim) { const e = skDimWorld(o); return { kind: 'dim', name: 'Размер', len: e ? Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y) * k : 0 }; }
  return null;
}

// ── размерные линии ──
function skDimGroup(p1, p2, off, opt) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy); if(L < 2) return null;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, t = 5, col = SK_DIM_COL;
  const A = { x: p1.x + nx * off, y: p1.y + ny * off }, B = { x: p2.x + nx * off, y: p2.y + ny * off };
  const ln = (a, b, w) => new fabric.Line([a.x, a.y, b.x, b.y], { stroke: col, strokeWidth: w || 1, strokeLineCap: 'round', objectCaching: false });
  const items = [ln(A, B)];
  if(Math.abs(off) > 1) { const s = Math.sign(off); items.push(ln({ x: p1.x + nx * s * 2, y: p1.y + ny * s * 2 }, { x: A.x + nx * s * 4, y: A.y + ny * s * 4 }, .8), ln({ x: p2.x + nx * s * 2, y: p2.y + ny * s * 2 }, { x: B.x + nx * s * 4, y: B.y + ny * s * 4 }, .8)); }
  const tk = (P) => ln({ x: P.x - (ux + nx) * t * .7, y: P.y - (uy + ny) * t * .7 }, { x: P.x + (ux + nx) * t * .7, y: P.y + (uy + ny) * t * .7 }, 1.4);
  items.push(tk(A), tk(B));
  let ang = Math.atan2(dy, dx) * 180 / Math.PI; if(ang > 90) ang -= 180; if(ang <= -90) ang += 180;
  items.push(new fabric.Text(skFmtLen(L * skMmPx()), { left: (A.x + B.x) / 2, top: (A.y + B.y) / 2, originX: 'center', originY: 'center', angle: ang, fontSize: 13, fill: col, fontFamily: 'system-ui, sans-serif', textBackgroundColor: 'rgba(246,243,236,.92)', objectCaching: false }));
  const g = new fabric.Group(items, { skDim: true, skDimOf: opt.of || null, skDimOff: off, skLayer: 'dims', objectCaching: false, lockScalingFlip: true, subTargetCheck: false });
  if(opt.of) { g.selectable = false; g.evented = false; g.excludeFromExport = false; }
  const inv = fabric.util.invertTransform(g.calcTransformMatrix());
  const l1 = fabric.util.transformPoint(new fabric.Point(p1.x, p1.y), inv), l2 = fabric.util.transformPoint(new fabric.Point(p2.x, p2.y), inv);
  g.skDimL = [l1.x, l1.y, l2.x, l2.y];
  return g;
}
function skDimWorld(g) {
  if(!g || !g.skDimL) return null; const M = g.calcTransformMatrix(), L = g.skDimL;
  return [fabric.util.transformPoint(new fabric.Point(L[0], L[1]), M), fabric.util.transformPoint(new fabric.Point(L[2], L[3]), M)];
}
function skDimsLayer() { // слой «Размеры» — всегда сверху
  const ls = SK.meta.layers;
  if(!ls.some(l => l.id === 'dims')) ls.push({ id: 'dims', name: 'Размеры', vis: true, lock: false });
}
function skDimsRemove(id) {
  const c = SK.canvas; SK.dimBusy = true;
  c.getObjects().filter(o => o.skDimOf === id).forEach(o => c.remove(o));
  SK.dimBusy = false;
}
function skDimsFor(o) { // размеры у фигуры: пересоздать по её нынешнему положению
  if(!o || !SK || o.skDim) return;
  const c = SK.canvas;
  if(!o.skId) skPrepObj(o);
  skDimsRemove(o.skId);
  if(!o.skDims || !c.getObjects().includes(o) || o.visible === false) return;
  const L = SK.meta.layers.find(l => l.id === o.skLayer); if(L && !L.vis) return;
  const off = 26, list = [];
  if(o.type === 'rect' || o.type === 'ellipse') { const q = skCorners(o); list.push([q[0], q[1], -off], [q[3], q[0], -off]); }
  else if(o.type === 'triangle') { const q = skCorners(o); list.push([q[3], q[2], off], [q[3], q[0], -off]); }
  else if(o.type === 'line') { const e = skLineEnds(o); list.push([e[0], e[1], -off * .8]); }
  SK.dimBusy = true;
  list.forEach(d => { const g = skDimGroup(d[0], d[1], d[2], { of: o.skId }); if(g) { g.skId = skNewId().slice(0, 12); c.add(g); } });
  SK.dimBusy = false;
  skApplyLayers();
}
let _skDimRaf = 0;
function skDimsForTarget(t) { // при движении — не чаще раза в кадр
  if(!t) return;
  cancelAnimationFrame(_skDimRaf);
  _skDimRaf = requestAnimationFrame(() => { if(!SK) return; (t.type === 'activeSelection' ? t.getObjects() : [t]).forEach(o => { if(!o.skDim) skDimsFor(o); }); SK.canvas.requestRenderAll(); });
}
function skDimsAll() { if(!SK) return; SK.canvas.getObjects().filter(o => !o.skDim).forEach(o => skDimsFor(o)); SK.canvas.getObjects().filter(o => o.skDim && !o.skDimOf).forEach(g => skDimRebuild(g, true)); }
function skDimRebuild(g, keepSel, k) { // свой размер после растяжения/поворота — пересобрать с новой длиной
  const c = SK.canvas, e = skDimWorld(g); if(!e) return;
  if(k) e.forEach(p => { p.x *= k; p.y *= k; });
  const n = skDimGroup(e[0], e[1], g.skDimOff || 0, {}); if(!n) return;
  n.skId = g.skId; n.skLayer = 'dims';
  const idx = c.getObjects().indexOf(g), wasAct = c.getActiveObject() === g;
  SK.dimBusy = true; c.remove(g); c.insertAt(n, Math.max(0, idx)); SK.dimBusy = false;
  skApplyLayers();
  if(wasAct && !keepSel) c.setActiveObject(n);
}

// ── слои ──
function skApplyLayers() {
  if(!SK) return;
  const c = SK.canvas, meta = SK.meta, ord = new Map(meta.layers.map((l, i) => [l.id, i])), sel = SK.tool === 'sel';
  if(c.getObjects().some(o => o.skDim)) skDimsLayer();
  c._objects.sort((a, b) => (ord.get(a.skLayer) ?? 0) - (ord.get(b.skLayer) ?? 0));
  const act = c.getActiveObject();
  c.getObjects().forEach(o => {
    const L = meta.layers.find(l => l.id === o.skLayer) || meta.layers[0];
    o.visible = L.vis !== false;
    const auto = !!o.skDimOf, free = !L.lock && o.visible;
    o.selectable = sel && free && !auto;
    o.evented = free && !auto && (sel || SK.tool === 'eraser');
    o.hoverCursor = sel ? 'move' : (SK.tool === 'eraser' ? 'not-allowed' : 'crosshair');
  });
  if(act && (act.type === 'activeSelection' ? act.getObjects() : [act]).some(o => !o.selectable)) c.discardActiveObject();
  c.requestRenderAll();
}
function skLayersToggle() {
  const el = document.getElementById('sk-layers'); if(!el) return;
  const show = el.style.display === 'none';
  el.style.display = show ? '' : 'none';
  document.getElementById('sk-lay-btn')?.classList.toggle('gold', show);
  if(show) skLayersPaint();
}
function skLayersPaint() {
  const el = document.getElementById('sk-layers'); if(!el || !SK || el.style.display === 'none') return;
  const meta = SK.meta, c = SK.canvas, act = c.getActiveObjects().filter(o => !o.skDimOf), cnt = id => c.getObjects().filter(o => o.skLayer === id && !o.skDimOf).length;
  const rows = meta.layers.slice().reverse().map(l => `<div class="sk-ly${l.id === meta.active ? ' on' : ''}" data-ly="${l.id}">
    <button data-a="vis" class="${l.vis === false ? 'off' : ''}" title="${l.vis === false ? 'Показать' : 'Скрыть'}">${l.vis === false ? '🙈' : '👁'}</button>
    <button data-a="lock" class="${l.lock ? '' : 'off'}" title="${l.lock ? 'Снять замок' : 'Запереть'}">${l.lock ? '🔒' : '🔓'}</button>
    <span class="nm">${skEsc(l.name)} <span style="color:var(--t3)">${cnt(l.id)}</span></span>
    ${act.length && l.id !== 'dims' && l.id !== meta.active ? `<button data-a="move" title="Перенести выделенное в этот слой">⇢</button>` : ''}
    <button data-a="menu" title="Ещё">⋯</button></div>`).join('');
  el.innerHTML = `<div class="sk-ih" style="cursor:default">Слои<span class="sm"></span><button class="sk-ib" style="height:26px;min-width:26px;font-size:13px" data-a="add" title="Новый слой">＋</button><button class="sk-ib" style="height:26px;min-width:26px;font-size:13px" data-a="close">✕</button></div>${rows}
    <div style="padding:6px 10px 8px;color:var(--t3);font-size:11px">Новые фигуры попадают в отмеченный слой.</div>`;
  el.onclick = e => {
    const b = e.target.closest('[data-a]'), row = e.target.closest('[data-ly]'), id = row && row.dataset.ly, L = id && meta.layers.find(l => l.id === id);
    const a = b && b.dataset.a;
    if(a === 'close') { skLayersToggle(); return; }
    if(a === 'add') { const n = meta.layers.filter(l => l.id !== 'dims').length + 1, nl = { id: 'l' + Date.now().toString(36), name: 'Слой ' + n, vis: true, lock: false }; const di = meta.layers.findIndex(l => l.id === 'dims'); di < 0 ? meta.layers.push(nl) : meta.layers.splice(di, 0, nl); meta.active = nl.id; }
    else if(!L) return;
    else if(a === 'vis') { L.vis = L.vis === false; }
    else if(a === 'lock') { L.lock = !L.lock; }
    else if(a === 'move') { act.forEach(o => { o.skLayer = id; }); c.discardActiveObject(); }
    else if(a === 'menu') { skLayerMenu(L, b); return; }
    else if(id !== 'dims' && id !== 'under') { meta.active = id; }
    skApplyLayers(); skDimsAll(); skLayersPaint(); skCommit();
  };
}
function skLayerMenu(L, anchor) {
  const meta = SK.meta, i = meta.layers.indexOf(L), c = SK.canvas;
  const items = [];
  if(L.id !== 'dims') items.push(['🔤 Переименовать', () => { const t = prompt('Название слоя', L.name); if(t && t.trim()) { L.name = t.trim(); skLayersPaint(); skCommit(); } }]);
  if(L.id !== 'dims' && i < meta.layers.length - 1 && meta.layers[i + 1].id !== 'dims') items.push(['⬆ Выше', () => { meta.layers.splice(i, 1); meta.layers.splice(i + 1, 0, L); skApplyLayers(); skLayersPaint(); skCommit(); }]);
  if(L.id !== 'dims' && i > 0) items.push(['⬇ Ниже', () => { meta.layers.splice(i, 1); meta.layers.splice(i - 1, 0, L); skApplyLayers(); skLayersPaint(); skCommit(); }]);
  if(L.id === 'dims' || meta.layers.filter(l => l.id !== 'dims').length > 1) items.push(['<span style="color:var(--red)">🗑 Удалить слой</span>', () => {
    const objs = c.getObjects().filter(o => o.skLayer === L.id);
    if(objs.length && !confirm('Удалить слой «' + L.name + '» вместе с ' + skPlural(objs.length, 'фигурой', 'фигурами', 'фигурами') + '?')) return;
    SK.dimBusy = true; objs.forEach(o => c.remove(o)); SK.dimBusy = false;
    objs.forEach(o => { if(o.skId) skDimsRemove(o.skId); });
    if(L.id === 'dims') c.getObjects().forEach(o => { if(o.skDims) o.skDims = false; });
    meta.layers.splice(meta.layers.indexOf(L), 1);
    SK.meta = skMetaFix(meta); skApplyLayers(); skLayersPaint(); skInfo(); skCommit();
  }]);
  skMenu(anchor, items);
}

// ── привязка ──
function skSnapCands(skip) {
  const c = SK.canvas, pts = [];
  c.getObjects().forEach(o => {
    if(o === skip || o.skDimOf || !o.visible) return;
    try {
      if(['rect', 'ellipse', 'triangle', 'image', 'skWarpImage', 'group'].includes(o.type) && !o.skDim) { const q = skCorners(o); if(o.type === 'triangle') pts.push({ x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 }, q[2], q[3]); else if(o.type === 'ellipse') pts.push({ x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 }, { x: (q[1].x + q[2].x) / 2, y: (q[1].y + q[2].y) / 2 }, { x: (q[2].x + q[3].x) / 2, y: (q[2].y + q[3].y) / 2 }, { x: (q[3].x + q[0].x) / 2, y: (q[3].y + q[0].y) / 2 }); else pts.push(...q); pts.push(o.getCenterPoint()); }
      else if(o.type === 'line') { const e = skLineEnds(o); pts.push(e[0], e[1], { x: (e[0].x + e[1].x) / 2, y: (e[0].y + e[1].y) / 2 }); }
      else if(o.skDim) { const e = skDimWorld(o); if(e) pts.push(e[0], e[1]); }
    } catch(e) {}
  });
  return pts;
}
function skSnap(p, skip) { // точка → ближайший угол/конец фигуры (в 10 px экрана) или узел сетки
  if(!SK) return p;
  const z = SK.canvas.getZoom();
  if(SK.meta.snapObj) {
    if(!SK.snapCands) SK.snapCands = skSnapCands(skip);
    let best = null, bd = 10 / z;
    SK.snapCands.forEach(q => { const d = Math.hypot(q.x - p.x, q.y - p.y); if(d < bd) { bd = d; best = q; } });
    if(best) { skSnapMark(best); return { x: best.x, y: best.y }; }
  }
  skSnapMark(null);
  if(SK.meta.snapGrid) { const s = skGridStep().px; return { x: Math.round(p.x / s) * s, y: Math.round(p.y / s) * s }; }
  return p;
}
function skSnapMark(p) {
  const m = document.getElementById('sk-snapmk'); if(!m) return;
  if(!p) { m.style.display = 'none'; return; }
  const q = fabric.util.transformPoint(new fabric.Point(p.x, p.y), SK.canvas.viewportTransform);
  m.style.left = q.x + 'px'; m.style.top = q.y + 'px'; m.style.display = 'block';
}
function skGridMove(o) { // перетаскивание фигуры с привязкой к сетке: левый верхний угол — в узел
  if(!o || !SK.meta.snapGrid) return;
  const s = skGridStep().px, r = o.getBoundingRect(true, true);
  const dx = Math.round(r.left / s) * s - r.left, dy = Math.round(r.top / s) * s - r.top;
  o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords();
}

// ── настройки листа: масштаб, единицы, привязка ──
function skSheetMenu(btn) {
  document.getElementById('sk-pop-bk')?.remove();
  const m = SK.meta;
  const bk = document.createElement('div'); bk.id = 'sk-pop-bk'; bk.setAttribute('style', 'position:fixed;inset:0;z-index:2001');
  const pop = document.createElement('div'); pop.className = 'sk-pop';
  const paint = () => {
    pop.innerHTML = `<b>📐 Лист</b>
      <div style="color:var(--t3);margin-top:8px">Масштаб</div><div class="seg">${SK_SCALES.map(v => `<button data-sc="${v}" class="${m.scale === v ? 'on' : ''}">1:${v}</button>`).join('')}</div>
      <div style="color:var(--t3)">Единицы</div><div class="seg">${Object.keys(SK_UNITS).map(u => `<button data-un="${u}" class="${m.unit === u ? 'on' : ''}">${SK_UNITS[u].s}</button>`).join('')}</div>
      <label class="sk-chk"><input type="checkbox" data-ck="snapObj" ${m.snapObj ? 'checked' : ''}> Привязка к углам и концам</label>
      <label class="sk-chk"><input type="checkbox" data-ck="snapGrid" ${m.snapGrid ? 'checked' : ''}> Привязка к сетке</label>
      <label class="sk-chk"><input type="checkbox" data-ck="autoDims" ${m.autoDims ? 'checked' : ''}> Размеры у новых фигур</label>
      <div style="color:var(--t3);font-size:11px;margin-top:10px;line-height:1.4">При смене масштаба реальные размеры фигур не меняются — меняется их размер на листе.</div>`;
  };
  paint();
  pop.onclick = e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.sc) skSetScale(+b.dataset.sc);
    else if(b.dataset.un) { m.unit = b.dataset.un; skDimsAll(); skCommit(); }
    paint(); skPaintProps(); skInfo(); skGrid();
  };
  pop.onchange = e => { const k = e.target.dataset.ck; if(k) { m[k] = e.target.checked; skCommit(); } };
  bk.appendChild(pop); bk.onclick = () => bk.remove();
  document.body.appendChild(bk);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8) + 'px';
}
function skSetScale(ns) { // реальные размеры сохраняются: всё на листе растягивается в old/new раз
  const m = SK.meta, k = m.scale / ns; if(k === 1) return;
  const c = SK.canvas; c.discardActiveObject();
  SK.dimBusy = true;
  c.getObjects().filter(o => !o.skDim).forEach(o => {
    if(o.type === 'i-text' || o.type === 'text') o.set({ left: o.left * k, top: o.top * k });
    else o.set({ left: o.left * k, top: o.top * k, scaleX: o.scaleX * k, scaleY: o.scaleY * k });
    o.setCoords();
  });
  c.getObjects().filter(o => o.skDim && !o.skDimOf).forEach(g => skDimRebuild(g, true, k));
  SK.dimBusy = false;
  m.scale = ns;
  const v = c.viewportTransform; c.setViewportTransform([v[0] / k, 0, 0, v[3] / k, v[4], v[5]]);
  skDimsAll(); skGrid(); skCommit();
}

// ── панель «Размеры» у выделенной фигуры ──
let _skInfoOpen = false;
function skInfo() {
  const el = document.getElementById('sk-info'); if(!el || !SK) return;
  if(SK.edit) { skEditPanel(el); return; } // режим «Узлы» или «Искажение» — своя панель
  const c = SK.canvas, act = c.getActiveObjects().filter(o => !o.skDimOf);
  if(!act.length) { el.innerHTML = ''; return; }
  const ae = document.activeElement; if(ae && el.contains(ae) && ae.tagName === 'INPUT' && ae.type === 'text') return; // не мешать вводу
  const u = SK_UNITS[SK.meta.unit].s;
  const inp = (k, label, mm, unit) => `<div class="sk-row"><span class="k">${label}</span><input type="text" inputmode="decimal" data-f="${k}" value="${mm == null ? '' : String(skNum(mm / SK_UNITS[SK.meta.unit].k, SK_UNITS[SK.meta.unit].d + 1)).replace(/\s/g, '').replace(/,?0+$/, '')}" placeholder="—"><span class="u">${unit || u}</span></div>`;
  let head, body = '';
  if(act.length > 1) {
    let area = 0, n = 0; act.forEach(o => { const s = skShape(o); if(s && s.area) { area += s.area; n++; } });
    head = 'Выбрано: ' + act.length; const sm = n ? 'площадь ' + skFmtArea(area) : '';
    body = n ? `<div class="sk-res">Общая площадь (${n}): <b>${skFmtArea(area)}</b></div>` : '<div style="color:var(--t3)">У выделенного нет площади</div>';
    el.innerHTML = `<div class="sk-ih" data-tg="1">${head}<span class="sm">${sm}</span>▾</div><div class="sk-ib2">${body}</div>`;
  } else {
    const o = act[0], sh = skShape(o);
    if(!sh) { el.innerHTML = ''; return; }
    const H = o.skH || null;
    let sm = '';
    if(sh.kind === 'rect' || sh.kind === 'ellipse') {
      body = inp('w', 'Ширина', sh.w) + inp('h', 'Длина', sh.h) + inp('H', 'Высота', H) +
        `<div class="sk-row"><span class="k">Поворот</span><input type="text" inputmode="decimal" data-f="ang" value="${Math.round(o.angle || 0)}"><span class="u">°</span></div>` +
        `<div class="sk-res">Площадь <b>${skFmtArea(sh.area)}</b><br>${sh.kind === 'rect' ? 'Периметр' : 'Длина окружности'} <b>${skFmtPer(sh.per)}</b>${H ? `<br>Объём <b>${skFmtVol(sh.area * H)}</b><br>Площадь стен <b>${skFmtArea(sh.per * H)}</b>` : ''}</div>`;
      sm = skFmtLen(sh.w) + ' × ' + skFmtLen(sh.h) + ' · ' + skFmtArea(sh.area);
    } else if(sh.kind === 'img') {
      const L = SK.meta.layers.find(l => l.id === o.skLayer), under = o.skLayer === 'under';
      body = inp('w', 'Ширина', sh.w) + inp('h', 'Высота', sh.h) +
        `<div class="sk-row"><span class="k">Прозрачн.</span><input type="range" min="10" max="100" value="${Math.round((o.opacity ?? 1) * 100)}" data-op="1" style="flex:1;accent-color:var(--accent)"></div>` +
        `<div style="display:flex;gap:6px;margin-top:6px"><button class="sk-ib" style="flex:1;font-size:12px" onclick="skCalibStart()">📏 Калибровать</button><button class="sk-ib" style="flex:1;font-size:12px" onclick="skUnderlay(${under ? 'false' : 'true'})">${under ? 'Не подложка' : 'Подложка'}</button></div>` +
        `<div style="color:var(--t3);font-size:11px;margin-top:6px;line-height:1.4">Калибровка: отметь на картинке две точки, расстояние между которыми знаешь, — картинка встанет в масштаб листа.</div>`;
      sm = skFmtLen(sh.w) + ' × ' + skFmtLen(sh.h);
    } else if(sh.kind === 'grp') {
      body = inp('w', 'Ширина', sh.w) + inp('h', 'Длина', sh.h) +
        `<div class="sk-row"><span class="k">Поворот</span><input type="text" inputmode="decimal" data-f="ang" value="${Math.round(o.angle || 0)}"><span class="u">°</span></div>`;
      sm = skFmtLen(sh.w) + ' × ' + skFmtLen(sh.h);
    } else if(sh.kind === 'tri') {
      body = inp('w', 'Основание', sh.w) + inp('h', 'Высота', sh.h) + `<div class="sk-res">Площадь <b>${skFmtArea(sh.area)}</b><br>Периметр <b>${skFmtPer(sh.per)}</b></div>`;
      sm = skFmtArea(sh.area);
    } else if(sh.kind === 'line') {
      body = inp('len', 'Длина', sh.len) + `<div class="sk-res">Угол <b>${sh.ang}°</b></div>`;
      sm = skFmtLen(sh.len);
    } else {
      body = `<div class="sk-res">Длина <b>${skFmtLen(sh.len)}</b></div>`; sm = skFmtLen(sh.len);
    }
    if(sh.kind === 'poly') { body = `<div class="sk-res">Площадь <b>${skFmtArea(sh.area)}</b><br>Периметр <b>${skFmtPer(sh.per)}</b></div>`; sm = skFmtArea(sh.area); }
    if(['rect', 'ellipse', 'tri', 'line'].includes(sh.kind)) body += `<label class="sk-chk"><input type="checkbox" data-ck="dims" ${o.skDims ? 'checked' : ''}> Размеры на листе</label>`;
    const canN = skCanNodes(o), canW = skCanWarp(o);
    if(canN || canW) body += `<div style="display:flex;gap:6px;margin-top:8px">${canN ? `<button class="sk-ib" style="flex:1;font-size:12px" onclick="skNodesStart()">✎ Узлы</button>` : ''}${canW ? `<button class="sk-ib" style="flex:1;font-size:12px" onclick="skWarpStart()">⧉ Искажение</button>` : ''}</div>`;
    el.innerHTML = `<div class="sk-ih" data-tg="1">${sh.name}<span class="sm">${sm}</span>▾</div><div class="sk-ib2">${body}</div>`;
  }
  el.classList.toggle('open', _skInfoOpen);
  el.onclick = e => { if(e.target.closest('[data-tg]')) { _skInfoOpen = !_skInfoOpen; el.classList.toggle('open', _skInfoOpen); } };
  el.onchange = e => {
    const o = c.getActiveObject(); if(!o) return;
    if(e.target.dataset.op) { skCommit(); return; }
    if(e.target.dataset.ck === 'dims') { o.skDims = e.target.checked; skDimsFor(o); skCommit(); skInfo(); return; }
    const f = e.target.dataset.f; if(!f) return;
    if(f === 'ang') { const a = parseFloat(String(e.target.value).replace(',', '.')); if(isFinite(a)) { o.rotate(a); o.setCoords(); } }
    else if(f === 'H') { const v = String(e.target.value).trim() ? skParseLen(e.target.value) : null; o.skH = v || null; }
    else {
      const mm = skParseLen(e.target.value); if(!mm) { toast('Не понял число', true); skInfo(); return; }
      skSetSize(o, f, mm / skMmPx());
    }
    skDimsFor(c.getActiveObject()); c.requestRenderAll(); skCommit(); e.target.blur(); skInfo();
  };
  el.oninput = e => { if(e.target.dataset.op) { const o = c.getActiveObject(); if(o) { o.set('opacity', e.target.value / 100); c.requestRenderAll(); } } };
  el.onkeydown = e => { if(e.key === 'Enter') e.target.blur(); e.stopPropagation(); };
}
function skSetSize(o, f, px) { // задать размер фигуры в пикселях листа
  const c = SK.canvas;
  if(o.type === 'image' || o.type === 'skWarpImage') { const k = px / (f === 'w' ? o.width : o.height); o.set({ scaleX: k, scaleY: k }); } // пропорции картинки сохраняются
  else if(o.type === 'group') { if(f === 'w') o.set({ scaleX: px / o.width }); if(f === 'h') o.set({ scaleY: px / o.height }); }
  else if(o.type === 'rect' || o.type === 'triangle') { if(f === 'w') o.set({ width: px, scaleX: 1 }); if(f === 'h') o.set({ height: px, scaleY: 1 }); }
  else if(o.type === 'ellipse') { if(f === 'w') o.set({ rx: px / 2, scaleX: 1 }); if(f === 'h') o.set({ ry: px / 2, scaleY: 1 }); }
  else if(o.type === 'line' && f === 'len') {
    const e = skLineEnds(o), L = Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y) || 1;
    const p2 = { x: e[0].x + (e[1].x - e[0].x) / L * px, y: e[0].y + (e[1].y - e[0].y) / L * px };
    const n = new fabric.Line([e[0].x, e[0].y, p2.x, p2.y], { stroke: o.stroke, strokeWidth: o.strokeWidth, strokeUniform: true, strokeLineCap: o.strokeLineCap, fill: '', skId: o.skId, skLayer: o.skLayer, skDims: o.skDims });
    const idx = c.getObjects().indexOf(o);
    c.remove(o); c.insertAt(n, idx); skApplyLayers(); c.setActiveObject(n);
    return;
  }
  o.setCoords();
}


// ═══════════════════════════════════════════
//  ЭТАП 3 (19 ноября): картинки и фото, подложка с калибровкой, библиотека фигур и «Мои фигуры».
//  Картинки уменьшаются до 2000 px и загружаются в attachments/sketch-img/<id листа>/;
//  пока нет связи — остаются внутри листа (data URL). PDF — первая страница через pdf.js (грузится по требованию).
//  «Мои фигуры» — скрытая строка sketches с title '__lib__' (data.items), видна на всех устройствах.
// ═══════════════════════════════════════════
const SK_IMG_MAX = 2000;
function skViewCenter() { const c = SK.canvas, inv = fabric.util.invertTransform(c.viewportTransform); return fabric.util.transformPoint(new fabric.Point(c.width / 2, c.height / 2), inv); }
function skPlace(o, wantPx) { // поставить в середину видимой части листа; wantPx — ширина на листе
  const c = SK.canvas;
  if(wantPx && o.width) { const k = wantPx / o.width; o.set({ scaleX: k, scaleY: k }); }
  const p = skViewCenter(), w = o.width * o.scaleX, h = o.height * o.scaleY;
  o.set({ left: p.x - w / 2, top: p.y - h / 2, originX: 'left', originY: 'top' }); o.setCoords();
  c.add(o); skApplyLayers(); skSetTool('sel'); c.setActiveObject(o); c.requestRenderAll(); skInfo();
}
function skViewWidth() { return SK.canvas.width / SK.canvas.getZoom(); }
function skPickImage() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.svg,.pdf,application/pdf'; inp.multiple = true;
  inp.onchange = () => { [...inp.files].forEach((f, i) => setTimeout(() => skAddFile(f), i * 150)); };
  inp.click();
}
function skReadText(f) { return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsText(f); }); }
function skBlobUrl(b) { return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(b); }); }
async function skShrink(blob, max) { // картинка → не больше max px по длинной стороне; PNG остаётся PNG (прозрачность), остальное → JPEG
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('картинка не открылась')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
    const png = /png|gif|webp/.test(blob.type || '');
    const g = cv.getContext('2d'); if(!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
    g.drawImage(img, 0, 0, cv.width, cv.height);
    const type = png ? 'image/png' : 'image/jpeg';
    const out = await new Promise(ok => cv.toBlob(ok, type, .88));
    return { blob: out, type, ext: png ? 'png' : 'jpg' };
  } finally { URL.revokeObjectURL(url); }
}
function skLoadScript(src) { return new Promise((ok, bad) => { if([...document.scripts].some(s => s.src === src)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('нет связи')); document.head.appendChild(s); }); }
async function skPdfBlob(file) { // первая страница PDF → PNG
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  await skLoadScript(base + 'pdf.min.js');
  const lib = window.pdfjsLib; if(!lib) throw new Error('PDF не открылся');
  lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise, page = await doc.getPage(1);
  const v1 = page.getViewport({ scale: 1 }), sc = Math.min(4, SK_IMG_MAX / Math.max(v1.width, v1.height)), vp = page.getViewport({ scale: sc });
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return await new Promise(ok => cv.toBlob(ok, 'image/png'));
}
async function skUpload(blob, folder, ext, type) { // → публичный адрес или '' (тогда картинка останется внутри листа)
  if(typeof sb === 'undefined' || !navigator.onLine) return '';
  try {
    const path = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    const { error } = await sb.storage.from('attachments').upload(path, blob, { contentType: type, upsert: true });
    if(error) throw error;
    return sb.storage.from('attachments').getPublicUrl(path).data.publicUrl;
  } catch(e) { console.log('sk upload', e.message || e); return ''; }
}
function skImgFromUrl(url) { return new Promise((ok, bad) => fabric.Image.fromURL(url, img => img && img.width ? ok(img) : bad(new Error('картинка не открылась')), { crossOrigin: 'anonymous' })); }
function skSvgGroup(txt) {
  return new Promise((ok, bad) => fabric.loadSVGFromString(txt, (objs, opts) => {
    if(!objs || !objs.length) return bad(new Error('в SVG нет фигур'));
    objs.forEach(o => o.set({ strokeUniform: true }));
    ok(objs.length === 1 && objs[0].type !== 'image' ? objs[0] : fabric.util.groupSVGElements(objs, opts));
  }));
}
async function skAddFile(file) {
  if(!SK || !file) return;
  const name = (file.name || 'Картинка').replace(/\.[^.]+$/, '');
  try {
    skSetStatus('загружаю картинку…');
    if(/svg/.test(file.type) || /\.svg$/i.test(file.name || '')) {
      const g = await skSvgGroup(await skReadText(file)); g.skName = name;
      skPlace(g, skViewWidth() * .4); skCommit(); return;
    }
    let blob = file;
    if(/pdf/.test(file.type) || /\.pdf$/i.test(file.name || '')) blob = await skPdfBlob(file);
    const sh = await skShrink(blob, SK_IMG_MAX);
    const img = await skImgFromUrl(await skBlobUrl(sh.blob));
    img.skName = name;
    skPlace(img, Math.min(img.width, skViewWidth() * .6)); skCommit();
    const url = await skUpload(sh.blob, 'sketch-img/' + SK.id, sh.ext, sh.type);
    if(url && SK && SK.canvas.getObjects().includes(img)) { // в листе — ссылка на облако; если не открылась — остаётся копия внутри листа
      const local = img.getSrc();
      img.setSrc(url, (o, err) => { if(!SK) return; if(err || !o.width) { o.setSrc(local, () => SK && SK.canvas.requestRenderAll()); return; } SK.canvas.requestRenderAll(); skCommit(); }, { crossOrigin: 'anonymous' });
    }
  } catch(e) { toast('Не получилось вставить: ' + (e.message || e), true); skSetStatus(''); }
}
// Ctrl+V и перетаскивание файла на лист (ПК)
document.addEventListener('paste', e => {
  if(!SK || !document.getElementById('sk-ov')) return;
  const a = SK.canvas.getActiveObject(); if((a && a.isEditing) || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
  const files = [...(e.clipboardData && e.clipboardData.files || [])].filter(f => /image|pdf|svg/.test(f.type));
  if(files.length) { e.preventDefault(); files.forEach(skAddFile); }
});
document.addEventListener('dragover', e => { if(SK && e.target.closest && e.target.closest('#sk-stage')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if(!SK || !e.target.closest || !e.target.closest('#sk-stage')) return;
  e.preventDefault(); [...(e.dataTransfer && e.dataTransfer.files || [])].forEach(skAddFile);
});

// ── калибровка картинки по двум точкам ──
function skCalibStart() {
  const o = SK && SK.canvas.getActiveObject(); if(!o || o.type !== 'image') return;
  SK.calib = { img: o, pts: [], tmp: [] };
  SK.canvas.discardActiveObject(); skSetTool('calib');
  toast('Отметь на картинке первую точку');
}
function skCalibPoint(p) {
  const K = SK.calib; if(!K) { skSetTool('sel'); return; }
  const c = SK.canvas, z = c.getZoom();
  K.pts.push(p);
  SK.mute = true;
  const dot = new fabric.Circle({ left: p.x, top: p.y, radius: 5 / z, originX: 'center', originY: 'center', fill: '#e8c56a', stroke: '#1f1f1f', strokeWidth: 1 / z, selectable: false, evented: false, excludeFromExport: true });
  c.add(dot); K.tmp.push(dot);
  if(K.pts.length === 2) { const ln = new fabric.Line([K.pts[0].x, K.pts[0].y, p.x, p.y], { stroke: '#e8c56a', strokeWidth: 2 / z, strokeDashArray: [6 / z, 4 / z], selectable: false, evented: false }); c.add(ln); K.tmp.push(ln); }
  SK.mute = false; c.requestRenderAll();
  if(K.pts.length < 2) { toast('Теперь вторую точку'); return; }
  setTimeout(() => {
    const [a, b] = K.pts, d = Math.hypot(b.x - a.x, b.y - a.y);
    const v = prompt('Реальное расстояние между точками, ' + SK_UNITS[SK.meta.unit].s + ':', '');
    SK.mute = true; K.tmp.forEach(o => c.remove(o)); SK.mute = false;
    SK.calib = null; skSetTool('sel');
    const mm = skParseLen(v);
    if(!mm || d < 1) { if(v != null) toast('Не понял число', true); c.setActiveObject(K.img); skInfo(); return; }
    const f = (mm / skMmPx()) / d, img = K.img;
    img.set({ scaleX: img.scaleX * f, scaleY: img.scaleY * f, left: a.x + (img.left - a.x) * f, top: a.y + (img.top - a.y) * f }); img.setCoords();
    c.setActiveObject(img); c.requestRenderAll(); skInfo(); skCommit();
    toast('✓ Картинка в масштабе листа 1:' + SK.meta.scale);
  }, 60);
}

// ── подложка ──
function skUnderlay(on) {
  const c = SK.canvas, o = c.getActiveObject(); if(!o) return;
  const m = SK.meta;
  if(on) {
    if(!m.layers.some(l => l.id === 'under')) m.layers.unshift({ id: 'under', name: 'Подложка', vis: true, lock: true });
    o.skLayer = 'under'; o.set('opacity', Math.min(o.opacity ?? 1, .45));
    c.discardActiveObject();
    toast('Подложка заперта — снять замок можно в «Слоях»');
  } else { o.skLayer = m.active; o.set('opacity', 1); }
  skApplyLayers(); skLayersPaint(); skInfo(); skCommit();
}

// ── библиотека фигур (размеры в сантиметрах) ──
const SK_LIB = [
  { cat: 'Архитектура', items: [
    { n: 'Дверь 80', w: 80, h: 80, s: '<path d="M0 0V80" stroke-width="3"/><path d="M80 0A80 80 0 0 1 0 80" stroke-dasharray="5 4"/><path d="M0 0H80" stroke-width="1"/>' },
    { n: 'Дверь 90', w: 90, h: 90, s: '<path d="M0 0V90" stroke-width="3"/><path d="M90 0A90 90 0 0 1 0 90" stroke-dasharray="5 4"/><path d="M0 0H90" stroke-width="1"/>' },
    { n: 'Дверь двойная 140', w: 140, h: 70, s: '<path d="M0 0V70M140 0V70" stroke-width="3"/><path d="M70 0A70 70 0 0 1 0 70M70 0A70 70 0 0 0 140 70" stroke-dasharray="5 4"/><path d="M0 0H140" stroke-width="1"/>' },
    { n: 'Окно 120', w: 120, h: 20, s: '<rect width="120" height="20" fill="#fff"/><path d="M0 8H120M0 12H120"/>' },
    { n: 'Окно 180', w: 180, h: 20, s: '<rect width="180" height="20" fill="#fff"/><path d="M0 8H180M0 12H180M90 0V20"/>' },
    { n: 'Лестница 100×300', w: 100, h: 300, s: '<rect width="100" height="300" fill="#fff"/>' + Array.from({ length: 10 }, (_, i) => `<path d="M0 ${28 * (i + 1)}H100"/>`).join('') + '<path d="M50 290V20M40 35L50 20L60 35" stroke-width="2"/>' },
    { n: 'Колонна 40×40', w: 40, h: 40, s: '<rect width="40" height="40" fill="#ddd"/><path d="M0 0L40 40M40 0L0 40"/>' },
    { n: 'Колонна ⌀40', w: 40, h: 40, s: '<circle cx="20" cy="20" r="20" fill="#ddd"/>' }
  ] },
  { cat: 'Мебель', items: [
    { n: 'Кровать 160×200', w: 160, h: 200, s: '<rect width="160" height="200" rx="4" fill="#fff"/><rect x="10" y="8" width="65" height="30" rx="6" fill="#fff"/><rect x="85" y="8" width="65" height="30" rx="6" fill="#fff"/><path d="M0 60H160"/>' },
    { n: 'Кровать 90×200', w: 90, h: 200, s: '<rect width="90" height="200" rx="4" fill="#fff"/><rect x="10" y="8" width="70" height="30" rx="6" fill="#fff"/><path d="M0 60H90"/>' },
    { n: 'Диван 200×90', w: 200, h: 90, s: '<rect width="200" height="90" rx="8" fill="#fff"/><rect x="0" y="0" width="200" height="22" rx="6" fill="#fff"/><rect x="0" y="0" width="20" height="90" rx="6" fill="#fff"/><rect x="180" y="0" width="20" height="90" rx="6" fill="#fff"/><path d="M100 22V90"/>' },
    { n: 'Угловой диван', w: 250, h: 170, s: '<path d="M0 0H250V90H90V170H0Z" fill="#fff"/><path d="M20 20H250M20 20V170M90 90V20"/>' },
    { n: 'Кресло 80×80', w: 80, h: 80, s: '<rect width="80" height="80" rx="8" fill="#fff"/><rect width="80" height="20" rx="6" fill="#fff"/><rect width="15" height="80" rx="5" fill="#fff"/><rect x="65" width="15" height="80" rx="5" fill="#fff"/>' },
    { n: 'Стол 120×80', w: 120, h: 80, s: '<rect width="120" height="80" fill="#fff"/>' },
    { n: 'Стол ⌀100', w: 100, h: 100, s: '<circle cx="50" cy="50" r="50" fill="#fff"/>' },
    { n: 'Стул 45×45', w: 45, h: 50, s: '<rect y="5" width="45" height="45" rx="4" fill="#fff"/><path d="M3 4H42" stroke-width="3"/>' },
    { n: 'Шкаф 200×60', w: 200, h: 60, s: '<rect width="200" height="60" fill="#fff"/><path d="M0 0L200 60M200 0L0 60" stroke-dasharray="4 4"/><path d="M0 55H200"/>' },
    { n: 'Тумба 60×40', w: 60, h: 40, s: '<rect width="60" height="40" fill="#fff"/><path d="M0 35H60"/>' },
    { n: 'Письменный стол 140×70', w: 140, h: 70, s: '<rect width="140" height="70" fill="#fff"/><rect x="95" y="0" width="45" height="70" fill="#fff"/>' }
  ] },
  { cat: 'Кухня и ванная', items: [
    { n: 'Ванна 170×75', w: 170, h: 75, s: '<rect width="170" height="75" rx="6" fill="#fff"/><rect x="8" y="8" width="154" height="59" rx="25" fill="#fff"/><circle cx="150" cy="37.5" r="3"/>' },
    { n: 'Душ 90×90', w: 90, h: 90, s: '<rect width="90" height="90" fill="#fff"/><path d="M0 0L90 90M90 0L0 90"/><circle cx="45" cy="45" r="4"/>' },
    { n: 'Унитаз', w: 40, h: 65, s: '<rect width="40" height="18" rx="3" fill="#fff"/><ellipse cx="20" cy="42" rx="18" ry="23" fill="#fff"/>' },
    { n: 'Раковина 60×45', w: 60, h: 45, s: '<rect width="60" height="45" rx="4" fill="#fff"/><ellipse cx="30" cy="25" rx="22" ry="15" fill="#fff"/><circle cx="30" cy="8" r="2"/>' },
    { n: 'Мойка кухонная 80×50', w: 80, h: 50, s: '<rect width="80" height="50" fill="#fff"/><rect x="6" y="8" width="44" height="36" rx="5" fill="#fff"/><rect x="56" y="8" width="18" height="36" rx="4" fill="#fff"/>' },
    { n: 'Плита 60×60', w: 60, h: 60, s: '<rect width="60" height="60" fill="#fff"/><circle cx="17" cy="17" r="10"/><circle cx="43" cy="17" r="8"/><circle cx="17" cy="43" r="8"/><circle cx="43" cy="43" r="10"/>' },
    { n: 'Холодильник 60×65', w: 60, h: 65, s: '<rect width="60" height="65" fill="#fff"/><path d="M0 58H60"/><text x="30" y="38" font-size="18" text-anchor="middle" stroke="none" fill="#1f1f1f" font-family="sans-serif">Х</text>' },
    { n: 'Стиральная машина 60×60', w: 60, h: 60, s: '<rect width="60" height="60" fill="#fff"/><circle cx="30" cy="32" r="20"/><circle cx="30" cy="32" r="13"/>' },
    { n: 'Кухонный модуль 60×60', w: 60, h: 60, s: '<rect width="60" height="60" fill="#fff"/><path d="M0 55H60"/>' }
  ] }
];
function skLibSvg(it) { // фигура → SVG с размерами в сантиметрах
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${it.w} ${it.h}" width="${it.w}" height="${it.h}" overflow="visible"><g fill="none" stroke="#1f1f1f" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${it.s}</g></svg>`;
}
let _skLibTab = 0, _skMine = null;
function skLibToggle() {
  let el = document.getElementById('sk-lib');
  if(el) { el.remove(); document.querySelector('[data-tool="lib"]')?.classList.remove('on'); return; }
  const side = document.getElementById('sk-side'); if(!side) return;
  el = document.createElement('div'); el.id = 'sk-lib'; el.className = 'sk-lib';
  side.insertBefore(el, side.firstChild);
  document.querySelector('[data-tool="lib"]')?.classList.add('on');
  skLibPaint();
  if(!_skMine) skMineLoad().then(() => { if(_skLibTab === SK_LIB.length) skLibPaint(); });
}
function skLibPaint() {
  const el = document.getElementById('sk-lib'); if(!el) return;
  const tabs = SK_LIB.map(g => g.cat).concat(['⭐ Мои фигуры']);
  let grid, act = '';
  if(_skLibTab < SK_LIB.length) grid = SK_LIB[_skLibTab].items.map((it, i) => `<div class="it" data-i="${i}" title="${skEsc(it.n)}">${skLibSvg(it)}<span>${skEsc(it.n)}</span></div>`).join('');
  else {
    const mine = (_skMine && _skMine.items) || [];
    grid = mine.length ? mine.map((it, i) => `<div class="it" data-m="${i}" title="${skEsc(it.name)}">${it.svg ? it.svg.replace(/<svg/, '<svg preserveAspectRatio="xMidYMid meet"') : `<img src="${skEsc(it.url)}" alt="">`}<span>${skEsc(it.name)}</span><button class="x" data-del="${i}" title="Удалить">✕</button></div>`).join('')
      : `<div style="grid-column:1/-1;color:var(--t3);padding:12px 4px;text-align:center">${_skMine ? 'Здесь будут твои фигуры' : 'Загружаю…'}</div>`;
    act = `<div class="act"><button data-a="sel">＋ Выделенное</button><button data-a="file">📥 SVG или картинка</button></div>`;
  }
  el.innerHTML = `<div class="sk-ih" style="cursor:default">Фигуры<span class="sm" style="color:var(--t3)">в масштабе листа</span><button class="sk-ib" style="height:26px;min-width:26px;font-size:13px" data-a="close">✕</button></div>
    <div class="tabs">${tabs.map((t, i) => `<button data-t="${i}" class="${i === _skLibTab ? 'on' : ''}">${t}</button>`).join('')}</div>${act}<div class="grid">${grid}</div>`;
  el.onclick = async e => {
    const t = e.target.closest('[data-t],[data-i],[data-m],[data-a],[data-del]'); if(!t) return;
    const d = t.dataset;
    if(d.a === 'close') return skLibToggle();
    if(d.t !== undefined) { _skLibTab = +d.t; return skLibPaint(); }
    if(d.del !== undefined) { e.stopPropagation(); if(confirm('Убрать из «Моих фигур»?')) { _skMine.items.splice(+d.del, 1); skMineSave(); skLibPaint(); } return; }
    if(d.i !== undefined) return skLibInsert(SK_LIB[_skLibTab].items[+d.i]);
    if(d.m !== undefined) return skMineInsert(_skMine.items[+d.m]);
    if(d.a === 'sel') return skMineAddSel();
    if(d.a === 'file') return skMineAddFile();
  };
}
async function skLibInsert(it) {
  try {
    const g = await skSvgGroup(skLibSvg(it));
    g.skName = it.n;
    const px = it.w * 10 / skMmPx(); // ширина в натуре (см → мм) → пиксели листа
    skPlace(g, px); skCommit(); skLibAfterInsert();
  } catch(e) { toast('Не получилось: ' + (e.message || e), true); }
}
function skLibAfterInsert() { if(innerWidth < 700 && document.getElementById('sk-lib')) skLibToggle(); } // на телефоне панель закрывается, чтобы было видно фигуру
// «Мои фигуры»
async function skMineId() {
  const key = 'mc_sk_lib_' + (currentUser && currentUser.id);
  let id = localStorage.getItem(key);
  if(!id && typeof sb !== 'undefined' && navigator.onLine) {
    try { const { data } = await sb.from('sketches').select('id,title').eq('title', '__lib__').limit(1); const r = (data || []).find(x => x.title === '__lib__'); if(r) id = r.id; } catch(e) {}
  }
  if(!id) id = skNewId();
  localStorage.setItem(key, id);
  return id;
}
async function skMineLoad() {
  const id = await skMineId();
  let rec = null;
  try { rec = await skLoadFull(id); } catch(e) {}
  _skMine = { id, items: (rec && rec.data && rec.data.items) || [] };
}
function skMineSave() {
  if(!_skMine) return;
  const rec = { id: _skMine.id, title: '__lib__', data: { items: _skMine.items }, thumb: '', links: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), dirty: true, pushedOnce: true };
  skLocalPut(rec); skPushLater(rec, 300);
}
async function skMineAddSel() {
  const c = SK.canvas, a = c.getActiveObject();
  if(!a) { toast('Сначала выдели фигуры на листе', true); return; }
  if(!_skMine) await skMineLoad();
  const name = prompt('Название фигуры', a.skName || 'Моя фигура'); if(name == null) return;
  const k = skMmPx();
  if(a.type === 'image' && /^https?:/.test(a.getSrc())) {
    _skMine.items.unshift({ id: skNewId(), name: name || 'Картинка', url: a.getSrc(), wmm: a.width * a.scaleX * k, hmm: a.height * a.scaleY * k });
  } else {
    const b = a.getBoundingRect(true, true);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.left} ${b.top} ${b.width} ${b.height}" width="${b.width}" height="${b.height}">${a.toSVG()}</svg>`;
    if(svg.length > 400000) { toast('Слишком сложная фигура для библиотеки', true); return; }
    _skMine.items.unshift({ id: skNewId(), name: name || 'Моя фигура', svg, wmm: b.width * k, hmm: b.height * k });
  }
  skMineSave(); _skLibTab = SK_LIB.length; skLibPaint(); toast('✓ Добавлено в «Мои фигуры»');
}
function skMineAddFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.svg';
  inp.onchange = async () => {
    const f = inp.files[0]; if(!f) return;
    if(!_skMine) await skMineLoad();
    const name = (f.name || 'Фигура').replace(/\.[^.]+$/, '');
    try {
      if(/svg/.test(f.type) || /\.svg$/i.test(f.name)) {
        const txt = await skReadText(f); if(txt.length > 400000) throw new Error('SVG слишком большой');
        _skMine.items.unshift({ id: skNewId(), name, svg: txt });
      } else {
        const sh = await skShrink(f, 1200);
        const url = await skUpload(sh.blob, 'sketch-lib/' + (currentUser && currentUser.id), sh.ext, sh.type);
        if(!url) throw new Error('нужен интернет');
        _skMine.items.unshift({ id: skNewId(), name, url });
      }
      skMineSave(); skLibPaint(); toast('✓ Добавлено в «Мои фигуры»');
    } catch(e) { toast('Не получилось: ' + (e.message || e), true); }
  };
  inp.click();
}
async function skMineInsert(it) {
  try {
    const o = it.svg ? await skSvgGroup(it.svg) : await skImgFromUrl(it.url);
    o.skName = it.name;
    skPlace(o, it.wmm ? it.wmm / skMmPx() : skViewWidth() * .35);
    if(it.wmm && it.hmm && o.height) { o.set({ scaleY: (it.hmm / skMmPx()) / o.height }); o.setCoords(); }
    skCommit(); skInfo(); skLibAfterInsert();
  } catch(e) { toast('Не получилось: ' + (e.message || e), true); }
}


// ═══════════════════════════════════════════
//  ЭТАП 4 (19 ноября): скетч-лист рядом с карточками.
//  Режимы окна: 'full' — во весь экран; 'side' — рядом (ПК: правая колонка, как календарь и галерея,
//  с общим разделителем и ⇄; телефон: справа, разделитель тянется); 'bottom' — под карточками (разделитель тянется);
//  «⧉ Отдельное окно» (ПК) — тот же лист в новом окне браузера (адрес ?sketch=<id>), его можно унести на второй монитор.
// ═══════════════════════════════════════════
const SK_DOCK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v16" stroke="currentColor" stroke-width="2"/><rect x="13" y="5" width="7" height="14" fill="currentColor" opacity=".35"/></svg>';
let _skDock = (() => { try { return localStorage.getItem('mc_sk_dock') || 'full'; } catch(e) { return 'full'; } })(), _skWantDock = null;
(function() { try { const h = localStorage.getItem('mc_sk_h'), w = localStorage.getItem('mc_sk_w'); if(h) document.documentElement.style.setProperty('--sk-h', h); if(w) document.documentElement.style.setProperty('--sk-w', w); } catch(e) {} })();
const skIsDesk = () => innerWidth >= 900;
function skUndock() {
  document.documentElement.classList.remove('sk-bottom', 'sk-side');
  document.body.classList.remove('sk-on');
}
function skApplyDock(mode) {
  const ov = document.getElementById('sk-ov'); if(!ov) return;
  if(mode === 'side' && !skIsDesk() && innerWidth < 600) mode = 'bottom'; // узкий телефон стоя — рядом не поместится
  skUndock();
  ov.querySelector(':scope > .sk-dh')?.remove();
  if(mode === 'side' && skIsDesk()) {
    document.body.classList.remove('cal-on', 'calc-on', 'gal-on', 'events-on', 'pane-full');
    document.body.classList.add('sk-on'); ov.style.zIndex = '999';
  } else if(mode === 'side' || mode === 'bottom') {
    document.documentElement.classList.add(mode === 'side' ? 'sk-side' : 'sk-bottom'); ov.style.zIndex = '999';
    skDockHandle(ov, mode === 'side' ? 'x' : 'y');
  } else { mode = 'full'; ov.style.zIndex = '2000'; }
  _skDock = mode;
  try { localStorage.setItem('mc_sk_dock', mode); } catch(e) {}
  setTimeout(() => { if(SK) { SK.canvas.setDimensions({ width: document.getElementById('sk-stage').clientWidth, height: document.getElementById('sk-stage').clientHeight }); skGrid(); } }, 30);
}
function skDockHandle(ov, axis) { // разделитель: тянуть — одна часть больше, другая меньше
  const h = document.createElement('div'); h.className = 'sk-dh'; h.title = 'Потяни, чтобы поменять размер';
  ov.appendChild(h);
  const root = document.documentElement;
  h.addEventListener('pointerdown', e => {
    e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch(_) {}
    const move = ev => {
      if(axis === 'y') { const v = Math.min(innerHeight - 120, Math.max(160, innerHeight - ev.clientY)); root.style.setProperty('--sk-h', v + 'px'); }
      else { const v = Math.min(innerWidth - 160, Math.max(220, innerWidth - ev.clientX)); root.style.setProperty('--sk-w', v + 'px'); }
    };
    const up = () => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      try { localStorage.setItem(axis === 'y' ? 'mc_sk_h' : 'mc_sk_w', getComputedStyle(root).getPropertyValue(axis === 'y' ? '--sk-h' : '--sk-w').trim()); } catch(_) {}
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  });
}
function skDockMenu(btn) {
  const d = _skDock, items = [];
  if(d !== 'side') items.push(['◫ Рядом с карточками', () => skApplyDock('side')]);
  if(d !== 'bottom') items.push(['⬒ Под карточками', () => skApplyDock('bottom')]);
  if(d !== 'full') items.push(['⛶ Во весь экран', () => skApplyDock('full')]);
  if(d === 'side' && skIsDesk()) items.push(['⇄ Поменять местами', () => { const sw = document.getElementById('split-swap'); if(sw) sw.click(); else document.documentElement.classList.toggle('mc-swap'); setTimeout(() => skApplyDock('side'), 30); }]);
  if(skIsDesk() && !(typeof window.isNativeApp === 'function' && window.isNativeApp()) && !window._skSolo) items.push(['⧉ Отдельное окно', () => skPopOut()]);
  if(d !== 'full') items.push(['<span style="color:var(--t3)">✕ Закрыть скетч-лист</span>', () => skClose()]);
  skMenu(btn, items);
}
function skPopOut() { // лист — в отдельное окно браузера (второй монитор)
  const id = SK && SK.id;
  skFlush();
  const url = location.pathname + (id ? '?sketch=' + encodeURIComponent(id) : '?sketch=list');
  const w = window.open(url, 'mc_sketch', 'popup,width=1200,height=820');
  if(!w) { toast('Браузер не дал открыть окно — разрешите всплывающие окна для этого сайта', true); return; }
  setTimeout(() => skClose(), 300);
  toast('✓ Скетч-лист открыт в отдельном окне');
}
function skDeskButton() { // ПК: кнопка «✏️ Скетч» в верхней панели правой колонки, рядом с календарём и галереей
  const bar = document.getElementById('desktop-cal-toolbar'); if(!bar || !skAllowed() || document.getElementById('desktop-sk-toggle')) return;
  const b = document.createElement('button'); b.id = 'desktop-sk-toggle'; b.type = 'button'; b.textContent = '✏️ Скетч';
  b.onclick = () => { if(document.body.classList.contains('sk-on')) skClose(); else skOpen(undefined, 'side'); };
  const pf = document.getElementById('pane-full-btn');
  pf && pf.parentNode === bar ? bar.insertBefore(b, pf) : bar.appendChild(b);
}
// календарь, калькулятор, галерея или события заняли правую колонку — скетч-лист закрывается (лист сохранён)
(function skWatchPane() {
  if(!document.body) { document.addEventListener('DOMContentLoaded', skWatchPane); return; }
  new MutationObserver(() => {
    const c = document.body.classList; if(!c.contains('sk-on')) return;
    if(c.contains('cal-on') || c.contains('calc-on') || c.contains('gal-on') || c.contains('events-on')) skClose();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
window.addEventListener('resize', () => { if(document.getElementById('sk-ov') && _skDock !== 'full') { clearTimeout(window._skRz); window._skRz = setTimeout(() => skApplyDock(_skDock), 150); } });

// ═══════════════════════════════════════════
//  ЭТАП 5 (19 ноября): искажение.
//  «✎ Узлы» — фигура превращается в контур из узлов (Path в координатах листа): узлы тянутся,
//  кружок посередине стороны — выгнуть дугой (квадратичная кривая) или нажать — новый узел.
//  «⧉ Искажение» — сетка 2×2 (углы, перспектива) или 3×3 (как Warp): кусочно-билинейное отображение.
//  Фигуры при искажении становятся контуром из точек; картинки — классом SkWarpImage (рисуется треугольниками),
//  сетка картинки хранится в skGrid (относительно левого верхнего угла), skN — 2 или 3.
// ═══════════════════════════════════════════
function skDefineWarp() {
  if(fabric.SkWarpImage) return;
  fabric.SkWarpImage = fabric.util.createClass(fabric.Image, {
    type: 'skWarpImage',
    initialize: function(el, opts) { opts = opts || {}; this.callSuper('initialize', el, opts); this.skGrid = opts.skGrid || null; this.skN = opts.skN || 2; },
    toObject: function(p) { return fabric.util.object.extend(this.callSuper('toObject', p), { skGrid: this.skGrid, skN: this.skN }); },
    _render: function(ctx) {
      const el = this._element, g = this.skGrid, n = this.skN || 2;
      if(!el || !g || g.length !== n * n) return this.callSuper('_render', ctx);
      const W = el.naturalWidth || el.width, H = el.naturalHeight || el.height, ox = -this.width / 2, oy = -this.height / 2, S = n === 2 ? 14 : 8;
      const P = (u, v) => { const q = skBilin(g, n, u, v); return { x: q.x + ox, y: q.y + oy }; };
      for(let j = 0; j < (n - 1) * S; j++) for(let i = 0; i < (n - 1) * S; i++) {
        const u0 = i / ((n - 1) * S), u1 = (i + 1) / ((n - 1) * S), v0 = j / ((n - 1) * S), v1 = (j + 1) / ((n - 1) * S);
        const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
        skTri(ctx, el, a, b, c, u0 * W, v0 * H, u1 * W, v0 * H, u1 * W, v1 * H);
        skTri(ctx, el, a, c, d, u0 * W, v0 * H, u1 * W, v1 * H, u0 * W, v1 * H);
      }
    }
  });
  fabric.SkWarpImage.fromObject = function(o, cb) {
    fabric.util.loadImage(o.src, img => { const x = new fabric.SkWarpImage(img, o); cb && cb(x); }, null, o.crossOrigin || 'anonymous');
  };
}
function skBilin(g, n, u, v) { // кусочно-билинейно: (u, v) ∈ [0,1]² → точка сетки n×n
  const fu = Math.min(n - 2, Math.max(0, Math.floor(u * (n - 1)))), fv = Math.min(n - 2, Math.max(0, Math.floor(v * (n - 1))));
  const s = u * (n - 1) - fu, t = v * (n - 1) - fv;
  const A = g[fv * n + fu], B = g[fv * n + fu + 1], C = g[(fv + 1) * n + fu], D = g[(fv + 1) * n + fu + 1];
  return { x: (1 - s) * (1 - t) * A.x + s * (1 - t) * B.x + (1 - s) * t * C.x + s * t * D.x, y: (1 - s) * (1 - t) * A.y + s * (1 - t) * B.y + (1 - s) * t * C.y + s * t * D.y };
}
function skTri(ctx, im, p0, p1, p2, u0, v0, u1, v1, u2, v2) { // треугольник картинки → треугольник на листе
  const cx = (p0.x + p1.x + p2.x) / 3, cy = (p0.y + p1.y + p2.y) / 3, gr = q => { const dx = q.x - cx, dy = q.y - cy, L = Math.hypot(dx, dy) || 1; return { x: q.x + dx / L * .7, y: q.y + dy / L * .7 }; };
  const a = gr(p0), b = gr(p1), c = gr(p2);
  const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1); if(!den) return;
  const m11 = (p0.x * (v1 - v2) + p1.x * (v2 - v0) + p2.x * (v0 - v1)) / den, m12 = (p0.y * (v1 - v2) + p1.y * (v2 - v0) + p2.y * (v0 - v1)) / den;
  const m21 = (p0.x * (u2 - u1) + p1.x * (u0 - u2) + p2.x * (u1 - u0)) / den, m22 = (p0.y * (u2 - u1) + p1.y * (u0 - u2) + p2.y * (u1 - u0)) / den;
  const dx = (p0.x * (u1 * v2 - u2 * v1) + p1.x * (u2 * v0 - u0 * v2) + p2.x * (u0 * v1 - u1 * v0)) / den, dy = (p0.y * (u1 * v2 - u2 * v1) + p1.y * (u2 * v0 - u0 * v2) + p2.y * (u0 * v1 - u1 * v0)) / den;
  ctx.save(); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.clip();
  ctx.transform(m11, m12, m21, m22, dx, dy); ctx.drawImage(im, 0, 0); ctx.restore();
}

// ── геометрия фигур в координатах листа ──
const skTP = (o, x, y) => fabric.util.transformPoint(new fabric.Point(x, y), o.calcTransformMatrix());
function skPathCmds(o) { // команды Path в координатах листа: [[cmd, ...pts]]
  const M = o.calcTransformMatrix(), off = o.pathOffset || { x: 0, y: 0 }, T = (x, y) => fabric.util.transformPoint(new fabric.Point(x - off.x, y - off.y), M);
  return (o.path || []).map(c => {
    const k = c[0].toUpperCase();
    if(k === 'Z') return ['Z'];
    const pts = []; for(let i = 1; i + 1 < c.length; i += 2) pts.push(T(c[i], c[i + 1]));
    return [k].concat(pts);
  });
}
function skFlatten(o) { // контур → ломаные: [{pts, closed}] (кривые разбиты на 8 частей)
  const subs = []; let cur = null, last = null;
  const add = p => { cur.pts.push({ x: p.x, y: p.y }); last = p; };
  if(o.type === 'path') {
    skPathCmds(o).forEach(c => {
      if(c[0] === 'M') { cur = { pts: [], closed: false }; subs.push(cur); add(c[1]); }
      else if(!cur) return;
      else if(c[0] === 'L') add(c[1]);
      else if(c[0] === 'Q') { const a = last; for(let t = 1; t <= 8; t++) { const s = t / 8; add({ x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c[1].x + s * s * c[2].x, y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c[1].y + s * s * c[2].y }); } }
      else if(c[0] === 'C') { const a = last; for(let t = 1; t <= 10; t++) { const s = t / 10, r = 1 - s; add({ x: r * r * r * a.x + 3 * r * r * s * c[1].x + 3 * r * s * s * c[2].x + s * s * s * c[3].x, y: r * r * r * a.y + 3 * r * r * s * c[1].y + 3 * r * s * s * c[2].y + s * s * s * c[3].y }); } }
      else if(c[0] === 'Z') cur.closed = true;
    });
    return subs.filter(s => s.pts.length > 1);
  }
  const nodes = skShapeNodes(o); if(!nodes) return [];
  const pts = []; const N = nodes.pts;
  N.forEach((p, i) => {
    if(i === 0) { pts.push({ x: p.x, y: p.y }); return; }
    const a = N[i - 1]; for(let t = 1; t <= 8; t++) { const s = t / 8; pts.push(p.c ? { x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * p.c.x + s * s * p.x, y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * p.c.y + s * s * p.y } : { x: a.x + (p.x - a.x) * s, y: a.y + (p.y - a.y) * s }); }
  });
  if(nodes.closed) { const a = N[N.length - 1], p = N[0]; for(let t = 1; t < 8; t++) { const s = t / 8; pts.push(p.c ? { x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * p.c.x + s * s * p.x, y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * p.c.y + s * s * p.y } : { x: a.x + (p.x - a.x) * s, y: a.y + (p.y - a.y) * s }); } }
  return [{ pts, closed: nodes.closed }];
}
function skRdp(pts, eps) { // упростить ломаную (Рамер — Дуглас — Пекер)
  if(pts.length < 3) return pts.slice();
  let dmax = 0, idx = 0; const a = pts[0], b = pts[pts.length - 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  for(let i = 1; i < pts.length - 1; i++) { const p = pts[i], d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / L; if(d > dmax) { dmax = d; idx = i; } }
  if(dmax <= eps) return [a, b];
  return skRdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(skRdp(pts.slice(idx), eps));
}
function skShapeNodes(o) { // фигура → узлы {pts:[{x,y,c}], closed} в координатах листа; c — изгиб стороны, приходящей в узел
  if(o.type === 'rect') return { pts: skCorners(o).map(p => ({ x: p.x, y: p.y, c: null })), closed: true };
  if(o.type === 'triangle') { const w = o.width, h = o.height; return { pts: [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(q => { const p = skTP(o, q[0], q[1]); return { x: p.x, y: p.y, c: null }; }), closed: true }; }
  if(o.type === 'ellipse') {
    const rx = o.rx, ry = o.ry, k = Math.cos(Math.PI / 8), pts = [];
    for(let i = 0; i < 8; i++) { const t = i * Math.PI / 4, tc = t - Math.PI / 8, p = skTP(o, rx * Math.cos(t), ry * Math.sin(t)), c = skTP(o, rx * Math.cos(tc) / k, ry * Math.sin(tc) / k); pts.push({ x: p.x, y: p.y, c: { x: c.x, y: c.y } }); }
    return { pts, closed: true };
  }
  if(o.type === 'polygon' || o.type === 'polyline') { const off = o.pathOffset || { x: 0, y: 0 }; return { pts: o.points.map(q => { const p = skTP(o, q.x - off.x, q.y - off.y); return { x: p.x, y: p.y, c: null }; }), closed: o.type === 'polygon' }; }
  if(o.type === 'line') { const e = skLineEnds(o); return { pts: e.map(p => ({ x: p.x, y: p.y, c: null })), closed: false }; }
  if(o.type === 'path') {
    const cmds = skPathCmds(o); if(cmds.filter(c => c[0] === 'M').length !== 1) return null;
    const simple = !cmds.some(c => c[0] === 'C') && cmds.length <= 80;
    if(simple) {
      const pts = []; let closed = false;
      cmds.forEach(c => { if(c[0] === 'M' || c[0] === 'L') pts.push({ x: c[1].x, y: c[1].y, c: null }); else if(c[0] === 'Q') pts.push({ x: c[2].x, y: c[2].y, c: { x: c[1].x, y: c[1].y } }); else if(c[0] === 'Z') closed = true; });
      if(closed && pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < .01) { const l = pts.pop(); pts[0].c = l.c; }
      return { pts, closed };
    }
    const f = skFlatten(o)[0]; if(!f) return null;
    const eps = 1.5 / SK.canvas.getZoom();
    let pts = skRdp(f.pts, eps); if(f.closed && pts.length > 3) pts.pop();
    return { pts: pts.map(p => ({ x: p.x, y: p.y, c: null })), closed: f.closed };
  }
  return null;
}
function skCanNodes(o) { if(!o || o.skDim || o.skDimOf) return false; if(o.type === 'path') return skPathCmds(o).filter(c => c[0] === 'M').length === 1; return ['rect', 'triangle', 'ellipse', 'line', 'polygon', 'polyline'].includes(o.type); }
function skCanWarp(o) { if(!o || o.skDim || o.skDimOf) return false; return ['image', 'skWarpImage', 'rect', 'triangle', 'ellipse', 'line', 'path', 'polygon', 'polyline'].includes(o.type); }
function skNodesD(N) {
  const P = N.pts; if(!P.length) return '';
  let d = `M ${P[0].x} ${P[0].y}`;
  for(let i = 1; i < P.length; i++) d += P[i].c ? ` Q ${P[i].c.x} ${P[i].c.y} ${P[i].x} ${P[i].y}` : ` L ${P[i].x} ${P[i].y}`;
  if(N.closed) { if(P[0].c) d += ` Q ${P[0].c.x} ${P[0].c.y} ${P[0].x} ${P[0].y}`; d += ' Z'; }
  return d;
}
function skSetPathD(o, d) { // поменять контур Path на месте (без поворота и растяжения)
  o.set({ angle: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, flipX: false, flipY: false, originX: 'left', originY: 'top' });
  o._setPath(d, {}); // Fabric 5.3: новый контур, размеры и положение пересчитываются
  o.setCoords(); o.dirty = true;
}
function skToPath(o, d) { // заменить фигуру контуром Path с тем же оформлением, слоем и номером
  const c = SK.canvas, idx = c.getObjects().indexOf(o);
  const p = new fabric.Path(d, { stroke: o.stroke || SK.st.stroke, strokeWidth: o.strokeWidth || 2, fill: o.type === 'line' ? '' : (o.fill || ''), strokeUniform: true, strokeLineCap: 'round', strokeLineJoin: 'round', opacity: o.opacity ?? 1, skId: o.skId, skLayer: o.skLayer, skName: o.skName, objectCaching: false });
  SK.dimBusy = true; c.remove(o); SK.dimBusy = false;
  if(o.skId) skDimsRemove(o.skId);
  c.insertAt(p, Math.max(0, idx)); skApplyLayers();
  return p;
}

// ── режим «Узлы» ──
function skNodesStart() {
  const c = SK.canvas, o = c.getActiveObject(); if(!skCanNodes(o)) return;
  const N = skShapeNodes(o); if(!N || N.pts.length < 2) { toast('У этой фигуры нет узлов', true); return; }
  const p = o.type === 'path' ? (skSetPathD(o, skNodesD(N)), o) : skToPath(o, skNodesD(N));
  c.discardActiveObject();
  SK.edit = { mode: 'nodes', obj: p, N, sel: -1 };
  skSetTool('edit'); skEditPaint(); skInfo();
}
function skNodesApply() { const E = SK.edit; skSetPathD(E.obj, skNodesD(E.N)); SK.canvas.requestRenderAll(); skEditPaint(); }
function skNodeDel() {
  const E = SK.edit; if(!E || E.mode !== 'nodes' || E.sel < 0) return;
  if(E.N.pts.length <= (E.N.closed ? 3 : 2)) { toast('Меньше узлов нельзя', true); return; }
  E.N.pts.splice(E.sel, 1); if(E.N.pts[E.sel]) E.N.pts[E.sel].c = null; E.sel = -1;
  skNodesApply(); skInfo(); skCommit();
}
function skNodeStraight() {
  const E = SK.edit; if(!E || E.sel < 0) return; const P = E.N.pts;
  P[E.sel].c = null; const nx = (E.sel + 1) % P.length; if(nx !== 0 || E.N.closed) P[nx].c = null;
  skNodesApply(); skCommit();
}
// ── режим «Искажение» ──
function skWarpStart() {
  const c = SK.canvas, o = c.getActiveObject(); if(!skCanWarp(o)) return;
  c.discardActiveObject();
  if(o.type === 'image' || o.type === 'skWarpImage') {
    let w = o;
    if(o.type === 'image') { // обычная картинка → искажаемая с той же картинкой
      const q = skCorners(o), idx = c.getObjects().indexOf(o);
      w = new fabric.SkWarpImage(o.getElement(), { src: o.getSrc(), crossOrigin: 'anonymous', opacity: o.opacity, skId: o.skId, skLayer: o.skLayer, skName: o.skName, skN: 2, objectCaching: false });
      w.skGrid = [q[0], q[1], q[3], q[2]].map(p => ({ x: p.x, y: p.y })); // пока в координатах листа
      SK.dimBusy = true; c.remove(o); SK.dimBusy = false; c.insertAt(w, Math.max(0, idx));
      skWarpImgSet(w, w.skGrid, 2);
    }
    SK.edit = { mode: 'warp', kind: 'img', obj: w, n: w.skN || 2, grid: skWarpImgGrid(w) };
  } else {
    const subs = skFlatten(o); if(!subs.length) return;
    const all = [].concat(...subs.map(s => s.pts)), xs = all.map(p => p.x), ys = all.map(p => p.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), W = Math.max(1e-6, Math.max(...xs) - x0), H = Math.max(1e-6, Math.max(...ys) - y0);
    const uv = subs.map(sb => ({ closed: sb.closed, pts: sb.pts.map(p => ({ u: (p.x - x0) / W, v: (p.y - y0) / H })) }));
    const p = o.type === 'path' ? o : skToPath(o, skWarpD(uv, skGridRect(x0, y0, W, H, 2), 2));
    SK.edit = { mode: 'warp', kind: 'vec', obj: p, n: 2, uv, grid: skGridRect(x0, y0, W, H, 2) };
    skWarpApply();
  }
  skSetTool('edit'); skEditPaint(); skInfo();
}
function skGridRect(x, y, W, H, n) { const g = []; for(let j = 0; j < n; j++) for(let i = 0; i < n; i++) g.push({ x: x + W * i / (n - 1), y: y + H * j / (n - 1) }); return g; }
function skWarpD(uv, g, n) { return uv.map(sb => sb.pts.map((q, i) => { const p = skBilin(g, n, q.u, q.v); return (i ? 'L ' : 'M ') + p.x + ' ' + p.y; }).join(' ') + (sb.closed ? ' Z' : '')).join(' '); }
function skWarpImgGrid(w) { // сетка картинки → координаты листа
  const M = w.calcTransformMatrix(); return w.skGrid.map(p => fabric.util.transformPoint(new fabric.Point(p.x - w.width / 2, p.y - w.height / 2), M));
}
function skWarpImgSet(w, g, n) { // сетка в координатах листа → картинка без поворота, рамка по сетке
  const xs = g.map(p => p.x), ys = g.map(p => p.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
  w.set({ angle: 0, scaleX: 1, scaleY: 1, flipX: false, flipY: false, originX: 'left', originY: 'top', left: x0, top: y0, width: Math.max(1, Math.max(...xs) - x0), height: Math.max(1, Math.max(...ys) - y0) });
  w.skGrid = g.map(p => ({ x: p.x - x0, y: p.y - y0 })); w.skN = n; w.dirty = true; w.setCoords();
}
function skWarpApply() {
  const E = SK.edit;
  if(E.kind === 'img') skWarpImgSet(E.obj, E.grid, E.n); else skSetPathD(E.obj, skWarpD(E.uv, E.grid, E.n));
  SK.canvas.requestRenderAll(); skEditPaint();
}
function skWarpSize(n) { // 2×2 ↔ 3×3, форма сохраняется
  const E = SK.edit; if(!E || E.n === n) return;
  const g = []; for(let j = 0; j < n; j++) for(let i = 0; i < n; i++) g.push(skBilin(E.grid, E.n, i / (n - 1), j / (n - 1)));
  E.grid = g; E.n = n; skWarpApply(); skInfo(); skCommit();
}
function skWarpReset() {
  const E = SK.edit; if(!E) return;
  const xs = E.grid.map(p => p.x), ys = E.grid.map(p => p.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
  E.grid = skGridRect(x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0, E.n); skWarpApply(); skCommit();
}

// ── ручки поверх листа ──
function skEditDone() {
  const E = SK && SK.edit; if(!E) return;
  SK.edit = null; document.getElementById('sk-edit')?.remove();
  if(E.obj.type === 'skWarpImage') E.obj.objectCaching = true;
  skSetTool('sel'); SK.canvas.setActiveObject(E.obj); SK.canvas.requestRenderAll(); skInfo(); skCommit();
}
function skEditPaint() {
  const E = SK && SK.edit, stage = document.getElementById('sk-stage'); if(!E || !stage) return;
  let L = document.getElementById('sk-edit');
  if(!L) { L = document.createElement('div'); L.id = 'sk-edit'; stage.appendChild(L); }
  const v = SK.canvas.viewportTransform, S = p => fabric.util.transformPoint(new fabric.Point(p.x, p.y), v);
  let lines = '', hs = '';
  if(E.mode === 'nodes') {
    const P = E.N.pts, segs = [];
    for(let i = 1; i < P.length; i++) segs.push([i - 1, i]);
    if(E.N.closed) segs.push([P.length - 1, 0]);
    segs.forEach(([a, b]) => {
      const A = P[a], B = P[b], m = B.c ? { x: .25 * A.x + .5 * B.c.x + .25 * B.x, y: .25 * A.y + .5 * B.c.y + .25 * B.y } : { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, q = S(m);
      hs += `<div class="sk-h mid" data-mid="${b}" style="left:${q.x}px;top:${q.y}px" title="Тянуть — выгнуть, нажать — новый узел"></div>`;
    });
    P.forEach((p, i) => { const q = S(p); hs += `<div class="sk-h${i === E.sel ? ' on' : ''}" data-n="${i}" style="left:${q.x}px;top:${q.y}px"></div>`; });
  } else {
    const n = E.n, G = E.grid.map(S);
    for(let j = 0; j < n; j++) for(let i = 0; i < n; i++) { const a = G[j * n + i]; if(i < n - 1) { const b = G[j * n + i + 1]; lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; } if(j < n - 1) { const b = G[(j + 1) * n + i]; lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; } }
    G.forEach((q, i) => { hs += `<div class="sk-h g" data-g="${i}" style="left:${q.x}px;top:${q.y}px"></div>`; });
  }
  L.innerHTML = `<svg><g stroke="#c9a640" stroke-width="1.5" stroke-dasharray="5 4" fill="none">${lines}</g></svg>${hs}`;
  if(!L._bound) { L._bound = true; L.addEventListener('pointerdown', skEditDown); }
}
function skEditDown(e) {
  const h = e.target.closest('.sk-h'); if(!h || !SK || !SK.edit) return;
  e.preventDefault(); e.stopPropagation();
  const E = SK.edit, stage = document.getElementById('sk-stage'), r = stage.getBoundingClientRect(), inv = fabric.util.invertTransform(SK.canvas.viewportTransform);
  const toScene = ev => fabric.util.transformPoint(new fabric.Point(ev.clientX - r.left, ev.clientY - r.top), inv);
  const x0 = e.clientX, y0 = e.clientY; let moved = false;
  SK.snapCands = null;
  const nI = h.dataset.n, mI = h.dataset.mid, gI = h.dataset.g;
  if(nI !== undefined) { E.sel = +nI; skEditPaint(); skInfo(); }
  const move = ev => {
    if(!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    moved = true;
    let p = toScene(ev);
    if(nI !== undefined) { p = skSnap(p, E.obj); const P = E.N.pts[+nI]; P.x = p.x; P.y = p.y; skNodesApply(); }
    else if(mI !== undefined) { const P = E.N.pts, b = +mI, a = (b - 1 + P.length) % P.length, A = P[a], B = P[b]; B.c = { x: 2 * p.x - (A.x + B.x) / 2, y: 2 * p.y - (A.y + B.y) / 2 }; skNodesApply(); }
    else if(gI !== undefined) { E.grid[+gI] = { x: p.x, y: p.y }; skWarpApply(); }
  };
  const up = () => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    skSnapMark(null);
    if(!moved && mI !== undefined) { // нажатие на середину стороны — новый узел
      const P = E.N.pts, b = +mI, a = (b - 1 + P.length) % P.length, A = P[a], B = P[b];
      let nd;
      if(B.c) { const l = { x: (A.x + B.c.x) / 2, y: (A.y + B.c.y) / 2 }, rr = { x: (B.c.x + B.x) / 2, y: (B.c.y + B.y) / 2 }, m = { x: (l.x + rr.x) / 2, y: (l.y + rr.y) / 2 }; nd = { x: m.x, y: m.y, c: l }; B.c = rr; }
      else nd = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, c: null };
      const at = b === 0 ? P.length : b; P.splice(at, 0, nd); E.sel = at;
      skNodesApply(); skInfo(); skCommit(); return;
    }
    if(moved) { skInfo(); skCommit(); }
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}
function skEditPanel(el) {
  const E = SK.edit, btn = (t, f, extra) => `<button class="sk-ib" style="flex:1;font-size:12px;${extra || ''}" onclick="${f}">${t}</button>`;
  let body;
  if(E.mode === 'nodes') {
    body = `<div style="color:var(--t2);line-height:1.45">Тяни узлы. Кружок на стороне: тянуть — выгнуть, нажать — новый узел.</div>
      <div style="display:flex;gap:6px;margin-top:8px">${btn('Удалить узел', 'skNodeDel()', E.sel < 0 ? 'opacity:.4' : '')}${btn('Сделать прямой', 'skNodeStraight()', E.sel < 0 ? 'opacity:.4' : '')}</div>`;
  } else {
    body = `<div style="color:var(--t2);line-height:1.45">Тяни золотые точки сетки.</div>
      <div style="display:flex;gap:6px;margin-top:8px">${btn('2×2 углы', 'skWarpSize(2)', E.n === 2 ? 'border-color:var(--accent);color:var(--accent)' : '')}${btn('3×3 сетка', 'skWarpSize(3)', E.n === 3 ? 'border-color:var(--accent);color:var(--accent)' : '')}</div>
      <div style="display:flex;gap:6px;margin-top:6px">${btn('Сбросить', 'skWarpReset()')}</div>`;
  }
  el.innerHTML = `<div class="sk-ih">${E.mode === 'nodes' ? '✎ Узлы · ' + E.N.pts.length : '⧉ Искажение'}<span class="sm"></span></div><div class="sk-ib2">${body}
    <div style="display:flex;margin-top:8px">${btn('✓ Готово', 'skEditDone()', 'background:var(--accent);color:#0f0f0f;border-color:var(--accent);font-weight:700')}</div></div>`;
  el.classList.add('open'); el.onclick = null; el.onchange = null; el.oninput = null;
}

// ═══════════════════════════════════════════
//  ЭТАП 6 (19 ноября): объём (3D). Пока для всех (решение Натальи; отделить можно через skAllowed3d()).
//  Лист → сцена three.js 0.147 (грузится по требованию): контуры без заливки и линии — стены
//  (толщина 12 см, высота — «Высота» фигуры или 2,7 м), фигуры с заливкой — объёмы (высота — «Высота» или 75 см),
//  мебель из библиотеки — коробки с привычной высотой, картинки — на полу (подложка), двери и окна — проёмы не строятся.
//  Только просмотр: вращать, приближать, двигать; «📷 Снимок» — PNG.
// ═══════════════════════════════════════════
const SK_THREE = (typeof window !== 'undefined' && window.SK_THREE_URLS) || ['https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'];
const SK_FURN_H = [['кроват', 500], ['диван', 800], ['кресл', 800], ['письменн', 750], ['стол', 750], ['стул', 900], ['шкаф', 2200], ['тумб', 600], ['ванн', 600], ['душ', 100], ['унитаз', 400], ['раковин', 850], ['мойк', 900], ['плит', 900], ['холодильник', 1850], ['стиральн', 850], ['модуль', 900], ['колонн', 2700], ['лестниц', 150]];
async function sk3dLoad() { if(window.THREE && THREE.OrbitControls) return; await skLoadScript(SK_THREE[0]); await skLoadScript(SK_THREE[1]); if(!window.THREE || !THREE.OrbitControls) throw new Error('3D не загрузилось'); }
function sk3dToggle() { if(!SK) return; if(SK._3d) sk3dClose(); else sk3dOpen(); }
function sk3dClose() {
  const T = SK && SK._3d; if(!T) return;
  SK._3d = null;
  try { T.ro.disconnect(); T.controls.dispose(); T.renderer.dispose(); } catch(e) {}
  document.getElementById('sk-3d')?.remove();
  document.getElementById('sk-3d-btn')?.classList.remove('gold');
}
async function sk3dOpen() {
  const stage = document.getElementById('sk-stage'); if(!stage) return;
  if(SK.edit) skEditDone();
  const box = document.createElement('div'); box.id = 'sk-3d';
  box.innerHTML = `<div class="sk-3dhint">Загружаю 3D…</div>`;
  stage.appendChild(box);
  document.getElementById('sk-3d-btn')?.classList.add('gold');
  try { await sk3dLoad(); } catch(e) { box.querySelector('.sk-3dhint').textContent = 'Нужен интернет, чтобы открыть 3D'; setTimeout(sk3dClose, 2500); return; }
  if(!document.body.contains(box)) return;
  const W = stage.clientWidth, H = stage.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9e6df);
  const cam = new THREE.PerspectiveCamera(45, W / H, .05, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a6, .75));
  const sun = new THREE.DirectionalLight(0xffffff, .65); sun.position.set(8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
  box.innerHTML = `<div class="sk-3dbar"><button onclick="sk3dClose()">◼ 2D</button><button onclick="sk3dFit()">⤢ Показать всё</button><button onclick="sk3dShot()">📷 Снимок</button></div>
    <div class="sk-3dhint">Тянуть — вращать, колесо или два пальца — ближе/дальше. Высота стен — поле «Высота» у фигуры.</div>`;
  box.appendChild(renderer.domElement);
  const controls = new THREE.OrbitControls(cam, renderer.domElement);
  controls.enableDamping = false; controls.maxPolarAngle = Math.PI * .495;
  const render = () => renderer.render(scene, cam);
  controls.addEventListener('change', render);
  controls.addEventListener('start', () => box.querySelector('.sk-3dhint')?.remove(), { once: true });
  const ro = new ResizeObserver(() => { const w = stage.clientWidth, h = stage.clientHeight; if(!w || !h) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); render(); });
  ro.observe(stage);
  SK._3d = { renderer, scene, cam, controls, render, ro };
  const bb = sk3dBuild(scene);
  SK._3d.bb = bb;
  // пол и сетка
  const span = Math.max(4, bb.w, bb.d) * 1.6;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(bb.cx, -.002, bb.cz); floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(span, Math.round(span), 0xc9c2b2, 0xddd8cc); grid.position.set(bb.cx, 0, bb.cz); scene.add(grid);
  sk3dFit();
}
function sk3dFit() {
  const T = SK && SK._3d; if(!T) return; const b = T.bb, r = Math.max(2.5, Math.hypot(b.w, b.d, b.h)) / Math.min(1, T.cam.aspect * 1.2); // узкий экран — камера дальше
  T.controls.target.set(b.cx, Math.min(1, b.h / 3), b.cz);
  T.cam.position.set(b.cx + r * .75, r * .85, b.cz + r * 1.05);
  T.cam.updateProjectionMatrix(); T.controls.update(); T.render();
}
function sk3dShot() {
  const T = SK && SK._3d; if(!T) return; T.render();
  T.renderer.domElement.toBlob(async b => {
    if(!b) return; const name = skFileName('png').replace(/\.png$/, ' 3D.png');
    if(typeof mcNativeShareFile === 'function' && await mcNativeShareFile(b, 'Sketch3D_' + Date.now() + '.png', name)) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('✓ Снимок сохранён');
  }, 'image/png');
}
function sk3dBuild(scene) { // фигуры листа → объёмы; координаты в метрах: x вправо, z вниз по листу, y вверх
  const k = skMmPx() / 1000, objs = SK.canvas.getObjects().filter(o => o.visible !== false && !o.skDim && !o.skDimOf);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, hMax = 0;
  const grow = (x, z, h) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); hMax = Math.max(hMax, h || 0); };
  const col = (c, d) => { try { return new THREE.Color(c && c !== 'transparent' ? c : d); } catch(e) { return new THREE.Color(d); } };
  const edges = (mesh) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color: 0x3a3630 })); e.position.copy(mesh.position); e.rotation.copy(mesh.rotation); scene.add(e); };
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const wallSeg = (a, b, h, t, c) => { // стена по отрезку
    const L = Math.hypot(b.x - a.x, b.z - a.z); if(L < .005) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(L + t, h, t), mat(c));
    m.position.set((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2); m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    m.castShadow = m.receiveShadow = true; scene.add(m); edges(m); grow(a.x, a.z, h); grow(b.x, b.z, h);
  };
  const prism = (pts, h, c, y0) => { // объём по контуру
    if(pts.length < 3) return;
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat(c)); m.position.y = y0 || 0; m.castShadow = m.receiveShadow = true; scene.add(m); edges(m);
    pts.forEach(p => grow(p.x, p.z, h + (y0 || 0)));
  };
  const M = p => ({ x: p.x * k, z: p.y * k });
  objs.forEach(o => {
    try {
      if(o.type === 'i-text' || o.type === 'text') return;
      if(o.type === 'image' || o.type === 'skWarpImage') { // картинка — на полу
        const q = skCorners(o).map(M), tex = new THREE.Texture(o.getElement()); tex.needsUpdate = true;
        if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([q[0].x, .001, q[0].z, q[1].x, .001, q[1].z, q[2].x, .001, q[2].z, q[3].x, .001, q[3].z], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: o.opacity ?? 1, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m);
        q.forEach(p => grow(p.x, p.z, 0)); return;
      }
      if(o.type === 'group') { // мебель и свои фигуры — коробка по рамке
        const nm = String(o.skName || '').toLowerCase();
        if(/двер|окн/.test(nm)) return;
        const hit = SK_FURN_H.find(f => nm.includes(f[0]));
        const h = (o.skH || (hit ? hit[1] : 600)) / 1000;
        prism(skCorners(o).map(M), h, 0xfbfaf6); return;
      }
      let subs = null;
      if(o.type !== 'path') { const N = skShapeNodes(o); if(N && N.pts.every(p => !p.c)) subs = [{ pts: N.pts, closed: N.closed }]; } // прямые стороны — одна стена на сторону
      if(!subs) subs = skFlatten(o); if(!subs.length) return;
      const stroke = col(o.stroke, '#e3dccd'), filled = o.fill && o.fill !== 'transparent' && o.fill !== '' && o.type !== 'line';
      if(filled) { subs.forEach(sb => prism(sb.pts.map(M), (o.skH || 750) / 1000, col(o.fill, '#d9cfc0'))); return; }
      const h = (o.skH || 2700) / 1000, t = .12;
      subs.forEach(sb => { const P = sb.pts.map(M); for(let i = 1; i < P.length; i++) wallSeg(P[i - 1], P[i], h, t, 0xece6da); if(sb.closed && P.length > 2) wallSeg(P[P.length - 1], P[0], h, t, 0xece6da); });
      void stroke;
    } catch(e) { console.log('3d', o.type, e); }
  });
  if(!isFinite(x0)) { x0 = z0 = -2; x1 = z1 = 2; }
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: hMax };
}
