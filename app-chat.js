// ═══════════════════════════════════════════
//  ГРУППОВОЙ КАБИНЕТ КАК ЧАТ
// ═══════════════════════════════════════════

function handleNewCardClick(){
  if(currentSpace?.type==='family' || currentSpace?.type==='group') quickCreateChat();
  else openEdit();
}

function quickCreateChat(){
  openNewChatDialog();
}

function openNewChatDialog() {
  const div = document.createElement('div');
  div.id = 'new-chat-ov';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
  div.innerHTML = `<div style="background:var(--s1);border-radius:var(--r);padding:20px;max-width:360px;width:100%;max-height:calc(100vh - 40px);display:flex;flex-direction:column;box-sizing:border-box">
    <div style="font-size:16px;font-weight:700;margin-bottom:14px">Новый чат</div>
    <div style="margin-bottom:12px"><label style="font-size:13px;color:var(--t2);display:block;margin-bottom:4px">Название</label>
      <input id="new-chat-title" placeholder="Например: Ужин в субботу" dir="auto" style="width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px;font-size:14px;color:var(--t1);font-family:inherit;box-sizing:border-box">
    </div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:6px">Рубрика</div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button type="button" class="new-chat-cat-btn on" data-cat="Работа" onclick="selectNewChatCat(this)" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:8px;padding:8px;font-size:13px;cursor:pointer;font-family:inherit">Работа</button>
      <button type="button" class="new-chat-cat-btn" data-cat="Семья" onclick="selectNewChatCat(this)" style="flex:1;background:transparent;border:1px solid var(--b1);color:var(--t2);border-radius:8px;padding:8px;font-size:13px;cursor:pointer;font-family:inherit">Семья</button>
      <button type="button" class="new-chat-cat-btn" data-cat="__other__" onclick="selectNewChatCat(this)" style="flex:1;background:transparent;border:1px solid var(--b1);color:var(--t2);border-radius:8px;padding:8px;font-size:13px;cursor:pointer;font-family:inherit">Другое</button>
    </div>
    <input id="new-chat-cat-custom" placeholder="Название рубрики" dir="auto" style="display:none;width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--rsm);padding:10px;font-size:14px;color:var(--t1);font-family:inherit;box-sizing:border-box;margin-bottom:12px">
       <div id="new-chat-color-section" style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--t2);margin-bottom:6px">Цвет рубрики</div>
      <div id="new-chat-color-picker" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:6px">Участники чата</div>
    <div id="new-chat-members" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px"></div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('new-chat-ov').remove()" style="flex:1;background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:var(--rsm);padding:11px;font-size:13px;cursor:pointer;font-family:inherit">Отмена</button>
      <button onclick="confirmCreateChat()" style="flex:1;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Создать</button>
    </div>
  </div>`;
  document.body.appendChild(div);
   {
  const _card = div.firstElementChild, _row = div.querySelector('button[onclick*="new-chat-ov"]')?.parentElement;
  if(_card && _row) {
    const _body = document.createElement('div');
    _body.style.cssText = 'flex:1;min-height:0;overflow-y:auto;margin:0 -4px;padding:0 4px';
    [..._card.children].forEach(ch => { if(ch !== _row) _body.appendChild(ch); });
    _card.insertBefore(_body, _row);
    _row.style.marginTop = '12px';
    _row.style.flexShrink = '0';
  }
}
window._newChatSelectedCat = 'Работа';
  window._newChatSelectedColor = COLORS[0];
  window._newChatMembers = new Set((currentSpace?.members||[]).map(m=>m.name)); // по умолчанию — все
  renderNewChatColorPicker();
  updateNewChatColorSectionVisibility();
  renderNewChatMembers();
  setTimeout(()=>document.getElementById('new-chat-title')?.focus(), 100);
}
function renderNewChatMembers() {
  const box = document.getElementById('new-chat-members'); if(!box) return;
  box.innerHTML = (currentSpace?.members||[]).map(m => {
    const on = window._newChatMembers.has(m.name);
    return `<button type="button" onclick="toggleNewChatMember('${esc(m.name)}',this)" style="background:${on?'var(--accent)':'transparent'};color:${on?'#0f0f0f':'var(--t2)'};border:1px solid var(--b1);border-radius:14px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit">${esc(aliasedName(m.name))}</button>`;
  }).join('');
}
function toggleNewChatMember(name, btn) {
  if(window._newChatMembers.has(name)) { window._newChatMembers.delete(name); btn.style.background='transparent'; btn.style.color='var(--t2)'; }
  else { window._newChatMembers.add(name); btn.style.background='var(--accent)'; btn.style.color='#0f0f0f'; }
}

