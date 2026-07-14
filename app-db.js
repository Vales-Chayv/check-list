// ═══════════════════════════════════════════
//  INDEXEDDB — LOCAL STORAGE
// ═══════════════════════════════════════════
const DB_NAME = 'mycards-db', DB_VER = 4;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
     if (!d.objectStoreNames.contains('cards')) d.createObjectStore('cards', {keyPath:'id'});
      if (d.objectStoreNames.contains('categories')) d.deleteObjectStore('categories');
      d.createObjectStore('categories', {keyPath:'catKey'});
     if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', {keyPath:'id', autoIncrement:true});
if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', {keyPath:'key'});
if (!d.objectStoreNames.contains('offline_files')) d.createObjectStore('offline_files', {keyPath:'tempId'});
if (!d.objectStoreNames.contains('events')) d.createObjectStore('events', {keyPath:'id'});
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function dbLocal(store, mode, fn) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const s = tx.objectStore(store);
    const req = fn(s);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const local = {
  getAll: store => dbLocal(store, 'readonly', s => s.getAll()),
  put: (store, val) => dbLocal(store, 'readwrite', s => s.put(val)),
  delete: (store, key) => dbLocal(store, 'readwrite', s => s.delete(key)),
  clear: store => dbLocal(store, 'readwrite', s => s.clear()),
  putAll: async (store, items) => {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      items.forEach(item => s.put(item));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  getMeta: key => dbLocal('meta', 'readonly', s => s.get(key)).then(r => r?.value),
  setMeta: (key, value) => dbLocal('meta', 'readwrite', s => s.put({key, value})),
};

// ═══════════════════════════════════════════
//  SYNC QUEUE
// ═══════════════════════════════════════════
async function queueOp(op) {
  // op = {type:'insert'|'update'|'delete', data, timestamp}
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('queue', 'readwrite');
    const s = tx.objectStore('queue');
    const req = s.add({...op, timestamp: Date.now()});
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getQueue() {
  return dbLocal('queue', 'readonly', s => s.getAll());
}

async function clearQueueItem(id) {
  return dbLocal('queue', 'readwrite', s => s.delete(id));
}

async function processSyncQueue() {
  if (!navigator.onLine) return;
  const queue = await getQueue();
  if (!queue.length) return;
  console.log(`Syncing ${queue.length} pending operations...`);
  for (const op of queue) {
    try {
      if (op.type === 'insert') {
        const {error} = await sb.from('cards').insert(op.data);
        if (error && error.code !== '23505') throw error; // ignore duplicate
      } else if (op.type === 'update') {
        const {id, ...data} = op.data;
        const {error} = await sb.from('cards').update(data).eq('id', id);
        if (error) throw error;
      } else if (op.type === 'delete') {
        const {error} = await sb.from('cards').delete().eq('id', op.data.id);
        if (error) throw error;
      } else if (op.type === 'insert_cat') {
        const {error} = await sb.from('categories').insert(op.data);
        if (error && error.code !== '23505') throw error;
      }
      await clearQueueItem(op.id);
    } catch(e) {
      console.log('Sync error for op', op.type, e.message);
    }
  }
  setSyncDot('ok');
}

// ═══════════════════════════════════════════
//  ONLINE/OFFLINE EVENTS
// ═══════════════════════════════════════════
window.addEventListener('online', async () => {
  setSyncDot('sync');
  await processSyncQueue();
  await syncOfflineFiles();
  await syncFromServer();
  setSyncDot('ok');
});
window.addEventListener('offline', () => setSyncDot('err'));
async function loadData() {
  setSyncDot('sync');
  // 1. Show local data immediately
  try {
   const [_allLocalCards, localCats] = await Promise.all([local.getAll('cards'), local.getAll('categories')]);
    const localCards = _allLocalCards.filter(c => !currentSpaceId || c.space_id === currentSpaceId);
    if (localCards.length || localCats.length) {
      cards = localCards.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
      cats = localCats || [];
      render();
    } else {
      document.getElementById('scroll').innerHTML='<div class="loading"><div class="spinner"></div><span>Загрузка...</span></div>';
    }
  } catch(e) {
    document.getElementById('scroll').innerHTML='<div class="loading"><div class="spinner"></div><span>Загрузка...</span></div>';
  }
 // 2. Sync from server
  await syncFromServer();
  // 3. Фоновая предзагрузка карточек всех кабинетов в кэш (для мгновенного переключения)
  prefetchAllSpaces();
}

async function prefetchAllSpaces() {
  if (!navigator.onLine) return;
  if (typeof spaces === 'undefined' || !spaces || !spaces.length) return;
  setSyncDot('sync'); // держим индикатор «синим», пока не закэшируем все кабинеты
  try {
    const ids = spaces.map(s => s.id);
    const { data, error } = await sb.from('cards').select('*').in('space_id', ids);
    if (!error && data) {
      const others = data.filter(c => c.space_id !== currentSpaceId);
      if (others.length) await local.putAll('cards', others);
    }
  } catch (e) { /* тихо */ }
  setSyncDot('ok'); // теперь все кабинеты в кэше — можно уходить в офлайн
}

async function syncFromServer() {
  if (!navigator.onLine) { setSyncDot('err'); render(); return; }
  try {
    let cardsQuery = sb.from('cards').select('*').order('created_at',{ascending:false});
    if(currentSpaceId) cardsQuery = cardsQuery.eq('space_id', currentSpaceId);
    let catsQuery = sb.from('categories').select('*');
    if(currentSpaceId) catsQuery = catsQuery.eq('space_id', currentSpaceId);
    else catsQuery = catsQuery.is('space_id', null);
    const [cr,kr] = await Promise.all([cardsQuery, catsQuery]);
    if(cr.error) throw cr.error;
    if(kr.error) throw kr.error;
    // обновляем в кэше только текущий кабинет; карточки других кабинетов оставляем
    const _allLocal = await local.getAll('cards');
    const _keep = _allLocal.filter(c => c.space_id !== currentSpaceId);
    await local.clear('cards');
    if(_keep.length) await local.putAll('cards', _keep);
    if(cr.data?.length) await local.putAll('cards', cr.data);
    await local.clear('categories');
    if(kr.data?.length) await local.putAll('categories', kr.data);
    cards = cr.data||[];
    cats = kr.data || [];
    const todayStr = new Date().toISOString().slice(0,10);
cards.forEach(c => { if(c.deadline===todayStr && !c.today) c.today = true; });
applyCatsOrder(); setSyncDot('ok'); render(); startIntervalReminders();
  } catch(e) {
    console.log('Server sync error:', e.message);
    setSyncDot('err');
    // Still render what we have (even if empty)
    if (!cats.length) cats = [{name:'Работа',color:'#e8c56a'},{name:'Личное',color:'#5b9ee8'},{name:'Проекты',color:'#5bb87a'}];
    render();
  }
}

async function dbInsert(card) {
  await local.put('cards', card);
  if (navigator.onLine) {
    setSyncDot('sync');
    const {error}=await sb.from('cards').insert(card);
    if(error){ if(error.code!=='23505') await queueOp({type:'insert',data:card}); setSyncDot('err'); }
    else setSyncDot('ok');
  } else { await queueOp({type:'insert',data:card}); setSyncDot('err'); }
}

async function dbUpdate(card) {
  await local.put('cards', card);
  if (navigator.onLine) {
    setSyncDot('sync');
    const {id,...d}=card; const {error}=await sb.from('cards').update(d).eq('id',id);
    if(error){ await queueOp({type:'update',data:card}); setSyncDot('err'); }
    else setSyncDot('ok');
  } else { await queueOp({type:'update',data:card}); setSyncDot('err'); }
}

async function dbDelete(id) {
  // Удаляем файлы из Storage
  const card = cards.find(c=>c.id===id);
  if(card && navigator.onLine) {
    const allAtts = [
      ...(card.attachments||[]),
      ...(card.entries||[]).flatMap(e=>[...(e.attachments||[]),...(e.sessionAtts||[])])
    ].filter(a=>a.data);
    for(const att of allAtts) {
      try {
      if(att.data.includes('supabase')) {
  const path = att.data.split('/attachments/')[1];
  if(path) await sb.storage.from('attachments').remove([path]);
}
// base64 файлы просто не сохраняем — они исчезнут вместе с карточкой
      } catch(e) {}
    }
  }
  await local.delete('cards', id);
  if (navigator.onLine) {
    setSyncDot('sync');
    const {error}=await sb.from('cards').delete().eq('id',id);
    if(error){ await queueOp({type:'delete',data:{id}}); setSyncDot('err'); }
    else setSyncDot('ok');
  } else { await queueOp({type:'delete',data:{id}}); setSyncDot('err'); }
}

async function dbAddCat(cat) {
  const catWithSpace = {...cat, space_id: currentSpaceId||null};
  await local.put('categories', catWithSpace);
  if (navigator.onLine) {
    const {error}=await sb.from('categories').insert(catWithSpace);
    if(error && error.code!=='23505') await queueOp({type:'insert_cat',data:catWithSpace});
  } else { await queueOp({type:'insert_cat',data:catWithSpace}); }
}

// ═══════════════════════════════════════════
//  REALTIME — AUTO SYNC CARDS
// ═══════════════════════════════════════════
let realtimeCardChannel = null;

function subscribeRealtimeCards(spaceId) {
  unsubscribeRealtimeCards();
  realtimeCardChannel = sb.channel('cards:' + spaceId)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'cards',
      filter: `space_id=eq.${spaceId}`
    }, payload => handleRealtimeCard(payload))
    .subscribe();
}

