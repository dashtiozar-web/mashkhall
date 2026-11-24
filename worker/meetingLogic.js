/**
 * The rules of the online meetings, kept free of any database or network
 * code so they can be tested on their own (tests/meetingLogic.test.ts):
 * who may enter which room, who leads it, how attendance is measured, and
 * how meeting points are worked out.
 */

/**
 * May enter and oversee every room (besides administrators): the
 * organisation's two most senior officers. The Head of Media is not here:
 * they enter the Board, Production Team and their own council's rooms only,
 * unless an administrator adds them to another room.
 */
export const SENIOR_POSITIONS = ['president', 'deputy_president'];

/** Board of Directors positions (src/config/structure.json). */
export const BOARD_POSITIONS = ['president', 'deputy_president', 'head_of_media', 'research_manager', 'head_of_public_relations', 'councils_representative', 'administrator', 'head_of_finance'];
export const PRODUCTION_POSITIONS = ['head_of_production', 'graphic_designer', 'reporter', 'photographer', 'video_editor', 'content_creator'];
export const WEBADMIN_POSITIONS = ['web_admin', 'web_deputy', 'web_security', 'web_content', 'web_support'];

/** What a room leader can be allowed to do. */
export const LEADER_PERMISSIONS = ['schedule', 'start', 'admit', 'mute', 'remove', 'lock', 'attendance', 'activities'];

export const POINTS = { attendance: 30, streakBonus: 10, streakLength: 3, absencePenalty: -15, absenceLength: 2 };

export const DEFAULT_SETTINGS = {
  /** Share of the meeting a member must attend to count as present. */
  thresholdPercent: 50,
  /** Joining later than this (minutes after the start) is marked late (still attended). */
  lateMinutes: 10,
  /** Reminders before a meeting, in minutes. */
  reminders: [1440, 60, 10],
  defaultWaitingRoom: 'host',
  defaultSpeaking: 'open',
  /** 'audio': microphones only (cameras off); 'video': cameras allowed too. */
  defaultMedia: 'audio',
  timezone: 'Europe/London',
};

export const settingsFrom = (doc) => {
  const s = { ...DEFAULT_SETTINGS, ...(doc || {}) };
  s.thresholdPercent = Math.min(100, Math.max(0, Number(s.thresholdPercent) || 0));
  s.lateMinutes = Math.min(240, Math.max(0, Number(s.lateMinutes) || 0));
  s.reminders = (Array.isArray(s.reminders) ? s.reminders : DEFAULT_SETTINGS.reminders)
    .map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 10080).sort((a, b) => b - a).slice(0, 5);
  if (!['off', 'host', 'approve'].includes(s.defaultWaitingRoom)) s.defaultWaitingRoom = 'host';
  if (!['open', 'controlled'].includes(s.defaultSpeaking)) s.defaultSpeaking = 'open';
  if (!['audio', 'video'].includes(s.defaultMedia)) s.defaultMedia = 'audio';
  return s;
};

// ---------------------------------------------------------------- rooms

/** The groups that have rooms besides the councils, in the order shown. */
export const GROUP_ROOMS = [
  { id: 'board', kind: 'board', name: 'Board of Directors' },
  { id: 'joint', kind: 'joint', name: 'Board and Council Leaders' },
  { id: 'research', kind: 'research', name: 'Research and Investigation' },
  { id: 'production', kind: 'production', name: 'Production Team' },
  { id: 'webadmin', kind: 'webadmin', name: 'Website Administration' },
];

/**
 * Every meeting room: one per council, then the group rooms. Each room
 * carries the access an administrator has set for it (room settings):
 *   members    extra people allowed in (explicit access)
 *   excluded   people refused even though their position would allow them
 *   moderators people who may run the room's meetings with the leader
 */
export const roomsFor = (councils, roomDocs = {}) => [
  ...councils.filter((c) => !c.isArchived).map((c) => ({ id: `council-${c.id}`, kind: 'council', chapterId: c.id, name: `${c.name} Council` })),
  ...GROUP_ROOMS.map((r) => ({ ...r })),
].map((r) => {
  const d = roomDocs[r.id] || {};
  return { ...r, members: list(d.members), excluded: list(d.excluded), moderators: list(d.moderators) };
});

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x).slice(0, 500) : []);

const active = (m) => m && m.status === 'active' && !String(m.id || m.userId || '').startsWith('mem-');

/** Every position a member holds: their main title and all their appointments. */
export const positionsOf = (m) => [...new Set([m?.positionId, ...(Array.isArray(m?.held) ? m.held : [])].filter(Boolean))];
const holds = (m, ids) => positionsOf(m).some((p) => ids.includes(p));

