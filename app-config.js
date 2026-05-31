
// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
const SB_URL = 'https://rmlcbznnoroumjsqoluz.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbGNiem5ub3JvdW1qc3FvbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDUyMjYsImV4cCI6MjA5MzcyMTIyNn0.9DlXlx8_X1S5kVAdzpTPNyq6rChlMNDkJbDXQIud62I';
const FUNC_URL = 'https://rmlcbznnoroumjsqoluz.supabase.co/functions/v1/send-reminders';
const VAPID_PUB = 'BFb2H0DTunN23F8-C7Db5WNB1wE7Uc5aT_5qGDTIq57d91YdeIPlJZfxNbPoRnElGKOF_254YNTTqSLpX4ZPkZ0';
const COLORS = [
  '#e8c56a','#e8a83a','#e86060','#e85bb0','#c45be8','#a07de8',
  '#5b9ee8','#5bc8e8','#5be8d4','#5bb87a','#8de85b','#c8e85b',
  '#ffffff','#cccccc','#999999','#666666','#444444','#222222',
  '#e8d4b0','#b08060','#804020','#e8c0a0','#a06840','#603010'
];
const ST_LABELS = {new:'Новая',in_progress:'В процессе',waiting:'Ожидание',done:'Готово'};
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const sb = supabase.createClient(SB_URL, SB_ANON);

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
let cards = [], cats = [], view = 'cards', filterCat = 'all';
let editId = null, tempAtt = [], tempEntries = [], tempHist = [], tempRelIds = [];
let remOn = false, ballVal = '', freqVal = 'daily', customDays = [];
let newCatColor = COLORS[0], notifEnabled = true;
let expandedCards = new Set(), originalState = null;

// ═══════════════════════════════════════════
//  SUPABASE STORAGE
// ═══════════════════════════════════════════
async function uploadToStorage(file) {
  const path = uid() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { data, error } = await sb.storage.from('attachments').upload(path, file);
  if(error) throw error;
  const { data: { publicUrl } } = sb.storage.from('attachments').getPublicUrl(path);
  return { id: uid(), name: file.name, type: file.type, data: publicUrl };
}
