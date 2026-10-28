// ═══════════════════════════════════════════
//  КАЛЬКУЛЯТОР (панель A на ПК)
// ═══════════════════════════════════════════

function openCalcMobile(){ document.getElementById('calc-ov').classList.add('on'); }

function calcHasHistory(){ return (document.getElementById('calc-history')?.children.length || 0) > 0; }
function calcClearAll(){
  document.getElementById('calc-history').innerHTML = '';
  document.getElementById('calc-current').textContent = '0';
  calcAcc = null; calcOp = null; calcFresh = true;
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

// ── PDF: лента в печатный вид (в окне печати выбрать «Сохранить как PDF») ──
function calcExportPdf(){
  const rows = calcTapeRows();
  if(!rows.length){ toast('Лента пуста — нечего сохранять'); return; }
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear();
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

// ── Арифметика ──
let calcAcc = null, calcOp = null, calcFresh = true;
function calcFmt(n){ return Math.round(n*10000)/10000 + ''; }
function calcInput(v){
  const disp = document.getElementById('calc-current');
  let cur = disp.textContent;
  if(v==='C'){ calcAcc=null; calcOp=null; calcFresh=true; disp.textContent='0'; return; }
  if(v==='⌫'){
    if(calcFresh) return;
    cur = cur.length > 1 ? cur.slice(0,-1) : '0';
    if(cur === '-' ) cur = '0';
    disp.textContent = cur; return;
  }
  if(v==='±'){ disp.textContent = calcFmt(parseFloat(cur||'0') * -1); return; }
  if(v==='%'){ disp.textContent = calcFmt(parseFloat(cur||'0') / 100); return; }
  if(['+','-','×','÷'].includes(v)){
    if(calcAcc!==null && calcOp && !calcFresh) calcAcc = calcApply(calcAcc, parseFloat(cur), calcOp);
    else calcAcc = parseFloat(cur||'0');
    calcOp = v; calcFresh = true; return;
  }
  if(v==='='){
    if(calcOp!==null){
      const b = parseFloat(cur);
      const result = calcApply(calcAcc, b, calcOp);
      calcAddHistory(`${calcFmt(calcAcc)} ${calcOp} ${calcFmt(b)} =`, calcFmt(result));
      disp.textContent = calcFmt(result);
      calcAcc = null; calcOp = null; calcFresh = true;
    }
    return;
  }
  if(calcFresh || cur==='0'){ cur = (v==='.') ? '0.' : v; calcFresh=false; }
  else cur += v;
  disp.textContent = cur;
}
function calcApply(a,b,op){
  if(op==='+') return a+b;
  if(op==='-') return a-b;
  if(op==='×') return a*b;
  if(op==='÷') return b!==0 ? a/b : 0;
  return b;
}
function calcAddHistory(expr, result){
  const hist = document.getElementById('calc-history');
  const row = document.createElement('div');
  row.dataset.expr = expr; row.dataset.res = result;
  const a = document.createElement('span'); a.textContent = expr;
  const b = document.createElement('b'); b.textContent = result;
  row.append(a, b);
  row.onclick = () => { document.getElementById('calc-current').textContent = result; calcFresh = true; };
  hist.appendChild(row);
  hist.scrollTop = hist.scrollHeight;
}
function calcSetResult(expr, result){
  document.getElementById('calc-current').textContent = calcFmt(result);
  calcAddHistory(expr, calcFmt(result));
  calcFresh = true; calcAcc = null; calcOp = null;
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