
// ═══════════════════════════════════════════
//  ARCHIVE
// ═══════════════════════════════════════════
function openArchive() {
  const done=cards.filter(c=>c.status==='done');
  const el=document.getElementById('arch-info');
  if(!done.length){el.innerHTML='<span style="color:var(--t3)">Нет выполненных карточек.</span>';['arch-pdf','arch-xl','arch-del'].forEach(id=>document.getElementById(id).disabled=true);}
  else{el.innerHTML=`<strong style="font-size:16px">${done.length}</strong> карточек готово к архивированию<br><span style="color:var(--t3)">📷 С фото: ${done.filter(c=>(c.attachments||[]).some(a=>a.type?.startsWith('image/'))).length}</span>`;['arch-pdf','arch-xl','arch-del'].forEach(id=>document.getElementById(id).disabled=false);}
  document.getElementById('arch-ov').classList.add('on');
}
function closeArchive() { document.getElementById('arch-ov').classList.remove('on'); }

async function downloadPDF() {
  const done=cards.filter(c=>c.status==='done'); if(!done.length)return;
  const btn=document.getElementById('arch-pdf'); btn.textContent='⏳…'; btn.disabled=true;
  try {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=15,CW=W-M*2;
    let y=M;
    const chk=n=>{if(y+n>H-M){doc.addPage();y=M;}};
    doc.setFillColor(15,15,15);doc.rect(0,0,W,22,'F');
    doc.setTextColor(232,197,106);doc.setFontSize(16);doc.setFont(undefined,'bold');doc.text('Архив карточек',M,14);
    doc.setFontSize(10);doc.setFont(undefined,'normal');doc.setTextColor(136,136,136);doc.text(new Date().toLocaleDateString('ru-RU'),W-M,14,{align:'right'});
    y=30;
    for(const card of done){
      chk(28);
      const col=catColor(card.category);
      const r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
      const tlines=doc.splitTextToSize(card.title,CW-30);
      doc.setFontSize(13);doc.setFont(undefined,'bold');doc.setTextColor(r,g,b);
      doc.text(tlines,M,y+6);y+=tlines.length*6+4;
      doc.setFontSize(9);doc.setFont(undefined,'normal');doc.setTextColor(85,85,85);
      const meta=[card.created_at?'📅'+new Date(card.created_at+'T12:00:00').toLocaleDateString('ru-RU'):'',card.category?'🏷'+card.category:'',ST_LABELS[card.status]||''].filter(Boolean).join('  ');
      doc.text(meta,M,y+4);y+=8;
      if(card.body){const ls=doc.splitTextToSize(card.body,CW);chk(ls.length*5+4);doc.setFontSize(10);doc.setTextColor(170,170,170);doc.text(ls,M,y+4);y+=ls.length*5+6;}
      const entries=card.entries||[];
      if(entries.length){chk(6);doc.setFontSize(9);doc.setTextColor(85,85,85);doc.text('Записи:',M,y+4);y+=7;entries.forEach(e=>{chk(5);doc.text(`${e.done?'[✓]':'[ ]'} ${e.text} (${e.date})`,M+4,y+4);y+=5;});}
      const imgs=(card.attachments||[]).filter(a=>a.type?.startsWith('image/'));
      for(const img of imgs){try{const ie=new Image();await new Promise(res=>{ie.onload=res;ie.onerror=res;ie.src=img.data;});const ratio=ie.naturalWidth/ie.naturalHeight,iw=Math.min(CW,95),ih=iw/ratio;chk(ih+5);doc.addImage(img.data,img.type.includes('png')?'PNG':'JPEG',M,y,iw,ih);y+=ih+4;}catch{}}
      chk(5);doc.setDrawColor(40,40,40);doc.line(M,y+2,W-M,y+2);y+=7;
    }
    const tp=doc.internal.getNumberOfPages();for(let p=1;p<=tp;p++){doc.setPage(p);doc.setFontSize(8);doc.setTextColor(85,85,85);doc.text(`${p}/${tp}`,W/2,H-7,{align:'center'});}
    doc.save(`архив_${today()}.pdf`); toast('✓ PDF сохранён');
  }catch(e){toast('Ошибка PDF: '+e.message,true);}
  btn.textContent='📄 PDF'; btn.disabled=false;
}

function downloadExcel() {
  const done=cards.filter(c=>c.status==='done'); if(!done.length)return;
  const btn=document.getElementById('arch-xl'); btn.textContent='⏳…'; btn.disabled=true;
  try {
    const rows=done.map(c=>({'Дата':c.created_at||'','Заголовок':c.title||'','Заметка':c.body||'','Рубрика':c.category||'','Статус':ST_LABELS[c.status]||'','Мяч':c.ball==='mine'?'У меня':c.ball==='theirs'?'У них':'—','Приоритет':c.priority||'normal','Срок':c.deadline||'—','Фото':(c.attachments||[]).filter(a=>a.type?.startsWith('image/')).length,'Файлы':(c.attachments||[]).filter(a=>!a.type?.startsWith('image/')).map(f=>f.name).join(', ')||'—','Записи':(c.entries||[]).map(e=>(e.done?'[✓] ':'[ ] ')+e.text).join('\n')||'—','История последняя':(c.history||[]).slice(-1)[0]?.text||''}));
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows);
    ws['!cols']=[{wch:12},{wch:35},{wch:45},{wch:14},{wch:14},{wch:12},{wch:10},{wch:12},{wch:7},{wch:30},{wch:40},{wch:35}];
    XLSX.utils.book_append_sheet(wb,ws,'Архив');
    XLSX.writeFile(wb,`архив_${today()}.xlsx`); toast('✓ Excel сохранён');
  }catch(e){toast('Ошибка Excel: '+e.message,true);}
  btn.textContent='📊 Excel'; btn.disabled=false;
}

async function archiveDelete() {
  const done=cards.filter(c=>c.status==='done'); if(!done.length)return;
  if(!confirm(`Удалить ${done.length} карточек? Убедись что скачал файлы!`))return;
  const btn=document.getElementById('arch-del'); btn.textContent='⏳…'; btn.disabled=true;
  try {
    setSyncDot('sync');
    const {error}=await sb.from('cards').delete().in('id',done.map(c=>c.id));
    if(error)throw error;
    cards=cards.filter(c=>c.status!=='done');setSyncDot('ok');closeArchive();render();toast(`✓ Удалено ${done.length}`);
  }catch(e){toast('Ошибка: '+e.message,true);setSyncDot('err');}
  btn.textContent='🗑 Удалить выполненные из базы'; btn.disabled=false;
}