function unsubscribeRealtimeCards() {
  if(realtimeCardChannel) { sb.removeChannel(realtimeCardChannel); realtimeCardChannel = null; }
}

function handleRealtimeCard(payload) {
  const { eventType, new: n, old: o } = payload;
  if(eventType === 'INSERT') {
    if(!cards.find(c => c.id === n.id)) { cards.unshift(n); local.put('cards', n); }
} else if(eventType === 'UPDATE') {
    if(n.space_id && currentSpaceId && n.space_id !== currentSpaceId) {
      cards = cards.filter(c => c.id !== n.id); local.delete('cards', n.id); // карточку перенесли в другой кабинет
    } else {
      const idx = cards.findIndex(c => c.id === n.id);
      if(idx !== -1) { cards[idx] = n; local.put('cards', n); }
      else { cards.unshift(n); local.put('cards', n); }
    }
  } else if(eventType === 'DELETE') {
    cards = cards.filter(c => c.id !== o.id);
    local.delete('cards', o.id);
  }
  render();
}
// ═══════════════════════════════════════════
//  OFFLINE FILES
// ═══════════════════════════════════════════
async function saveOfflineFile(tempId, cardId, entryId, file, base64) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('offline_files', 'readwrite');
    const s = tx.objectStore('offline_files');
    const req = s.put({tempId, cardId, entryId, name:file.name, type:file.type, base64});
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getOfflineFiles() {
  return dbLocal('offline_files', 'readonly', s => s.getAll());
}

async function deleteOfflineFile(tempId) {
  return dbLocal('offline_files', 'readwrite', s => s.delete(tempId));
}

async function syncOfflineFiles() {
  if(!navigator.onLine) return;
  const files = await getOfflineFiles();
  if(!files.length) return;
  for(const f of files) {
    try {
      const blob = await fetch(f.base64).then(r=>r.blob());
      const file = new File([blob], f.name, {type:f.type});
      const att = await uploadToStorage(file);
      // Update card entry with real URL
      const card = cards.find(c=>c.id===f.cardId);
      if(card) {
        const entries = card.entries||[];
        const entry = entries.find(e=>e.id===f.entryId);
        if(entry) {
          entry.sessionAtts = (entry.sessionAtts||[]).map(a=>a.data===f.base64?att:a);
        } else {
          card.attachments = (card.attachments||[]).map(a=>a.data===f.base64?att:a);
        }
        await dbUpdate(card);
      }
      await deleteOfflineFile(f.tempId);
    } catch(e) {
      console.log('Offline file sync error:', e.message);
    }
  }
}

