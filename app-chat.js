// ═══════════════════════════════════════════
//  ГРУППОВОЙ КАБИНЕТ КАК ЧАТ
// ═══════════════════════════════════════════

function handleNewCardClick(){
  if(currentSpace?.type==='family' || currentSpace?.type==='group') quickCreateChat();
  else openEdit();
}

async function quickCreateChat(){
  const title = prompt('Название чата:');
  if(!title || !title.trim()) return;
  const card = {
    id: uid(), created_at: today(), space_id: currentSpaceId,
    created_by: localStorage.getItem('mc_current_member')||currentUser?.display_name||'',
    title: title.trim(), body: '', category: cats[0]?.name || '',
    status: 'new', priority: 'normal', deadline: null, ball: '',
    assigned_to: null, attachments: [], entries: [], entryGroups: [],
    reminder: {enabled:false, freq:'daily', days:[], intervalMin:null},
    history: [{date: nowStr(), text: 'Чат создан', type:'created'}],
    related_ids: [], today: false, pinned: false,
    chatParticipants: (currentSpace?.members||[]).map(m=>m.name) // пока = все участники группы, точечный выбор — отдельная фаза
  };
  cards.unshift(card);
  render();
  toast('✓ Чат создан');
    await dbInsert(card);
  if(typeof logEvent === 'function') logEvent(currentSpaceId, currentSpace?.name, 'chat_created', `создал(а) чат «${title.trim()}»`, card.id);
  openView(card.id);
}

// ── Написать в чат — пока переиспользует существующий попап быстрого добавления ──
function openChatCompose(cardId){
  openAddEntry(cardId);
}

// ── Голосовое сообщение ──
let chatRecorder = null, chatRecordedChunks = [], chatRecordingCardId = null;

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
// ── Закрытие чата ──
async function notifyUsers(userIds, title, body) {
  if(!userIds.length) return;
  try {
    await fetch(FUNC_URL, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ notifyUserIds: userIds, title, body })
    });
  } catch(e) { console.log('Push notify error:', e.message); }
}

function showChatNotice(title, body, cardId) {
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
    ${cardId?`<button onclick="this.closest('.rem-pop').remove();openView('${cardId}')" style="width:100%;background:var(--accent);color:#0f0f0f;border:none;border-radius:var(--rsm);padding:8px;font-size:13px;font-weight:700;cursor:pointer">Открыть</button>`:''}`;
  wrap.appendChild(el);
  if(!cardId) setTimeout(()=>el.remove(), 6000);
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
  showChatNotice(closeReqTitle, closeReqBody, cardId);
  if(ownerId) await notifyUsers([ownerId], closeReqTitle, closeReqBody);
  toast('✓ Запрос отправлен создателю группы');
}

async function actuallyCloseChat(cardId) {
  const card = cards.find(c=>c.id===cardId); if(!card) return;
  card.chatStatus = 'closed';
  await dbUpdate(card);
  render(); openView(cardId);
 const closedTitle = '🔒 Чат закрыт';
  const closedBody = `«${card.title}» закрыт и перемещён в архив`;
  showChatNotice(closedTitle, closedBody, cardId);
  // Уведомляем через push только тех, у кого есть привязанный аккаунт (members_auth), т.к. push идёт по user_id
   const authIds = (currentSpace?.members_auth||[]).map(m=>m.user_id).filter(Boolean);
  if(authIds.length) await notifyUsers(authIds, closedTitle, closedBody);
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
      id: uid(), text: '🎙️ Голосовое сообщение', date: nowStr(), done: false,
      attachments: [], sessionId: uid(),
      sessionNote: null, sessionAtts: [att], sessionCreator: localStorage.getItem('mc_current_member')||currentUser?.display_name||'',
      assigned_to: null, completions: null, deadline: null
    };
    card.entries = [...(card.entries||[]), entry];
    await dbUpdate(card);
    render();
    openView(card.id);
    toast('✓ Голосовое отправлено');
  } catch(e) {
    toast('Ошибка загрузки', true);
  }
}