/** Is this member one of the people the room is for, by their position or council? */
export const memberByPosition = (member, room) => {
  switch (room.kind) {
    case 'council': return member.chapterId === room.chapterId;
    case 'board': return holds(member, BOARD_POSITIONS);
    case 'joint': return holds(member, BOARD_POSITIONS) || holds(member, ['council_leader']);
    // Confidential: only its head by position; everyone else is added by name.
    case 'research': return holds(member, ['research_manager']);
    case 'production': return holds(member, PRODUCTION_POSITIONS) || holds(member, ['head_of_media']);
    case 'webadmin': return holds(member, WEBADMIN_POSITIONS);
    default: return false;
  }
};

/** Is this member one of the people the room is for (position, council, or added by an administrator)? */
export const eligibleFor = (member, room) => {
  if (!active(member)) return false;
  if ((room.excluded || []).includes(member.id)) return false;
  return memberByPosition(member, room) || (room.members || []).includes(member.id);
};

export const isSenior = (member) => active(member) && holds(member, SENIOR_POSITIONS);

/** The head of each group by position, who leads its room unless an administrator chooses someone. */
export const defaultLeader = (room, members) => {
  const pick = (pred) => members.filter(active).find(pred);
  const with_ = (id) => (m) => holds(m, [id]);
  switch (room.kind) {
    case 'council':
      return pick((m) => m.chapterId === room.chapterId && holds(m, ['head_of_online_meetings']))
        || pick((m) => m.chapterId === room.chapterId && holds(m, ['council_leader'])) || null;
    case 'board': return pick(with_('president')) || null;
    case 'joint': return pick(with_('councils_representative')) || pick(with_('president')) || null;
    case 'research': return pick(with_('research_manager')) || null;
    case 'production': return pick(with_('head_of_production')) || null;
    case 'webadmin': return pick(with_('web_admin')) || null;
    default: return null;
  }
};

/**
 * People who run the room's meetings with the leader: the moderators an
 * administrator chose, and the Council Leader in their own council's room.
 */
export const managersOf = (room, members, leaderUid) => {
  const ids = new Set(room.moderators || []);
  if (room.kind === 'council') members.filter((m) => active(m) && m.chapterId === room.chapterId && holds(m, ['council_leader'])).forEach((m) => ids.add(m.id));
  if (leaderUid) ids.delete(leaderUid);
  return [...ids];
};

/** The leader's uid (administrator's choice, else the default), and their permissions. */
export const leaderOf = (room, settingsDoc, members) => {
  const s = settingsDoc || {};
  const perms = Object.fromEntries(LEADER_PERMISSIONS.map((p) => [p, s.leaderPermissions?.[p] !== false]));
  const uid = s.leaderUid || defaultLeader(room, members)?.id || null;
  const managers = managersOf(room, members, uid);
  if (!uid || s.leaderSuspended) return { uid, suspended: Boolean(s.leaderSuspended), permissions: Object.fromEntries(LEADER_PERMISSIONS.map((p) => [p, false])), chosen: Boolean(s.leaderUid), managers, managerPermissions: perms };
  return { uid, suspended: false, permissions: perms, chosen: Boolean(s.leaderUid), managers, managerPermissions: perms };
};

/**
 * What this person may do in this room (and meeting, if given).
 *   { allowed, host, role, reason }
 * role: 'admin' | 'senior' | 'leader' | 'moderator' | 'member'
 */
export const accessFor = ({ uid, member, isAdmin, room, leader, meeting }) => {
  if (isAdmin) return { allowed: true, host: true, role: 'admin' };
  if (!active(member)) return { allowed: false, host: false, reason: 'Only approved members with an active membership can join online meetings.' };
  if (isSenior(member)) return { allowed: true, host: true, role: 'senior' };
  if (leader && leader.uid === uid && !leader.suspended) return { allowed: true, host: true, role: 'leader' };
  if (leader && (leader.managers || []).includes(uid) && !(room.excluded || []).includes(uid)) return { allowed: true, host: true, role: 'moderator' };
  if (!eligibleFor(member, room)) {
    return { allowed: false, host: false, reason: (room.excluded || []).includes(uid) ? 'An administrator has removed you from this meeting room.' : 'This meeting room is for another council or group.' };
  }
  if (meeting && meeting.invite === 'selected' && !(meeting.invitees || []).includes(uid)) {
    return { allowed: false, host: false, reason: 'You are not on the invitation list for this meeting.' };
  }
  return { allowed: true, host: false, role: 'member' };
};

