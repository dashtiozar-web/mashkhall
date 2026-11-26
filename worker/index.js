/**
 * Mashkhally Zhyanawa website worker.
 *
 * Serves the website (static files) and a privacy-friendly visitor counter:
 *   POST /api/visit     – counts this visit by country (and, in Iraq, region)
 *   GET  /api/visitors  – public totals
 *
 * Cloudflare works out the visitor's country and region from the connection.
 * IP addresses are never stored or shown. To count each person once per day,
 * a one-way fingerprint is made from the address with a random key that is
 * replaced every day, and yesterday's fingerprints are deleted.
 */
import { DurableObject } from 'cloudflare:workers';
import { handleMeetings, runSchedule } from './meetings.js';
import { logo } from './appreciation.js';
import { handleMembers } from './members.js';
import { handleCertificates } from './certificates.js';
import { PROJECT, DATABASE, queryDocs, commit } from './firestore.js';
import placesConfig from '../src/config/administrations.json';

const ADMINISTRATIONS = placesConfig.administrations;

export { MeetingRoom } from './meetingRoom.js';

const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|facebookexternalhit|whatsapp|telegram/i;
const KURDISTAN_CODES = ['AR', 'SU', 'DA', 'HA', 'KR'];
const KURDISTAN_NAMES = /erbil|arbil|irbil|hawler|hewl[eê]r|sulay|sulaim|slemani|silêman|duhok|dahuk|dohuk|halabja|kurdistan/i;
// Provinces of Iran with large Kurdish populations (approximate: West
// Azerbaijan is only partly Kurdish).
const IRAN_KURDISH = /kurdistan|kordestan|kordestān|kermanshah|kermānshāh|ilam|īlām|west azarbaijan|west azerbaijan|azarbayjan-e gharbi|azarbaijan-e gharbi|azerbaijan, west|western azerbaijan/i;
// Public figures smaller than this are grouped, so few visitors are never singled out.
/** Listed separately from the rest of Iraq (ISO 3166-2 code). */
const KURDISTAN_REGION = 'IQ-KR';
const SECURITY_KINDS = ['login_failed', 'signup_failed', 'upload_rejected', 'comment_blocked', 'submission_refused', 'auth_config', 'rules_outdated', 'rate_limited', 'csp_violation'];

/** Largest request body accepted by the API (meeting chat files go over the live connection instead). */
const MAX_BODY = 256 * 1024;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra },
  });

