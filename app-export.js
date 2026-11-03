// ===== Выгрузка карточки в Word + папка с файлами (ZIP) =====
// Результат: <Название>.zip → <Название>/<Название>.docx и <Название>/files/…  (документ ссылается на файлы из files)
const _XE = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _isRTL = s => /[֐-ࣿ]/.test(s || '');
const _safeName = (s, max) => (String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '') || 'file').slice(0, max || 80);

// форматированный текст записи → массив кусочков {t, b, i, u, s} и {br:true}
function mcRichToParts(html) {
  const root = document.createElement('div');
  root.innerHTML = (typeof sanitizeRich === 'function') ? sanitizeRich(html || '') : _XE(html || '');
  const out = [];
  const BLOCK = /^(DIV|P|LI|H[1-6]|UL|OL|BLOCKQUOTE)$/;
  (function walk(n, st) {
    n.childNodes.forEach(c => {
      if (c.nodeType === 3) { if (c.nodeValue) out.push({ t: c.nodeValue, ...st }); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName;
      if (tag === 'BR') { out.push({ br: true }); return; }
      const ns = { ...st };
      if (tag === 'B' || tag === 'STRONG') ns.b = true;
      if (tag === 'I' || tag === 'EM') ns.i = true;
      if (tag === 'U') ns.u = true;
      if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') ns.s = true;
      if (tag === 'LI') out.push({ t: '• ', ...st });
      if (BLOCK.test(tag) && out.length && !out[out.length - 1].br) out.push({ br: true });
      walk(c, ns);
      if (BLOCK.test(tag) && out.length && !out[out.length - 1].br) out.push({ br: true });
    });
  })(root, {});
  while (out.length && out[out.length - 1].br) out.pop();
  return out;
}

function mcDocRun(text, o) {
  o = o || {};
  const rpr = (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') + (o.u ? '<w:u w:val="single"/>' : '') + (o.s ? '<w:strike/>' : '') +
    (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.size ? '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>' : '') + (o.rtl ? '<w:rtl/>' : '');
  return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + _XE(text) + '</w:t></w:r>';
}
function mcDocPara(inner, o) {
  o = o || {};
  return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') +
    (o.bar ? '<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="B8892B"/></w:pBdr>' : '') +
    (o.bidi ? '<w:bidi/>' : '') +
    '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 60 : o.after) + '"' + (o.line ? ' w:line="' + o.line + '" w:lineRule="exact"' : '') + '/>' +
    (o.bar ? '<w:ind w:left="200"/>' : '') + (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') + '</w:pPr>' + inner + '</w:p>';
}

async function mcFetchBlob(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.blob();
}
// уменьшенная копия фото для вставки в Word (оригинал уходит в files)
async function mcThumb(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch (e) { return null; }
  const k = Math.min(1, 640 / bmp.width, 840 / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
  return b ? { buf: await b.arrayBuffer(), w, h } : null;
}

function mcEntryTs(e) {
  // время создания записи зашито в начале её id (uid = Date.now() в base36)
  const m = /^[0-9a-z]{8}/.exec(String((e && e.id) || ''));
  if (m) { const t = parseInt(m[0], 36); if (t > 1.5e12 && t < 4.1e12) return t; }
  return null;
}
function mcExportEntries(card) {
  const list = (card.entries || []).filter(e => e && (e.text || e.sessionNote || (e.attachments || []).length || (e.sessionAtts || []).length)).map((e, i) => ({ e, i, ts: mcEntryTs(e) }));
  let last = 0; list.forEach(x => { if (x.ts == null) x.ts = last; else last = x.ts; });
  return list;
}
// настройки оформления (хранятся на этом устройстве)
function mcExpPrefsLoad() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('mc_exp_prefs') || '{}') || {}; } catch (e) {}
  return Object.assign({ logo: '', studio: '', slogan: '', site: '', author: '', showNames: true, checks: true, signs: false }, p);
}
function mcExpPrefsSave(p) { try { localStorage.setItem('mc_exp_prefs', JSON.stringify(p)); } catch (e) { toast('Не удалось сохранить оформление (логотип слишком большой?)', true); } }
// логотип → маленький PNG (с прозрачностью) в виде data URL
async function mcLogoFromFile(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 320 / bmp.height, 900 / bmp.width);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c.toDataURL('image/png');
}