function renderNewChatColorPicker() {
  const box = document.getElementById('new-chat-color-picker'); if(!box) return;
  box.innerHTML = COLORS.map(c => `<button type="button" onclick="selectNewChatColor('${c}',this)" style="width:26px;height:26px;border-radius:50%;background:${c};border:2px solid ${c===window._newChatSelectedColor?'var(--t1)':'transparent'};cursor:pointer"></button>`).join('');
}
function selectNewChatColor(color, btn) {
  window._newChatSelectedColor = color;
  document.querySelectorAll('#new-chat-color-picker button').forEach(b=>b.style.border='2px solid transparent');
  btn.style.border = '2px solid var(--t1)';
}
function selectNewChatCat(btn) {
  document.querySelectorAll('.new-chat-cat-btn').forEach(b=>{ b.classList.remove('on'); b.style.background='transparent'; b.style.color='var(--t2)'; });
  btn.classList.add('on'); btn.style.background='var(--accent)'; btn.style.color='#0f0f0f';
  const isOther = btn.dataset.cat === '__other__';
  document.getElementById('new-chat-cat-custom').style.display = isOther ? 'block' : 'none';
  window._newChatSelectedCat = isOther ? '' : btn.dataset.cat;
  updateNewChatColorSectionVisibility();
}
function updateNewChatColorSectionVisibility() {
  // Если рубрика уже существует в этом кабинете — используем её собственный цвет, палитру не показываем
  const name = window._newChatSelectedCat;
  const existing = (cats||[]).find(c=>c.name===name);
  const section = document.getElementById('new-chat-color-section');
  if(section) section.style.display = (name && existing) ? 'none' : 'block';
}

async function confirmCreateChat(){
  const title = document.getElementById('new-chat-title').value.trim();
  if(!title) { toast('Введи название чата', true); return; }
  const isOther = document.querySelector('.new-chat-cat-btn.on')?.dataset.cat === '__other__';
  const catName = isOther ? document.getElementById('new-chat-cat-custom').value.trim() : window._newChatSelectedCat;
  if(!catName) { toast('Укажи рубрику', true); return; }

  let cat = (cats||[]).find(c=>c.name===catName);
  if(!cat) {
    const color = window._newChatSelectedColor || COLORS[0];
    const { data, error } = await sb.from('categories').insert({name:catName, color, space_id: currentSpaceId}).select().single();
    if(!error && data) { cat = data; cats.push(cat); }
  }
  if(!window._newChatMembers.size) { toast('Выбери хотя бы одного участника', true); return; }
  document.getElementById('new-chat-ov')?.remove();

  const card = {
    id: uid(), created_at: today(), space_id: currentSpaceId,
    created_by: localStorage.getItem('mc_current_member')||currentUser?.display_name||'',
    title, body: '', category: catName,
    status: 'new', priority: 'normal', deadline: null, ball: '',
    assigned_to: null, attachments: [], entries: [], entryGroups: [],
    reminder: {enabled:false, freq:'daily', days:[], intervalMin:null},
    history: [{date: nowStr(), text: 'Чат создан', type:'created'}],
    related_ids: [], today: false, pinned: false,
    chatParticipants: [...window._newChatMembers]
  };
  cards.unshift(card);
  render();
  toast('✓ Чат создан');
  await dbInsert(card);
  try {
    const _inv = chatRecipientIds(card);
    if(_inv.length) await notifyUsers(_inv, '💬 Новый чат', `{{name}} пригласил(а) тебя в чат «${title}»`, currentUser?.id, card.created_by, `https://vales-chayv.github.io/check-list/?openSpace=${currentSpaceId}&openCard=${card.id}`);
  } catch(e) { console.warn('invite push', e); }
  if(typeof logEvent === 'function') logEvent(currentSpaceId, currentSpace?.name, 'chat_created', `создал(а) чат «${title}»`, card.id);
  openView(card.id);
}

