// ═══════════════════════════════════════════
//  КАЛЬКУЛЯТОР (панель A на ПК)
// ═══════════════════════════════════════════

function openCalcMobile(){ document.getElementById('calc-ov').classList.add('on'); }
function closeCalcMobile(){ document.getElementById('calc-ov').classList.remove('on'); }
function toggleDesktopCalc(){
  document.body.classList.remove('cal-on');
  document.body.classList.toggle('calc-on');
}
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
  row.textContent = `${expr} ${result}`;
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