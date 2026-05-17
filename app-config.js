<script>
// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
const SB_URL = 'https://rmlcbznnoroumjsqoluz.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbGNiem5ub3JvdW1qc3FvbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDUyMjYsImV4cCI6MjA5MzcyMTIyNn0.9DlXlx8_X1S5kVAdzpTPNyq6rChlMNDkJbDXQIud62I';
const FUNC_URL = 'https://rmlcbznnoroumjsqoluz.supabase.co/functions/v1/send-reminders';
const VAPID_PUB = 'BFb2H0DTunN23F8-C7Db5WNB1wE7Uc5aT_5qGDTIq57d91YdeIPlJZfxNbPoRnElGKOF_254YNTTqSLpX4ZPkZ0';
const COLORS = ['#e8c56a','#5b9ee8','#5bb87a','#a07de8','#e86060','#e88a3a','#5be8d4','#e85bb0'];
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

