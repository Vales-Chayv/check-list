// ═══════════════════════════════════════════════════════════════════
//  КОПИЯ КАРТОЧЕК В ZIP: выгрузка (карточки + файлы) и повторная загрузка. Заменяет старое окно «Архив» (app-archive.js: PDF, Excel, удаление).
//  Кнопка 📦 в шапке по-прежнему вызывает openArchive(): теперь это окно выгрузки в ZIP с уже выбранными выполненными карточками.
//  Подключается после app-transfer.js (берёт оттуда ZipOut и fsSink).
//  Строки в ⚙️: «📦 Копия карточек в ZIP».
//  Кнопка «📦 В ZIP» в карточке: window.mcArchiveCard(id).
//  Формат: about.json + cards.json + categories.json + files/…  (format = 1)
//  Загрузка только ДОБАВЛЯЕТ: существующие записи, тексты и статусы не меняются и не удаляются.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.mcArchive) return;

  const FORMAT = 1;
  const COLS = ['id', 'created_at', 'title', 'body', 'category', 'status', 'ball', 'attachments', 'reminder', 'history', 'related_ids', 'entries', 'deadline', 'priority', 'space_id', 'assigned_to', 'created_by', 'today', 'pinned', 'entryGroups', 'chatParticipants', 'chatStatus', 'ballWho'];
  const MOBILE_MAX = 300 * 1048576;   // на телефоне архив собирается в памяти устройства
  const BLK = 1048576;
  const isNative = () => { try { return typeof window.isNativeApp === 'function' && window.isNativeApp(); } catch (e) { return false; } };
  const X = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safe = (s, n) => (String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '') || 'file').slice(0, n || 60);
  const say = (m, bad) => { try { toast(m, !!bad); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o == null ? null : o));
  const newId = () => (typeof uid === 'function' ? uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const entryTs = e => { const m = /^[0-9a-z]{8}/.exec(String((e && e.id) || '')); if (m) { const t = parseInt(m[0], 36); if (t > 1.5e12 && t < 4.1e12) return t; } return null; };
  const ymd = () => { const d = new Date(), p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const mb = b => b > 1048576 ? (b / 1048576).toFixed(b > 1e10 ? 0 : 1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
  const attLists = e => [['attachments', e.attachments], ['sessionAtts', e.sessionAtts]];

  // ───────── чтение ZIP (по частям файла, без загрузки всего в память) ─────────
  async function readZip(file) {
    const size = file.size;
    if (size < 22) throw new Error('пустой файл');
    const tailLen = Math.min(size, 65557 + 22);
    const tail = new DataView(await file.slice(size - tailLen, size).arrayBuffer());
    let e = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('это не ZIP-архив');
    let n = tail.getUint16(e + 10, true), cdSize = tail.getUint32(e + 12, true), cdOff = tail.getUint32(e + 16, true);
    const u64 = (dv, o) => dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296;
    if (n === 0xFFFF || cdSize === 0xFFFFFFFF || cdOff === 0xFFFFFFFF) {
      const lo = e - 20;
      if (lo < 0 || tail.getUint32(lo, true) !== 0x07064b50) throw new Error('повреждён ZIP64');
      const z64at = u64(tail, lo + 8);
      const z = new DataView(await file.slice(z64at, z64at + 56).arrayBuffer());
      if (z.getUint32(0, true) !== 0x06064b50) throw new Error('повреждён ZIP64');
      n = u64(z, 32); cdSize = u64(z, 40); cdOff = u64(z, 48);
    }
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const u8 = new Uint8Array(cd.buffer), dec = new TextDecoder('utf-8');
    const map = new Map();
    let p = 0;
    for (let k = 0; k < n && p + 46 <= cd.byteLength; k++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true);
      let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true), off = cd.getUint32(p + 42, true);
      const nl = cd.getUint16(p + 28, true), el = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      let q = p + 46 + nl; const qe = q + el;
      while (q + 4 <= qe) {
        const id = cd.getUint16(q, true), sz = cd.getUint16(q + 2, true); let r = q + 4;
        if (id === 1) {
          if (usize === 0xFFFFFFFF) { usize = u64(cd, r); r += 8; }
          if (csize === 0xFFFFFFFF) { csize = u64(cd, r); r += 8; }
          if (off === 0xFFFFFFFF) { off = u64(cd, r); r += 8; }
        }
        q += 4 + sz;
      }
      map.set(name, { name, method, csize, usize, off });
      p += 46 + nl + el + cl;
    }
    async function read(name) {
      const ent = map.get(name); if (!ent) throw new Error('нет файла ' + name);
      const h = new DataView(await file.slice(ent.off, ent.off + 30).arrayBuffer());
      if (h.getUint32(0, true) !== 0x04034b50) throw new Error('повреждён ' + name);
      const start = ent.off + 30 + h.getUint16(26, true) + h.getUint16(28, true);
      const raw = file.slice(start, start + ent.csize);
      if (ent.method === 0) return raw;
      if (ent.method === 8 && typeof DecompressionStream === 'function') return await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      throw new Error('неподдерживаемое сжатие в ' + name);
    }
    return { has: nm => map.has(nm), names: () => [...map.keys()], read, readText: async nm => await (await read(nm)).text(), count: map.size };
  }

  // ───────── окно ─────────
  let busy = false, cancelled = false;
  function openOv(html) {
    closeOv(true);
    const ov = document.createElement('div');
    ov.id = 'mc-arc-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100060;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;font-family:inherit';
    ov.innerHTML = '<div id="mc-arc-box" style="background:var(--s1);color:var(--t1);border:1px solid var(--b1);border-radius:14px;width:min(600px,100%);max-height:92vh;display:flex;flex-direction:column;box-sizing:border-box">' + html + '</div>';
    document.body.appendChild(ov);
    return ov;
  }
  function closeOv(force) {
    const ov = document.getElementById('mc-arc-ov');
    if (ov && (force || !busy)) ov.remove();
  }
  const BS = 'background:var(--s2);color:var(--t1);border:1px solid var(--b1);border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;font-family:inherit';
  const BP = 'background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit';
  const head = t => '<div style="padding:16px 18px 6px;font-size:17px;font-weight:700">' + t + '</div>';
  const foot = h => '<div style="padding:12px 18px 16px;display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap;border-top:1px solid var(--b1)">' + h + '</div>';
  const work = on => {
    try {
      if (on) { window._mcWorkArc = window._mcWork; window._mcWork = 'Архив карточек…'; }
      else if (window._mcWork === 'Архив карточек…') window._mcWork = window._mcWorkArc || '';
      if (window.mcKeepSync) window.mcKeepSync();
    } catch (e) {}
  };
  function progressView(title) {
    const ov = openOv(head(title) + '<div style="padding:6px 18px 4px"><div id="arc-msg" style="font-size:14px;line-height:1.5;min-height:42px;word-break:break-word"></div>' +
      '<div style="height:10px;background:var(--s2);border-radius:99px;overflow:hidden;margin:8px 0"><i id="arc-bar" style="display:block;height:100%;width:0;background:var(--accent)"></i></div>' +
      '<div style="font-size:12px;color:var(--t3)">Не закрывайте приложение до конца. Экран можно выключить.</div></div>' +
      foot('<button id="arc-cancel" style="' + BS + '">Отмена</button>'));
    ov.querySelector('#arc-cancel').onclick = () => { cancelled = true; ov.querySelector('#arc-cancel').textContent = 'Останавливаю…'; };
    return (msg, frac) => {
      const m = ov.querySelector('#arc-msg'), b = ov.querySelector('#arc-bar');
      if (m) m.textContent = msg; if (b && frac != null) b.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%';
    };
  }

  // ───────── ВЫГРУЗКА ─────────
  function memSink() {
    const chunks = []; let off = 0;
    return {
      async write(u8) {
        if (u8.length >= 65536) chunks.push({ off, b: new Blob([u8]), len: u8.length });
        else chunks.push({ off, u8: u8.slice(), len: u8.length });
        off += u8.length;
      },
      async patch(at, b) {
        for (let i = chunks.length - 1; i >= 0; i--) { const c = chunks[i]; if (c.u8 && c.off <= at && at < c.off + c.len) { c.u8.set(b, at - c.off); return; } }
        throw new Error('внутренняя ошибка архива');
      },
      blob() { return new Blob(chunks.map(c => c.b || c.u8), { type: 'application/zip' }); },
      async close() {}, async abort() {}
    };
  }
  function collectAtts(card) {
    const out = [];
    (card.attachments || []).forEach(a => a && out.push(a));
    (card.entries || []).forEach(e => { if (e) attLists(e).forEach(([, l]) => (l || []).forEach(a => a && out.push(a))); });
    return out;
  }
  function cardInfo(c) {
    const ents = (c.entries || []).length, n = collectAtts(c).length;
    return (c.category ? c.category + ' · ' : '') + ents + ' запис.' + (n ? ' · 📎' + n : '') + (c.chatParticipants && c.chatParticipants.length ? ' · 💬' : '');
  }

  function exportDialog(preIds, opt) {
    opt = opt || {};
    if (busy) return say('Идёт другая операция с архивом', true);
    if (!window.mcXfer || !window.mcXfer.ZipOut) return say('Модуль передачи не загрузился. Обновите страницу', true);
    const list = (opt.list || (typeof cards !== 'undefined' ? cards : [])).filter(c => c && c.id);   // opt.list — карточки из нескольких кабинетов (лобби «Готово»)
    if (!list.length) return say('В этом кабинете нет карточек', true);
    const many = !!opt.many;
    const single = preIds && preIds.length === 1 && !many;
    const isDone = c => c && c.status === 'done';
    const sel = new Set(preIds && preIds.length ? preIds : opt.done ? list.filter(isDone).map(c => c.id) : list.map(c => c.id));
    const ov = openOv(head(single ? '📦 Карточка в ZIP' : '📦 Выгрузить в ZIP') +
      '<div style="padding:0 18px 6px;font-size:13px;color:var(--t3);line-height:1.5">' + (single ? 'Один ZIP: карточка со всеми записями и файлами.' : many ? 'Один ZIP: ' + X(opt.title || 'выбранные карточки') + '. Снимите галочки с лишних. Файлы в архиве разложены по папкам кабинетов.' : 'Один ZIP: выбранные карточки (включая чаты) со всеми записями. Кабинет: «' + X((typeof currentSpace !== 'undefined' && currentSpace && currentSpace.name) || 'Личный') + '».') + '</div>' +
      (single ? '' : '<div style="padding:4px 18px;display:flex;gap:6px;flex-wrap:wrap"><button data-q="all" style="' + BS + '">Все</button>' + (many ? '' : '<button data-q="done" style="' + BS + '">Только выполненные</button>') + '<button data-q="none" style="' + BS + '">Ничего</button>' + (many ? '' : '<button id="arc-imp" style="' + BS + ';margin-left:auto">📥 Загрузить из ZIP</button>') + '</div><div id="arc-list" style="padding:6px 12px;overflow:auto;min-height:0;max-height:300px"></div>') +
      '<label style="padding:8px 18px;font-size:14px;display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="arc-files" checked> Вместе с файлами (фото, ролики, голос)</label>' +
      foot('<span id="arc-cnt" style="margin-right:auto;font-size:13px;color:var(--t3)"></span><button id="arc-x" style="' + BS + '">Отмена</button><button id="arc-go" style="' + BP + '">Выгрузить</button>'));
    const $ = s => ov.querySelector(s);
    const cnt = () => { $('#arc-cnt').textContent = 'Карточек: ' + sel.size + ' из ' + list.length; };
    function render() {
      const box = $('#arc-list'); if (!box) return cnt();
      box.innerHTML = list.map(c => '<label style="display:flex;gap:9px;align-items:flex-start;padding:7px 6px;border-bottom:1px solid var(--b1);cursor:pointer;font-size:14px"><input type="checkbox" data-id="' + X(c.id) + '"' + (sel.has(c.id) ? ' checked' : '') + ' style="margin-top:3px"><span style="flex:1;min-width:0;word-break:break-word" dir="auto">' + X(c.title || '(без названия)') + '<br><span style="font-size:12px;color:var(--t3)">' + (opt.cabName ? '🗂️ ' + X(opt.cabName(c)) + ' · ' : '') + X(cardInfo(c)) + '</span></span></label>').join('');
      box.querySelectorAll('input[data-id]').forEach(i => i.onchange = () => { i.checked ? sel.add(i.dataset.id) : sel.delete(i.dataset.id); cnt(); });
      cnt();
    }
    ov.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { sel.clear(); if (b.dataset.q === 'all') list.forEach(c => sel.add(c.id)); if (b.dataset.q === 'done') list.filter(isDone).forEach(c => sel.add(c.id)); render(); });
    if ($('#arc-imp')) $('#arc-imp').onclick = () => { closeOv(); pickArchive(); };
    if (opt.done && !list.some(isDone)) say('Выполненных карточек нет: отметьте нужные вручную');
    $('#arc-x').onclick = () => closeOv();
    $('#arc-go').onclick = () => {
      if (!sel.size) return say('Выберите хотя бы одну карточку', true);
      const chosen = list.filter(c => sel.has(c.id));
      const withFiles = $('#arc-files').checked;
      runExport(chosen, withFiles, single ? safe('Карточка_' + (chosen[0].title || 'без названия'), 50) : many ? safe(opt.title || 'Выполненные', 50) : null, opt);
    };
    render();
  }

  async function runExport(chosen, withFiles, nameBase, opt) {
    opt = opt || {};
    const cabOf = opt.cabName ? (c => safe(opt.cabName(c) || 'Кабинет', 40)) : null;   // папка кабинета в архиве
    if (busy) return;
    busy = true; cancelled = false; work(true);
    const BaseZip = window.mcXfer.ZipOut, fsSink = window.mcXfer.fsSink;
    // в ZipOut имена «выравниваются» (слэш → _): нам нужны папки, поэтому имя берём как есть (оно уже уникальное и очищенное)
    class ArcZip extends BaseZip { uniq(n) { this.names.add(String(n).toLowerCase()); return n; } }
    const spaceName = cabOf ? 'Все личные кабинеты' : (typeof currentSpace !== 'undefined' && currentSpace && currentSpace.name) || 'Личный';
    const fname = (nameBase || safe('Карточки_' + spaceName, 50)) + '_' + ymd() + '.zip';
    let sink = null, mem = null, writer = null, ok = false;
    try {
      if (typeof window.showSaveFilePicker === 'function' && !isNative()) {
        let h;
        try { h = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }] }); }
        catch (e) { if (e && e.name === 'AbortError') { busy = false; work(false); closeOv(true); return; } throw e; }
        writer = await h.createWritable(); sink = fsSink(writer);
      } else { mem = memSink(); sink = mem; }
      const upd = progressView('📦 Выгружаю архив');
      const zip = new ArcZip(sink);
      const enc = new TextEncoder();
      const putJson = async (name, obj) => { const u = enc.encode(JSON.stringify(obj)); await zip.begin(name, u.length, Date.now()); await zip.data(u); await zip.end(); };

      // 1. копия карточек и список файлов
      const out = chosen.map(c => { const o = {}; COLS.forEach(k => { if (c[k] !== undefined && k !== 'space_id') o[k] = clone(c[k]); }); if (cabOf) o.cabinet = opt.cabName(c); return o; });
      const jobs = [];
      out.forEach((c, ci) => {
        const dir = cabOf ? cabOf(chosen[ci]) + '/' : '';
        const push = a => { if (a) { jobs.push(a); if (dir) a._dir = dir; } };
        (c.attachments || []).forEach(push);
        (c.entries || []).forEach(e => { if (e) attLists(e).forEach(([, l]) => (l || []).forEach(push)); });
      });
      // 2. файлы
      const byUrl = new Map(); let n = 0, done = 0, total = 0, miss = 0, bytes = 0;
      if (withFiles) {
        const uniqUrls = new Set(jobs.map(a => a.data).filter(Boolean)); total = uniqUrls.size;
        for (const a of jobs) {
          if (cancelled) throw new Error('cancel');
          if (!a.data) { a.missing = true; miss++; continue; }
          if (byUrl.has(a.data)) { const f = byUrl.get(a.data); if (f) a._f = f; else { a.missing = true; } continue; }
          upd('Файл ' + (done + 1) + ' из ' + total + ': ' + (a.name || 'файл'), total ? done / total : 0);
          let blob = null;
          try { const r = await fetch(a.data); if (!r.ok) throw new Error('HTTP ' + r.status); blob = await r.blob(); } catch (e) { blob = null; }
          done++;
          if (!blob) { byUrl.set(a.data, null); a.missing = true; miss++; continue; }
          bytes += blob.size;
          if (mem && bytes > MOBILE_MAX) throw new Error('Архив слишком большой для этого устройства (больше ' + mb(MOBILE_MAX) + '). Выгрузите без файлов или частями, либо на компьютере.');
          const nm = (a._dir || '') + 'files/' + String(++n).padStart(4, '0') + '_' + safe(a.name || 'file', 80);
          await zip.begin(nm, blob.size, a.ts || Date.now());
          for (let i = 0; i < blob.size; i += BLK) { await zip.data(new Uint8Array(await blob.slice(i, i + BLK).arrayBuffer())); if (cancelled) throw new Error('cancel'); }
          await zip.end();
          byUrl.set(a.data, nm); a._f = nm;
        }
      }
      // 3. служебные файлы
      jobs.forEach(a => { delete a.data; delete a.pending; delete a.pendId; delete a.offline; delete a._dir; });
      const catNames = new Set(out.map(c => c.category).filter(Boolean));
      const catList = opt.catList || ((typeof cats !== 'undefined' ? cats : []) || []).filter(c => c && catNames.has(c.name)).map(c => ({ name: c.name, color: c.color }));
      upd('Записываю карточки…', 1);
      await putJson('about.json', { app: 'Мои карточки', format: FORMAT, created: new Date().toISOString(), cabinet: cabOf ? { id: 'many', name: spaceName, type: 'personal', list: [...new Set(out.map(c => c.cabinet))] } : { id: (typeof currentSpaceId !== 'undefined' && currentSpaceId) || 'personal', name: spaceName, type: (typeof currentSpace !== 'undefined' && currentSpace && currentSpace.type) || 'personal' }, cards: out.length, files: n, filesIncluded: !!withFiles, missingFiles: miss, by: (typeof currentUser !== 'undefined' && currentUser && currentUser.display_name) || '' });
      await putJson('categories.json', catList);
      await putJson('cards.json', out);
      await zip.finish();
      if (writer) await sink.close();
      ok = true;
      if (mem) {
        const blob = mem.blob();
        if (isNative() && typeof mcNativeShareFile === 'function') { const sr = await mcNativeShareFile(blob, 'mycards_archive.zip', fname); if (!sr) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); } }
        else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
      }
      busy = false; work(false);
      openOv(head('✅ Архив готов') + '<div style="padding:6px 18px 12px;font-size:14px;line-height:1.6">Карточек: <b>' + out.length + '</b><br>Файлов: <b>' + n + '</b>' + (withFiles ? ' (' + mb(bytes) + ')' : ' — выгрузка без файлов') + (miss ? '<br><span style="color:#e67e22">Не удалось получить файлов: ' + miss + ' (удалены из облака или недоступны). Они отмечены в архиве.</span>' : '') + '<br><span style="color:var(--t3);font-size:13px">' + X(fname) + '</span></div>' + foot('<button id="arc-ok" style="' + BP + '">Готово</button>'));
      document.getElementById('arc-ok').onclick = () => closeOv();
    } catch (e) {
      try { if (writer && !ok) await sink.abort(); } catch (_) {}
      busy = false; work(false);
      if (e && e.message === 'cancel') { closeOv(true); say('Выгрузка отменена'); }
      else { openOv(head('⚠ Не получилось') + '<div style="padding:6px 18px 12px;font-size:14px;line-height:1.5">' + X((e && e.message) || e) + '</div>' + foot('<button id="arc-ok" style="' + BP + '">Закрыть</button>')); document.getElementById('arc-ok').onclick = () => closeOv(); }
    } finally { busy = false; work(false); }
  }

  // ───────── ЗАГРУЗКА ─────────
  const sameSpace = () => (typeof currentSpaceId !== 'undefined' && currentSpaceId) || 'personal';

  function planCard(ac, ex) {
    // ac — карточка из архива, ex — такая же в этом кабинете (или null). Что именно можно добавить.
    const p = { addEntries: [], addCardAtts: [], addEntryAtts: [], addGroups: [], files: 0 };
    if (!ex) { p.files = collectAtts(ac).filter(a => a._f).length; return p; }
    const have = new Map((ex.entries || []).filter(e => e && e.id).map(e => [e.id, e]));
    const hasAtt = new Set(collectAtts(ex).map(a => a && a.id).filter(Boolean));
    const can = a => a && a.id && a._f && !hasAtt.has(a.id);   // вложение без файла в архиве (недоступно при выгрузке) добавить нельзя
    (ac.attachments || []).forEach(a => { if (can(a)) p.addCardAtts.push(a); });
    (ac.entries || []).forEach(e => {
      if (!e) return;
      const cur = e.id && have.get(e.id);
      if (!cur) { p.addEntries.push(e); return; }
      attLists(e).forEach(([k, l]) => (l || []).forEach(a => { if (can(a)) p.addEntryAtts.push({ entryId: e.id, list: k, att: a }); }));
    });
    const gh = new Set((ex.entryGroups || []).map(g => g && g.id));
    (ac.entryGroups || []).forEach(g => { if (g && g.id && !gh.has(g.id)) p.addGroups.push(g); });
    const fl = [...p.addCardAtts, ...p.addEntryAtts.map(x => x.att), ...p.addEntries.flatMap(e => attLists(e).flatMap(([, l]) => l || []))];
    p.files = fl.filter(a => a && a._f).length;
    p.changed = !!(p.addEntries.length || p.addCardAtts.length || p.addEntryAtts.length || p.addGroups.length);
    return p;
  }

  async function pickArchive() {
    if (busy) return say('Идёт другая операция с архивом', true);
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.zip,application/zip,application/x-zip-compressed';
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.remove();
      if (f) openArchive(f);
    };
    inp.click();
  }

  async function openArchive(file) {
    if (!window.mcXfer) { /* ZipOut нужен только для выгрузки */ }
    let z, about, acards, acats = [];
    try {
      z = await readZip(file);
      if (!z.has('about.json') || !z.has('cards.json')) throw new Error('В архиве нет файлов about.json и cards.json: это не архив «Мои карточки».');
      about = JSON.parse(await z.readText('about.json'));
      if (!about || about.app !== 'Мои карточки') throw new Error('Это не архив «Мои карточки».');
      if (about.format > FORMAT) throw new Error('Архив сделан более новой версией приложения. Обновите приложение.');
      acards = JSON.parse(await z.readText('cards.json'));
      if (!Array.isArray(acards)) throw new Error('Повреждён cards.json');
      if (z.has('categories.json')) { try { acats = JSON.parse(await z.readText('categories.json')) || []; } catch (e) {} }
    } catch (e) {
      openOv(head('⚠ Архив не открылся') + '<div style="padding:6px 18px 12px;font-size:14px;line-height:1.5">' + X((e && e.message) || e) + '</div>' + foot('<button id="arc-ok" style="' + BP + '">Закрыть</button>'));
      document.getElementById('arc-ok').onclick = () => closeOv();
      return;
    }
    // что уже есть
    const local = new Map((typeof cards !== 'undefined' ? cards : []).map(c => [c.id, c]));
    let elsewhere = new Set();
    try {
      const ids = acards.map(c => c && c.id).filter(id => id && !local.has(id));
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await sb.from('cards').select('id').in('id', ids.slice(i, i + 100));
        (data || []).forEach(r => elsewhere.add(r.id));
      }
    } catch (e) {}
    const rows = acards.filter(c => c && c.id).map(c => {
      const ex = local.get(c.id) || null;
      const plan = planCard(c, ex);
      const st = ex ? (plan.changed ? 'add' : 'same') : (elsewhere.has(c.id) ? 'other' : 'new');
      return { c, ex, plan, st };
    });
    const sel = new Set(rows.filter(r => r.st !== 'same').map(r => r.c.id));
    let mode = 'add';
    const cntNew = rows.filter(r => r.st === 'new' || r.st === 'other').length, cntAdd = rows.filter(r => r.st === 'add').length, cntSame = rows.filter(r => r.st === 'same').length;
    const ov = openOv(head('📥 Загрузка из ZIP') +
      '<div style="overflow:auto;min-height:0;flex:1">' +
      '<div style="padding:0 18px 6px;font-size:13px;color:var(--t3);line-height:1.5">Архив от ' + X((about.created || '').slice(0, 10)) + ', кабинет «' + X((about.cabinet && about.cabinet.name) || '') + '». Загружается в текущий кабинет: «' + X((typeof currentSpace !== 'undefined' && currentSpace && currentSpace.name) || 'Личный') + '».' + (about.filesIncluded === false ? ' <b>Архив без файлов.</b>' : '') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:6px 18px"><div style="background:var(--s2);border-radius:10px;padding:8px;text-align:center"><b style="font-size:18px">' + cntNew + '</b><div style="font-size:11px;color:var(--t3)">новых</div></div><div style="background:var(--s2);border-radius:10px;padding:8px;text-align:center"><b style="font-size:18px">' + cntAdd + '</b><div style="font-size:11px;color:var(--t3)">есть, можно дополнить</div></div><div style="background:var(--s2);border-radius:10px;padding:8px;text-align:center"><b style="font-size:18px">' + cntSame + '</b><div style="font-size:11px;color:var(--t3)">без изменений</div></div></div>' +
      '<div style="padding:4px 18px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button data-q="all" style="' + BS + '">Все</button><button data-q="none" style="' + BS + '">Ничего</button><span style="font-size:13px;color:var(--t3);margin-left:4px">Если карточка уже есть:</span>' +
      '<select id="arc-mode" style="' + BS + '"><option value="add">Дополнить (по умолчанию)</option><option value="skip">Не трогать</option><option value="copy">Добавить как копию</option></select></div>' +
      '<div id="arc-list" style="padding:6px 12px;max-height:300px;overflow:auto"></div></div>' +
      foot('<span id="arc-cnt" style="margin-right:auto;font-size:13px;color:var(--t3)"></span><button id="arc-x" style="' + BS + '">Отмена</button><button id="arc-go" style="' + BP + '">Загрузить</button>'));
    const $ = s => ov.querySelector(s);
    const tag = r => {
      const t = (bg, txt) => '<span style="font-size:11px;font-weight:600;border-radius:99px;padding:2px 8px;white-space:nowrap;background:' + bg + ';color:#111">' + txt + '</span>';
      if (r.st === 'new') return t('#8fd6a8', 'новая');
      if (r.st === 'other') return t('#8fd6a8', 'новая (id занят в другом кабинете)');
      if (r.st === 'same') return t('var(--b1)', 'без изменений');
      const p = r.plan, parts = [];
      if (p.addEntries.length) parts.push('+' + p.addEntries.length + ' запис.');
      if (p.files) parts.push('+' + p.files + ' файл.');
      return t('#f0c27a', 'есть: ' + (parts.join(', ') || 'дополнить'));
    };
    function cnt() { $('#arc-cnt').textContent = 'Выбрано: ' + sel.size + ' из ' + rows.length; }
    function render() {
      $('#arc-list').innerHTML = rows.map(r => '<label style="display:flex;gap:9px;align-items:flex-start;padding:7px 6px;border-bottom:1px solid var(--b1);cursor:pointer;font-size:14px"><input type="checkbox" data-id="' + X(r.c.id) + '"' + (sel.has(r.c.id) ? ' checked' : '') + ' style="margin-top:3px"><span style="flex:1;min-width:0;word-break:break-word" dir="auto">' + X(r.c.title || '(без названия)') + '<br><span style="font-size:12px;color:var(--t3)">' + X(cardInfo(r.c)) + '</span></span>' + tag(r) + '</label>').join('') || '<div style="padding:10px;color:var(--t3);font-size:13px">В архиве нет карточек</div>';
      $('#arc-list').querySelectorAll('input[data-id]').forEach(i => i.onchange = () => { i.checked ? sel.add(i.dataset.id) : sel.delete(i.dataset.id); cnt(); });
      cnt();
    }
    ov.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { sel.clear(); if (b.dataset.q === 'all') rows.forEach(r => sel.add(r.c.id)); render(); });
    $('#arc-mode').onchange = e => { mode = e.target.value; };
    $('#arc-x').onclick = () => closeOv();
    $('#arc-go').onclick = () => {
      if (!sel.size) return say('Выберите хотя бы одну карточку', true);
      if (!navigator.onLine) return say('Нужен интернет: файлы загружаются в облако', true);
      runImport(z, rows.filter(r => sel.has(r.c.id)), acats, mode, about.filesIncluded === false);
    };
    render();
  }

  async function runImport(z, rows, acats, mode, noFiles) {
    if (busy) return;
    busy = true; cancelled = false; work(true);
    const upd = progressView('📥 Загружаю из архива');
    const space = sameSpace();
    const r = { added: 0, extended: 0, skipped: 0, files: 0, nofile: 0, fails: [], cards: [] };
    const upCache = new Map();
    let filesDone = 0, filesTotal = 0;
    rows.forEach(x => {
      if (x.st === 'same' && mode !== 'copy') return;
      if (x.ex && mode === 'skip') return;
      filesTotal += (x.ex && mode !== 'copy') ? x.plan.files : collectAtts(x.c).filter(a => a._f).length;
    });
    const up = async (a, cardId, entryId) => {
      if (!a._f) { if (noFiles) r.nofile++; else r.fails.push((a.name || 'файл') + ' — файла нет в архиве (при выгрузке был недоступен)'); return null; }
      const ck = cardId + '|' + a._f;
      const mk = res => Object.assign({}, res, { id: a.id || res.id, name: a.name || res.name });
      if (upCache.has(ck)) return mk(clone(upCache.get(ck)));
      try {
        const blob = await z.read(a._f);
        const f = new File([blob], a.name || 'file', { type: a.type || blob.type || '' });
        const res = await window.uploadToStorage(f, cardId, entryId);
        if (!res) throw new Error('не загрузился');
        upCache.set(ck, clone(res)); r.files++; filesDone++;
        return mk(clone(res));
      } catch (e) { filesDone++; r.fails.push((a.name || 'файл') + ' — ' + ((e && e.message) || e)); return null; }
    };
    const upList = async (list, cardId, entryId) => {
      const res = [];
      for (const a of (list || [])) { if (!a) continue; if (cancelled) throw new Error('cancel'); const n = await up(a, cardId, entryId); if (n) res.push(n); }
      return res;
    };
    const strip = o => { if (!o) return o; delete o._f; delete o.missing; return o; };
    const insertAt = (list, e) => {
      const t = entryTs(e); if (t == null) { list.push(e); return; }
      const i = list.findIndex(x => { const tx = entryTs(x); return tx != null && tx < t; });
      if (i < 0) list.push(e); else list.splice(i, 0, e);
    };
    try {
      // рубрики
      const have = new Set(((typeof cats !== 'undefined' ? cats : []) || []).map(c => c && c.name));
      const need = [...new Set(rows.map(x => x.c.category).filter(Boolean))].filter(n => !have.has(n));
      for (const n of need) { const col = (acats.find(c => c && c.name === n) || {}).color || '#e8c56a'; const cat = { name: n, color: col }; cats.push(cat); try { await dbAddCat(cat); } catch (e) {} }

      let i = 0;
      for (const x of rows) {
        if (cancelled) throw new Error('cancel');
        i++;
        const title = x.c.title || '(без названия)';
        upd('Карточка ' + i + ' из ' + rows.length + ': ' + title + (filesTotal ? '  ·  файлов ' + filesDone + ' из ' + filesTotal : ''), filesTotal ? filesDone / filesTotal : (i - 1) / rows.length);
        if (x.st === 'same' && mode !== 'copy') { r.skipped++; continue; }
        if (x.ex && mode === 'skip') { r.skipped++; continue; }
        if (!x.ex || mode === 'copy') {
          // новая карточка (или копия существующей)
          const isCopy = !!x.ex;
          const id = (x.st === 'other' || isCopy) ? newId() : x.c.id;
          const card = {};
          COLS.forEach(k => { if (x.c[k] !== undefined) card[k] = clone(x.c[k]); });
          card.id = id; card.space_id = space;
          if (isCopy) card.title = (card.title || '') + ' (из архива)';
          if (!card.created_at) card.created_at = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
          card.attachments = await upList(card.attachments, id, null);
          card.entries = card.entries || [];
          for (const e of card.entries) {
            if (!e) continue;
            if (!e.id) e.id = newId();
            for (const [k, l] of attLists(e)) if (l && l.length) e[k] = await upList(l, id, e.id);
          }
          cards.unshift(card);
          await dbInsert(card);
          r.added++; r.cards.push(title);
        } else {
          // дополняем существующую: только то, чего в ней нет
          const ex = x.ex, p = x.plan;
          const card = Object.assign({}, ex);
          const entries = (ex.entries || []).map(e => e);
          for (const e0 of p.addEntries) {
            const e = clone(e0); if (!e.id) e.id = newId();
            for (const [k, l] of attLists(e)) if (l && l.length) e[k] = await upList(l, ex.id, e.id);
            strip(e); insertAt(entries, e);
          }
          for (const it of p.addEntryAtts) {
            const idx = entries.findIndex(e => e && e.id === it.entryId); if (idx < 0) continue;
            const n = await up(it.att, ex.id, it.entryId); if (!n) continue;
            const e = Object.assign({}, entries[idx]); e[it.list] = [...(e[it.list] || []), n]; entries[idx] = e;
          }
          const atts = [...(ex.attachments || [])];
          for (const a of p.addCardAtts) { const n = await up(a, ex.id, null); if (n) atts.push(n); }
          card.entries = entries; card.attachments = atts;
          if (p.addGroups.length) card.entryGroups = [...(ex.entryGroups || []), ...p.addGroups.map(g => clone(g))];
          const k = cards.findIndex(c => c.id === ex.id); if (k >= 0) cards[k] = card;
          await dbUpdate(card);
          r.extended++; r.cards.push(title);
        }
        try { if (typeof render === 'function' && i % 5 === 0) render(); } catch (e) {}
      }
      try { if (typeof render === 'function') render(); } catch (e) {}
      busy = false; work(false);
      showReport(r, false);
    } catch (e) {
      busy = false; work(false);
      try { if (typeof render === 'function') render(); } catch (_) {}
      if (e && e.message === 'cancel') { showReport(r, true); }
      else { showReport(r, false, (e && e.message) || String(e)); }
    } finally { busy = false; work(false); }
  }

  function showReport(r, stopped, err) {
    const fails = r.fails.slice(0, 8).map(s => '<div style="font-size:12.5px;color:#e67e22;margin-top:3px;word-break:break-word">• ' + X(s) + '</div>').join('') + (r.fails.length > 8 ? '<div style="font-size:12px;color:var(--t3);margin-top:3px">…и ещё ' + (r.fails.length - 8) + '</div>' : '');
    openOv(head(err ? '⚠ Загрузка прервана' : stopped ? '⏹ Остановлено' : '✅ Готово') +
      '<div style="padding:6px 18px 12px;font-size:14px;line-height:1.6;overflow:auto">' + (err ? '<div style="color:#e67e22;margin-bottom:6px">' + X(err) + '</div>' : '') +
      'Добавлено новых карточек: <b>' + r.added + '</b><br>Дополнено существующих: <b>' + r.extended + '</b><br>Пропущено: <b>' + r.skipped + '</b><br>Загружено файлов: <b>' + r.files + '</b>' + (r.nofile ? '<br><span style="color:var(--t3)">Архив без файлов: вложений пропущено ' + r.nofile + '</span>' : '') +
      (r.fails.length ? '<div style="margin-top:8px;font-weight:600">Не удалось (' + r.fails.length + '):</div>' + fails : '') +
      (stopped || err ? '<div style="font-size:12.5px;color:var(--t3);margin-top:8px">Уже загруженное осталось. Можно запустить загрузку этого же архива ещё раз: дублей не будет, догрузится только недостающее.</div>' : '') + '</div>' +
      foot('<button id="arc-ok" style="' + BP + '">Готово</button>'));
    document.getElementById('arc-ok').onclick = () => closeOv();
  }

  // ───────── строки в настройках, кнопка «назад» ─────────
  function settingsRows() {
    try {
      const ph = document.getElementById('set-phone');
      const anchor = ph && ph.closest('.fld');
      if (!anchor || !anchor.parentNode || document.getElementById('arc-row')) return;
      const row = document.createElement('div');
      row.id = 'arc-row';
      row.style.cssText = 'background:var(--s2);border-radius:var(--rsm);padding:13px 14px';
      const btn = 'margin-top:9px;background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:var(--rsm);padding:9px 14px;font-size:14px;cursor:pointer;font-family:inherit;margin-right:8px';
      row.innerHTML = '<div style="font-size:15px;font-weight:600">📦 Копия карточек в ZIP</div>' +
        '<div style="font-size:12.5px;color:var(--t2);margin-top:4px;line-height:1.5">Резерв и перенос: карточки, записи, чаты и файлы одним ZIP. Загрузка из ZIP только добавляет, ничего не удаляет и не меняет.</div>' +
        '<button style="' + btn + '" onclick="closeSettings();mcArchiveExport()">📦 Выгрузить в ZIP</button>' +
        '<button style="' + btn + '" onclick="closeSettings();mcArchiveImport()">📥 Загрузить из ZIP</button>';
      anchor.parentNode.insertBefore(row, anchor);
    } catch (e) {}
  }
  (function hookSettings() {
    const tryHook = () => {
      if (typeof window.openSettings !== 'function') return false;
      if (window.openSettings._arc) return true;
      const o = window.openSettings;
      const w = async function () { const r = await o.apply(this, arguments); settingsRows(); return r; };
      w._arc = true; window.openSettings = w; return true;
    };
    if (!tryHook()) { let n = 0; const t = setInterval(() => { if (tryHook() || ++n > 40) clearInterval(t); }, 500); }
  })();
  (function hookBack() {
    const tryHook = () => {
      if (typeof window.mcBackStepCore !== 'function') return false;
      if (window.mcBackStepCore._arc) return true;
      const o = window.mcBackStepCore;
      window.mcBackStepCore = function () {
        if (document.getElementById('mc-arc-ov')) { if (!busy) closeOv(); return true; }
        return o.apply(this, arguments);
      };
      window.mcBackStepCore._arc = true; return true;
    };
    if (!tryHook()) { let n = 0; const t = setInterval(() => { if (tryHook() || ++n > 40) clearInterval(t); }, 500); }
  })();

  window.mcArchiveExport = () => exportDialog(null);
  // совместимость со старым окном «Архив»: кнопка 📦 в шапке и обработчики «назад» вызывают openArchive / closeArchive
  window.openArchive = () => exportDialog(null, { done: true });
  window.closeArchive = () => closeOv();
  window.mcArchiveImport = pickArchive;
  window.mcArchiveCard = id => exportDialog([id]);
  window.mcArchive = { readZip, planCard, openArchive, exportDialog, runExport, _state: () => ({ busy }) };
})();