// ── Написать в чат — пока переиспользует существующий попап быстрого добавления ──
function openChatCompose(cardId){
  openAddEntry(cardId);
}

// ── Голосовое сообщение ──
let chatRecorder = null, chatRecordedChunks = [], chatRecordingCardId = null;

async function sendQuickChatMessage(cardId){
  const inp = document.getElementById('chat-quick-input');
  const text = inp?.value.trim(); if(!text) return;
  const card = cards.find(c=>c.id===cardId); if(!card) return;
   const entry = {
    id: uid(), text: '', date: nowStr(), done: false,
    attachments: [], sessionId: uid(), sessionNote: text, sessionAtts: [],
    sessionCreator: localStorage.getItem('mc_current_member')||currentUser?.display_name||'',
    assigned_to: null, completions: null, deadline: null
  };
  card.entries = [entry, ...(card.entries||[])];
  _activeAttachEntryId = null; // текст — граница; следующее вложение начнёт новый стикер
  inp.value = '';
  try { localStorage.removeItem('mc_draft_' + cardId); } catch(e) {}
  chatTypingStop();
  render();
  openView(cardId);
  setTimeout(()=>{ const sheet = document.querySelector('#view-ov .sheet'); if(sheet) sheet.scrollTop = 0; }, 50);
  await dbUpdate(card);
  if(Array.isArray(card.chatParticipants) && (currentSpace?.type==='family'||currentSpace?.type==='group') && typeof notifyUsers === 'function') {
    const senderName = localStorage.getItem('mc_current_member')||currentUser?.display_name||'';
      const recipientIds = chatRecipientIds(card);
    if(recipientIds.length) await notifyUsers(recipientIds, '💬 ' + card.title, `{{name}}: ${text.slice(0,60)}`, currentUser?.id, senderName, `https://vales-chayv.github.io/check-list/?openSpace=${currentSpaceId}&openCard=${cardId}`);
  }
}
let _chatFanOpen = false;
let _attachPressTimer = null;
let _attachLongPressFired = false;

function startAttachPress(cardId){
  _attachLongPressFired = false;
  _attachPressTimer = setTimeout(() => {
    _attachLongPressFired = true;
    pickChatAttachment(cardId, 'task');
  }, 1500);
}
function cancelAttachPress(){
  if(_attachPressTimer) { clearTimeout(_attachPressTimer); _attachPressTimer = null; }
}
function handleAttachClick(cardId){
  if(_attachLongPressFired) { _attachLongPressFired = false; return; } // клик после срабатывания долгого нажатия — уже обработан, второй раз не открываем веер
  toggleChatFan(cardId);
}
function renderChatQuickBar(cardId, card){
  const _hadFocus = !!(document.activeElement && document.activeElement.id === 'chat-quick-input');
  document.getElementById('chat-quick-bar')?.remove();
  _chatFanOpen = false;
  _activeAttachEntryId = null;
  if(card.chatStatus==='closed') return;
  const ov = document.getElementById('view-ov');
  if(!ov) return;
  const bar = document.createElement('div');
  bar.id = 'chat-quick-bar';
  bar.style.cssText = 'position:absolute;left:0;right:0;bottom:0;z-index:50;display:flex;gap:8px;align-items:center;padding:10px 14px;background:var(--s1);border-top:1px solid var(--b1);box-sizing:border-box';
  bar.innerHTML = `
    <div class="chat-attach-wrap">
      <button id="chat-attach-btn" onclick="event.stopPropagation();handleAttachClick('${cardId}')" onpointerdown="startAttachPress('${cardId}')" onpointerup="cancelAttachPress()" onpointerleave="cancelAttachPress()" onpointercancel="cancelAttachPress()" oncontextmenu="return false" style="user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation">📎</button>
      <input id="chat-quick-input" type="text" placeholder="Сообщение…" dir="auto" style="background:var(--s2);border:1px solid var(--b1);border-radius:20px;padding:10px 16px;font-size:14px;color:var(--t1);font-family:inherit">
      <button class="chat-fan-petal" data-kind="photo" onclick="event.stopPropagation();pickChatAttachment('${cardId}','photo')" style="left:6px;top:50%;margin-top:-20px">🖼️</button>
      <button class="chat-fan-petal" data-kind="video" onclick="event.stopPropagation();pickChatAttachment('${cardId}','video')" style="left:6px;top:50%;margin-top:-20px">🎥</button>
      <button class="chat-fan-petal" data-kind="file" onclick="event.stopPropagation();pickChatAttachment('${cardId}','file')" style="left:6px;top:50%;margin-top:-20px">📄</button>
      <button class="chat-fan-petal" data-kind="task" onclick="event.stopPropagation();pickChatAttachment('${cardId}','task')" style="left:6px;top:50%;margin-top:-20px">✅</button>
    </div>
    <button onclick="sendQuickChatMessage('${cardId}')" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:50%;width:40px;height:40px;font-size:16px;cursor:pointer;flex-shrink:0">➤</button>
    <button onclick="openChatVoice('${cardId}')" style="background:var(--s2);color:var(--accent);border:1px solid var(--b1);border-radius:50%;width:40px;height:40px;font-size:16px;cursor:pointer;flex-shrink:0">🎙️</button>
  `;
  ov.appendChild(bar);
  chatTypingEnsure(cardId);
  const inp = bar.querySelector('#chat-quick-input');
  try { const _d = localStorage.getItem('mc_draft_' + cardId); if(_d) inp.value = _d; } catch(e) {}
  if(_hadFocus) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch(e) {} }
  inp.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); sendQuickChatMessage(cardId); } });
}

