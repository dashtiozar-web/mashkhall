/**
 * One live meeting room (a Durable Object per meeting). It is the single
 * authority for what happens during the meeting:
 *   - who is in the meeting, who is waiting, and who was removed;
 *   - who may speak (in "controlled" meetings), raised hands, mutes;
 *   - which camera, microphone and screen tracks are shared with others
 *     (a member who is muted or not allowed to speak is simply not passed
 *     on to anyone else);
 *   - meeting chat (kept only while the meeting runs, then deleted);
 *   - when each person was actually connected and admitted, which is what
 *     attendance is measured from.
 *
 * Browsers connect with a WebSocket after the server has issued them a
 * seat (see sfu.js). Internal calls come from the worker only.
 */
import { DurableObject } from 'cloudflare:workers';

const MAX_CHAT = 400;
const MAX_MESSAGE = 900_000; // characters (an image or small file as a data link)

export class MeetingRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS people (
      uid TEXT PRIMARY KEY, name TEXT, photo TEXT, role TEXT, host INTEGER, state TEXT,
      canSpeak INTEGER DEFAULT 0, hand INTEGER DEFAULT 0, handAt TEXT,
      mic INTEGER DEFAULT 0, cam INTEGER DEFAULT 0, screen INTEGER DEFAULT 0,
      tracks TEXT DEFAULT '{}', firstSeen TEXT, lastSeen TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS intervals (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, conn TEXT, joinedAt TEXT, leftAt TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, uid TEXT, name TEXT, kind TEXT, text TEXT, data TEXT, fileName TEXT)`);
  }

  // ------------------------------------------------------------ state

  config() {
    const row = this.sql.exec(`SELECT v FROM meta WHERE k = 'config'`).toArray()[0];
    return row ? JSON.parse(row.v) : { status: 'none', waitingRoom: 'host', speaking: 'open', media: 'audio', locked: false, chatOpen: true };
  }

  setConfig(patch) {
    const next = { ...this.config(), ...patch };
    this.sql.exec(`INSERT INTO meta (k, v) VALUES ('config', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v`, JSON.stringify(next));
    return next;
  }

  person(uid) {
    return this.sql.exec('SELECT * FROM people WHERE uid = ?', uid).toArray()[0] || null;
  }

  /** Open connections (of one person, or everyone), leaving out one that is closing. */
  sockets(uid) {
    return this.ctx.getWebSockets(uid ? `u:${uid}` : undefined).filter((ws) => ws !== this.closing && ws.readyState !== 2 && ws.readyState !== 3);
  }

  connected(uid) {
    return this.sockets(uid).length > 0;
  }

  update(uid, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    this.sql.exec(`UPDATE people SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE uid = ?`, ...keys.map((k) => fields[k]), uid);
  }

  /** Who may currently speak (microphone) and share their screen. */
  mayTalk(p) {
    return Boolean(p.host) || this.config().speaking !== 'controlled' || Boolean(p.canSpeak);
  }

  roster() {
    return this.sql.exec('SELECT * FROM people ORDER BY host DESC, name').toArray()
      .filter((p) => this.connected(p.uid) && (p.state === 'admitted' || p.state === 'waiting'))
      .map((p) => {
        const tracks = JSON.parse(p.tracks || '{}');
        const talk = this.mayTalk(p);
        // Tracks are only passed on while they are allowed: a muted or
        // silenced member's microphone reaches nobody.
        const shared = p.state !== 'admitted' ? {} : {
          ...(p.mic && talk && tracks.mic ? { mic: tracks.mic } : {}),
          // Cameras are passed on only in audio-and-video meetings.
          ...(p.cam && tracks.cam && this.config().media === 'video' ? { cam: tracks.cam } : {}),
          ...(p.screen && talk && tracks.screen ? { screen: tracks.screen } : {}),
          ...(p.screen && talk && tracks.screenAudio ? { screenAudio: tracks.screenAudio } : {}),
        };
        return {
          uid: p.uid, name: p.name, photo: p.photo, role: p.role, host: Boolean(p.host), state: p.state,
          canSpeak: talk, hand: Boolean(p.hand), handAt: p.handAt, mic: Boolean(p.mic && talk), cam: Boolean(p.cam), screen: Boolean(p.screen && talk),
          tracks: shared,
        };
      });
  }

  snapshot(uid) {
    const cfg = this.config();
    const me = this.person(uid);
    const chat = me?.state === 'admitted'
      ? this.sql.exec('SELECT id, at, uid, name, kind, text, data, fileName FROM chat ORDER BY id DESC LIMIT 200').toArray().reverse()
      : [];
    return {
      type: 'snapshot',
      meeting: { id: cfg.meetingId, title: cfg.title, status: cfg.status, startedAt: cfg.startedAt, locked: cfg.locked, speaking: cfg.speaking, media: cfg.media === 'video' ? 'video' : 'audio', waitingRoom: cfg.waitingRoom, chatOpen: cfg.chatOpen !== false },
      me: me ? { uid, host: Boolean(me.host), role: me.role, state: me.state, canSpeak: this.mayTalk(me) } : null,
      people: this.roster(),
      chat,
    };
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  broadcast(msg, filter = () => true) {
    for (const ws of this.sockets()) {
      const a = ws.deserializeAttachment() || {};
      if (filter(a)) this.send(ws, msg);
    }
  }

  /** Everyone gets their own up-to-date view. */
  refresh() {
    for (const ws of this.sockets()) {
      const a = ws.deserializeAttachment() || {};
      this.send(ws, this.snapshot(a.uid));
    }
  }

  // ------------------------------------------------------------ attendance

  openInterval(uid, conn) {
    const open = this.sql.exec('SELECT id FROM intervals WHERE uid = ? AND conn = ? AND leftAt IS NULL', uid, conn).toArray();
    if (!open.length) this.sql.exec('INSERT INTO intervals (uid, conn, joinedAt) VALUES (?, ?, ?)', uid, conn, new Date().toISOString());
  }

  closeIntervals(uid, conn) {
    const at = new Date().toISOString();
    if (conn) this.sql.exec('UPDATE intervals SET leftAt = ? WHERE uid = ? AND conn = ? AND leftAt IS NULL', at, uid, conn);
    else if (uid) this.sql.exec('UPDATE intervals SET leftAt = ? WHERE uid = ? AND leftAt IS NULL', at, uid);
    else this.sql.exec('UPDATE intervals SET leftAt = ? WHERE leftAt IS NULL', at);
  }

  /** Start counting someone's time for every connection they have open. */
  admit(uid) {
    this.update(uid, { state: 'admitted' });
    for (const ws of this.sockets(uid)) this.openInterval(uid, (ws.deserializeAttachment() || {}).conn);
  }

  hostPresent() {
    return this.sql.exec(`SELECT uid FROM people WHERE host = 1 AND state = 'admitted'`).toArray().some((p) => this.connected(p.uid));
  }

  // ------------------------------------------------------------ internal API

  async fetch(request) {
    const url = new URL(request.url);
    const cfg = this.config();

    if (url.pathname === '/configure') {
      const b = await request.json();
      const next = this.setConfig(b);
      if (b.status === 'live' && cfg.status !== 'live') this.setConfig({ startedAt: b.startedAt || new Date().toISOString() });
      // Opening the waiting room to everyone admits those waiting.
      if (next.waitingRoom === 'off' || (next.waitingRoom === 'host' && this.hostPresent())) {
        for (const p of this.sql.exec(`SELECT uid FROM people WHERE state = 'waiting'`).toArray()) this.admit(p.uid);
      }
      this.refresh();
      return Response.json({ ok: true });
    }

    if (url.pathname === '/admitted') {
      const p = this.person(url.searchParams.get('uid') || '');
      const ok = cfg.status === 'live' && p && p.state === 'admitted';
      return new Response(null, { status: ok ? 200 : 403 });
    }

    if (url.pathname === '/participation') {
      const rows = this.sql.exec('SELECT uid, joinedAt, leftAt FROM intervals ORDER BY id').toArray();
      const people = new Map();
      for (const r of rows) {
        const cur = people.get(r.uid) || { uid: r.uid, intervals: [] };
        cur.intervals.push([r.joinedAt, r.leftAt]);
        people.set(r.uid, cur);
      }
      return Response.json({ people: [...people.values()] });
    }

    if (url.pathname === '/summary') {
      return Response.json({ status: cfg.status, participants: this.roster().filter((p) => p.state === 'admitted').length, waiting: this.roster().filter((p) => p.state === 'waiting').length });
    }

    if (url.pathname === '/kick') {
      const { uid } = await request.json();
      this.removePerson(uid, 'removed');
      return Response.json({ ok: true });
    }

    if (url.pathname === '/end') {
      this.endMeeting();
      return Response.json({ ok: true });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      if (cfg.status !== 'live') return new Response('The meeting is not live.', { status: 409 });
      const seat = JSON.parse(request.headers.get('x-seat') || '{}');
      const existing = this.person(seat.uid);
      if (existing?.state === 'removed' && !seat.host) return new Response('Removed from this meeting.', { status: 403 });
      if (cfg.locked && !seat.host && existing?.state !== 'admitted') return new Response('The meeting is locked.', { status: 423 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const conn = crypto.randomUUID();
      this.ctx.acceptWebSocket(server, [`u:${seat.uid}`]);
      server.serializeAttachment({ uid: seat.uid, conn, host: Boolean(seat.host) });
      const at = new Date().toISOString();
      if (!existing) {
        this.sql.exec(`INSERT INTO people (uid, name, photo, role, host, state, canSpeak, firstSeen, lastSeen) VALUES (?, ?, ?, ?, ?, 'waiting', 0, ?, ?)`,
          seat.uid, String(seat.name || 'Member').slice(0, 80), String(seat.photo || '').slice(0, 500), seat.role || 'member', seat.host ? 1 : 0, at, at);
      } else {
        this.update(seat.uid, { name: String(seat.name || existing.name).slice(0, 80), photo: String(seat.photo || existing.photo || '').slice(0, 500), role: seat.role || existing.role, host: seat.host ? 1 : 0, lastSeen: at, mic: 0, cam: 0, screen: 0, tracks: '{}' });
      }
      const p = this.person(seat.uid);
      const wasAdmitted = p.state === 'admitted';
      if (seat.host || wasAdmitted || cfg.waitingRoom === 'off' || (cfg.waitingRoom === 'host' && this.hostPresent())) {
        this.admit(seat.uid);
        if (seat.host && cfg.waitingRoom === 'host') {
          for (const w of this.sql.exec(`SELECT uid FROM people WHERE state = 'waiting'`).toArray()) this.admit(w.uid);
        }
      } else {
        this.update(seat.uid, { state: 'waiting' });
      }
      if (!existing || existing.state !== 'admitted' || !this.sockets(seat.uid).length) {
        this.broadcast({ type: 'event', event: this.person(seat.uid).state === 'waiting' ? 'waiting' : 'joined', name: p.name, uid: seat.uid }, (a) => a.uid !== seat.uid);
      }
      this.refresh();
      this.send(server, this.snapshot(seat.uid));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  removePerson(uid, state) {
    const p = this.person(uid);
    if (!p) return;
    this.update(uid, { state, mic: 0, cam: 0, screen: 0, tracks: '{}', hand: 0 });
    this.closeIntervals(uid);
    for (const ws of this.sockets(uid)) {
      this.send(ws, { type: state === 'removed' ? 'removed' : 'denied' });
      try { ws.close(4003, state); } catch { /* closed */ }
    }
    this.broadcast({ type: 'event', event: 'left', name: p.name, uid });
    this.refresh();
  }

  endMeeting() {
    this.setConfig({ status: 'ended', endedAt: new Date().toISOString() });
    this.closeIntervals();
    // Chat, files and shared links are not kept after the meeting.
    this.sql.exec('DELETE FROM chat');
    for (const ws of this.sockets()) {
      this.send(ws, { type: 'ended' });
      try { ws.close(4000, 'ended'); } catch { /* closed */ }
    }
  }

  // ------------------------------------------------------------ WebSocket

  async webSocketMessage(ws, raw) {
    const a = ws.deserializeAttachment() || {};
    const me = this.person(a.uid);
    if (!me || typeof raw !== 'string' || raw.length > MAX_MESSAGE + 2000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const cfg = this.config();
    if (cfg.status !== 'live') return this.send(ws, { type: 'ended' });
    if (msg.type === 'ping') return this.send(ws, { type: 'pong' });
    if (me.state !== 'admitted') return;
    const host = Boolean(me.host);
    const target = msg.uid ? this.person(String(msg.uid)) : null;

    switch (msg.type) {
      case 'media': {
        // My camera, microphone and screen, and the track details others need to receive them.
        const tracks = { ...JSON.parse(me.tracks || '{}') };
        for (const k of ['mic', 'cam', 'screen', 'screenAudio']) {
          if (msg.tracks && k in msg.tracks) {
            const t = msg.tracks[k];
            if (t && typeof t.sessionId === 'string' && typeof t.trackName === 'string') tracks[k] = { sessionId: t.sessionId.slice(0, 100), trackName: t.trackName.slice(0, 100), location: 'remote' };
            else delete tracks[k];
          }
        }
        const want = { mic: Boolean(msg.mic), cam: Boolean(msg.cam), screen: Boolean(msg.screen) };
        if (!this.mayTalk(me)) { want.mic = false; want.screen = false; }
        if (want.screen && !me.screen) {
          // One screen at a time: a host takes over; a member waits.
          const other = this.sql.exec(`SELECT uid FROM people WHERE screen = 1 AND uid != ? AND state = 'admitted'`, a.uid).toArray().filter((p) => this.connected(p.uid));
          if (other.length && !host) { want.screen = false; this.send(ws, { type: 'notice', text: 'Someone else is sharing their screen. Ask the leader if you need to present.' }); }
          else for (const o of other) { this.update(o.uid, { screen: 0 }); for (const s of this.sockets(o.uid)) this.send(s, { type: 'forced', what: 'screen', text: 'The leader is now sharing their screen.' }); }
        }
        this.update(a.uid, { tracks: JSON.stringify(tracks), mic: want.mic ? 1 : 0, cam: want.cam ? 1 : 0, screen: want.screen ? 1 : 0 });
        return this.refresh();
      }
      case 'hand': {
        this.update(a.uid, { hand: msg.raised ? 1 : 0, handAt: msg.raised ? new Date().toISOString() : null });
        if (msg.raised) this.broadcast({ type: 'event', event: 'hand', name: me.name, uid: a.uid }, (x) => x.host);
        return this.refresh();
      }
      case 'chat': {
        if (cfg.chatOpen === false && !host) return this.send(ws, { type: 'notice', text: 'The leader has paused the chat.' });
        const kind = ['text', 'image', 'file'].includes(msg.kind) ? msg.kind : 'text';
        const text = String(msg.text || '').slice(0, 2000);
        const data = kind === 'text' ? '' : String(msg.data || '');
        if (kind !== 'text' && (!/^data:(image\/(png|jpeg|webp|gif)|application\/pdf|text\/plain|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/msword);base64,/.test(data) || data.length > MAX_MESSAGE)) {
          return this.send(ws, { type: 'notice', text: 'That file type or size cannot be shared in the chat (images, PDF, Word or text, up to about 650 KB).' });
        }
        if (!text.trim() && !data) return;
        const at = new Date().toISOString();
        this.sql.exec('INSERT INTO chat (at, uid, name, kind, text, data, fileName) VALUES (?, ?, ?, ?, ?, ?, ?)', at, a.uid, me.name, kind, text, data, String(msg.fileName || '').slice(0, 120));
        const id = this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id;
        this.sql.exec('DELETE FROM chat WHERE id <= ?', id - MAX_CHAT);
        return this.broadcast({ type: 'chat', message: { id, at, uid: a.uid, name: me.name, kind, text, data, fileName: String(msg.fileName || '').slice(0, 120) } }, (x) => this.person(x.uid)?.state === 'admitted');
      }
      default:
        break;
    }

    // Everything below is for the meeting's hosts only.
    if (!host) return this.send(ws, { type: 'notice', text: 'Only the meeting leader can do that.' });
    switch (msg.type) {
      case 'admit':
        if (target?.state === 'waiting') { this.admit(target.uid); this.broadcast({ type: 'event', event: 'joined', name: target.name, uid: target.uid }); }
        return this.refresh();
      case 'admitAll':
        for (const p of this.sql.exec(`SELECT uid FROM people WHERE state = 'waiting'`).toArray()) this.admit(p.uid);
        return this.refresh();
      case 'deny':
        if (target?.state === 'waiting') this.removePerson(target.uid, 'denied');
        return;
      case 'mute':
        if (target && !target.host) {
          this.update(target.uid, { mic: 0 });
          for (const s of this.sockets(target.uid)) this.send(s, { type: 'forced', what: 'mic', text: 'The leader muted your microphone.' });
        }
        return this.refresh();
      case 'muteAll':
        for (const p of this.sql.exec('SELECT uid FROM people WHERE host = 0 AND mic = 1').toArray()) {
          this.update(p.uid, { mic: 0 });
          for (const s of this.sockets(p.uid)) this.send(s, { type: 'forced', what: 'mic', text: 'The leader muted everyone.' });
        }
        return this.refresh();
      case 'stopScreen':
        if (target) { this.update(target.uid, { screen: 0 }); for (const s of this.sockets(target.uid)) this.send(s, { type: 'forced', what: 'screen', text: 'The leader stopped your screen sharing.' }); }
        return this.refresh();
      case 'speak':
        if (target && !target.host) {
          this.update(target.uid, { canSpeak: msg.allow ? 1 : 0, hand: 0, ...(msg.allow ? {} : { mic: 0, screen: 0 }) });
          for (const s of this.sockets(target.uid)) this.send(s, { type: 'notice', text: msg.allow ? 'The leader has given you permission to speak.' : 'The leader has ended your turn to speak.' });
        }
        return this.refresh();
      case 'lowerHands':
        this.sql.exec('UPDATE people SET hand = 0');
        return this.refresh();
      case 'callType': {
        // The leader can allow cameras during an audio meeting, or switch them off for everyone.
        const media = msg.media === 'video' ? 'video' : 'audio';
        this.setConfig({ media });
        if (media === 'audio') {
          this.sql.exec('UPDATE people SET cam = 0');
          this.broadcast({ type: 'forced', what: 'cam', text: 'The leader switched this meeting to audio only. Cameras are off.' }, (x) => !x.host);
        } else {
          this.broadcast({ type: 'notice', text: 'The leader has allowed cameras in this meeting.' });
        }
        return this.refresh();
      }
      case 'chatOpen':
        this.setConfig({ chatOpen: Boolean(msg.open) });
        this.broadcast({ type: 'notice', text: msg.open ? 'The chat is open again.' : 'The leader has paused the chat.' });
        return this.refresh();
      case 'deleteChat':
        this.sql.exec('DELETE FROM chat WHERE id = ?', Number(msg.id) || 0);
        return this.broadcast({ type: 'chatDeleted', id: Number(msg.id) || 0 });
      default:
        return undefined;
    }
  }

  async webSocketClose(ws) {
    const a = ws.deserializeAttachment() || {};
    if (!a.uid) return;
    this.closing = ws;
    try {
      this.closeIntervals(a.uid, a.conn);
      this.afterClose(a);
    } finally {
      this.closing = null;
    }
  }

  afterClose(a) {
    const p = this.person(a.uid);
    if (p && !this.sockets(a.uid).length) {
      this.update(a.uid, { mic: 0, cam: 0, screen: 0, tracks: '{}', hand: 0 });
      if (p.state === 'admitted' || p.state === 'waiting') this.broadcast({ type: 'event', event: 'left', name: p.name, uid: a.uid }, (x) => x.uid !== a.uid);
      // In "wait for the leader" rooms, people wait again if every host leaves.
      this.refresh();
    }
  }

  async webSocketError(ws) {
    return this.webSocketClose(ws);
  }
}
