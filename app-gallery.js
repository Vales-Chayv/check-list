// ═══════════════════════════════════════════
//  ГАЛЕРЕЯ: все фото, ролики и файлы из карточек и чатов в одном месте
//  На телефоне — окно снизу, на ПК — панель А (как календарь и калькулятор).
//  Работает вместе с app-media.js и sw-media.js (локальные копии на устройстве).
// ═══════════════════════════════════════════
(function(){
  const CLOUD = '<svg width="22" height="17" viewBox="0 0 34 26" fill="none" stroke="#e8c56a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 22a6 6 0 0 1-.7-11.95A8 8 0 0 1 23.6 8.2 6.6 6.6 0 0 1 25 22z"/><path d="M17 10v8m-3.5-3.2L17 18.4l3.5-3.6"/></svg>';
  const G = { types: new Set(['img', 'vid', 'doc']), spaces: new Set(), rubs: new Set(), q: '', open: '', pq: '', coll: new Set(), view: (() => { try { return localStorage.getItem('mc_gal_view') === 'cards' ? 'cards' : 'grid'; } catch(e) { return 'grid'; } })(), sel: false, picked: new Set(), items: [], local: new Set(), orig: new Set(), shown: 90, built: false };
  const $ = id => document.getElementById(id);
  const X = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isDesk = () => window.matchMedia('(min-width:900px)').matches;
  const RU_M = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  // ── стили ──
  const css = document.createElement('style');
  css.textContent = `
  #gal-sheet{height:92vh;display:flex;flex-direction:column;overflow:hidden;padding-bottom:0;position:relative}
  .gal-top{display:flex;align-items:center;gap:8px;padding:10px 14px 6px;font-size:16px;font-weight:700}
  .gal-top .sp{flex:1}
  .gal-top .cnt{font-size:12px;color:var(--t3);font-weight:400}
  .gal-ib{background:var(--s2);border:none;border-radius:10px;color:var(--accent);width:32px;height:32px;font-size:15px;cursor:pointer}
  .gal-fl{padding:0 14px 6px;white-space:nowrap;overflow-x:auto;scrollbar-width:none}
  .gal-fl::-webkit-scrollbar{display:none}
  .gal-ch{display:inline-block;font-size:12px;padding:4px 11px;border-radius:14px;border:1px solid var(--b1);background:var(--s2);color:var(--accent);margin-right:5px;cursor:pointer;user-select:none}
  .gal-ch.on{background:var(--accent);color:#0f0f0f;border-color:var(--accent)}
  #gal-body{flex:1;min-height:0;overflow-y:auto;padding:0 14px 10px}
  .galx-s{display:flex;gap:6px;padding:0 14px 6px}
  .galx-q{flex:1;min-width:0;display:flex;align-items:center;gap:6px;background:var(--s2);border:1px solid var(--b1);border-radius:10px;padding:0 10px}
  .galx-q input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--t1);font-size:14px;padding:7px 0;font-family:inherit}
  .galx-q span{color:var(--t3);cursor:pointer;padding:4px}
  .galx-row{display:flex;gap:6px;align-items:center;padding:0 14px 6px}
  .galx-ty{display:flex;border:1px solid var(--b1);border-radius:16px;overflow:hidden;flex:none}
  .galx-ty span{padding:4px 9px;font-size:15px;cursor:pointer;opacity:.35;filter:grayscale(1);user-select:none}
  .galx-ty span.on{opacity:1;filter:none;background:var(--s2)}
  .galx-dd{flex:1;min-width:0;padding:5px 10px;border-radius:16px;font-size:12px;border:1px solid var(--b1);color:var(--t2);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;user-select:none}
  .galx-dd.set{background:rgba(232,197,106,.15);color:var(--accent);border-color:rgba(232,197,106,.4)}
  .galx-dd.op{border-color:var(--t1);color:var(--t1)}
  .galx-pan{margin:0 14px 8px;background:var(--s2);border:1px solid var(--b1);border-radius:12px;overflow:hidden}
  .galx-ps{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--b1)}
  .galx-ps input{flex:1;min-width:0;background:var(--s1);border:1px solid var(--b1);border-radius:8px;padding:6px 8px;color:var(--t1);font-size:13px;outline:none;font-family:inherit}
  .galx-ps span{font-size:12px;color:var(--accent);cursor:pointer;white-space:nowrap}
  .galx-sel{display:flex;flex-wrap:wrap;gap:5px;padding:8px 10px;border-bottom:1px solid var(--b1)}
  .galx-sel span{background:rgba(232,197,106,.15);color:var(--accent);border:1px solid rgba(232,197,106,.35);border-radius:12px;padding:3px 8px;font-size:11px;cursor:pointer}
  .galx-ls{max-height:36vh;overflow-y:auto}
  .galx-it{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;font-size:13px;user-select:none}
  .galx-it.sub{padding-left:40px}
  .galx-cb{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--t3);flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#0f0f0f;box-sizing:border-box}
  .galx-cb.on{background:var(--accent);border-color:var(--accent)}
  .galx-cb.part{border-color:var(--accent)}
  .galx-cb.part::after{content:'';width:8px;height:2px;background:var(--accent)}
  .galx-it .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .galx-it .c,.galx-gh .c{font-size:11px;color:var(--t3);font-weight:400}
  .galx-sec{font-size:11px;color:var(--t3);padding:8px 12px 2px;text-transform:uppercase;letter-spacing:.04em}
  .galx-gh{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;font-size:13px;font-weight:600;border-top:1px solid var(--b1);user-select:none}
  .galx-gh:first-child{border-top:none}
  .galx-gh .ar{color:var(--t3);font-size:11px;width:10px}
  .galx-gh .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .galx-ft{display:flex;gap:8px;padding:8px 10px;border-top:1px solid var(--b1)}
  .galx-ft span{flex:1;text-align:center;padding:7px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid var(--b1);color:var(--t2)}
  .galx-ft span.ok{background:var(--accent);color:#0f0f0f;border-color:var(--accent);font-weight:700}
  .galx-h{display:flex;align-items:baseline;gap:6px;margin:12px 2px 5px;cursor:pointer}
  .galx-h b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .galx-h span{font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
  .galx-h em{font-style:normal;font-size:12px;color:var(--accent);white-space:nowrap}
  mark.galx-m{background:rgba(232,197,106,.35);color:inherit;border-radius:2px}
  .gal-dt{font-size:11px;color:var(--t3);margin:10px 2px 5px;text-transform:uppercase;letter-spacing:.04em}
  .gal-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:3px}
  .gal-t{position:relative;aspect-ratio:1;border-radius:5px;overflow:hidden;cursor:pointer;background:#262626;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  .gal-t img,.gal-t video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
  .gal-t i{position:absolute;right:4px;bottom:3px;font-style:normal;font-size:10px;color:#fff;background:rgba(0,0,0,.55);border-radius:8px;padding:0 5px}
  .gal-dl{position:absolute;left:4px;top:4px;width:40px;height:32px;border-radius:16px;border:none;background:transparent;padding:0;cursor:pointer;z-index:4;font-family:inherit;color:var(--accent);font-size:13px;display:flex;align-items:center;justify-content:center}
  .gal-dl span{width:34px;height:26px;border-radius:13px;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center}
  .gal-dl.busy{opacity:.6;pointer-events:none}
  #gal-sheet.selmode .gal-dl{display:none}
  .gal-or{position:absolute;left:4px;bottom:3px;font-size:10px;background:rgba(0,0,0,.6);border-radius:8px;padding:0 4px;z-index:2;text-decoration:none}
  .gal-t.cl::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.22);pointer-events:none;z-index:1}
  .gal-t.doc{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:var(--t2);text-align:center;padding:4px;word-break:break-all}
  .gal-t.doc b{font-size:24px;display:block;margin-bottom:2px}
  .gal-sel{position:absolute;right:4px;top:4px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.35);z-index:3;display:none}
  #gal-sheet.selmode .gal-sel{display:block}
  .gal-t.on .gal-sel{background:var(--accent);border-color:var(--accent)}
  .gal-t.on .gal-sel::after{content:'✓';color:#111;font-size:11px;position:absolute;left:3px;top:-2px}
  .gal-warn{display:none;margin:0 14px 6px;padding:8px 10px;border-radius:10px;background:var(--s2);border:1px solid #b8892b;font-size:12px;color:var(--t2);line-height:1.5}
  .gal-warn .gal-btn{margin-left:6px;padding:3px 9px}
  .gal-bar .bad{color:#e06060;font-weight:700}.gal-bar .mid{color:#e8c56a}
  .gal-bar{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;font-size:11px;color:var(--t3);border-top:1px solid var(--b1);flex-shrink:0}
  .gal-act{display:none;align-items:center;justify-content:space-around;padding:12px 8px;background:var(--s2);font-size:13px;color:var(--accent);flex-shrink:0;border-top:1px solid var(--b1)}
  .gal-act span{cursor:pointer;padding:2px 6px}
  #gal-sheet.selmode .gal-act{display:flex}
  #gal-folder,#gal-zip,#gal-grip{display:none}
  @media (hover:hover) and (pointer:fine){#gal-zip{display:inline}#gal-grip.show{display:inline;cursor:grab}}
  #gal-folder.ok{display:inline}
  #gal-sheet.selmode .gal-bar{display:none}
  .gal-more{display:block;margin:12px auto;background:var(--s2);border:1px solid var(--b1);border-radius:10px;color:var(--accent);padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit}
  #gal-set{max-height:75%;overflow-y:auto;position:absolute;left:0;right:0;bottom:0;background:var(--s2);border-radius:16px 16px 0 0;padding:14px 16px calc(14px + var(--safe));display:none;z-index:10;box-shadow:0 -6px 20px rgba(0,0,0,.4)}
  #gal-set.show{display:block}
  .gal-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;font-size:13px;border-bottom:1px solid var(--b1);gap:10px}
  .gal-sw{width:38px;height:22px;border-radius:12px;background:#444;position:relative;cursor:pointer;flex-shrink:0}
  .gal-sw::after{content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}
  .gal-sw.on{background:var(--accent)}
  .gal-sw.on::after{left:18px}
  .gal-btn{background:var(--s1);border:1px solid var(--b1);border-radius:8px;color:var(--accent);padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit}
  #desktop-gal-toggle{background:var(--s2);border:1px solid var(--b1);border-radius:18px;padding:6px 12px;color:var(--t2);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  body.gal-on #desktop-gal-toggle{background:var(--accent);color:#0f0f0f;border-color:var(--accent)}
  @media (min-width:900px){
    #gal-ov{display:block;position:fixed;inset:auto;top:40px;bottom:0;left:var(--split-left);right:0;width:auto;z-index:31;background:var(--s1);border-left:1px solid var(--b1);opacity:0;pointer-events:none;transition:opacity .15s}
    #gal-ov .sheet{transform:none;max-height:none;height:100%;border-radius:0}
    #gal-sheet{height:100%}
    body.gal-on #gal-ov{opacity:1!important;pointer-events:all!important}
    body.in-lobby.gal-on #gal-ov,body.in-cabinet.gal-on #gal-ov{bottom:auto;height:calc((100vh - 40px) * var(--lobby-split-v))}
    body.gal-on #lobby-panel-a{display:flex!important}
    body.gal-on #lobby-h-handle{display:block!important}
  }`;
  document.head.appendChild(css);

  // ── настройки ──
  const cfg = () => (typeof mcGalCfg === 'function') ? mcGalCfg() : { videosWifi: false, photosAuto: true, capMB: 500 };
  function saveCfg(c) { try { localStorage.setItem('mc_gal_cfg', JSON.stringify(c)); } catch(e) {} try { mcApplyCap(); } catch(e) {} }

  // ── сбор файлов из карточек ──
  function parseEntryDate(s) {
    const m = /(\d{1,2})\s+([а-яё]{3})[а-яё]*\.?,?\s+(\d{1,2}):(\d{2})/i.exec(s || '');
    if(!m) return 0;
    const mi = RU_M.indexOf(m[2].toLowerCase()); if(mi < 0) return 0;
    const now = new Date();
    let d = new Date(now.getFullYear(), mi, +m[1], +m[3], +m[4]);
    if(d.getTime() > now.getTime() + 864e5) d = new Date(now.getFullYear() - 1, mi, +m[1], +m[3], +m[4]);
    return d.getTime();
  }
  function spaceName(id) {
    const sp = (typeof spaces !== 'undefined' ? spaces : []).find(s => s.id === id);
    return sp ? (sp.name || 'Кабинет') : (!id || id === 'personal' ? 'Личный' : 'Кабинет');
  }
  function collect(list) {
    const out = [], seen = new Set();
    (list || []).forEach(c => {
      const base = Date.parse(c.created_at || '') || 0;
      const push = (a, ds) => {
        if(!a || !a.data || seen.has(a.data)) return;
        seen.add(a.data);
        const t = a.type || '';
        const kind = t.startsWith('image/') ? 'img' : t.startsWith('video/') ? 'vid' : t.startsWith('audio/') ? 'aud' : t === 'application/x-mc-big' ? 'big' : 'doc';
        out.push({ url: a.data, name: a.name || '', kind, att: kind === 'big' ? a : null, bigVid: kind === 'big' && /^video/.test((a.big && a.big.type) || ''), size: a.size || 0, ts: a.ts || parseEntryDate(ds) || base, space: c.space_id || 'personal', spaceName: spaceName(c.space_id), cardId: c.id, cardTitle: c.title || '', cat: c.category || '' });
      };
      (c.attachments || []).forEach(a => push(a, ''));
      (c.entries || []).forEach(e => { (e.attachments || []).forEach(a => push(a, e.date)); (e.sessionAtts || []).forEach(a => push(a, e.date)); });
    });
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }
  // Карточки всех кабинетов, которые есть на устройстве (кэш), плюс текущий кабинет из памяти
  async function allCards() {
    const map = new Map();
    try { (await local.getAll('cards')).forEach(c => map.set(c.id, c)); } catch(e) {}
    (typeof cards !== 'undefined' ? cards : []).forEach(c => map.set(c.id, c));
    return [...map.values()];
  }
  const syncedIds = () => { try { return new Set(JSON.parse(localStorage.getItem('mc_gal_synced') || '[]')); } catch(e) { return new Set(); } };
  // Загружает с сервера карточки кабинетов, которых ещё нет на устройстве (один раз для каждого кабинета); force — все кабинеты заново
  async function pullSpaces(force) {
    if(!navigator.onLine || typeof sb === 'undefined' || typeof spaces === 'undefined') return false;
    const have = new Set((await allCards()).map(c => c.space_id));
    const done = syncedIds();
    const ids = spaces.map(s => s.id).filter(id => force || (!have.has(id) && !done.has(id)));
    if(!ids.length) return false;
    try {
      const { data, error } = await sb.from('cards').select('*').in('space_id', ids);
      if(error) throw error;
      if(data && data.length) await local.putAll('cards', data);
      try { localStorage.setItem('mc_gal_synced', JSON.stringify([...new Set([...done, ...ids])])); } catch(e) {}
      return true;
    } catch(e) { console.log('gallery pull error:', e.message || e); return false; }
  }
  async function loadLocal() {
    G.local = new Set(); G.orig = new Set();
    try { (await mcVaultMeta()).forEach(m => { if(m.url) G.orig.add(m.url); }); } catch(e) {}
    try {
      const db = await mcMediaDb();
      const all = await new Promise((res, rej) => { const q = db.transaction('idx').objectStore('idx').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      all.forEach(x => { if(mcIsRec(x)) G.local.add(x.url); });
    } catch(e) {}
  }
  const isLocal = it => it.url.startsWith('data:') || G.local.has(it.url);
  function dayLabel(ts) {
    if(!ts) return 'Раньше';
    const d = new Date(ts), n = new Date();
    const k = x => x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate();
    const y = new Date(n); y.setDate(n.getDate() - 1);
    if(k(d) === k(n)) return 'Сегодня';
    if(k(d) === k(y)) return 'Вчера';
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
  }
  const MB = 1024 * 1024;
  const fmtMB = b => (b / MB < 10 ? Math.round(b / MB * 10) / 10 : Math.round(b / MB)) + ' МБ';

  // ── окно ──
  function build() {
    if(G.built) return; G.built = true;
    const ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'gal-ov';
    ov.onclick = e => { if(e.target === ov) closeGallery(); };
    ov.innerHTML = `<div class="sheet" id="gal-sheet">
      <div class="sheet-handle"></div>
      <div class="gal-top"><span>🖼 Галерея</span><span class="sp"></span><span class="cnt" id="gal-cnt"></span><button class="gal-ib" id="gal-sync" aria-label="Обновить из облака" title="Обновить из облака">⟳</button><button class="gal-ib" id="gal-gear" aria-label="Настройки">⚙</button><button class="gal-ib" style="color:var(--t2)" onclick="closeGallery()" aria-label="Закрыть">✕</button></div>
      <div class="gal-warn" id="gal-warn"></div>
      <div class="galx-s"><div class="galx-q">🔎<input id="gal-q" type="search" placeholder="Карточка, рубрика, кабинет, файл" autocomplete="off"><span id="gal-qx" style="display:none">✕</span></div><button class="gal-ib" id="gal-view" title="Вид"></button></div>
      <div class="galx-row" id="gal-f1"></div>
      <div id="gal-f2"></div>
      <div id="gal-body"></div>
      <div class="gal-bar"><span id="gal-usage"></span><span>☁ со стрелкой — файл только в облаке: нажми, чтобы сохранить на устройство</span></div>
      <div class="gal-act"><span id="gal-edit" style="display:none">✎ Править</span><span id="gal-share">↗ Поделиться</span><span id="gal-save">⬇ Сохранить</span><span id="gal-folder">📁 В папку</span><span id="gal-zip">⬇ ZIP</span><span id="gal-grip" draggable="true" title="Перетащи на рабочий стол">⠿ Перетащить</span><span id="gal-rm">🗑 С устройства</span><span id="gal-cancel">✕ Отмена</span></div>
      <div id="gal-set">
        <div style="font-weight:700;margin-bottom:2px">Хранение на устройстве</div>
        <div class="gal-row"><span>Скачивать ролики на Wi-Fi</span><span class="gal-sw" id="gal-s1"></span></div>
        <div class="gal-row"><span>Скачивать фото автоматически</span><span class="gal-sw" id="gal-s2"></span></div>
        <div class="gal-row"><span>Лимит на устройстве</span><select id="gal-lim" style="background:var(--s1);color:var(--t1);border:1px solid var(--b1);border-radius:6px;padding:4px"><option value="300">300 МБ</option><option value="500">500 МБ</option><option value="1024">1 ГБ</option><option value="2048">2 ГБ</option></select></div>
        <div class="gal-row"><span>После съёмки камерой</span><select id="gal-cap" style="background:var(--s1);color:var(--t1);border:1px solid var(--b1);border-radius:6px;padding:4px"><option value="ask">Спрашивать</option><option value="orig">Оригинал + копия</option><option value="small">Только копия</option></select></div>
        <div class="gal-row"><span id="gal-vault"></span><button class="gal-btn" id="gal-vzip">Оригиналы ZIP</button></div>
        <div class="gal-row"><span id="gal-bk"></span><button class="gal-btn" id="gal-bkgo">Резерв</button></div>
        <div class="gal-row" id="gal-free-row" style="display:none"><span id="gal-free"></span><button class="gal-btn" id="gal-freego">Освободить</button></div>
        <div class="gal-row" style="border:none"><span id="gal-us2"></span><button class="gal-btn" id="gal-clear">Очистить</button></div>
        <div style="text-align:center;margin-top:6px"><button class="gal-btn" id="gal-setx">Закрыть</button></div>
      </div></div>`;
    document.body.appendChild(ov);
    // поиск, значки типов, «Кабинеты» и «Рубрики» (16 ноября)
    $('gal-q').oninput = e => { G.q = e.target.value.trim(); $('gal-qx').style.display = G.q ? '' : 'none'; G.shown = 90; renderFilters(); renderBody(); };
    $('gal-qx').onclick = () => { $('gal-q').value = ''; G.q = ''; $('gal-qx').style.display = 'none'; G.shown = 90; renderFilters(); renderBody(); };
    $('gal-view').onclick = () => { G.view = G.view === 'grid' ? 'cards' : 'grid'; try { localStorage.setItem('mc_gal_view', G.view); } catch(e) {} renderFilters(); renderBody(); };
    $('gal-f1').onclick = e => {
      const ty = e.target.closest('[data-ty]'), dd = e.target.closest('[data-dd]');
      if(ty) { const k = ty.dataset.ty; if(G.types.has(k)) { if(G.types.size > 1) G.types.delete(k); } else G.types.add(k); G.shown = 90; renderAll(); }
      else if(dd) { G.open = G.open === dd.dataset.dd ? '' : dd.dataset.dd; G.pq = ''; renderFilters(); }
    };
    $('gal-f2').onclick = e => {
      const t = e.target.closest('[data-k],[data-a],[data-all],[data-g]'); if(!t) return;
      const d = t.dataset, S = G.open === 'sp' ? G.spaces : G.rubs;
      if(d.all !== undefined) { const ks = rubKeysOf(d.all), all = ks.every(k => G.rubs.has(k)); ks.forEach(k => all ? G.rubs.delete(k) : G.rubs.add(k)); }
      else if(d.g !== undefined) { if(G.coll.has(d.g)) G.coll.delete(d.g); else G.coll.add(d.g); renderPanel(true); return; }
      else if(d.k !== undefined) { if(S.has(d.k)) S.delete(d.k); else S.add(d.k); }
      else if(d.a === 'none') S.clear();
      else if(d.a === 'close') { G.open = ''; G.pq = ''; renderFilters(); return; }
      pruneRubs(); G.shown = 90; renderFilters(true); renderBody();
    };
    $('gal-f2').oninput = e => { if(e.target.id === 'galx-pq') { G.pq = e.target.value.trim().toLowerCase(); renderPanel(true); } };
    const body = $('gal-body');
    let timer = null, long = false, sx = 0, sy = 0;
    const startSel = t => { long = true; G.sel = true; G.picked.add(+t.dataset.i); if(navigator.vibrate) try { navigator.vibrate(15); } catch(e) {} renderBody(); };
    body.addEventListener('pointerdown', e => {
      long = false;
      const t = e.target.closest('.gal-t'); if(!t || e.target.closest('.gal-dl') || G.sel) return;
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => startSel(t), 420);
    });
    body.addEventListener('pointermove', e => { if(timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(timer); timer = null; } });
    ['pointerup', 'pointercancel'].forEach(n => body.addEventListener(n, () => { clearTimeout(timer); timer = null; }));
    // на телефоне долгое нажатие приходит ещё и как «контекстное меню»: превращаем его в выбор
    body.addEventListener('contextmenu', e => {
      const t = e.target.closest('.gal-t'); if(!t) return;
      e.preventDefault();
      if(!G.sel && !long) startSel(t);
    });
    body.addEventListener('click', async e => {
      const dl = e.target.closest('.gal-dl');
      if(dl) { e.stopPropagation(); downloadOne(dl); return; }
      if(e.target.closest('.gal-more')) { G.shown += 90; renderBody(); return; }
      const hd = e.target.closest('.galx-h'); if(hd && !G.sel) { openCardOf(hd.dataset.card); return; }
      const t = e.target.closest('.gal-t'); if(!t) return;
      if(long) { long = false; return; }
      const i = +t.dataset.i;
      if(G.sel) { if(G.picked.has(i)) G.picked.delete(i); else G.picked.add(i); if(!G.picked.size) G.sel = false; renderBody(); return; }
      openItem(G.items[i]);
    });
    $('gal-cancel').onclick = () => { G.sel = false; G.picked.clear(); renderBody(); };
    $('gal-edit').onclick = () => { const it = G.items[[...G.picked][0]]; if(it && window.mcPhotoEdit) mcPhotoEdit(it.url, { name: it.name, onSaved: () => { G.sel = false; G.picked.clear(); refresh(); } }); };
    $('gal-share').onclick = () => doShare(false);
    $('gal-save').onclick = () => doShare(true);
    $('gal-rm').onclick = removeLocal;
    const picks = () => [...G.picked].map(i => G.items[i]).filter(Boolean).map(it => ({ url: it.url, name: fileNameOf(it) }));
    if(window.showDirectoryPicker) $('gal-folder').classList.add('ok');
    $('gal-folder').onclick = () => { const l = picks(); if(l.length && window.mcSaveFolder) mcSaveFolder(l); };
    $('gal-zip').onclick = () => { const l = picks(); if(l.length && window.mcSaveZip) mcSaveZip(l, 'Галерея.zip'); };
    $('gal-grip').addEventListener('dragstart', e => { // один отмеченный файл можно утащить на рабочий стол
      const l = picks(); if(l.length !== 1 || !/^https?:/i.test(l[0].url)) { e.preventDefault(); return; }
      try { e.dataTransfer.setData('DownloadURL', 'application/octet-stream:' + l[0].name.replace(/[:\\/]/g, '_') + ':' + l[0].url); e.dataTransfer.effectAllowed = 'copy'; } catch(_) {}
    });
    $('gal-sync').onclick = () => { toast('Обновляю…'); refresh(true); };
    $('gal-gear').onclick = () => { fillSettings(); $('gal-set').classList.add('show'); };
    $('gal-setx').onclick = () => $('gal-set').classList.remove('show');
    $('gal-s1').onclick = e => { const c = cfg(); c.videosWifi = !c.videosWifi; saveCfg(c); fillSettings(); };
    $('gal-s2').onclick = e => { const c = cfg(); c.photosAuto = !c.photosAuto; saveCfg(c); fillSettings(); };
    $('gal-cap').onchange = e => { try { localStorage.setItem('mc_cap_mode', e.target.value); } catch(_) {} };
    $('gal-vzip').onclick = async () => { const l = await mcVaultAllItems(); if(!l.length) { toast('Оригиналов пока нет'); return; } if(window.mcSaveZip) mcSaveZip(l, 'Оригиналы.zip'); };
    $('gal-bkgo').onclick = () => { $('gal-set').classList.remove('show'); mcBackupStart().then(() => fillSettings()); };
    $('gal-freego').onclick = async () => {
      const b = await mcVaultBacked();
      if(!b.count) return;
      if(!confirm('Удалить с устройства ' + b.count + ' оригинал(ов) (' + fmtMB(b.bytes) + '), которые попали в резервную копию?\n\nСначала убедись, что файлы резерва лежат в нужном месте. Сжатые копии в карточках останутся.')) return;
      await mcVaultFreeBacked(); await loadLocal(); renderBody(); fillSettings();
      toast('Освобождено: ' + fmtMB(b.bytes));
    };
    $('gal-lim').onchange = e => { const c = cfg(); c.capMB = +e.target.value; saveCfg(c); fillSettings(); if(window.mcCapCheck) mcCapCheck(c.capMB); }; // хватит ли места под выбранный лимит
    $('gal-clear').onclick = async () => {
      try {
        toast('Проверяю облако…');
        await mcSyncEvictions();
        const urls = (await mcIdxAll()).filter(mcIsRec).map(x => x.url);
        const chk = await mcCloudCheck(urls), risky = new Set(chk.dead.concat(chk.unknown));
        let del = urls;
        if(risky.size && !confirm(riskMsg(chk) + '\n\nOK — очистить всё равно.\nОтмена — оставить эти файлы, остальные очистить.')) del = urls.filter(u => !risky.has(u));
        const db = await mcMediaDb();
        const t = db.transaction(['files', 'idx'], 'readwrite');
        del.forEach(u => { t.objectStore('files').delete(u); t.objectStore('idx').delete(u); try { _mcWarmed.delete(u); } catch(e) {} });
        await new Promise(r => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
        mcRetract(del);
        await loadLocal(); renderAll(); fillSettings();
        toast(del.length < urls.length ? 'Очищено: ' + del.length + '. Оставлено ' + (urls.length - del.length) + ' файл(ов) — копий в облаке у них нет' : 'Файлы на устройстве очищены. В облаке копии остались');
      } catch(e) { toast('Не удалось очистить', true); }
    };
    $('gal-warn').onclick = async e => {
      if(e.target.id === 'gal-pull') { e.target.textContent = 'Сохраняю…'; await mcWarmMedia(true); await loadLocal(); renderBody(); toast('Готово: файлы сохраняются на устройстве'); }
      else if(e.target.id === 'gal-lim') { fillSettings(); $('gal-set').classList.add('show'); }
    };
  }
  function riskMsg(chk) {
    const n = chk.dead.length + chk.unknown.length;
    return chk.dead.length ? 'У ' + n + ' файл(ов) копии в облаке уже нет: на этом устройстве они последние.' : 'Не удалось проверить облако (нет связи?). У ' + n + ' файл(ов) копия на устройстве может быть последней.';
  }
  async function fillWarn() {
    const el = $('gal-warn'); if(!el) return;
    let st; try { st = await mcStorageStatus(); } catch(e) { return; }
    const m = [];
    if(st.danger) m.push('⚠ ' + st.danger + ' файл(ов) скоро исчезнут из облака и ещё не сохранены на этом устройстве <button class="gal-btn" id="gal-pull">Сохранить сейчас</button>');
    if(st.pct >= 0.8) m.push((st.pct >= 0.95 ? '🔴' : '🟡') + ' Память приложения заполнена на ' + Math.round(st.pct * 100) + '% <button class="gal-btn" id="gal-lim">Лимит</button>');
    el.innerHTML = m.join('<br>'); el.style.display = m.length ? 'block' : 'none';
  }
  async function fillSettings() {
    const c = cfg();
    $('gal-s1').classList.toggle('on', !!c.videosWifi);
    $('gal-s2').classList.toggle('on', !!c.photosAuto);
    $('gal-lim').value = String(c.capMB);
    $('gal-cap').value = mcCapMode();
    try {
      const k = mcBkGet('mc_bk_last');
      $('gal-bk').textContent = '🛡 Резервная копия: ' + (k ? new Date(k.ts).toLocaleDateString('ru') + ' · ' + k.files + ' файлов' : 'ещё не делали');
      const b = await mcVaultBacked();
      $('gal-free-row').style.display = b.count ? '' : 'none';
      $('gal-free').textContent = 'Оригиналов в резерве: ' + b.count + ' · ' + fmtMB(b.bytes);
    } catch(e) {}
    try { const v = await mcVaultStats(); $('gal-vault').textContent = '💎 Оригиналы: ' + v.count + ' · ' + fmtMB(v.bytes); } catch(e) {}
    const u = await mcMediaUsage();
    $('gal-us2').textContent = 'Занято: ' + fmtMB(u.bytes) + ' · ' + u.files + ' файлов' + (u.pinned ? ' (📌 ' + u.pinned + ' закреплено: не вытесняются)' : '');
  }
  // ── фильтры (16 ноября): значки типов, кабинеты и рубрики с выбором нескольких, поиск ──
  const kindGrp = it => it.kind === 'img' ? 'img' : (it.kind === 'vid' || (it.kind === 'big' && it.bigVid)) ? 'vid' : 'doc';
  const rubKey = it => it.space + '|' + it.cat;
  const rubName = c => c || 'Без рубрики';
  function qHit(it) {
    if(!G.q) return true;
    const q = G.q.toLowerCase();
    return [it.cardTitle, it.cat, it.spaceName, it.kind === 'img' || it.kind === 'vid' ? '' : it.name].some(x => String(x || '').toLowerCase().includes(q));
  }
  // skip: 'sp' — без учёта кабинетов, 'r' — без учёта рубрик (для счётчиков в списках)
  function passes(it, skip) {
    if(!G.types.has(kindGrp(it)) || !qHit(it)) return false;
    if(skip !== 'sp' && G.spaces.size && !G.spaces.has(it.space)) return false;
    if(skip !== 'r' && skip !== 'sp' && G.rubs.size && !G.rubs.has(rubKey(it))) return false;
    return true;
  }
  function filtered() { return G.items.map((it, i) => ({ it, i })).filter(o => passes(o.it)); }
  function cabList() { // все кабинеты, где есть файлы: [id, имя]
    const m = new Map(); G.items.forEach(it => { if(!m.has(it.space)) m.set(it.space, it.spaceName); }); return [...m];
  }
  function rubGroups() { // рубрики под своими кабинетами; только выбранные кабинеты, если они выбраны
    const m = new Map();
    G.items.forEach(it => {
      if(G.spaces.size && !G.spaces.has(it.space)) return;
      if(!m.has(it.space)) m.set(it.space, { name: it.spaceName, rubs: new Map() });
      const g = m.get(it.space); if(!g.rubs.has(it.cat)) g.rubs.set(it.cat, 0);
    });
    G.items.forEach(it => { const g = m.get(it.space); if(g && passes(it, 'r')) g.rubs.set(it.cat, g.rubs.get(it.cat) + 1); });
    return [...m].map(([id, g]) => ({ id, name: g.name, rubs: [...g.rubs].sort((a, b) => rubName(a[0]).localeCompare(rubName(b[0]), 'ru')) }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }
  const rubKeysOf = sp => { const g = rubGroups().find(x => x.id === sp); return g ? g.rubs.map(r => sp + '|' + r[0]) : []; };
  function pruneRubs() { // рубрики кабинетов, которые сняли с выбора, тоже снимаются
    if(!G.spaces.size) return;
    [...G.rubs].forEach(k => { if(!G.spaces.has(k.split('|')[0])) G.rubs.delete(k); });
  }
  const hlq = (s, q) => { s = String(s || ''); if(!q) return X(s); const i = s.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? X(s) : X(s.slice(0, i)) + '<mark class="galx-m">' + X(s.slice(i, i + q.length)) + '</mark>' + X(s.slice(i + q.length)); };
  function ddLabel(set, names, all) {
    if(!set.size) return all;
    const first = names([...set][0]);
    return first + (set.size > 1 ? ' +' + (set.size - 1) : '');
  }
  function renderFilters(keepPanel) {
    const vb = $('gal-view'); if(vb) { vb.textContent = G.view === 'grid' ? '▦' : '🗂'; vb.title = G.view === 'grid' ? 'Сейчас: сетка. Нажми — по карточкам' : 'Сейчас: по карточкам. Нажми — сетка'; }
    const cabName = id => { const c = cabList().find(x => x[0] === id); return c ? c[1] : '?'; };
    $('gal-f1').innerHTML = `<div class="galx-ty">${[['img', '🖼', 'Фото'], ['vid', '▶️', 'Ролики'], ['doc', '📄', 'Файлы и записи']].map(t => `<span class="${G.types.has(t[0]) ? 'on' : ''}" data-ty="${t[0]}" title="${t[2]}">${t[1]}</span>`).join('')}</div>`
      + `<div class="galx-dd${G.spaces.size ? ' set' : ''}${G.open === 'sp' ? ' op' : ''}" data-dd="sp">🗂 ${X(ddLabel(G.spaces, cabName, 'Кабинеты'))} ▾</div>`
      + `<div class="galx-dd${G.rubs.size ? ' set' : ''}${G.open === 'r' ? ' op' : ''}" data-dd="r">📂 ${X(ddLabel(G.rubs, k => rubName(k.slice(k.indexOf('|') + 1)), 'Рубрики'))} ▾</div>`;
    renderPanel(keepPanel);
  }
  // окно списка под строкой фильтров; keep — не пересоздавать поле поиска (чтобы не терялся курсор)
  function renderPanel(keep) {
    const box = $('gal-f2'); if(!box) return;
    if(!G.open) { box.innerHTML = ''; return; }
    const isSp = G.open === 'sp', S = isSp ? G.spaces : G.rubs, pq = G.pq;
    if(!keep || !$('galx-pq')) {
      box.innerHTML = `<div class="galx-pan"><div class="galx-ps"><input id="galx-pq" type="search" autocomplete="off"><span data-a="none">Сбросить</span></div><div id="galx-body"></div><div class="galx-ft"><span data-a="close">Закрыть</span><span class="ok" data-a="close" id="galx-ok"></span></div></div>`;
      $('galx-pq').value = G.pq;
    }
    let h = '';
    if(isSp) {
      const cnt = new Map(); G.items.forEach(it => { if(passes(it, 'sp')) cnt.set(it.space, (cnt.get(it.space) || 0) + 1); });
      const all = cabList(), L = all.filter(c => !pq || String(c[1]).toLowerCase().includes(pq));
      const on = L.filter(c => S.has(c[0])), off = L.filter(c => !S.has(c[0])).sort((a, b) => (cnt.get(b[0]) || 0) - (cnt.get(a[0]) || 0) || String(a[1]).localeCompare(String(b[1]), 'ru'));
      const it = c => `<div class="galx-it" data-k="${X(c[0])}"><span class="galx-cb${S.has(c[0]) ? ' on' : ''}">${S.has(c[0]) ? '✓' : ''}</span><span class="n">${hlq(c[1], pq)}</span><span class="c">${cnt.get(c[0]) || 0}</span></div>`;
      if(S.size) h += `<div class="galx-sel">${[...S].map(id => `<span data-k="${X(id)}">${X((all.find(c => c[0] === id) || [0, '?'])[1])} ✕</span>`).join('')}</div>`;
      h += `<div class="galx-ls">${on.map(it).join('')}${on.length && off.length ? '<div class="galx-sec">Остальные</div>' : ''}${off.map(it).join('')}${L.length ? '' : '<div class="galx-sec">Ничего не найдено</div>'}</div>`;
      $('galx-pq').placeholder = 'Найти кабинет (' + all.length + ')';
    } else {
      const groups = rubGroups(); let n = 0;
      groups.forEach(g => {
        const nameHit = !pq || String(g.name).toLowerCase().includes(pq);
        const rs = g.rubs.filter(r => nameHit || rubName(r[0]).toLowerCase().includes(pq)); if(!rs.length) return;
        n += g.rubs.length;
        const keys = g.rubs.map(r => g.id + '|' + r[0]), allOn = keys.every(k => S.has(k)), some = keys.some(k => S.has(k));
        const cl = G.coll.has(g.id) && !pq, tot = g.rubs.reduce((a, r) => a + r[1], 0);
        h += `<div class="galx-gh" data-g="${X(g.id)}"><span class="ar">${cl ? '▸' : '▾'}</span><span class="galx-cb${allOn ? ' on' : some ? ' part' : ''}" data-all="${X(g.id)}">${allOn ? '✓' : ''}</span><span class="n">${hlq(g.name, pq)}</span><span class="c">${tot}</span></div>`;
        if(!cl) h += rs.map(r => { const k = g.id + '|' + r[0], on = S.has(k); return `<div class="galx-it sub" data-k="${X(k)}"><span class="galx-cb${on ? ' on' : ''}">${on ? '✓' : ''}</span><span class="n">${hlq(rubName(r[0]), pq)}</span><span class="c">${r[1]}</span></div>`; }).join('');
      });
      h = `<div class="galx-ls">${h || '<div class="galx-sec">Ничего не найдено</div>'}</div>`;
      $('galx-pq').placeholder = 'Найти рубрику' + (G.spaces.size ? ' в выбранных кабинетах' : '');
    }
    const lsOld = box.querySelector('.galx-ls'), top = lsOld ? lsOld.scrollTop : 0;
    $('galx-body').innerHTML = h;
    const lsNew = box.querySelector('.galx-ls'); if(lsNew && keep) lsNew.scrollTop = top;
    $('galx-ok').textContent = 'Готово · ' + (S.size || 'все');
  }
  function openCardOf(id) { // открыть карточку из заголовка в виде «По карточкам»
    allCards().then(list => {
      const card = list.find(c => c.id === id); if(!card) return;
      if(!isDesk()) closeGallery();
      if(typeof clOpenCard === 'function') {
        if(!(window._clCache || []).some(c => c.id === id)) window._clCache = (window._clCache || []).concat([card]);
        clOpenCard(id);
      } else if(typeof openView === 'function' && (typeof cards !== 'undefined') && cards.some(c => c.id === id)) openView(id);
    });
  }
  function renderBody() {
    const L = filtered();
    $('gal-cnt').textContent = L.length + ' файлов';
    $('gal-sheet').classList.toggle('selmode', G.sel);
    { const ge = $('gal-edit'); if(ge) { const one = G.sel && G.picked.size === 1 ? G.items[[...G.picked][0]] : null; ge.style.display = one && one.kind === 'img' && window.mcPhotoEdit && /^(https?|data):/i.test(one.url) ? '' : 'none'; } }
    { const gg = $('gal-grip'); if(gg) { const one = G.sel && G.picked.size === 1 && G.items[[...G.picked][0]] && /^https?:/i.test(G.items[[...G.picked][0]].url); gg.classList.toggle('show', !!one); } }
    let part = L.slice(0, G.shown);
    if(G.view === 'cards') { // по карточкам: файлы одной карточки вместе, карточки — по самому свежему файлу
      const order = new Map(); L.forEach(o => { if(!order.has(o.it.cardId)) order.set(o.it.cardId, order.size); });
      part = L.slice().sort((a, b) => order.get(a.it.cardId) - order.get(b.it.cardId)).slice(0, G.shown);
    }
    let h = '', cur = null;
    part.forEach(o => {
      const it = o.it, lab = G.view === 'cards' ? 'c:' + it.cardId : dayLabel(it.ts);
      if(lab !== cur) {
        if(cur !== null) h += '</div>'; cur = lab;
        h += G.view === 'cards'
          ? `<div class="galx-h" data-card="${X(it.cardId)}"><b>${hlq(it.cardTitle || 'Без названия', G.q)}</b><span>${hlq(rubName(it.cat), G.q)} · ${hlq(it.spaceName, G.q)}</span><em>открыть ›</em></div><div class="gal-g">`
          : `<div class="gal-dt">${X(lab)}</div><div class="gal-g">`;
      }
      const cl = !isLocal(it) && it.kind !== 'img' && it.kind !== 'big';
      const cls = 'gal-t' + (G.picked.has(o.i) ? ' on' : '') + (cl ? ' cl' : '') + ((it.kind === 'doc' || it.kind === 'aud' || it.kind === 'big') ? ' doc' : '');
      let inner;
      if(it.kind === 'img') inner = `<img src="${X(it.url)}" loading="lazy" alt="">`;
      else if(it.kind === 'vid') inner = `<video src="${X(it.url)}#t=0.1" preload="metadata" muted playsinline></video><i>▶</i>`;
      else if(it.kind === 'big') inner = `<b>${it.bigVid ? '🎞' : '🎤'}</b>${X(it.name || 'файл')}<br><span style="font-size:10px;color:var(--t3)">${window.mcBigHas && window.mcBigHas(it.url) ? 'на этом устройстве' : 'на другом устройстве'}</span>`;
      else inner = `<b>${it.kind === 'aud' ? '🎤' : '📄'}</b>${hlq(it.name || (it.kind === 'aud' ? 'запись' : 'файл'), G.q)}`;
      h += `<div class="${cls}" data-i="${o.i}">${inner}${cl ? '<button class="gal-dl" data-dl="' + o.i + '" aria-label="Скачать на устройство"><span>' + CLOUD + '</span></button>' : ''}${G.orig.has(it.url) ? '<u class="gal-or" title="Оригинал на этом устройстве">💎</u>' : ''}<span class="gal-sel"></span></div>`;
    });
    if(cur !== null) h += '</div>';
    if(L.length > G.shown) h += `<button class="gal-more">Показать ещё (${L.length - G.shown})</button>`;
    $('gal-body').innerHTML = h || `<div style="padding:50px 0;text-align:center;color:var(--t3)">${G.items.length ? 'Ничего не найдено' : 'Здесь пока ничего нет'}</div>`;
    mcMediaUsage().then(u => {
      const el = $('gal-usage'); if(!el) return;
      const cap = cfg().capMB * MB, p = cap ? u.bytes / cap : 0;
      el.innerHTML = 'На устройстве: <span class="' + (p >= 0.95 ? 'bad' : p >= 0.8 ? 'mid' : '') + '">' + fmtMB(u.bytes) + ' из ' + (cfg().capMB >= 1024 ? (cfg().capMB / 1024) + ' ГБ' : cfg().capMB + ' МБ') + '</span>' + (u.pinned ? ' · 📌 ' + u.pinned : '');
    });
    fillWarn();
  }
  function renderAll() { renderFilters(); renderBody(); }

  // ── действия ──
  async function fetchBlob(url) {
    if(url.startsWith('data:')) return await (await fetch(url)).blob();
    try { const o = await mcVaultBlobByUrl(url); if(o) return o; } catch(e) {}
    const r = await fetch(url, { mode: 'cors' });
    if(r.status === 404 || r.status === 400) throw new Error('gone');
    if(!r.ok) throw new Error('http ' + r.status);
    return await r.blob();
  }
  const isNative = () => typeof window.isNativeApp === 'function' && window.isNativeApp();
  function fileNameOf(it) {
    if(it.name) return it.name;
    const ext = it.kind === 'img' ? '.jpg' : it.kind === 'vid' ? '.mp4' : it.kind === 'aud' ? '.webm' : '';
    return 'mycards_' + (it.ts || Date.now()) + ext;
  }
  function asciiName(n) { return String(n).replace(/[^a-zA-Z0-9._-]/g, '_'); }
  async function saveBlob(blob, it) {
    const name = fileNameOf(it);
    if(isNative() && typeof mcNativeShareFile === 'function') { if(await mcNativeShareFile(blob, asciiName(name), name)) return true; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }
  async function openItem(it) {
    if(!it) return;
    if(it.kind === 'img') { openImgDirect(it.url); return; }
    if(it.kind === 'vid') { openVideoViewer(it.url); return; }
    if(it.kind === 'big') { if(window.mcBigOpen) window.mcBigOpen(it.url, it.att); return; } // большой файл: окно с кнопками по устройству
    try {
      toast('Открываю…');
      const blob = await fetchBlob(it.url);
      if(it.kind === 'aud') {
        document.getElementById('gal-audio-ov')?.remove();
        const d = document.createElement('div');
        d.id = 'gal-audio-ov';
        d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:2600;display:flex;align-items:center;justify-content:center;padding:20px';
        d.innerHTML = '<audio controls autoplay style="width:min(420px,100%)"></audio>';
        d.querySelector('audio').src = URL.createObjectURL(blob);
        d.onclick = e => { if(e.target === d) d.remove(); };
        document.body.appendChild(d);
      } else await saveBlob(blob, it);
      loadLocal().then(renderBody);
    } catch(e) { toast(e.message === 'gone' ? 'Файл удалён из облака: на устройстве его нет' : 'Не удалось открыть файл', true); }
  }
  async function downloadOne(btn) {
    const it = G.items[+btn.dataset.dl]; if(!it) return;
    btn.classList.add('busy'); btn.firstElementChild.textContent = '…';
    try { await fetchBlob(it.url); await loadLocal(); renderBody(); toast('Сохранено на устройстве'); }
    catch(e) { btn.classList.remove('busy'); btn.firstElementChild.innerHTML = CLOUD; toast(e.message === 'gone' ? 'Файл удалён из облака: на устройстве его нет' : 'Не удалось скачать', true); }
  }
  async function doShare(saveOnly) {
    const list = [...G.picked].map(i => G.items[i]).filter(Boolean);
    if(!list.length) return;
    try {
      const blobs = [];
      for(const it of list) blobs.push(await fetchBlob(it.url));
      if(isNative()) {
        if(list.length > 1) toast('На телефоне отправляется один файл за раз: беру первый');
        await saveBlob(blobs[0], list[0]);
      } else if(!saveOnly && navigator.canShare) {
        const files = blobs.map((b, k) => new File([b], fileNameOf(list[k]), { type: b.type || 'application/octet-stream' }));
        if(navigator.canShare({ files })) await navigator.share({ files });
        else for(let k = 0; k < blobs.length; k++) await saveBlob(blobs[k], list[k]);
      } else for(let k = 0; k < blobs.length; k++) await saveBlob(blobs[k], list[k]);
      G.sel = false; G.picked.clear(); await loadLocal(); renderBody();
    } catch(e) { if(!(e && e.name === 'AbortError')) toast('Не удалось выполнить действие', true); }
  }
  async function removeLocal() {
    const urls = [...G.picked].map(i => G.items[i] && G.items[i].url).filter(u => u && !u.startsWith('data:'));
    if(!urls.length) return;
    let del = urls;
    try {
      toast('Проверяю облако…');
      const chk = await mcCloudCheck(urls), risky = new Set(chk.dead.concat(chk.unknown));
      if(risky.size && !confirm(riskMsg(chk) + '\n\nOK — удалить всё равно.\nОтмена — оставить эти файлы, остальные освободятся.')) del = urls.filter(u => !risky.has(u));
      const db = await mcMediaDb();
      const t = db.transaction(['files', 'idx'], 'readwrite');
      del.forEach(u => { t.objectStore('files').delete(u); t.objectStore('idx').delete(u); try { _mcWarmed.delete(u); } catch(e) {} });
      await new Promise(r => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
      mcRetract(del);
    } catch(e) { del = []; }
    G.sel = false; G.picked.clear(); await loadLocal(); renderBody();
    toast(!del.length ? 'Ничего не удалено' : del.length < urls.length ? 'Освобождено: ' + del.length + '. Оставлено ' + (urls.length - del.length) + ' — копий в облаке у них нет' : 'Освобождено на устройстве. В облаке копии остались');
  }

  // ── открытие и закрытие ──
  async function refresh(force) {
    build();
    G.sel = false; G.picked.clear(); G.shown = 90;
    G.items = collect(await allCards());
    { const sp = new Set(G.items.map(it => it.space)), rk = new Set(G.items.map(rubKey)); [...G.spaces].forEach(id => { if(!sp.has(id)) G.spaces.delete(id); }); [...G.rubs].forEach(k => { if(!rk.has(k)) G.rubs.delete(k); }); }
    renderAll();
    await loadLocal();
    renderBody();
    // кабинеты, которые на этом устройстве ещё не открывали: один раз подгружаем их файлы, дальше они лежат в кэше
    if(await pullSpaces(force === true)) {
      G.items = collect(await allCards());
      renderAll(); renderBody();
      if(force === true) toast('Галерея обновлена');
    }
  }
  window.openGalleryMobile = function() { build(); document.getElementById('gal-ov').classList.add('on'); refresh(); };
  window.closeGallery = function() {
    document.body.classList.remove('gal-on');
    document.getElementById('gal-ov')?.classList.remove('on');
    $('gal-set')?.classList.remove('show');
  };
  window.toggleGallery = function() {
    if(!isDesk()) { openGalleryMobile(); return; }
    const b = document.body.classList;
    if(b.contains('gal-on')) { b.remove('gal-on'); return; }
    b.remove('cal-on', 'calc-on', 'events-on');
    build(); b.add('gal-on'); refresh();
  };
  // если пользователь открыл календарь, калькулятор или события — галерея уступает место
  new MutationObserver(() => {
    const b = document.body.classList;
    if(b.contains('gal-on') && (b.contains('cal-on') || b.contains('calc-on') || b.contains('events-on'))) b.remove('gal-on');
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
