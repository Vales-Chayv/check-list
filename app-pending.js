// ═══════════════════════════════════════════
//  ФОНОВАЯ ЗАГРУЗКА ВЛОЖЕНИЙ
//  Файл прикрепляется к форме сразу (как «плитка в процессе»), а грузится в фоне.
//  «Сохранить» не ждёт: карточка сохраняется, плитка остаётся на месте и сама становится
//  обычным файлом, когда загрузка закончилась. Для других людей и устройств файл появляется только после загрузки.
//  Копия файла лежит на устройстве (IndexedDB «mc-pending»): если приложение закрыли, при следующем запуске докачаем.
//  Подключается после app-view.js и app-db.js. Вызов: await uploadDeferred(file) вместо await uploadToStorage(file).
// ═══════════════════════════════════════════
(function () {
  if (window._mcPend) return; window._mcPend = true;
  const jobs = new Map(); // pendId → job
  window._mcPendCards = new WeakMap(); // файл → карточка (для кружка «✓»: открыть нужную карточку)
  const tst = (m, e) => { try { toast(m, e); } catch (_) {} };
  const isP = a => !!a && a.pending === true && !!a.pendId;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ── хранилище копий на устройстве ──
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('mc-pending', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('jobs', { keyPath: 'pendId' });
    r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const idb = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction('jobs', mode), q = fn(t.objectStore('jobs')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const save = j => idb('readwrite', s => s.put({ pendId: j.pendId, blob: j.real ? null : j.file, real: j.real || null, name: j.file.name, type: j.file.type, size: j.file.size, ts: j.att.ts, cardId: j.cardId || null, spaceId: j.spaceId || null, entryId: j.entryId || null, list: j.list || null, entryRef: j.entryRef || null, err: !!j.err })).catch(() => {});
  const drop = id => idb('readwrite', s => s.delete(id)).catch(() => {});

  // ── обход карточки ──
  function listsOf(card) {
    const L = [];
    if (card && Array.isArray(card.attachments)) L.push({ list: card.attachments, key: 'attachments', entry: null });
    ((card && card.entries) || []).forEach(e => { if (!e) return; ['attachments', 'sessionAtts'].forEach(k => { if (Array.isArray(e[k])) L.push({ list: e[k], key: k, entry: e }); }); });
    return L;
  }
  function replaceIn(card, pendId, real) { // real=null — убрать
    let hit = false;
    for (const { list } of listsOf(card)) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i] && list[i].pendId === pendId) { if (real) list[i] = real; else list.splice(i, 1); hit = true; }
    }
    return hit;
  }

  // ── что уходит на сервер: без незавершённых файлов ──
  window.mcPendStrip = function (card) {
    if (!card) return card;
    let any = false;
    const out = { ...card };
    if (Array.isArray(card.attachments) && card.attachments.some(isP)) {
      any = true; out.attachments = card.attachments.filter(a => !isP(a));
      card.attachments.filter(isP).forEach(a => note(a, card, null, 'attachments', null));
    }
    if (Array.isArray(card.entries) && card.entries.some(e => e && ['attachments', 'sessionAtts'].some(k => Array.isArray(e[k]) && e[k].some(isP)))) {
      any = true; out.entries = [];
      for (const e of card.entries) {
        if (!e || !['attachments', 'sessionAtts'].some(k => Array.isArray(e[k]) && e[k].some(isP))) { out.entries.push(e); continue; }
        const e2 = { ...e };
        ['attachments', 'sessionAtts'].forEach(k => { if (Array.isArray(e[k])) e2[k] = e[k].filter(a => !isP(a)); });
        const empty = !e.text && !e.sessionNote && !(e2.attachments || []).length && !(e2.sessionAtts || []).length;
        ['attachments', 'sessionAtts'].forEach(k => (e[k] || []).filter(isP).forEach(a => note(a, card, e.id, k, empty ? e : null)));
        if (!empty) out.entries.push(e2);
      }
    }
    return any ? out : card;
  };
  function note(a, card, entryId, key, entryRef) { // запоминаем «адрес»: куда положить файл, когда он догрузится
    const j = jobs.get(a.pendId); if (!j) return;
    j.cardId = card.id; j.spaceId = card.space_id || null; j.entryId = entryId; j.list = key; if (entryRef) j.entryRef = entryRef;
    try { window._mcPendCards.set(j.file, { cardId: j.cardId, spaceId: j.spaceId }); } catch (e) {}
    save(j);
    if (j.real) deliver(j); // файл успел догрузиться раньше сохранения
  }

  // ── вернуть плитки в карточки, если их затёрла синхронизация ──
  function reinject() {
    if (!jobs.size || typeof cards === 'undefined') return;
    for (const j of jobs.values()) {
      if (!j.cardId || j.real) continue;
      const card = cards.find(c => c.id === j.cardId); if (!card) continue;
      if (listsOf(card).some(l => l.list.some(a => a && a.pendId === j.pendId))) continue;
      if (j.entryId) {
        let e = (card.entries || []).find(x => x && x.id === j.entryId);
        if (!e && j.entryRef) { card.entries = [j.entryRef, ...(card.entries || [])]; e = j.entryRef; }
        if (e) { e[j.list] = e[j.list] || []; if (!e[j.list].some(a => a && a.pendId === j.pendId)) e[j.list].push(j.att); }
      } else card.attachments = [...(card.attachments || []), j.att];
    }
  }

  // ── вызов вместо uploadToStorage ──
  window.uploadDeferred = async function (file, cardId, entryId) {
    const t = file.type || '', kind = t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : t.startsWith('image/') ? 'image' : 'other';
    // ролик больше лимита в APK сначала сожмётся, поэтому тоже грузим в фоне (до 300 МБ); остальное большое — обычный отказ про размер
    const squeeze = kind === 'video' && typeof window.mcCompressVideo === 'function' && file.size <= 300 * 1024 * 1024;
    if (kind !== 'image' && !squeeze && typeof MC_LIMITS !== 'undefined' && file.size > MC_LIMITS[kind]) return window.uploadToStorage(file, cardId, entryId);
    const id = 'p_' + uid();
    const att = { id, pendId: id, pending: true, name: file.name, type: t, size: file.size, data: URL.createObjectURL(file), ts: Date.now() };
    const j = { pendId: id, file, att, cardId: cardId || null, entryId: entryId || null, running: false, err: false };
    jobs.set(id, j);
    window._mcPendCards.set(file, null); // карточка пока неизвестна
    await save(j);
    run(j);
    return att;
  };

  const isNet = e => !navigator.onLine || e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed|timeout|timed out|5 минут/i.test(String((e && e.message) || e));

  async function run(j) {
    if (j.running || j.cancelled) return;
    j.running = true; j.err = false; decorate();
    let att;
    try { att = await window.uploadToStorage(j.file, j.cardId || undefined, j.entryId || undefined); }
    catch (e) {
      j.running = false;
      if (isNet(e)) { j.err = true; save(j); decorate(); return; }
      jobs.delete(j.pendId); await patchAll(j.pendId, null); await drop(j.pendId); decorate();
      if (!(e && e.message === 'file_too_big')) tst('Файл не загрузился: ' + String((e && e.message) || e).slice(0, 80), true);
      return;
    }
    j.running = false;
    if (j.cancelled) { await drop(j.pendId); return; }
    const real = { ...att }; delete real.pending; delete real.pendId;
    if (!real.id) real.id = uid();
    j.real = real; await save(j);   // файл в облаке; в журнале помним «куда его положить»
    await deliver(j);
    decorate();
  }

  const FORMS = () => [['tempAtt', typeof tempAtt !== 'undefined' ? tempAtt : null, 'renderAttPrev'], ['aeAtts', typeof aeAtts !== 'undefined' ? aeAtts : null, 'renderAEPrev'], ['_eeAtts', typeof _eeAtts !== 'undefined' ? _eeAtts : null, 'renderEEPrev']];
  function patchForms(pendId, real) {
    let hit = false;
    for (const [, arr, rn] of FORMS()) {
      if (!Array.isArray(arr)) continue;
      let h = false;
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].pendId === pendId) { arr[i] = real; h = true; }
      if (h) { hit = true; try { window[rn](); } catch (e) {} }
    }
    return hit;
  }
  function place(card, j, real) { // положить файл в карточку по адресу; false — адреса больше нет (запись удалили)
    if (replaceIn(card, j.pendId, real)) return true;
    if (listsOf(card).some(l => l.list.some(a => a && a.data === real.data))) return true;
    if (j.entryId) {
      let e = (card.entries || []).find(x => x && x.id === j.entryId);
      if (!e && j.entryRef) { e = j.entryRef; ['attachments', 'sessionAtts'].forEach(k => { if (Array.isArray(e[k])) e[k] = e[k].map(a => a && a.pendId === j.pendId ? real : a); }); card.entries = [e, ...(card.entries || [])]; return true; }
      if (!e) return false;
      const k = j.list || 'attachments'; e[k] = e[k] || []; e[k].push(real); return true;
    }
    card.attachments = [...(card.attachments || []), real]; return true;
  }
  async function orphan(j, why) { // файл никуда не приписан: убираем из облака
    jobs.delete(j.pendId); await drop(j.pendId);
    try { if (typeof storageRemoveAtts === 'function' && j.real) storageRemoveAtts([j.real]); } catch (e) {}
    if (why) tst(why, true);
  }
  // доставка готового файла: плитку в карточке мы не ищем, едем по адресу из журнала
  async function deliver(j) {
    if (j.delivering) return; j.delivering = true;
    try {
      const real = j.real;
      const inForm = patchForms(j.pendId, real);
      if (!j.cardId) { // карточка ещё не сохранена
        if (inForm) { jobs.delete(j.pendId); await drop(j.pendId); return; } // форма сама унесёт файл при сохранении
        for (let n = 0; n < 4 && !j.cardId; n++) await wait(1000); // вдруг сохранение как раз идёт
        if (!j.cardId) { await orphan(j, 'Файл ' + (j.file.name || '') + ' не прикреплён: карточку не сохранили'); return; }
      }
      let card = (typeof cards !== 'undefined' ? cards : []).find(c => c.id === j.cardId), mem = !!card;
      if (!card && navigator.onLine) { try { const r = await sb.from('cards').select('*').eq('id', j.cardId).maybeSingle(); if (!r.error) { card = r.data; if (!card) { await orphan(j, 'Файл не прикреплён: карточку удалили'); return; } } } catch (e) {} }
      if (!card) { try { card = (await local.getAll('cards')).find(c => c.id === j.cardId); } catch (e) {} }
      if (!card) return; // нет сети: повторим позже, запись в журнале остаётся
      if (!place(card, j, real)) { await orphan(j, 'Файл не прикреплён: запись удалили'); return; }
      try { window._mcPendCards.set(j.file, { cardId: j.cardId, spaceId: card.space_id || j.spaceId || null }); } catch (e) {}
      await dbUpdate(card);
      jobs.delete(j.pendId); await drop(j.pendId);
      setTimeout(() => { try { URL.revokeObjectURL(j.att.data); } catch (e) {} }, 30000);
      try {
        if (mem && typeof render === 'function') render();
        if (typeof openView === 'function' && window._openViewId === j.cardId && document.getElementById('view-ov') && document.getElementById('view-ov').classList.contains('on')) openView(j.cardId);
      } catch (e) {}
    } finally { j.delivering = false; decorate(); }
  }

  // подменить плитку на готовый файл везде: в формах, в открытых карточках и в сохранённых копиях
  async function patchAll(pendId, real, file) {
    let hit = false;
    const forms = [['tempAtt', () => typeof tempAtt !== 'undefined' ? tempAtt : null, 'renderAttPrev'], ['aeAtts', () => typeof aeAtts !== 'undefined' ? aeAtts : null, 'renderAEPrev'], ['_eeAtts', () => typeof _eeAtts !== 'undefined' ? _eeAtts : null, 'renderEEPrev']];
    for (const [, get, rn] of forms) {
      const arr = get(); if (!Array.isArray(arr)) continue;
      let h = false;
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].pendId === pendId) { if (real) arr[i] = real; else arr.splice(i, 1); h = true; }
      if (h) { hit = true; try { window[rn](); } catch (e) {} }
    }
    const upd = new Map();
    if (typeof cards !== 'undefined') for (const c of cards) if (replaceIn(c, pendId, real)) upd.set(c.id, c);
    try { for (const c of await local.getAll('cards')) if (!upd.has(c.id) && replaceIn(c, pendId, real)) upd.set(c.id, c); } catch (e) {}
    if (file && real && upd.size) { try { window._mcPendCards.set(file, [...upd.keys()][0]); } catch (e) {} }
    for (const c of upd.values()) { hit = true; try { await dbUpdate(c); } catch (e) {} }
    if (upd.size) {
      try { if (typeof render === 'function') render(); if (typeof openView === 'function' && upd.has(window._openViewId) && document.getElementById('view-ov') && document.getElementById('view-ov').classList.contains('on')) openView(window._openViewId); } catch (e) {}
    }
    return hit;
  }

  function cancel(j) {
    j.cancelled = true; jobs.delete(j.pendId);
    patchAll(j.pendId, null).then(() => { drop(j.pendId); decorate(); tst('Загрузка отменена'); });
  }

  // ── значок поверх плитки ──
  const st = document.createElement('style');
  st.textContent = '.mc-pend{opacity:.45}.mc-pend-b{position:absolute;transform:translate(-50%,-50%);background:rgba(0,0,0,.7);color:#fff;border-radius:12px;padding:3px 9px;font-size:12px;z-index:3;cursor:pointer;white-space:nowrap}';
  document.head.appendChild(st);
  const byUrl = u => { for (const j of jobs.values()) if (j.att.data === u) return j; return null; };
  function decorate() {
    const live = new Set();
    document.querySelectorAll('img[src^="blob:"],video[src^="blob:"],audio[src^="blob:"]').forEach(el => {
      const j = byUrl(el.getAttribute('src')); if (!j) { el.classList.remove('mc-pend'); return; }
      live.add(j.pendId); el.classList.add('mc-pend');
      const p = el.parentElement; if (!p) return;
      let b = p.querySelector(':scope > .mc-pend-b[data-p="' + j.pendId + '"]');
      if (!b) { if (getComputedStyle(p).position === 'static') p.style.position = 'relative'; b = document.createElement('span'); b.className = 'mc-pend-b'; b.dataset.p = j.pendId; p.appendChild(b); }
      const tx = j.err ? '⚠ повторить' : '⏳'; if (b.textContent !== tx) b.textContent = tx;
      b.style.left = (el.offsetLeft + el.offsetWidth / 2) + 'px'; b.style.top = (el.offsetTop + el.offsetHeight / 2) + 'px';
    });
    document.querySelectorAll('.mc-pend-b').forEach(b => { if (!live.has(b.dataset.p)) b.remove(); });
  }
  let tm = null;
  new MutationObserver(() => { if (!jobs.size && !document.querySelector('.mc-pend-b')) return; clearTimeout(tm); tm = setTimeout(decorate, 120); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('.mc-pend-b'); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const j = jobs.get(b.dataset.p); if (!j) return;
    if (j.err) run(j); else if (confirm('Отменить загрузку этого файла?')) cancel(j);
  }, true);

  // ── докачка после закрытия приложения ──
  let resumed = false;
  async function resume() {
    if (resumed) return; resumed = true;
    let recs = []; try { recs = await idb('readonly', s => s.getAll()) || []; } catch (e) {}
    for (const r of recs) {
      if (jobs.has(r.pendId) || (!r.blob && !r.real)) continue;
      const file = new File([r.blob || new Blob([])], r.name || 'file', { type: r.type || '' });
      const att = { id: r.pendId, pendId: r.pendId, pending: true, name: file.name, type: file.type, size: r.size || file.size, data: r.real ? r.real.data : URL.createObjectURL(file), ts: r.ts || Date.now() };
      const j = { pendId: r.pendId, file, att, real: r.real || null, cardId: r.cardId, spaceId: r.spaceId, entryId: r.entryId, list: r.list, entryRef: r.entryRef || null, running: false, err: false };
      jobs.set(r.pendId, j); if (r.cardId) window._mcPendCards.set(file, { cardId: r.cardId, spaceId: r.spaceId || null });
      if (r.real) continue; // уже в облаке, осталось положить в карточку
      const fix = c => listsOf(c).forEach(l => l.list.forEach(a => { if (a && a.pendId === r.pendId) { a.data = att.data; a.pending = true; } }));
      if (typeof cards !== 'undefined') cards.forEach(fix);
      try { for (const c of await local.getAll('cards')) { let h = false; listsOf(c).forEach(l => l.list.forEach(a => { if (a && a.pendId === r.pendId) { a.data = att.data; h = true; } })); if (h) await local.put('cards', c); } } catch (e) {}
    }
    if (jobs.size) {
      reinject(); try { render(); } catch (e) {}
      const up = [...jobs.values()].filter(j => !j.real).length;
      if (up) tst('⏳ Докачиваю файлы: ' + up);
      for (const j of jobs.values()) { if (j.real) { if (j.cardId) deliver(j); else orphan(j); } else if (navigator.onLine) run(j); else j.err = true; }
      decorate();
    }
  }
  const retry = () => { for (const j of jobs.values()) { if (j.real && j.cardId) deliver(j); else if (j.err) run(j); } };
  setInterval(() => { if (jobs.size && navigator.onLine) retry(); }, 30000);
  window.addEventListener('online', retry);

  // ── вставка в render: вернуть плитки и один раз запустить докачку ──
  const r0 = window.render;
  if (typeof r0 === 'function') {
    window.render = function () {
      try { reinject(); } catch (e) {}
      const out = r0.apply(this, arguments);
      try { if (!resumed && typeof currentUser !== 'undefined' && currentUser) resume(); decorate(); } catch (e) {}
      return out;
    };
  }
  setTimeout(() => { try { if (!resumed && typeof currentUser !== 'undefined' && currentUser) resume(); } catch (e) {} }, 6000);
})();
