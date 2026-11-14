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
  const rpr = (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') + (o.s ? '<w:strike/>' : '') + (o.vanish ? '<w:vanish/>' : '') +
    (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.size ? '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>' : '') +
    (o.u ? '<w:u w:val="single"/>' : '') + (o.rtl ? '<w:rtl/>' : '');
  return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + _XE(text) + '</w:t></w:r>';
}
function mcDocPara(inner, o) {
  o = o || {};
  return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') +
    (o.num ? '<w:numPr><w:ilvl w:val="' + (o.num.lvl || 0) + '"/><w:numId w:val="' + o.num.id + '"/></w:numPr>' : '') + // номер списка Word: при удалении записи Word сам перенумерует
    (o.divider ? '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="' + o.divider + '"/></w:pBdr>' : '') +
    (o.bidi ? '<w:bidi/>' : '') +
    '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 60 : o.after) + '"' + (o.line ? ' w:line="' + o.line + '" w:lineRule="exact"' : '') + '/>' +
    (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') + (o.vanish ? '<w:rPr><w:vanish/></w:rPr>' : '') + '</w:pPr>' + inner + '</w:p>';
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
// ═══ Настройки Word в облаке (таблица word_settings, файл word-settings.sql) ═══
// Одна строка на пользователя: data = { v, profile: {логотип, студия, слоган, сайт, автор, переключатели}, templates, defaults, values }.
// Локальная копия — localStorage 'mc_word_cfg' { data, ts, dirty }: работает без интернета, при связи сверяется с облаком (кто новее — тот и прав).
let _mcWord = null, _mcWordPulled = 0, _mcWordTimer = null;
function mcWordLocal() {
  if (_mcWord) return _mcWord;
  try { _mcWord = JSON.parse(localStorage.getItem('mc_word_cfg') || 'null'); } catch (e) { _mcWord = null; }
  if (!_mcWord || !_mcWord.data) { // перенос со старого места хранения (только это устройство)
    let old = null; try { old = JSON.parse(localStorage.getItem('mc_exp_prefs') || 'null'); } catch (e) {}
    _mcWord = { data: { v: 1, profile: old || {}, templates: [], defaults: {}, values: {} }, ts: old ? Date.now() : 0, dirty: !!old };
    mcWordStore();
  }
  return _mcWord;
}
function mcWordStore() { try { localStorage.setItem('mc_word_cfg', JSON.stringify(_mcWord)); } catch (e) { toast('Не удалось сохранить настройки Word на устройстве (логотип слишком большой?)', true); } }
async function mcWordUid() {
  try { const { data } = await sb.auth.getSession(); if (data && data.session && data.session.user) return data.session.user.id; } catch (e) {}
  return null;
}
async function mcWordPull() { // забрать из облака; если здесь новее — отправить
  const L = mcWordLocal();
  if (typeof sb === 'undefined' || !navigator.onLine) return false;
  const uid = await mcWordUid(); if (!uid) return false;
  try {
    const { data, error } = await sb.from('word_settings').select('data,updated_at').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    _mcWordPulled = Date.now();
    const rts = data ? Date.parse(data.updated_at) || 0 : 0;
    if (data && (!L.dirty || rts > L.ts)) { _mcWord = { data: data.data || {}, ts: rts, dirty: false }; mcWordStore(); return true; }
    if (L.dirty || !data) await mcWordPush();
    return false;
  } catch (e) { console.log('word_settings:', (e && e.message) || e); return false; }
}
async function mcWordPush() {
  const L = mcWordLocal();
  if (typeof sb === 'undefined' || !navigator.onLine) return;
  const uid = await mcWordUid(); if (!uid) return;
  const ts = new Date(L.ts || Date.now()).toISOString();
  try {
    const { error } = await sb.from('word_settings').upsert({ user_id: uid, data: L.data, updated_at: ts }, { onConflict: 'user_id' });
    if (error) throw error;
    L.dirty = false; mcWordStore();
  } catch (e) { console.log('word_settings push:', (e && e.message) || e); }
}
function mcWordSave(mut) { // изменить настройки: mut(data); сразу локально, в облако — через 1,5 с
  const L = mcWordLocal();
  mut(L.data); L.ts = Date.now(); L.dirty = true; mcWordStore();
  clearTimeout(_mcWordTimer); _mcWordTimer = setTimeout(mcWordPush, 1500);
}
window.addEventListener('online', () => { if (mcWordLocal().dirty) mcWordPush(); });
setTimeout(function tryPull() { if (typeof currentUser !== 'undefined' && currentUser) mcWordPull(); else setTimeout(tryPull, 5000); }, 4000);

// настройки оформления (логотип, студия, переключатели) — из облачных настроек Word
function mcExpPrefsLoad() {
  let p = {};
  try { p = JSON.parse(JSON.stringify(mcWordLocal().data.profile || {})); } catch (e) {}
  const r = Object.assign({ logo: '', studio: '', slogan: '', site: '', author: '', names: 'show', dates: 'show', divider: true, divColor: '#B8892B', checks: true, signs: false }, p);
  if (p.showNames === false && !p.names) r.names = 'none'; // старое сохранённое значение
  delete r.showNames;
  return r;
}
function mcExpPrefsSave(p) { mcWordSave(d => { d.profile = Object.assign({}, p); }); }
// логотип → маленький PNG (с прозрачностью) в виде data URL
async function mcLogoFromFile(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 320 / bmp.height, 900 / bmp.width);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c.toDataURL('image/png');
}

// ═══ Шаблоны Word: 7 готовых + свои; язык, поля, шапка и подвал, подписи (решения А–Е, 13 ноября) ═══
const WT_L = { // текст шаблона на трёх языках (записи не переводятся)
  ru: { n: 'Русский', page: 'Стр. {p} из {n}', conf: 'Документ конфиденциален. Копирование и передача без согласия автора запрещены.', fio: 'ФИО', fix: ['Устранено', 'Не устранено'], buy: ['Куплено', 'Купить'], prog: '{d} из {n} выполнено', att: 'Вложения карточки', nosec: 'Без раздела', unav: 'файл недоступен (удалён из облака или нет сети)', cmp: ['Фото', 'Видео', 'Голосовое', 'Файл'], of: 'из', res: 'устранено', bought: 'куплено' },
  he: { n: 'עברית', page: 'עמ׳ {p} מתוך {n}', conf: 'מסמך חסוי. אין להעתיק או להעביר ללא אישור המחבר.', fio: 'שם מלא', fix: ['תוקן', 'לא תוקן'], buy: ['נקנה', 'לקנות'], prog: '{d} מתוך {n} בוצעו', att: 'קבצים מצורפים לכרטיס', nosec: 'ללא חלק', unav: 'הקובץ לא זמין', cmp: ['תמונה', 'וידאו', 'הקלטה', 'קובץ'], of: 'מתוך', res: 'תוקנו', bought: 'נקנו' },
  en: { n: 'English', page: 'Page {p} of {n}', conf: 'Confidential. Do not copy or share without the author\'s permission.', fio: 'Name', fix: ['Resolved', 'Open'], buy: ['Bought', 'To buy'], prog: '{d} of {n} done', att: 'Card attachments', nosec: 'No section', unav: 'file unavailable', cmp: ['Photo', 'Video', 'Voice', 'File'], of: 'of', res: 'resolved', bought: 'bought' }
};
const WT_F = { // поля таблицы под заголовком: a — заполняется само, m — вручную (запоминается для кабинета)
  obj: ['m', 'Объект', 'פרויקט', 'Project'], addr: ['m', 'Адрес', 'כתובת', 'Address'], cust: ['m', 'Заказчик', 'מזמין', 'Client'],
  contr: ['m', 'Подрядчик', 'קבלן', 'Contractor'], stage: ['m', 'Этап работ', 'שלב עבודה', 'Work stage'], deadline: ['m', 'Срок устранения', 'מועד לתיקון', 'Fix by'],
  budget: ['m', 'Бюджет', 'תקציב', 'Budget'], supp: ['m', 'Поставщик', 'ספק', 'Supplier'], place: ['m', 'Место', 'מקום', 'Place'],
  part: ['m', 'Участники', 'משתתפים', 'Participants'], next: ['m', 'Следующая встреча', 'פגישה הבאה', 'Next meeting'],
  date: ['a', 'Дата', 'תאריך', 'Date'], author: ['a', 'Составил(а)', 'נערך ע״י', 'Prepared by'], count: ['a', 'Записей', 'רשומות', 'Entries'],
  visit: ['a', 'Дата визита', 'תאריך ביקור', 'Visit date'], meetdate: ['a', 'Дата встречи', 'תאריך פגישה', 'Meeting date'],
  issues: ['a', 'Замечаний', 'ליקויים', 'Issues'], items: ['a', 'Позиций', 'פריטים', 'Items'], period: ['a', 'Период', 'תקופה', 'Period'],
  stages: ['a', 'Этапов', 'שלבים', 'Stages'], progress: ['a', 'Готово', 'הושלם', 'Completed'], cab: ['a', 'Кабинет', 'תיק', 'Workspace'], rub: ['a', 'Рубрика', 'קטגוריה', 'Category']
};
const WT_R = { exe: ['Исполнитель', 'מבצע', 'Prepared by'], cli: ['Заказчик', 'מזמין', 'Client'], sup: ['Технадзор', 'מפקח', 'Site supervisor'], con: ['Подрядчик', 'קבלן', 'Contractor'], arch: ['Архитектор / дизайнер', 'אדריכל / מעצב', 'Architect / designer'], appr: ['Утверждаю', 'מאשר', 'Approved by'] };
const WT_LI = { ru: 1, he: 2, en: 3 };
const wtFieldLabel = (f, lang) => f.label || (WT_F[f.k] ? WT_F[f.k][WT_LI[lang] || 1] : f.k);
const wtRoleLabel = (r, lang) => typeof r === 'object' ? r.label : (WT_R[r] ? WT_R[r][(WT_LI[lang] || 1) - 1] : r);
const wtH = (logo, contacts, gold, page, conf) => ({ logo, contacts, gold, page, conf, confText: '' });
const wtF = ks => ks.map(k => ({ k }));
const WT_BUILT = [
  { id: 'visit', name: 'Отчёт о визите на объект', title: { ru: 'Отчёт о визите на объект', he: 'דו״ח ביקור באתר', en: 'Site visit report' }, fields: wtF(['obj', 'addr', 'cust', 'visit', 'date', 'author', 'count']), mark: 'chk', sigs: ['exe', 'cli'], head: wtH('left', 'both', true, 'pof', false) },
  { id: 'tech', name: 'Акт технадзора', title: { ru: 'Акт технадзора', he: 'פרוטוקול פיקוח', en: 'Site supervision report' }, fields: wtF(['obj', 'addr', 'contr', 'stage', 'deadline', 'date', 'author', 'issues']), mark: 'fix', sigs: ['sup', 'con', 'cli'], head: wtH('left', 'head', true, 'pof', true) },
  { id: 'buy', name: 'Список закупок', title: { ru: 'Список закупок', he: 'רשימת רכש', en: 'Purchase list' }, fields: wtF(['obj', 'budget', 'supp', 'date', 'author', 'items']), mark: 'buy', sigs: [], head: wtH('left', 'foot', false, 'p', false) },
  { id: 'meet', name: 'Протокол встречи', title: { ru: 'Протокол встречи', he: 'פרוטוקול פגישה', en: 'Meeting minutes' }, fields: wtF(['meetdate', 'place', 'part', 'next', 'author']), mark: 'none', sigs: ['exe', 'cli'], head: wtH('center', 'foot', true, 'pof', true) },
  { id: 'progress', name: 'Отчёт о ходе проекта', title: { ru: 'Отчёт о ходе проекта', he: 'דו״ח התקדמות פרויקט', en: 'Project progress report' }, fields: wtF(['obj', 'cust', 'period', 'stages', 'progress', 'date', 'author']), mark: 'chk', sigs: ['exe'], head: wtH('center', 'head', true, 'pof', false) },
  { id: 'clean', name: 'Чистый лист', title: { ru: '', he: '', en: '' }, fields: [], mark: 'none', sigs: [], head: wtH('none', 'none', false, 'pof', false) },
  { id: 'blank', name: 'Свой шаблон с нуля', title: { ru: '', he: '', en: '' }, fields: wtF(['date', 'author']), mark: 'chk', sigs: [], head: wtH('left', 'both', true, 'pof', false) }
];
function wtEntryDefaults(P) { return { names: P.names || 'show', dates: P.dates || 'show', divider: P.divider !== false, divColor: P.divColor || '#B8892B' }; }
function wtList() { // готовые (с сохранёнными изменениями) + свои
  const d = mcWordLocal().data, over = d.over || {}, P = d.profile || {};
  const built = WT_BUILT.map(t => Object.assign({ lang: 'ru' }, JSON.parse(JSON.stringify(t)), { ent: wtEntryDefaults(P) }, over[t.id] ? JSON.parse(JSON.stringify(over[t.id])) : {}, { id: t.id, builtin: true }));
  return built.concat((d.templates || []).map(t => JSON.parse(JSON.stringify(t))));
}
function wtPickDefault(card, space) {
  const d = mcWordLocal().data, df = d.defaults || {}, ids = new Set(wtList().map(t => t.id));
  const r = (df.rub || {})[space + '||' + (card.category || '')], c = (df.cab || {})[space];
  if (card.category && r && ids.has(r)) return r;
  if (c && ids.has(c)) return c;
  return ids.has(d.last) ? d.last : 'visit';
}
const wtPad = x => String(x).padStart(2, '0');
function wtFmtDate(dt, lang) { return wtPad(dt.getDate()) + (lang === 'ru' ? '.' : '/') + wtPad(dt.getMonth() + 1) + (lang === 'ru' ? '.' : '/') + dt.getFullYear(); }
function wtEntryDate(e) { // дата записи: из id (время создания) или из текста «12 нояб., 14:30»
  const t = mcEntryTs(e); if (t) return new Date(t);
  const m = /(\d{1,2})\s+([а-яё]{3})/i.exec(e.date || ''); if (!m) return null;
  const k = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'].findIndex(x => m[2].toLowerCase().startsWith(x.slice(0, 3)));
  if (k < 0) return null; const n = new Date(), d = new Date(n.getFullYear(), k, +m[1]); if (d > n) d.setFullYear(d.getFullYear() - 1); return d;
}
function wtAutoVal(k, ctx) { // ctx: {lang, P, card, sel:[entries], sections, space}
  const L = WT_L[ctx.lang], ds = ctx.sel.map(wtEntryDate).filter(Boolean).sort((a, b) => a - b);
  const done = ctx.sel.filter(e => e.done).length, n = ctx.sel.length;
  switch (k) {
    case 'date': return wtFmtDate(new Date(), ctx.lang);
    case 'author': return ctx.P.author || '';
    case 'count': return String(n);
    case 'visit': case 'meetdate': return ds.length ? wtFmtDate(ds[0], ctx.lang) : '';
    case 'issues': return n ? n + ', ' + L.res + ': ' + done : '';
    case 'items': return n ? n + ', ' + L.bought + ': ' + done : '';
    case 'period': return ds.length ? wtFmtDate(ds[0], ctx.lang) + (ds.length > 1 && +ds[ds.length - 1] !== +ds[0] ? ' – ' + wtFmtDate(ds[ds.length - 1], ctx.lang) : '') : '';
    case 'stages': return ctx.sections ? String(ctx.sections) : '';
    case 'progress': return n ? done + ' ' + L.of + ' ' + n : '';
    case 'cab': { const sp = (typeof spaces !== 'undefined' ? spaces : []).find(s => s.id === ctx.space); return sp ? sp.name || '' : ''; }
    case 'rub': return ctx.card.category || '';
  }
  return '';
}

function mcExportCardWord(cardId, ready, _fresh) { // ready — готовая «карточка» (например, месяц из хранилища «Выполненных»)
  if (!_fresh && navigator.onLine && Date.now() - _mcWordPulled > 60000) { // сначала свежие настройки из облака (не дольше 2,5 с)
    if (window._mcExporting || document.getElementById('mc-exp-ov')) return;
    toast('Загружаю настройки Word…');
    Promise.race([mcWordPull(), new Promise(r => setTimeout(r, 2500))]).finally(() => mcExportCardWord(cardId, ready, true));
    return;
  }
  const card = ready || ((typeof cards !== 'undefined') && cards.find(c => c.id === cardId));
  if (!card) return;
  if (typeof JSZip === 'undefined') { toast('Модуль архивов не загрузился. Проверьте интернет и обновите страницу', true); return; }
  if (window._mcExporting || document.getElementById('mc-exp-ov')) return;
  const list = mcExportEntries(card);
  const cardAttCount = (card.attachments || []).filter(a => a && a.data).length;
  if (!list.length && !cardAttCount) { toast('В карточке нет записей и вложений', true); return; }
  const P = mcExpPrefsLoad();
  if (!P.author && typeof currentUser !== 'undefined' && currentUser && currentUser.display_name) P.author = currentUser.display_name;
  const space = card.space_id || (typeof currentSpaceId !== 'undefined' && currentSpaceId) || 'personal';
  const spName = ((typeof spaces !== 'undefined' ? spaces : []).find(s => s.id === space) || {}).name || 'Личный';
  const W = mcWordLocal().data;
  const vals = Object.assign({}, (W.values || {})[space] || {}); // вписанное вручную для этого кабинета
  const over = {}; // правка авто-значений только для этой выгрузки
  let T = wtList().find(t => t.id === wtPickDefault(card, space)) || wtList()[0];
  let lang = T.lang || 'ru', tab = 'ent';
  let docTitle = card.title || '';
  const checked = new Set(list.map(x => x.e.id));
  let order = 'asc';
  const GR = card.entryGroups || [];
  const grpName = e => ((GR.find(g => g.id === e.groupId) || {}).name) || '';
  const ov = document.createElement('div');
  ov.id = 'mc-exp-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;font-family:inherit';
  const bs = 'background:var(--s2);color:var(--t1);border:1px solid var(--b1);border-radius:8px;padding:7px 11px;font-size:13px;cursor:pointer;font-family:inherit';
  const is = 'background:var(--s2);color:var(--t1);border:1px solid var(--b1);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;width:100%;box-sizing:border-box';
  const lab = t => '<div style="font-size:12px;color:var(--t3);margin:10px 0 4px">' + t + '</div>';
  const seg = (name, cur, opts) => '<div style="display:flex;border-radius:8px;overflow:hidden;flex-wrap:wrap">' + opts.map((o, i) => '<button data-seg="' + name + '" data-v="' + o[0] + '" style="flex:1;padding:7px 6px;font-size:12.5px;cursor:pointer;font-family:inherit;border:1px solid ' + (cur === o[0] ? 'var(--accent)' : 'var(--b1)') + ';background:' + (cur === o[0] ? 'var(--accent)' : 'var(--s2)') + ';color:' + (cur === o[0] ? '#0f0f0f' : 'var(--t2)') + ';font-weight:' + (cur === o[0] ? 700 : 400) + '">' + o[1] + '</button>').join('') + '</div>';
  ov.innerHTML = '<div style="background:var(--s1);color:var(--t1);border:1px solid var(--b1);border-radius:14px;width:min(600px,100%);max-height:94vh;display:flex;flex-direction:column;box-sizing:border-box">' +
    '<div style="padding:14px 18px 4px;font-size:17px;font-weight:700">📄 Выгрузка в Word</div>' +
    '<div style="padding:4px 18px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select id="mc-exp-tpl" style="' + is + ';flex:1;min-width:200px;width:auto"></select><div id="mc-exp-lang" style="min-width:210px"></div></div>' +
    '<div id="mc-exp-tabs" style="padding:8px 18px 0;display:flex;gap:5px;flex-wrap:wrap"></div>' +
    '<div id="mc-exp-pane" style="overflow:auto;flex:1;min-height:0;padding:4px 18px 8px"></div>' +
    '<div style="padding:8px 18px;border-top:1px solid var(--b1);font-size:12.5px;display:flex;gap:12px;flex-wrap:wrap;align-items:center"><span style="color:var(--t3)">По умолчанию:</span>' +
      '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="mc-exp-dcab"> для кабинета «' + _XE(spName) + '»</label>' +
      (card.category ? '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="mc-exp-drub"> для рубрики «' + _XE(card.category) + '»</label>' : '') + '</div>' +
    '<div style="padding:8px 18px 14px;display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap"><span id="mc-exp-cnt" style="margin-right:auto;font-size:13px;color:var(--t3)"></span>' +
      '<button id="mc-exp-save" style="' + bs + '">💾 Сохранить шаблон</button><button id="mc-exp-saveas" style="' + bs + '">⭐ Как новый</button>' +
      '<button id="mc-exp-x" style="' + bs + ';padding:10px 14px;font-size:14px">Отмена</button>' +
      '<button id="mc-exp-go" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Выгрузить</button></div></div>';
  document.body.appendChild(ov);
  const $ = id => ov.querySelector('#' + id);
  const sorted = () => list.slice().sort((a, b) => (order === 'asc' ? 1 : -1) * ((a.ts - b.ts) || (a.i - b.i)));
  const plain = e => { const t = mcRichToParts(e.text || e.sessionNote || '').map(x => x.br ? ' ' : (x.t || '')).join('').trim(); return t.length > 70 ? t.slice(0, 68) + '…' : (t || '(без текста)'); };
  const ctx = () => ({ lang, P, card, space, sel: list.filter(x => checked.has(x.e.id)).map(x => x.e), sections: GR.length ? new Set(list.filter(x => checked.has(x.e.id)).map(x => GR.some(g => g.id === x.e.groupId) ? x.e.groupId : '__none')).size : 0 });
  function head() {
    const L = wtList();
    $('mc-exp-tpl').innerHTML = '<optgroup label="Шаблоны">' + L.filter(t => t.builtin).map(t => '<option value="' + t.id + '"' + (t.id === T.id ? ' selected' : '') + '>' + _XE(t.name) + '</option>').join('') + '</optgroup>' +
      (L.some(t => !t.builtin) ? '<optgroup label="Мои шаблоны">' + L.filter(t => !t.builtin).map(t => '<option value="' + t.id + '"' + (t.id === T.id ? ' selected' : '') + '>⭐ ' + _XE(t.name) + '</option>').join('') + '</optgroup>' : '');
    $('mc-exp-lang').innerHTML = seg('lang', lang, [['ru', 'Русский'], ['he', 'עברית'], ['en', 'English']]);
    const tabs = [['ent', 'Записи'], ['fld', 'Поля'], ['hd', 'Шапка и подвал'], ['sig', 'Подписи']];
    $('mc-exp-tabs').innerHTML = tabs.map(t => '<button data-tab="' + t[0] + '" style="' + bs + (tab === t[0] ? ';background:var(--accent);color:#0f0f0f;border-color:var(--accent);font-weight:700' : '') + '">' + t[1] + '</button>').join('');
    const df = W.defaults || {};
    $('mc-exp-dcab').checked = (df.cab || {})[space] === T.id;
    if ($('mc-exp-drub')) $('mc-exp-drub').checked = (df.rub || {})[space + '||' + card.category] === T.id;
    $('mc-exp-save').textContent = T.builtin ? '💾 Сохранить изменения' : '💾 Сохранить шаблон';
  }
  function pane() {
    const p = $('mc-exp-pane'), E = T.ent, H = T.head;
    if (tab === 'ent') {
      p.innerHTML = '<div style="font-size:12.5px;color:var(--t3);margin:6px 0">Вместе с документом скачается папка files с фото, роликами и голосовыми. Текст записей не переводится.</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button data-q="all" style="' + bs + '">Все</button><button data-q="none" style="' + bs + '">Ничего</button><button data-q="done" style="' + bs + '">Только ☑ отмеченные</button><button data-q="open" style="' + bs + '">Только без отметки</button>' +
        '<select id="mc-exp-ord" style="' + bs + '"><option value="asc"' + (order === 'asc' ? ' selected' : '') + '>Сначала старые</option><option value="desc"' + (order === 'desc' ? ' selected' : '') + '>Сначала новые</option></select></div>' +
        (GR.length ? '<div style="font-size:12px;color:var(--t3);margin-top:6px">Разделы (нажмите, чтобы выбрать или снять все записи раздела):</div><div id="mc-exp-grp" style="padding:4px 0;display:flex;gap:6px;flex-wrap:wrap"></div>' : '') +
        '<div id="mc-exp-list" style="max-height:210px;overflow:auto;margin-top:4px"></div>' +
        (cardAttCount ? '<label style="padding:6px 0;font-size:14px;display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="mc-exp-card"' + (T._wc === false ? '' : ' checked') + '> Вложения самой карточки (' + cardAttCount + ')</label>' : '') +
        lab('Отметка у записи') + seg('mark', T.mark, [['chk', '☑ / ☐'], ['fix', WT_L[lang].fix.join(' / ')], ['buy', WT_L[lang].buy.join(' / ')], ['none', 'Без отметки']]) +
        lab('Дата и время записи') + seg('dates', E.dates, [['show', 'Показывать'], ['none', 'Нет'], ['hidden', 'Скрыто (¶ в Word)']]) +
        lab('Названия файлов под фото') + seg('names', E.names, [['show', 'Показывать'], ['none', 'Нет'], ['hidden', 'Скрыто (¶ в Word)']]) +
        '<div style="display:flex;gap:10px;align-items:center;padding:8px 0 2px"><label style="display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer"><input type="checkbox" id="mc-exp-div"' + (E.divider ? ' checked' : '') + '> Разделитель между записями, цвет:</label><input type="color" id="mc-exp-divc" value="' + _XE(E.divColor || '#B8892B') + '" style="width:44px;height:30px;border:1px solid var(--b1);border-radius:6px;background:var(--s2);padding:2px;cursor:pointer"></div>';
      renderList();
    } else if (tab === 'fld') {
      const c = ctx();
      p.innerHTML = lab('Название документа') + '<input id="mc-exp-title" style="' + is + '" value="' + _XE(docTitle) + '" dir="auto">' +
        '<div style="font-size:12px;color:var(--t3);margin:10px 0 4px;line-height:1.5"><span style="color:#8fb8e8">Синие</span> поля заполняются сами — значение можно поправить для этой выгрузки. <span style="color:var(--accent)">Жёлтые</span> вписываются вручную и запоминаются для кабинета «' + _XE(spName) + '». Пустое поле в документ не попадает.</div>' +
        T.fields.map((f, i) => {
          const auto = !f.label && WT_F[f.k] && WT_F[f.k][0] === 'a';
          const v = auto ? (over[f.k] != null ? over[f.k] : wtAutoVal(f.k, c)) : (vals[f.k] || '');
          return '<div style="display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--b1)"><span style="width:130px;font-size:13px;color:' + (auto ? '#8fb8e8' : 'var(--accent)') + '">' + _XE(wtFieldLabel(f, lang)) + '</span>' +
            '<input data-fld="' + i + '" style="' + is + ';flex:1;padding:6px 8px" value="' + _XE(v) + '" placeholder="' + (auto ? 'заполнится само' : 'вписать') + '" dir="auto">' +
            '<button data-up="' + i + '" title="Выше" style="' + bs + ';padding:5px 8px">↑</button><button data-rm="' + i + '" title="Убрать поле" style="' + bs + ';padding:5px 8px;color:#e06060">✕</button></div>';
        }).join('') +
        lab('Добавить поле') + '<div style="display:flex;gap:6px"><select id="mc-exp-addf" style="' + is + ';flex:1"><option value="">＋ выбрать…</option>' + Object.keys(WT_F).filter(k => !T.fields.some(f => f.k === k && !f.label)).map(k => '<option value="' + k + '">' + _XE(WT_F[k][1]) + (WT_F[k][0] === 'a' ? ' (само)' : '') + '</option>').join('') + '</select><button id="mc-exp-addc" style="' + bs + '">＋ Своё поле</button></div>';
    } else if (tab === 'hd') {
      p.innerHTML = lab('Логотип') + '<div style="display:flex;gap:8px;align-items:center"><img id="mc-exp-logo-img" style="height:40px;max-width:120px;object-fit:contain;display:none;background:#fff;border-radius:6px;padding:2px"><button id="mc-exp-logo-btn" style="' + bs + '">Выбрать файл…</button><button id="mc-exp-logo-del" style="' + bs + ';display:none">Убрать</button><input type="file" id="mc-exp-logo-file" accept="image/*" style="display:none"></div>' +
        lab('Название студии или компании') + '<input id="mc-exp-studio" style="' + is + '" value="' + _XE(P.studio) + '" dir="auto">' +
        lab('Слоган') + '<input id="mc-exp-slogan" style="' + is + '" value="' + _XE(P.slogan) + '" dir="auto">' +
        lab('Сайт или контакты') + '<input id="mc-exp-site" style="' + is + '" value="' + _XE(P.site) + '">' +
        lab('Составил(а)') + '<input id="mc-exp-author" style="' + is + '" value="' + _XE(P.author) + '" dir="auto">' +
        '<div style="font-size:12px;color:var(--t3);margin:4px 0 0">Логотип, студия, слоган, контакты и автор общие для всех шаблонов. Ниже — вид этого шаблона.</div>' +
        lab('Шапка (на 1-й странице; на следующих — тонкая строка «студия · название»)') + seg('logo', H.logo, [['left', 'Логотип слева'], ['center', 'По центру'], ['none', 'Без шапки']]) +
        lab('Контакты') + seg('contacts', H.contacts, [['head', 'В шапке'], ['foot', 'В подвале'], ['both', 'И там, и там'], ['none', 'Нигде']]) +
        '<label style="display:flex;gap:8px;align-items:center;font-size:14px;padding:8px 0 0;cursor:pointer"><input type="checkbox" id="mc-exp-gold"' + (H.gold ? ' checked' : '') + '> Золотая линия под шапкой</label>' +
        lab('Номер страницы') + seg('page', H.page, [['pof', WT_L[lang].page.replace('{p}', '1').replace('{n}', '3')], ['p', '1'], ['no', 'Без номера']]) +
        '<label style="display:flex;gap:8px;align-items:center;font-size:14px;padding:8px 0 0;cursor:pointer"><input type="checkbox" id="mc-exp-conf"' + (H.conf ? ' checked' : '') + '> Строка о конфиденциальности в подвале</label>' +
        '<input id="mc-exp-conft" style="' + is + ';margin-top:6px' + (H.conf ? '' : ';display:none') + '" value="' + _XE(H.confText || '') + '" placeholder="' + _XE(WT_L[lang].conf) + '" dir="auto">';
      showLogo();
    } else if (tab === 'sig') {
      p.innerHTML = '<div style="font-size:12.5px;color:var(--t3);margin:6px 0">Подписи в конце документа: роль и строка «' + WT_L[lang].fio + ': ________» для имени от руки. До трёх подписей.</div>' +
        (T.sigs.length ? T.sigs.map((r, i) => '<div style="display:flex;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--b1)"><span style="flex:1;font-size:14px" dir="auto">' + _XE(wtRoleLabel(r, lang)) + '</span><button data-srm="' + i + '" style="' + bs + ';padding:5px 8px;color:#e06060">✕</button></div>').join('') : '<div style="font-size:13px;color:var(--t3);padding:6px 0">Подписей нет</div>') +
        (T.sigs.length < 3 ? lab('Добавить подпись') + '<div style="display:flex;gap:6px"><select id="mc-exp-adds" style="' + is + ';flex:1"><option value="">＋ выбрать…</option>' + Object.keys(WT_R).filter(k => !T.sigs.includes(k)).map(k => '<option value="' + k + '">' + _XE(WT_R[k][0]) + '</option>').join('') + '</select><button id="mc-exp-addsc" style="' + bs + '">＋ Своя роль</button></div>' : '');
    }
  }
  function renderList() {
    const box = $('mc-exp-list'); if (!box) return;
    box.innerHTML = sorted().map(x => {
      const na = (x.e.sessionAtts || []).length + (x.e.attachments || []).length;
      return '<label style="display:flex;gap:9px;align-items:flex-start;padding:7px 6px;border-bottom:1px solid var(--b1);cursor:pointer;font-size:14px">' +
        '<input type="checkbox" data-id="' + _XE(x.e.id) + '"' + (checked.has(x.e.id) ? ' checked' : '') + ' style="margin-top:3px">' +
        '<span style="flex:1;min-width:0;word-break:break-word" dir="auto">' + (x.e.done ? '☑ ' : '') + _XE(plain(x.e)) + '</span>' +
        '<span style="font-size:12px;color:var(--t3);white-space:nowrap;max-width:45%;overflow:hidden;text-overflow:ellipsis;flex-shrink:1">' + (grpName(x.e) ? '▸ ' + _XE(grpName(x.e)) + ' · ' : '') + _XE(x.e.date || '') + (na ? ' · 📎' + na : '') + '</span></label>';
    }).join('') || '<div style="padding:10px;color:var(--t3);font-size:13px">Записей нет</div>';
    count();
  }
  function count() { $('mc-exp-cnt').textContent = 'Записей: ' + checked.size + ' из ' + list.length; paintGrp(); }
  function paintGrp() {
    const box = $('mc-exp-grp'); if (!box) return;
    const keys = [...GR.map(g => g.id), ...(list.some(x => !GR.some(g => g.id === x.e.groupId)) ? ['__none'] : [])];
    box.innerHTML = keys.map(k => {
      const its = list.filter(x => k === '__none' ? !GR.some(g => g.id === x.e.groupId) : x.e.groupId === k); if (!its.length) return '';
      const on = its.filter(x => checked.has(x.e.id)).length, all = on === its.length;
      const nm = k === '__none' ? 'Без раздела' : (((GR.find(g => g.id === k) || {}).name) || 'Без названия');
      return '<button data-grp="' + _XE(k) + '" style="' + bs + (all ? ';background:var(--accent);color:#0f0f0f;border-color:var(--accent)' : on ? ';border-color:var(--accent);color:var(--accent)' : '') + '">' + _XE(nm) + ' · ' + on + '/' + its.length + '</button>';
    }).join('');
  }
  function showLogo() { const im = $('mc-exp-logo-img'); if (!im) return; if (P.logo) { im.src = P.logo; im.style.display = ''; $('mc-exp-logo-del').style.display = ''; } else { im.style.display = 'none'; $('mc-exp-logo-del').style.display = 'none'; } }
  function grab() { // забрать введённое на открытой вкладке
    const v = id => $(id) ? $(id).value : null;
    if ($('mc-exp-title')) docTitle = v('mc-exp-title');
    if ($('mc-exp-studio')) Object.assign(P, { studio: v('mc-exp-studio').trim(), slogan: v('mc-exp-slogan').trim(), site: v('mc-exp-site').trim(), author: v('mc-exp-author').trim() });
    if ($('mc-exp-div')) Object.assign(T.ent, { divider: $('mc-exp-div').checked, divColor: v('mc-exp-divc') });
    if ($('mc-exp-card')) T._wc = $('mc-exp-card').checked;
    if ($('mc-exp-gold')) Object.assign(T.head, { gold: $('mc-exp-gold').checked, conf: $('mc-exp-conf').checked, confText: v('mc-exp-conft').trim() });
    ov.querySelectorAll('[data-fld]').forEach(inp => {
      const f = T.fields[+inp.dataset.fld]; if (!f) return;
      const auto = !f.label && WT_F[f.k] && WT_F[f.k][0] === 'a';
      if (auto) { const a = wtAutoVal(f.k, ctx()); if (inp.value !== a) over[f.k] = inp.value; else delete over[f.k]; }
      else vals[f.k] = inp.value.trim();
    });
  }
  const redraw = () => { head(); pane(); };
  ov.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ov.contains(b)) return;
    if (b.dataset.tab) { grab(); tab = b.dataset.tab; redraw(); return; }
    if (b.dataset.seg) {
      grab(); const k = b.dataset.seg, v = b.dataset.v;
      if (k === 'lang') lang = v; else if (k === 'mark') T.mark = v; else if (k === 'dates' || k === 'names') T.ent[k] = v; else T.head[k] = v;
      redraw(); return;
    }
    if (b.dataset.q) { const q = b.dataset.q; checked.clear(); list.forEach(x => { if (q === 'all' || (q === 'done' && x.e.done) || (q === 'open' && !x.e.done)) checked.add(x.e.id); }); renderList(); return; }
    if (b.dataset.grp) {
      const k = b.dataset.grp, its = list.filter(x => k === '__none' ? !GR.some(g => g.id === x.e.groupId) : x.e.groupId === k);
      const all = its.every(x => checked.has(x.e.id)); its.forEach(x => all ? checked.delete(x.e.id) : checked.add(x.e.id)); renderList(); return;
    }
    if (b.dataset.rm != null) { grab(); T.fields.splice(+b.dataset.rm, 1); pane(); return; }
    if (b.dataset.up != null) { grab(); const i = +b.dataset.up; if (i > 0) { const t = T.fields[i]; T.fields[i] = T.fields[i - 1]; T.fields[i - 1] = t; } pane(); return; }
    if (b.dataset.srm != null) { T.sigs.splice(+b.dataset.srm, 1); pane(); return; }
    if (b.id === 'mc-exp-addc') { grab(); const n = prompt('Название своего поля (например, «№ договора»)'); if (n && n.trim()) { T.fields.push({ k: 'c' + Date.now().toString(36), label: n.trim() }); pane(); } return; }
    if (b.id === 'mc-exp-addsc') { const n = prompt('Своя роль для подписи (например, «Дизайнер проекта»)'); if (n && n.trim() && T.sigs.length < 3) { T.sigs.push({ label: n.trim() }); pane(); } return; }
    if (b.id === 'mc-exp-logo-btn') { $('mc-exp-logo-file').click(); return; }
    if (b.id === 'mc-exp-logo-del') { P.logo = ''; showLogo(); return; }
  });
  ov.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset && t.dataset.id) { t.checked ? checked.add(t.dataset.id) : checked.delete(t.dataset.id); count(); return; }
    if (t.id === 'mc-exp-tpl') { grab(); T = wtList().find(x => x.id === t.value) || T; lang = T.lang || lang; if (!docTitle || docTitle === card.title) docTitle = card.title || ''; redraw(); return; }
    if (t.id === 'mc-exp-ord') { order = t.value; renderList(); return; }
    if (t.id === 'mc-exp-addf' && t.value) { grab(); T.fields.push({ k: t.value }); pane(); return; }
    if (t.id === 'mc-exp-adds' && t.value) { T.sigs.push(t.value); pane(); return; }
    if (t.id === 'mc-exp-conf') { $('mc-exp-conft').style.display = t.checked ? '' : 'none'; return; }
    if (t.id === 'mc-exp-logo-file') { const f = t.files && t.files[0]; if (!f) return; try { P.logo = await mcLogoFromFile(f); showLogo(); } catch (err) { toast('Не удалось прочитать картинку логотипа', true); } return; }
    if (t.id === 'mc-exp-dcab' || t.id === 'mc-exp-drub') {
      const cab = t.id === 'mc-exp-dcab', key = cab ? space : space + '||' + card.category, on = t.checked, id = T.id;
      mcWordSave(d => { d.defaults = d.defaults || {}; const m = d.defaults[cab ? 'cab' : 'rub'] = d.defaults[cab ? 'cab' : 'rub'] || {}; if (on) m[key] = id; else if (m[key] === id) delete m[key]; });
      toast(on ? '«' + T.name + '» будет открываться ' + (cab ? 'в кабинете «' + spName + '»' : 'для рубрики «' + card.category + '»') : 'Шаблон по умолчанию снят');
    }
  });
  const pack = () => { const t = JSON.parse(JSON.stringify(T)); t.lang = lang; delete t._wc; delete t.builtin; return t; };
  $('mc-exp-save').onclick = () => {
    grab(); const t = pack();
    if (T.builtin) mcWordSave(d => { d.over = d.over || {}; d.over[T.id] = { lang: t.lang, fields: t.fields, mark: t.mark, sigs: t.sigs, head: t.head, ent: t.ent }; });
    else mcWordSave(d => { d.templates = (d.templates || []).map(x => x.id === T.id ? t : x); });
    toast('Шаблон «' + T.name + '» сохранён');
  };
  $('mc-exp-saveas').onclick = () => {
    grab(); const nm = prompt('Название нового шаблона', T.builtin ? T.name + ' (мой)' : T.name + ' — копия'); if (!nm || !nm.trim()) return;
    const t = pack(); t.id = 'my' + Date.now().toString(36); t.name = nm.trim();
    mcWordSave(d => { d.templates = (d.templates || []).concat([t]); });
    T = wtList().find(x => x.id === t.id); redraw(); toast('Сохранён новый шаблон «' + t.name + '»');
  };
  const close = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  $('mc-exp-x').onclick = close;
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  $('mc-exp-go').onclick = () => {
    grab();
    const wc = cardAttCount ? T._wc !== false : false;
    if (!checked.size && !wc) { toast('Выберите хотя бы одну запись', true); return; }
    const c = ctx(), fv = {};
    T.fields.forEach(f => { const auto = !f.label && WT_F[f.k] && WT_F[f.k][0] === 'a'; fv[f.k] = auto ? (over[f.k] != null ? over[f.k] : wtAutoVal(f.k, c)) : (vals[f.k] || ''); });
    mcExpPrefsSave(Object.assign({}, P, { names: T.ent.names, dates: T.ent.dates, divider: T.ent.divider, divColor: T.ent.divColor }));
    mcWordSave(d => { d.values = d.values || {}; d.values[space] = Object.assign({}, vals); d.last = T.id; });
    const ids = new Set(checked), title = (docTitle || '').trim() || (T.title && T.title[lang]) || card.title || 'Карточка';
    const PP = Object.assign({}, P, T.ent);
    close();
    mcExportCardWordRun(card, { ids, order, withCard: wc, P: PP, docTitle: title, T: pack(), lang, fv });
  };
  redraw();
}