export class VisitCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS totals (country TEXT NOT NULL, area TEXT NOT NULL, kind TEXT NOT NULL,
        people INTEGER NOT NULL DEFAULT 0, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (country, area, kind));
      CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, people INTEGER NOT NULL DEFAULT 0, visits INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS seen (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h));
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sec (day TEXT NOT NULL, kind TEXT NOT NULL, country TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind, country));
      CREATE TABLE IF NOT EXISTS hits (day TEXT NOT NULL, h TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, h));
      CREATE TABLE IF NOT EXISTS cdays (day TEXT NOT NULL, country TEXT NOT NULL, area TEXT NOT NULL, kind TEXT NOT NULL,
        people INTEGER NOT NULL DEFAULT 0, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, country, area, kind));
    `);
  }

  async salt(day) {
    const row = this.sql.exec('SELECT v FROM meta WHERE k = ?', `salt:${day}`).toArray()[0];
    if (row) return row.v;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const v = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    this.sql.exec('DELETE FROM meta WHERE k LIKE ?', 'salt:%');
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?)', `salt:${day}`, v);
    // Yesterday's fingerprints are no longer needed; security counts are kept 90 days.
    this.sql.exec('DELETE FROM seen WHERE day <> ?', day);
    this.sql.exec('DELETE FROM hits WHERE day <> ?', day);
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    this.sql.exec('DELETE FROM sec WHERE day < ?', cutoff);
    if (!this.sql.exec("SELECT v FROM meta WHERE k = 'since'").toArray()[0]) {
      this.sql.exec("INSERT INTO meta (k, v) VALUES ('since', ?)", new Date().toISOString());
    }
    return v;
  }

  async fingerprint(ip, ua) {
    const day = new Date().toISOString().slice(0, 10);
    const salt = await this.salt(day);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}|${ua}`));
    return { day, h: Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('') };
  }

  /** Counts a security event (aggregated by day, type and country only). */
  async security({ ip, ua, kind, country }) {
    const { day, h } = await this.fingerprint(ip, ua);
    // Each person can add at most 50 events of one kind a day.
    const key = `${h}:${kind}`;
    this.sql.exec('INSERT INTO hits (day, h, n) VALUES (?, ?, 1) ON CONFLICT (day, h) DO UPDATE SET n = n + 1', day, key);
    const n = this.sql.exec('SELECT n FROM hits WHERE day = ? AND h = ?', day, key).toArray()[0]?.n || 0;
    if (n > 50) return { counted: false };
    this.sql.exec('INSERT INTO sec (day, kind, country, n) VALUES (?, ?, ?, 1) ON CONFLICT (day, kind, country) DO UPDATE SET n = n + 1', day, kind, country);
    return { counted: true };
  }

  async record({ ip, ua, country, area, member }) {
    const { day, h } = await this.fingerprint(ip, ua);
    // Many visits from one person in a day are counted as unusual traffic, not visits.
    const vk = `${h}:visit`;
    this.sql.exec('INSERT INTO hits (day, h, n) VALUES (?, ?, 1) ON CONFLICT (day, h) DO UPDATE SET n = n + 1', day, vk);
    const hitsToday = this.sql.exec('SELECT n FROM hits WHERE day = ? AND h = ?', day, vk).toArray()[0]?.n || 0;
    if (hitsToday > 60) {
      if (hitsToday === 61) this.sql.exec("INSERT INTO sec (day, kind, country, n) VALUES (?, 'excessive_requests', ?, 1) ON CONFLICT (day, kind, country) DO UPDATE SET n = n + 1", day, country);
      return { counted: false };
    }
    const isNew = this.sql.exec('SELECT 1 FROM seen WHERE day = ? AND h = ?', day, h).toArray().length === 0;
    if (isNew) this.sql.exec('INSERT INTO seen (day, h) VALUES (?, ?)', day, h);
    const kind = member ? 'member' : 'visitor';
    const p = isNew ? 1 : 0;
    this.sql.exec(
      `INSERT INTO totals (country, area, kind, people, visits) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT (country, area, kind) DO UPDATE SET people = people + excluded.people, visits = visits + 1`,
      country, area, kind, p,
    );
    // The same visit by day and country, so administrators can look at any period.
    this.sql.exec(
      `INSERT INTO cdays (day, country, area, kind, people, visits) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT (day, country, area, kind) DO UPDATE SET people = people + excluded.people, visits = visits + 1`,
      day, country, area, kind, p,
    );
    this.sql.exec(
      `INSERT INTO days (day, people, visits) VALUES (?, ?, 1)
       ON CONFLICT (day) DO UPDATE SET people = people + excluded.people, visits = visits + 1`,
      day, p,
    );
    return { counted: true, newToday: isNew };
  }

  async bot(country) {
    const day = new Date().toISOString().slice(0, 10);
    this.sql.exec("INSERT INTO sec (day, kind, country, n) VALUES (?, 'bot', ?, 1) ON CONFLICT (day, kind, country) DO UPDATE SET n = n + 1", day, country);
  }

  async securityStats() {
    const rows = this.sql.exec('SELECT day, kind, country, n FROM sec ORDER BY day DESC').toArray();
    return { rows, updatedAt: new Date().toISOString() };
  }

  /**
   * Totals for a period. With no period, all-time totals (kept since the
   * counter began); with `from`/`to` (YYYY-MM-DD, inclusive), the daily
   * country figures recorded since per-day country counting began.
   */
  async stats(range = null) {
    const day = new Date().toISOString().slice(0, 10);
    const rows = range
      ? this.sql.exec(
        'SELECT country, area, kind, SUM(people) AS people, SUM(visits) AS visits FROM cdays WHERE day >= ? AND day <= ? GROUP BY country, area, kind',
        range.from, range.to,
      ).toArray()
      : this.sql.exec('SELECT country, area, kind, people, visits FROM totals').toArray();
    const today = this.sql.exec('SELECT people, visits FROM days WHERE day = ?', day).toArray()[0] || { people: 0, visits: 0 };
    const since = this.sql.exec("SELECT v FROM meta WHERE k = 'since'").toArray()[0]?.v || null;
    const dailySince = this.sql.exec('SELECT MIN(day) AS d FROM cdays').toArray()[0]?.d || null;
    const dayRows = range
      ? this.sql.exec('SELECT day, people, visits FROM days WHERE day >= ? AND day <= ? ORDER BY day', range.from, range.to).toArray()
      : this.sql.exec('SELECT day, people, visits FROM days ORDER BY day DESC LIMIT 30').toArray().reverse();
    const countries = new Map();
    const sum = { people: 0, visits: 0 };
    const kinds = { member: { people: 0, visits: 0 }, visitor: { people: 0, visits: 0 } };
    const iraq = { kurdistan: { people: 0, visits: 0 }, rest: { people: 0, visits: 0 } };
    const iran = { kurdistan: { people: 0, visits: 0 }, rest: { people: 0, visits: 0 } };
    for (const r of rows) {
      const people = Number(r.people) || 0;
      const visits = Number(r.visits) || 0;
      // The Kurdistan Region is listed on its own, and Iraq then means the
      // rest of Iraq, so the two always add up to every visit from Iraq.
      const code = r.country === 'IQ' && r.area === 'kurdistan' ? KURDISTAN_REGION : r.country;
      const c = countries.get(code) || { code, people: 0, visits: 0, members: 0, memberVisits: 0 };
      c.people += people; c.visits += visits;
      if (r.kind === 'member') { c.members += people; c.memberVisits += visits; }
      countries.set(code, c);
      sum.people += people; sum.visits += visits;
      if (kinds[r.kind]) { kinds[r.kind].people += people; kinds[r.kind].visits += visits; }
      if (r.country === 'IQ') {
        const part = r.area === 'kurdistan' ? iraq.kurdistan : iraq.rest;
        part.people += people; part.visits += visits;
      }
      if (r.country === 'IR') {
        const part = r.area === 'kurdistan' ? iran.kurdistan : iran.rest;
        part.people += people; part.visits += visits;
      }
    }
    return {
      total: sum,
      members: kinds.member,
      visitors: kinds.visitor,
      today,
      iraq,
      iran,
      countries: Array.from(countries.values()).sort((a, b) => b.visits - a.visits || b.people - a.people || a.code.localeCompare(b.code)),
      days: dayRows,
      since,
      dailySince,
      range: range || null,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Limits for the API, per visitor (by network address, which is not stored):
 * a general limit, and a tighter one for actions that write or sign in.
 * Uses Cloudflare's rate limiting (wrangler.jsonc "ratelimits"); if that is
 * not available the request is allowed, so the site never fails closed.
 */
const guard = async (request, env, url) => {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json({ error: 'Request too large' }, 413);
  const write = request.method !== 'GET' && request.method !== 'HEAD' && !url.pathname.startsWith('/api/meetings/sfu/');
  try {
    const general = env.API_LIMIT ? await env.API_LIMIT.limit({ key: ip }) : { success: true };
    const strict = write && env.WRITE_LIMIT ? await env.WRITE_LIMIT.limit({ key: `${ip}:${url.pathname.split('/').slice(0, 4).join('/')}` }) : { success: true };
    if (!general.success || !strict.success) {
      const { country } = locate(request);
      // Only a sample is recorded, so a flood of refused requests cannot overload the counter.
      if (env.VISITS && Math.random() < 0.05) await counter(env).security({ ip, ua: request.headers.get('user-agent') || '', kind: 'rate_limited', country }).catch(() => null);
      return json({ error: 'Too many requests. Please wait a minute and try again.' }, 429, { 'retry-after': '60' });
    }
  } catch { /* limiter unavailable: allow */ }
  return null;
};

const counter = (env) => env.VISITS.get(env.VISITS.idFromName('all'));

/**
 * Public version. Every country is listed with its own figures, and the
 * Kurdistan Region of Iraq is listed on its own like a country, so every
 * figure adds up. These are approximate, coarse locations: no IP address is
 * kept and no one can be identified from them. The member/visitor split per
 * country stays private.
 */
const publicStats = (s) => ({
  ...s,
  countries: s.countries.map(({ members, memberVisits, ...c }) => c),
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = { today: 0, '7d': 6, '30d': 29, '90d': 89, '365d': 364 };

/** ?period=30d, or ?from=2026-01-01&to=2026-01-31 (administrators). No period: all time. */
const rangeFrom = (url) => {
  const today = new Date().toISOString().slice(0, 10);
  const period = url.searchParams.get('period') || '';
  if (period in PERIODS) {
    return { from: new Date(Date.now() - PERIODS[period] * 86400000).toISOString().slice(0, 10), to: today };
  }
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || today;
  if (DAY.test(from) && DAY.test(to) && from <= to) return { from, to };
  return null;
};

/**
 * Administrators only: the person's Firebase sign-in token is checked by
 * Firestore itself, by reading their own entry in /admins with it.
 */
const isAdminRequest = async (request) => {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  let uid = '';
  try {
    uid = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).user_id || '';
  } catch { return false; }
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid)) return false;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents/admins/${uid}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return res.ok;
};

const locate = (request) => {
  const cf = request.cf || {};
  const country = /^[A-Z]{2}$/.test(cf.country || '') ? cf.country : 'XX';
  let area = '';
  if (country === 'IQ') area = KURDISTAN_CODES.includes(cf.regionCode || '') || KURDISTAN_NAMES.test(cf.region || '') ? 'kurdistan' : 'iraq';
  if (country === 'IR') area = IRAN_KURDISH.test(cf.region || '') ? 'kurdistan' : 'iran';
  return { country, area };
};

/**
 * Public numbers of members by province or country, by city or town, and by
 * independent administration. Only totals: never who is a member of which kind.
 */
const placeStats = async (env) => {
  const cache = caches.default;
  const key = new Request('https://cache.mashkhall/place-stats');
  const hit = await cache.match(key);
  if (hit) return hit;
  const members = await queryDocs(env, 'members', { where: [['status', '==', 'active']] });
  const byChapter = {};
  const byCity = {};
  const byAdministration = {};
  const owner = new Map();
  for (const a of ADMINISTRATIONS) for (const c of a.cities) owner.set(`${a.province}|${c.toLowerCase()}`, a.id);
  for (const m of members) {
    const ch = m.chapterId || '';
    if (!ch) continue;
    byChapter[ch] = (byChapter[ch] || 0) + 1;
    const city = String(m.city || '').trim();
    if (city) {
      byCity[ch] = byCity[ch] || {};
      byCity[ch][city] = (byCity[ch][city] || 0) + 1;
      const adm = owner.get(`${ch}|${city.toLowerCase()}`);
      if (adm) byAdministration[adm] = (byAdministration[adm] || 0) + 1;
    }
  }
  const out = json({ total: members.filter((m) => m.chapterId).length, byChapter, byCity, byAdministration, updatedAt: new Date().toISOString() }, 200, { 'cache-control': 'public, max-age=120' });
  await cache.put(key, out.clone());
  return out;
};

/**
 * Kinds of membership were briefly public on member profiles. Move any that
 * remain to member_tiers (readable only by Pêşeng members and staff).
 */
const movePublicTiers = async (env) => {
  const found = await queryDocs(env, 'public_profiles', { where: [['tier', 'in', ['peshang', 'pishtiwan', 'komar']]], limit: 200 });
  if (!found.length) return;
  const ops = [];
  for (const p of found) {
    ops.push({ merge: `member_tiers/${p.id}`, data: { id: p.id, tier: p.tier, chapterId: p.chapterId || '', updatedAt: new Date().toISOString() } });
    ops.push({ update: `public_profiles/${p.id}`, data: {}, remove: ['tier'] });
  }
  await commit(env, ops);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const refused = await guard(request, env, url);
      if (refused) return refused;
    }

    if (url.pathname === '/api/visit') {
      if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
      const ua = request.headers.get('user-agent') || '';
      const { country, area } = locate(request);
      if (BOT.test(ua)) { await counter(env).bot(country); return json({ counted: false }); }
      let member = false;
      try { member = Boolean((await request.json()).member); } catch { /* no body */ }
      const ip = request.headers.get('cf-connecting-ip') || '';
      const result = await counter(env).record({ ip, ua, country, area, member });
      return json(result);
    }

    if (url.pathname === '/api/visitors') {
      const range = rangeFrom(url);
      if (url.searchParams.get('full') === '1') {
        if (!(await isAdminRequest(request))) return json({ error: 'Administrators only' }, 403);
        return json(await counter(env).stats(range));
      }
      // The public page shows all-time figures or one of the fixed periods.
      const publicRange = url.searchParams.get('period') in PERIODS ? range : null;
      return json(publicStats(await counter(env).stats(publicRange)), 200, { 'cache-control': 'public, max-age=20' });
    }

    if (url.pathname === '/api/security-event') {
      if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
      let kind = '';
      try { kind = String((await request.json()).kind || ''); } catch { /* no body */ }
      if (!SECURITY_KINDS.includes(kind)) return json({ error: 'Unknown event' }, 400);
      const { country } = locate(request);
      const ip = request.headers.get('cf-connecting-ip') || '';
      return json(await counter(env).security({ ip, ua: request.headers.get('user-agent') || '', kind, country }));
    }

    // Reports of content the browser refused to load (Content-Security-Policy).
    if (url.pathname === '/api/csp-report') {
      if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
      const { country } = locate(request);
      const ip = request.headers.get('cf-connecting-ip') || '';
      await counter(env).security({ ip, ua: request.headers.get('user-agent') || '', kind: 'csp_violation', country });
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/api/security') {
      if (!(await isAdminRequest(request))) return json({ error: 'Administrators only' }, 403);
      return json(await counter(env).securityStats());
    }

    // How to report a security problem (RFC 9116).
    if (url.pathname === '/.well-known/security.txt') {
      const expires = new Date(Date.now() + 180 * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
      return new Response(`Contact: https://mashkhall.com/contact\nExpires: ${expires}\nPreferred-Languages: en, ckb, ar\nCanonical: https://mashkhall.com/.well-known/security.txt\nPolicy: https://mashkhall.com/legal\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
    }
    if (url.pathname.startsWith('/.well-known/')) return env.ASSETS.fetch(request);

    if (url.pathname.startsWith('/api/meetings/')) return handleMeetings(request, env);
    if (url.pathname === '/api/logo') return logo(request, env);
    if (url.pathname === '/api/place-stats') return placeStats(env);
    if (url.pathname.startsWith('/api/members/') || url.pathname.startsWith('/api/verify/')) return handleMembers(request, env);
    if (url.pathname.startsWith('/api/appreciation/')) return handleCertificates(request, env);

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },

  /** Every five minutes: meeting reminders (see wrangler.jsonc "triggers"). */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runSchedule(env).catch((e) => console.error('meeting schedule', e?.stack || e)));
    ctx.waitUntil(movePublicTiers(env).catch((e) => console.error('tiers', e?.stack || e)));
  },
};
