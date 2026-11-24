/**
 * Member records, positions and membership cards: the server side.
 *
 * The member record (members/{id}) is the one authoritative record of a
 * member. Everything else that shows a member is derived from it here, in
 * the same all-or-nothing database write, so the directory, the
 * organisation chart, the card verification record and the account can
 * never show different details:
 *   public_profiles/{id}        directory, People and Structure pages
 *   verifications/{number}      older card QR codes (/people/M…)
 *   org_assignments/{seat}      the name on each position held
 *   users/{uid}                 the name shown in the account menu
 * Every change is recorded in audit_logs (who, what, before and after,
 * when); appointments are also recorded in position_history.
 *
 * Routes (signed-in staff; see `staffOf`):
 *   POST /api/members/update        edit a member's details
 *   POST /api/members/status        suspend, revoke or reactivate
 *   POST /api/members/card          issue, renew or update the card
 *   POST /api/members/appoint       appoint / promote / move to a position
 *   POST /api/members/vacate        remove someone from a position
 *   POST /api/members/seat          change a position's status or reporting line
 *   POST /api/members/resync        rebuild every copy of these members from their records
 *   GET  /api/members/history?id=   position history and change log
 *   GET  /api/members/permission-templates   website permissions per Website Administration position
 *   POST /api/members/permission-templates
 *   POST /api/members/self          a member edits their own profile text and photo
 * Public:
 *   GET  /api/verify/id/<token>     live status of a membership card (QR code)
 */
import structure from '../src/config/structure.json';
import { bearer, commit, getDoc, queryDocs, SetupError, verifyIdToken } from './firestore.js';
import { HttpError, json, now, OWNER, rid, SITE, str } from './context.js';
import { councilsOf } from './councils.js';

// ---------------------------------------------------------------- structure

export const POSITIONS = new Map(structure.positions.map((p) => [p.id, p]));
const LEGACY = structure.legacyPositions;
export const UNIT_NAMES = Object.fromEntries(structure.units.map((u) => [u.id, u.name]));
export const positionById = (id) => POSITIONS.get(LEGACY[id] || id);
export const positionOf = (m) => positionById(m?.positionId)?.id || 'member';
export const MEMBER_NUMBER = /^M\d{7}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEAT_STATUSES = ['active', 'acting', 'on_leave', 'suspended'];
const SEAT_STATUS_LABEL = { active: 'Active', acting: 'Acting', on_leave: 'On leave', suspended: 'Suspended' };
export const PERMISSIONS = ['manage_users', 'manage_members', 'manage_content', 'publish_content', 'bulk_import', 'view_analytics', 'manage_settings', 'manage_donations', 'manage_notifications', 'manage_events', 'manage_translations'];

/** "council__london__security__3" → { unit, positionId, councilId, seat }, or null. */
export const parseSeat = (seatId, chapters) => {
  const parts = String(seatId || '').split('__');
  const [unit] = parts;
  if (['board', 'production', 'webadmin'].includes(unit)) {
    if (parts.length !== 2) return null;
    const p = POSITIONS.get(parts[1]);
    return p && p.department === unit ? { id: seatId, unit, positionId: p.id } : null;
  }
  if (unit === 'council') {
    const [, councilId, positionId, seat] = parts;
    const p = POSITIONS.get(positionId);
    if (!p || p.department !== 'council') return null;
    if (!chapters.some((c) => c.id === councilId && !c.isArchived)) return null;
    if (positionId === 'security') {
      if (parts.length !== 4 || !/^[1-5]$/.test(seat || '')) return null;
      return { id: seatId, unit, positionId, councilId, seat: Number(seat) };
    }
    return parts.length === 3 ? { id: seatId, unit, positionId, councilId } : null;
  }
  return null;
};

const unitLabel = (s, chapters) => (s.unit === 'council'
  ? `${chapters.find((c) => c.id === s.councilId)?.name || s.councilId} Council`
  : UNIT_NAMES[s.unit]);

export const seatLabel = (s, chapters) => {
  const p = POSITIONS.get(s.positionId);
  return `${p?.title || s.positionId}${s.seat ? ` ${s.seat}` : ''}, ${unitLabel(s, chapters)}`;
};

/** The member's main title: their most senior position, or Member. */
export const mainPosition = (held) => held
  .map((a) => POSITIONS.get(a.positionId)).filter(Boolean)
  .sort((a, b) => a.number - b.number)[0]?.id || 'member';

// ---------------------------------------------------------------- who is asking

/**
 * Administrators (the owner, or anyone in /admins) may do everything.
 * Membership staff (role membership_reviewer, or the manage_members
 * permission) may edit members and cards; appointments need an administrator
 * or the manage_members permission.
 */
export const staffOf = async (env, request) => {
  const who = await verifyIdToken(bearer(request));
  if (!who) throw new HttpError(401, 'Please sign in again.');
  const [admin, user, member] = await Promise.all([getDoc(env, `admins/${who.uid}`), getDoc(env, `users/${who.uid}`), getDoc(env, `members/${who.uid}`)]);
  const isAdmin = Boolean(admin) || (who.email.toLowerCase() === OWNER && who.emailVerified);
  const roles = user?.roles || [];
  const perms = user?.permissions || [];
  return {
    env,
    who,
    member,
    isAdmin,
    name: member?.fullName || member?.displayName || user?.displayName || who.name || who.email || 'Administrator',
    canMembers: isAdmin || roles.includes('membership_reviewer') || perms.includes('manage_members'),
    canAppoint: isAdmin || perms.includes('manage_members'),
    // Editors and finance can waive a publication fee.
    canWaiveFees: isAdmin || perms.includes('manage_donations') || roles.some((r) => ['content_reviewer', 'publisher'].includes(r)),
  };
};

