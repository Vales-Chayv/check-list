// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);
const nowStr = () => new Date().toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };
const catColor = name => (cats.find(c=>c.name===name)||{}).color || '#666';

// ─── Оформление текста записей: разрешаем только жирный/подчёркивание/цвет/размер ───
// stripTags — убрать все теги, вернуть чистый текст (для превью карточки)
function stripTags(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return doc.body.textContent || '';
}
// sanitizeRich — оставить только разрешённое оформление, вырезать всё опасное (защита от XSS)
function sanitizeRich(html) {
  const okColor = v => /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-z]+)$/i.test(v);
  const okSize  = v => /^[\d.]+(px|em|rem|%|pt)$/i.test(v);
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  function walk(node) {
    let out = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { out += '<br>'; return; }
      if (tag === 'B' || tag === 'STRONG') { out += '<b>' + walk(n) + '</b>'; return; }
      if (tag === 'U') { out += '<u>' + walk(n) + '</u>'; return; }
      if (tag === 'SPAN') {
        let st = '';
        const c  = n.style.getPropertyValue('color');
        const fs = n.style.getPropertyValue('font-size');
        const fw = n.style.getPropertyValue('font-weight');
        const td = n.style.getPropertyValue('text-decoration');
        if (c  && okColor(c))  st += 'color:' + c + ';';
        if (fs && okSize(fs))  st += 'font-size:' + fs + ';';
        if (fw && /^(bold|[6-9]00)$/i.test(fw)) st += 'font-weight:bold;';
        if (td && /underline/i.test(td))        st += 'text-decoration:underline;';
        out += st ? '<span style="' + st + '">' + walk(n) + '</span>' : walk(n);
        return;
      }
      if (tag === 'FONT') {
        let st = '';
        const c  = n.getAttribute('color');
        const sz = n.getAttribute('size');
        if (c && okColor(c)) st += 'color:' + c + ';';
        if (sz)              st += 'font-size:1.3em;';
        out += st ? '<span style="' + st + '">' + walk(n) + '</span>' : walk(n);
        return;
      }
      out += walk(n); // неразрешённый тег → оставляем только его текст
    });
    return out;
  }
  return walk(doc.body);
}
// applyFmt — применить оформление к выделению в contenteditable (встроенный движок браузера)
function applyFmt(cmd, value) {
  document.execCommand(cmd, false, value || null);
}

function fmtDate(s) {
  const d=new Date(s+'T12:00:00'),t=today(),y=new Date(Date.now()-86400000).toISOString().slice(0,10);
  if(s===t)return'Сегодня'; if(s===y)return'Вчера';
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
}

function deadlineInfo(dl) {
  if(!dl) return null;
  const t=new Date(); t.setHours(0,0,0,0);
  const d=new Date(dl+'T00:00:00'), diff=Math.round((d-t)/86400000);
  if(diff<0) return {text:`⏰ Просрочено ${Math.abs(diff)}д.`,cls:'dl-now',days:diff};
  if(diff===0) return {text:'⏰ Сегодня!',cls:'dl-now',days:0};
  if(diff===1) return {text:'⏰ Завтра',cls:'dl-soon',days:1};
  if(diff<=3) return {text:`⏰ Через ${diff}д.`,cls:'dl-soon',days:diff};
  if(diff<=7) return {text:`⏰ ${diff}дн.`,cls:'dl-week',days:diff};
  return {text:`📅 ${d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}`,cls:'dl-ok',days:diff};
}

function setSyncDot(s) {
  const d=document.getElementById('sdot');
  d.className='sdot'+(s==='sync'?' sync':s==='err'?' err':'');
  d.title = s==='ok'?'Синхронизировано':s==='sync'?'Синхронизация...':'Офлайн — изменения сохранены локально';
}

function toast(msg, err=false) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(err?' err':'');
  t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),2500);
}