function mcExportCardWord(cardId) {
  const card = (typeof cards !== 'undefined') && cards.find(c => c.id === cardId);
  if (!card) return;
  if (typeof JSZip === 'undefined') { toast('Модуль архивов не загрузился. Проверь интернет и обнови страницу', true); return; }
  if (window._mcExporting || document.getElementById('mc-exp-ov')) return;
  const list = mcExportEntries(card);
  const cardAttCount = (card.attachments || []).filter(a => a && a.data).length;
  if (!list.length && !cardAttCount) { toast('В карточке нет записей и вложений', true); return; }
  const P = mcExpPrefsLoad();
  if (!P.author && typeof currentUser !== 'undefined' && currentUser && currentUser.display_name) P.author = currentUser.display_name;
  const checked = new Set(list.map(x => x.e.id));
  let order = 'asc';
  const ov = document.createElement('div');
  ov.id = 'mc-exp-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;font-family:inherit';
  const bs = 'background:var(--s2);color:var(--t1);border:1px solid var(--b1);border-radius:8px;padding:7px 11px;font-size:13px;cursor:pointer;font-family:inherit';
  const is = 'background:var(--s2);color:var(--t1);border:1px solid var(--b1);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;width:100%;box-sizing:border-box';
  const lab = t => '<div style="font-size:12px;color:var(--t3);margin:8px 0 3px">' + t + '</div>';
  const chk = (id, t, on) => '<label style="display:flex;gap:8px;align-items:center;font-size:14px;padding:4px 0;cursor:pointer"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + t + '</label>';
  ov.innerHTML = '<div style="background:var(--s1);color:var(--t1);border:1px solid var(--b1);border-radius:14px;width:min(580px,100%);max-height:92vh;display:flex;flex-direction:column;box-sizing:border-box">' +
    '<div style="padding:16px 18px 6px;font-size:17px;font-weight:700">📄 Выгрузка в Word</div>' +
    '<div style="overflow:auto;flex:1;min-height:0">' +
    '<div style="padding:0 18px 6px;font-size:13px;color:var(--t3)">Выбери записи. Вместе с документом скачается папка files с фото, роликами и голосовыми.</div>' +
    '<div style="padding:4px 18px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
      '<button data-q="all" style="' + bs + '">Все</button><button data-q="none" style="' + bs + '">Ничего</button>' +
      '<button data-q="done" style="' + bs + '">Только ☑ отмеченные</button><button data-q="open" style="' + bs + '">Только без отметки</button>' +
      '<select id="mc-exp-ord" style="' + bs + '"><option value="asc">Сначала старые</option><option value="desc">Сначала новые</option></select></div>' +
    '<div id="mc-exp-list" style="padding:6px 12px;max-height:230px;overflow:auto"></div>' +
    (cardAttCount ? '<label style="padding:6px 18px;font-size:14px;display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="mc-exp-card" checked> Вложения самой карточки (' + cardAttCount + ')</label>' : '') +
    '<details style="margin:6px 18px 4px;border-top:1px solid var(--b1);padding-top:8px"' + (P.studio || P.logo ? '' : ' open') + '><summary style="cursor:pointer;font-size:14px;font-weight:600">🎨 Оформление документа</summary>' +
      lab('Логотип (запоминается на этом устройстве)') +
      '<div style="display:flex;gap:8px;align-items:center"><img id="mc-exp-logo-img" style="height:40px;max-width:120px;object-fit:contain;display:none;background:#fff;border-radius:6px;padding:2px"><button id="mc-exp-logo-btn" style="' + bs + '">Выбрать файл…</button><button id="mc-exp-logo-del" style="' + bs + ';display:none">Убрать</button><input type="file" id="mc-exp-logo-file" accept="image/*" style="display:none"></div>' +
      lab('Название студии или компании') + '<input id="mc-exp-studio" style="' + is + '" value="' + _XE(P.studio) + '">' +
      lab('Слоган (необязательно)') + '<input id="mc-exp-slogan" style="' + is + '" value="' + _XE(P.slogan) + '">' +
      lab('Сайт или контакты (справа в шапке и в нижнем колонтитуле)') + '<input id="mc-exp-site" style="' + is + '" value="' + _XE(P.site) + '">' +
      lab('Название документа') + '<input id="mc-exp-title" style="' + is + '" value="' + _XE(card.title || '') + '">' +
      lab('Объект (необязательно)') + '<input id="mc-exp-object" style="' + is + '">' +
      lab('Составил(а)') + '<input id="mc-exp-author" style="' + is + '" value="' + _XE(P.author) + '">' +
      '<div style="margin-top:8px">' + chk('mc-exp-names', 'Показывать названия файлов (без них документ компактнее)', P.showNames) +
      chk('mc-exp-checks', 'Галочка «выполнено» возле каждой записи', P.checks) +
      chk('mc-exp-signs', 'Строки для подписей в конце', P.signs) + '</div></details>' +
    '</div>' +
    '<div style="padding:12px 18px 16px;display:flex;gap:8px;justify-content:flex-end;align-items:center;border-top:1px solid var(--b1)"><span id="mc-exp-cnt" style="margin-right:auto;font-size:13px;color:var(--t3)"></span>' +
      '<button id="mc-exp-x" style="' + bs + ';padding:10px 16px;font-size:14px">Отмена</button>' +
      '<button id="mc-exp-go" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Выгрузить</button></div></div>';
  document.body.appendChild(ov);
  const $ = id => ov.querySelector('#' + id);
  const sorted = () => list.slice().sort((a, b) => (order === 'asc' ? 1 : -1) * ((a.ts - b.ts) || (a.i - b.i)));
  const plain = e => { const t = mcRichToParts(e.text || e.sessionNote || '').map(x => x.br ? ' ' : (x.t || '')).join('').trim(); return t.length > 70 ? t.slice(0, 68) + '…' : (t || '(без текста)'); };
  function render() {
    const box = $('mc-exp-list');
    box.innerHTML = sorted().map(x => {
      const na = (x.e.sessionAtts || []).length + (x.e.attachments || []).length;
      return '<label style="display:flex;gap:9px;align-items:flex-start;padding:7px 6px;border-bottom:1px solid var(--b1);cursor:pointer;font-size:14px">' +
        '<input type="checkbox" data-id="' + _XE(x.e.id) + '"' + (checked.has(x.e.id) ? ' checked' : '') + ' style="margin-top:3px">' +
        '<span style="flex:1;min-width:0;word-break:break-word" dir="auto">' + (x.e.done ? '☑ ' : '') + _XE(plain(x.e)) + '</span>' +
        '<span style="font-size:12px;color:var(--t3);white-space:nowrap">' + _XE(x.e.date || '') + (na ? ' · 📎' + na : '') + '</span></label>';
    }).join('') || '<div style="padding:10px;color:var(--t3);font-size:13px">Записей нет</div>';
    box.querySelectorAll('input[data-id]').forEach(i => i.onchange = () => { i.checked ? checked.add(i.dataset.id) : checked.delete(i.dataset.id); count(); });
    count();
  }
  function count() { $('mc-exp-cnt').textContent = 'Записей: ' + checked.size + ' из ' + list.length; }
  function showLogo() { const im = $('mc-exp-logo-img'); if (P.logo) { im.src = P.logo; im.style.display = ''; $('mc-exp-logo-del').style.display = ''; } else { im.style.display = 'none'; $('mc-exp-logo-del').style.display = 'none'; } }
  showLogo();
  $('mc-exp-logo-btn').onclick = () => $('mc-exp-logo-file').click();
  $('mc-exp-logo-file').onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { P.logo = await mcLogoFromFile(f); showLogo(); } catch (err) { toast('Не удалось прочитать картинку логотипа', true); }
  };
  $('mc-exp-logo-del').onclick = () => { P.logo = ''; showLogo(); };
  ov.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const q = b.dataset.q; checked.clear();
    list.forEach(x => { if (q === 'all' || (q === 'done' && x.e.done) || (q === 'open' && !x.e.done)) checked.add(x.e.id); });
    render();
  });
  $('mc-exp-ord').onchange = e => { order = e.target.value; render(); };
  const close = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  $('mc-exp-x').onclick = close;
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  $('mc-exp-go').onclick = () => {
    const wc = $('mc-exp-card') ? $('mc-exp-card').checked : false;
    if (!checked.size && !wc) { toast('Выбери хотя бы одну запись', true); return; }
    const v = id => $(id).value.trim();
    Object.assign(P, { studio: v('mc-exp-studio'), slogan: v('mc-exp-slogan'), site: v('mc-exp-site'), author: v('mc-exp-author'),
      showNames: $('mc-exp-names').checked, checks: $('mc-exp-checks').checked, signs: $('mc-exp-signs').checked });
    mcExpPrefsSave(P);
    const ids = new Set(checked); const docTitle = v('mc-exp-title') || card.title || 'Карточка', object = v('mc-exp-object');
    close();
    mcExportCardWordRun(card, { ids, order, withCard: wc, P, docTitle, object });
  };
  render();
}

