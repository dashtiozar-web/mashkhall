/**
 * Shared by the meetings and appreciation parts of the server: who is
 * asking (from their verified sign-in and official member record), what
 * rooms exist, and the audit record.
 */
import { bearer, commit, getDoc, getDocs, queryDocs, verifyIdToken } from './firestore.js';
import * as L from './meetingLogic.js';
import { councilsOf } from './councils.js';

export const OWNER = 'dashtiozar@gmail.com';
export const SITE = 'https://17shubat.org.uk';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export const now = () => new Date().toISOString();
export const rid = (p) => `${p}${Date.now().toString(36)}${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join('')}`;
export const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------------------------------------------------------------- context

/** Everything needed to decide what this person may do. Loaded once per request. */
export const contextFor = async (env, request) => {
  const who = await verifyIdToken(bearer(request));
  if (!who) throw new HttpError(401, 'Please sign in with your member account.');
  const [member, admin, chapters, roomDocs, settingsDoc, mySeats] = await Promise.all([
    getDoc(env, `members/${who.uid}`),
    getDoc(env, `admins/${who.uid}`),
    councilsOf(env),
    queryDocs(env, 'meeting_rooms'),
    getDoc(env, 'site_settings/meetings'),
    queryDocs(env, 'org_assignments', { where: [['memberId', '==', who.uid]] }).catch(() => []),
  ]);
  const isAdmin = Boolean(admin) || (who.email.toLowerCase() === OWNER && who.emailVerified);
  chapters.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
  const roomDocMap = Object.fromEntries(roomDocs.map((d) => [d.id, d]));
  const rooms = L.roomsFor(chapters, roomDocMap);
  let membersCache = null;
  const ctx = {
    env,
    who,
    // `held`: every position the member is appointed to, not only their main title.
    member: member ? { ...member, id: who.uid, held: mySeats.map((a) => a.positionId) } : null,
    isAdmin,
    rooms,
    roomDocs: roomDocMap,
    settings: L.settingsFrom(settingsDoc),
    async members() {
      if (!membersCache) {
        const [list, seats] = await Promise.all([queryDocs(env, 'members'), queryDocs(env, 'org_assignments').catch(() => [])]);
        const held = new Map();
        for (const a of seats) held.set(a.memberId, [...(held.get(a.memberId) || []), a.positionId]);
        membersCache = list.map((m) => ({ ...m, id: m.id, held: held.get(m.id) || [] }));
      }
      return membersCache;
    },
    room(id) {
      const r = rooms.find((x) => x.id === id);
      if (!r) throw new HttpError(404, 'This meeting room does not exist.');
      return r;
    },
    async leader(room) {
      return L.leaderOf(room, ctx.roomDocs[room.id], await ctx.members());
    },
    async access(room, meeting) {
      const leader = await ctx.leader(room);
      return { ...L.accessFor({ uid: who.uid, member: ctx.member, isAdmin, room, leader, meeting }), leader };
    },
  };
  return ctx;
};

export const audit = (ctx, action, detail = {}, ok = true) => commit(ctx.env, [{
  set: `meeting_audit/${rid('a')}`,
  data: {
    at: now(),
    uid: ctx.who.uid,
    name: ctx.member?.displayName || ctx.member?.fullName || ctx.who.name || ctx.who.email || '',
    action,
    ok,
    ...detail,
  },
}]).catch(() => null);

export const nameOf = (m) => m?.displayName || m?.fullName || 'Member';

/** Public profile photos (only these are ever shown to other members). */
export const photosFor = async (env, uids) => {
  const profiles = await getDocs(env, [...new Set(uids)].map((u) => `public_profiles/${u}`));
  return Object.fromEntries(profiles.map((p) => [p.id, { name: p.displayName, photoUrl: p.photoUrl || '' }]));
};

export const requireAdmin = (ctx) => {
  if (!ctx.isAdmin) throw new HttpError(403, 'Administrators only.');
};

