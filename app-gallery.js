// ═══════════════════════════════════════════
//  ГАЛЕРЕЯ: все фото, ролики и файлы из карточек и чатов в одном месте
//  На телефоне — окно снизу, на ПК — панель А (как календарь и калькулятор).
//  Работает вместе с app-media.js и sw-media.js (локальные копии на устройстве).
// ═══════════════════════════════════════════
(function(){
  const CLOUD = '<svg width="22" height="17" viewBox="0 0 34 26" fill="none" stroke="#e8c56a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 22a6 6 0 0 1-.7-11.95A8 8 0 0 1 23.6 8.2 6.6 6.6 0 0 1 25 22z"/><path d="M17 10v8m-3.5-3.2L17 18.4l3.5-3.6"/></svg>';
  const G = { type: 'all', space: 'all', sel: false, picked: new Set(), items: [], local: new Set(), orig: new Set(), shown: 90, built: false };
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
        const kind = t.startsWith('image/') ? 'img' : t.startsWith('video/') ? 'vid' : t.startsWith('audio/') ? 'aud' : 'doc';
        out.push({ url: a.data, name: a.name || '', kind, size: a.size || 0, ts: a.ts || parseEntryDate(ds) || base, space: c.space_id || 'personal', spaceName: spaceName(c.space_id), cardId: c.id, cardTitle: c.title || '' });
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
      <div class="gal-fl" id="gal-f1"></div>
      <div class="gal-fl" id="gal-f2"></div>
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
    $('gal-f1').onclick = e => { const c = e.target.closest('.gal-ch'); if(c) { G.type = c.dataset.t; G.shown = 90; renderAll(); } };
    $('gal-f2').onclick = e => { const c = e.target.closest('.gal-ch'); if(c) { G.space = c.dataset.s; G.shown = 90; renderAll(); } };
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
    $('gal-lim').onchange = e => { const c = cfg(); c.capMB = +e.target.value; saveCfg(c); fillSettings(); };
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
  function renderFilters() {
    const T = [['all', 'Все'], ['img', 'Фото'], ['vid', 'Ролики'], ['doc', 'Файлы']];
    $('gal-f1').innerHTML = T.map(t => `<span class="gal-ch${G.type === t[0] ? ' on' : ''}" data-t="${t[0]}">${t[1]}</span>`).join('');
    const names = []; G.items.forEach(it => { if(!names.some(n => n[0] === it.space)) names.push([it.space, it.spaceName]); });
    $('gal-f2').innerHTML = `<span class="gal-ch${G.space === 'all' ? ' on' : ''}" data-s="all">Все кабинеты</span>` + names.map(n => `<span class="gal-ch${G.space === n[0] ? ' on' : ''}" data-s="${X(n[0])}">${X(n[1])}</span>`).join('');
  }
  function filtered() {
    return G.items.map((it, i) => ({ it, i })).filter(o => (G.type === 'all' || (G.type === 'doc' ? (o.it.kind === 'doc' || o.it.kind === 'aud') : o.it.kind === G.type)) && (G.space === 'all' || o.it.space === G.space));
  }
  function renderBody() {
    const L = filtered();
    $('gal-cnt').textContent = L.length + ' файлов';
    $('gal-sheet').classList.toggle('selmode', G.sel);
    { const ge = $('gal-edit'); if(ge) { const one = G.sel && G.picked.size === 1 ? G.items[[...G.picked][0]] : null; ge.style.display = one && one.kind === 'img' && window.mcPhotoEdit && /^(https?|data):/i.test(one.url) ? '' : 'none'; } }
    { const gg = $('gal-grip'); if(gg) { const one = G.sel && G.picked.size === 1 && G.items[[...G.picked][0]] && /^https?:/i.test(G.items[[...G.picked][0]].url); gg.classList.toggle('show', !!one); } }
    const part = L.slice(0, G.shown);
    let h = '', cur = null;
    part.forEach(o => {
      const it = o.it, lab = dayLabel(it.ts);
      if(lab !== cur) { if(cur !== null) h += '</div>'; cur = lab; h += `<div class="gal-dt">${X(lab)}</div><div class="gal-g">`; }
      const cl = !isLocal(it) && it.kind !== 'img';
      const cls = 'gal-t' + (G.picked.has(o.i) ? ' on' : '') + (cl ? ' cl' : '') + ((it.kind === 'doc' || it.kind === 'aud') ? ' doc' : '');
      let inner;
      if(it.kind === 'img') inner = `<img src="${X(it.url)}" loading="lazy" alt="">`;
      else if(it.kind === 'vid') inner = `<video src="${X(it.url)}#t=0.1" preload="metadata" muted playsinline></video><i>▶</i>`;
      else inner = `<b>${it.kind === 'aud' ? '🎤' : '📄'}</b>${X(it.name || (it.kind === 'aud' ? 'запись' : 'файл'))}`;
      h += `<div class="${cls}" data-i="${o.i}">${inner}${cl ? '<button class="gal-dl" data-dl="' + o.i + '" aria-label="Скачать на устройство"><span>' + CLOUD + '</span></button>' : ''}${G.orig.has(it.url) ? '<u class="gal-or" title="Оригинал на этом устройстве">💎</u>' : ''}<span class="gal-sel"></span></div>`;
    });
    if(cur !== null) h += '</div>';
    if(L.length > G.shown) h += `<button class="gal-more">Показать ещё (${L.length - G.shown})</button>`;
    $('gal-body').innerHTML = h || '<div style="padding:50px 0;text-align:center;color:var(--t3)">Здесь пока ничего нет</div>';
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
    if(G.space !== 'all' && !G.items.some(it => it.space === G.space)) G.space = 'all';
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