async function mcExportCardWordRun(card, opt) {
  if (window._mcExporting) return;
  window._mcExporting = true;
  const P = opt.P;
  try {
    // 1. Структура: выбранные записи по дате (рубрика — пометкой), вложения карточки под самой ранней записью
    const groups = card.entryGroups || [];
    const blocks = mcExportEntries(card).filter(x => opt.ids.has(x.e.id))
      .sort((a, b) => (opt.order === 'asc' ? 1 : -1) * ((a.ts - b.ts) || (a.i - b.i)))
      .map(x => ({ ts: x.ts, i: x.i, e: x.e, grp: ((groups.find(g => g.id === x.e.groupId) || {}).name) || '' }));
    const cardAtts = opt.withCard ? (card.attachments || []).filter(a => a && a.data) : [];
    const allAtts = [];
    const reg = (a, tag) => { const o = { a, tag }; allAtts.push(o); return o; };
    let n = 0;
    const first = blocks.length ? blocks.reduce((m, b) => ((b.ts - m.ts) || (b.i - m.i)) < 0 ? b : m) : null;
    blocks.forEach(b => {
      b.n = ++n;
      const tag = String(b.n).padStart(2, '0');
      const own = [...(b.e.sessionAtts || []), ...(b.e.attachments || [])].filter(a => a && a.data);
      b.atts = [...own, ...(b === first ? cardAtts : [])].map(a => reg(a, tag));
    });
    const cardAttObjs = first ? [] : cardAtts.map(a => reg(a, '00'));
    if (!n && !cardAttObjs.length) { toast('Ничего не выбрано', true); return; }

    // 2. Скачиваем вложения (по 3 одновременно)
    const total = allAtts.length;
    let done = 0;
    const used = new Set();
    const zip = new JSZip();
    const folder = _safeName(opt.docTitle, 60);
    const root = zip.folder(folder);
    const filesDir = root.folder('files');
    const queue = allAtts.slice();
    const worker = async () => {
      while (queue.length) {
        const o = queue.shift();
        const a = o.a;
        let base = _safeName(a.name || 'file', 90);
        if (!/\.[A-Za-z0-9]{1,5}$/.test(base)) {
          const ext = ((a.type || '').split('/')[1] || '').replace(/[^a-z0-9].*$/i, '');
          if (ext) base += '.' + ext;
        }
        let name = o.tag + '_' + base, k = 1;
        while (used.has(name.toLowerCase())) name = o.tag + '_' + (++k) + '_' + base;
        used.add(name.toLowerCase());
        o.name = name;
        const ty = a.type || '';
        try {
          const blob = await mcFetchBlob(a.data);
          const t2 = ty || blob.type || '';
          o.size = blob.size; o.isImg = t2.startsWith('image/'); o.isVid = t2.startsWith('video/'); o.isAud = t2.startsWith('audio/');
          filesDir.file(name, blob, { compression: 'STORE' });
          if (o.isImg) o.thumb = await mcThumb(blob);
        } catch (e) { o.err = true; o.isImg = ty.startsWith('image/'); o.isVid = ty.startsWith('video/'); o.isAud = ty.startsWith('audio/'); }
        done++;
        toast('⏳ Собираю документ: файл ' + done + ' из ' + total);
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    // 3. Документ
    const GOLD = 'B8892B';
    const rels = [], media = [];
    let docPrId = 1, mediaN = 0;
    const relId = () => 'rId' + (rels.length + 10);
    const extRel = name => { const id = relId(); rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + _XE('files/' + encodeURIComponent(name)) + '" TargetMode="External"/>'); return id; };
    const addMedia = (buf, ext) => { const fn = 'img' + (++mediaN) + '.' + ext; media.push({ name: fn, buf }); const id = relId(); rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + fn + '"/>'); return id; };
    const drawing = (rid, cx, cy, nm) => {
      const did = docPrId++, n2 = _XE(nm);
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + did + '" name="' + n2 + '" descr="' + n2 + '"/>' +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic><pic:nvPicPr><pic:cNvPr id="' + did + '" name="' + n2 + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    };
    // фото в документе: 3 в ряд, нажатие открывает оригинал из files
    const imgXml = o => {
      let cx = 1980000, cy = Math.round(cx * o.thumb.h / o.thumb.w);
      if (cy > 2520000) { cy = 2520000; cx = Math.round(cy * o.thumb.w / o.thumb.h); }
      const rid = addMedia(o.thumb.buf, 'jpg');
      return '<w:hyperlink r:id="' + extRel(o.name) + '" w:history="1">' + drawing(rid, cx, cy, o.name) + '</w:hyperlink>' + mcDocRun(' ', { size: 8 });
    };
    const sizeTxt = b => b == null ? '' : (b > 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ');
    const icon = o => o.isImg ? '📷 ' : o.isVid ? '🎥 ' : o.isAud ? '🎙 ' : '📎 ';
    const attXml = (list, bar) => {
      let x = '';
      const imgs = list.filter(o => o.thumb);
      for (let i = 0; i < imgs.length; i += 3) x += mcDocPara(imgs.slice(i, i + 3).map(imgXml).join(''), { keep: true, after: 60, bar });
      if (P.showNames) {
        list.forEach(o => {
          if (o.err) { x += mcDocPara(mcDocRun(icon(o), { size: 19 }) + mcDocRun((o.a.name || 'файл') + ' — файл недоступен (удалён из облака или нет сети)', { size: 19, color: 'C0392B' }), { after: 30, bar }); return; }
          x += mcDocPara(mcDocRun(icon(o), { size: 19 }) + '<w:hyperlink r:id="' + extRel(o.name) + '" w:history="1">' + mcDocRun(o.name, { size: 19, color: '1F5FA8', u: true }) + '</w:hyperlink>' + mcDocRun('  (' + sizeTxt(o.size) + ')', { size: 17, color: '8A8A8A' }), { after: 30, bar });
        });
      } else {
        // компактно: фото без подписей, остальное — одна строка коротких ссылок
        const cnt = { v: 0, a: 0, f: 0, p: 0 }; let line = '';
        list.forEach(o => {
          if (o.thumb && !o.err) return;
          if (o.err) { line += mcDocRun('⚠ ' + (o.a.name || 'файл') + ' — недоступен   ', { size: 18, color: 'C0392B' }); return; }
          const lbl = o.isVid ? 'Видео ' + (++cnt.v) : o.isAud ? 'Голосовое ' + (++cnt.a) : o.isImg ? 'Фото ' + (++cnt.p) : 'Файл ' + (++cnt.f);
          line += mcDocRun(icon(o), { size: 18 }) + '<w:hyperlink r:id="' + extRel(o.name) + '" w:history="1">' + mcDocRun(lbl, { size: 18, color: '1F5FA8', u: true }) + '</w:hyperlink>' + mcDocRun('    ', { size: 18 });
        });
        if (line) x += mcDocPara(line, { after: 30, bar });
      }
      return x;
    };
    // галочка «выполнено» (в Word нажимается мышью)
    const checkbox = on => '<w:sdt><w:sdtPr><w:alias w:val="Выполнено"/><w14:checkbox><w14:checked w14:val="' + (on ? 1 : 0) + '"/><w14:checkedState w14:val="2611" w14:font="Segoe UI Symbol"/><w14:uncheckedState w14:val="2610" w14:font="Segoe UI Symbol"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:eastAsia="Segoe UI Symbol" w:cs="Segoe UI Symbol"/><w:sz w:val="28"/></w:rPr><w:t>' + (on ? '☑' : '☐') + '</w:t></w:r></w:sdtContent></w:sdt>' + mcDocRun(' ', { size: 24 });
    const cell = (inner, w, o) => { o = o || {}; return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.borders || '') + (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '') + '<w:vAlign w:val="' + (o.v || 'center') + '"/></w:tcPr>' + inner + '</w:tc>'; };
    const TW = 9906;
    let body = '';
    // шапка
    const hasHead = P.logo || P.studio || P.slogan || P.site;
    if (hasHead) {
      let lw = 0, logoXml = '';
      if (P.logo) {
        try {
          const bmp = await createImageBitmap(await mcFetchBlob(P.logo));
          const cy = 720000, cx = Math.round(cy * bmp.width / bmp.height);
          const bin = await (await fetch(P.logo)).arrayBuffer();
          logoXml = mcDocPara(drawing(addMedia(bin, 'png'), Math.min(cx, 2160000), cy, 'logo'), { after: 0 });
          lw = Math.min(cx, 2160000) / 635 + 200;
          if (bmp.close) bmp.close();
        } catch (e) {}
      }
      lw = Math.round(lw);
      const rw = P.site ? 2900 : 0, mw = TW - lw - rw;
      const bb = '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="DDDDDD"/></w:tcBorders>';
      const mid = (P.studio ? mcDocPara(mcDocRun(P.studio.toUpperCase(), { b: true, size: 24 }), { after: 0, bidi: _isRTL(P.studio) }) : '') + (P.slogan ? mcDocPara(mcDocRun(P.slogan, { size: 17, color: '777777', rtl: _isRTL(P.slogan) }), { after: 0, bidi: _isRTL(P.slogan) }) : '') || mcDocPara('', { after: 0 });
      let cells = '';
      if (lw) cells += cell(logoXml, lw, { borders: bb });
      cells += cell(mid, mw, { borders: bb });
      if (rw) cells += cell(mcDocPara(mcDocRun(P.site, { size: 17, color: '777777' }), { after: 0, jc: 'right' }), rw, { borders: bb });
      body += '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>' + (lw ? '<w:gridCol w:w="' + lw + '"/>' : '') + '<w:gridCol w:w="' + mw + '"/>' + (rw ? '<w:gridCol w:w="' + rw + '"/>' : '') + '</w:tblGrid><w:tr>' + cells + '</w:tr></w:tbl>';
    }
    body += mcDocPara(mcDocRun(opt.docTitle, { b: true, size: 40 }), { before: 240, after: 120, bidi: _isRTL(opt.docTitle) });
    // таблица данных
    const d = new Date(), p2 = x => String(x).padStart(2, '0');
    const pairs = [];
    if (opt.object) pairs.push(['Объект', opt.object]);
    pairs.push(['Дата', p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear()]);
    if (P.author) pairs.push(['Составил(а)', P.author]);
    pairs.push(['Записей', String(n)]);
    const bAll = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>').join('') + '</w:tcBorders>';
    let trs = '';
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i], b2 = pairs[i + 1];
      const mk = (pr, lw2, vw) => cell(mcDocPara(mcDocRun(pr[0], { b: true, size: 19 }), { after: 0 }), lw2, { borders: bAll, fill: 'F6EFD9' }) + cell(mcDocPara(mcDocRun(pr[1], { size: 20, rtl: _isRTL(pr[1]) }), { after: 0, bidi: _isRTL(pr[1]) }), vw, { borders: bAll });
      trs += '<w:tr>' + (b2 ? mk(a, 1500, 3453) + mk(b2, 1500, 3453) : mk(a, 1500, 3453) + cell(mcDocPara('', { after: 0 }), 4953, { borders: bAll })) + '</w:tr>';
    }
    body += '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="3453"/><w:gridCol w:w="1500"/><w:gridCol w:w="3453"/></w:tblGrid>' + trs + '</w:tbl>';
    body += mcDocPara('', { after: 40 });
    if (card.body) {
      const parts = mcRichToParts(card.body); const rtl = _isRTL(parts.map(x => x.t || '').join(''));
      body += mcDocPara(parts.map(x => x.br ? '<w:r><w:br/></w:r>' : mcDocRun(x.t, { ...x, rtl })).join(''), { bidi: rtl, after: 120 });
    }
    if (cardAttObjs.length) {
      body += mcDocPara(mcDocRun('Вложения карточки', { b: true, size: 26 }), { before: 160, keep: true, bar: true });
      body += attXml(cardAttObjs, true);
    }
    blocks.forEach(b => {
      const e = b.e;
      const parts = mcRichToParts(e.text || e.sessionNote || '');
      const rtl = _isRTL(parts.map(x => x.t || '').join(''));
      const textXml = parts.map(x => x.br ? '<w:r><w:br/></w:r>' : mcDocRun(x.t, { ...x, rtl, size: 24 })).join('');
      body += mcDocPara('', { after: 0, line: 200 }); // разделитель между записями (чтобы полосы не сливались)
      body += mcDocPara(mcDocRun(b.n + '.  ', { b: true, color: GOLD, size: 26, rtl }) + (P.checks ? checkbox(!!e.done) : (e.done ? mcDocRun('☑ ', { size: 24, rtl }) : '')) + textXml, { before: 100, after: 60, keep: true, bidi: rtl, bar: true });
      if (e.date || b.grp) body += mcDocPara(mcDocRun(String(e.date || '') + (b.grp ? (e.date ? '  ·  ' : '') + '▸ ' + b.grp : ''), { size: 18, color: '8A8A8A', rtl: _isRTL(b.grp) && !e.date }), { keep: true, after: 80, bar: true });
      if (b.atts.length) body += attXml(b.atts, true);
    });
    if (P.signs) {
      const top = '<w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/></w:tcBorders>';
      const sg = t => cell(mcDocPara(mcDocRun(t, { size: 17, color: '666666' }), { after: 0 }), 4400, { borders: top, v: 'top' });
      body += mcDocPara('', { before: 700, after: 0, keep: true });
      body += '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4400"/><w:gridCol w:w="1106"/><w:gridCol w:w="4400"/></w:tblGrid><w:tr>' + sg('Подпись исполнителя') + cell(mcDocPara('', { after: 0 }), 1106) + sg('Подпись заказчика') + '</w:tr></w:tbl>';
    }
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"';
    const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body +
      '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const footTxt = [P.studio, P.site].filter(Boolean).join('  ·  ');
    const footXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="DDDDDD"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="' + TW + '"/></w:tabs></w:pPr>' +
      '<w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">' + _XE(footTxt) + '</w:t></w:r><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:tab/><w:t xml:space="preserve">Стр. </w:t></w:r>' +
      '<w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:bidi="he-IL"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + rels.join('') + '</Relationships>';
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>';
    const topRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const dz = new JSZip();
    dz.file('[Content_Types].xml', ct); dz.file('_rels/.rels', topRels);
    dz.file('word/document.xml', docXml); dz.file('word/styles.xml', stylesXml); dz.file('word/footer1.xml', footXml); dz.file('word/_rels/document.xml.rels', docRels);
    media.forEach(m => dz.file('word/media/' + m.name, m.buf));
    const docBytes = await dz.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    root.file(folder + '.docx', docBytes);

    // 4. ZIP и скачивание
    toast('⏳ Упаковываю архив…');
    const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url; a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    const bad = allAtts.filter(o => o.err).length;
    toast('✓ Готово: ' + folder + '.zip' + (bad ? ' (не удалось скачать файлов: ' + bad + ')' : ''));
  } catch (e) {
    toast('Не удалось собрать документ: ' + (e && e.message || e), true);
  } finally { window._mcExporting = false; }
}