// ── «пишет…» в чате: отдельный канал broadcast на каждый открытый чат (без хранения состояния и без базы) ──
let _tc = null, _tcCard = null;
const _typers = {};   // user_id -> {name, until}
let _typingIdle = null, _typingLastSent = 0, _typingKey = '';
function chatTypingEnsure(cardId){
  if(!cardId || typeof sb === 'undefined') return null;
  if(_tc && _tcCard === cardId && _tc.state !== 'closed' && _tc.state !== 'errored') return _tc;
  chatTypingLeave();
  try {
    _tcCard = cardId;
    _tc = sb.channel('typing:' + cardId, { config: { broadcast: { self: false } } });
    _tc.on('broadcast', { event: 'typing' }, m => {
        const p = m && m.payload;
        if(p && p.user_id && p.user_id !== currentUser?.id) _typers[p.user_id] = { name: p.name || '', until: Date.now() + 4000 };
      })
      .on('broadcast', { event: 'stop' }, m => {
        const p = m && m.payload;
        if(p && p.user_id) delete _typers[p.user_id];
      })
      .subscribe();
  } catch(e) { _tc = null; _tcCard = null; }
  return _tc;
}
function chatTypingLeave(){
  if(_tc) { try { sb.removeChannel(_tc); } catch(e) {} }
  _tc = null; _tcCard = null; _typingLastSent = 0;
  Object.keys(_typers).forEach(k => delete _typers[k]);
}
function chatTypingSend(event){
  const ch = chatTypingEnsure(window._openViewId);
  if(!ch || ch.state !== 'joined') return;
  try { ch.send({ type: 'broadcast', event, payload: { name: localStorage.getItem('mc_current_member') || '', user_id: currentUser?.id } }); } catch(e) {}
}
function chatTypingPing(){
  const now = Date.now();
  if(now - _typingLastSent > 1500) { _typingLastSent = now; chatTypingSend('typing'); }
  clearTimeout(_typingIdle);
  _typingIdle = setTimeout(chatTypingStop, 3000);
}
// сразу снимаем «пишет…» (после отправки, когда поле очистили или перестала печатать)
function chatTypingStop(){
  clearTimeout(_typingIdle);
  if(_typingLastSent) chatTypingSend('stop');
  _typingLastSent = 0;
}
document.addEventListener('input', e => {
  if(!e.target || e.target.id !== 'chat-quick-input') return;
  if(e.target.value) chatTypingPing(); else chatTypingStop();
  const _cid = window._openViewId;
  if(_cid) { try { if(e.target.value) localStorage.setItem('mc_draft_' + _cid, e.target.value); else localStorage.removeItem('mc_draft_' + _cid); } catch(err) {} }
});
(function(){
  if(document.getElementById('chat-typing-css')) return;
  const st = document.createElement('style'); st.id = 'chat-typing-css';
  st.textContent = '@keyframes mcdot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}.mc-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--t2);margin-right:3px;animation:mcdot 1.2s infinite}.mc-dot:nth-child(2){animation-delay:.2s}.mc-dot:nth-child(3){animation-delay:.4s}';
  document.head.appendChild(st);
})();
setInterval(() => {
  const ov = document.getElementById('view-ov');
  let el = document.getElementById('chat-typing');
  const cardId = window._openViewId;
  if(!cardId && _tc) chatTypingLeave();
  if(!ov || !ov.classList.contains('on') || !cardId || !document.getElementById('chat-quick-bar')) { el?.remove(); _typingKey = ''; return; }
  const now = Date.now();
  const names = [];
  Object.keys(_typers).forEach(k => {
    if(_typers[k].until < now) delete _typers[k];
    else if(_typers[k].name) names.push(_typers[k].name);
  });
  if(!names.length) { el?.remove(); _typingKey = ''; return; }
  const key = names.join('|');
  if(el && key === _typingKey) return;
  _typingKey = key;
  if(!el) {
    el = document.createElement('div'); el.id = 'chat-typing';
    el.style.cssText = 'position:absolute;left:14px;bottom:62px;z-index:49;pointer-events:none';
    ov.appendChild(el);
  }
  const shown = names.slice(0, 3);
  const av = shown.map((n, i) => {
    const nm = String(typeof aliasedName === 'function' ? aliasedName(n) : n).trim();
    return `<span style="width:22px;height:22px;border-radius:50%;background:var(--accent);color:#0f0f0f;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-sizing:border-box;${i ? 'margin-left:-6px;border:2px solid var(--s2);' : ''}">${esc(nm.charAt(0).toUpperCase())}</span>`;
  }).join('');
  const more = names.length > 3 ? `<span style="font-size:11px;color:var(--t2)">+${names.length - 3}</span>` : '';
  el.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--b1);border-radius:16px;padding:4px 12px 4px 4px">${av}${more}<span><span class="mc-dot"></span><span class="mc-dot"></span><span class="mc-dot"></span></span></div>`;
}, 300);

