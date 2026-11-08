// ═══════════════════════════════════════════
//  РЕДАКТОР ФОТО
//  Обрезка, поворот и выравнивание, рисунок, маркер, стрелка, рамка, овал, текст, мозаика (скрыть данные),
//  «Рука» (двигать, менять и удалять поставленные элементы), яркость/контраст/цвет, автоулучшение, Ч/Б документ.
//  Сохранение: заменить в записи (оригинал остаётся на устройстве), добавить рядом, отправить в чат.
//  Вызов: mcPhotoEdit(url, opt). opt.custom(file, srcBlob) — своё сохранение (камера, вложения новой карточки), opt.onClose — закрыли без сохранения.
//  Работает вместе с app-media.js (хранилище оригиналов 💎) и app-view.js.
// ═══════════════════════════════════════════
(function () {
  'use strict';
  const MAXPX = 2048;
  const COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ffffff', '#111111'];
  const RATIOS = [['Свободно', 0], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['A4', 1 / 1.414]];
  const TOOLS = [
    ['crop', '✂', 'Обрезка'], ['rot', '⟳', 'Поворот'], ['hand', '✋', 'Рука'], ['pen', '✎', 'Рисунок'], ['mark', '▬', 'Маркер'], ['arrow', '➜', 'Стрелка'],
    ['rect', '▭', 'Рамка'], ['oval', '◯', 'Овал'], ['text', 'T', 'Текст'], ['mosaic', '▦', 'Скрыть'], ['adj', '☼', 'Свет']
  ];
  const GOLD = '#B8892B', Z = 100010;
  let E = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tst = (m, bad) => { try { toast(m, !!bad); } catch (e) {} };
  const newCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const q = s => E.ov.querySelector(s);

  // ── загрузка ──
  async function loadBitmap(blob) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { return await createImageBitmap(blob); }
  }
  async function fetchSrc(url) {
    const r = await fetch(url, /^(data|blob):/.test(url) ? undefined : { mode: 'cors' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.blob();
  }
  window.mcPhotoEdit = async function (url, opt) {
    if (E) return;
    opt = opt || {};
    let blob;
    try { blob = await fetchSrc(url); } catch (e) { tst('Не удалось открыть фото для редактирования', true); if (opt.onClose) opt.onClose(); return; }
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(blob.type || '')) { tst('Редактор работает с фото JPG, PNG и WebP', true); if (opt.onClose) opt.onClose(); return; }
    let bmp;
    try { bmp = await loadBitmap(blob); } catch (e) { tst('Не удалось прочитать фото', true); if (opt.onClose) opt.onClose(); return; }
    const k = Math.min(1, MAXPX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const base = newCv(w, h), c = base.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(bmp, 0, 0, w, h);
    try { bmp.close(); } catch (e) {}
    const cv = newCv(w, h);
    E = { url, blob, name: opt.name || '', cv, ctx: cv.getContext('2d'), first: base, base, objs: [], sel: null, stack: [], tool: 'crop', color: COLORS[0], sz: 1, ratio: 0, crop: null, cropTouched: false, adj: { b: 0, c: 0, s: 0 }, ang: 0, opt, saved: false };
    build();
  };

  // ── окно ──
  function build() {
    const ov = document.createElement('div');
    ov.id = 'mc-ed-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';background:#111;color:#eee;display:flex;flex-direction:column;font-family:inherit;touch-action:none;user-select:none;-webkit-user-select:none';
    const bt = 'background:#2a2a2a;border:1px solid #444;color:#eee;border-radius:10px;padding:8px 12px;font-size:14px;cursor:pointer;font-family:inherit';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;flex-shrink:0">' +
        '<button id="ed-x" style="' + bt + '">✕</button>' +
        '<button id="ed-undo" style="' + bt + ';opacity:.4">↶ Отменить</button>' +
        '<button id="ed-reset" style="' + bt + ';font-size:12px">Как было</button>' +
        '<span style="flex:1"></span>' +
        '<button id="ed-done" style="' + bt + ';background:' + GOLD + ';border-color:' + GOLD + ';color:#111;font-weight:700">Готово</button>' +
      '</div>' +
      '<div id="ed-stage" style="flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden"><div id="ed-wrap" style="position:relative;line-height:0"></div></div>' +
      '<div id="ed-opts" style="flex-shrink:0;padding:8px 10px;min-height:46px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;font-size:13px"></div>' +
      '<div id="ed-tools" style="flex-shrink:0;display:flex;gap:6px;overflow-x:auto;padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px));scrollbar-width:none;border-top:1px solid #2a2a2a"></div>';
    document.body.appendChild(ov);
    E.ov = ov;
    const wrap = q('#ed-wrap');
    E.cv.style.cssText = 'display:block;touch-action:none;background:#fff';
    wrap.appendChild(E.cv);
    const sel = document.createElement('div');
    sel.id = 'ed-sel';
    sel.style.cssText = 'position:absolute;display:none;border:2px solid ' + GOLD + ';box-shadow:0 0 0 9999px rgba(0,0,0,.55);box-sizing:border-box';
    sel.innerHTML = ['nw', 'ne', 'sw', 'se'].map(c => '<i data-h="' + c + '" style="position:absolute;width:26px;height:26px;background:' + GOLD + ';border-radius:50%;' + (c[0] === 'n' ? 'top:-13px;' : 'bottom:-13px;') + (c[1] === 'w' ? 'left:-13px;' : 'right:-13px;') + '"></i>').join('');
    wrap.appendChild(sel);
    const os = document.createElement('div');
    os.id = 'ed-osel';
    os.style.cssText = 'position:absolute;display:none;border:2px dashed ' + GOLD + ';box-sizing:border-box;pointer-events:none';
    os.innerHTML = '<i data-oh="a" style="position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;background:' + GOLD + ';border-radius:50%;pointer-events:auto"></i><i data-oh="b" style="position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;background:' + GOLD + ';border-radius:50%;pointer-events:auto"></i>';
    wrap.appendChild(os);
    q('#ed-tools').innerHTML = TOOLS.map(t => '<button data-t="' + t[0] + '" style="flex:0 0 auto;min-width:62px;background:#222;border:1px solid #3a3a3a;color:#eee;border-radius:12px;padding:6px 4px;font-family:inherit;cursor:pointer"><div style="font-size:19px;line-height:22px">' + t[1] + '</div><div style="font-size:11px">' + t[2] + '</div></button>').join('');
    q('#ed-tools').onclick = e => { const b = e.target.closest('[data-t]'); if (b) setTool(b.dataset.t); };
    q('#ed-x').onclick = () => closeEd(false);
    q('#ed-undo').onclick = undo;
    q('#ed-reset').onclick = reset;
    q('#ed-done').onclick = finish;
    window.addEventListener('resize', fit);
    attachPointer();
    fit(); paint(); setTool('crop');
  }
  window.mcEdBack = function () { if (!E) return false; closeEd(false); return true; };
  function closeEd(force) {
    if (!E) return;
    if (!force && (E.stack.length || E.cropTouched) && !confirm('Закрыть редактор? Правки не сохранятся.')) return;
    window.removeEventListener('resize', fit);
    const cb = !E.saved && E.opt.onClose;
    E.ov.remove(); E = null;
    if (cb) try { cb(); } catch (e) {}
  }
  function fit() {
    if (!E) return;
    const st = q('#ed-stage'), w = st.clientWidth - 16, h = st.clientHeight - 16, k = Math.min(w / E.cv.width, h / E.cv.height);
    E.cv.style.width = Math.max(40, Math.floor(E.cv.width * k)) + 'px';
    E.cv.style.height = Math.max(40, Math.floor(E.cv.height * k)) + 'px';
    selUI(); drawSel();
  }
  const pt = e => { const r = E.cv.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * E.cv.width / r.width, 0, E.cv.width), y: clamp((e.clientY - r.top) * E.cv.height / r.height, 0, E.cv.height) }; };

  // ── рисование объектов и вывод ──
  function pixelate(c, a, b) {
    const W = c.canvas.width, H = c.canvas.height;
    const x = Math.round(clamp(Math.min(a.x, b.x), 0, W)), y = Math.round(clamp(Math.min(a.y, b.y), 0, H));
    const w = Math.round(clamp(Math.max(a.x, b.x), 0, W)) - x, h = Math.round(clamp(Math.max(a.y, b.y), 0, H)) - y;
    if (w < 4 || h < 4) return;
    const bs = Math.max(8, Math.round(Math.max(W, H) / 70)), t = newCv(Math.max(1, Math.round(w / bs)), Math.max(1, Math.round(h / bs)));
    const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.drawImage(c.canvas, x, y, w, h, 0, 0, t.width, t.height);
    c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, t.width, t.height, x, y, w, h); c.imageSmoothingEnabled = true;
  }
  const FONT = fs => '700 ' + fs + 'px system-ui,Arial,sans-serif';
  function drawObj(c, o) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = o.c; c.fillStyle = o.c; c.lineWidth = o.w || 1; c.globalAlpha = o.t === 'mark' ? 0.35 : 1;
    if (o.t === 'pen' || o.t === 'mark') {
      c.beginPath(); o.pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (o.pts.length === 1) c.lineTo(o.pts[0].x + 0.1, o.pts[0].y); c.stroke();
    } else if (o.t === 'rect') c.strokeRect(Math.min(o.a.x, o.b.x), Math.min(o.a.y, o.b.y), Math.abs(o.b.x - o.a.x), Math.abs(o.b.y - o.a.y));
    else if (o.t === 'oval') { c.beginPath(); c.ellipse((o.a.x + o.b.x) / 2, (o.a.y + o.b.y) / 2, Math.abs(o.b.x - o.a.x) / 2 || 1, Math.abs(o.b.y - o.a.y) / 2 || 1, 0, 0, Math.PI * 2); c.stroke(); }
    else if (o.t === 'arrow') {
      const ang = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x), L = o.w * 4.5;
      c.beginPath(); c.moveTo(o.a.x, o.a.y); c.lineTo(o.b.x, o.b.y); c.stroke();
      c.beginPath(); c.moveTo(o.b.x, o.b.y); c.lineTo(o.b.x - L * Math.cos(ang - 0.45), o.b.y - L * Math.sin(ang - 0.45)); c.moveTo(o.b.x, o.b.y); c.lineTo(o.b.x - L * Math.cos(ang + 0.45), o.b.y - L * Math.sin(ang + 0.45)); c.stroke();
    } else if (o.t === 'text') {
      c.font = FONT(o.fs); c.textBaseline = 'middle'; c.lineWidth = Math.max(3, o.fs / 6); c.strokeStyle = o.c === '#ffffff' ? '#000' : '#fff';
      c.strokeText(o.s, o.p.x, o.p.y); c.fillText(o.s, o.p.x, o.p.y);
    } else if (o.t === 'mosaic') { c.restore(); pixelate(c, o.a, o.b); return; }
    c.restore();
  }
  function paint() {
    if (E.cv.width !== E.base.width || E.cv.height !== E.base.height) { E.cv.width = E.base.width; E.cv.height = E.base.height; fit(); }
    const c = E.ctx; c.clearRect(0, 0, E.cv.width, E.cv.height); c.drawImage(E.base, 0, 0);
    E.objs.forEach(o => drawObj(c, o));
    selUI();
  }
  function flatten() { // вдавливаем нарисованное в фото (нужно перед обрезкой, поворотом, цветом)
    if (!E.objs.length) return;
    const n = newCv(E.base.width, E.base.height), c = n.getContext('2d'); c.drawImage(E.base, 0, 0);
    E.objs.forEach(o => drawObj(c, o)); E.base = n; E.objs = []; E.sel = null;
  }
  // ── отмена ──
  function snap() {
    E.stack.push({ base: E.base, objs: clone(E.objs) });
    const max = Math.max(2, Math.floor(25e6 / (E.base.width * E.base.height))), seen = new Set([E.base]);
    for (let i = E.stack.length - 1; i >= 0; i--) { const b = E.stack[i].base; if (!seen.has(b)) { if (seen.size >= max) { E.stack.splice(0, i + 1); break; } seen.add(b); } }
    if (E.stack.length > 40) E.stack.splice(0, E.stack.length - 40);
    upd();
  }
  function upd() { q('#ed-undo').style.opacity = E.stack.length ? '1' : '.4'; }
  function undo() { const s = E.stack.pop(); if (!s) return; E.base = s.base; E.objs = s.objs; E.sel = null; E.crop = null; paint(); upd(); setTool(E.tool); }
  function reset() { if (!E.stack.length && !E.objs.length) return; snap(); E.base = E.first; E.objs = []; E.sel = null; paint(); setTool(E.tool); }

  // ── панель инструмента ──
  function setTool(t) {
    E.tool = t; E.cv.style.filter = ''; E.cv.style.transform = ''; E.ang = 0; E.adj = { b: 0, c: 0, s: 0 };
    if (t !== 'hand') E.sel = null;
    q('#ed-tools').querySelectorAll('[data-t]').forEach(b => { const on = b.dataset.t === t; b.style.background = on ? GOLD : '#222'; b.style.color = on ? '#111' : '#eee'; });
    if (t === 'crop') initCrop(); else selHide();
    opts(); paint();
  }
  function opts() {
    const o = q('#ed-opts'), t = E.tool, chip = (id, txt, on) => '<button id="' + id + '" style="background:' + (on ? GOLD : '#2a2a2a') + ';color:' + (on ? '#111' : '#eee') + ';border:1px solid #444;border-radius:14px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit">' + txt + '</button>';
    const sw = () => COLORS.map(c => '<button data-c="' + c + '" style="width:28px;height:28px;border-radius:50%;background:' + c + ';border:2px solid ' + (c === E.color ? GOLD : '#555') + ';cursor:pointer;padding:0"></button>').join('') +
      [0, 1, 2].map(i => '<button data-z="' + i + '" style="width:34px;height:28px;border-radius:8px;background:' + (E.sz === i ? GOLD : '#2a2a2a') + ';border:1px solid #444;cursor:pointer;padding:0;color:' + (E.sz === i ? '#111' : '#eee') + '">' + ['•', '●', '⬤'][i] + '</button>').join('');
    if (t === 'crop') o.innerHTML = RATIOS.map((r, i) => '<button data-r="' + i + '" style="background:' + (E.ratio === r[1] ? GOLD : '#2a2a2a') + ';color:' + (E.ratio === r[1] ? '#111' : '#eee') + ';border:1px solid #444;border-radius:14px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit">' + r[0] + '</button>').join('') + chip('ed-apply', 'Обрезать', true);
    else if (t === 'rot') o.innerHTML = chip('ed-l', '↺ 90°') + chip('ed-r', '↻ 90°') + chip('ed-fh', '⇋ Зеркало') + '<span style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center">Выровнять <input id="ed-ang" type="range" min="-15" max="15" step="0.5" value="0" style="width:150px"><b id="ed-angv" style="width:34px">0°</b>' + chip('ed-ap', 'Применить', true) + '</span>';
    else if (t === 'adj') { const sl = (id, lab) => '<span style="display:flex;align-items:center;gap:6px">' + lab + ' <input id="' + id + '" type="range" min="-100" max="100" value="0" style="width:96px"></span>'; o.innerHTML = sl('ed-b', 'Яркость') + sl('ed-c', 'Контраст') + sl('ed-s', 'Цвет') + chip('ed-auto', 'Авто') + chip('ed-bw', 'Ч/Б документ') + chip('ed-ap', 'Применить', true); }
    else if (t === 'text') o.innerHTML = sw() + '<span style="font-size:12px;color:#aaa">Нажми на фото, куда поставить текст</span>';
    else if (t === 'mosaic') o.innerHTML = '<span style="font-size:12px;color:#aaa">Обведи область: номер, лицо, адрес. Она станет мозаикой</span>';
    else if (t === 'hand') {
      const so = E.sel != null ? E.objs[E.sel] : null;
      o.innerHTML = so ? chip('ed-del', '🗑 Удалить') + (so.t === 'text' ? chip('ed-te', 'Aa Текст') : '') + (so.t === 'mosaic' ? '' : sw()) : '<span style="font-size:12px;color:#aaa">Нажми на элемент, чтобы двигать. Углы-кружки меняют размер</span>';
    } else o.innerHTML = sw();
    wireOpts(o);
  }
  function wireOpts(o) {
    const sel = () => (E.tool === 'hand' && E.sel != null) ? E.objs[E.sel] : null;
    o.onclick = e => {
      const c = e.target.closest('[data-c]');
      if (c) { E.color = c.dataset.c; const s = sel(); if (s) { snap(); s.c = E.color; paint(); } opts(); return; }
      const z = e.target.closest('[data-z]');
      if (z) { E.sz = +z.dataset.z; const s = sel(); if (s) { snap(); resize(s); paint(); } opts(); return; }
      const r = e.target.closest('[data-r]'); if (r) { E.ratio = RATIOS[+r.dataset.r][1]; initCrop(); opts(); return; }
      const id = (e.target.closest('button') || {}).id;
      if (id === 'ed-apply') applyCrop();
      else if (id === 'ed-l') rot90(-1); else if (id === 'ed-r') rot90(1); else if (id === 'ed-fh') flip();
      else if (id === 'ed-ap') { if (E.tool === 'rot') applyAngle(); else applyAdj(); }
      else if (id === 'ed-auto') autoLevels(); else if (id === 'ed-bw') bw();
      else if (id === 'ed-del') { snap(); E.objs.splice(E.sel, 1); E.sel = null; paint(); opts(); }
      else if (id === 'ed-te') askText(null, E.sel);
    };
    const a = o.querySelector('#ed-ang');
    if (a) a.oninput = () => { E.ang = +a.value; o.querySelector('#ed-angv').textContent = a.value + '°'; E.cv.style.transform = 'rotate(' + a.value + 'deg)'; };
    ['b', 'c', 's'].forEach(k => { const s = o.querySelector('#ed-' + k); if (s) s.oninput = () => { E.adj[k] = +s.value; E.cv.style.filter = 'brightness(' + (1 + E.adj.b / 100) + ') contrast(' + (1 + E.adj.c / 100) + ') saturate(' + (1 + E.adj.s / 100) + ')'; }; });
  }
  const lw = () => Math.max(2, Math.round(E.cv.width * [0.004, 0.008, 0.016][E.sz]));
  const fsz = () => Math.round(E.cv.width * [0.03, 0.05, 0.08][E.sz]);
  function resize(o) { if (o.t === 'text') o.fs = fsz(); else if (o.t !== 'mosaic') o.w = lw() * (o.t === 'mark' ? 3.2 : 1); }

  // ── обработка пикселей: поворот, обрезка, цвет (сначала нарисованное вдавливается в фото) ──
  function edit(fn) { snap(); flatten(); fn(); paint(); }
  function rot90(d) {
    edit(() => { const s = E.base, n = newCv(s.height, s.width), c = n.getContext('2d'); c.translate(n.width / 2, n.height / 2); c.rotate(d * Math.PI / 2); c.drawImage(s, -s.width / 2, -s.height / 2); E.base = n; });
    setTool('rot');
  }
  function flip() { edit(() => { const s = E.base, n = newCv(s.width, s.height), c = n.getContext('2d'); c.translate(s.width, 0); c.scale(-1, 1); c.drawImage(s, 0, 0); E.base = n; }); }
  function applyAngle() {
    if (!E.ang) return; const a = E.ang * Math.PI / 180;
    edit(() => {
      const s = E.base, W = s.width, H = s.height, n = newCv(W, H), c = n.getContext('2d');
      const k = Math.cos(Math.abs(a)) + Math.max(W / H, H / W) * Math.sin(Math.abs(a)); // чуть увеличиваем: чтобы по краям не было пустых углов
      c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.translate(W / 2, H / 2); c.rotate(a); c.scale(k, k); c.drawImage(s, -W / 2, -H / 2); E.base = n;
    });
    setTool('rot');
  }
  function pixels(fn) { const s = E.base, n = newCv(s.width, s.height), c = n.getContext('2d'); c.drawImage(s, 0, 0); const id = c.getImageData(0, 0, n.width, n.height); fn(id.data); c.putImageData(id, 0, 0); E.base = n; }
  function applyAdj() {
    const a = E.adj; if (!a.b && !a.c && !a.s) return; const B = 1 + a.b / 100, C = 1 + a.c / 100, S = 1 + a.s / 100;
    edit(() => pixels(d => {
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * B, g = d[i + 1] * B, b = d[i + 2] * B;
        r = (r - 128) * C + 128; g = (g - 128) * C + 128; b = (b - 128) * C + 128;
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[i] = clamp(y + (r - y) * S, 0, 255); d[i + 1] = clamp(y + (g - y) * S, 0, 255); d[i + 2] = clamp(y + (b - y) * S, 0, 255);
      }
    }));
    setTool('adj');
  }
  function autoLevels() {
    edit(() => pixels(d => {
      const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { h[0][d[i]]++; h[1][d[i + 1]]++; h[2][d[i + 2]]++; }
      const lim = n * 0.01, lo = [0, 0, 0], hi = [255, 255, 255];
      for (let c = 0; c < 3; c++) {
        let s = 0; for (let v = 0; v < 256; v++) { s += h[c][v]; if (s > lim) { lo[c] = v; break; } }
        s = 0; for (let v = 255; v >= 0; v--) { s += h[c][v]; if (s > lim) { hi[c] = v; break; } }
        if (hi[c] - lo[c] < 40) { lo[c] = 0; hi[c] = 255; }
      }
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = clamp((d[i + c] - lo[c]) * 255 / (hi[c] - lo[c]), 0, 255);
    }));
    setTool('adj');
  }
  function bw() {
    edit(() => pixels(d => {
      const hist = new Uint32Array(256); let lo = 0, hi = 255;
      for (let i = 0; i < d.length; i += 4) hist[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++;
      const lim = d.length / 4 * 0.02; let s = 0;
      for (let v = 0; v < 256; v++) { s += hist[v]; if (s > lim) { lo = v; break; } } s = 0;
      for (let v = 255; v >= 0; v--) { s += hist[v]; if (s > lim) { hi = v; break; } }
      if (hi - lo < 30) { lo = 0; hi = 255; }
      for (let i = 0; i < d.length; i += 4) { const y = clamp(((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) - lo) * 255 / (hi - lo), 0, 255); d[i] = d[i + 1] = d[i + 2] = y; }
    }));
    setTool('adj');
  }

  // ── обрезка ──
  const selEl = () => q('#ed-sel');
  function selHide() { selEl().style.display = 'none'; E.crop = null; }
  function initCrop() {
    const W = E.cv.width, H = E.cv.height; let w = W * 0.9, h = H * 0.9;
    if (E.ratio) { if (w / h > E.ratio) w = h * E.ratio; else h = w / E.ratio; }
    E.crop = { x: (W - w) / 2, y: (H - h) / 2, w, h }; E.cropTouched = false; drawSel();
  }
  function drawSel() {
    if (!E || E.tool !== 'crop' || !E.crop) return;
    const el = selEl(), r = E.cv.getBoundingClientRect(), k = r.width / E.cv.width, c = E.crop;
    el.style.display = 'block'; el.style.left = c.x * k + 'px'; el.style.top = c.y * k + 'px'; el.style.width = c.w * k + 'px'; el.style.height = c.h * k + 'px';
  }
  function applyCrop() {
    const c = E.crop; if (!c || c.w < 8 || c.h < 8) return;
    const x = Math.round(c.x), y = Math.round(c.y), w = Math.round(c.w), h = Math.round(c.h);
    edit(() => { const n = newCv(w, h); n.getContext('2d').drawImage(E.base, x, y, w, h, 0, 0, w, h); E.base = n; });
    E.cropTouched = false; setTool('crop');
  }
  function cropDrag(e) {
    const h = (e.target.dataset || {}).h, p0 = pt(e), c0 = { ...E.crop }, W = E.cv.width, H = E.cv.height;
    const mv = ev => {
      const p = pt(ev), dx = p.x - p0.x, dy = p.y - p0.y; let c = { ...c0 }; E.cropTouched = true;
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

  // ── объекты: создание, выбор, перемещение ──
  function bbox(o) {
    let x1, y1, x2, y2;
    if (o.pts) { x1 = Math.min(...o.pts.map(p => p.x)); x2 = Math.max(...o.pts.map(p => p.x)); y1 = Math.min(...o.pts.map(p => p.y)); y2 = Math.max(...o.pts.map(p => p.y)); }
    else if (o.t === 'text') { E.ctx.font = FONT(o.fs); x1 = o.p.x; x2 = o.p.x + E.ctx.measureText(o.s).width; y1 = o.p.y - o.fs / 2; y2 = o.p.y + o.fs / 2; }
    else { x1 = Math.min(o.a.x, o.b.x); x2 = Math.max(o.a.x, o.b.x); y1 = Math.min(o.a.y, o.b.y); y2 = Math.max(o.a.y, o.b.y); }
    const m = (o.w || 0) / 2 + 4; return { x1: x1 - m, y1: y1 - m, x2: x2 + m, y2: y2 + m };
  }
  const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  function hit(o, p) {
    const tol = Math.max(o.w || 0, E.cv.width * 0.025);
    if (o.pts) return o.pts.some((a, i) => segD(p, a, o.pts[i + 1] || a) <= tol);
    if (o.t === 'arrow') return segD(p, o.a, o.b) <= tol;
    const b = bbox(o); return p.x >= b.x1 - tol / 2 && p.x <= b.x2 + tol / 2 && p.y >= b.y1 - tol / 2 && p.y <= b.y2 + tol / 2;
  }
  function selUI() {
    if (!E || !E.ov) return;
    const os = q('#ed-osel'); if (!os) return;
    if (E.tool !== 'hand' || E.sel == null || !E.objs[E.sel]) { os.style.display = 'none'; return; }
    const o = E.objs[E.sel], b = bbox(o), r = E.cv.getBoundingClientRect(), k = r.width / E.cv.width;
    os.style.display = 'block'; os.style.left = b.x1 * k + 'px'; os.style.top = b.y1 * k + 'px'; os.style.width = (b.x2 - b.x1) * k + 'px'; os.style.height = (b.y2 - b.y1) * k + 'px';
    const hs = os.querySelectorAll('[data-oh]');
    if (o.a && o.b) {
      hs[0].style.display = hs[1].style.display = 'block';
      hs[0].style.left = (o.a.x - b.x1) * k + 'px'; hs[0].style.top = (o.a.y - b.y1) * k + 'px';
      hs[1].style.left = (o.b.x - b.x1) * k + 'px'; hs[1].style.top = (o.b.y - b.y1) * k + 'px';
    } else hs[0].style.display = hs[1].style.display = 'none';
  }
  function mk(t, p) {
    if (t === 'pen' || t === 'mark') return { t, c: E.color, w: lw() * (t === 'mark' ? 3.2 : 1), pts: [p] };
    if (t === 'mosaic') return { t, a: p, b: p };
    return { t, c: E.color, w: lw(), a: p, b: p };
  }
  function drag(onMove, onUp) {
    const mv = ev => onMove(pt(ev));
    const up = ev => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); onUp(pt(ev)); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  function attachPointer() {
    const cv = E.cv, wrap = q('#ed-wrap');
    wrap.addEventListener('pointerdown', e => {
      if (!E) return;
      const t = E.tool;
      if (t === 'crop') { if (E.crop && (e.target.id === 'ed-sel' || (e.target.dataset && e.target.dataset.h))) { e.preventDefault(); cropDrag(e); } return; }
      if (t === 'hand' && e.target.dataset && e.target.dataset.oh) { // потянули за кружок: меняем размер
        e.preventDefault(); const o = E.objs[E.sel], key = e.target.dataset.oh; snap();
        drag(p => { o[key] = p; paint(); }, () => {}); return;
      }
      if (e.target !== cv) return;
      const p = pt(e);
      if (t === 'text') { e.preventDefault(); askText(p, null); return; }
      if (t === 'hand') {
        e.preventDefault(); let idx = -1;
        for (let i = E.objs.length - 1; i >= 0; i--) if (hit(E.objs[i], p)) { idx = i; break; }
        E.sel = idx < 0 ? null : idx; opts(); paint();
        if (idx < 0) return;
        const o = E.objs[idx], o0 = clone(o); let moved = false; snap();
        drag(q2 => {
          const dx = q2.x - p.x, dy = q2.y - p.y; if (Math.hypot(dx, dy) > 3) moved = true;
          if (o0.pts) o.pts = o0.pts.map(a => ({ x: a.x + dx, y: a.y + dy }));
          else if (o0.p) o.p = { x: o0.p.x + dx, y: o0.p.y + dy };
          else { o.a = { x: o0.a.x + dx, y: o0.a.y + dy }; o.b = { x: o0.b.x + dx, y: o0.b.y + dy }; }
          paint();
        }, () => { if (!moved) { E.stack.pop(); upd(); } });
        return;
      }
      if (!['pen', 'mark', 'arrow', 'rect', 'oval', 'mosaic'].includes(t)) return;
      e.preventDefault(); snap();
      const o = mk(t, p); E.objs.push(o); paint();
      drag(q2 => { if (o.pts) o.pts.push(q2); else o.b = q2; paint(); }, q2 => {
        if (!o.pts) { o.b = q2; if (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) < 6) { const i = E.objs.indexOf(o); if (i >= 0) E.objs.splice(i, 1); E.stack.pop(); upd(); } }
        paint();
      });
    });
  }
  function askText(p, idx) {
    const old = idx != null ? E.objs[idx] : null, d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:5;background:#1c1c1c;padding:12px;display:flex;gap:8px;border-bottom:1px solid #444';
    d.innerHTML = '<input id="ed-txt" placeholder="Текст" style="flex:1;font-size:16px;padding:9px;border-radius:8px;border:1px solid #555;background:#111;color:#eee;font-family:inherit"><button id="ed-tok" style="background:' + GOLD + ';border:none;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer">OK</button><button id="ed-tno" style="background:#2a2a2a;border:1px solid #444;color:#eee;border-radius:10px;padding:0 14px;cursor:pointer">✕</button>';
    E.ov.appendChild(d);
    const inp = d.querySelector('#ed-txt'); if (old) inp.value = old.s; inp.focus();
    const ok = () => {
      const v = inp.value.trim(); d.remove(); if (!v || !E) return;
      snap();
      if (old) old.s = v; else { E.objs.push({ t: 'text', c: E.color, fs: fsz(), s: v, p }); E.sel = E.objs.length - 1; E.tool = 'hand'; setTool('hand'); E.sel = E.objs.length - 1; }
      opts(); paint();
    };
    d.querySelector('#ed-tok').onclick = ok; d.querySelector('#ed-tno').onclick = () => d.remove();
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  }

  // ── сохранение ──
  const toBlob = () => new Promise(r => { paint(); E.cv.toBlob(r, 'image/jpeg', 0.9); });
  async function finish() {
    if (E.tool === 'rot' && E.ang) applyAngle(); else if (E.tool === 'adj') applyAdj(); else if (E.tool === 'crop' && E.cropTouched) applyCrop();
    if (!E.stack.length) { closeEd(true); tst('Правок нет'); return; }
    const blob = await toBlob();
    if (!blob) { tst('Не удалось сохранить результат', true); return; }
    const custom = E.opt.custom, choice = custom ? 'custom' : await askMode();
    if (!choice) return;
    const base = (E.name || decodeURIComponent((E.url.split('?')[0].split('/').pop() || 'photo')).replace(/^[A-Za-z0-9]{6,}_/, '')).replace(/\.[^.]+$/, '') || 'photo';
    const file = new File([blob], base.replace(/_edit$/, '') + '_edit.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    const src = E.blob, url = E.url, opt = E.opt; E.saved = true;
    closeEd(true);
    try {
      if (choice === 'custom') await custom(file, src);
      else if (choice === 'replace') await saveReplace(url, file, src);
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
    try { if (typeof render === 'function') window.render(); if (typeof openView === 'function' && window._openViewId === card.id) openView(card.id); } catch (e) {}
    try { await dbUpdate(card); } catch (e) { tst('Ошибка синхронизации', true); }
  }
  async function upload(file, card) {
    if (window.mcUpExpect) try { mcUpExpect(1); } catch (e) {}
    tst('⏳ Загружаю исправленное фото…');
    return await uploadToStorage(file, card && card.id);
  }
  async function keepOriginal(url, file, srcBlob) { // оригинал до правки: прежний 💎 или то, что редактировали
    try {
      const o = await mcVaultGet(url); if (o) return o.meta.id;
      return await mcVaultPut(new File([srcBlob], file.name.replace('_edit', '_original'), { type: srcBlob.type }), 'photo');
    } catch (e) { tst('Оригинал на устройстве сохранить не удалось (нет места?)', true); return null; }
  }
  async function saveReplace(url, file, srcBlob) {
    const f = await findAtt(url);
    if (!f) { tst('Не нашла это фото в записи, заменить нечего', true); return; }
    const vid = await keepOriginal(url, file, srcBlob), att = await upload(file, f.card), old = f.list[f.i];
    f.list[f.i] = { ...old, data: att.data, size: att.size || file.size, type: att.type || 'image/jpeg', ts: att.ts || Date.now(), edited: true, prevUrl: old.prevUrl || old.data };
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
    const pick = await chatPicker(sps); if (!pick) return;
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
        if (ids.length) await notifyUsers(ids, '💬 ' + data.title, '{{name}}: фото', currentUser?.id, me, 'https://vales-chayv.github.io/check-list/?openSpace=' + pick.space.id + '&openCard=' + data.id);
      }
    } catch (e) {}
  }
  function chatPicker(sps) {
    return new Promise(res => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:' + (Z + 10) + ';background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px';
      const b = 'width:100%;text-align:left;border-radius:10px;padding:11px 12px;font-size:14px;cursor:pointer;font-family:inherit;border:1px solid #555;background:#2a2a2a;color:#eee;margin-top:6px';
      const box = document.createElement('div'); box.style.cssText = 'background:#1c1c1c;color:#eee;border-radius:16px;padding:16px;max-width:380px;width:100%;max-height:85vh;overflow:auto';
      d.appendChild(box); document.body.appendChild(d);
      const done = v => { d.remove(); res(v); }, esc = s => String(s || '').replace(/[<>&]/g, '');
      const showSpaces = () => { box.innerHTML = '<div style="font-size:16px;font-weight:700">Куда отправить?</div>' + sps.map((s, i) => '<button data-s="' + i + '" style="' + b + '">' + esc(s.name || 'Кабинет') + '</button>').join('') + '<button data-x style="' + b + ';text-align:center">Отмена</button>'; };
      const showChats = async sp => {
        box.innerHTML = '<div style="font-size:14px;opacity:.7">Загружаю чаты…</div>'; let list = [];
        try { const { data } = await sb.from('cards').select('id,title,chatParticipants,chatStatus,status').eq('space_id', sp.id); list = (data || []).filter(c => Array.isArray(c.chatParticipants) && c.chatStatus !== 'closed' && c.status !== 'done'); }
        catch (e) { box.innerHTML = '<div style="color:#e57373">Не удалось загрузить чаты</div><button data-b style="' + b + ';text-align:center">Назад</button>'; return; }
        box._list = list; box._sp = sp;
        box.innerHTML = '<div style="font-size:16px;font-weight:700">Чат в «' + esc(sp.name) + '»</div>' + (list.length ? list.map((c, i) => '<button data-c="' + i + '" style="' + b + '">' + esc(c.title || 'Чат') + '</button>').join('') : '<div style="font-size:13px;opacity:.7;margin-top:8px">В этом кабинете пока нет открытых чатов.</div>') + '<button data-b style="' + b + ';text-align:center">Назад</button>';
      };
      box.onclick = e => {
        const s = e.target.closest('[data-s]'), c = e.target.closest('[data-c]');
        if (s) showChats(sps[+s.dataset.s]); else if (c && box._list) done({ space: box._sp, chat: box._list[+c.dataset.c] });
        else if (e.target.closest('[data-b]')) showSpaces(); else if (e.target.closest('[data-x]')) done(null);
      };
      showSpaces();
    });
  }

  // ── вернуть оригинал ──
  window.mcPhotoRestore = async function (url) {
    const f = await findAtt(url);
    if (!f || !f.list[f.i].edited) { tst('Это фото не редактировалось', true); return; }
    const a = f.list[f.i]; let file = null, vid = null;
    try { const db = await mcVaultDb(), m = await _mcIdb(db.transaction('meta').objectStore('meta').getAll()), mm = m.find(x => x.origOf === url); if (mm) { vid = mm.id; file = await _mcVaultFile(db, mm.id, mm); } } catch (e) {}
    if (file) {
      const att = await upload(file, f.card);
      f.list[f.i] = { ...a, data: att.data, size: att.size || file.size, type: att.type || file.type, ts: att.ts || Date.now() };
      delete f.list[f.i].edited; delete f.list[f.i].prevUrl;
      try { await mcVaultSetOrigOf(vid, null, att.data); } catch (e) {}
    } else if (a.prevUrl) { // оригинала на этом устройстве нет: берём прежний файл из облака, если он ещё там
      const alive = await mcCloudCheck([a.prevUrl]);
      if (alive.dead.length || alive.unknown.length) { tst('Оригинал уже удалён из облака, а на этом устройстве его нет', true); return; }
      f.list[f.i] = { ...a, data: a.prevUrl }; delete f.list[f.i].edited; delete f.list[f.i].prevUrl;
    } else { tst('Оригинал не найден', true); return; }
    await persist(f.card);
    tst('✓ Оригинал возвращён');
  };
  window.mcPhotoIsEdited = async function (url) { const f = await findAtt(url); return !!(f && f.list[f.i].edited); };

  // ── правка фото, прикреплённых к новой карточке и к записи (ещё не сохранённых) ──
  const st = document.createElement('style');
  st.textContent = '#att-prev .att-img,#ae-att-prev .att-img,#ee-att-prev .att-img{position:relative;cursor:pointer}#att-prev .att-img::after,#ae-att-prev .att-img::after,#ee-att-prev .att-img::after{content:"✎";position:absolute;left:3px;bottom:3px;background:rgba(0,0,0,.65);color:#fff;font-size:12px;line-height:16px;border-radius:6px;padding:0 4px;pointer-events:none}';
  document.head.appendChild(st);
  document.addEventListener('click', ev => {
    const img = ev.target && ev.target.closest ? ev.target.closest('#att-prev .att-img img,#ae-att-prev .att-img img,#ee-att-prev .att-img img') : null;
    if (!img || !window.mcPhotoEdit) return;
    ev.preventDefault(); ev.stopPropagation();
    const holder = img.closest('#att-prev,#ae-att-prev,#ee-att-prev').id, src = img.getAttribute('src');
    const cfg = { 'att-prev': [() => typeof tempAtt !== 'undefined' ? tempAtt : null, 'renderAttPrev'], 'ae-att-prev': [() => typeof aeAtts !== 'undefined' ? aeAtts : null, 'renderAEPrev'], 'ee-att-prev': [() => typeof _eeAtts !== 'undefined' ? _eeAtts : null, 'renderEEPrev'] }[holder];
    window.mcPhotoEdit(src, {
      custom: async (file, srcBlob) => {
        const arr = cfg[0](), i = arr ? arr.findIndex(a => a.data === src) : -1;
        if (i < 0) { tst('Не нашла это фото', true); return; }
        const old = arr[i], vid = await keepOriginal(old.data, file, srcBlob), att = await upload(file, null);
        arr[i] = { ...att, edited: true, prevUrl: old.prevUrl || old.data };
        if (vid) { try { await mcVaultSetOrigOf(vid, att.data); } catch (e) {} }
        try { window[cfg[1]](); } catch (e) {}
        tst('✓ Фото исправлено');
      }
    });
  }, true);
})();