const need = (ok, message = 'Your account is not allowed to do this. Ask an administrator for the permission.') => {
  if (!ok) throw new HttpError(403, message);
};

// ---------------------------------------------------------------- helpers

const token = (n = 24) => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join('');
};

export const cardUrl = (t) => `${SITE}/id/${t}`;

const isPhoto = (v) => v === '' || (typeof v === 'string' && v.length <= 400000
  && (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v) || /^media:[A-Za-z0-9_-]{1,100}$/.test(v)));

const loadMember = async (env, id) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(id || ''))) throw new HttpError(400, 'Unknown member.');
  const m = await getDoc(env, `members/${id}`);
  if (!m) throw new HttpError(404, 'This member record no longer exists. Reload the page.');
  return m;
};

const chaptersOf = (env) => councilsOf(env);
const seatsOf = async (env, memberId) => queryDocs(env, 'org_assignments', { where: [['memberId', '==', memberId]] });

const notify = (userId, title, body, link = '/account', type = 'membership') => {
  if (!userId || String(userId).startsWith('mem-')) return [];
  const id = rid('un-');
  return [{ set: `user_notifications/${id}`, data: { id, userId, type, title: title.slice(0, 200), body: (body || '').slice(0, 2000), link, read: false, createdAt: now(), createdBy: 'server' } }];
};

const shown = (field, v) => {
  if (field === 'photoUrl') return v ? '(photo)' : '(none)';
  if (v === undefined || v === null || v === '') return '(empty)';
  return String(v).slice(0, 300);
};

const auditOp = (staff, action, targetId, details, changes = []) => {
  const id = `log-${Date.now()}-${token(5)}`;
  return {
    set: `audit_logs/${id}`,
    data: {
      id,
      actorUid: staff.who.uid,
      actorEmail: staff.who.email || '',
      actorName: staff.name,
      action,
      targetType: 'members',
      targetId,
      details: details.slice(0, 4000),
      changes: changes.slice(0, 40).map((c) => ({ field: c.field, from: shown(c.field, c.from), to: shown(c.field, c.to) })),
      timestamp: now(),
    },
  };
};

const historyOp = (entry) => {
  const id = rid('ph-');
  return { set: `position_history/${id}`, data: { id, at: now(), ...entry } };
};

/**
 * The writes that bring every copy of this member in step with `m` (the
 * member record as it will be after this change) and `held` (their seats
 * after this change). Reads what it needs first.
 */
export const syncOps = async (env, m, held, chapters, { previousNumber, strictTitle = false } = {}) => {
  // Members given a title before positions were appointed keep it until an
  // administrator changes their positions (they are listed under "Titles to
  // confirm" in Organisation structure).
  const legacy = !strictTitle && held.length === 0 && positionOf(m) !== 'member';
  const pos = POSITIONS.get(legacy ? positionOf(m) : mainPosition(held));
  const council = chapters.find((c) => c.id === m.chapterId);
  const t = now();
  const [profile, user] = await Promise.all([
    getDoc(env, `public_profiles/${m.id}`),
    m.userId && !String(m.userId).startsWith('mem-') ? getDoc(env, `users/${m.userId}`) : null,
  ]);
  const listed = m.status === 'active' || m.status === 'suspended';
  // Every approved member is listed publicly (organisation policy).
  const record = { ...m, positionId: pos.id, department: pos.department, designation: pos.title, ...(listed ? { consentToDirectory: true } : {}), updatedAt: t };
  if (!record.verifyToken) record.verifyToken = token();
  const ops = [{ set: `members/${m.id}`, data: stripId(record) }];

  if (listed) {
    ops.push({
      merge: `public_profiles/${m.id}`,
      data: {
        id: m.id,
        userId: m.userId || m.id,
        displayName: m.displayName || m.fullName,
        photoUrl: m.photoUrl || '',
        chapterId: m.chapterId || '',
        chapterName: council?.name || m.chapterId || '',
        bio: m.bio || '',
        expertise: m.expertise || '',
        positionId: pos.id,
        department: pos.department,
        designation: pos.title,
        ...(MEMBER_NUMBER.test(m.memberNumber || '') ? { memberNumber: m.memberNumber } : {}),
        membershipStatus: m.status === 'suspended' ? 'suspended' : 'active',
        ...(profile ? {} : { listedAt: t }),
        updatedAt: t,
      },
    });
  } else if (profile) {
    ops.push({ delete: `public_profiles/${m.id}` });
  }

  if (MEMBER_NUMBER.test(m.memberNumber || '') && m.credentialIssuedAt) {
    ops.push({
      set: `verifications/${m.memberNumber}`,
      data: {
        id: m.memberNumber,
        memberNumber: m.memberNumber,
        name: m.fullName,
        designation: pos.title,
        status: m.status === 'suspended' || m.status === 'revoked' ? m.status : m.status === 'archived' ? 'revoked' : 'active',
        validFrom: m.validFrom || '',
        expiresAt: m.expiresAt || '',
        verifyUrl: m.verifyUrl || '',
        profileId: m.id,
        positionId: pos.id,
        department: pos.department,
        updatedAt: t,
      },
    });
  }
  // A card number that has been replaced stops verifying.
  if (previousNumber && previousNumber !== m.memberNumber && MEMBER_NUMBER.test(previousNumber)) {
    const old = await getDoc(env, `verifications/${previousNumber}`);
    if (old) ops.push({ update: `verifications/${previousNumber}`, data: { status: 'revoked', updatedAt: t } });
  }

  for (const a of held) ops.push({ update: `org_assignments/${a.id}`, data: { memberName: (m.displayName || m.fullName || 'Member').slice(0, 200) } });

  if (user) ops.push({ update: `users/${m.userId}`, data: { displayName: m.displayName || m.fullName, ...(m.photoUrl ? { photoUrl: m.photoUrl } : {}), updatedAt: t } });
  return { ops, record };
};