// ответ service worker'у: какой чат сейчас открыт (чтобы не показывать лишний пуш)
if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if(e.data && e.data.type === 'whichCard' && e.ports && e.ports[0]) e.ports[0].postMessage(window._openViewId || null);
});

// вернулись в приложение с открытым чатом — убираем его пуш и подтягиваем свежие сообщения
async function _chatResumeSync(e) {
  if(!(e && e.type === 'resume') && document.visibilityState !== 'visible') return;
  const id = window._openViewId;
  if(!id || !document.getElementById('view-ov')?.classList.contains('on')) return;
  const card = cards.find(c => c.id === id); if(!card) return;
  try { window.mcClearNative?.(id, card.title); } catch(e) {}
  try { navigator.serviceWorker?.ready.then(reg => reg.getNotifications().then(list => list.forEach(n => { if((n.data?.url||'').includes('openCard='+id)) n.close(); }))); } catch(e) {}
  try {
    const { data } = await sb.from('cards').select('*').eq('id', id).maybeSingle();
    if(data && window._openViewId === id && (data.entries||[]).length !== (card.entries||[]).length) {
      const i = cards.findIndex(c => c.id === id); if(i >= 0) cards[i] = data;
      openView(id);
      if(typeof markChatRead === 'function') markChatRead(id);
    }
  } catch(e) {}
}
document.addEventListener('visibilitychange', _chatResumeSync);
window.addEventListener('focus', _chatResumeSync);
document.addEventListener('resume', _chatResumeSync);
window.addEventListener('pageshow', _chatResumeSync);
// страховка для APK: пока чат открыт и приложение на экране, раз в 4 с убираем его пуш из шторки
setInterval(() => {
  if(!window.mcClearNative || !window._openViewId || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  const c = cards.find(x => x.id === window._openViewId);
  if(c) window.mcClearNative(c.id, c.title);
}, 4000);

function toggleChatFan(cardId){
  if(_chatFanOpen) {
    // Кнопка уже открыта — повторное нажатие сразу выполняет последнее действие веера («Задача»), а не просто закрывает его
    pickChatAttachment(cardId, 'task');
    return;
  }
  _chatFanOpen = true;
  const btn = document.getElementById('chat-attach-btn');
  const petals = document.querySelectorAll('.chat-fan-petal');
  if(!btn) return;
  btn.classList.add('open');
  btn.textContent = '📦';
  // Веер: первый лепесток прямо над кнопкой, дальше по кругу вправо-вниз, с небольшим шагом между кнопками
  const radius = 66, step = 38;
  petals.forEach((p, i) => {
    const a = (i*step) * Math.PI/180;
    const x = Math.sin(a)*radius;
    const y = -Math.cos(a)*radius - 46; // -46 — та же величина, на которую поднимается сама кнопка
    p.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(1)`;
    p.classList.add('open');
  });
  document.addEventListener('click', closeChatFanOnOutsideClick);
}
function closeChatFanOnOutsideClick(){
  if(!_chatFanOpen) return;
  _chatFanOpen = false;
  const btn = document.getElementById('chat-attach-btn');
  if(btn) { btn.classList.remove('open'); btn.textContent = '📎'; }
  document.querySelectorAll('.chat-fan-petal').forEach(p => { p.style.transform = 'translate(0,0) scale(.3)'; p.classList.remove('open'); });
  document.removeEventListener('click', closeChatFanOnOutsideClick);
}

let _activeAttachEntryId = null; // "черновой" стикер, в который собираются вложения, отправленные подряд через веер

function pickChatAttachment(cardId, kind){
  closeChatFanOnOutsideClick();
  if(kind === 'task') { openChatCompose(cardId); return; }
  const inp = document.createElement('input');
  inp.type = 'file';
  if(kind === 'photo' || kind === 'video') inp.multiple = true;
  if(kind === 'photo') inp.accept = 'image/*';
  if(kind === 'video') inp.accept = 'video/*';
  inp.onchange = () => { if(inp.files && inp.files.length) sendQuickAttachment(cardId, [...inp.files]); };
  inp.click();
}

async function sendQuickAttachment(cardId, fileOrFiles){
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const file = files[0];
  toast(files.length>1 ? `Загрузка… (${files.length})` : 'Загрузка…');
  try {
    const newAtts = [];
    for(const f of files) newAtts.push(await uploadToStorage(f, card.id, null));
    const kindLabel = (file.type.startsWith('image/') ? '📷 Фото' : file.type.startsWith('video/') ? '🎥 Видео' : '📎 Файл') + (files.length>1 ? ' ×'+files.length : '');
    const myName = localStorage.getItem('mc_current_member')||currentUser?.display_name||'';

    // Если есть активный "черновой" стикер этого же чата и он мой — крепим вложение в него, как в Telegram
    const draft = card.entries.find(e=>e.id===_activeAttachEntryId && e.sessionCreator===myName);
    if(draft) {
      draft.sessionAtts = [...(draft.sessionAtts||[]), ...newAtts];
    } else {
      const entry = {
        id: uid(), text: '', date: nowStr(), done: false,
        attachments: [], sessionId: uid(), sessionNote: null, sessionAtts: newAtts,
        sessionCreator: myName,
        assigned_to: null, completions: null, deadline: null
      };
      card.entries = [entry, ...(card.entries||[])];
      _activeAttachEntryId = entry.id;
    }

    await dbUpdate(card);
    render();
    openView(cardId);
    setTimeout(()=>{ const sheet = document.querySelector('#view-ov .sheet'); if(sheet) sheet.scrollTop = 0; }, 50);
    if(Array.isArray(card.chatParticipants) && (currentSpace?.type==='family'||currentSpace?.type==='group') && typeof notifyUsers === 'function') {
      const recipientIds = chatRecipientIds(card);
      if(recipientIds.length) await notifyUsers(recipientIds, '💬 ' + card.title, `{{name}}: ${kindLabel}`, currentUser?.id, myName, `https://vales-chayv.github.io/check-list/?openSpace=${currentSpaceId}&openCard=${card.id}`);
    }
    toast('✓ Отправлено');
  } catch(e) { toast('Ошибка загрузки', true); }
}

async function openChatVoice(cardId){
  chatRecordingCardId = cardId;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    chatRecordedChunks = [];
    chatRecorder = new MediaRecorder(stream);
    chatRecorder.ondataavailable = e => { if(e.data.size>0) chatRecordedChunks.push(e.data); };
    chatRecorder.onstop = () => { stream.getTracks().forEach(t=>t.stop()); chatFinishVoice(); };
    chatRecorder.start();
    showChatVoiceUI();
  } catch(e) {
    toast('Нет доступа к микрофону', true);
  }
}
function showChatVoiceUI(){
  const div = document.createElement('div');
  div.id = 'chat-voice-ov';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px';
  div.innerHTML = `
    <div style="font-size:40px">🎙️</div>
    <div style="color:var(--t1);font-size:15px">Идёт запись…</div>
    <div style="display:flex;gap:12px">
      <button onclick="chatCancelVoice()" style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);border-radius:20px;padding:10px 20px;cursor:pointer;font-family:inherit">Отмена</button>
      <button onclick="chatStopVoice()" style="background:var(--accent);color:#0f0f0f;border:none;border-radius:20px;padding:10px 20px;font-weight:700;cursor:pointer;font-family:inherit">Готово</button>
    </div>`;
  document.body.appendChild(div);
}
function chatStopVoice(){
  if(chatRecorder && chatRecorder.state!=='inactive') chatRecorder.stop();
  document.getElementById('chat-voice-ov')?.remove();
}
function chatCancelVoice(){
  if(chatRecorder && chatRecorder.state!=='inactive'){ chatRecorder.onstop=null; chatRecorder.stop(); }
  chatRecordedChunks=[];
  document.getElementById('chat-voice-ov')?.remove();
}
// Кому слать пуш по чату: участники ЭТОГО чата (имена → аккаунты), без самого отправителя.
// onlyNames — если задан, ограничиваем получателей этими именами (задача конкретным людям).
function chatRecipientIds(card, onlyNames) {
  const low = s => String(s||'').trim().toLowerCase();
  const part = (card?.chatParticipants||[]).map(low);
  const want = Array.isArray(onlyNames) ? onlyNames.map(low) : null;
  const ids = new Set();
  [...(currentSpace?.members||[]), ...(currentSpace?.members_auth||[])].forEach(m => {
    const n = low(m?.name);
    if(m?.user_id && part.includes(n) && (!want || want.includes(n))) ids.add(m.user_id);
  });
  ids.delete(currentUser?.id);
  return [...ids];
}
// ── Закрытие чата ──
async function notifyUsers(userIds, title, body, senderId, senderName, url) {
  if(!userIds.length) return;
  try {
    await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'apikey': SB_ANON,
        'Authorization': 'Bearer ' + SB_ANON
      },
      body: JSON.stringify({ notifyUserIds: userIds, title, body, senderId, senderName, url })
    });
  } catch(e) { console.log('Push notify error:', e.message); }
}

