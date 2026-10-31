// ═══════════════════════════════════════════
//  КАЛЬКУЛЯТОР (панель A на ПК)
// ═══════════════════════════════════════════

function openCalcMobile(){ document.getElementById('calc-ov').classList.add('on'); }

function calcHasHistory(){ return (document.getElementById('calc-history')?.children.length || 0) > 0; }
function calcClearAll(){
  document.getElementById('calc-history').innerHTML = '';
  calcExpr = '0'; calcFresh = true; calcShow();
}

function closeCalcMobile(){
  calcAskClose(() => document.getElementById('calc-ov').classList.remove('on'));
}
function toggleDesktopCalc(){
  if(document.body.classList.contains('calc-on')){
    calcAskClose(() => document.body.classList.remove('calc-on'));
    return;
  }
  document.body.classList.remove('cal-on');
  document.body.classList.add('calc-on');
}
// ── Окно при закрытии: сохранить ленту в карточку / стереть / оставить ──
function calcTapeRows(){
  return [...document.querySelectorAll('#calc-history > div')].map(r => ({expr: r.dataset.expr || '', res: r.dataset.res || ''}));
}
function calcAskClose(done){
  if(!calcHasHistory()){ done(); return; }
  document.getElementById('calc-close-ov')?.remove();
  const n = calcTapeRows().length;
  const ov = document.createElement('div');
  ov.id = 'calc-close-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:3500;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
  const bs = 'display:block;width:100%;margin-top:8px;padding:11px;border-radius:var(--rsm);font-size:14px;cursor:pointer;font-family:inherit;border:1px solid var(--b1);background:var(--s1);color:var(--t1)';
  ov.innerHTML = `<div style="background:var(--s2);border:1px solid var(--accent);border-radius:var(--r);padding:18px;max-width:340px;width:100%">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px">Лента решений (${n})</div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:6px">Создастся карточка «Расчёт» в личном кабинете, рубрика «Расчёты»</div>
    <button id="cc-save" style="${bs};background:var(--accent);color:#0f0f0f;font-weight:700">💾 Сохранить в карточку</button>
    <button id="cc-clear" style="${bs}">🗑 Стереть</button>
    <button id="cc-keep" style="${bs}">Оставить до следующего раза</button>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = e => { if(e.target === ov) close(); };
  ov.querySelector('#cc-keep').onclick = () => { close(); done(); };
  ov.querySelector('#cc-clear').onclick = () => { close(); calcClearAll(); done(); };
  ov.querySelector('#cc-save').onclick = async () => {
    const ok = await calcSaveTapeAsCard();
    if(ok){ close(); calcClearAll(); done(); }
  };
}
async function calcSaveTapeAsCard(){
  const rows = calcTapeRows();
  if(!rows.length) return true;
  try {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear();
    const tm = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    // карточка всегда в личном кабинете: в текущем, если он личный, иначе в основном
    const inPersonal = currentSpace && currentSpace.type === 'personal';
    const targetId = inPersonal ? currentSpaceId : 'personal';
    const sameSpace = (targetId === (currentSpaceId || 'personal'));
    let category = 'Личное';
    if(sameSpace){
      category = 'Расчёты';
      if(!(cats||[]).some(c => c.name === category)){
        const cat = {name: category, color: '#8fa7c9'};
        cats.push(cat);
        try { await dbAddCat(cat); } catch(e) {}
      }
    }
    const entries = rows.map(r => ({
      id: uid(), text: (r.expr + ' ' + r.res).trim(), date: nowStr(), done: false, attachments: [],
      deadline: null, completions: null, assigned_to: null
    }));
    const card = {
      id: uid(), created_at: today(), space_id: targetId,
      created_by: localStorage.getItem('mc_current_member') || currentUser?.display_name || '',
      title: 'Расчёт ' + dd + ' ' + tm, body: '', category, status: 'new', priority: 'normal',
      deadline: null, ball: '', ballWho: '', assigned_to: null, attachments: [],
      entries, entryGroups: [],
      reminder: {enabled:false, freq:'daily', days:[], hour:9, monthDay:1, intervalMin:null, intervalRun:null},
      history: [{date: nowStr(), text: 'Создана из калькулятора', type: 'status'}], related_ids: []
    };
    if(sameSpace) cards.unshift(card);
    await dbInsert(card);
    if(sameSpace) render();
    toast('✓ Сохранено в карточку «' + card.title + '»');
    return true;
  } catch(e) {
    console.log('calcSaveTapeAsCard error:', e);
    toast('Не удалось сохранить ленту', true);
    return false;
  }
}

// ── PDF: на телефоне — файл (поделиться/скачать), на ПК — окно печати ──
function calcPdfDate(){
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear();
}
function calcPdfPages(rows, dd){
  // рисуем страницы A4 на canvas (кириллица без шрифтов), затем кладём картинки в PDF
  const W = 1240, H = 1754, M = 90, LH = 54;
  const pages = [];
  let cv, cx, y;
  const newPage = first => {
    cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0,0,W,H);
    cx.fillStyle = '#222'; cx.textBaseline = 'alphabetic';
    y = M + 30;
    if(first){
      cx.font = 'bold 44px Arial, sans-serif'; cx.textAlign = 'left';
      cx.fillText('Расчёт · ' + dd, M, y); y += 36;
      cx.strokeStyle = '#bbb'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(M,y); cx.lineTo(W-M,y); cx.stroke(); y += LH;
    }
    pages.push(cv);
  };
  newPage(true);
  rows.forEach(r => {
    if(y > H - M - 80) newPage(false);
    cx.font = '32px Arial, sans-serif';
    cx.textAlign = 'right'; cx.font = 'bold 34px Arial, sans-serif';
    const rw = cx.measureText(r.res).width;
    cx.fillText(r.res, W-M, y);
    cx.textAlign = 'left'; cx.font = '32px Arial, sans-serif';
    let txt = r.expr;
    const maxW = W - 2*M - rw - 30;
    while(cx.measureText(txt).width > maxW && txt.length > 4) txt = txt.slice(0,-2);
    if(txt !== r.expr) txt += '…';
    cx.fillText(txt, M, y);
    cx.strokeStyle = '#e2e2e2'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(M,y+16); cx.lineTo(W-M,y+16); cx.stroke();
    y += LH;
  });
  const last = pages[pages.length-1].getContext('2d');
  last.fillStyle = '#888'; last.font = '24px Arial, sans-serif'; last.textAlign = 'left';
  last.fillText('Мои карточки · калькулятор', M, H - M + 20);
  return pages.map(c => {
    const b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1];
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
    return {w: c.width, h: c.height, jpg: u8};
  });
}
function calcBuildPdf(pgs){
  const enc = new TextEncoder();
  const chunks = []; let len = 0; const offs = [];
  const put = d => { const u = typeof d === 'string' ? enc.encode(d) : d; chunks.push(u); len += u.length; };
  const n = pgs.length;
  put('%PDF-1.4\n');
  const objStart = id => { offs[id] = len; put(id + ' 0 obj\n'); };
  objStart(1); put('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objStart(2); put('<< /Type /Pages /Count ' + n + ' /Kids [' + pgs.map((_,i) => (3+i*3) + ' 0 R').join(' ') + '] >>\nendobj\n');
  pgs.forEach((p,i) => {
    const pg = 3+i*3, ct = pg+1, im = pg+2;
    objStart(pg); put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>\nendobj\n');
    const cs = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
    objStart(ct); put('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream\nendobj\n');
    objStart(im); put('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpg.length + ' >>\nstream\n');
    put(p.jpg); put('\nendstream\nendobj\n');
  });
  const total = 3 + n*3;
  const xref = len;
  put('xref\n0 ' + total + '\n0000000000 65535 f \n');
  for(let id=1; id<total; id++) put(String(offs[id]).padStart(10,'0') + ' 00000 n \n');
  put('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(chunks, {type: 'application/pdf'});
}
// Android-приложение (Capacitor): записываем файл во временную папку и открываем системное «Поделиться»
async function mcNativeShareFile(blob, fileName, title){
  const P = window.Capacitor && window.Capacitor.Plugins;
  if(!(typeof window.isNativeApp === 'function' && window.isNativeApp()) || !P || !P.Filesystem || !P.Share) return false;
  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
    const w = await P.Filesystem.writeFile({ path: fileName, data: b64, directory: 'CACHE' });
    await P.Share.share({ title: title || fileName, url: w.uri, dialogTitle: 'Поделиться' });
    return true;
  } catch(err) {
    if(err && /cancel/i.test(String(err.message || err))) return true;
    console.log('mcNativeShareFile error:', err);
    return false;
  }
}
async function calcExportPdf(){
  const rows = calcTapeRows();
  if(!rows.length){ toast('Лента пуста — нечего сохранять'); return; }
  const dd = calcPdfDate();
  const desktop = window.matchMedia && window.matchMedia('(pointer:fine)').matches && window.innerWidth >= 900;
  if(desktop){ calcPrintTape(rows, dd); return; }
  try {
    const blob = calcBuildPdf(calcPdfPages(rows, dd));
    const name = 'Расчёт ' + dd + '.pdf';
    const file = new File([blob], name, {type: 'application/pdf'});
    if(await mcNativeShareFile(blob, 'Raschet_' + dd.replace(/[^\d.]/g, '') + '.pdf', name)) return;
    if(navigator.canShare && navigator.canShare({files: [file]})){
      try { await navigator.share({files: [file], title: name}); return; }
      catch(err){ if(err && err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast('📄 PDF сохранён: ' + name);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch(err){
    console.log('calcExportPdf error:', err);
    toast('Не удалось создать PDF', true);
  }
}
function calcPrintTape(rows, dd){
  const e = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Расчёт ${dd}</title>
<style>body{font-family:Arial,sans-serif;color:#222;margin:28px}h1{font-size:20px;margin:0 0 8px;font-weight:600}
.r{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd;font-size:15px}.f{margin-top:18px;font-size:11px;color:#777}</style></head>
<body><h1>Расчёт · ${dd}</h1>${rows.map(r => `<div class="r"><span>${e(r.expr)}</span><b>${e(r.res)}</b></div>`).join('')}
<div class="f">Мои карточки · калькулятор</div></body></html>`;
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(fr);
  fr.srcdoc = html;
  fr.onload = () => {
    try { fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch(err){ toast('Печать недоступна на этом устройстве', true); }
    setTimeout(() => fr.remove(), 60000);
  };
}

// ── Ввод с клавиатуры (ПК) ──
document.addEventListener('keydown', ev => {
  const open = document.body.classList.contains('calc-on') || document.getElementById('calc-ov')?.classList.contains('on');
  if(!open || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target;
  if(t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if(document.getElementById('calc-close-ov')) return;
  let k = ev.key, v = null;
  if(/^[0-9]$/.test(k)) v = k;
  else if(k === '.' || k === ',') v = '.';
  else if(k === '+') v = '+';
  else if(k === '-') v = '-';
  else if(k === '*' || k === 'x' || k === 'X' || k === '×') v = '×';
  else if(k === '/' || k === '÷') v = '÷';
  else if(k === '%') v = '%';
  else if(k === '(' || k === ')') v = k;
  else if(k === 'Enter' || k === '=') v = '=';
  else if(k === 'Backspace') v = '⌫';
  else if(k === 'Delete' || k === 'c' || k === 'C') v = 'C';
  if(v === null) return;
  ev.preventDefault();
  calcInput(v);
});

function toggleCalcDesign(){
  const box = document.getElementById('calc-design');
  const arrow = document.getElementById('calc-design-arrow');
  const open = box.style.display === 'none';
  box.style.display = open ? 'flex' : 'none';
  arrow.textContent = open ? '▴' : '▾';
}

// ── Арифметика: выражение целиком, со скобками и приоритетом действий ──
let calcExpr = '0', calcFresh = true, calcFracOn = false, calcRaw = null;
function calcFmt(n){ return Math.round(n*10000)/10000 + ''; }
function calcPretty(e){ return e.replace(/-/g,'−').replace(/\^2(?!\d)/g,'²'); }
// дробь для результата: 0.75 → 3/4, 2.5 → 2 1/2 (целые и «неудобные» числа остаются десятичными)
function calcToFrac(x){
  if(!isFinite(x) || Math.abs(x-Math.round(x)) < 1e-9) return null;
  const sg = x < 0 ? '−' : ''; x = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for(let i = 0; i < 14; i++){
    const a = Math.floor(b), h2 = a*h1 + h0, k2 = a*k1 + k0;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if(Math.abs(x - h1/k1) < 1e-9 || k1 > 1000) break;
    b = 1/(b - a); if(!isFinite(b)) break;
  }
  if(k1 > 1000 || Math.abs(x - h1/k1) > 1e-7) return null;
  const w = Math.floor(h1/k1), r = h1 % k1;
  return sg + (w ? w + ' ' : '') + r + '/' + k1;
}
function calcFmtOut(n){ if(calcFracOn){ const f = calcToFrac(n); if(f) return f; } return calcFmt(n); }
function calcToggle2nd(){
  const o = document.getElementById('calc-fn').classList.toggle('open');
  document.getElementById('calc-2nd-btn').classList.toggle('on', o);
}
function calcToggleFrac(){
  calcFracOn = !calcFracOn;
  document.getElementById('calc-frac-btn')?.classList.toggle('on', calcFracOn);
  calcShow();
}
function calcShow(){
  const disp = document.getElementById('calc-current');
  if(!disp) return;
  let txt = calcPretty(calcExpr);
  if(calcFresh && calcFracOn && calcRaw !== null && calcExpr === calcFmt(calcRaw)){ const f = calcToFrac(calcRaw); if(f) txt = f; }
  disp.textContent = txt;
  const n = txt.length;
  disp.classList.toggle('calc-sm', n > 12 && n <= 24);
  disp.classList.toggle('calc-xs', n > 24);
}
// безопасный разбор без eval; % после числа = /100, а в «100+10%» — 10% от 100
function calcEval(src){
  const t = src.replace(/\s+/g,'');
  let p = 0;
  const peek = () => t[p];
  function expr(){
    let left = term();
    while(peek()==='+' || peek()==='-'){
      const op = t[p++];
      const r = term();
      const right = r.pct ? left.v * r.v : r.v;
      left = {v: op==='+' ? left.v + right : left.v - right};
    }
    return left;
  }
  function term(){
    let left = factor();
    let single = true;
    while(peek()==='×' || peek()==='÷'){
      single = false;
      const op = t[p++];
      const r = factor();
      if(op==='÷'){ if(r.v===0) throw new Error('div0'); left = {v: left.v / r.v}; }
      else left = {v: left.v * r.v};
    }
    return single ? left : {v: left.v};
  }
  function fn(name, a){
    const R = x => Math.round(x*1e12)/1e12, k = Math.PI/180;
    if(name==='sin') return R(Math.sin(a*k));
    if(name==='cos') return R(Math.cos(a*k));
    if(name==='tan'){ if(Math.abs(Math.cos(a*k)) < 1e-12) throw new Error('num'); return R(Math.tan(a*k)); }
    if(a < 0) throw new Error('num');
    return Math.sqrt(a);
  }
  function factor(){
    if(peek()==='-'){ p++; const f = factor(); return {v: -f.v, pct: f.pct}; }
    if(peek()==='+'){ p++; return factor(); }
    return power();
  }
  function power(){
    const b = atom();
    if(peek()==='^'){
      p++; let sg = 1;
      if(peek()==='-'){ p++; sg = -1; } else if(peek()==='+') p++;
      const e = power(), r = Math.pow(b.v, sg*e.v);
      if(!isFinite(r)) throw new Error('num');
      return {v: r};
    }
    return b;
  }
  function atom(){
    let node;
    const f = /^(sin|cos|tan|√)\(/.exec(t.slice(p));
    if(f){
      p += f[0].length; const a = expr().v;
      if(peek()===')') p++; else throw new Error('paren');
      node = {v: fn(f[1], a)};
    } else if(peek()==='π'){ p++; node = {v: Math.PI};
    } else if(peek()==='('){
      p++; node = {v: expr().v};
      if(peek()===')') p++; else throw new Error('paren');
    } else {
      const m = /^\d+\.?\d*|^\.\d+/.exec(t.slice(p));
      if(!m) throw new Error('syntax');
      p += m[0].length; node = {v: parseFloat(m[0])};
    }
    while(peek()==='%'){ p++; node = {v: node.v / 100, pct: true}; }
    return node;
  }
  const r = expr();
  if(p !== t.length) throw new Error('syntax');
  if(!isFinite(r.v)) throw new Error('num');
  return r.v;
}
function calcInput(v){
  const isOp = c => c==='+' || c==='-' || c==='×' || c==='÷';
  const last = () => calcExpr[calcExpr.length-1];
  if(v==='C'){ calcExpr='0'; calcFresh=true; calcShow(); return; }
  if(v==='⌫'){
    if(calcFresh) return;
    const fm = /(sin\(|cos\(|tan\(|√\()$/.exec(calcExpr);
    calcExpr = fm ? (calcExpr.slice(0, -fm[0].length) || '0') : (calcExpr.length > 1 ? calcExpr.slice(0,-1) : '0');
    if(calcExpr==='-') calcExpr='0';
    calcShow(); return;
  }
  if(v==='='){
    if(calcFresh) return;
    let e = calcExpr;
    for(let ch = true; ch && e.length;){ const bf = e; e = e.replace(/(sin|cos|tan|√)\($/, '').replace(/[+\-×÷^(]$/, ''); ch = e !== bf; }
    if(!e){ return; }
    const open = (e.match(/\(/g)||[]).length - (e.match(/\)/g)||[]).length;
    if(open > 0) e += ')'.repeat(open);
    if(/^-?\d+\.?\d*$/.test(e)) { calcExpr = e; calcFresh = true; calcShow(); return; } // просто число — считать нечего
    let res;
    try { res = calcEval(e); }
    catch(err){ toast(err.message==='div0' ? 'Делить на ноль нельзя' : 'Проверь выражение', true); return; }
    calcAddHistory(calcPretty(e) + ' =', calcFmtOut(res), calcFmt(res));
    calcRaw = res; calcExpr = calcFmt(res); calcFresh = true; calcShow();
    return;
  }
  if(v==='±'){
    if(calcFresh && calcExpr!=='0'){ calcExpr = calcExpr.startsWith('-') ? calcExpr.slice(1) : '-' + calcExpr; calcShow(); return; }
    const m = /(\d+\.?\d*|\.\d+)$/.exec(calcExpr);
    if(!m) return;
    const pre = calcExpr.slice(0, m.index), b = pre[pre.length-1];
    if(b==='-' && (pre.length===1 || '(×÷'.includes(pre[pre.length-2]))) calcExpr = pre.slice(0,-1) + m[0];
    else if(b==='-') calcExpr = pre.slice(0,-1) + '+' + m[0];
    else if(b==='+') calcExpr = pre.slice(0,-1) + '-' + m[0];
    else calcExpr = pre + '-' + m[0];
    calcShow(); return;
  }
  if(v==='^' || v==='^2'){
    calcFresh = false;
    if(/[\d)%π]$/.test(calcExpr)) calcExpr += v;
    calcShow(); return;
  }
  if(v==='π' || v.length > 1){ // π, sin(, cos(, tan(, √(
    if(calcFresh){ calcExpr = '0'; calcFresh = false; }
    if(calcExpr==='0') calcExpr = v;
    else calcExpr += (/[\d.)%π]$/.test(calcExpr) ? '×' : '') + v;
    calcShow(); return;
  }
  if(calcFresh){
    if(isOp(v) || v==='%'){ calcFresh = false; } // продолжаем с результата
    else { calcExpr = '0'; calcFresh = false; }
  }
  if(isOp(v)){
    if(calcExpr==='0' && v==='-'){ calcExpr = '-'; calcShow(); return; }
    if(isOp(last())){
      if(v==='-' && (last()==='×' || last()==='÷')) calcExpr += v;
      else if(calcExpr.length>1 && isOp(calcExpr[calcExpr.length-2]) && last()==='-') calcExpr = calcExpr.slice(0,-2) + v;
      else calcExpr = calcExpr.slice(0,-1) + v;
    } else if(last()==='('){
      if(v==='-') calcExpr += v;
    } else calcExpr += v;
    calcShow(); return;
  }
  if(v==='('){
    if(calcExpr==='0') calcExpr = '(';
    else if(/[\d.)%π]/.test(last())) calcExpr += '×(';
    else calcExpr += '(';
    calcShow(); return;
  }
  if(v===')'){
    const open = (calcExpr.match(/\(/g)||[]).length - (calcExpr.match(/\)/g)||[]).length;
    if(open > 0 && /[\d)%π]/.test(last())) calcExpr += ')';
    calcShow(); return;
  }
  if(v==='%'){
    if(/[\d)]/.test(last())) calcExpr += '%';
    calcShow(); return;
  }
  // цифра или точка
  const lastNum = /(\d*\.?\d*)$/.exec(calcExpr)[1];
  if(v==='.'){
    if(lastNum.includes('.')) return;
    if(/[)%π]/.test(last())) return;
    calcExpr += (lastNum==='' ? '0.' : '.');
  } else {
    if(/[)%π]/.test(last())) calcExpr += '×';
    if(lastNum==='0') calcExpr = calcExpr.slice(0,-1) + v;
    else calcExpr += v;
  }
  calcShow();
}
function calcAddHistory(expr, result, num){
  const hist = document.getElementById('calc-history');
  const row = document.createElement('div');
  row.dataset.expr = expr; row.dataset.res = result;
  const a = document.createElement('span'); a.textContent = expr;
  const b = document.createElement('b'); b.textContent = result;
  row.append(a, b);
  const nm = num !== undefined ? num : result;
  row.onclick = () => { calcExpr = nm; calcFresh = true; calcRaw = parseFloat(nm); calcShow(); };
  hist.appendChild(row);
  hist.scrollTop = hist.scrollHeight;
}
function calcSetResult(expr, result){
  calcRaw = result; calcExpr = calcFmt(result); calcFresh = true; calcShow();
  calcAddHistory(expr, calcFmtOut(result), calcFmt(result));
}

// ── Дизайн-инструменты ──
function calcArea(){
  const l = parseFloat(document.getElementById('calc-area-l').value)||0;
  const w = parseFloat(document.getElementById('calc-area-w').value)||0;
  calcSetResult(`Площадь ${l}×${w} м =`, l*w);
}
function calcUnit(){
  const val = parseFloat(document.getElementById('calc-unit-val').value)||0;
  const dir = document.getElementById('calc-unit-dir').value;
  const res = dir==='cm2m' ? val/100 : val*100;
  calcSetResult(`${val} ${dir==='cm2m'?'см → м':'м → см'} =`, res);
}
function calcMarkup(){
  const sum = parseFloat(document.getElementById('calc-markup-sum').value)||0;
  const pct = parseFloat(document.getElementById('calc-markup-pct').value)||0;
  const dir = document.getElementById('calc-markup-dir').value;
  const res = dir==='up' ? sum*(1+pct/100) : sum*(1-pct/100);
  calcSetResult(`${sum} ${dir==='up'?'+ наценка':'− скидка'} ${pct}% =`, res);
}
function calcPerimeter(){
  const a = parseFloat(document.getElementById('calc-perim-a').value)||0;
  const b = parseFloat(document.getElementById('calc-perim-b').value)||0;
  const roll = parseFloat(document.getElementById('calc-perim-roll').value)||0;
  const perim = 2*(a+b);
  if(roll>0){
    const rolls = Math.ceil(perim/roll);
    calcSetResult(`Периметр ${a}×${b} м, рулон ${roll} м → рулонов =`, rolls);
  } else {
    calcSetResult(`Периметр ${a}×${b} м =`, perim);
  }
}