const stripId = (o) => {
  const { id, ...rest } = o;
  return rest;
};

const run = async (env, ops) => {
  if (ops.length > 480) throw new HttpError(400, 'This change is too large to make in one step.');
  const ok = await commit(env, ops);
  if (ok === false) throw new HttpError(409, 'Someone else changed this at the same moment. Reload and try again.');
};

/** Refuse a save based on an out-of-date copy (two administrators editing at once). */
const checkFresh = (m, expected) => {
  if (expected && m.updatedAt && expected !== m.updatedAt) {
    throw new HttpError(409, 'This member was changed by someone else while you were editing. Close the form, reload, and make your change again.');
  }
};

// ---------------------------------------------------------------- edit details

const EDITABLE = {
  fullName: (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 200,
  displayName: (v) => typeof v === 'string' && v.trim().length <= 120,
  email: (v) => typeof v === 'string' && (v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) && v.length <= 254,
  phone: (v) => typeof v === 'string' && v.length <= 40,
  chapterId: (v) => typeof v === 'string' && v.length <= 100,
  joinedAt: (v) => typeof v === 'string' && (v === '' || DATE.test(v)),
  validFrom: (v) => typeof v === 'string' && (v === '' || DATE.test(v)),
  expiresAt: (v) => typeof v === 'string' && (v === '' || DATE.test(v)),
  photoUrl: isPhoto,
  bio: (v) => typeof v === 'string' && v.length <= 2000,
  expertise: (v) => typeof v === 'string' && v.length <= 1000,
};

const LABEL = { fullName: 'full name', displayName: 'display name', email: 'email', phone: 'phone', chapterId: 'council', joinedAt: 'membership start date', validFrom: 'card valid from', expiresAt: 'card expiry', photoUrl: 'photo', bio: 'biography', expertise: 'expertise' };

export const updateMember = async (env, staff, body) => {
  need(staff.canMembers);
  const m = await loadMember(env, body.memberId);
  checkFresh(m, body.expectUpdatedAt);
  const chapters = await chaptersOf(env);
  const changes = [];
  const next = { ...m };
  for (const [field, value] of Object.entries(body.changes || {})) {
    if (!EDITABLE[field]) throw new HttpError(400, `“${field}” cannot be changed here.`);
    if (!EDITABLE[field](value)) throw new HttpError(400, `The ${LABEL[field]} is not valid.`);
    const v = typeof value === 'string' && field !== 'photoUrl' ? value.trim() : value;
    if ((m[field] ?? '') !== v) { changes.push({ field, from: m[field], to: v }); next[field] = v; }
  }
  if (!changes.length) return { member: m, changed: [] };
  if (!next.fullName) throw new HttpError(400, 'A full name is required.');
  if (!next.displayName) next.displayName = next.fullName;
  if (next.chapterId && !chapters.some((c) => c.id === next.chapterId)) throw new HttpError(400, 'Choose one of the councils.');
  if (next.validFrom && next.expiresAt && next.expiresAt <= next.validFrom) throw new HttpError(400, 'The card expiry date must be after its start date.');

  // Moving council: positions in the old council no longer apply.
  let held = await seatsOf(env, m.id);
  const ops = [];
  const movedCouncil = changes.some((c) => c.field === 'chapterId');
  let lostSeats = 0;
  if (movedCouncil) {
    const stale = held.filter((a) => a.unit === 'council' && a.councilId !== next.chapterId);
    lostSeats = stale.length;
    for (const a of stale) ops.push({ delete: `org_assignments/${a.id}` });
    held = held.filter((a) => !stale.includes(a));
    const from = chapters.find((c) => c.id === m.chapterId)?.name || m.chapterId || 'no council';
    const to = chapters.find((c) => c.id === next.chapterId)?.name || next.chapterId;
    ops.push(historyOp({
      memberId: m.id, memberName: next.fullName, action: 'transferred',
      from: `${from} Council${stale.length ? ` (${stale.map((a) => seatLabel(a, chapters)).join('; ')})` : ''}`,
      to: `${to} Council`, effectiveDate: str(body.effectiveDate, 10) || now().slice(0, 10),
      byUid: staff.who.uid, byName: staff.name, reason: str(body.reason, 1000),
    }));
    ops.push(...notify(m.userId, `You are now in the ${to} Council`, stale.length ? `Your ${stale.length === 1 ? 'position' : 'positions'} in the ${from} Council ${stale.length === 1 ? 'has' : 'have'} been made vacant.` : 'Your membership card and profile show your new council.', '/structure'));
  }
  const { ops: sync, record } = await syncOps(env, next, held, chapters, { strictTitle: lostSeats > 0 });
  ops.push(...sync);
  ops.push(auditOp(staff, 'MEMBER_DETAILS_UPDATED', m.id, `${next.fullName}: ${changes.map((c) => LABEL[c.field]).join(', ')}${body.reason ? ` — ${str(body.reason, 500)}` : ''}`, changes));
  await run(env, ops);
  return { member: { ...record, id: m.id }, changed: changes.map((c) => c.field) };
};

/** A member's own profile text and photo. */
export const updateSelf = async (env, request, body) => {
  const who = await verifyIdToken(bearer(request));
  if (!who) throw new HttpError(401, 'Please sign in again.');
  const m = await getDoc(env, `members/${who.uid}`);
  if (!m) throw new HttpError(404, 'Your profile can be edited once your membership is approved.');
  const allowed = ['displayName', 'bio', 'expertise', 'photoUrl'];
  const next = { ...m, id: who.uid };
  const changes = [];
  for (const [field, value] of Object.entries(body || {})) {
    if (!allowed.includes(field)) continue;
    if (!EDITABLE[field](value)) throw new HttpError(400, `The ${LABEL[field]} is not valid.`);
    const v = typeof value === 'string' && field !== 'photoUrl' ? value.trim() : value;
    if ((m[field] ?? '') !== v) { changes.push({ field, from: m[field], to: v }); next[field] = v; }
  }
  if (!changes.length) return { member: next, changed: [] };
  const chapters = await chaptersOf(env);
  const held = await seatsOf(env, who.uid);
  const { ops, record } = await syncOps(env, next, held, chapters);
  ops.push(auditOp({ who, name: m.fullName }, 'MEMBER_PROFILE_SELF_UPDATED', who.uid, `${m.fullName} updated their ${changes.map((c) => LABEL[c.field]).join(', ')}`, changes));
  await run(env, ops);
  return { member: { ...record, id: who.uid }, changed: changes.map((c) => c.field) };
};

// ---------------------------------------------------------------- status

export const setStatus = async (env, staff, body) => {
  need(staff.canMembers);
  const m = await loadMember(env, body.memberId);
  const status = body.status;
  if (!['active', 'suspended', 'revoked'].includes(status)) throw new HttpError(400, 'Unknown membership status.');
  if (m.status === status) return { member: m };
  const reason = str(body.reason, 1000);
  const chapters = await chaptersOf(env);
  const held = await seatsOf(env, m.id);
  const next = { ...m, status };
  const { ops, record } = await syncOps(env, next, held, chapters);
  const titles = { active: 'Your membership is active again', suspended: 'Your membership has been suspended', revoked: 'Your membership has been ended' };
  ops.push(...notify(m.userId, titles[status], reason || (status === 'active' ? 'Your card verifies as valid again.' : 'Please contact us if you have questions.')));
  ops.push(auditOp(staff, `MEMBERSHIP_${status.toUpperCase()}`, m.id, `${m.fullName}${reason ? `: ${reason}` : ''}`, [{ field: 'status', from: m.status, to: status }]));
  await run(env, ops);
  return { member: { ...record, id: m.id } };
};

// ---------------------------------------------------------------- card

const nextNumber = async (env) => {
  const counter = await getDoc(env, 'counters/memberNumbers');
  let n = (counter?.next || 0) + 1;
  for (let i = 0; i < 30; i++, n++) {
    const candidate = `M${String(n).padStart(7, '0')}`;
    const [v, used] = await Promise.all([getDoc(env, `verifications/${candidate}`), queryDocs(env, 'members', { where: [['memberNumber', '==', candidate]], limit: 1 })]);
    if (!v && !used.length) return { candidate, n };
  }
  throw new HttpError(409, 'Could not find a free membership number. Please enter one.');
};

export const issueCard = async (env, staff, body) => {
  need(staff.canMembers);
  const m = await loadMember(env, body.memberId);
  for (const f of ['joinedAt', 'validFrom', 'expiresAt']) if (!DATE.test(String(body[f] || ''))) throw new HttpError(400, 'Enter the joining date, the valid-from date and the expiry date.');
  if (body.expiresAt <= body.validFrom) throw new HttpError(400, 'The expiry date must be after the valid-from date.');
  if (m.status === 'revoked' || m.status === 'archived') throw new HttpError(409, 'This membership has been ended. Reactivate it before issuing a card.');
  let number = String(body.memberNumber || '').trim().toUpperCase();
  let counterN = null;
  if (number && !MEMBER_NUMBER.test(number)) throw new HttpError(400, 'Membership numbers look like M0097206: the letter M and seven digits.');
  if (!number) {
    if (MEMBER_NUMBER.test(m.memberNumber || '')) number = m.memberNumber;
    else ({ candidate: number, n: counterN } = await nextNumber(env));
  }
  if (number !== m.memberNumber) {
    const used = await queryDocs(env, 'members', { where: [['memberNumber', '==', number]], limit: 2 });
    if (used.some((x) => x.id !== m.id)) throw new HttpError(409, `${number} is already used by another member.`);
  }
  const kind = ['issued', 'renewed', 'updated'].includes(body.kind) ? body.kind : 'updated';
  const legacy = !String(m.verifyUrl || '').includes('/id/');
  // The QR code changes only for a new card, a replacement, or a new number.
  const newQr = body.replaceQr || !m.verifyUrl || number !== m.memberNumber || (kind === 'issued' && legacy);
  const verifyToken = newQr ? token() : (m.verifyToken || token());
  const next = {
    ...m,
    memberNumber: number,
    joinedAt: body.joinedAt,
    validFrom: body.validFrom,
    expiresAt: body.expiresAt,
    credentialIssuedAt: now(),
    verifyToken,
    verifyUrl: newQr ? cardUrl(verifyToken) : m.verifyUrl,
    // Old QR codes are remembered so scanning one says it was replaced.
    ...(newQr && m.verifyToken && m.verifyToken !== verifyToken ? { retiredTokens: [m.verifyToken, ...(m.retiredTokens || [])].slice(0, 10) } : {}),
    status: m.status === 'suspended' ? 'suspended' : 'active',
  };
  const chapters = await chaptersOf(env);
  const held = await seatsOf(env, m.id);
  const { ops, record } = await syncOps(env, next, held, chapters, { previousNumber: m.memberNumber });
  if (counterN) ops.push({ merge: 'counters/memberNumbers', data: { next: counterN, updatedAt: now() } });
  // A brand-new number must not be taken by someone else at the same moment.
  if (number !== m.memberNumber) {
    const i = ops.findIndex((o) => o.set === `verifications/${number}`);
    if (i >= 0) ops[i] = { create: ops[i].set, data: ops[i].data };
  }
  ops.push(...notify(m.userId, `Your membership card has been ${kind}`, `Membership number ${number}, valid until ${body.expiresAt.split('-').reverse().join('/')}.`, '/account', 'card'));
  ops.push(auditOp(staff, `MEMBERSHIP_CARD_${kind.toUpperCase()}`, m.id, `${number} for ${m.fullName}, valid ${body.validFrom} to ${body.expiresAt}${newQr && m.verifyUrl ? ' (new QR code)' : ''}`, [
    { field: 'memberNumber', from: m.memberNumber, to: number }, { field: 'validFrom', from: m.validFrom, to: body.validFrom }, { field: 'expiresAt', from: m.expiresAt, to: body.expiresAt },
  ].filter((c) => (c.from || '') !== c.to)));
  await run(env, ops);
  return { member: { ...record, id: m.id } };
};

// ---------------------------------------------------------------- positions

const describeMove = (fromId, toId) => {
  const from = POSITIONS.get(fromId);
  const to = POSITIONS.get(toId);
  if (!from || fromId === 'member') return 'appointed';
  if (!to) return 'moved';
  if (to.number < from.number && to.department === from.department) return 'promoted';
  if (to.number > from.number && to.department === from.department) return 'demoted';
  return to.number < from.number ? 'promoted' : 'moved';
};

const permissionOps = async (env, staff, m, positionId, mode) => {
  if (POSITIONS.get(positionId)?.department !== 'webadmin' || !m.userId || String(m.userId).startsWith('mem-')) return [];
  const templates = (await getDoc(env, 'site_settings/position_permissions')) || {};
  const perms = (templates[positionId] || []).filter((p) => PERMISSIONS.includes(p));
  if (!perms.length) return [];
  const user = await getDoc(env, `users/${m.userId}`);
  if (!user) return [];
  const current = user.permissions || [];
  const next = mode === 'grant' ? [...new Set([...current, ...perms])] : current.filter((p) => !perms.includes(p));
  return [
    { update: `users/${m.userId}`, data: { permissions: next, updatedAt: now() } },
    auditOp(staff, mode === 'grant' ? 'PERMISSIONS_GRANTED' : 'PERMISSIONS_REMOVED', m.id, `${m.fullName}: ${perms.join(', ')} (${POSITIONS.get(positionId).title})`),
  ];
};

export const appoint = async (env, staff, body) => {
  need(staff.canAppoint, 'Only administrators (or staff with the "manage members" permission) can change positions.');
  const chapters = await chaptersOf(env);
  const seat = parseSeat(body.seatId, chapters);
  if (!seat) throw new HttpError(400, 'Unknown position.');
  let m = await loadMember(env, body.memberId);
  if (m.status === 'revoked' || m.status === 'archived') throw new HttpError(409, `${m.fullName}’s membership has been ended, so they cannot hold a position.`);
  const status = SEAT_STATUSES.includes(body.status) ? body.status : 'active';
  const effectiveDate = DATE.test(String(body.effectiveDate || '')) ? body.effectiveDate : now().slice(0, 10);
  const reason = str(body.reason, 1000);
  const ops = [];
  const history = [];

  // A council position goes to a member of that council (optionally moving them).
  if (seat.unit === 'council' && m.chapterId !== seat.councilId) {
    if (!body.moveToCouncil) {
      const name = chapters.find((c) => c.id === seat.councilId)?.name || seat.councilId;
      throw new HttpError(409, `${m.fullName} belongs to a different council. Tick “Also transfer them to the ${name} Council”, or choose a member of that council.`);
    }
    history.push({ action: 'transferred', from: `${chapters.find((c) => c.id === m.chapterId)?.name || m.chapterId || 'no council'} Council`, to: unitLabel(seat, chapters) });
    m = { ...m, chapterId: seat.councilId };
  }

  const [existing, mine] = await Promise.all([getDoc(env, `org_assignments/${seat.id}`), seatsOf(env, m.id)]);
  if (existing?.memberId === m.id) throw new HttpError(409, `${m.fullName} already holds this position. To mark it acting, on leave or suspended, use “Position status”.`);
  if (seat.positionId === 'security' && mine.some((a) => a.positionId === 'security' && a.councilId === seat.councilId && a.id !== seat.id)) {
    throw new HttpError(409, `${m.fullName} is already a Security Member of this council.`);
  }

  const beforeMain = mainPosition(mine);
  // One position per person unless the administrator keeps the others.
  let keep = mine.filter((a) => a.id !== seat.id);
  if (seat.unit === 'council') {
    const otherCouncil = keep.filter((a) => a.unit === 'council' && a.councilId !== seat.councilId);
    for (const a of otherCouncil) ops.push({ delete: `org_assignments/${a.id}` });
    keep = keep.filter((a) => !otherCouncil.includes(a));
  }
  const released = body.keepOtherPositions ? [] : keep;
  for (const a of released) ops.push({ delete: `org_assignments/${a.id}` });
  keep = body.keepOtherPositions ? keep : [];

  const assignment = {
    id: seat.id,
    unit: seat.unit,
    positionId: seat.positionId,
    ...(seat.councilId ? { councilId: seat.councilId } : {}),
    ...(seat.seat ? { seat: seat.seat } : {}),
    memberId: m.id,
    memberName: (m.displayName || m.fullName).slice(0, 200),
    assignedAt: now(),
    assignedBy: staff.who.uid,
    effectiveDate,
    status,
  };
  ops.push({ set: `org_assignments/${seat.id}`, data: assignment });

  const held = [...keep, assignment];
  const label = seatLabel(seat, chapters);
  const fromText = mine.length ? mine.map((a) => seatLabel(a, chapters)).join('; ') : POSITIONS.get(beforeMain).title;
  const action = describeMove(beforeMain, mainPosition([assignment]));
  history.push({ action, from: fromText, to: label + (status !== 'active' ? ` (${SEAT_STATUS_LABEL[status]})` : ''), seatId: seat.id, keptOthers: Boolean(body.keepOtherPositions) && keep.length > 0 });
  for (const h of history) ops.push(historyOp({ memberId: m.id, memberName: m.fullName, effectiveDate, byUid: staff.who.uid, byName: staff.name, reason, ...h }));

  // After the seat changes above, so the new seat exists when its name is refreshed.
  const sync = await syncOps(env, m, held, chapters, { strictTitle: true });
  ops.push(...sync.ops);

  // The person who held this seat before is now without it.
  if (existing && existing.memberId !== m.id) {
    const prev = await getDoc(env, `members/${existing.memberId}`);
    if (prev) {
      const prevHeld = (await seatsOf(env, prev.id)).filter((a) => a.id !== seat.id);
      const ps = await syncOps(env, { ...prev, id: prev.id }, prevHeld, chapters, { strictTitle: true });
      ops.push(...ps.ops);
      ops.push(historyOp({ memberId: prev.id, memberName: prev.fullName, action: 'replaced', from: label, to: prevHeld.length ? prevHeld.map((a) => seatLabel(a, chapters)).join('; ') : 'Member', seatId: seat.id, effectiveDate, byUid: staff.who.uid, byName: staff.name, reason: `Replaced by ${m.fullName}${reason ? `. ${reason}` : ''}` }));
      ops.push(...notify(prev.userId, `Your position has changed: ${label}`, 'Someone else now holds this position. Contact the committee if you have questions.', '/structure'));
      if (body.removePreviousPermissions) ops.push(...await permissionOps(env, staff, prev, seat.positionId, 'remove'));
    }
  }
  if (body.applyPermissions) ops.push(...await permissionOps(env, staff, m, seat.positionId, 'grant'));
  ops.push(...notify(m.userId, `You have been appointed ${label}`, 'Your profile, membership card and the organisation chart now show this position.', '/structure'));
  ops.push(auditOp(staff, 'POSITION_APPOINTED', m.id, `${m.fullName} ${{ appointed: 'appointed', promoted: 'promoted to', demoted: 'moved to', moved: 'moved to' }[action] || action} ${label}${existing && existing.memberId !== m.id ? ` (replacing ${existing.memberName})` : ''}${released.length ? `; no longer ${released.map((a) => seatLabel(a, chapters)).join(', ')}` : ''}${reason ? ` — ${reason}` : ''}`, [{ field: 'positionId', from: POSITIONS.get(beforeMain).title, to: POSITIONS.get(mainPosition(held)).title }]));
  await run(env, ops);
  return { member: { ...sync.record, id: m.id }, action };
};

export const vacate = async (env, staff, body) => {
  need(staff.canAppoint, 'Only administrators (or staff with the "manage members" permission) can change positions.');
  const chapters = await chaptersOf(env);
  const seat = parseSeat(body.seatId, chapters);
  if (!seat) throw new HttpError(400, 'Unknown position.');
  const a = await getDoc(env, `org_assignments/${seat.id}`);
  if (!a) throw new HttpError(404, 'This position is already vacant.');
  const reason = str(body.reason, 1000);
  const effectiveDate = DATE.test(String(body.effectiveDate || '')) ? body.effectiveDate : now().slice(0, 10);
  const label = seatLabel(seat, chapters);
  const ops = [{ delete: `org_assignments/${seat.id}` }];
  const m = await getDoc(env, `members/${a.memberId}`);
  if (m) {
    const held = (await seatsOf(env, m.id)).filter((x) => x.id !== seat.id);
    const sync = await syncOps(env, { ...m, id: m.id }, held, chapters, { strictTitle: true });
    ops.push(...sync.ops);
    ops.push(historyOp({ memberId: m.id, memberName: m.fullName, action: 'removed', from: label, to: held.length ? held.map((x) => seatLabel(x, chapters)).join('; ') : 'Member', seatId: seat.id, effectiveDate, byUid: staff.who.uid, byName: staff.name, reason }));
    ops.push(...notify(m.userId, `You are no longer ${label}`, 'Your membership is unchanged.', '/structure'));
    if (body.removePermissions) ops.push(...await permissionOps(env, staff, { ...m, id: m.id }, seat.positionId, 'remove'));
  }
  ops.push(auditOp(staff, 'POSITION_VACATED', a.memberId, `${a.memberName} removed as ${label}${reason ? ` — ${reason}` : ''}`));
  await run(env, ops);
  return { ok: true };
};

/** Position status (active, acting, on leave, suspended) and reporting line. */
export const updateSeat = async (env, staff, body) => {
  need(staff.canAppoint, 'Only administrators (or staff with the "manage members" permission) can change positions.');
  const chapters = await chaptersOf(env);
  const seat = parseSeat(body.seatId, chapters);
  if (!seat) throw new HttpError(400, 'Unknown position.');
  const a = await getDoc(env, `org_assignments/${seat.id}`);
  if (!a) throw new HttpError(404, 'Nobody holds this position.');
  const patch = {};
  const changes = [];
  if (body.status !== undefined) {
    if (!SEAT_STATUSES.includes(body.status)) throw new HttpError(400, 'Unknown position status.');
    if ((a.status || 'active') !== body.status) { patch.status = body.status; changes.push({ field: 'status', from: SEAT_STATUS_LABEL[a.status || 'active'], to: SEAT_STATUS_LABEL[body.status] }); }
  }
  if (body.reportsTo !== undefined) {
    const to = body.reportsTo ? parseSeat(body.reportsTo, chapters) : null;
    if (body.reportsTo && (!to || to.id === seat.id)) throw new HttpError(400, 'Choose another position for the reporting line.');
    const before = a.reportsTo ? seatLabel(parseSeat(a.reportsTo, chapters) || { positionId: a.reportsTo, unit: 'board' }, chapters) : 'Standard reporting line';
    const after = to ? seatLabel(to, chapters) : 'Standard reporting line';
    if ((a.reportsTo || '') !== (to?.id || '')) { patch.reportsTo = to?.id || ''; changes.push({ field: 'reportsTo', from: before, to: after }); }
  }
  if (!changes.length) return { ok: true, changed: [] };
  const label = seatLabel(seat, chapters);
  const reason = str(body.reason, 1000);
  const ops = [
    { update: `org_assignments/${seat.id}`, data: patch },
    historyOp({ memberId: a.memberId, memberName: a.memberName, action: patch.status ? 'status_changed' : 'reporting_changed', from: `${label}: ${changes.map((c) => c.from).join(', ')}`, to: `${label}: ${changes.map((c) => c.to).join(', ')}`, seatId: seat.id, effectiveDate: DATE.test(String(body.effectiveDate || '')) ? body.effectiveDate : now().slice(0, 10), byUid: staff.who.uid, byName: staff.name, reason }),
    auditOp(staff, 'POSITION_UPDATED', a.memberId, `${a.memberName}, ${label}: ${changes.map((c) => `${c.field === 'status' ? 'status' : 'reports to'} ${c.from} → ${c.to}`).join('; ')}`),
  ];
  await run(env, ops);
  return { ok: true, changed: changes.map((c) => c.field) };
};

export const history = async (env, staff, memberId) => {
  need(staff.canMembers);
  await loadMember(env, memberId);
  const [positions, log] = await Promise.all([
    queryDocs(env, 'position_history', { where: [['memberId', '==', memberId]] }),
    staff.isAdmin ? queryDocs(env, 'audit_logs', { where: [['targetId', '==', memberId]] }) : [],
  ]);
  positions.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  log.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return { positions: positions.slice(0, 200), log: log.slice(0, 200) };
};

export const getTemplates = async (env, staff) => {
  need(staff.isAdmin, 'Only administrators can see website permissions.');
  const t = (await getDoc(env, 'site_settings/position_permissions')) || {};
  return { templates: Object.fromEntries([...POSITIONS.values()].filter((p) => p.department === 'webadmin').map((p) => [p.id, (t[p.id] || []).filter((x) => PERMISSIONS.includes(x))])), permissions: PERMISSIONS };
};

export const setTemplates = async (env, staff, body) => {
  need(staff.isAdmin, 'Only administrators can change website permissions.');
  const data = { updatedAt: now(), updatedBy: staff.who.uid };
  for (const p of POSITIONS.values()) {
    if (p.department !== 'webadmin') continue;
    const list = Array.isArray(body.templates?.[p.id]) ? body.templates[p.id] : [];
    if (list.some((x) => !PERMISSIONS.includes(x))) throw new HttpError(400, 'Unknown permission.');
    data[p.id] = [...new Set(list)];
  }
  await run(env, [{ set: 'site_settings/position_permissions', data }, auditOp(staff, 'PERMISSION_TEMPLATES_UPDATED', 'position_permissions', Object.entries(data).filter(([k]) => POSITIONS.has(k)).map(([k, v]) => `${POSITIONS.get(k).title}: ${v.join(', ') || 'none'}`).join('; '))]);
  return getTemplates(env, staff);
};

/**
 * Repair: rebuild every copy of these members (directory, chart names, card
 * records, account names) from their member records. Used for records saved
 * before this server existed, and safe to run at any time.
 */
export const resync = async (env, staff, body) => {
  need(staff.canMembers);
  const ids = Array.isArray(body.memberIds) ? body.memberIds.slice(0, 50) : [];
  if (!ids.length) throw new HttpError(400, 'Choose the members to repair.');
  const chapters = await chaptersOf(env);
  const done = [];
  const failed = [];
  for (const id of ids) {
    try {
      const m = await loadMember(env, id);
      const held = await seatsOf(env, m.id);
      const { ops } = await syncOps(env, m, held, chapters);
      await run(env, ops);
      done.push(id);
    } catch (e) {
      failed.push({ id, error: e instanceof HttpError ? e.message : 'database error' });
    }
  }
  if (done.length) await run(env, [auditOp(staff, 'MEMBER_RECORDS_REPAIRED', done.length === 1 ? done[0] : 'members', `${done.length} member record(s) re-synchronised`)]).catch(() => null);
  return { done, failed };
};

// ---------------------------------------------------------------- public verification

const today = () => now().slice(0, 10);
export const stateOf = (m) => {
  if (m.status === 'revoked' || m.status === 'archived') return 'revoked';
  if (m.status === 'suspended') return 'suspended';
  if (m.expiresAt && m.expiresAt.slice(0, 10) < today()) return 'expired';
  return 'valid';
};

/** What the QR code page shows: the live record, nothing private. */
export const verifyCard = async (env, t) => {
  if (!/^[A-Za-z0-9]{20,40}$/.test(String(t || ''))) return { found: false };
  const [m] = await queryDocs(env, 'members', { where: [['verifyToken', '==', t]], limit: 1 });
  if (!m) {
    const [old] = await queryDocs(env, 'members', { where: [['retiredTokens', 'array-contains', t]], limit: 1 });
    return old ? { found: true, state: 'replaced' } : { found: false };
  }
  if (!m.credentialIssuedAt) return { found: false };
  // A card whose QR code has been replaced is no longer valid.
  if (!String(m.verifyUrl || '').endsWith(`/id/${t}`)) return { found: true, state: 'replaced' };
  const chapters = await chaptersOf(env);
  const council = chapters.find((c) => c.id === m.chapterId)?.name || '';
  const state = stateOf(m);
  const pos = POSITIONS.get(positionOf(m));
  const base = { found: true, state, checkedAt: now() };
  if (state === 'revoked') return { ...base, memberNumber: m.memberNumber };
  return {
    ...base,
    name: m.fullName,
    photoUrl: state === 'valid' || state === 'expired' ? (m.photoUrl || '') : '',
    memberNumber: m.memberNumber,
    position: pos.title,
    unit: ['council', 'membership'].includes(pos.department) ? (council ? `${council} Council` : '') : UNIT_NAMES[pos.department],
    council,
    memberSince: m.joinedAt || '',
    validFrom: m.validFrom || '',
    expiresAt: m.expiresAt || '',
    profileId: m.status === 'active' ? m.id : '',
  };
};

// ---------------------------------------------------------------- publication fees

const WAIVABLE = ['awaiting', 'claimed', 'rejected', 'disputed'];

/**
 * Members publish without a fee. Work sent through Publish with Us before the
 * sender signed in as a member is made fee-free here, and goes straight to
 * editorial review:
 *   - by the member themselves (signed in, active member record), using the
 *     private tracking id that only the sender has;
 *   - or by an editor, finance officer or administrator.
 */
export const waivePublicationFee = async (env, staff, body) => {
  const id = str(body.id, 80);
  if (!/^gs_[a-z0-9]{10,60}$/.test(id)) throw new HttpError(400, 'Unknown submission.');
  const s = await getDoc(env, `guest_submissions/${id}`);
  if (!s) throw new HttpError(404, 'This submission no longer exists.');
  const asMember = staff.member && staff.member.status === 'active';
  need(staff.canWaiveFees || asMember, 'Only members of 17 Shubat publish without a fee. Sign in with your member account.');
  const p = s.payment || {};
  if (p.status === 'waived') return { ok: true, status: s.status, already: true };
  if (!WAIVABLE.includes(p.status)) throw new HttpError(409, p.status === 'verified' ? 'The fee has already been paid; record a refund if it should be returned.' : 'There is no fee to waive on this submission.');
  if (['withdrawn', 'rejected', 'published', 'unpublished'].includes(s.status)) throw new HttpError(409, 'This submission is closed.');
  const byMember = !staff.canWaiveFees;
  const at = now();
  const nextStatus = s.status === 'awaiting_payment' ? 'submitted' : s.status;
  const action = byMember ? 'No fee: sent by a member of 17 Shubat; sent for editorial review' : `No fee (waived by ${staff.name}); sent for editorial review`;
  const history = [...(Array.isArray(s.history) ? s.history : []), { at, action: nextStatus === s.status ? action.replace('; sent for editorial review', '') : action, by: byMember ? 'contributor' : 'finance', ...(p.status === 'claimed' ? { note: 'The contributor had reported a payment: check the bank account and refund it if it arrived.' } : {}) }].slice(-300);
  await run(env, [
    { update: `guest_submissions/${id}`, data: {
      status: nextStatus,
      payment: { ...p, status: 'waived', amountPence: 0, waivedAt: at, waivedBy: staff.who.uid, waivedReason: byMember ? 'member' : 'staff' },
      ...(byMember ? { memberUid: staff.who.uid } : {}),
      updatedAt: at,
      history,
    } },
    auditOp(staff, 'PUBLICATION_FEE_WAIVED', staff.who.uid, `"${String(s.title || '').slice(0, 120)}" (${id}): ${byMember ? 'sent by a member' : 'waived by staff'}${p.status === 'claimed' ? '; a payment had been reported' : ''}`),
  ]);
  return { ok: true, status: nextStatus };
};

// ---------------------------------------------------------------- routing

const readBody = async (request) => {
  try { return await request.json(); } catch { throw new HttpError(400, 'The request could not be read.'); }
};

export const handleMembers = async (request, env) => {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith('/api/verify/id/')) {
      if (request.method !== 'GET') return json({ error: 'Not allowed' }, 405);
      return json(await verifyCard(env, decodeURIComponent(url.pathname.slice('/api/verify/id/'.length))));
    }
    const action = url.pathname.replace(/^\/api\/members\//, '');
    if (action === 'self' && request.method === 'POST') return json(await updateSelf(env, request, await readBody(request)));
    const staff = await staffOf(env, request);
    if (request.method === 'GET') {
      if (action === 'history') return json(await history(env, staff, url.searchParams.get('id')));
      if (action === 'permission-templates') return json(await getTemplates(env, staff));
      return json({ error: 'Not found' }, 404);
    }
    if (request.method !== 'POST') return json({ error: 'Not allowed' }, 405);
    const body = await readBody(request);
    const routes = { 'waive-fee': waivePublicationFee, update: updateMember, status: setStatus, card: issueCard, appoint, vacate, seat: updateSeat, resync, 'permission-templates': setTemplates };
    if (!routes[action]) return json({ error: 'Not found' }, 404);
    return json(await routes[action](env, staff, body));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof SetupError || e?.setup) return json({ error: `The website server is not fully set up: ${e.message}`, setup: true }, 503);
    console.error('members error', e);
    return json({ error: 'The change could not be saved because the database did not answer. Nothing was changed. Please try again.' }, 502);
  }
};