function showChatNotice(title, body, cardId, spaceId) {
  const wrap = document.getElementById('notice-popups'); if(!wrap) return;
  const el = document.createElement('div');
  el.className = 'rem-pop';
  el.style.cssText = 'background:var(--s2);border:1px solid var(--accent);border-radius:var(--r);padding:14px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:${body?'6px':'10px'}">
      <span style="font-size:18px">${title.slice(0,2)}</span>
      <div style="flex:1;font-size:14px;font-weight:700;color:var(--t1);line-height:1.3">${esc(title.slice(2).trim())}</div>
      <button onclick="this.closest('.rem-pop').remove()" style="background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer;line-height:1;padding:0">✕</button>
    </div>
    ${body?`<div style="font-size:12px;color:var(--t2);margin-bottom:10px">${esc(body)}</div>`:''}
    ${cardId?`<button onclick="this.closest('.rem-pop').remove();openChatFromNotice('${spaceId||currentSpaceId||''}','${cardId}')" style="width:100%;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:8px;font-size:13px;font-weight:700;cursor:pointer">Открыть</button>`:''}`;
  wrap.appendChild(el);
  if(!cardId) setTimeout(()=>el.remove(), 6000);
}
async function openChatFromNotice(spaceId, cardId) {
  // перед открытием подтягиваем свежую карточку из базы (реалтайм мог пропустить обновление)
  try {
    const { data } = await sb.from('cards').select('*').eq('id', cardId).maybeSingle();
    if(data) {
      const i = cards.findIndex(c => c.id === cardId);
      if(i >= 0) cards[i] = data;
      else if(!spaceId || spaceId === currentSpaceId) cards.unshift(data);
    }
  } catch(e) {}
  return _openChatFromNoticeInner(spaceId, cardId);
}
async function _openChatFromNoticeInner(spaceId, cardId) {
  if(spaceId && spaceId !== currentSpaceId && typeof setCurrentSpace === 'function') {
    await setCurrentSpace(spaceId, true);
    setTimeout(()=>openView(cardId), 200);
  } else {
    openView(cardId);
  }
}

function isChatCreator(card) {
  const myName = localStorage.getItem('mc_current_member')||currentUser?.display_name||'';
  return card.created_by && card.created_by.toLowerCase() === myName.toLowerCase();
}
function isGroupOwner() {
  return currentSpace?.owner_id && currentUser?.id === currentSpace.owner_id;
}

async function requestCloseChat(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  if(!confirm('Закрыть чат «' + card.title + '»?')) return;
  if(isGroupOwner()) {
    await actuallyCloseChat(cardId);
    return;
  }
 card.chatStatus = 'pending_close';
  await dbUpdate(card);
  render(); openView(cardId);
  const ownerId = currentSpace?.owner_id;
  const closeReqTitle = '🔒 Запрос на закрытие чата';
  const closeReqBody = `«${card.title}» — просит закрыть ${localStorage.getItem('mc_current_member')||''}`;
  if(ownerId) await notifyUsers([ownerId], closeReqTitle, closeReqBody, null, null, `https://vales-chayv.github.io/check-list/?openSpace=${currentSpaceId}&openCard=${card.id}`);
  toast('✓ Запрос отправлен создателю группы');
}

