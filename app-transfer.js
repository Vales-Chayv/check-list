// ═══════════════════════════════════════════════════════════════
//  ПЕРЕДАЧА ФАЙЛОВ С ТЕЛЕФОНА НА КОМПЬЮТЕР НАПРЯМУЮ (WebRTC)
//  Файлы идут по прямому каналу и пишутся в один ZIP на диске компьютера.
//  Supabase Realtime нужен только для «знакомства» устройств (пара коротких сообщений).
//  Если прямой путь закрыт — запасной путь через сервер (TURN), это платная услуга.
//  Подключается одной строкой в index.html после app-native.js. Ничего существующего не меняет.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.mcXfer) return;

  const BLK = 2 * 1024 * 1024;          // сколько читаем с диска телефона за раз
  const WINDOW = 32 * 1024 * 1024;      // сколько байт может быть в пути без подтверждения
  const BUF_HI = 4 * 1024 * 1024;       // очередь внутри канала
  const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

  // ───────── мелочи ─────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const fatal = m => { const e = new Error(m); e.fatal = true; return e; };
  function fmt(n) {
    n = n || 0;
    if (n >= 1073741824) return (n / 1073741824).toFixed(n >= 10 * 1073741824 ? 0 : 1).replace('.', ',') + ' ГБ';
    if (n >= 1048576) return (n / 1048576).toFixed(n >= 104857600 ? 0 : 1).replace('.', ',') + ' МБ';
    if (n >= 1024) return Math.round(n / 1024) + ' КБ';
    return n + ' Б';
  }
  function fmtT(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return h ? h + ' ч ' + m + ' мин' : m ? m + ' мин ' + x + ' с' : x + ' с';
  }
  const say = (m, bad) => { try { if (window.toast) window.toast(m, !!bad); } catch (e) {} };
  const isNative = () => { try { return typeof window.isNativeApp === 'function' && window.isNativeApp(); } catch (e) { return false; } };

  // ───────── CRC32 ─────────
  const CT = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; CT[n] = c; }
  function crc32(u8, c) {
    c = ~(c | 0);
    for (let i = 0; i < u8.length; i++) c = CT[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (~c) >>> 0;
  }

  // ───────── ZIP без сжатия, пишется потоком; размеры известны заранее, CRC дописывается в заголовок после файла ─────────
  const u16 = (dv, o, v) => dv.setUint16(o, v, true);
  const u32 = (dv, o, v) => dv.setUint32(o, v >>> 0, true);
  const u64 = (dv, o, n) => { dv.setUint32(o, n % 4294967296, true); dv.setUint32(o + 4, Math.floor(n / 4294967296), true); };
  function dos(ms) {
    const d = new Date(ms || Date.now());
    let y = d.getFullYear(); if (y < 1980) y = 1980;
    return { d: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1) };
  }
  class ZipOut {
    // sink: { write(u8), patch(position, u8) }; opt.limit — порог ZIP64 (по умолчанию 4 ГБ; меньше — только для проверок)
    constructor(sink, opt) { this.s = sink; this.off = 0; this.ents = []; this.cur = null; this.LIM = (opt && opt.limit) || 0xFFFFFFFF; this.enc = new TextEncoder(); this.names = new Set(); }
    static clean(name) {
      let n = String(name || 'file').replace(/[\u0000-\u001f<>:"\/\\|?*]/g, '_').replace(/^\.+/, '_').trim();
      if (!n) n = 'file';
      if (n.length > 180) { const m = n.match(/(\.[^.]{1,12})$/); n = n.slice(0, 170) + (m ? m[1] : ''); }
      return n;
    }
    uniq(name) {
      let n = ZipOut.clean(name);
      if (this.names.has(n.toLowerCase())) {
        const m = n.match(/^(.*?)(\.[^.]*)?$/); let k = 2, c;
        do { c = m[1] + ' (' + (k++) + ')' + (m[2] || ''); } while (this.names.has(c.toLowerCase()));
        n = c;
      }
      this.names.add(n.toLowerCase());
      return n;
    }
    async _w(u8) { await this.s.write(u8); this.off += u8.length; }
    async begin(name, size, mtime) {
      const nb = this.enc.encode(this.uniq(name)), z = size >= this.LIM, dt = dos(mtime);
      const ex = z ? 20 : 0, h = new Uint8Array(30 + nb.length + ex), dv = new DataView(h.buffer);
      u32(dv, 0, 0x04034b50); u16(dv, 4, 45); u16(dv, 6, 0x0800); u16(dv, 8, 0); u16(dv, 10, dt.t); u16(dv, 12, dt.d);
      u32(dv, 14, 0); u32(dv, 18, z ? 0xFFFFFFFF : size); u32(dv, 22, z ? 0xFFFFFFFF : size); u16(dv, 26, nb.length); u16(dv, 28, ex);
      h.set(nb, 30);
      if (z) { const o = 30 + nb.length; u16(dv, o, 1); u16(dv, o + 2, 16); u64(dv, o + 4, size); u64(dv, o + 12, size); }
      this.cur = { nb, size, z, dt, hoff: this.off, crc: 0, n: 0 };
      await this._w(h);
    }
    async data(u8) { const c = this.cur; c.crc = crc32(u8, c.crc); c.n += u8.length; await this._w(u8); }
    async end() {
      const c = this.cur;
      if (c.n !== c.size) throw new Error('размер файла не совпал');
      const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, c.crc, true);
      await this.s.patch(c.hoff + 14, b);
      this.ents.push(c); this.cur = null;
    }
    async finish() {
      const F = 0xFFFFFFFF, cdStart = this.off;
      for (const e of this.ents) {
        const zo = e.hoff >= this.LIM, nex = (e.z ? 16 : 0) + (zo ? 8 : 0), ex = nex ? 4 + nex : 0;
        const h = new Uint8Array(46 + e.nb.length + ex), dv = new DataView(h.buffer);
        u32(dv, 0, 0x02014b50); u16(dv, 4, 45); u16(dv, 6, 45); u16(dv, 8, 0x0800); u16(dv, 10, 0); u16(dv, 12, e.dt.t); u16(dv, 14, e.dt.d);
        u32(dv, 16, e.crc); u32(dv, 20, e.z ? F : e.size); u32(dv, 24, e.z ? F : e.size); u16(dv, 28, e.nb.length); u16(dv, 30, ex);
        u16(dv, 32, 0); u16(dv, 34, 0); u16(dv, 36, 0); u32(dv, 38, 0); u32(dv, 42, zo ? F : e.hoff);
        h.set(e.nb, 46);
        if (ex) { let o = 46 + e.nb.length; u16(dv, o, 1); u16(dv, o + 2, nex); o += 4; if (e.z) { u64(dv, o, e.size); u64(dv, o + 8, e.size); o += 16; } if (zo) u64(dv, o, e.hoff); }
        await this._w(h);
      }
      const cdSize = this.off - cdStart, n = this.ents.length;
      const z64 = n >= 0xFFFF || cdStart >= this.LIM || cdSize >= this.LIM;
      if (z64) {
        const r = new Uint8Array(76), dv = new DataView(r.buffer), at = this.off;
        u32(dv, 0, 0x06064b50); u64(dv, 4, 44); u16(dv, 12, 45); u16(dv, 14, 45); u32(dv, 16, 0); u32(dv, 20, 0);
        u64(dv, 24, n); u64(dv, 32, n); u64(dv, 40, cdSize); u64(dv, 48, cdStart);
        u32(dv, 56, 0x07064b50); u32(dv, 60, 0); u64(dv, 64, at); u32(dv, 72, 1);
        await this._w(r);
      }
      const t = new Uint8Array(22), dv = new DataView(t.buffer);
      u32(dv, 0, 0x06054b50); u16(dv, 4, 0); u16(dv, 6, 0); u16(dv, 8, z64 ? 0xFFFF : n); u16(dv, 10, z64 ? 0xFFFF : n);
      u32(dv, 12, z64 ? F : cdSize); u32(dv, 16, z64 ? F : cdStart); u16(dv, 20, 0);
      await this._w(t);
      return this.off;
    }
  }
  // приёмник файла на диске (File System Access)
  function fsSink(w) {
    let pos = 0;
    return {
      async write(u8) { await w.write(u8); pos += u8.length; },
      async patch(at, u8) { await w.write({ type: 'write', position: at, data: u8 }); await w.write({ type: 'seek', position: pos }); },
      async close() { await w.close(); },
      async abort() { try { await w.abort(); } catch (e) {} }
    };
  }

  // ───────── знакомство устройств через Supabase Realtime ─────────
  function deviceName(role) {
    const ua = navigator.userAgent || '';
    if (role === 'tx') {
      const m = ua.match(/Android[^;]*;\s*([^;)]+)/);
      return (m && m[1] && !/^(K|Build)/.test(m[1].trim())) ? 'Телефон ' + m[1].trim().slice(0, 24) : (/iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Телефон' : 'Устройство');
    }
    const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'браузер';
    return 'Компьютер · ' + b;
  }
  function makeHub(role, onSig, onPeers) {
    let sbc = null, uid = null;
    try { sbc = (typeof sb !== 'undefined') ? sb : null; } catch (e) {}
    try { uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null; } catch (e) {}
    if (!sbc || !uid) throw new Error('Сначала войдите в аккаунт');
    const dev = rid(), name = deviceName(role);
    const ch = sbc.channel('mc-xfer-' + uid, { config: { broadcast: { self: false }, presence: { key: dev } } });
    const peers = () => {
      const st = ch.presenceState() || {}, out = [];
      Object.keys(st).forEach(k => (st[k] || []).forEach(m => { if (m && m.dev !== dev && m.role && m.role !== role) out.push({ dev: m.dev || k, name: m.name || 'Устройство', role: m.role }); }));
      return out;
    };
    ch.on('broadcast', { event: 'sig' }, m => { const p = m && m.payload; if (p && p.to === dev) { try { onSig(p); } catch (e) { console.warn('[xfer] sig', e); } } });
    ch.on('presence', { event: 'sync' }, () => { try { onPeers(peers()); } catch (e) {} });
    let ok = false;
    const ready = new Promise((res, rej) => {
      ch.subscribe(async s => {
        if (s === 'SUBSCRIBED') { ok = true; try { await ch.track({ dev, role, name, t: Date.now() }); } catch (e) {} res(); try { onPeers(peers()); } catch (e) {} }
        else if ((s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') && !ok) rej(new Error('нет связи с облаком'));
      });
    });
    ready.catch(() => {});
    return {
      dev, name, ready,
      peers,
      send: p => ch.send({ type: 'broadcast', event: 'sig', payload: Object.assign({ from: dev }, p) }),
      close() { try { sbc.removeChannel(ch); } catch (e) {} }
    };
  }
  function gathered(pc, ms) {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') return res();
      let t;
      const done = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', h); res(); };
      const h = () => { if (pc.iceGatheringState === 'complete') done(); };
      t = setTimeout(done, ms);
      pc.addEventListener('icegatheringstatechange', h);
    });
  }
  // временные ключи запасного пути через сервер (Supabase Edge Function «turn-creds»)
  async function getRelay() {
    try {
      const r = await sb.functions.invoke('turn-creds', { body: {} });
      if (r.error) return { ok: false, status: (r.error.context && r.error.context.status) || 0 };
      const ice = r.data && r.data.iceServers;
      if (Array.isArray(ice) && ice.length) return { ok: true, ice };
      return { ok: false, status: 501 };
    } catch (e) { return { ok: false, status: 0 }; }
  }
  function relayText(st) {
    if (st === 402) return 'Передача через сервер — платная услуга, она пока не подключена к вашей учётной записи.';
    if (st === 501 || st === 404) return 'Передача через сервер ещё не настроена.';
    return 'Не удалось связаться с сервером передачи.';
  }
  function cleanIce(list) {
    if (!Array.isArray(list)) return STUN;
    const out = [];
    list.forEach(s => {
      if (!s) return;
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(u => typeof u === 'string' && /^(stun|turn|turns):/.test(u));
      if (urls.length) out.push({ urls, username: s.username, credential: s.credential });
    });
    return out.length ? out : STUN;
  }
  function bufLow(dc) {
    return new Promise(r => {
      const f = () => { dc.removeEventListener('bufferedamountlow', f); clearTimeout(t); r(); };
      const t = setTimeout(f, 400);
      dc.addEventListener('bufferedamountlow', f);
    });
  }
  const REJECT = { declined: 'Компьютер отклонил передачу.', busy: 'Компьютер уже принимает другую передачу.', nosession: 'Компьютер закрыл приём. Начните передачу заново.' };

  // ───────── ОТПРАВИТЕЛЬ (телефон) ─────────
  class Sender {
    constructor(hub, target, files, onChange) {
      this.hub = hub; this.target = target; this.onChange = onChange;
      this.files = files.map(f => ({ file: f, name: f.name || 'file', size: f.size, mt: f.lastModified || Date.now() }));
      this.total = this.files.reduce((a, f) => a + f.size, 0);
      this.sid = rid(); this.state = 'connecting'; this.note = ''; this.msg = ''; this.relayStatus = null;
      this.acked = 0; this.sent = 0; this.speed = 0; this.lastT = 0; this.lastA = 0; this.t0 = Date.now(); this.t1 = 0;
      this.paused = false; this.cancelled = false; this.everOpen = false; this.relay = null; this.mode = 'direct';
      this.pc = null; this.dc = null; this.sigW = null; this.msgW = {}; this.ackW = null; this.nudge = false; this.chunk = 128 * 1024;
    }
    set(st, o) { this.state = st; if (o) Object.assign(this, o); try { this.onChange(this); } catch (e) {} }
    keep(on) {
      try {
        if (on) { this._prevWork = window._mcWork; window._mcWork = 'Передача на компьютер…'; }
        else if (window._mcWork === 'Передача на компьютер…') window._mcWork = this._prevWork || '';
        if (window.mcKeepSync) window.mcKeepSync();
      } catch (e) {}
    }
    onSig(p) {
      if (p.sid !== this.sid) return;
      if (this.sigW && (p.type === 'answer' || p.type === 'reject' || p.type === 'cancel')) { const w = this.sigW; this.sigW = null; w(p); }
    }
    waitSig(ms) { return new Promise((res, rej) => { const t = setTimeout(() => { this.sigW = null; rej(new Error('timeout')); }, ms); this.sigW = p => { clearTimeout(t); res(p); }; }); }
    waitMsg(types, ms) {
      return new Promise((res, rej) => {
        const t = setTimeout(() => { types.forEach(k => delete this.msgW[k]); rej(new Error('timeout')); }, ms);
        const f = m => { clearTimeout(t); types.forEach(k => delete this.msgW[k]); res(m); };
        types.forEach(k => { this.msgW[k] = f; });
      });
    }
    async pause(ms) { const t0 = Date.now(); this.nudge = false; while (Date.now() - t0 < ms && !this.nudge && !this.cancelled) await sleep(200); }
    async run() {
      this.keep(true);
      let tries = 0;
      try {
        while (!this.cancelled) {
          try {
            await this.attempt(tries > 0 || this.everOpen);
            this.t1 = Date.now(); this.set('done'); return;
          } catch (e) {
            if (this.cancelled) return;
            if (e && e.fatal) { this.set('fail', { msg: e.message }); return; }
            tries++;
            const needRelay = this.mode === 'direct' && ((!this.everOpen) || tries % 3 === 0);
            if (needRelay) {
              this.set('connecting', { note: 'Прямой путь не открылся, проверяю путь через сервер…' });
              const rl = await getRelay();
              if (rl.ok) { this.relay = rl.ice; this.mode = 'relay'; this.set('connecting', { note: 'Соединяю через сервер…' }); continue; }
              if (!this.everOpen) { this.set('fail', { msg: 'Прямое соединение не открылось. ' + relayText(rl.status), noDirect: true, relayStatus: rl.status }); return; }
            }
            this.set('lost', { note: '' });
            await this.pause(4000);
            if (!this.cancelled) this.set('connecting', { note: 'Пробую вернуть связь…' });
          }
        }
      } finally { this.keep(false); this.drop(); }
    }
    drop() {
      try { clearTimeout(this._dt); } catch (e) {}
      try { if (this.dc) { this.dc.onclose = null; this.dc.onmessage = null; this.dc.close(); } } catch (e) {}
      try { if (this.pc) { this.pc.oniceconnectionstatechange = null; this.pc.close(); } } catch (e) {}
      this.pc = null; this.dc = null; this.msgW = {};
    }
    async attempt(resume) {
      this.drop();
      const pc = new RTCPeerConnection({ iceServers: this.mode === 'relay' ? cleanIce(this.relay) : STUN });
      this.pc = pc;
      const dc = pc.createDataChannel('x', { ordered: true });
      dc.binaryType = 'arraybuffer'; dc.bufferedAmountLowThreshold = 1 << 20; this.dc = dc;
      let lostRej; const lost = new Promise((_, rej) => { lostRej = rej; }); lost.catch(() => {});
      const L = () => lostRej(new Error('связь потеряна'));
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === 'failed' || s === 'closed') L();
        else if (s === 'disconnected') { clearTimeout(this._dt); this._dt = setTimeout(() => { if (pc.iceConnectionState === 'disconnected') L(); }, 8000); }
        else if (s === 'connected' || s === 'completed') clearTimeout(this._dt);
      };
      dc.onclose = L;
      dc.onmessage = e => this.onMsg(e);
      const R = p => Promise.race([p, lost]);
      const open = new Promise(res => { dc.onopen = res; });
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc, this.mode === 'relay' ? 6000 : 3500);
      if (!resume) this.set('confirm', { note: '' });
      const ans = this.waitSig(resume ? 30000 : 180000);
      await this.hub.send({
        type: 'offer', to: this.target.dev, sid: this.sid, resume: !!resume, name: this.hub.name,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        files: this.files.map(f => ({ n: f.name, s: f.size, m: f.mt })), total: this.total,
        ice: this.mode === 'relay' ? this.relay : null
      });
      let a;
      try { a = await R(ans); }
      catch (e) { if (!resume && e && e.message === 'timeout') throw fatal('Компьютер не ответил. Проверьте, что на нём открыто окно приёма.'); throw e; }
      if (a.type === 'reject') throw fatal(REJECT[a.reason] || 'Компьютер отказался принимать.');
      if (a.type === 'cancel') throw fatal('Компьютер отменил приём.');
      if (!resume) this.set('connecting', { note: this.mode === 'relay' ? 'Соединяю через сервер…' : 'Соединяю…' });
      await pc.setRemoteDescription(a.sdp);
      await R(Promise.race([open, sleep(this.mode === 'relay' ? 25000 : 15000).then(() => { throw new Error('не удалось соединиться'); })]));
      this.everOpen = true;
      try { this.chunk = Math.max(16384, Math.min(256 * 1024, (pc.sctp && pc.sctp.maxMessageSize) || 262144)); } catch (e) {}
      const rd = this.waitMsg(['ready'], 15000);
      dc.send(JSON.stringify({ t: 'hello', sid: this.sid, n: this.files.length, total: this.total }));
      const r = await R(rd);
      this.sent = r.w; this.acked = Math.max(this.acked, r.w); this.lastA = this.acked; this.lastT = Date.now();
      this.set('sending', { note: this.mode === 'relay' ? 'через сервер' : '' });
      const fin = this.waitMsg(['ok', 'bad'], 3600000);
      fin.catch(() => {});
      await R(this.pump(r));
      const f = await R(fin);
      if (f.t === 'bad') throw fatal('Компьютер сообщил об ошибке: ' + (f.m || 'данные не совпали'));
      this.acked = this.total;
    }
    onMsg(e) {
      if (typeof e.data !== 'string') return;
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'a') {
        const now = Date.now(), w = Math.max(this.acked, m.w || 0);
        this.acked = w;
        const dt = (now - this.lastT) / 1000;
        if (dt >= 0.5) { const inst = (w - this.lastA) / dt; this.speed = this.speed ? this.speed * 0.6 + inst * 0.4 : inst; this.lastT = now; this.lastA = w; }
        if (this.ackW) { const f = this.ackW; this.ackW = null; f(); }
        try { this.onChange(this); } catch (x) {}
      } else if (m.t === 'cancel') {
        this.cancelled = true; this.set('fail', { msg: 'Компьютер отменил приём.' });
      } else if (this.msgW[m.t]) { const f = this.msgW[m.t]; f(m); }
    }
    async gate() {
      for (;;) {
        if (this.cancelled) throw fatal('Отменено');
        const dc = this.dc;
        if (!dc || dc.readyState !== 'open') throw new Error('канал закрыт');
        if (this.paused) { await sleep(200); continue; }
        if (this.sent - this.acked > WINDOW) { await new Promise(r => { this.ackW = r; setTimeout(r, 400); }); continue; }
        if (dc.bufferedAmount > BUF_HI) { await bufLow(dc); continue; }
        return;
      }
    }
    async pump(r) {
      const dc = this.dc;
      for (let i = r.i; i < this.files.length; i++) {
        const f = this.files[i]; let off = i === r.i ? r.off : 0;
        dc.send(JSON.stringify({ t: 'f', i, off }));
        while (off < f.size) {
          await this.gate();
          const end = Math.min(f.size, off + BLK);
          let buf;
          try { buf = new Uint8Array(await f.file.slice(off, end).arrayBuffer()); } catch (e) { throw fatal('Не удалось прочитать файл «' + f.name + '»'); }
          if (buf.length !== end - off) throw fatal('Файл «' + f.name + '» изменился во время передачи');
          for (let p = 0; p < buf.length; p += this.chunk) { await this.gate(); dc.send(buf.subarray(p, Math.min(buf.length, p + this.chunk))); }
          off = end; this.sent += buf.length;
        }
      }
      dc.send(JSON.stringify({ t: 'end' }));
    }
    cancel() {
      this.cancelled = true;
      try { if (this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify({ t: 'cancel' })); } catch (e) {}
      try { this.hub.send({ type: 'cancel', to: this.target.dev, sid: this.sid }); } catch (e) {}
      if (this.state !== 'done') this.state = 'cancelled';
      try { this.onChange(this); } catch (e) {}
      this.keep(false); this.nudge = true;
      setTimeout(() => this.drop(), 150);
    }
  }

  // ───────── ПОЛУЧАТЕЛЬ (компьютер) ─────────
  class Receiver {
    constructor(hub, onChange) {
      this.hub = hub; this.onChange = onChange; this.state = 'idle'; this.offer = null; this.s = null; this.msg = '';
      this.pc = null; this.dc = null; this.ackTimer = 0; this.wl = null;
    }
    set(st, o) { this.state = st; if (o) Object.assign(this, o); try { this.onChange(this); } catch (e) {} }
    onSig(p) {
      if (p.type === 'cancel') { if (this.s && this.s.sid === p.sid && !this.s.done) this.fail('Телефон отменил передачу.', true); else if (this.offer && this.offer.sid === p.sid) { this.offer = null; this.set('idle'); } return; }
      if (p.type !== 'offer') return;
      const busy = this.s && !this.s.done && !this.s.failed;
      if (p.resume) {
        if (this.s && this.s.sid === p.sid && busy) { this.answer(p).catch(e => console.warn('[xfer] answer', e)); }
        else this.hub.send({ type: 'reject', to: p.from, sid: p.sid, reason: 'nosession' });
        return;
      }
      if (busy || this.offer) { this.hub.send({ type: 'reject', to: p.from, sid: p.sid, reason: 'busy' }); return; }
      this.offer = p;
      this.set('offer');
    }
    decline() {
      const p = this.offer; this.offer = null;
      if (p) this.hub.send({ type: 'reject', to: p.from, sid: p.sid, reason: 'declined' });
      this.set('idle');
    }
    // вызывается из нажатия кнопки (нужен жест пользователя для окна «Сохранить как»)
    async accept() {
      const p = this.offer; if (!p) return;
      let handle;
      const day = new Date().toISOString().slice(0, 10);
      try {
        handle = await window.showSaveFilePicker({ suggestedName: 'Файлы_с_телефона_' + day + '.zip', types: [{ description: 'ZIP-архив', accept: { 'application/zip': ['.zip'] } }] });
      } catch (e) { return; } // закрыла окно — остаёмся на вопросе
      let w;
      try { w = await handle.createWritable(); } catch (e) { this.set('offer', { msg: 'Не удалось открыть файл для записи: ' + (e && e.message || e) }); return; }
      const sink = fsSink(w);
      this.offer = null;
      this.s = {
        sid: p.sid, from: p.from, peerName: p.name || 'Телефон', files: p.files, total: p.total, zip: new ZipOut(sink), sink,
        pos: { i: 0, off: 0 }, handled: 0, written: 0, lastAck: -1, q: Promise.resolve(), open: false, done: false, failed: false,
        t0: Date.now(), t1: 0, speed: 0, lastT: Date.now(), lastW: 0, fileName: handle.name || ''
      };
      this.msg = '';
      try { window.onbeforeunload = () => 'Идёт приём файлов. Если закрыть страницу, передача прервётся.'; } catch (e) {}
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { this.wl = l; }).catch(() => {}); } catch (e) {}
      this.set('receiving');
      try { await this.answer(p); } catch (e) { this.fail('Не удалось соединиться: ' + (e && e.message || e)); }
    }
    async answer(p) {
      this.dropPeer();
      const pc = new RTCPeerConnection({ iceServers: p.ice ? cleanIce(p.ice) : STUN });
      this.pc = pc;
      pc.ondatachannel = e => {
        const dc = e.channel; dc.binaryType = 'arraybuffer'; this.dc = dc;
        dc.onmessage = ev => this.onData(ev);
        dc.onclose = () => { if (this.dc === dc && this.s && !this.s.done && !this.s.failed) this.lost(); };
      };
      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (!this.s || this.s.done || this.s.failed || this.pc !== pc) return;
        if (st === 'failed' || st === 'closed') this.lost();
        else if (st === 'disconnected') { clearTimeout(this._dt); this._dt = setTimeout(() => { if (pc.iceConnectionState === 'disconnected') this.lost(); }, 8000); }
        else if (st === 'connected' || st === 'completed') { clearTimeout(this._dt); if (this.state === 'lost') this.set('receiving'); }
      };
      await pc.setRemoteDescription(p.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc, p.ice ? 6000 : 3500);
      await this.hub.send({ type: 'answer', to: p.from, sid: p.sid, sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    }
    lost() { if (this.state !== 'lost' && this.s && !this.s.done && !this.s.failed) this.set('lost'); }
    dropPeer() {
      clearInterval(this.ackTimer); clearTimeout(this._dt);
      try { if (this.dc) { this.dc.onclose = null; this.dc.onmessage = null; this.dc.close(); } } catch (e) {}
      try { if (this.pc) { this.pc.oniceconnectionstatechange = null; this.pc.ondatachannel = null; this.pc.close(); } } catch (e) {}
      this.pc = null; this.dc = null;
    }
    sendJ(o) { try { if (this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify(o)); } catch (e) {} }
    enq(fn) {
      const s = this.s;
      s.q = s.q.then(async () => { if (s.failed) return; await fn(); }).catch(e => { this.fail('Ошибка записи на диск: ' + (e && e.message || e)); });
    }
    onData(ev) {
      const s = this.s; if (!s || s.failed || s.done) return;
      if (typeof ev.data === 'string') {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'hello') {
          this.sendJ({ t: 'ready', i: s.pos.i, off: s.pos.off, w: s.handled });
          clearInterval(this.ackTimer);
          this.ackTimer = setInterval(() => { if (s.written !== s.lastAck) { s.lastAck = s.written; this.sendJ({ t: 'a', w: s.written }); } this.tickSpeed(); }, 400);
          if (this.state === 'lost') this.set('receiving');
        } else if (m.t === 'f') {
          if (m.i !== s.pos.i || m.off !== s.pos.off) return this.bad('порядок файлов нарушен');
          const f = s.files[m.i]; if (!f) return this.bad('неизвестный файл');
          if (m.off === 0 && !s.open) {
            s.open = true;
            this.enq(() => s.zip.begin(f.n, f.s, f.m));
            if (f.s === 0) { this.enq(() => s.zip.end()); s.open = false; s.pos = { i: s.pos.i + 1, off: 0 }; }
          }
        } else if (m.t === 'end') {
          if (s.pos.i !== s.files.length) return this.bad('получены не все файлы');
          this.enq(async () => {
            await s.zip.finish(); await s.sink.close();
            if (s.written !== s.total) throw new Error('размер не совпал');
            s.done = true; s.t1 = Date.now(); s.written = s.total;
            this.sendJ({ t: 'a', w: s.total }); this.sendJ({ t: 'ok' });
            this.finish();
          });
        } else if (m.t === 'cancel') { this.fail('Телефон отменил передачу.', true); }
        return;
      }
      const u8 = new Uint8Array(ev.data), f = s.files[s.pos.i];
      if (!s.open || !f || s.pos.off + u8.length > f.s) return this.bad('лишние данные');
      s.handled += u8.length; s.pos.off += u8.length;
      this.enq(async () => { await s.zip.data(u8); s.written += u8.length; });
      if (s.pos.off === f.s) { this.enq(() => s.zip.end()); s.open = false; s.pos = { i: s.pos.i + 1, off: 0 }; }
    }
    tickSpeed() {
      const s = this.s; if (!s) return;
      const now = Date.now(), dt = (now - s.lastT) / 1000;
      if (dt >= 0.5) { const inst = (s.written - s.lastW) / dt; s.speed = s.speed ? s.speed * 0.6 + inst * 0.4 : inst; s.lastT = now; s.lastW = s.written; }
      try { this.onChange(this); } catch (e) {}
    }
    bad(m) { this.sendJ({ t: 'bad', m }); this.fail('Данные пришли в неправильном порядке (' + m + '). Попробуйте ещё раз.'); }
    fail(msg, quiet) {
      const s = this.s; if (s) { if (s.failed) return; s.failed = true; try { s.sink.abort(); } catch (e) {} }
      if (!quiet) this.sendJ({ t: 'bad', m: msg });
      this.release(); this.set('fail', { msg });
    }
    finish() {
      this.release();
      setTimeout(() => this.dropPeer(), 800);
      this.set('done');
    }
    release() {
      clearInterval(this.ackTimer);
      try { window.onbeforeunload = null; } catch (e) {}
      try { if (this.wl) this.wl.release(); } catch (e) {} this.wl = null;
    }
    reset() { try { if (this.s && !this.s.done && !this.s.failed) { this.s.failed = true; this.s.sink.abort(); } } catch (e) {} this.dropPeer(); this.release(); this.s = null; this.offer = null; this.msg = ''; this.set('idle'); }
  }

  // ───────── ОКНА ─────────
  const CSS = `
#mcx-ov{position:fixed;inset:0;z-index:100050;background:var(--bg,#121214);color:var(--t1,#ecebe6);font-family:inherit;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px)}
#mcx-ov *{box-sizing:border-box}
#mcx-ov .mcx-hd{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--b1,#34343b)}
#mcx-ov .mcx-hd b{flex:1;font-size:17px}
#mcx-ov .mcx-x{background:none;border:none;color:var(--t2,#9a98a0);font-size:24px;line-height:1;padding:4px 8px;cursor:pointer}
#mcx-ov .mcx-bd{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:11px;max-width:720px;width:100%;margin:0 auto;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))}
#mcx-ov .mcx-row{display:flex;align-items:center;gap:10px;background:var(--s2,#25252a);border-radius:10px;padding:9px 11px;min-width:0}
#mcx-ov .mcx-row .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
#mcx-ov .mcx-row .z{color:var(--t2,#9a98a0);font-size:12.5px;white-space:nowrap;font-variant-numeric:tabular-nums}
#mcx-ov .mcx-row button.rm{background:none;border:none;color:var(--t2,#9a98a0);font-size:18px;cursor:pointer;padding:0 4px}
#mcx-ov .mcx-peer{cursor:pointer;border:1.5px solid transparent}
#mcx-ov .mcx-peer.on{border-color:var(--accent,#e8c56a)}
#mcx-ov .mcx-btn{border:none;border-radius:22px;padding:12px 18px;font-size:15px;font-weight:700;background:var(--accent,#e8c56a);color:#1a1405;cursor:pointer;font-family:inherit}
#mcx-ov .mcx-btn.g{background:none;border:1px solid var(--b1,#34343b);color:var(--t1,#ecebe6);font-weight:500}
#mcx-ov .mcx-btn[disabled]{opacity:.45;cursor:default}
#mcx-ov .mcx-btns{display:flex;gap:8px;flex-wrap:wrap}
#mcx-ov .mcx-btns .mcx-btn{flex:1;min-width:130px}
#mcx-ov .mcx-bar{height:9px;background:var(--s2,#25252a);border-radius:5px;overflow:hidden}
#mcx-ov .mcx-bar i{display:block;height:100%;width:0;background:var(--accent,#e8c56a);border-radius:5px;transition:width .3s}
#mcx-ov .mcx-bar.w i{background:#e0a64a}
#mcx-ov .mcx-st{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--t2,#9a98a0);font-variant-numeric:tabular-nums}
#mcx-ov .mcx-note{border-left:3px solid #e0a64a;background:var(--s2,#25252a);border-radius:0 10px 10px 0;padding:9px 12px;font-size:13px;line-height:1.5}
#mcx-ov .mcx-note.ok{border-color:#5bb87a}#mcx-ov .mcx-note.bad{border-color:#ef6a6a}
#mcx-ov .mcx-sub{color:var(--t2,#9a98a0);font-size:13px;line-height:1.5}
#mcx-ov .mcx-t{font-size:16px;font-weight:700}
#mcx-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:100040;background:var(--accent,#e8c56a);color:#1a1405;border:none;border-radius:22px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4);font-family:inherit}
`;
  let ov = null, sender = null, recv = null, hub = null, role = '', picked = [], peers = [], chosen = null, lastKey = '', paintT = 0, pill = null, hidden = false;

  function injectCss() {
    if (document.getElementById('mcx-css')) return;
    const st = document.createElement('style'); st.id = 'mcx-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function isActive() {
    return !!((sender && !['done', 'fail', 'cancelled'].includes(sender.state)) || (recv && ['receiving', 'lost'].includes(recv.state)));
  }
  function fileStates(files, done) {
    let acc = 0;
    return files.map(f => {
      const sz = f.size != null ? f.size : f.s;
      const part = sz === 0 ? 1 : Math.max(0, Math.min(1, (done - acc) / sz)); acc += sz;
      return part >= 1 ? '✓' : part > 0 ? Math.round(part * 100) + '%' : 'в очереди';
    });
  }
  function fileRows(files, done) {
    const st = fileStates(files, done || 0);
    return files.map((f, i) => '<div class="mcx-row"><span class="n">' + esc(f.name || f.n) + '</span><span class="z" data-fs="' + i + '">' + st[i] + '</span><span class="z">' + fmt(f.size != null ? f.size : f.s) + '</span></div>').join('');
  }
  function progressBlock(done, total, speed, wait) {
    const pct = total ? Math.min(100, done / total * 100) : 100;
    const eta = speed > 1024 ? fmtT((total - done) / speed) : '—';
    return '<div class="mcx-bar' + (wait ? ' w' : '') + '"><i id="mcx-bar" style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="mcx-st"><span id="mcx-pct">' + Math.round(pct) + '% · ' + fmt(done) + ' из ' + fmt(total) + '</span><span id="mcx-spd">' + (speed > 1024 ? fmt(speed) + '/с' : '') + '</span><span id="mcx-eta">осталось ' + eta + '</span></div>';
  }

  function ensureOv(title) {
    injectCss();
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'mcx-ov';
      ov.innerHTML = '<div class="mcx-hd"><b></b><button class="mcx-x" data-a="close" aria-label="Закрыть">✕</button></div><div class="mcx-bd" id="mcx-bd"></div>' +
        '<input type="file" id="mcx-file" multiple style="display:none">';
      ov.addEventListener('click', onClick);
      ov.querySelector('#mcx-file').addEventListener('change', e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; });
      document.body.appendChild(ov);
    }
    ov.querySelector('.mcx-hd b').textContent = title;
    ov.style.display = 'flex'; hidden = false; updatePill();
  }
  function updatePill() {
    const act = isActive();
    if (act && hidden) {
      if (!pill) { pill = document.createElement('button'); pill.id = 'mcx-pill'; pill.onclick = () => { if (ov) { ov.style.display = 'flex'; hidden = false; updatePill(); paint(true); } }; document.body.appendChild(pill); }
      let p = 0;
      if (sender) p = sender.total ? sender.acked / sender.total : 0; else if (recv && recv.s) p = recv.s.total ? recv.s.written / recv.s.total : 0;
      pill.textContent = (sender ? '📤 ' : '📥 ') + Math.round(p * 100) + '% · открыть';
    } else if (pill) { pill.remove(); pill = null; }
  }
  function closeOv(force) {
    if (!ov) return;
    if (isActive() && !force) { ov.style.display = 'none'; hidden = true; updatePill(); return; }
    if (sender && isActive()) sender.cancel();
    ov.remove(); ov = null; hidden = false; updatePill();
    if (recv) { recv.reset(); recv = null; }
    sender = null; picked = []; chosen = null; lastKey = '';
    if (hub) { hub.close(); hub = null; }
    role = '';
  }
  window.mcXferBack = function () {
    if (!ov || ov.style.display === 'none') return false;
    closeOv(false); return true;
  };
  (function hookBack() {
    const tryHook = () => {
      if (typeof window.mcBackStepCore !== 'function') return false;
      if (window.mcBackStepCore._xfer) return true;
      const o = window.mcBackStepCore;
      window.mcBackStepCore = function () { if (window.mcXferBack && window.mcXferBack()) return true; return o.apply(this, arguments); };
      window.mcBackStepCore._xfer = true; return true;
    };
    if (!tryHook()) { let n = 0; const t = setInterval(() => { if (tryHook() || ++n > 40) clearInterval(t); }, 500); }
  })();

  function addFiles(list) {
    list.forEach(f => { if (f && !picked.some(p => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified)) picked.push(f); });
    paint(true);
  }
  function onClick(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a;
    if (a === 'close') return closeOv(false);
    if (a === 'add') return ov.querySelector('#mcx-file').click();
    if (a === 'rm') { picked.splice(+t.dataset.i, 1); return paint(true); }
    if (a === 'peer') { chosen = t.dataset.d; return paint(true); }
    if (a === 'send') return startSend();
    if (a === 'retry') { if (sender && sender.state === 'fail') { const old = sender; picked = old.files.map(f => f.file); sender = null; return startSend(); } if (sender) { sender.nudge = true; } return; }
    if (a === 'pause') { if (sender) { sender.paused = !sender.paused; sender.onChange(sender); } return; }
    if (a === 'cancel') { if (sender) sender.cancel(); return paint(true); }
    if (a === 'again') { sender = null; picked = []; return paint(true); }
    if (a === 'accept') { if (recv) recv.accept(); return; }
    if (a === 'decline') { if (recv) recv.decline(); return; }
    if (a === 'rnew') { if (recv) recv.reset(); return; }
    if (a === 'rstop') { if (recv && recv.s) { recv.sendJ({ t: 'cancel' }); recv.fail('Приём остановлен.', true); } return; }
  }
  function startSend() {
    if (!picked.length || !chosen) return;
    const target = peers.find(p => p.dev === chosen); if (!target) return;
    sender = new Sender(hub, target, picked.slice(), s => { paint(false); updatePill(); });
    sender.run();
    paint(true);
  }

  function paint(force) {
    if (!ov) return;
    const bd = ov.querySelector('#mcx-bd'); if (!bd) return;
    clearTimeout(paintT);
    let key, html = null, live = null;
    if (role === 'tx') {
      if (!sender) { key = 'tx-pick'; html = viewPick(); }
      else {
        const s = sender;
        key = 'tx-' + s.state + '-' + s.paused + '-' + s.note + '-' + (s.msg || '');
        if (s.state === 'sending') live = () => liveUpdate(s.acked, s.total, s.speed, s.files);
        html = viewSend(s);
      }
    } else {
      const r = recv; if (!r) return;
      const s = r.s;
      key = 'rx-' + r.state + '-' + (r.msg || '') + (r.offer ? r.offer.sid : '');
      if (r.state === 'receiving') live = () => liveUpdate(s.written, s.total, s.speed, s.files);
      html = viewRecv(r);
    }
    if (!force && key === lastKey && live) { live(); return; }
    if (!force && key === lastKey) return;
    lastKey = key;
    const sc = bd.scrollTop; bd.innerHTML = html; bd.scrollTop = sc;
  }
  function liveUpdate(done, total, speed, files) {
    const pct = total ? Math.min(100, done / total * 100) : 100;
    const b = document.getElementById('mcx-bar'); if (b) b.style.width = pct.toFixed(1) + '%';
    const p = document.getElementById('mcx-pct'); if (p) p.textContent = Math.round(pct) + '% · ' + fmt(done) + ' из ' + fmt(total);
    const sp = document.getElementById('mcx-spd'); if (sp) sp.textContent = speed > 1024 ? fmt(speed) + '/с' : '';
    const eta = document.getElementById('mcx-eta'); if (eta) eta.textContent = 'осталось ' + (speed > 1024 ? fmtT((total - done) / speed) : '—');
    const st = fileStates(files, done);
    st.forEach((v, i) => { const el = ov && ov.querySelector('[data-fs="' + i + '"]'); if (el && el.textContent !== v) el.textContent = v; });
  }

  function viewPick() {
    const sup = !!window.RTCPeerConnection;
    if (!sup) return '<div class="mcx-note bad">Этот браузер не умеет прямую передачу.</div>';
    const peerHtml = peers.length
      ? peers.map(p => '<div class="mcx-row mcx-peer' + (p.dev === chosen ? ' on' : '') + '" data-a="peer" data-d="' + esc(p.dev) + '"><span class="n">🖥 ' + esc(p.name) + '</span><span class="z">в сети</span></div>').join('')
      : '<div class="mcx-note">Компьютер не найден. На компьютере откройте приложение в Chrome или Edge, зайдите в ту же учётную запись и нажмите в настройках «📥 Принять с телефона». Окно приёма должно оставаться открытым.</div>';
    const total = picked.reduce((a, f) => a + f.size, 0);
    const files = picked.map((f, i) => '<div class="mcx-row"><span class="n">' + esc(f.name) + '</span><span class="z">' + fmt(f.size) + '</span><button class="rm" data-a="rm" data-i="' + i + '" aria-label="Убрать">✕</button></div>').join('');
    return '<div class="mcx-sub">Файлы идут напрямую на компьютер и собираются в один ZIP. Размер не ограничен.</div>' +
      '<div class="mcx-t">Куда отправить</div>' + peerHtml +
      '<div class="mcx-t">Что отправить</div>' + (files || '<div class="mcx-sub">Файлы ещё не выбраны.</div>') +
      '<button class="mcx-btn g" data-a="add">＋ Добавить файлы</button>' +
      '<button class="mcx-btn" data-a="send"' + (picked.length && chosen ? '' : ' disabled') + '>Отправить' + (total ? ' · ' + fmt(total) : '') + '</button>';
  }
  function viewSend(s) {
    const head = fileRows(s.files, s.acked);
    if (s.state === 'confirm') return '<div class="mcx-t">Жду подтверждения</div><div class="mcx-note">На компьютере «' + esc(s.target.name) + '» нужно нажать «Принять» и выбрать, куда сохранить архив.</div>' + head + '<button class="mcx-btn g" data-a="cancel">Отмена</button>';
    if (s.state === 'connecting') return '<div class="mcx-t">Соединяю…</div><div class="mcx-sub">' + esc(s.note || 'Это занимает несколько секунд.') + '</div>' + head + '<button class="mcx-btn g" data-a="cancel">Отмена</button>';
    if (s.state === 'sending') return '<div class="mcx-t">' + (s.paused ? 'Пауза' : 'Отправляю') + (s.note ? ' · ' + esc(s.note) : '') + '</div>' + progressBlock(s.acked, s.total, s.speed, s.paused) + head +
      '<div class="mcx-note ok">Экран можно выключить: передача идёт в фоне. Приложение на компьютере закрывать нельзя.</div>' +
      '<div class="mcx-btns"><button class="mcx-btn g" data-a="pause">' + (s.paused ? 'Продолжить' : 'Пауза') + '</button><button class="mcx-btn g" data-a="cancel">Отмена</button></div>';
    if (s.state === 'lost') return '<div class="mcx-t">Связь потеряна</div>' + progressBlock(s.acked, s.total, 0, true) + head +
      '<div class="mcx-note">Продолжу с места обрыва, как только вернётся сеть. Приложение пробует само каждые несколько секунд.</div>' +
      '<div class="mcx-btns"><button class="mcx-btn" data-a="retry">Повторить сейчас</button><button class="mcx-btn g" data-a="cancel">Отмена</button></div>';
    if (s.state === 'done') return '<div class="mcx-t">Готово ✓</div><div class="mcx-note ok">' + s.files.length + ' ' + plural(s.files.length) + ' · ' + fmt(s.total) + ' · ' + fmtT((s.t1 - s.t0) / 1000) + '. Компьютер сверил размеры, всё совпало.</div>' + head +
      '<div class="mcx-btns"><button class="mcx-btn" data-a="again">Отправить ещё</button><button class="mcx-btn g" data-a="close">Закрыть</button></div>';
    if (s.state === 'cancelled') return '<div class="mcx-t">Передача отменена</div><div class="mcx-btns"><button class="mcx-btn" data-a="again">Назад</button></div>';
    return '<div class="mcx-t">' + (s.noDirect ? 'Прямое соединение не открылось' : 'Не получилось') + '</div><div class="mcx-note bad">' + esc(s.msg || 'Ошибка') + '</div>' +
      (s.noDirect ? '<div class="mcx-sub">Самый простой выход: подключите телефон к той же Wi-Fi сети, что и компьютер, и нажмите «Повторить».</div>' : '') +
      '<div class="mcx-btns"><button class="mcx-btn" data-a="retry">Повторить</button><button class="mcx-btn g" data-a="again">Назад</button></div>';
  }
  const plural = n => (n % 10 === 1 && n % 100 !== 11) ? 'файл' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'файла' : 'файлов';
  function viewRecv(r) {
    const s = r.s;
    if (r.state === 'idle') return '<div class="mcx-sub">Страница открыта и ждёт. Закрывать её нельзя, пока идёт передача.</div>' +
      '<div class="mcx-row"><span class="n">🖥 ' + esc(hub ? hub.name : '') + '</span><span class="z">ждёт телефон</span></div>' +
      '<div class="mcx-note">На телефоне откройте приложение, зайдите в ту же учётную запись: ⚙️ → «📤 Отправить на компьютер».</div>';
    if (r.state === 'offer') {
      const p = r.offer;
      return '<div class="mcx-t">' + esc(p.name || 'Телефон') + ' хочет передать файлы</div><div class="mcx-note">' + p.files.length + ' ' + plural(p.files.length) + ' · ' + fmt(p.total) + '</div>' +
        p.files.slice(0, 50).map(f => '<div class="mcx-row"><span class="n">' + esc(f.n) + '</span><span class="z">' + fmt(f.s) + '</span></div>').join('') +
        (p.files.length > 50 ? '<div class="mcx-sub">…и ещё ' + (p.files.length - 50) + '</div>' : '') +
        (r.msg ? '<div class="mcx-note bad">' + esc(r.msg) + '</div>' : '') +
        '<div class="mcx-btns"><button class="mcx-btn" data-a="accept">Принять и выбрать место</button><button class="mcx-btn g" data-a="decline">Отклонить</button></div>';
    }
    if (r.state === 'receiving') return '<div class="mcx-t">Принимаю с телефона</div>' + progressBlock(s.written, s.total, s.speed) + fileRows(s.files.map(f => ({ name: f.n, size: f.s })), s.written) +
      '<div class="mcx-note">Пишу прямо в ZIP на диске. Память компьютера не растёт, даже если файлов на десятки гигабайт. Страницу не закрывайте.</div>' +
      '<button class="mcx-btn g" data-a="rstop">Остановить приём</button>';
    if (r.state === 'lost') return '<div class="mcx-t">Связь с телефоном потеряна</div>' + progressBlock(s.written, s.total, 0, true) +
      '<div class="mcx-note">Получено ' + fmt(s.written) + ', это уже в архиве на диске. Окно не закрывайте: передача продолжится с этого места.</div>' +
      '<button class="mcx-btn g" data-a="rstop">Остановить приём</button>';
    if (r.state === 'done') return '<div class="mcx-t">✓ Архив сохранён</div><div class="mcx-note ok">' + esc(s.fileName) + ' · ' + fmt(s.total) + ' · ' + fmtT((s.t1 - s.t0) / 1000) + '</div><div class="mcx-sub">Проверка пройдена: размеры всех файлов совпали с телефоном.</div>' +
      '<div class="mcx-btns"><button class="mcx-btn" data-a="rnew">Принять ещё</button><button class="mcx-btn g" data-a="close">Закрыть</button></div>';
    return '<div class="mcx-t">Не получилось</div><div class="mcx-note bad">' + esc(r.msg || 'Ошибка') + '</div><div class="mcx-btns"><button class="mcx-btn" data-a="rnew">Ждать снова</button><button class="mcx-btn g" data-a="close">Закрыть</button></div>';
  }

  // ───────── вход ─────────
  async function openSend() {
    if (ov) closeOv(true);
    role = 'tx'; picked = []; sender = null; chosen = null; peers = [];
    ensureOv('📤 Отправить на компьютер'); paint(true);
    try {
      hub = makeHub('tx', p => { if (sender) sender.onSig(p); }, list => {
        peers = list;
        if (chosen && !peers.some(p => p.dev === chosen)) chosen = null;
        if (!chosen && peers.length === 1) chosen = peers[0].dev;
        if (!sender) paint(true);
      });
      await hub.ready;
    } catch (e) { say('Нет связи с облаком: ' + (e && e.message || e), true); }
    paint(true);
  }
  async function openReceive() {
    if (ov) closeOv(true);
    role = 'rx';
    if (!window.showSaveFilePicker) {
      ensureOv('📥 Принять с телефона');
      ov.querySelector('#mcx-bd').innerHTML = '<div class="mcx-note bad">Приём работает в Chrome или Edge на компьютере. Эти браузеры умеют писать большой файл на диск по частям. В Firefox и Safari такой возможности нет.</div><button class="mcx-btn g" data-a="close">Закрыть</button>';
      return;
    }
    ensureOv('📥 Принять с телефона');
    try {
      recv = new Receiver(null, r => { paint(false); updatePill(); });
      hub = makeHub('rx', p => recv.onSig(p), list => { peers = list; });
      recv.hub = hub;
      await hub.ready;
    } catch (e) { say('Нет связи с облаком: ' + (e && e.message || e), true); }
    paint(true);
  }
  window.mcXferSend = openSend;
  window.mcXferReceive = openReceive;

  // ───────── строки в настройках ─────────
  function settingsRows() {
    try {
      const ph = document.getElementById('set-phone');
      const anchor = ph && ph.closest('.fld');
      if (!anchor || !anchor.parentNode || document.getElementById('xfer-row')) return;
      const row = document.createElement('div');
      row.id = 'xfer-row';
      row.style.cssText = 'background:var(--s2);border-radius:var(--rsm);padding:13px 14px';
      const btn = 'margin-top:9px;background:var(--s2);border:1px solid var(--b1);color:var(--t1);border-radius:var(--rsm);padding:9px 14px;font-size:14px;cursor:pointer;font-family:inherit;margin-right:8px';
      let h = '<div style="font-size:15px;font-weight:600">🔁 Передача файлов телефон ⇄ компьютер</div>' +
        '<div style="font-size:12.5px;color:var(--t2);margin-top:4px;line-height:1.5">Любые файлы любого размера напрямую, без загрузки в облако. Результат: один ZIP на диске компьютера.</div>';
      if (window.RTCPeerConnection) h += '<button style="' + btn + '" onclick="closeSettings();mcXferSend()">📤 Отправить на компьютер</button>';
      if (!isNative()) h += '<button style="' + btn + '" onclick="closeSettings();mcXferReceive()">📥 Принять с телефона</button>';
      row.innerHTML = h;
      anchor.parentNode.insertBefore(row, anchor);
    } catch (e) {}
  }
  (function hookSettings() {
    const tryHook = () => {
      if (typeof window.openSettings !== 'function') return false;
      if (window.openSettings._xfer) return true;
      const o = window.openSettings;
      const w = async function () { const r = await o.apply(this, arguments); settingsRows(); return r; };
      w._xfer = true; window.openSettings = w; return true;
    };
    if (!tryHook()) { let n = 0; const t = setInterval(() => { if (tryHook() || ++n > 40) clearInterval(t); }, 500); }
  })();

  window.mcXfer = { ZipOut, crc32, fsSink, Sender, Receiver, openSend, openReceive, getRelay, _state: () => ({ sender, recv, hub }) };
})();
