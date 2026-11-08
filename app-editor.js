// ═══════════════════════════════════════════
//  РЕДАКТОР ФОТО
//  Обрезка, поворот и выравнивание, рисунок, маркер, стрелка, рамка, овал, текст, мозаика (скрыть данные),
//  яркость/контраст/насыщенность, автоулучшение, чёрно-белый документ.
//  Сохранение: заменить в записи (оригинал остаётся на устройстве), добавить рядом, отправить в чат.
//  Вызов: mcPhotoEdit(url) — например из просмотра фото или из галереи.
//  Работает вместе с app-media.js (хранилище оригиналов 💎) и app-view.js.
// ═══════════════════════════════════════════
(function () {
  'use strict';
  const MAXPX = 2048;
  const COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ffffff', '#111111'];
  const RATIOS = [['Свободно', 0], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['A4', 1 / 1.414]];
  const TOOLS = [
    ['crop', '✂', 'Обрезка'], ['rot', '⟳', 'Поворот'], ['pen', '✎', 'Рисунок'], ['mark', '▬', 'Маркер'], ['arrow', '➜', 'Стрелка'],
    ['rect', '▭', 'Рамка'], ['oval', '◯', 'Овал'], ['text', 'T', 'Текст'], ['mosaic', '▦', 'Скрыть'], ['adj', '☼', 'Свет']
  ];
  const GOLD = '#B8892B';
  let E = null;
  const $ = s => E && E.ov.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tst = (m, bad) => { try { toast(m, !!bad); } catch (e) {} };

  // ── загрузка картинки ──
  async function loadBitmap(blob) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) { return await createImageBitmap(blob); }
  }
  async function fetchSrc(url) {
    const r = await fetch(url, url.startsWith('data:') || url.startsWith('blob:') ? undefined : { mode: 'cors' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.blob();
  }

  window.mcPhotoEdit = async function (url, opt) {
    if (E) return;
    opt = opt || {};
    let blob;
    try { tst('Открываю редактор…'); blob = await fetchSrc(url); }
    catch (e) { tst('Не удалось открыть фото для редактирования', true); return; }
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(blob.type || '')) { tst('Редактор работает с фото JPG, PNG и WebP', true); return; }
    let bmp;
    try { bmp = await loadBitmap(blob); } catch (e) { tst('Не удалось прочитать фото', true); return; }
    const k = Math.min(1, MAXPX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
    try { bmp.close(); } catch (e) {}
    const first = document.createElement('canvas'); first.width = w; first.height = h; first.getContext('2d').drawImage(cv, 0, 0);
    E = { url, blob, name: opt.name || '', cv, ctx, first, stack: [], tool: 'crop', color: COLORS[0], sz: 1, ratio: 0, crop: null, adj: { b: 0, c: 0, s: 0 }, ang: 0, tmp: null, path: null, start: null, opt };
    build();
  };

  // ── интерфейс ──
  function build() {
    const ov = document.createElement('div');
    ov.id = 'mc-ed-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#111;color:#eee;display:flex;flex-direction:column;font-family:inherit;touch-action:none;user-select:none;-webkit-user-select:none';
    const bt = 'background:#2a2a2a;border:1px solid #444;color:#eee;border-radius:10px;padding:8px 12px;font-size:14px;cursor:pointer;font-family:inherit';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;flex-shrink:0">' +
        '<button id="ed-x" style="' + bt + '">✕</button>' +
        '<button id="ed-undo" style="' + bt + ';opacity:.4">↶ Отменить</button>' +
        '<button id="ed-reset" style="' + bt + ';font-size:12px">Как было</button>' +
        '<span style="flex:1"></span>' +
        '<button id="ed-done" style="' + bt + ';background:' + GOLD + ';border-color:' + GOLD + ';color:#111;font-weight:700">Готово</button>' +
      '</div>' +
      '<div id="ed-stage" style="flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
        '<div id="ed-wrap" style="position:relative;line-height:0"></div>' +
      '</div>' +
      '<div id="ed-opts" style="flex-shrink:0;padding:8px 10px;min-height:46px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;font-size:13px"></div>' +
      '<div id="ed-tools" style="flex-shrink:0;display:flex;gap:6px;overflow-x:auto;padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px));scrollbar-width:none;border-top:1px solid #2a2a2a"></div>';
    document.body.appendChild(ov);
    E.ov = ov;
    const wrap = ov.querySelector('#ed-wrap');
    E.cv.style.cssText = 'display:block;touch-action:none;background:#fff';
    wrap.appendChild(E.cv);
    const sel = document.createElement('div');
    sel.id = 'ed-sel';
    sel.style.cssText = 'position:absolute;display:none;border:2px solid ' + GOLD + ';box-shadow:0 0 0 9999px rgba(0,0,0,.55);box-sizing:border-box';
    sel.innerHTML = ['nw', 'ne', 'sw', 'se'].map(c => '<i data-h="' + c + '" style="position:absolute;width:26px;height:26px;background:' + GOLD + ';border-radius:50%;' + (c[0] === 'n' ? 'top:-13px;' : 'bottom:-13px;') + (c[1] === 'w' ? 'left:-13px;' : 'right:-13px;') + '"></i>').join('');
    wrap.appendChild(sel);
    ov.querySelector('#ed-tools').innerHTML = TOOLS.map(t => '<button data-t="' + t[0] + '" style="flex:0 0 auto;min-width:64px;background:#222;border:1px solid #3a3a3a;color:#eee;border-radius:12px;padding:6px 4px;font-family:inherit;cursor:pointer"><div style="font-size:19px;line-height:22px">' + t[1] + '</div><div style="font-size:11px">' + t[2] + '</div></button>').join('');
    ov.querySelector('#ed-tools').onclick = e => { const b = e.target.closest('[data-t]'); if (b) setTool(b.dataset.t); };
    ov.querySelector('#ed-x').onclick = () => closeEd(false);
    ov.querySelector('#ed-undo').onclick = undo;
    ov.querySelector('#ed-reset').onclick = reset;
    ov.querySelector('#ed-done').onclick = finish;
    window.addEventListener('resize', fit);
    attachPointer();
    fit(); setTool('crop');
  }
  window.mcEdBack = function () { if (!E) return false; closeEd(false); return true; };

  function closeEd(force) {
    if (!E) return;
    if (!force && (E.stack.length || E.changed) && !confirm('Закрыть редактор? Правки не сохранятся.')) return;
    window.removeEventListener('resize', fit);
    E.ov.remove(); E = null;
  }

  function fit() {
    if (!E) return;
    const st = E.ov.querySelector('#ed-stage'), w = st.clientWidth - 16, h = st.clientHeight - 16;
    const k = Math.min(w / E.cv.width, h / E.cv.height);
    E.cv.style.width = Math.max(40, Math.floor(E.cv.width * k)) + 'px';
    E.cv.style.height = Math.max(40, Math.floor(E.cv.height * k)) + 'px';
    drawSel();
  }
  const pt = e => { const r = E.cv.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * E.cv.width / r.width, 0, E.cv.width), y: clamp((e.clientY - r.top) * E.cv.height / r.height, 0, E.cv.height) }; };

  // ── отмена ──
  function snap() {
    const c = document.createElement('canvas'); c.width = E.cv.width; c.height = E.cv.height;
    c.getContext('2d').drawImage(E.cv, 0, 0);
    E.stack.push(c);
    const max = Math.max(2, Math.floor(25e6 / (c.width * c.height)));
    while (E.stack.length > max) E.stack.shift();
    E.changed = true; upd();
  }
  function upd() { const b = E.ov.querySelector('#ed-undo'); b.style.opacity = E.stack.length ? '1' : '.4'; }
  function putBack(c) { E.cv.width = c.width; E.cv.height = c.height; E.ctx.drawImage(c, 0, 0); fit(); }
  function undo() { const c = E.stack.pop(); if (!c) return; putBack(c); upd(); E.crop = null; E.adj = { b: 0, c: 0, s: 0 }; setTool(E.tool); }
  function reset() { if (!E.stack.length && !E.changed) return; snap(); putBack(E.first); E.crop = null; E.adj = { b: 0, c: 0, s: 0 }; setTool(E.tool); }

  // ── панель инструмента ──
  function setTool(t) {
    E.tool = t; E.cv.style.filter = ''; E.cv.style.transform = ''; E.ang = 0; E.adj = { b: 0, c: 0, s: 0 };
    E.ov.querySelectorAll('[data-t]').forEach(b => { const on = b.dataset.t === t; b.style.background = on ? GOLD : '#222'; b.style.color = on ? '#111' : '#eee'; });
    const o = E.ov.querySelector('#ed-opts'), chip = (id, txt, on) => '<button id="' + id + '" style="background:' + (on ? GOLD : '#2a2a2a') + ';color:' + (on ? '#111' : '#eee') + ';border:1px solid #444;border-radius:14px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit">' + txt + '</button>';
    const sw = () => COLORS.map(c => '<button data-c="' + c + '" style="width:28px;height:28px;border-radius:50%;background:' + c + ';border:2px solid ' + (c === E.color ? GOLD : '#555') + ';cursor:pointer;padding:0"></button>').join('') +
      [0, 1, 2].map(i => '<button data-z="' + i + '" style="width:34px;height:28px;border-radius:8px;background:' + (E.sz === i ? GOLD : '#2a2a2a') + ';border:1px solid #444;cursor:pointer;padding:0;color:' + (E.sz === i ? '#111' : '#eee') + '">' + ['•', '●', '⬤'][i] + '</button>').join('');
    if (t === 'crop') {
      o.innerHTML = RATIOS.map((r, i) => '<button data-r="' + i + '" style="background:' + (E.ratio === r[1] ? GOLD : '#2a2a2a') + ';color:' + (E.ratio === r[1] ? '#111' : '#eee') + ';border:1px solid #444;border-radius:14px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit">' + r[0] + '</button>').join('') + chip('ed-apply', 'Обрезать', true);
      initCrop();
    } else if (t === 'rot') {
      o.innerHTML = chip('ed-l', '↺ 90°') + chip('ed-r', '↻ 90°') + chip('ed-fh', '⇋ Зеркало') +
        '<span style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center">Выровнять <input id="ed-ang" type="range" min="-15" max="15" step="0.5" value="0" style="width:150px"><b id="ed-angv" style="width:34px">0°</b>' + chip('ed-ap', 'Применить', true) + '</span>';
      selHide();
    } else if (t === 'adj') {
      const sl = (id, lab) => '<span style="display:flex;align-items:center;gap:6px">' + lab + ' <input id="' + id + '" type="range" min="-100" max="100" value="0" style="width:96px"></span>';
      o.innerHTML = sl('ed-b', 'Яркость') + sl('ed-c', 'Контраст') + sl('ed-s', 'Цвет') + chip('ed-auto', 'Авто') + chip('ed-bw', 'Ч/Б документ') + chip('ed-ap', 'Применить', true);
      selHide();
    } else if (t === 'text') {
      o.innerHTML = sw() + '<span style="font-size:12px;color:#aaa">Нажми на фото, куда поставить текст</span>'; selHide();
    } else if (t === 'mosaic') {
      o.innerHTML = '<span style="font-size:12px;color:#aaa">Обведи область: номер, лицо, адрес. Она станет мозаикой</span>'; selHide();
    } else {
      o.innerHTML = sw(); selHide();
    }
    wireOpts(o);
  }
  function wireOpts(o) {
    o.onclick = e => {
      const c = e.target.closest('[data-c]'); if (c) { E.color = c.dataset.c; setTool(E.tool); return; }
      const z = e.target.closest('[data-z]'); if (z) { E.sz = +z.dataset.z; setTool(E.tool); return; }
      const r = e.target.closest('[data-r]'); if (r) { E.ratio = RATIOS[+r.dataset.r][1]; initCrop(true); setTool('crop'); return; }
      const id = (e.target.closest('button') || {}).id;
      if (id === 'ed-apply') applyCrop();
      else if (id === 'ed-l') rot90(-1); else if (id === 'ed-r') rot90(1); else if (id === 'ed-fh') flip();
      else if (id === 'ed-ap') { if (E.tool === 'rot') applyAngle(); else applyAdj(); }
      else if (id === 'ed-auto') { snap(); autoLevels(); }
      else if (id === 'ed-bw') { snap(); bw(); }
    };
    const a = o.querySelector('#ed-ang');
    if (a) a.oninput = () => { E.ang = +a.value; o.querySelector('#ed-angv').textContent = a.value + '°'; E.cv.style.transform = 'rotate(' + a.value + 'deg)'; };
    ['b', 'c', 's'].forEach(k => { const s = o.querySelector('#ed-' + k); if (s) s.oninput = () => { E.adj[k] = +s.value; E.cv.style.filter = adjCss(); }; });
  }
  const adjCss = () => 'brightness(' + (1 + E.adj.b / 100) + ') contrast(' + (1 + E.adj.c / 100) + ') saturate(' + (1 + E.adj.s / 100) + ')';

  // ── поворот, зеркало, выравнивание ──
  function redraw(w, h, fn) {
    const t = document.createElement('canvas'); t.width = w; t.height = h; fn(t.getContext('2d'));
    E.cv.width = w; E.cv.height = h; E.ctx.drawImage(t, 0, 0); fit();
  }
  function rot90(d) {
    snap(); const src = document.createElement('canvas'); src.width = E.cv.width; src.height = E.cv.height; src.getContext('2d').drawImage(E.cv, 0, 0);
    redraw(src.height, src.width, c => { c.translate(src.height / 2, src.width / 2); c.rotate(d * Math.PI / 2); c.drawImage(src, -src.width / 2, -src.height / 2); });
  }
  function flip() {
    snap(); const src = document.createElement('canvas'); src.width = E.cv.width; src.height = E.cv.height; src.getContext('2d').drawImage(E.cv, 0, 0);
    redraw(src.width, src.height, c => { c.translate(src.width, 0); c.scale(-1, 1); c.drawImage(src, 0, 0); });
  }
  function applyAngle() {
    if (!E.ang) return;
    snap(); const a = E.ang * Math.PI / 180, W = E.cv.width, H = E.cv.height;
    const src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(E.cv, 0, 0);
    const s = Math.cos(Math.abs(a)) + Math.max(W / H, H / W) * Math.sin(Math.abs(a)); // немного увеличиваем, чтобы по краям не было пустых углов
    redraw(W, H, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.translate(W / 2, H / 2); c.rotate(a); c.scale(s, s); c.drawImage(src, -W / 2, -H / 2); });
    setTool('rot');
  }

  // ── обрезка ──
  function selEl() { return E.ov.querySelector('#ed-sel'); }
  function selHide() { selEl().style.display = 'none'; E.crop = null; }
  function initCrop(keep) {
    const W = E.cv.width, H = E.cv.height;
    let w = W * 0.9, h = H * 0.9;
    if (E.ratio) { if (w / h > E.ratio) w = h * E.ratio; else h = w / E.ratio; }
    if (!keep || !E.crop || E.ratio) E.crop = { x: (W - w) / 2, y: (H - h) / 2, w, h };
    drawSel();
  }
  function drawSel() {
    if (!E || E.tool !== 'crop' || !E.crop) return;
    const el = selEl(), r = E.cv.getBoundingClientRect(), k = r.width / E.cv.width, c = E.crop;
    el.style.display = 'block';
    el.style.left = c.x * k + 'px'; el.style.top = c.y * k + 'px'; el.style.width = c.w * k + 'px'; el.style.height = c.h * k + 'px';
  }
  function applyCrop() {
    const c = E.crop; if (!c || c.w < 8 || c.h < 8) return;
    snap(); const src = document.createElement('canvas'); src.width = E.cv.width; src.height = E.cv.height; src.getContext('2d').drawImage(E.cv, 0, 0);
    const x = Math.round(c.x), y = Math.round(c.y), w = Math.round(c.w), h = Math.round(c.h);
    redraw(w, h, ctx => ctx.drawImage(src, x, y, w, h, 0, 0, w, h));
    E.crop = null; setTool('crop');
  }
  function cropDrag(e, el) {
    const h = (e.target.dataset || {}).h, p0 = pt(e), c0 = { ...E.crop }, W = E.cv.width, H = E.cv.height;
    const mv = ev => {
      const p = pt(ev), dx = p.x - p0.x, dy = p.y - p0.y; let c = { ...c0 };
      if (!h) { c.x = clamp(c0.x + dx, 0, W - c0.w); c.y = clamp(c0.y + dy, 0, H - c0.h); }
      else {
        let x1 = c0.x, y1 = c0.y, x2 = c0.x + c0.w, y2 = c0.y + c0.h;
        if (h[1] === 'w') x1 = clamp(p.x, 0, x2 - 20); else x2 = clamp(p.x, x1 + 20, W);
        if (h[0] === 'n') y1 = clamp(p.y, 0, y2 - 20); else y2 = clamp(p.y, y1 + 20, H);
        let w = x2 - x1, hh = y2 - y1;
        if (E.ratio) { if (w / hh > E.ratio) w = hh * E.ratio; else hh = w / E.ratio; if (h[1] === 'w') x1 = x2 - w; else x2 = x1 + w; if (h[0] === 'n') y1 = y2 - hh; else y2 = y1 + hh; }
        c = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      E.crop = c; drawSel();
    };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }

  // ── рисование ──
  const lw = () => Math.max(2, Math.round(E.cv.width * [0.004, 0.008, 0.016][E.sz]));
  function styleFor(c) {
    c.strokeStyle = E.color; c.fillStyle = E.color; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = E.tool === 'mark' ? lw() * 3.2 : lw(); c.globalAlpha = E.tool === 'mark' ? 0.35 : 1;
  }
  function shape(c, a, b) {
    const t = E.tool;
    if (t === 'pen' || t === 'mark') { c.beginPath(); E.path.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (E.path.length === 1) c.lineTo(a.x + 0.1, a.y); c.stroke(); }
    else if (t === 'rect') c.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    else if (t === 'oval') { c.beginPath(); c.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2 || 1, Math.abs(b.y - a.y) / 2 || 1, 0, 0, Math.PI * 2); c.stroke(); }
    else if (t === 'arrow') {
      const ang = Math.atan2(b.y - a.y, b.x - a.x), L = lw() * 4.5;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45)); c.moveTo(b.x, b.y); c.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45)); c.stroke();
    } else if (t === 'mosaic') { c.globalAlpha = 1; c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); c.setLineDash([]); }
  }
  function pixelate(a, b) {
    const x = Math.round(Math.min(a.x, b.x)), y = Math.round(Math.min(a.y, b.y)), w = Math.round(Math.abs(b.x - a.x)), h = Math.round(Math.abs(b.y - a.y));
    if (w < 6 || h < 6) return;
    const bs = Math.max(8, Math.round(Math.max(E.cv.width, E.cv.height) / 70));
    const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(w / bs)); t.height = Math.max(1, Math.round(h / bs));
    const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.drawImage(E.cv, x, y, w, h, 0, 0, t.width, t.height);
    E.ctx.imageSmoothingEnabled = false; E.ctx.drawImage(t, 0, 0, t.width, t.height, x, y, w, h); E.ctx.imageSmoothingEnabled = true;
  }
  function attachPointer() {
    const cv = E.cv, wrap = E.ov.querySelector('#ed-wrap');
    wrap.addEventListener('pointerdown', e => {
      if (!E) return;
      if (E.tool === 'crop') { if (E.crop && (e.target.id === 'ed-sel' || e.target.dataset.h)) { e.preventDefault(); cropDrag(e); } return; }
      if (e.target !== cv) return;
      const p = pt(e);
      if (E.tool === 'text') { e.preventDefault(); askText(p); return; }
      if (!['pen', 'mark', 'arrow', 'rect', 'oval', 'mosaic'].includes(E.tool)) return;
      e.preventDefault();
      snap(); E.tmp = E.stack[E.stack.length - 1]; E.start = p; E.path = [p];
      const mv = ev => {
        const q = pt(ev); E.path.push(q);
        E.ctx.drawImage(E.tmp, 0, 0); E.ctx.save(); styleFor(E.ctx); shape(E.ctx, p, q); E.ctx.restore();
      };
      const up = ev => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!E) return; const q = pt(ev);
        E.ctx.drawImage(E.tmp, 0, 0);
        if (E.tool === 'mosaic') pixelate(p, q);
        else { E.ctx.save(); styleFor(E.ctx); shape(E.ctx, p, q); E.ctx.restore(); }
        E.tmp = null; E.path = null;
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
  }
  function askText(p) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:5;background:#1c1c1c;padding:12px;display:flex;gap:8px;border-bottom:1px solid #444';
    d.innerHTML = '<input id="ed-txt" placeholder="Текст" style="flex:1;font-size:16px;padding:9px;border-radius:8px;border:1px solid #555;background:#111;color:#eee;font-family:inherit"><button id="ed-tok" style="background:' + GOLD + ';border:none;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer">OK</button><button id="ed-tno" style="background:#2a2a2a;border:1px solid #444;color:#eee;border-radius:10px;padding:0 14px;cursor:pointer">✕</button>';
    E.ov.appendChild(d);
    const inp = d.querySelector('#ed-txt'); inp.focus();
    const ok = () => {
      const v = inp.value.trim(); d.remove(); if (!v || !E) return;
      snap(); const c = E.ctx, fs = Math.round(E.cv.width * [0.03, 0.05, 0.08][E.sz]);
      c.save(); c.font = '700 ' + fs + 'px system-ui,Arial,sans-serif'; c.textBaseline = 'middle';
      c.lineWidth = Math.max(3, fs / 6); c.strokeStyle = E.color === '#111111' ? '#fff' : (E.color === '#ffffff' ? '#000' : '#fff'); c.lineJoin = 'round';
      c.strokeText(v, p.x, p.y); c.fillStyle = E.color; c.fillText(v, p.x, p.y); c.restore();
    };
    d.querySelector('#ed-tok').onclick = ok; d.querySelector('#ed-tno').onclick = () => d.remove();
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  }

  // ── цвет ──
  function pixels(fn) {
    const id = E.ctx.getImageData(0, 0, E.cv.width, E.cv.height), d = id.data;
    fn(d); E.ctx.putImageData(id, 0, 0);
  }
  function applyAdj() {
    const a = E.adj; if (!a.b && !a.c && !a.s) return;
    snap(); const B = 1 + a.b / 100, C = 1 + a.c / 100, S = 1 + a.s / 100;
    pixels(d => {
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * B, g = d[i + 1] * B, b = d[i + 2] * B;
        r = (r - 128) * C + 128; g = (g - 128) * C + 128; b = (b - 128) * C + 128;
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[i] = clamp(y + (r - y) * S, 0, 255); d[i + 1] = clamp(y + (g - y) * S, 0, 255); d[i + 2] = clamp(y + (b - y) * S, 0, 255);
      }
    });
    setTool('adj');
  }
  function autoLevels() {
    pixels(d => {
      const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { h[0][d[i]]++; h[1][d[i + 1]]++; h[2][d[i + 2]]++; }
      const lim = n * 0.01, lo = [0, 0, 0], hi = [255, 255, 255];
      for (let c = 0; c < 3; c++) {
        let s = 0; for (let v = 0; v < 256; v++) { s += h[c][v]; if (s > lim) { lo[c] = v; break; } }
        s = 0; for (let v = 255; v >= 0; v--) { s += h[c][v]; if (s > lim) { hi[c] = v; break; } }
        if (hi[c] - lo[c] < 40) { lo[c] = 0; hi[c] = 255; }
      }
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = clamp((d[i + c] - lo[c]) * 255 / (hi[c] - lo[c]), 0, 255);
    });
    setTool('adj');
  }
  function bw() {
    pixels(d => {
      let lo = 255, hi = 0; const hist = new Uint32Array(256);
      for (let i = 0; i < d.length; i += 4) { const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0; hist[y]++; }
      const n = d.length / 4, lim = n * 0.02; let s = 0;
      for (let v = 0; v < 256; v++) { s += hist[v]; if (s > lim) { lo = v; break; } } s = 0;
      for (let v = 255; v >= 0; v--) { s += hist[v]; if (s > lim) { hi = v; break; } }
      if (hi - lo < 30) { lo = 0; hi = 255; }
      for (let i = 0; i < d.length; i += 4) { const y = clamp(((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) - lo) * 255 / (hi - lo), 0, 255); d[i] = d[i + 1] = d[i + 2] = y; }
    });
    setTool('adj');
  }

  // ── сохранение ──
  const toBlob = () => new Promise(r => E.cv.toBlob(r, 'image/jpeg', 0.9));
  async function finish() {
    if (!E.stack.length && !E.changed) { closeEd(true); tst('Правок нет'); return; }
    if (E.tool === 'crop' && E.crop && E.stack.length === 0) { /* рамка без применения не считается правкой */ }
    const blob = await toBlob();
    if (!blob) { tst('Не удалось сохранить результат', true); return; }
    const choice = await askMode();
    if (!choice) return;
    const base = (E.name || decodeURIComponent((E.url.split('?')[0].split('/').pop() || 'photo')).replace(/^[A-Za-z0-9]{6,}_/, '')).replace(/\.[^.]+$/, '') || 'photo';
    const file = new File([blob], base + '_edit.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    const src = E.blob, url = E.url, opt = E.opt;
    closeEd(true);
    try {
      if (choice === 'replace') await saveReplace(url, file, src);
      else if (choice === 'beside') await saveBeside(url, file);
      else if (choice === 'chat') await saveToChat(file);
      if (opt.onSaved) try { opt.onSaved(choice); } catch (e) {}
    } catch (e) { tst('Не удалось сохранить: ' + String((e && e.message) || e).slice(0, 100), true); }
  }
  function askMode() {
    return new Promise(res => {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;z-index:6;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px';
      const b = 'width:100%;text-align:left;border-radius:12px;padding:12px;font-size:14px;line-height:1.35;cursor:pointer;font-family:inherit;border:1px solid #555;background:#2a2a2a;color:#eee;margin-top:8px';
      d.innerHTML = '<div style="background:#1c1c1c;border-radius:16px;padding:16px;max-width:380px;width:100%"><div style="font-size:16px;font-weight:700">Как сохранить правку?</div>' +
        '<button data-m="replace" style="' + b + '"><b>⟲ Заменить</b><br><span style="font-size:12px;opacity:.75">В записи останется исправленное фото. Оригинал сохраню на этом устройстве.</span></button>' +
        '<button data-m="beside" style="' + b + '"><b>⧉ Добавить рядом</b><br><span style="font-size:12px;opacity:.75">Исправленное станет новым вложением, прежнее останется.</span></button>' +
        '<button data-m="chat" style="' + b + '"><b>➤ Отправить в чат</b><br><span style="font-size:12px;opacity:.75">Выберешь чат. В записи ничего не меняется.</span></button>' +
        '<button data-m="" style="' + b + ';text-align:center">Назад к редактору</button></div>';
      E.ov.appendChild(d);
      d.onclick = e => { const m = e.target.closest('[data-m]'); if (!m) return; d.remove(); res(m.dataset.m || null); };
    });
  }

  // найти вложение с таким адресом (карточка, запись или файл сеанса)
  async function findAtt(url) {
    const pools = [typeof cards !== 'undefined' ? cards : []];
    try { if (typeof local !== 'undefined') pools.push(await local.getAll('cards')); } catch (e) {}
    for (const pool of pools) for (const c of pool || []) {
      const lists = [c.attachments, ...(c.entries || []).flatMap(e => [e.attachments, e.sessionAtts])];
      for (const l of lists) { if (!Array.isArray(l)) continue; const i = l.findIndex(a => a && a.data === url); if (i >= 0) return { card: c, list: l, i }; }
    }
    return null;
  }
  async function persist(card) {
    try { if (typeof render === 'function') render(); if (typeof openView === 'function' && window._openViewId === card.id) openView(card.id); } catch (e) {}
    try { await dbUpdate(card); } catch (e) { tst('Ошибка синхронизации', true); }
  }
  async function upload(file, card) {
    if (window.mcUpExpect) try { mcUpExpect(1); } catch (e) {}
    tst('⏳ Загружаю исправленное фото…');
    return await uploadToStorage(file, card && card.id);
  }
  async function saveReplace(url, file, srcBlob) {
    const f = await findAtt(url);
    if (!f) { tst('Не нашла это фото в записи, заменить нечего', true); return; }
    // оригинал: если уже есть 💎 у старого адреса — он и остаётся оригиналом, иначе сохраняем то, что редактировали
    let vid = null;
    try {
      const o = await mcVaultGet(url);
      if (o) vid = o.meta.id; else vid = await mcVaultPut(new File([srcBlob], file.name.replace('_edit', '_original'), { type: srcBlob.type }), 'photo');
    } catch (e) { tst('Оригинал на устройстве сохранить не удалось (нет места?)', true); }
    const att = await upload(file, f.card);
    const old = f.list[f.i], prev = old.data;
    f.list[f.i] = { ...old, data: att.data, size: att.size || file.size, type: att.type || 'image/jpeg', ts: att.ts || Date.now(), edited: true, prevUrl: old.prevUrl || prev };
    if (att.offline) f.list[f.i].offline = att.offline;
    if (vid) { try { await mcVaultSetOrigOf(vid, att.data); } catch (e) {} }
    await persist(f.card);
    tst('✓ Фото заменено. Оригинал можно вернуть');
  }
  async function saveBeside(url, file) {
    const f = await findAtt(url);
    if (!f) { tst('Не нашла это фото в записи', true); return; }
    const att = await upload(file, f.card);
    f.list.splice(f.i + 1, 0, { ...att, edited: true });
    await persist(f.card);
    tst('✓ Исправленное фото добавлено рядом');
  }
  async function saveToChat(file) {
    const famLike = t => t === 'family' || t === 'group';
    const sps = (typeof spaces !== 'undefined' ? spaces : []).filter(s => famLike(s.type) && s.status !== 'closed');
    if (!sps.length) { tst('Нет кабинетов с чатами', true); return; }
    const pick = await chatPicker(sps);
    if (!pick) return;
    const att = await upload(file, null);
    const me = localStorage.getItem('mc_current_member') || (typeof currentUser !== 'undefined' && currentUser && currentUser.display_name) || '';
    const bubble = { id: uid(), text: '', date: nowStr(), done: false, attachments: [], deadline: null, assigned_to: null, completions: null, sessionId: uid(), sessionCreator: me, sessionNote: null, sessionAtts: [att] };
    const { data, error } = await sb.from('cards').select('*').eq('id', pick.chat.id).single();
    if (error || !data) throw new Error('Чат не найден');
    const { error: ue } = await sb.from('cards').update({ entries: [bubble, ...(data.entries || [])] }).eq('id', data.id);
    if (ue) throw ue;
    tst('✓ Отправлено в чат «' + (data.title || '') + '»');
    try {
      if (typeof notifyUsers === 'function') {
        const part = Array.isArray(data.chatParticipants) ? data.chatParticipants.map(x => String(x).toLowerCase().trim()) : null;
        const ids = [...new Set((pick.space.members || []).filter(m => m.user_id && m.user_id !== currentUser?.id && (!part || part.includes(String(m.name).toLowerCase().trim()))).map(m => m.user_id))];
        if (ids.length) await notifyUsers(ids, '💬 ' + data.title, ('{{name}}: фото').slice(0, 90), currentUser?.id, me, 'https://vales-chayv.github.io/check-list/?openSpace=' + pick.space.id + '&openCard=' + data.id);
      }
    } catch (e) {}
  }
  function chatPicker(sps) {
    return new Promise(res => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:3100;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px';
      const b = 'width:100%;text-align:left;border-radius:10px;padding:11px 12px;font-size:14px;cursor:pointer;font-family:inherit;border:1px solid #555;background:#2a2a2a;color:#eee;margin-top:6px';
      const box = document.createElement('div'); box.style.cssText = 'background:#1c1c1c;color:#eee;border-radius:16px;padding:16px;max-width:380px;width:100%;max-height:85vh;overflow:auto';
      d.appendChild(box); document.body.appendChild(d);
      const done = v => { d.remove(); res(v); };
      const showSpaces = () => {
        box.innerHTML = '<div style="font-size:16px;font-weight:700">Куда отправить?</div>' + sps.map((s, i) => '<button data-s="' + i + '" style="' + b + '">' + String(s.name || 'Кабинет').replace(/[<>&]/g, '') + '</button>').join('') + '<button data-x style="' + b + ';text-align:center">Отмена</button>';
      };
      const showChats = async sp => {
        box.innerHTML = '<div style="font-size:14px;opacity:.7">Загружаю чаты…</div>';
        let list = [];
        try { const { data } = await sb.from('cards').select('id,title,chatParticipants,chatStatus,status').eq('space_id', sp.id); list = (data || []).filter(c => Array.isArray(c.chatParticipants) && c.chatStatus !== 'closed' && c.status !== 'done'); }
        catch (e) { box.innerHTML = '<div style="color:#e57373">Не удалось загрузить чаты</div><button data-b style="' + b + ';text-align:center">Назад</button>'; return; }
        box.dataset.sp = sps.indexOf(sp);
        box.innerHTML = '<div style="font-size:16px;font-weight:700">Чат в «' + String(sp.name || '').replace(/[<>&]/g, '') + '»</div>' + (list.length ? list.map((c, i) => '<button data-c="' + i + '" style="' + b + '">' + String(c.title || 'Чат').replace(/[<>&]/g, '') + '</button>').join('') : '<div style="font-size:13px;opacity:.7;margin-top:8px">В этом кабинете пока нет открытых чатов.</div>') + '<button data-b style="' + b + ';text-align:center">Назад</button>';
        box._list = list; box._sp = sp;
      };
      box.onclick = e => {
        const s = e.target.closest('[data-s]'), c = e.target.closest('[data-c]');
        if (s) showChats(sps[+s.dataset.s]);
        else if (c && box._list) done({ space: box._sp, chat: box._list[+c.dataset.c] });
        else if (e.target.closest('[data-b]')) showSpaces();
        else if (e.target.closest('[data-x]')) done(null);
      };
      showSpaces();
    });
  }

  // ── вернуть оригинал ──
  window.mcPhotoRestore = async function (url) {
    const f = await findAtt(url);
    if (!f || !f.list[f.i].edited) { tst('Это фото не редактировалось', true); return; }
    const a = f.list[f.i];
    let file = null, vid = null;
    try { const db = await mcVaultDb(); const m = await _mcIdb(db.transaction('meta').objectStore('meta').getAll()); const mm = m.find(x => x.origOf === url); if (mm) { vid = mm.id; file = await _mcVaultFile(db, mm.id, mm); } } catch (e) {}
    if (file) {
      const att = await upload(file, f.card);
      f.list[f.i] = { ...a, data: att.data, size: att.size || file.size, type: att.type || file.type, ts: att.ts || Date.now() };
      delete f.list[f.i].edited; delete f.list[f.i].prevUrl;
      try { await mcVaultSetOrigOf(vid, null, att.data); } catch (e) {}
    } else if (a.prevUrl) { // на этом устройстве оригинала нет: берём прежний файл из облака, если он ещё там
      const alive = await mcCloudCheck([a.prevUrl]);
      if (alive.dead.length || alive.unknown.length) { tst('Оригинал уже удалён из облака, а на этом устройстве его нет', true); return; }
      f.list[f.i] = { ...a, data: a.prevUrl };
      delete f.list[f.i].edited; delete f.list[f.i].prevUrl;
    } else { tst('Оригинал не найден', true); return; }
    await persist(f.card);
    tst('✓ Оригинал возвращён');
  };
  window.mcPhotoIsEdited = async function (url) { const f = await findAtt(url); return !!(f && f.list[f.i].edited); };
})();