/** Can this person do a particular leader task in the room? */
export const canManage = (access, leader, permission) =>
  access.role === 'admin' || access.role === 'senior'
  || (access.role === 'leader' && Boolean(leader?.permissions?.[permission]))
  || (access.role === 'moderator' && Boolean(leader?.managerPermissions?.[permission]));

/** The people a meeting is for (who are marked absent if they do not come). */
export const eligibleMembers = (members, room, meeting) => members.filter((m) => eligibleFor(m, room)
  && (meeting?.invite !== 'selected' || (meeting.invitees || []).includes(m.id)));

/** Why a member can or cannot enter a room, for administrators investigating access. */
export const explainAccess = (member, room, leader, isAdmin) => {
  const a = accessFor({ uid: member?.id, member, isAdmin, room, leader });
  const why = [];
  if (isAdmin) why.push('Administrator: every room.');
  else if (!active(member)) why.push('Membership is not active (or the record was imported without an account).');
  else {
    if (isSenior(member)) why.push('President or Deputy President: every room.');
    if (leader?.uid === member.id) why.push(leader.suspended ? 'Room leader, but suspended.' : 'Leader of this room.');
    if ((leader?.managers || []).includes(member.id)) why.push(room.kind === 'council' && holds(member, ['council_leader']) ? 'Council Leader of this council (runs its meetings).' : 'Moderator chosen by an administrator.');
    if ((room.excluded || []).includes(member.id)) why.push('Removed from this room by an administrator.');
    else if (memberByPosition(member, room)) why.push(room.kind === 'council' ? 'Member of this council.' : 'Their position belongs to this group.');
    if ((room.members || []).includes(member.id)) why.push('Added to this room by an administrator.');
    if (!why.length) why.push(room.kind === 'council' ? 'Belongs to a different council.' : 'Their position does not belong to this group, and nobody has added them.');
  }
  return { allowed: a.allowed, host: a.host, role: a.role || null, why };
};

// ---------------------------------------------------------------- attendance

const ms = (iso) => (iso ? new Date(iso).getTime() : NaN);

/**
 * Minutes a person spent in the meeting between `start` and `end`, joining
 * overlapping connections (two devices, reconnections) so time is never
 * counted twice.
 */
export const minutesIn = (intervals, start, end) => {
  const s0 = ms(start);
  const e0 = ms(end);
  const parts = intervals
    .map(([a, b]) => [Math.max(ms(a), s0), Math.min(Number.isFinite(ms(b)) ? ms(b) : e0, e0)])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur = null;
  for (const [a, b] of parts) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total / 60000);
};

/**
 * Attendance for each eligible member (and anyone else who joined), from
 * what the video service recorded. Opening the meeting page is not enough:
 * only time actually connected to the meeting counts.
 */
export const measureAttendance = ({ eligible, joined, meeting, settings }) => {
  const s = settingsFrom(settings);
  const start = meeting.startedAt || meeting.startAt;
  const end = meeting.endedAt || new Date(ms(meeting.startAt) + (meeting.durationMin || 60) * 60000).toISOString();
  const length = Math.max(1, Math.round((ms(end) - ms(start)) / 60000));
  const needed = Math.ceil((length * s.thresholdPercent) / 100);
  const byUid = new Map(joined.map((p) => [p.uid, p]));
  const row = (uid, isEligible) => {
    const p = byUid.get(uid);
    const intervals = p?.intervals || [];
    const minutes = minutesIn(intervals, start, end);
    const joins = intervals.map(([a]) => a).filter(Boolean).sort();
    const leaves = intervals.map(([, b]) => b || end).sort();
    const firstJoin = joins[0] || null;
    const lastLeave = leaves[leaves.length - 1] || null;
    let status = 'absent';
    if (p && minutes >= needed && minutes > 0) {
      status = firstJoin && ms(firstJoin) > ms(start) + s.lateMinutes * 60000 ? 'late' : 'attended';
    }
    return { uid, eligible: isEligible, minutes, firstJoin, lastLeave, measured: status, status, percent: Math.min(100, Math.round((minutes / length) * 100)) };
  };
  const rows = eligible.map((m) => row(m.id, true));
  for (const p of joined) if (!eligible.some((m) => m.id === p.uid)) rows.push(row(p.uid, false));
  return { rows, length, needed, start, end };
};

export const counts = (status) => status === 'attended' || status === 'late';

// ---------------------------------------------------------------- points

/**
 * The meeting points a member should have, worked out from their whole
 * history of approved, eligible meetings in date order:
 *   - 30 for each meeting attended;
 *   - 10 extra for every three meetings attended in a row;
 *   - minus 15 when two meetings in a row are missed (once per run of absences).
 * Excused absences neither break a run nor count as missed. Cancelled
 * meetings and meetings the member was not eligible for are not in the history.
 *
 * Each entry has a fixed key, so recalculating never pays twice.
 */