async function actuallyCloseChat(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  card.chatStatus = 'closed';
  await dbUpdate(card);
  render(); openView(cardId);
 const closedTitle = '🔒 Чат закрыт';
  const closedBody = `«${card.title}» закрыт и перемещён в архив`;
  // Уведомляем через push только тех, у кого есть привязанный аккаунт (members_auth), т.к. push идёт по user_id
   const authIds = (currentSpace?.members_auth||[]).map(m=>m.user_id).filter(Boolean);
  const _closedIds = chatRecipientIds(card);
  if(_closedIds.length) await notifyUsers(_closedIds, closedTitle, closedBody, null, null, `https://vales-chayv.github.io/check-list/?openSpace=${currentSpaceId}&openCard=${card.id}`);
  if(typeof logEvent === 'function') logEvent(currentSpaceId, currentSpace?.name, 'chat_closed', `закрыл(а) чат «${card.title}»`, cardId);
  toast('✓ Чат закрыт');
}

async function rejectCloseChat(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  card.chatStatus = 'active';
  await dbUpdate(card);
  render(); openView(cardId);
  toast('Запрос отклонён, чат снова активен');
}

async function chatFinishVoice(){
  if(!chatRecordedChunks.length) return;
  const blob = new Blob(chatRecordedChunks, {type:'audio/webm'});
  const file = new File([blob], 'voice_'+Date.now()+'.webm', {type:'audio/webm'});
  const card = cards.find(c=>c.id===chatRecordingCardId); if(!card) return;
  toast('Загрузка голосового…');
  try {
    const att = await uploadToStorage(file, card.id, null);
  const entry = {
      id: uid(), text: '', date: nowStr(), done: false,
      attachments: [], sessionId: uid(),
      sessionNote: null, sessionAtts: [att], sessionCreator: localStorage.getItem('mc_current_member')||currentUser?.display_name||'',
      assigned_to: null, completions: null, deadline: null
    };
    card.entries = [entry, ...(card.entries||[])];
    await dbUpdate(card);
    render();
    openView(card.id);
    setTimeout(()=>{ const sheet = document.querySelector('#view-ov .sheet'); if(sheet) sheet.scrollTop = 0; }, 50);
    toast('✓ Голосовое отправлено');
    if(Array.isArray(card.chatParticipants) && (currentSpace?.type==='family'||currentSpace?.type==='group') && typeof notifyUsers === 'function') {
      const recipientIds = chatRecipientIds(card);
      if(recipientIds.length) await notifyUsers(recipientIds, '💬 ' + card.title, `{{name}}: 🎙️ Голосовое сообщение`, currentUser?.id, entry.sessionCreator, `https://vales-chayv.github.io/check-list/?openSpace=${currentSpaceId}&openCard=${card.id}`);
    }
  } catch(e) {
    toast('Ошибка загрузки', true);
  }
}