async function mcExportCardWordRun(card, opt) {
  if (window._mcExporting) return;
  window._mcExporting = true;
  const P = opt.P;
  try {
    // 1. Структура: выбранные записи по дате (рубрика — пометкой), вложения карточки под самой ранней записью
    const groups = card.entryGroups || [];
    const grouped = groups.length > 0; // мультикарточка: разделы по порядку карточки, внутри раздела — по дате
    const gIdx = new Map(groups.map((g, k) => [g.id, k]));
    const gOf = x => gIdx.has(x.e.groupId) ? gIdx.get(x.e.groupId) : 1e9;
    const blocks = mcExportEntries(card).filter(x => opt.ids.has(x.e.id))
      .sort((a, b) => (grouped ? gOf(a) - gOf(b) : 0) || (opt.order === 'asc' ? 1 : -1) * ((a.ts - b.ts) || (a.i - b.i)))
      .map(x => ({ ts: x.ts, i: x.i, e: x.e, gk: grouped ? gOf(x) : 0, grp: grouped ? '' : (((groups.find(g => g.id === x.e.groupId) || {}).name) || ''),
        gName: grouped ? (gIdx.has(x.e.groupId) ? (groups[gIdx.get(x.e.groupId)].name || 'Без названия') : 'Без раздела') : '' }));
    const cardAtts = opt.withCard ? (card.attachments || []).filter(a => a && a.data) : [];
    const allAtts = [];
    const reg = (a, tag) => { const o = { a, tag }; allAtts.push(o); return o; };
    let n = 0;
    const first = blocks.length ? blocks.reduce((m, b) => ((b.ts - m.ts) || (b.i - m.i)) < 0 ? b : m) : null;
    let secNo = 0, inSec = 0, prevGk = null;
    blocks.forEach(b => {
      b.n = ++n;
      if (grouped) { if (b.gk !== prevGk) { secNo++; inSec = 0; prevGk = b.gk; b.secStart = true; } b.sec = secNo; b.label = secNo + '.' + (++inSec); }
      else b.label = String(b.n) + '.';
      const tag = grouped ? (b.sec + '-' + inSec) : String(b.n).padStart(2, '0');
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
    const attXml = list => {
      let x = '';
      const imgs = list.filter(o => o.thumb);
      for (let i = 0; i < imgs.length; i += 3) x += mcDocPara(imgs.slice(i, i + 3).map(imgXml).join(''), { keep: true, after: 60 });
      const nameLines = vanish => {
        let y = '';
        list.forEach(o => {
          if (o.err) { y += mcDocPara(mcDocRun(icon(o), { size: 19, vanish }) + mcDocRun((o.a.name || 'файл') + ' — файл недоступен (удалён из облака или нет сети)', { size: 19, color: 'C0392B', vanish }), { after: 30, vanish }); return; }
          y += mcDocPara(mcDocRun(icon(o), { size: 19, vanish }) + '<w:hyperlink r:id="' + extRel(o.name) + '" w:history="1">' + mcDocRun(o.name, { size: 19, color: '1F5FA8', u: true, vanish }) + '</w:hyperlink>' + mcDocRun('  (' + sizeTxt(o.size) + ')', { size: 17, color: '8A8A8A', vanish }), { after: 30, vanish });
        });
        return y;
      };
      const compact = () => {
        // фото без подписей, остальное — одна строка коротких ссылок
        const cnt = { v: 0, a: 0, f: 0, p: 0 }; let line = '';
        list.forEach(o => {
          if (o.thumb && !o.err) return;
          if (o.err) { line += mcDocRun('⚠ ' + (o.a.name || 'файл') + ' — недоступен   ', { size: 18, color: 'C0392B' }); return; }
          const lbl = o.isVid ? 'Видео ' + (++cnt.v) : o.isAud ? 'Голосовое ' + (++cnt.a) : o.isImg ? 'Фото ' + (++cnt.p) : 'Файл ' + (++cnt.f);
          line += mcDocRun(icon(o), { size: 18 }) + '<w:hyperlink r:id="' + extRel(o.name) + '" w:history="1">' + mcDocRun(lbl, { size: 18, color: '1F5FA8', u: true }) + '</w:hyperlink>' + mcDocRun('    ', { size: 18 });
        });
        return line ? mcDocPara(line, { after: 30 }) : '';
      };
      if (P.names === 'show') x += nameLines(false);
      else if (P.names === 'hidden') x += compact() + nameLines(true);
      else x += compact();
      return x;
    };
    // галочка «выполнено» (в Word нажимается мышью)
    const checkbox = on => '<w:sdt><w:sdtPr><w:alias w:val="Выполнено"/><w14:checkbox><w14:checked w14:val="' + (on ? 1 : 0) + '"/><w14:checkedState w14:val="2611" w14:font="Segoe UI Symbol"/><w14:uncheckedState w14:val="2610" w14:font="Segoe UI Symbol"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:eastAsia="Segoe UI Symbol" w:cs="Segoe UI Symbol"/><w:sz w:val="28"/></w:rPr><w:t>' + (on ? '☑' : '☐') + '</w:t></w:r></w:sdtContent></w:sdt>' + mcDocRun(' ', { size: 24 });
    const cell = (inner, w, o) => { o = o || {}; return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.borders || '') + (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '') + '<w:vAlign w:val="' + (o.v || 'center') + '"/></w:tcPr>' + inner + '</w:tc>'; };
    const TW = 9906;
    let body = '';
    // шапка
    const TT = opt.T || null, HH = TT ? TT.head : { logo: 'left', contacts: 'both', gold: false, page: 'p' }, LG = opt.lang || 'ru', LL = WT_L[LG] || WT_L.ru;
    const siteHead = P.site && (HH.contacts === 'head' || HH.contacts === 'both'), siteFoot = P.site && (HH.contacts === 'foot' || HH.contacts === 'both');
    const hasHead = HH.logo !== 'none' && (P.logo || P.studio || P.slogan || siteHead);
    if (hasHead) {
      let lw = 0, logoXml = '';
      if (P.logo) {
        try {
          const bmp = await createImageBitmap(await mcFetchBlob(P.logo));
          const cy = 720000, cx = Math.round(cy * bmp.width / bmp.height);
          const bin = await (await fetch(P.logo)).arrayBuffer();
          logoXml = mcDocPara(drawing(addMedia(bin, 'png'), Math.min(cx, 2160000), cy, 'logo'), { after: HH.logo === 'center' ? 80 : 0, jc: HH.logo === 'center' ? 'center' : null });
          lw = Math.min(cx, 2160000) / 635 + 200;
          if (bmp.close) bmp.close();
        } catch (e) {}
      }
      lw = Math.round(lw);
      const RH = LG === 'he';
      if (HH.logo === 'center') { // логотип, студия, слоган и контакты одной колонкой по центру
        body += logoXml;
        if (P.studio) body += mcDocPara(mcDocRun(P.studio.toUpperCase(), { b: true, size: 24, rtl: _isRTL(P.studio) }), { after: 0, jc: 'center', bidi: _isRTL(P.studio) });
        if (P.slogan) body += mcDocPara(mcDocRun(P.slogan, { size: 17, color: '777777', rtl: _isRTL(P.slogan) }), { after: 0, jc: 'center', bidi: _isRTL(P.slogan) });
        if (siteHead) body += mcDocPara(mcDocRun(P.site, { size: 17, color: '777777' }), { before: 40, after: 0, jc: 'center' });
        if (!HH.gold) body += mcDocPara('', { after: 0, line: 120, divider: 'DDDDDD' });
      } else {
        const rw = siteHead ? 2900 : 0, mw = TW - lw - rw;
        const bb = '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="DDDDDD"/></w:tcBorders>';
        const mid = (P.studio ? mcDocPara(mcDocRun(P.studio.toUpperCase(), { b: true, size: 24, rtl: _isRTL(P.studio) }), { after: 0, bidi: RH || _isRTL(P.studio) }) : '') + (P.slogan ? mcDocPara(mcDocRun(P.slogan, { size: 17, color: '777777', rtl: _isRTL(P.slogan) }), { after: 0, bidi: RH || _isRTL(P.slogan) }) : '') || mcDocPara('', { after: 0 });
        let cells = '';
        if (lw) cells += cell(logoXml, lw, { borders: bb });
        cells += cell(mid, mw, { borders: bb });
        if (rw) cells += cell(mcDocPara(mcDocRun(P.site, { size: 17, color: '777777' }), { after: 0, jc: 'right', bidi: RH }), rw, { borders: bb }); // в иврите таблица зеркальная: логотип справа, контакты слева
        body += '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/>' + (RH ? '<w:bidiVisual/>' : '') + '<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>' + (lw ? '<w:gridCol w:w="' + lw + '"/>' : '') + '<w:gridCol w:w="' + mw + '"/>' + (rw ? '<w:gridCol w:w="' + rw + '"/>' : '') + '</w:tblGrid><w:tr>' + cells + '</w:tr></w:tbl>';
      }
    }
    if (hasHead && HH.gold) body += mcDocPara('', { after: 0, line: 120, divider: GOLD });
    if (opt.docTitle) body += mcDocPara(mcDocRun(opt.docTitle, { b: true, size: 40 }), { before: 240, after: 120, bidi: _isRTL(opt.docTitle) || LG === 'he' });
    // таблица данных
    const pairs = []; // поля шаблона: пустые в документ не попадают
    if (TT) TT.fields.forEach(f => { const v = String((opt.fv || {})[f.k] || '').trim(); if (v) pairs.push([wtFieldLabel(f, LG), v]); });
    else {
      const d = new Date(), p2 = x => String(x).padStart(2, '0');
      if (opt.object) pairs.push(['Объект', opt.object]);
      pairs.push(['Дата', p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear()]);
      if (P.author) pairs.push(['Составил(а)', P.author]);
      pairs.push(['Записей', String(n)]);
    }
    const bAll = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>').join('') + '</w:tcBorders>';
    let trs = '';
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i], b2 = pairs[i + 1];
      const mk = (pr, lw2, vw) => cell(mcDocPara(mcDocRun(pr[0], { b: true, size: 19, rtl: LG === 'he' }), { after: 0, bidi: LG === 'he' }), lw2, { borders: bAll, fill: 'F6EFD9' }) + cell(mcDocPara(mcDocRun(pr[1], { size: 20, rtl: _isRTL(pr[1]) }), { after: 0, bidi: LG === 'he' || _isRTL(pr[1]) }), vw, { borders: bAll });
      trs += '<w:tr>' + (b2 ? mk(a, 1500, 3453) + mk(b2, 1500, 3453) : mk(a, 1500, 3453) + cell(mcDocPara('', { after: 0 }), 4953, { borders: bAll })) + '</w:tr>';
    }
    if (trs) body += '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/>' + (LG === 'he' ? '<w:bidiVisual/>' : '') + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="3453"/><w:gridCol w:w="1500"/><w:gridCol w:w="3453"/></w:tblGrid>' + trs + '</w:tbl>';
    body += mcDocPara('', { after: 40 });
    if (card.body) {
      const parts = mcRichToParts(card.body); const rtl = _isRTL(parts.map(x => x.t || '').join(''));
      body += mcDocPara(parts.map(x => x.br ? '<w:r><w:br/></w:r>' : mcDocRun(x.t, { ...x, rtl })).join(''), { bidi: rtl, after: 120 });
    }
    if (cardAttObjs.length) {
      body += mcDocPara(mcDocRun(LL.att, { b: true, size: 26, rtl: LG === 'he' }), { before: 160, keep: true, bidi: LG === 'he' });
      body += attXml(cardAttObjs);
    }
    blocks.forEach(b => {
      const e = b.e;
      const parts = mcRichToParts(e.text || e.sessionNote || '');
      const rtl = _isRTL(parts.map(x => x.t || '').join(''));
      const textXml = parts.map(x => x.br ? '<w:r><w:br/></w:r>' : mcDocRun(x.t, { ...x, rtl, size: 24 })).join('');
      if (grouped && b.secStart) { // золотая плашка раздела с прогрессом
        const sb2 = blocks.filter(x => x.gk === b.gk), sd = sb2.filter(x => x.e.done).length, rg = _isRTL(b.gName) || LG === 'he';
        body += '<w:p><w:pPr><w:keepNext/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="' + GOLD + '"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F6EFD9"/>' + (rg ? '<w:bidi/>' : '') + '<w:spacing w:before="' + (b === blocks[0] ? 120 : 320) + '" w:after="120"/></w:pPr>' +
          mcDocRun(b.gName, { b: true, size: 28, rtl: rg }) + (card.noProgress ? '' : mcDocRun('   · ' + LL.prog.replace('{d}', sd).replace('{n}', sb2.length), { size: 18, color: '8A6A1F' })) + '</w:p>';
      } else if (P.divider && b !== blocks[0]) body += mcDocPara('', { before: 160, after: 120, line: 120, divider: (P.divColor || '#B8892B').replace('#', '') });
      else body += mcDocPara('', { after: 0, line: 120 });
      const _dt0 = String(e.date || ''), _keep = (P.dates !== 'none' && !!_dt0) || !!b.grp || b.atts.length > 0; // запись держится только со своей датой и файлами, а не со следующим разделом: иначе документ «склеивается» и уезжает на новую страницу
      const MK = TT ? TT.mark : (P.checks ? 'chk' : 'old');
      const markXml = MK === 'chk' ? checkbox(!!e.done) : MK === 'fix' || MK === 'buy' ? mcDocRun((e.done ? '✔ ' : '○ ') + LL[MK][e.done ? 0 : 1] + ' ', { b: true, size: 18, color: e.done ? '2E7D32' : 'B8892B', rtl }) + mcDocRun(' ', { size: 24 }) : MK === 'old' && e.done ? mcDocRun('☑ ', { size: 24, rtl }) : '';
      body += mcDocPara(markXml + textXml, { before: 60, after: 60, keep: _keep, bidi: rtl || LG === 'he', num: grouped ? { id: 2, lvl: 1 } : { id: 1, lvl: 0 } });
      const dTxt = LG === 'he' && e.date ? '\u200E' + e.date + '\u200E' : String(e.date || ''); // метка «слева направо»: в иврите дата не переставляется
      if (P.dates === 'show' && (dTxt || b.grp)) body += mcDocPara(mcDocRun(dTxt + (b.grp ? (dTxt ? '  ·  ' : '') + '▸ ' + b.grp : ''), { size: 18, color: '8A8A8A', rtl: _isRTL(b.grp) && !dTxt }), { bidi: LG === 'he', keep: b.atts.length > 0, after: 80 });
      else if (P.dates === 'hidden' && dTxt && !b.grp) body += mcDocPara(mcDocRun(dTxt, { size: 18, color: '8A8A8A', vanish: true }), { bidi: LG === 'he', keep: b.atts.length > 0, after: 80, vanish: true });
      else if (P.dates === 'hidden' && b.grp) body += mcDocPara(mcDocRun(dTxt + '  ·  ', { size: 18, color: '8A8A8A', vanish: true }) + mcDocRun('▸ ' + b.grp, { size: 18, color: '8A8A8A' }), { bidi: LG === 'he', keep: b.atts.length > 0, after: 80 });
      else if (b.grp) body += mcDocPara(mcDocRun('▸ ' + b.grp, { size: 18, color: '8A8A8A', rtl: _isRTL(b.grp) }), { bidi: LG === 'he', keep: b.atts.length > 0, after: 80 });
      if (b.atts.length) body += attXml(b.atts);
    });
    const SG = TT ? (TT.sigs || []).slice(0, 3).map(r => wtRoleLabel(r, LG)) : (P.signs ? ['Подпись исполнителя', 'Подпись заказчика'] : []);
    if (SG.length) { // подписи: роль, строка для подписи и «ФИО: ____» (без даты)
      const gap = 500, cw = Math.floor((TW - gap * (SG.length - 1)) / SG.length), rtlS = LG === 'he';
      const top = '<w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/></w:tcBorders>';
      const sg = t => cell(mcDocPara(mcDocRun(t, { b: true, size: 18, color: '555555', rtl: rtlS || _isRTL(t) }), { after: 120, bidi: rtlS || _isRTL(t) }) + mcDocPara(mcDocRun(LL.fio + ': ____________________', { size: 17, color: '777777', rtl: rtlS }), { after: 0, bidi: rtlS }), cw, { borders: top, v: 'top' });
      body += mcDocPara('', { before: 700, after: 0, keep: true });
      const cols = SG.map((t, i) => (i ? '<w:gridCol w:w="' + gap + '"/>' : '') + '<w:gridCol w:w="' + cw + '"/>').join('');
      body += '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' + (rtlS ? '<w:bidiVisual/>' : '') + '</w:tblPr><w:tblGrid>' + cols + '</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>' + SG.map((t, i) => (i ? cell(mcDocPara('', { after: 0 }), gap) : '') + sg(t)).join('') + '</w:tr></w:tbl>';
    }
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"';
    const thinTxt = hasHead ? [P.studio, opt.docTitle].filter(Boolean).join('  ·  ') : ''; // тонкая строка на 2-й и следующих страницах
    const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body +
      '<w:sectPr>' + (thinTxt ? '<w:headerReference w:type="default" r:id="rId5"/><w:headerReference w:type="first" r:id="rId4"/><w:footerReference w:type="first" r:id="rId6"/>' : '') + '<w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/>' + (thinTxt ? '<w:titlePg/>' : '') + (LG === 'he' ? '<w:bidi/>' : '') + '</w:sectPr></w:body></w:document>';
    const footTxt = HH.contacts === 'none' ? '' : [P.studio, siteFoot ? P.site : ''].filter(Boolean).join('  ·  ');
    const fr = '<w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr>';
    const fT = t => t ? '<w:r>' + fr + '<w:t xml:space="preserve">' + _XE(t) + '</w:t></w:r>' : '';
    const fF = ins => '<w:r>' + fr + '<w:fldChar w:fldCharType="begin"/></w:r><w:r>' + fr + '<w:instrText xml:space="preserve"> ' + ins + ' </w:instrText></w:r><w:r>' + fr + '<w:fldChar w:fldCharType="separate"/></w:r><w:r>' + fr + '<w:t>1</w:t></w:r><w:r>' + fr + '<w:fldChar w:fldCharType="end"/></w:r>';
    const pageXml = HH.page === 'no' ? '' : HH.page === 'pof' ? LL.page.split(/(\{p\}|\{n\})/).map(x => x === '{p}' ? fF('PAGE') : x === '{n}' ? fF('NUMPAGES') : fT(x)).join('') : fF('PAGE');
    const confTxt = HH.conf ? (HH.confText || LL.conf) : '';
    const RF = LG === 'he', fp = (inner, jc) => '<w:p><w:pPr>' + (RF ? '<w:bidi/>' : '') + '<w:spacing w:before="60" w:after="0"/><w:jc w:val="' + jc + '"/></w:pPr>' + inner + '</w:p>';
    const ftb = '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/></w:tcBorders>';
    const fc = (inner, w) => '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + ftb + '</w:tcPr>' + inner + '</w:tc>';
    const footXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + // в иврите зеркально: контакты справа, номер слева
      '<w:tbl><w:tblPr><w:tblW w:w="' + TW + '" w:type="dxa"/>' + (RF ? '<w:bidiVisual/>' : '') + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="6906"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr>' +
      fc(fp(fT(footTxt), 'left'), 6906) + fc(fp(pageXml.replace(/<w:rPr>/g, RF ? '<w:rPr><w:rtl/>' : '<w:rPr>'), 'right'), 3000) + '</w:tr></w:tbl>' +
      (confTxt ? '<w:p><w:pPr>' + (RF || _isRTL(confTxt) ? '<w:bidi/>' : '') + '<w:spacing w:before="40" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="999999"/><w:sz w:val="14"/>' + (_isRTL(confTxt) ? '<w:rtl/>' : '') + '</w:rPr><w:t xml:space="preserve">' + _XE(confTxt) + '</w:t></w:r></w:p>' : '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>') + '</w:ftr>';
    const hdr = inner => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + inner + '</w:hdr>';
    const head1Xml = hdr('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>');
    const head2Xml = hdr('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="' + (HH.gold ? GOLD : 'DDDDDD') + '"/></w:pBdr>' + (RF || _isRTL(thinTxt) ? '<w:bidi/>' : '') + '<w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/>' + (_isRTL(thinTxt) ? '<w:rtl/>' : '') + '</w:rPr><w:t xml:space="preserve">' + _XE(thinTxt) + '</w:t></w:r></w:p>');
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:bidi="he-IL"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    // нумерация Word: 1 — обычная карточка «1.», 2 — мультикарточка: раздел «1.», запись «1.1»
    const lvl = (i, fmt, rpr) => '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="' + fmt + '"/><w:lvlJc w:val="left"/><w:suff w:val="space"/><w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr><w:rPr>' + rpr + '</w:rPr></w:lvl>';
    const gold = '<w:b/><w:bCs/><w:color w:val="' + GOLD + '"/><w:sz w:val="26"/><w:szCs w:val="26"/>';
    const numXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>' + lvl(0, '%1.', gold) + '</w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>' + lvl(0, '%1.', '<w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/>') + lvl(1, '%1.%2', gold) + '</w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + (thinTxt ? '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>' : '') + rels.join('') + '</Relationships>';
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' + (thinTxt ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') + '</Types>';
    const topRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const dz = new JSZip();
    dz.file('[Content_Types].xml', ct); dz.file('_rels/.rels', topRels);
    dz.file('word/document.xml', docXml); dz.file('word/styles.xml', stylesXml); dz.file('word/footer1.xml', footXml); if (thinTxt) { dz.file('word/header1.xml', head1Xml); dz.file('word/header2.xml', head2Xml); dz.file('word/footer2.xml', footXml); } dz.file('word/numbering.xml', numXml); dz.file('word/_rels/document.xml.rels', docRels);
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