export const meetingPointsFor = (uid, history) => {
  const sorted = [...history].sort((a, b) => (a.startAt || '').localeCompare(b.startAt || '') || a.meetingId.localeCompare(b.meetingId));
  const out = [];
  let run = 0;
  let missed = 0;
  for (const h of sorted) {
    if (h.status === 'excused') continue;
    if (counts(h.status)) {
      out.push({ key: `${uid}__meeting_attendance__${h.meetingId}`, type: 'meeting_attendance', points: POINTS.attendance, meetingId: h.meetingId, title: h.title });
      missed = 0;
      run += 1;
      if (run === POINTS.streakLength) {
        out.push({ key: `${uid}__meeting_streak_bonus__${h.meetingId}`, type: 'meeting_streak_bonus', points: POINTS.streakBonus, meetingId: h.meetingId, title: h.title });
        run = 0;
      }
    } else if (h.status === 'absent') {
      run = 0;
      missed += 1;
      if (missed === POINTS.absenceLength) {
        out.push({ key: `${uid}__meeting_absence_penalty__${h.meetingId}`, type: 'meeting_absence_penalty', points: POINTS.absencePenalty, meetingId: h.meetingId, title: h.title });
      }
    }
  }
  return out;
};

/** Current run of meetings attended in a row, and of meetings missed in a row. */
export const streakOf = (history) => {
  const sorted = [...history].filter((h) => h.status !== 'excused').sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''));
  let attended = 0;
  let missed = 0;
  for (const h of sorted) {
    if (counts(h.status)) { attended += 1; missed = 0; } else if (h.status === 'absent') { attended = 0; missed += 1; }
  }
  return { attended, missed, untilBonus: POINTS.streakLength - (attended % POINTS.streakLength) };
};

export const MEETING_TYPES = ['meeting_attendance', 'meeting_streak_bonus', 'meeting_absence_penalty'];

/**
 * Compares the points a member should have with the ledger and lists the
 * changes: awards to add, and awards to reverse (with a correction entry,
 * so the history stays complete).
 *   ledger: the member's ledger entries (all types).
 */
export const reconcile = (uid, expected, ledger) => {
  const reversed = new Set(ledger.filter((e) => e.type === 'correction' && e.targetId?.startsWith('reverse:')).map((e) => e.targetId.slice(8)));
  const live = ledger.filter((e) => MEETING_TYPES.includes(e.type) && !reversed.has(e.id));
  const add = [];
  const reverse = [];
  for (const x of expected) {
    const mine = live.filter((e) => e.id === x.key || e.id.startsWith(`${x.key}~`));
    if (!mine.length) {
      const used = ledger.filter((e) => e.id === x.key || e.id.startsWith(`${x.key}~`)).length;
      add.push({ ...x, id: used ? `${x.key}~${used + 1}` : x.key });
    } else if (mine.length > 1) {
      reverse.push(...mine.slice(1));
    }
  }
  const keys = new Set(expected.map((x) => x.key));
  for (const e of live) if (!keys.has(e.id.split('~')[0])) reverse.push(e);
  return { add, reverse };
};

// ---------------------------------------------------------------- schedule

/** The same day and time next month (the last day if the month is shorter). */
export const nextMonthly = (iso) => {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes()));
  const last = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate();
  n.setUTCDate(Math.min(day, last));
  return n.toISOString();
};

/** Reminders now due for a meeting: those whose time has come and were not yet sent. */
export const dueReminders = (meeting, settings, now = Date.now()) => {
  if (meeting.status !== 'scheduled') return [];
  const start = ms(meeting.startAt);
  if (!(start > now)) return [];
  const sent = meeting.remindersSent || {};
  const all = settingsFrom(settings).reminders;
  const due = all.filter((min) => !sent[String(min)] && now >= start - min * 60000);
  // Only the most urgent one is sent, so people are not sent several at once.
  return due.length ? [Math.min(...due)] : [];
};

export const remindersSkipped = (meeting, settings, now = Date.now()) => {
  const start = ms(meeting.startAt);
  return settingsFrom(settings).reminders.filter((min) => now >= start - min * 60000);
};

export const reminderLabel = (min) => (min % 1440 === 0 ? `${min / 1440 === 1 ? '24 hours' : `${min / 1440} days`}` : min % 60 === 0 ? `${min / 60} hour${min === 60 ? '' : 's'}` : `${min} minutes`);
