// ═══════════════════════════════════════════
//  INDEXEDDB — LOCAL STORAGE
// ═══════════════════════════════════════════
const DB_NAME = 'mycards-db', DB_VER = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('cards')) d.createObjectStore('cards', {keyPath:'id'});
      if (!d.objectStoreNames.contains('categories')) d.createObjectStore('categories', {keyPath:'name'});
      if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', {keyPath:'id', autoIncrement:true});
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', {keyPath:'key'});
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
  await syncFromServer();
  setSyncDot('ok');
});
window.addEventListener('offline', () => setSyncDot('err'));
async function loadData() {
  setSyncDot('sync');
  // 1. Show local data immediately
  try {
    const [localCards, localCats] = await Promise.all([local.getAll('cards'), local.getAll('categories')]);
    if (localCards.length || localCats.length) {
      cards = localCards.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
      cats = localCats.length ? localCats : [{name:'Работа',color:'#e8c56a'},{name:'Личное',color:'#5b9ee8'},{name:'Проекты',color:'#5bb87a'}];
      render();
    } else {
      document.getElementById('scroll').innerHTML='<div class="loading"><div class="spinner"></div><span>Загрузка...</span></div>';
    }
  } catch(e) {
    document.getElementById('scroll').innerHTML='<div class="loading"><div class="spinner"></div><span>Загрузка...</span></div>';
  }
  // 2. Sync from server
  await syncFromServer();
}

async function syncFromServer() {
  if (!navigator.onLine) { setSyncDot('err'); return; }
  try {
    const [cr,kr] = await Promise.all([
      sb.from('cards').select('*').order('created_at',{ascending:false}),
      sb.from('categories').select('*')
    ]);
    if(cr.error) throw cr.error;
    if(kr.error) throw kr.error;
    // Update local
    await local.clear('cards');
    await local.clear('categories');
    if(cr.data?.length) await local.putAll('cards', cr.data);
    if(kr.data?.length) await local.putAll('categories', kr.data);
    cards = cr.data||[];
    cats = kr.data?.length ? kr.data : [{name:'Работа',color:'#e8c56a'},{name:'Личное',color:'#5b9ee8'},{name:'Проекты',color:'#5bb87a'}];
    setSyncDot('ok'); render();
  } catch(e) { setSyncDot('err'); }
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
  await local.delete('cards', id);
  if (navigator.onLine) {
    setSyncDot('sync');
    const {error}=await sb.from('cards').delete().eq('id',id);
    if(error){ await queueOp({type:'delete',data:{id}}); setSyncDot('err'); }
    else setSyncDot('ok');
  } else { await queueOp({type:'delete',data:{id}}); setSyncDot('err'); }
}

async function dbAddCat(cat) {
  await local.put('categories', cat);
  if (navigator.onLine) {
    const {error}=await sb.from('categories').insert(cat);
    if(error && error.code!=='23505') await queueOp({type:'insert_cat',data:cat});
  } else { await queueOp({type:'insert_cat',data:cat}); }
}

