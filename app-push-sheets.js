// ═══════════════════════════════════════════
//  ЭКРАНЫ ПОСЛЕ НАЖАТИЯ НА PUSH: «Срок записи», «Событие», «Ваш день»
//  Ничего не заменяет: окна «Сроки сегодня» (openDueDialog) и «Напоминания» (evPopupCheck) работают как раньше.
//  Глобальные имена: mcPushEntrySheet, mcPushEventSheet, mcPushDaySheet, mcPsClose
// ═══════════════════════════════════════════
(function () {
  'use strict';
  const DAY = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const MON = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const dow = d => (d.getDay() + 6) % 7; // пн = 0
  const todayS = () => (typeof calTodayStr === 'function' ? calTodayStr() : ymd(new Date()));
  const dShort = s => { const d = parse(s); return d ? DAY[dow(d)].toLowerCase() + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
  const nowS = () => (typeof nowStr === 'function' ? nowStr() : new Date().toISOString());
  const plural = (n, a, b, c) => { const x = n % 100, y = n % 10; return x >= 11 && x <= 14 ? c : y === 1 ? a : y >= 2 && y <= 4 ? b : c; };
  const quietDays = () => { try { const q = JSON.parse(localStorage.getItem('mc_quiet_days') || '[]'); return Array.isArray(q) && q.length < 7 ? q : []; } catch (_) { return []; } };
  let _timer = null;

  // ── общая оболочка: затемнение + нижний лист ──
  function css() {
    if (document.getElementById('ps-css')) return;
    const st = document.createElement('style'); st.id = 'ps-css';
    st.textContent = `
#ps-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2000;display:flex;align-items:flex-end;justify-content:center}
@media(min-width:600px){#ps-ov{align-items:center}}
#ps-ov .ps-sh{background:var(--s1);border:1px solid var(--b1);border-radius:20px 20px 0 0;width:100%;max-width:440px;max-height:88vh;overflow-y:auto;box-sizing:border-box;padding:12px 18px calc(18px + env(safe-area-inset-bottom,0px))}
@media(min-width:600px){#ps-ov .ps-sh{border-radius:20px}}
#ps-ov .ps-grab{width:38px;height:4px;border-radius:9px;background:var(--b1);margin:0 auto 12px}
#ps-ov .ps-lbl{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
#ps-ov .ps-t{font-size:18px;font-weight:600;line-height:1.35;margin:6px 0 10px;word-break:break-word}
#ps-ov .ps-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
#ps-ov .ps-chip{font-size:12px;background:var(--s2);border:1px solid var(--b1);border-radius:999px;padding:4px 10px;color:var(--t1);max-width:100%;word-break:break-word}
#ps-ov .ps-bar{height:7px;border-radius:99px;background:var(--s2);overflow:hidden;margin:5px 0 12px}
#ps-ov .ps-bar i{display:block;height:100%;background:var(--accent);transition:width .3s}
#ps-ov .ps-btns{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
#ps-ov .ps-btn{flex:1;min-width:120px;border-radius:12px;padding:12px 10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid var(--b1);background:var(--s2);color:var(--t1)}
#ps-ov .ps-btn.p{background:var(--accent);border-color:var(--accent);color:#0f0f0f}
#ps-ov .ps-btn[disabled]{opacity:.5}
#ps-ov .ps-menu{margin-top:8px;background:var(--s2);border:1px solid var(--b1);border-radius:12px;overflow:hidden}
#ps-ov .ps-menu button{display:block;width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--b1);color:var(--t1);padding:12px;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer}
#ps-ov .ps-menu button:first-child{border-top:0}
#ps-ov .ps-menu small{color:var(--t3)}
#ps-ov .ps-res{font-size:13px;color:var(--accent);min-height:18px;margin-top:8px}
#ps-ov .ps-row{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--b1);font-size:14px}
#ps-ov .ps-row:first-of-type{border-top:0}
#ps-ov .ps-tm{width:46px;flex:none;color:var(--t2);font-variant-numeric:tabular-nums;font-size:13px}
#ps-ov .ps-tx{flex:1;min-width:0;word-break:break-word;cursor:pointer}
#ps-ov .ps-tx small{display:block;color:var(--t3);font-size:11.5px;margin-top:1px}
#ps-ov .ps-cb{box-sizing:border-box;width:20px;height:20px;border:2px solid var(--t2);border-radius:6px;flex:none;cursor:pointer;display:grid;place-items:center;font-size:12px;color:#0f0f0f}
#ps-ov .ps-row.dn .ps-cb{background:var(--green,#5bb87a);border-color:var(--green,#5bb87a)}
#ps-ov .ps-row.dn .ps-tx{text-decoration:line-through;opacity:.55}
#ps-ov .ps-row.past{opacity:.5}
#ps-ov .ps-dot{width:10px;height:10px;border-radius:50%;flex:none;margin:4px 5px 0 5px}`;
    document.head.appendChild(st);
  }
  function open(html) {
    css(); mcPsClose();
    const ov = document.createElement('div'); ov.id = 'ps-ov';
    ov.innerHTML = '<div class="ps-sh"><div class="ps-grab"></div>' + html + '</div>';
    ov.addEventListener('click', e => { if (e.target === ov) mcPsClose(); });
    document.body.appendChild(ov);
    return ov;
  }
  function mcPsClose() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    const o = document.getElementById('ps-ov'); if (o) o.remove();
  }
  const res = t => { const r = document.getElementById('ps-res'); if (r) r.textContent = t; };

  // ── данные ──
  async function getCard(cardId) {
    try { const { data } = await sb.from('cards').select('*').eq('id', cardId).maybeSingle(); if (data) return data; } catch (_) {}
    try { const l = (await local.getAll('cards')).find(c => c.id === cardId); if (l) return l; } catch (_) {}
    return (typeof cards !== 'undefined' && cards.find(c => c.id === cardId)) || null;
  }
  async function saveCard(c) {
    const loc = typeof cards !== 'undefined' ? cards.find(x => x.id === c.id) : null;
    if (loc && loc !== c) Object.assign(loc, c);
    try { await dbUpdate(c); } catch (err) { if (typeof toast === 'function') toast('Ошибка синхронизации', true); return false; }
    try { if (typeof render === 'function') render(); } catch (_) {}
    return true;
  }
  const nearest = c => { const a = (c.entries || []).filter(x => x && !x.done && x.deadline).map(x => x.deadline).sort(); return a[0] || null; };
  function markDone(c, e) { // та же логика, что в окне «Сроки сегодня» (dueDone)
    e.done = true;
    c.deadline = nearest(c);
    if (!c.pinned && (c.entries || []).length && c.entries.every(x => x.done)) {
      c.status = 'done';
      c.history = [...(c.history || []), { date: nowS(), text: 'Все записи выполнены → Готово', type: 'status' }];
    }
  }
  function stats(c) {
    const es = (c.entries || []).filter(x => x && (x.text || (x.attachments || []).length));
    return { n: es.length, done: es.filter(x => x.done).length };
  }
  async function openCardFrom(spaceId, cardId, entryId) {
    mcPsClose();
    let wait = 900;
    try {
      if (spaceId && typeof currentSpaceId !== 'undefined' && spaceId !== currentSpaceId && typeof setCurrentSpace === 'function') {
        await setCurrentSpace(spaceId, true);
        setTimeout(() => { if (typeof openView === 'function') openView(cardId); }, 600);
        wait = 1500;
      } else if (typeof openView === 'function') openView(cardId);
    } catch (_) {}
    if (entryId) setTimeout(() => { // подсветить запись на 3 секунды, как раньше при нажатии на push
      const el = document.querySelector('#view-ov .swipe-content[data-entryid="' + String(entryId).replace(/"/g, '') + '"]');
      if (el) { el.scrollIntoView({ block: 'center' }); el.style.background = 'rgba(232,197,106,.28)'; el.style.borderRadius = '6px'; setTimeout(() => { el.style.background = 'transparent'; }, 3000); }
    }, wait);
  }
  const spaceName = id => { try { return (spaces.find(s => s.id === id) || {}).name || ''; } catch (_) { return ''; } };

  // ── «Напомнить позже»: сервер пришлёт push в нужный момент (работает и при закрытом приложении) ──
  const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  async function remindAt(kind, ref, when) {
    try {
      const r = await fetch(FUNC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON }, body: JSON.stringify({ snooze: Object.assign({ kind, fireAt: when.toISOString() }, ref), userId: currentUser && currentUser.id }) });
      if (!r.ok) throw new Error(r.status);
      const same = ymd(when) === ymd(new Date());
      let t = '⏰ Напомню ' + (same ? 'сегодня' : dShort(ymd(when))) + ' в ' + hm(when);
      if (quietDays().includes(dow(when))) t += '. Это тихий день: напоминание придёт утром первого рабочего дня.';
      res(t); const m = document.getElementById('ps-menu'); if (m) m.innerHTML = '';
      return true;
    } catch (_) { res('Не удалось поставить напоминание. Проверьте интернет и попробуйте ещё раз.'); return false; }
  }

  // ═════════ 1. СРОК ЗАПИСИ ═════════
  let S = null; // текущая запись: {c, e}
  async function mcPushEntrySheet(spaceId, cardId, entryId) {
    const c = await getCard(cardId);
    if (!c) { if (typeof toast === 'function') toast('Карточка не найдена', true); return; }
    const e = (c.entries || []).find(x => x && x.id === entryId);
    S = { c, e, spaceId: c.space_id || spaceId };
    const st = stats(c);
    const files = e ? (e.attachments || []).length + (e.sessionAtts || []).length : 0;
    let h;
    if (!e || e.done) {
      h = `<div class="ps-lbl" style="color:var(--green,#5bb87a)">✓ Уже сделано</div>
        <div class="ps-t" dir="auto">${E(e ? plain(e.text) : 'Запись уже выполнена или удалена')}</div>
        <div class="ps-chips"><span class="ps-chip">🏷 ${E((c.category ? c.category + ' › ' : '') + (c.title || ''))}</span></div>
        <div class="ps-btns"><button class="ps-btn p" onclick="mcPsOpenCard()">Открыть карточку →</button><button class="ps-btn" onclick="mcPsClose()">Закрыть</button></div>`;
    } else {
      const d = e.deadline ? diffDays(e.deadline, todayS()) : null;
      const lbl = d === null ? '⏰ Запись' : d < 0 ? '⏰ Просрочено ' + (-d) + ' ' + plural(-d, 'день', 'дня', 'дней') : d === 0 ? '⏰ Срок сегодня' : d === 1 ? '⏰ Срок завтра' : '⏰ Срок через ' + d + ' дн.';
      const col = d !== null && d <= 0 ? 'var(--red,#e86060)' : 'var(--accent)';
      h = `<div class="ps-lbl" style="color:${col}">${lbl}</div>
        <div class="ps-t" id="ps-et" dir="auto">${E(plain(e.text) || (files ? 'Запись с файлами' : 'Запись без текста'))}</div>
        <div class="ps-chips">
          <span class="ps-chip">🏷 ${E((c.category ? c.category + ' › ' : '') + (c.title || ''))}</span>
          ${e.deadline ? `<span class="ps-chip">📅 ${E(dShort(e.deadline))}</span>` : ''}
          ${files ? `<span class="ps-chip">📎 ${files} ${plural(files, 'файл', 'файла', 'файлов')}</span>` : ''}
          ${(typeof spaces !== 'undefined' && spaces.length > 1 && spaceName(c.space_id)) ? `<span class="ps-chip">🗂 ${E(spaceName(c.space_id))}</span>` : ''}
        </div>
        ${st.n ? `<div style="font-size:12px;color:var(--t2)">В карточке выполнено <b id="ps-pc">${st.done}</b> из ${st.n}</div><div class="ps-bar"><i id="ps-pb" style="width:${Math.round(st.done / st.n * 100)}%"></i></div>` : ''}
        <div class="ps-btns"><button class="ps-btn p" id="ps-done" onclick="mcPsEntryDone()">✓ Выполнено</button><button class="ps-btn" onclick="mcPsSnoozeMenu()">⏰ Отложить ▾</button></div>
        <div id="ps-menu"></div><div class="ps-res" id="ps-res"></div>
        <div class="ps-btns"><button class="ps-btn" onclick="mcPsOpenCard()">Открыть карточку →</button></div>`;
    }
    open(h);
  }
  function mcPsOpenCard() { if (S) openCardFrom(S.spaceId, S.c.id, S.e && S.e.id); }
  async function mcPsEntryDone() {
    if (!S || !S.e) return;
    const b = document.getElementById('ps-done'); if (b) b.disabled = true;
    markDone(S.c, S.e);
    const ok = await saveCard(S.c);
    if (!ok) { S.e.done = false; if (b) b.disabled = false; return; }
    const st = stats(S.c);
    const t = document.getElementById('ps-et'); if (t) { t.style.textDecoration = 'line-through'; t.style.opacity = '.55'; }
    const pc = document.getElementById('ps-pc'); if (pc) pc.textContent = st.done;
    const pb = document.getElementById('ps-pb'); if (pb && st.n) pb.style.width = Math.round(st.done / st.n * 100) + '%';
    res(S.c.status === 'done' ? '✓ Запись выполнена. Все записи сделаны, карточка перенесена в «Готово».' : '✓ Запись выполнена. В карточке осталось ' + (st.n - st.done) + '.');
  }
  function mcPsSnoozeMenu() {
    const m = document.getElementById('ps-menu'); if (!m) return;
    if (m.innerHTML) { m.innerHTML = ''; return; }
    const now = new Date(), t = parse(todayS()), q = quietDays();
    const eve = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0);
    const mh = parseInt(localStorage.getItem('mc_entry_hour'), 10), mornH = Number.isInteger(mh) && mh >= 0 ? mh : 9;
    const morn = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, mornH, 0);
    const later = [{ t: 'Через 1 час', d: new Date(now.getTime() + 3600000) }];
    if (eve - now > 30 * 60000) later.push({ t: 'Сегодня вечером', d: eve });
    later.push({ t: 'Завтра утром', d: morn });
    const add = n => { const d = new Date(t); d.setDate(d.getDate() + n); return d; };
    const opts = [{ t: 'Завтра', d: add(1) }, { t: 'Через 3 дня', d: add(3) }];
    let w = add(1); for (let i = 0; i < 7 && q.includes(dow(w)); i++) w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 1);
    if (ymd(w) !== ymd(add(1))) opts.splice(1, 0, { t: 'В ' + DAY[dow(w)].toLowerCase() + ' <small>· первый рабочий день</small>', d: w });
    const hdr = x => `<div style="padding:8px 12px 4px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)">${x}</div>`;
    m.innerHTML = '<div class="ps-menu">' + hdr('Напомнить позже · срок не меняется') +
      later.map(o => `<button onclick="mcPsRemindAt(${o.d.getTime()})">${o.t} <small>· ${dShort(ymd(o.d)) === dShort(todayS()) ? 'в' : dShort(ymd(o.d)) + ' в'} ${hm(o.d)}</small></button>`).join('') +
      hdr('Перенести срок на дату') +
      opts.map(o => `<button onclick="mcPsSnooze('${ymd(o.d)}')">${o.t} <small>· ${dShort(ymd(o.d))}</small></button>`).join('') +
      `<button onclick="document.getElementById('ps-date').showPicker?document.getElementById('ps-date').showPicker():document.getElementById('ps-date').focus()">Другая дата…</button></div>
      <input type="date" id="ps-date" min="${todayS()}" onchange="if(this.value)mcPsSnooze(this.value)" style="opacity:0;height:0;width:0;position:absolute">`;
  }
  function mcPsRemindAt(ts) { if (S && S.e) remindAt('entry', { cardId: S.c.id, entryId: S.e.id }, new Date(ts)); }
  async function mcPsSnooze(date) {
    if (!S || !S.e) return;
    const old = S.e.deadline;
    S.e.deadline = date;
    S.c.deadline = nearest(S.c);
    const ok = await saveCard(S.c);
    if (!ok) { S.e.deadline = old; S.c.deadline = nearest(S.c); return; }
    const m = document.getElementById('ps-menu'); if (m) m.innerHTML = '';
    res('⏰ Срок перенесён на ' + dShort(date));
  }

  // ═════════ 2. СОБЫТИЕ ═════════
  const REP = { daily: 'каждый день', weekly: 'каждую неделю', monthly: 'каждый месяц', yearly: 'каждый год' };
  async function loadEvents(ids) {
    try { const { data, error } = await sb.from('events').select('*').in('space_id', ids); if (error) throw error; return data || []; }
    catch (_) { try { return (await local.getAll('events')).filter(ev => ids.includes(ev.space_id)); } catch (__) { return []; } }
  }
  const evTime = ev => (ev.event_time ? String(ev.event_time).slice(0, 5) : '');
  function evFired(ev, ds) { // какие напоминания события уже сработали (как в окне «Напоминания»)
    const d = parse(ds), now = new Date(), time = evTime(ev);
    return (ev.reminders || []).filter(r => {
      if (r && Number.isFinite(r.d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - r.d) <= now;
      if (r && Number.isFinite(r.m) && time) { const [hh, mm] = time.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm - r.m) <= now; }
      return false;
    }).map(r => Number.isFinite(r.d) ? 'd' + r.d : 'm' + r.m).sort().join(',');
  }
  function evSeen(ev, ds) { // «Понял»: общее окно «Напоминания» это событие больше не покажет
    try {
      const f = evFired(ev, ds); if (!f) return;
      let dis = {}; try { dis = JSON.parse(localStorage.getItem('mc_ev_dismissed') || '{}'); } catch (_) {}
      dis[ev.id + '|' + ds + '|' + f] = Date.now();
      localStorage.setItem('mc_ev_dismissed', JSON.stringify(dis));
    } catch (_) {}
  }
  let EV = null;
  async function mcPushEventSheet(evId, evDate) {
    const ids = (typeof spaces !== 'undefined' ? spaces : []).map(s => s.id);
    const all = await loadEvents(ids);
    const ev = all.find(x => x.id === evId);
    if (!ev) { if (typeof evPopupCheck === 'function') evPopupCheck(true); return; }
    const ds = evDate || todayS();
    EV = { ev, ds };
    const time = evTime(ev);
    const later = typeof calEventOccursOn === 'function' && ds === todayS()
      ? all.filter(x => x.id !== ev.id && evTime(x) && evTime(x) > (time || '00:00') && calEventOccursOn(x, ds)).sort((a, b) => evTime(a).localeCompare(evTime(b))).slice(0, 3) : [];
    const d = diffDays(ds, todayS());
    const h = `<div class="ps-lbl" style="color:var(--accent)">🔔 Событие</div>
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:6px"><b style="font-size:40px;letter-spacing:-.02em;line-height:1">${time || 'Весь день'}</b><span id="ps-cd" style="color:var(--accent);font-size:14px;font-weight:600"></span></div>
      <div class="ps-t" dir="auto">${E(ev.title || 'Событие')}</div>
      <div class="ps-chips">
        <span class="ps-chip">📅 ${E(dShort(ds))}${d === 0 ? ' · сегодня' : d === 1 ? ' · завтра' : ''}</span>
        ${REP[ev.repeat] ? `<span class="ps-chip">🔁 ${REP[ev.repeat]}</span>` : ''}
        ${(spaces.length > 1 && spaceName(ev.space_id)) ? `<span class="ps-chip">🗂 ${E(spaceName(ev.space_id))}</span>` : ''}
      </div>
      ${plain(ev.note) ? `<div style="font-size:14px;color:var(--t1);line-height:1.5;margin-bottom:10px" dir="auto">📝 ${E(plain(ev.note))}</div>` : ''}
      ${later.length ? `<div style="font-size:12px;color:var(--t3);margin-bottom:6px">Дальше сегодня: ${later.map(x => E(evTime(x) + ' ' + (x.title || ''))).join(' · ')}</div>` : ''}
      <div class="ps-btns"><button class="ps-btn p" onclick="mcPsEvSeen()">Понял</button><button class="ps-btn" onclick="mcPsEvMenu()">⏰ Отложить ▾</button></div>
      <div id="ps-menu"></div><div class="ps-res" id="ps-res"></div>
      <div class="ps-btns"><button class="ps-btn" onclick="mcPsEvCal()">📅 В календарь</button></div>`;
    open(h);
    const tick = () => {
      const el = document.getElementById('ps-cd'); if (!el) { clearInterval(_timer); _timer = null; return; }
      if (d !== 0 || !time) { el.textContent = d === 0 ? 'сегодня' : d === 1 ? 'завтра' : d > 1 ? 'через ' + d + ' дн.' : ''; return; }
      const [hh, mm] = time.split(':').map(Number), n = new Date();
      const m = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate(), hh, mm) - n) / 60000);
      el.textContent = m > 60 ? 'через ' + Math.floor(m / 60) + ' ч ' + (m % 60 ? (m % 60) + ' мин' : '') : m > 0 ? 'через ' + m + ' мин' : m === 0 ? 'сейчас' : m > -60 ? 'началось ' + (-m) + ' мин назад' : 'уже прошло';
    };
    tick(); _timer = setInterval(tick, 20000);
  }
  function mcPsEvMenu() {
    const m = document.getElementById('ps-menu'); if (!m) return;
    if (m.innerHTML) { m.innerHTML = ''; return; }
    const now = Date.now();
    m.innerHTML = '<div class="ps-menu">' + [[10, '+10 минут'], [30, '+30 минут'], [60, '+1 час']].map(o => { const d = new Date(now + o[0] * 60000); return `<button onclick="mcPsEvRemind(${o[0]})">${o[1]} <small>· в ${hm(d)}</small></button>`; }).join('') + '</div>';
  }
  async function mcPsEvRemind(min) {
    if (!EV) return;
    const ok = await remindAt('event', { evId: EV.ev.id, evDate: EV.ds }, new Date(Date.now() + min * 60000));
    if (ok) evSeen(EV.ev, EV.ds); // общее окно «Напоминания» это событие больше не показывает
  }
  function mcPsEvSeen() { if (EV) evSeen(EV.ev, EV.ds); mcPsClose(); }
  function mcPsEvCal() { if (EV) evSeen(EV.ev, EV.ds); mcPsClose(); try { (typeof openCalendarFromLobby === 'function' ? openCalendarFromLobby : openCalendar)(); } catch (_) {} }

  // ═════════ 3. ВАШ ДЕНЬ ═════════
  let ROWS = [];
  function cardDueToday(c, ds) { // совпадает ли расписание напоминания карточки с сегодняшним днём (как на сервере)
    const r = c.reminder; if (!r || !r.enabled || r.freq === 'interval') return false;
    const f = r.freq || 'daily', d = parse(ds), w = dow(d);
    if (f === 'daily') return true;
    if (f === 'weekly') return w === (Array.isArray(r.days) && Number.isInteger(r.days[0]) ? r.days[0] : 0);
    if (f === 'monthly') { const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return d.getDate() === Math.min(Math.max(parseInt(r.monthDay, 10) || 1, 1), last); }
    if (f === 'custom') return (r.days || []).includes(w);
    return false;
  }
  async function mcPushDaySheet() {
    const ds = todayS();
    const sp = (typeof spaces !== 'undefined' ? spaces : []).filter(s => s.status !== 'closed');
    const ids = sp.map(s => s.id), personal = sp.filter(s => s.type === 'personal').map(s => s.id);
    ROWS = [];
    const evs = await loadEvents(ids);
    if (typeof calEventOccursOn === 'function') evs.filter(ev => calEventOccursOn(ev, ds)).forEach(ev => ROWS.push({ k: 'ev', ev, sort: evTime(ev) || '00:00', time: evTime(ev) }));
    let cs = [];
    try { const { data } = await sb.from('cards').select('*').in('space_id', ids).in('status', ['new', 'in_progress', 'waiting']); cs = data || []; }
    catch (_) { try { cs = (await local.getAll('cards')).filter(c => ids.includes(c.space_id) && c.status !== 'done'); } catch (__) {} }
    cs.forEach(c => {
      if (personal.includes(c.space_id)) (c.entries || []).forEach(e => { if (e && !e.done && e.text && e.deadline && String(e.deadline).slice(0, 10) <= ds) ROWS.push({ k: 'en', c, e, sort: '~' + String(e.deadline) }); });
      if (cardDueToday(c, ds)) ROWS.push({ k: 'cd', c, sort: '~~' + (c.title || '') });
    });
    ROWS.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)); // сначала события по времени, затем записи, затем напоминания карточек
    const d = parse(ds);
    const nEn = ROWS.filter(r => r.k === 'en').length;
    const h = `<div class="ps-lbl" style="color:var(--green,#5bb87a)">☀️ Ваш день</div>
      <div class="ps-t" style="margin-bottom:2px">${['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][dow(d)]}, ${d.getDate()} ${['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][d.getMonth()]}</div>
      <div id="ps-dayhead" style="font-size:12px;color:var(--t2)"></div>
      <div class="ps-bar" id="ps-daybar" style="display:none"><i style="width:0"></i></div>
      <div id="ps-rows"></div>
      <div class="ps-btns"><button class="ps-btn" onclick="mcPsClose()">Закрыть</button></div>`;
    open(h); paintDay(0, nEn);
  }
  function paintDay(done, total) {
    const box = document.getElementById('ps-rows'); if (!box) return;
    const now = new Date(), nm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    if (!ROWS.length) { box.innerHTML = '<div style="color:var(--t3);font-size:14px;padding:14px 0">На сегодня ничего нет. Свободный день 🌿</div>'; }
    else box.innerHTML = ROWS.map((r, i) => {
      if (r.k === 'ev') return `<div class="ps-row ${r.time && r.time < nm ? 'past' : ''}"><div class="ps-tm">${r.time || '—'}</div><div class="ps-dot" style="background:#5b9ee8"></div><div class="ps-tx" dir="auto" onclick="mcPsDayEv(${i})">${E(r.ev.title || 'Событие')}<small>событие${r.time && r.time < nm ? ' · прошло' : ''}</small></div></div>`;
      if (r.k === 'en') { const late = String(r.e.deadline).slice(0, 10) < todayS(); return `<div class="ps-row ${r.e.done ? 'dn' : ''}"><div class="ps-tm" style="color:${late ? 'var(--red,#e86060)' : 'var(--t2)'}">${late ? '🔥' : 'срок'}</div><div class="ps-cb" onclick="mcPsDayDone(${i})">${r.e.done ? '✓' : ''}</div><div class="ps-tx" dir="auto" onclick="mcPsDayOpen(${i})">${E(plain(r.e.text))}<small>${E((r.c.category ? r.c.category + ' › ' : '') + (r.c.title || ''))}${late ? ' · просрочено' : ''}</small></div></div>`; }
      return `<div class="ps-row"><div class="ps-tm">напом.</div><div class="ps-dot" style="background:var(--accent)"></div><div class="ps-tx" dir="auto" onclick="mcPsDayOpen(${i})">${E(r.c.title || 'Карточка')}<small>${E(r.c.category || 'напоминание карточки')}</small></div></div>`;
    }).join('');
    const hd = document.getElementById('ps-dayhead'), bar = document.getElementById('ps-daybar');
    if (total > 0) { hd.innerHTML = `Сделано <b>${done}</b> из ${total} ${plural(total, 'дела', 'дел', 'дел')} со сроком`; bar.style.display = ''; bar.firstChild.style.width = Math.round(done / total * 100) + '%'; }
    else { hd.textContent = ''; bar.style.display = 'none'; }
  }
  async function mcPsDayDone(i) {
    const r = ROWS[i]; if (!r || r.k !== 'en' || r.e.done) return;
    markDone(r.c, r.e);
    const ok = await saveCard(r.c);
    if (!ok) { r.e.done = false; return; }
    const total = ROWS.filter(x => x.k === 'en').length;
    paintDay(ROWS.filter(x => x.k === 'en' && x.e.done).length, total);
  }
  function mcPsDayOpen(i) { const r = ROWS[i]; if (r && r.c) openCardFrom(r.c.space_id, r.c.id, r.e && r.e.id); }
  function mcPsDayEv(i) { const r = ROWS[i]; if (r && r.ev) mcPushEventSheet(r.ev.id, todayS()); }

  Object.assign(window, { mcPsRemindAt, mcPsEvMenu, mcPsEvRemind, mcPushEntrySheet, mcPushEventSheet, mcPushDaySheet, mcPsClose, mcPsEntryDone, mcPsSnoozeMenu, mcPsSnooze, mcPsOpenCard, mcPsEvSeen, mcPsEvCal, mcPsDayDone, mcPsDayOpen, mcPsDayEv });
})();
