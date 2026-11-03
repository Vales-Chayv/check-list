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
  return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') + (o.bidi ? '<w:bidi/>' : '') +
    '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 60 : o.after) + '"/></w:pPr>' + inner + '</w:p>';
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
  const H = 420, k = Math.min(1, H / bmp.height, 900 / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
  return b ? { buf: await b.arrayBuffer(), w, h } : null;
}

async function mcExportCardWord(cardId) {
  const card = (typeof cards !== 'undefined') && cards.find(c => c.id === cardId);
  if (!card) return;
  if (typeof JSZip === 'undefined') { toast('Модуль архивов не загрузился. Проверь интернет и обнови страницу', true); return; }
  if (window._mcExporting) return;
  window._mcExporting = true;
  try {
    // 1. Собираем структуру: вложения карточки, записи без рубрики, затем рубрики
    const entries = (card.entries || []).filter(e => e && (e.text || e.sessionNote || (e.attachments || []).length || (e.sessionAtts || []).length));
    const groups = card.entryGroups || [];
    const blocks = [];
    const cardAtts = (card.attachments || []).filter(a => a && a.data);
    const loose = entries.filter(e => !e.groupId || !groups.some(g => g.id === e.groupId));
    loose.forEach(e => blocks.push({ e }));
    groups.forEach(g => {
      const ge = entries.filter(e => e.groupId === g.id);
      if (ge.length) { blocks.push({ head: g.name || 'Рубрика' }); ge.forEach(e => blocks.push({ e })); }
    });
    const allAtts = [];
    const reg = (a, tag) => { const o = { a, tag }; allAtts.push(o); return o; };
    let n = 0;
    blocks.forEach(b => {
      if (!b.e) return;
      b.n = ++n;
      b.atts = [...(b.e.sessionAtts || []), ...(b.e.attachments || [])].filter(a => a && a.data).map(a => reg(a, String(b.n).padStart(2, '0')));
    });
    const cardAttObjs = cardAtts.map(a => reg(a, '00'));
    if (!n && !cardAttObjs.length) { toast('В карточке нет записей и вложений', true); return; }

    // 2. Скачиваем вложения (по 3 одновременно)
    const total = allAtts.length;
    let done = 0;
    const used = new Set();
    const zip = new JSZip();
    const folder = _safeName(card.title || 'Карточка', 60);
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
        try {
          const blob = await mcFetchBlob(a.data);
          o.size = blob.size;
          o.isImg = (a.type || blob.type || '').startsWith('image/');
          o.isVid = (a.type || blob.type || '').startsWith('video/');
          o.isAud = (a.type || blob.type || '').startsWith('audio/');
          filesDir.file(name, blob, { compression: 'STORE' });
          if (o.isImg) o.thumb = await mcThumb(blob);
        } catch (e) { o.err = true; o.isImg = (a.type || '').startsWith('image/'); o.isVid = (a.type || '').startsWith('video/'); o.isAud = (a.type || '').startsWith('audio/'); }
        done++;
        toast('⏳ Собираю документ: файл ' + done + ' из ' + total);
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    // 3. Документ
    const rels = []; // {id, type, target, ext}
    const media = []; // {name, buf}
    let docPrId = 1;
    const relId = () => 'rId' + (rels.length + 10);
    const imgXml = o => {
      const cy = Math.round(o.thumb.h / 420 * 1512000), cx = Math.round(o.thumb.w / o.thumb.h * cy);
      const id = relId(), fn = 'img' + (media.length + 1) + '.jpg';
      media.push({ name: fn, buf: o.thumb.buf });
      rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + fn + '"/>');
      const nm = _XE(o.name), did = docPrId++;
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + did + '" name="' + nm + '" descr="' + nm + '"/>' +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic><pic:nvPicPr><pic:cNvPr id="' + did + '" name="' + nm + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>' +
        mcDocRun('  ');
    };
    const sizeTxt = b => b == null ? '' : (b > 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ');
    const attXml = list => {
      let x = '';
      const imgs = list.filter(o => o.thumb);
      if (imgs.length) x += mcDocPara(imgs.map(imgXml).join(''), { keep: true, after: 60 });
      list.forEach(o => {
        const icon = o.isImg ? '📷 ' : o.isVid ? '🎥 ' : o.isAud ? '🎙 ' : '📎 ';
        if (o.err) { x += mcDocPara(mcDocRun(icon, { size: 19 }) + mcDocRun((o.a.name || 'файл') + ' — файл недоступен (удалён из облака или нет сети)', { size: 19, color: 'C0392B' }), { after: 30 }); return; }
        const id = relId();
        rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + _XE('files/' + encodeURIComponent(o.name)) + '" TargetMode="External"/>');
        x += mcDocPara(mcDocRun(icon, { size: 19 }) + '<w:hyperlink r:id="' + id + '" w:history="1">' + mcDocRun(o.name, { size: 19, color: '1F5FA8', u: true }) + '</w:hyperlink>' + mcDocRun('  (' + sizeTxt(o.size) + ')', { size: 17, color: '8A8A8A' }), { after: 30 });
      });
      return x;
    };
    let body = '';
    body += mcDocPara(mcDocRun(card.title || 'Карточка', { b: true, size: 40 }), { after: 60, bidi: _isRTL(card.title) });
    const d = new Date(), p2 = x => String(x).padStart(2, '0');
    body += mcDocPara(mcDocRun('Выгружено ' + p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() + ' · записей: ' + n + ' · вложения лежат в папке «files» рядом с этим файлом', { size: 19, color: '6B6B6B' }), { after: 160 });
    if (card.body) {
      const parts = mcRichToParts(card.body); const rtl = _isRTL(parts.map(x => x.t || '').join(''));
      body += mcDocPara(parts.map(x => x.br ? '<w:r><w:br/></w:r>' : mcDocRun(x.t, { ...x, rtl })).join(''), { bidi: rtl, after: 120 });
    }
    if (cardAttObjs.length) {
      body += mcDocPara(mcDocRun('Вложения карточки', { b: true, size: 26 }), { before: 200, keep: true });
      body += attXml(cardAttObjs);
    }
    blocks.forEach(b => {
      if (b.head) { body += mcDocPara(mcDocRun('▸ ' + b.head, { b: true, size: 28, color: 'B8892B' }), { before: 360, after: 80, keep: true, bidi: _isRTL(b.head) }); return; }
      const e = b.e;
      const parts = mcRichToParts(e.text || e.sessionNote || '');
      const rtl = _isRTL(parts.map(x => x.t || '').join(''));
      const textXml = parts.map(x => x.br ? '<w:r><w:br/></w:r>' : mcDocRun(x.t, { ...x, rtl, size: 24 })).join('');
      body += mcDocPara(mcDocRun(b.n + '.  ', { b: true, color: 'B8892B', size: 26, rtl }) + (e.done ? mcDocRun('☑ ', { size: 24, rtl }) : '') + textXml, { before: 260, after: 60, keep: true, bidi: rtl });
      if (e.date) body += mcDocPara(mcDocRun(String(e.date), { size: 18, color: '8A8A8A' }), { keep: true, after: 80 });
      if (b.atts.length) body += attXml(b.atts);
    });
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:bidi="he-IL"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + rels.join('') + '</Relationships>';
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
    const topRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const dz = new JSZip();
    dz.file('[Content_Types].xml', ct); dz.file('_rels/.rels', topRels);
    dz.file('word/document.xml', docXml); dz.file('word/styles.xml', stylesXml); dz.file('word/_rels/document.xml.rels', docRels);
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
