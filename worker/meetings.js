/**
 * Online meetings: the server side. Every decision about who may see,
 * schedule, join, manage or record a meeting is made here, from the
 * member's verified sign-in and their official record. The website only
 * shows what this server allows; copied links and edited pages get nowhere.
 *
 * Routes (all under /api/meetings, signed-in members only):
 *   GET  overview            – my rooms, upcoming meetings and setup state
 *   GET  room?id=            – one room: its meetings and members (if allowed)
 *   GET  meeting?id=         – one meeting (if allowed)
 *   POST schedule|update|cancel|start|join|lock|end|remove
 *   GET  attendance?id=      – measured attendance (leader)
 *   POST attendance          – leader confirms the lists (awards points)
 *   POST correct             – correct one person's attendance afterwards
 *   GET  mine                – my attendance history and meeting points
 *   GET  admin               – everything, for administrators
 *   POST room-settings       – administrators choose leaders, moderators, permissions and who may enter
 *   GET  access-check?uid=   – administrators: why a member can or cannot enter each room
 *   GET  minutes?id= / POST minutes – minutes, decisions and action points of a meeting
 *   POST notice | notice-delete     – a room's notices and shared document links
 *   GET  room-report?id=     – attendance per member across a room's meetings
 *   GET  ws?seat=            – the live meeting connection (WebSocket)
 *   *    sfu/<seat>/…         – audio and video, for admitted people only
 */
import { commit, getDoc, queryDocs, SetupError, checkDatabase } from './firestore.js';
import { audit, contextFor, HttpError, json, nameOf, now, photosFor, requireAdmin, rid, str } from './context.js';
import { handleSfu, issueSeat, readSeat, roomStub, videoConfigured } from './sfu.js';
import * as L from './meetingLogic.js';
import * as A from './appreciation.js';
import { councilsOf } from './councils.js';

const loadMeeting = async (ctx, id) => {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(String(id || ''))) throw new HttpError(400, 'Unknown meeting.');
  const m = await getDoc(ctx.env, `meetings/${id}`);
  if (!m) throw new HttpError(404, 'This meeting does not exist or has been removed.');
  return m;
};

/** The meeting, but only if this person may take part in it (refusals are recorded). */
const meetingFor = async (ctx, id, action = 'view') => {
  const meeting = await loadMeeting(ctx, id);
  const room = ctx.room(meeting.roomId);
  const access = await ctx.access(room, meeting);
  if (!access.allowed) {
    await audit(ctx, `${action}_refused`, { meetingId: id, roomId: room.id, detail: access.reason }, false);
    throw new HttpError(403, access.reason);
  }
  return { meeting, room, access };
};

const requireManage = async (ctx, room, access, permission) => {
  if (!L.canManage(access, access.leader, permission)) {
    await audit(ctx, `${permission}_refused`, { roomId: room.id }, false);
    throw new HttpError(403, 'Only the leader of this meeting room (or an administrator) can do this.');
  }
};

/** Meeting as shown to a member (no internal fields). */
const view = (m, extra = {}) => ({
  id: m.id,
  roomId: m.roomId,
  title: m.title,
  purpose: m.purpose || '',
  agenda: m.agenda || '',
  startAt: m.startAt,
  durationMin: m.durationMin,
  kind: m.kind || 'regular',
  activityId: m.activityId || '',
  invite: m.invite || 'all',
  recurrence: m.recurrence || 'none',
  status: m.status,
  locked: Boolean(m.locked),
  waitingRoom: m.waitingRoom || 'host',
  speaking: m.speaking || 'open',
  media: m.media === 'video' ? 'video' : 'audio',
  startedAt: m.startedAt || null,
  endedAt: m.endedAt || null,
  attendanceStatus: m.attendanceStatus || 'none',
  attendedCount: m.attendedCount ?? null,
  eligibleCount: m.eligibleCount ?? null,
  cancelReason: m.cancelReason || '',
  ...extra,
});

// ---------------------------------------------------------------- notifications

const whenText = (iso) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  return `${date}, ${time} (UK time)`;
};

/** Personal notifications to everyone the meeting is for (and its leader). */
const notifyMeeting = async (env, members, room, meeting, kind, leaderUid, extra = '') => {
  const people = L.eligibleMembers(members, room, meeting).map((m) => m.id);
  if (leaderUid && !people.includes(leaderUid)) people.push(leaderUid);
  const titles = {
    scheduled: `New meeting: ${meeting.title}`,
    rescheduled: `Meeting moved: ${meeting.title}`,
    cancelled: `Meeting cancelled: ${meeting.title}`,
    started: `Meeting started: ${meeting.title}`,
    reminder: `Reminder: ${meeting.title} ${extra}`,
  };
  const body = kind === 'cancelled'
    ? `${room.name} · ${whenText(meeting.startAt)}.${meeting.cancelReason ? ` Reason: ${meeting.cancelReason}` : ''}`
    : kind === 'started'
      ? `${room.name}. The meeting leader has started the meeting. Join now from the link.`
      : `${room.name} · ${whenText(meeting.startAt)} · ${meeting.durationMin} minutes. Open the link to see the agenda and join.`;
  const at = now();
  const ops = people.map((uid) => ({
    set: `user_notifications/mt-${meeting.id}-${kind}${extra ? `-${extra.replace(/[^a-z0-9]/gi, '')}` : ''}-${uid}`.slice(0, 1400),
    data: {
      id: `mt-${meeting.id}-${kind}-${uid}`,
      userId: uid,
      type: 'event',
      title: titles[kind].slice(0, 200),
      body: body.slice(0, 2000),
      link: `/meetings/${meeting.id}`,
      read: false,
      createdAt: at,
    },
  }));
  for (let i = 0; i < ops.length; i += 400) await commit(env, ops.slice(i, i + 400));
  return people.length;
};

// ---------------------------------------------------------------- live room

const liveRoom = (env, meetingId, path, body) => roomStub(env, meetingId).fetch(`https://room/${path}`, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });

const configureRoom = (env, meeting, patch = {}) => liveRoom(env, meeting.id, 'configure', {
  meetingId: meeting.id,
  title: meeting.title,
  waitingRoom: meeting.waitingRoom || 'host',
  speaking: meeting.speaking || 'open',
  media: meeting.media === 'video' ? 'video' : 'audio',
  locked: Boolean(meeting.locked),
  status: meeting.status,
  ...patch,
});

// ---------------------------------------------------------------- meetings

const validWhen = (iso) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new HttpError(400, 'Please choose a valid date and time.');
  return new Date(t).toISOString();
};

const meetingFields = async (ctx, room, b, existing = {}) => {
  const title = str(b.title ?? existing.title, 160);
  if (title.length < 3) throw new HttpError(400, 'Please give the meeting a title.');
  const durationMin = Math.round(Number(b.durationMin ?? existing.durationMin ?? 60));
  if (!(durationMin >= 10 && durationMin <= 480)) throw new HttpError(400, 'The meeting must last between 10 minutes and 8 hours.');
  const invite = (b.invite ?? existing.invite) === 'selected' ? 'selected' : 'all';
  let invitees = [];
  if (invite === 'selected') {
    const allowed = new Set(L.eligibleMembers(await ctx.members(), room, null).map((m) => m.id));
    invitees = [...new Set((Array.isArray(b.invitees) ? b.invitees : existing.invitees || []).map(String))].filter((u) => allowed.has(u)).slice(0, 500);
    if (!invitees.length) throw new HttpError(400, 'Choose at least one member to invite.');
  }
  const activityId = str(b.activityId ?? existing.activityId, 120);
  return {
    title,
    purpose: str(b.purpose ?? existing.purpose, 400),
    agenda: str(b.agenda ?? existing.agenda, 4000),
    startAt: validWhen(b.startAt ?? existing.startAt),
    durationMin,
    kind: (b.kind ?? existing.kind) === 'preparation' ? 'preparation' : 'regular',
    activityId,
    invite,
    invitees,
    recurrence: (b.recurrence ?? existing.recurrence) === 'monthly' ? 'monthly' : 'none',
    waitingRoom: ['off', 'host', 'approve'].includes(b.waitingRoom ?? existing.waitingRoom) ? (b.waitingRoom ?? existing.waitingRoom) : ctx.settings.defaultWaitingRoom,
    speaking: ['open', 'controlled'].includes(b.speaking ?? existing.speaking) ? (b.speaking ?? existing.speaking) : ctx.settings.defaultSpeaking,
    media: ['audio', 'video'].includes(b.media ?? existing.media) ? (b.media ?? existing.media) : ctx.settings.defaultMedia,
  };
};

const schedule = async (ctx, b) => {
  const room = ctx.room(str(b.roomId, 120));
  const access = await ctx.access(room);
  await requireManage(ctx, room, access, 'schedule');
  const fields = await meetingFields(ctx, room, b);
  if (Date.parse(fields.startAt) < Date.now() - 5 * 60000) throw new HttpError(400, 'The meeting must start in the future.');
  const id = rid('mt');
  const meeting = {
    id,
    roomId: room.id,
    ...fields,
    status: 'scheduled',
    locked: false,
    seriesId: fields.recurrence === 'monthly' ? id : '',
    remindersSent: Object.fromEntries(L.remindersSkipped({ startAt: fields.startAt }, ctx.settings).map((m) => [String(m), true])),
    attendanceStatus: 'none',
    createdBy: ctx.who.uid,
    createdAt: now(),
    updatedAt: now(),
  };
  await commit(ctx.env, [{ create: `meetings/${id}`, data: meeting }]);
  await audit(ctx, 'scheduled', { meetingId: id, roomId: room.id, detail: `${fields.title} · ${fields.startAt}` });
  const notified = await notifyMeeting(ctx.env, await ctx.members(), room, meeting, 'scheduled', access.leader.uid);
  return { meeting: view(meeting), notified };
};

const update = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'update');
  await requireManage(ctx, room, access, 'schedule');
  if (meeting.status !== 'scheduled') throw new HttpError(409, 'Only meetings that have not started can be changed.');
  const fields = await meetingFields(ctx, room, b, meeting);
  const moved = fields.startAt !== meeting.startAt;
  const data = { ...fields, updatedAt: now() };
  if (moved) data.remindersSent = Object.fromEntries(L.remindersSkipped({ startAt: fields.startAt }, ctx.settings).map((m) => [String(m), true]));
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data }]);
  await audit(ctx, moved ? 'rescheduled' : 'edited', { meetingId: meeting.id, roomId: room.id, detail: moved ? `${meeting.startAt} → ${fields.startAt}` : fields.title });
  const next = { ...meeting, ...data };
  if (moved) await notifyMeeting(ctx.env, await ctx.members(), room, next, 'rescheduled', access.leader.uid);
  return { meeting: view(next) };
};

const cancel = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'cancel');
  await requireManage(ctx, room, access, 'schedule');
  if (meeting.status !== 'scheduled') throw new HttpError(409, 'Only meetings that have not started can be cancelled.');
  const data = { status: 'cancelled', cancelReason: str(b.reason, 300), cancelledBy: ctx.who.uid, updatedAt: now() };
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data }]);
  await audit(ctx, 'cancelled', { meetingId: meeting.id, roomId: room.id, detail: data.cancelReason });
  await notifyMeeting(ctx.env, await ctx.members(), room, { ...meeting, ...data }, 'cancelled', access.leader.uid);
  if (meeting.recurrence === 'monthly' && b.series !== true) await createNextInSeries(ctx.env, { ...meeting, ...data }, ctx.settings, await ctx.members(), ctx.rooms, ctx.roomDocs);
  return { meeting: view({ ...meeting, ...data }) };
};

const start = async (ctx, b, quiet = false) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'start');
  await requireManage(ctx, room, access, 'start');
  if (meeting.status === 'cancelled') throw new HttpError(409, 'This meeting was cancelled.');
  if (meeting.status === 'ended') throw new HttpError(409, 'This meeting has ended. Schedule a new one to meet again.');
  if (meeting.status === 'live') return { meeting: view(meeting) };
  const early = Date.parse(meeting.startAt) - Date.now();
  if (early > 60 * 60000 && !access.host) throw new HttpError(409, 'This meeting can be started up to one hour before its start time.');
  if (!videoConfigured(ctx.env)) throw new SetupError('The video service is not connected yet, so meetings cannot start. An administrator can find the steps under Administration > Online meetings.');
  const data = { status: 'live', startedAt: now(), startedBy: ctx.who.uid, updatedAt: now() };
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data }]);
  await configureRoom(ctx.env, { ...meeting, ...data }, { startedAt: data.startedAt, chatOpen: true });
  await audit(ctx, 'started', { meetingId: meeting.id, roomId: room.id });
  if (!quiet) await notifyMeeting(ctx.env, await ctx.members(), room, { ...meeting, ...data }, 'started', access.leader.uid);
  return { meeting: view({ ...meeting, ...data }) };
};

const join = async (ctx, b) => {
  let { meeting, room, access } = await meetingFor(ctx, b.id, 'join');
  if (meeting.status === 'cancelled') throw new HttpError(409, 'This meeting was cancelled.');
  if (meeting.status === 'ended') throw new HttpError(409, 'This meeting has ended.');
  if ((meeting.removed || []).includes(ctx.who.uid) && !access.host) {
    await audit(ctx, 'join_refused', { meetingId: meeting.id, roomId: room.id, detail: 'Removed from this meeting' }, false);
    throw new HttpError(403, 'You were removed from this meeting by its leader.');
  }
  if (meeting.status !== 'live') {
    if (!L.canManage(access, access.leader, 'start')) throw new HttpError(409, 'The meeting has not started yet. You will be notified when the leader starts it.');
    await start(ctx, b);
    meeting = await loadMeeting(ctx, b.id);
  }
  if (meeting.locked && !access.host) {
    await audit(ctx, 'join_refused', { meetingId: meeting.id, roomId: room.id, detail: 'Meeting locked' }, false);
    throw new HttpError(423, 'The leader has locked this meeting, so no one else can join.');
  }
  const profile = (await photosFor(ctx.env, [ctx.who.uid]))[ctx.who.uid];
  const seat = await issueSeat(ctx.env, {
    mid: meeting.id,
    uid: ctx.who.uid,
    name: profile?.name || nameOf(ctx.member) || ctx.who.name || 'Member',
    photo: /^https:\/\//.test(profile?.photoUrl || '') ? profile.photoUrl : '',
    role: access.role,
    host: access.host,
    hours: Math.max(2, Math.ceil((meeting.durationMin || 60) / 60) + 2),
  });
  await audit(ctx, 'joined', { meetingId: meeting.id, roomId: room.id, detail: access.role });
  return { seat, host: access.host, role: access.role, meeting: view(meeting) };
};

const lock = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'lock');
  await requireManage(ctx, room, access, 'lock');
  const locked = b.locked !== false;
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data: { locked, updatedAt: now() } }]);
  // Only the lock changes: a leader's in-meeting choices (such as cameras) stay as they are.
  if (meeting.status === 'live') await liveRoom(ctx.env, meeting.id, 'configure', { locked });
  await audit(ctx, locked ? 'locked' : 'unlocked', { meetingId: meeting.id, roomId: room.id });
  return { meeting: view({ ...meeting, locked }) };
};

const remove = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'remove');
  await requireManage(ctx, room, access, 'remove');
  const target = str(b.uid, 128);
  if (!target || target === ctx.who.uid) throw new HttpError(400, 'Choose a participant to remove.');
  const members = await ctx.members();
  const tm = members.find((m) => m.id === target);
  if (tm && (L.isSenior(tm) || access.leader.uid === target) && access.role !== 'admin') throw new HttpError(403, 'The room leader and senior officials cannot be removed.');
  const removed = [...new Set([...(meeting.removed || []), target])];
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data: { removed, updatedAt: now() } }]);
  if (meeting.status === 'live') await liveRoom(ctx.env, meeting.id, 'kick', { uid: target });
  await audit(ctx, 'removed_participant', { meetingId: meeting.id, roomId: room.id, detail: nameOf(tm) || target });
  return { ok: true };
};

const end = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'end');
  await requireManage(ctx, room, access, 'start');
  if (meeting.status !== 'live') return { meeting: view(meeting) };
  await liveRoom(ctx.env, meeting.id, 'end', {});
  const data = { status: 'ended', endedAt: now(), endedBy: ctx.who.uid, updatedAt: now() };
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data }]);
  await audit(ctx, 'ended', { meetingId: meeting.id, roomId: room.id });
  if (meeting.recurrence === 'monthly') await createNextInSeries(ctx.env, { ...meeting, ...data }, ctx.settings, await ctx.members(), ctx.rooms, ctx.roomDocs);
  return { meeting: view({ ...meeting, ...data }) };
};

/** A monthly meeting schedules its next occurrence once it ends (or is cancelled). */
const createNextInSeries = async (env, meeting, settings, members, rooms, roomDocs) => {
  if (meeting.recurrence !== 'monthly' || meeting.nextId) return null;
  const room = rooms.find((r) => r.id === meeting.roomId);
  if (!room) return null;
  let startAt = L.nextMonthly(meeting.startAt);
  while (Date.parse(startAt) < Date.now()) startAt = L.nextMonthly(startAt);
  const id = rid('mt');
  const next = {
    id,
    roomId: meeting.roomId,
    title: meeting.title,
    purpose: meeting.purpose || '',
    agenda: meeting.agenda || '',
    startAt,
    durationMin: meeting.durationMin,
    kind: meeting.kind || 'regular',
    activityId: '',
    invite: meeting.invite || 'all',
    invitees: meeting.invitees || [],
    recurrence: 'monthly',
    seriesId: meeting.seriesId || meeting.id,
    waitingRoom: meeting.waitingRoom || settings.defaultWaitingRoom,
    speaking: meeting.speaking || settings.defaultSpeaking,
    media: meeting.media || settings.defaultMedia,
    status: 'scheduled',
    locked: false,
    remindersSent: Object.fromEntries(L.remindersSkipped({ startAt }, settings).map((m) => [String(m), true])),
    attendanceStatus: 'none',
    createdBy: meeting.createdBy,
    createdAt: now(),
    updatedAt: now(),
  };
  const ok = await commit(env, [{ create: `meetings/${id}`, data: next }, { update: `meetings/${meeting.id}`, data: { nextId: id } }]).catch(() => false);
  if (ok) await notifyMeeting(env, members, room, next, 'scheduled', L.leaderOf(room, roomDocs[room.id], members).uid);
  return id;
};

// ---------------------------------------------------------------- attendance

const measured = async (ctx, meeting, room) => {
  const members = await ctx.members();
  const eligible = L.eligibleMembers(members, room, meeting);
  const joined = (await (await liveRoom(ctx.env, meeting.id, 'participation')).json()).people || [];
  const result = L.measureAttendance({ eligible, joined, meeting, settings: ctx.settings });
  const info = await photosFor(ctx.env, result.rows.map((r) => r.uid));
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  result.rows = result.rows.map((r) => ({
    ...r,
    name: info[r.uid]?.name || nameOf(byId[r.uid]),
    photoUrl: info[r.uid]?.photoUrl || '',
    chapterId: byId[r.uid]?.chapterId || '',
  }));
  return result;
};

const attendance = async (ctx, id) => {
  const { meeting, room, access } = await meetingFor(ctx, id, 'attendance');
  await requireManage(ctx, room, access, 'attendance');
  const result = await measured(ctx, meeting, room);
  let confirmed = [];
  if (meeting.attendanceStatus === 'approved') confirmed = await queryDocs(ctx.env, 'meeting_attendance', { where: [['meetingId', '==', meeting.id]] });
  return { meeting: view(meeting), room: { id: room.id, name: room.name }, ...result, confirmed, settings: { thresholdPercent: ctx.settings.thresholdPercent, lateMinutes: ctx.settings.lateMinutes } };
};

const STATUSES = ['attended', 'late', 'absent', 'excused'];

/** The leader confirms the attendance and absence lists; points follow. */
const confirmAttendance = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'attendance');
  await requireManage(ctx, room, access, 'attendance');
  if (meeting.status !== 'ended') throw new HttpError(409, 'End the meeting before confirming attendance.');
  if (meeting.attendanceStatus === 'approved') throw new HttpError(409, 'Attendance for this meeting is already confirmed. Use “Correct” to change one person’s record.');
  const result = await measured(ctx, meeting, room);
  const changes = new Map((Array.isArray(b.rows) ? b.rows : []).map((r) => [String(r.uid), r]));
  const at = now();
  const records = [];
  for (const r of result.rows) {
    if (!r.eligible) continue;
    const c = changes.get(r.uid);
    let status = r.measured;
    let override = null;
    if (c && STATUSES.includes(c.status) && c.status !== r.measured) {
      const reason = str(c.reason, 300);
      if (reason.length < 3) throw new HttpError(400, `Please give a reason for changing ${r.name}'s attendance.`);
      status = c.status;
      override = { from: r.measured, reason, by: ctx.who.uid, at };
    }
    records.push({
      id: `${meeting.id}__${r.uid}`,
      meetingId: meeting.id,
      roomId: room.id,
      title: meeting.title,
      startAt: meeting.startedAt || meeting.startAt,
      uid: r.uid,
      name: r.name,
      photoUrl: r.photoUrl,
      chapterId: r.chapterId,
      status,
      measured: r.measured,
      minutes: r.minutes,
      percent: r.percent,
      firstJoin: r.firstJoin,
      lastLeave: r.lastLeave,
      ...(override ? { override } : {}),
      confirmedBy: ctx.who.uid,
      confirmedAt: at,
    });
  }
  const attended = records.filter((r) => L.counts(r.status));
  const ops = records.map((r) => ({ set: `meeting_attendance/${r.id}`, data: r }));
  ops.push({ update: `meetings/${meeting.id}`, data: { attendanceStatus: 'approved', attendanceApprovedBy: ctx.who.uid, attendanceApprovedAt: at, attendedCount: attended.length, eligibleCount: records.length, updatedAt: at } });
  // The public activity post waits for an administrator to check it.
  ops.push({ set: `meeting_posts/${meeting.id}`, data: {
    id: meeting.id, meetingId: meeting.id, roomId: room.id, roomName: room.name, title: meeting.title, purpose: meeting.purpose || '',
    date: (meeting.startedAt || meeting.startAt), attendees: attended.map((r) => r.uid), status: 'pending', createdAt: at,
  } });
  for (let i = 0; i < ops.length; i += 400) await commit(ctx.env, ops.slice(i, i + 400));
  await audit(ctx, 'attendance_confirmed', { meetingId: meeting.id, roomId: room.id, detail: `${attended.length} of ${records.length} attended; ${records.filter((r) => r.override).length} changed by the leader` });
  const points = [];
  for (const r of records) points.push(await recalcPoints(ctx.env, r.uid, ctx.who.uid));
  return { ok: true, attended: attended.length, eligible: records.length, points };
};

const correct = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'correct');
  await requireManage(ctx, room, access, 'attendance');
  if (meeting.attendanceStatus !== 'approved') throw new HttpError(409, 'Confirm the attendance lists first.');
  const uid = str(b.uid, 128);
  const status = STATUSES.includes(b.status) ? b.status : null;
  const reason = str(b.reason, 300);
  if (!status) throw new HttpError(400, 'Choose attended, late, absent or excused.');
  if (reason.length < 3) throw new HttpError(400, 'Please give a reason for the correction.');
  const recId = `${meeting.id}__${uid}`;
  const rec = await getDoc(ctx.env, `meeting_attendance/${recId}`);
  if (!rec) throw new HttpError(404, 'This person was not on the list for this meeting.');
  const history = [...(rec.corrections || []), { from: rec.status, to: status, reason, by: ctx.who.uid, at: now() }];
  await commit(ctx.env, [{ update: `meeting_attendance/${recId}`, data: { status, corrections: history } }]);
  const records = await queryDocs(ctx.env, 'meeting_attendance', { where: [['meetingId', '==', meeting.id]] });
  await commit(ctx.env, [{ update: `meetings/${meeting.id}`, data: { attendedCount: records.filter((r) => L.counts(r.status)).length } }]);
  await audit(ctx, 'attendance_corrected', { meetingId: meeting.id, roomId: room.id, detail: `${rec.name}: ${rec.status} → ${status}. ${reason}` });
  return { ok: true, points: await recalcPoints(ctx.env, uid, ctx.who.uid) };
};

const LABEL = {
  meeting_attendance: 'Attended an online meeting',
  meeting_streak_bonus: 'Three meetings attended in a row',
  meeting_absence_penalty: 'Two meetings missed in a row',
};

/**
 * Brings a member's meeting points in line with their confirmed attendance:
 * adds what is missing, reverses what no longer applies (with a correction
 * entry), and updates their totals. Never pays the same award twice.
 */
export const recalcPoints = async (env, uid, by) => {
  const [history, ledger, profile] = await Promise.all([
    queryDocs(env, 'meeting_attendance', { where: [['uid', '==', uid]] }),
    queryDocs(env, 'points_ledger', { where: [['userId', '==', uid]] }),
    getDoc(env, `public_profiles/${uid}`),
  ]);
  if (!profile) return { uid, skipped: 'no public profile' };
  const expected = L.meetingPointsFor(uid, history.map((h) => ({ meetingId: h.meetingId, startAt: h.startAt, status: h.status, title: h.title })));
  const { add, reverse } = L.reconcile(uid, expected, ledger);
  if (!add.length && !reverse.length) return { uid, added: 0, reversed: 0 };
  const d = new Date();
  const month = `m${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const quarter = `q${d.getUTCFullYear()}${Math.ceil((d.getUTCMonth() + 1) / 3)}`;
  const at = d.toISOString();
  const ops = [];
  let delta = 0;
  const monthDelta = {};
  for (const x of add) {
    ops.push({ create: `points_ledger/${x.id}`, data: {
      id: x.id, userId: uid, userName: profile.displayName || '', type: x.type, points: x.points, targetId: x.meetingId, targetTitle: (x.title || '').slice(0, 300),
      note: LABEL[x.type], periodMonth: month, periodQuarter: quarter, createdAt: at, awardedBy: by || 'system',
    } });
    delta += x.points;
  }
  for (const e of reverse) {
    const id = `${uid}__correction__reverse:${e.id}`;
    ops.push({ create: `points_ledger/${id}`, data: {
      id, userId: uid, userName: profile.displayName || '', type: 'correction', points: -e.points, targetId: `reverse:${e.id}`, targetTitle: (e.targetTitle || '').slice(0, 300),
      note: `Reversed after an attendance correction: ${LABEL[e.type] || e.type}`, periodMonth: month, periodQuarter: quarter, createdAt: at, awardedBy: by || 'system',
    } });
    delta -= e.points;
  }
  monthDelta['points.all'] = delta;
  monthDelta[`points.${month}`] = delta;
  monthDelta[`points.${quarter}`] = delta;
  const total = Math.max(0, ((profile.points || {}).all || 0) + delta);
  const level = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ace'][Math.min(5, Math.floor(Math.min(17, Math.floor(total / 100)) / 3))];
  const tier = ['I', 'II', 'III'][Math.min(17, Math.floor(total / 100)) % 3];
  ops.push({ increment: `public_profiles/${uid}`, fields: monthDelta, data: { activityTier: `${level} ${tier}`, updatedAt: at } });
  await commit(env, ops);
  if (delta !== 0) {
    await commit(env, [{ set: `user_notifications/pts-${uid}-${Date.now().toString(36)}`, data: {
      id: `pts-${uid}`, userId: uid, type: 'membership', read: false, createdAt: at, link: '/account/activity',
      title: delta > 0 ? `You earned ${delta} meeting points` : `${-delta} meeting points deducted`,
      body: [...add.map((x) => `${x.points > 0 ? '+' : ''}${x.points}: ${LABEL[x.type]}${x.title ? ` (${x.title})` : ''}`), ...reverse.map((e) => `${-e.points}: correction of an earlier award`)].join('\n').slice(0, 2000),
    } }]).catch(() => null);
  }
  return { uid, added: add.length, reversed: reverse.length, delta };
};

// ---------------------------------------------------------------- reading

const isUpcoming = (m) => (m.status === 'scheduled' || m.status === 'live') && Date.parse(m.startAt) + (m.durationMin || 60) * 60000 + 6 * 3600000 > Date.now();

const overview = async (ctx) => {
  const rooms = [];
  for (const room of ctx.rooms) {
    const access = await ctx.access(room);
    if (!access.allowed) continue;
    const leader = access.leader;
    rooms.push({
      ...room,
      role: access.role,
      host: access.host,
      leaderUid: leader.uid,
      can: Object.fromEntries(L.LEADER_PERMISSIONS.map((p) => [p, L.canManage(access, leader, p)])),
    });
  }
  const ids = rooms.map((r) => r.id);
  let meetings = [];
  for (let i = 0; i < ids.length; i += 10) {
    meetings.push(...await queryDocs(ctx.env, 'meetings', { where: [['roomId', 'in', ids.slice(i, i + 10)]] }));
  }
  const accessFor = Object.fromEntries(await Promise.all(rooms.map(async (r) => [r.id, r])));
  meetings = meetings.filter((m) => {
    const r = accessFor[m.roomId];
    return r && (r.host || m.invite !== 'selected' || (m.invitees || []).includes(ctx.who.uid));
  });
  const leaders = await photosFor(ctx.env, rooms.map((r) => r.leaderUid).filter(Boolean));
  const [db, video] = [{ ok: true }, await videoReady(ctx.env)];
  return {
    me: { uid: ctx.who.uid, isAdmin: ctx.isAdmin, name: nameOf(ctx.member), member: Boolean(ctx.member && ctx.member.status === 'active') },
    rooms: rooms.map((r) => ({ ...r, leaderName: leaders[r.leaderUid]?.name || '' })),
    upcoming: meetings.filter(isUpcoming).sort((a, b) => a.startAt.localeCompare(b.startAt)).map((m) => view(m)),
    recent: meetings.filter((m) => !isUpcoming(m)).sort((a, b) => b.startAt.localeCompare(a.startAt)).slice(0, 30).map((m) => view(m)),
    settings: { thresholdPercent: ctx.settings.thresholdPercent, lateMinutes: ctx.settings.lateMinutes, reminders: ctx.settings.reminders },
    setup: { database: db.ok, video },
  };
};

const videoReady = async (env) => videoConfigured(env);

const roomDetail = async (ctx, id) => {
  const room = ctx.room(id);
  const access = await ctx.access(room);
  if (!access.allowed) { await audit(ctx, 'room_refused', { roomId: room.id, detail: access.reason }, false); throw new HttpError(403, access.reason); }
  const members = await ctx.members();
  const eligible = L.eligibleMembers(members, room, null);
  const info = await photosFor(ctx.env, [...eligible.map((m) => m.id), access.leader.uid, ...(access.leader.managers || [])].filter(Boolean));
  let meetings = (await queryDocs(ctx.env, 'meetings', { where: [['roomId', '==', room.id]] }))
    .filter((m) => access.host || m.invite !== 'selected' || (m.invitees || []).includes(ctx.who.uid));
  meetings = meetings.sort((a, b) => b.startAt.localeCompare(a.startAt)).slice(0, 60);
  const isManager = L.canManage(access, access.leader, 'schedule');
  return {
    room: { ...room, role: access.role, host: access.host, leaderUid: access.leader.uid, leaderName: info[access.leader.uid]?.name || nameOf(members.find((m) => m.id === access.leader.uid)), can: Object.fromEntries(L.LEADER_PERMISSIONS.map((p) => [p, L.canManage(access, access.leader, p)])) },
    meetings: meetings.map((m) => view(m, isManager ? { invitees: m.invitees || [] } : {})),
    notices: await noticesOf(ctx.env, room.id),
    moderators: (access.leader.managers || []).map((u) => ({ uid: u, name: info[u]?.name || nameOf(members.find((m) => m.id === u)) })),
    // Names and photos of the room's members (for invitations); never contact details.
    members: eligible.map((m) => ({ uid: m.id, name: info[m.id]?.name || nameOf(m), photoUrl: info[m.id]?.photoUrl || '', positionId: m.positionId || 'member' })),
  };
};

const meetingDetail = async (ctx, id) => {
  const { meeting, room, access } = await meetingFor(ctx, id, 'view');
  const leaderInfo = await photosFor(ctx.env, [access.leader.uid].filter(Boolean));
  let live = null;
  if (meeting.status === 'live') {
    const s = await (await liveRoom(ctx.env, meeting.id, 'summary')).json().catch(() => null);
    live = { participants: s?.participants ?? 0, waiting: s?.waiting ?? 0 };
  }
  return {
    meeting: view(meeting),
    room: { id: room.id, name: room.name, kind: room.kind },
    me: { role: access.role, host: access.host, can: Object.fromEntries(L.LEADER_PERMISSIONS.map((p) => [p, L.canManage(access, access.leader, p)])) },
    leader: { uid: access.leader.uid, name: leaderInfo[access.leader.uid]?.name || '' },
    live,
    video: await videoReady(ctx.env),
  };
};

const mine = async (ctx) => {
  const uid = ctx.who.uid;
  const [history, ledger, participation, awards] = await Promise.all([
    queryDocs(ctx.env, 'meeting_attendance', { where: [['uid', '==', uid]] }),
    queryDocs(ctx.env, 'points_ledger', { where: [['userId', '==', uid]] }),
    queryDocs(ctx.env, 'activity_participants', { where: [['uid', '==', uid]] }),
    queryDocs(ctx.env, 'appreciation_awards', { where: [['uid', '==', uid]] }),
  ]);
  history.sort((a, b) => (b.startAt || '').localeCompare(a.startAt || ''));
  const meetingPoints = ledger.filter((e) => L.MEETING_TYPES.includes(e.type) || (e.type === 'correction' && e.targetId?.startsWith('reverse:')));
  return {
    history: history.map((h) => ({ meetingId: h.meetingId, title: h.title, roomId: h.roomId, startAt: h.startAt, status: h.status, minutes: h.minutes, corrected: Boolean(h.override || (h.corrections || []).length) })),
    streak: L.streakOf(history),
    // Activity participation counts only once approved; drafts are the leader's working notes.
    activities: participation.filter((p) => p.review === 'approved' || p.review === 'pending').sort((a, b) => (b.activityDate || '').localeCompare(a.activityDate || ''))
      .map((p) => ({ activityId: p.activityId, title: p.activityTitle, date: p.activityDate, status: p.status, review: p.review })),
    awards: awards.filter((a) => a.status === 'published').sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map((a) => ({ id: a.id, number: a.number, activityTitle: a.activityTitle, activityDate: a.activityDate, issuedAt: a.issuedAt })),
    points: meetingPoints.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => ({ id: e.id, type: e.type, points: e.points, title: e.targetTitle || '', note: e.note || '', createdAt: e.createdAt })),
  };
};

// ---------------------------------------------------------------- access check, minutes, notices, reports

/** Administrators: why a member can or cannot enter each room. */
const accessCheck = async (ctx, uid) => {
  requireAdmin(ctx);
  const members = await ctx.members();
  const m = members.find((x) => x.id === uid);
  if (!m) throw new HttpError(404, 'No member record for this account.');
  const [admin, user] = await Promise.all([getDoc(ctx.env, `admins/${uid}`), getDoc(ctx.env, `users/${uid}`)]);
  const isAdmin = Boolean(admin) || ((user?.email || '').toLowerCase() === 'dashtiozar@gmail.com' && (user?.roles || []).includes('owner'));
  const rooms = [];
  for (const room of ctx.rooms) rooms.push({ id: room.id, name: room.name, kind: room.kind, ...L.explainAccess(m, room, await ctx.leader(room), isAdmin) });
  await audit(ctx, 'access_checked', { detail: `${nameOf(m)} (${uid})` });
  return { member: { uid, name: nameOf(m), status: m.status, positions: L.positionsOf(m), chapterId: m.chapterId || '' }, rooms };
};

const ACTION_STATUS = ['open', 'in_progress', 'done'];

/** Minutes and action points of a meeting (everyone with access reads; managers write). */
const minutesOf = async (ctx, id) => {
  const { meeting, room, access } = await meetingFor(ctx, id, 'view');
  const doc = await getDoc(ctx.env, `meeting_minutes/${meeting.id}`);
  const members = L.eligibleMembers(await ctx.members(), room, null);
  return {
    minutes: doc ? { text: doc.text || '', decisions: doc.decisions || '', actions: doc.actions || [], updatedAt: doc.updatedAt || '', updatedByName: doc.updatedByName || '' } : { text: '', decisions: '', actions: [], updatedAt: '', updatedByName: '' },
    canEdit: L.canManage(access, access.leader, 'attendance') || L.canManage(access, access.leader, 'schedule'),
    people: members.map((m) => ({ uid: m.id, name: nameOf(m) })),
  };
};

const saveMinutes = async (ctx, b) => {
  const { meeting, room, access } = await meetingFor(ctx, b.id, 'minutes');
  if (!(L.canManage(access, access.leader, 'attendance') || L.canManage(access, access.leader, 'schedule'))) {
    await audit(ctx, 'minutes_refused', { meetingId: meeting.id, roomId: room.id }, false);
    throw new HttpError(403, 'Only the meeting’s leader, a moderator or an administrator can write the minutes.');
  }
  const people = new Map(L.eligibleMembers(await ctx.members(), room, null).map((m) => [m.id, nameOf(m)]));
  const actions = (Array.isArray(b.actions) ? b.actions : []).slice(0, 60).map((a, i) => ({
    id: str(a.id, 40) || `a${Date.now().toString(36)}${i}`,
    text: str(a.text, 500),
    owner: people.has(str(a.owner, 128)) ? str(a.owner, 128) : '',
    ownerName: people.get(str(a.owner, 128)) || str(a.ownerName, 120),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(a.due || '')) ? a.due : '',
    status: ACTION_STATUS.includes(a.status) ? a.status : 'open',
  })).filter((a) => a.text.length >= 2);
  const data = { id: meeting.id, meetingId: meeting.id, roomId: room.id, title: meeting.title, text: str(b.text, 20000), decisions: str(b.decisions, 8000), actions, updatedAt: now(), updatedBy: ctx.who.uid, updatedByName: nameOf(ctx.member) || ctx.who.email };
  const prev = await getDoc(ctx.env, `meeting_minutes/${meeting.id}`).catch(() => null);
  await commit(ctx.env, [{ set: `meeting_minutes/${meeting.id}`, data }]);
  // People given a new action point are told.
  const before = new Map((prev?.actions || []).map((a) => [a.id, a.owner]));
  const ops = actions.filter((a) => a.owner && a.owner !== ctx.who.uid && before.get(a.id) !== a.owner).map((a) => ({ set: `user_notifications/act-${meeting.id}-${a.id}-${a.owner}`.slice(0, 1400), data: {
    id: `act-${meeting.id}-${a.id}-${a.owner}`, userId: a.owner, type: 'event', read: false, createdAt: now(), link: `/meetings/${meeting.id}`,
    title: `Action point from ${meeting.title}`.slice(0, 200), body: `${a.text}${a.due ? ` (by ${a.due.split('-').reverse().join('/')})` : ''}`.slice(0, 2000),
  } }));
  if (ops.length) await commit(ctx.env, ops).catch(() => null);
  await audit(ctx, 'minutes_saved', { meetingId: meeting.id, roomId: room.id, detail: `${actions.length} action points` });
  return { ok: true };
};

/** Notices and document links of a room. */
const noticesOf = async (env, roomId) => (await queryDocs(env, 'meeting_notices', { where: [['roomId', '==', roomId]] }))
  .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);

const postNotice = async (ctx, b) => {
  const room = ctx.room(str(b.roomId, 120));
  const access = await ctx.access(room);
  if (!access.allowed) throw new HttpError(403, access.reason);
  await requireManage(ctx, room, access, 'schedule');
  const title = str(b.title, 160);
  if (title.length < 3) throw new HttpError(400, 'Give the notice a title.');
  const link = str(b.link, 600);
  if (link && !/^https:\/\/[^\s<>"']+$/.test(link)) throw new HttpError(400, 'Document links must start with https://');
  const id = rid('nt');
  const at = now();
  const data = { id, roomId: room.id, kind: link ? 'document' : 'notice', title, body: str(b.body, 4000), link, createdAt: at, createdBy: ctx.who.uid, createdByName: nameOf(ctx.member) || ctx.who.email };
  const people = L.eligibleMembers(await ctx.members(), room, null).map((m) => m.id).filter((u) => u !== ctx.who.uid);
  const ops = [{ set: `meeting_notices/${id}`, data }, ...people.map((u) => ({ set: `user_notifications/nt-${id}-${u}`, data: {
    id: `nt-${id}-${u}`, userId: u, type: 'event', read: false, createdAt: at, link: `/meetings/room/${room.id}`, title: `${room.name}: ${title}`.slice(0, 200), body: data.body.slice(0, 300) || (link ? 'A document has been shared in the meeting room.' : ''),
  } }))];
  for (let i = 0; i < ops.length; i += 400) await commit(ctx.env, ops.slice(i, i + 400));
  await audit(ctx, 'notice_posted', { roomId: room.id, detail: title });
  return { ok: true };
};

const deleteNotice = async (ctx, b) => {
  const n = await getDoc(ctx.env, `meeting_notices/${str(b.id, 80)}`);
  if (!n) throw new HttpError(404, 'This notice no longer exists.');
  const room = ctx.room(n.roomId);
  const access = await ctx.access(room);
  if (!access.allowed) throw new HttpError(403, access.reason);
  await requireManage(ctx, room, access, 'schedule');
  await commit(ctx.env, [{ delete: `meeting_notices/${n.id}` }]);
  await audit(ctx, 'notice_deleted', { roomId: room.id, detail: n.title });
  return { ok: true };
};

/** Attendance per member across the room's confirmed meetings (leaders and administrators). */
const roomReport = async (ctx, id) => {
  const room = ctx.room(id);
  const access = await ctx.access(room);
  if (!access.allowed) throw new HttpError(403, access.reason);
  await requireManage(ctx, room, access, 'attendance');
  const rows = await queryDocs(ctx.env, 'meeting_attendance', { where: [['roomId', '==', room.id]] });
  const meetings = new Map();
  const people = new Map();
  for (const r of rows) {
    meetings.set(r.meetingId, { id: r.meetingId, title: r.title, startAt: r.startAt });
    const p = people.get(r.uid) || { uid: r.uid, name: r.name, attended: 0, late: 0, absent: 0, excused: 0, meetings: 0 };
    p[r.status] = (p[r.status] || 0) + 1;
    p.meetings += 1;
    people.set(r.uid, p);
  }
  return {
    room: { id: room.id, name: room.name },
    meetings: [...meetings.values()].sort((a, b) => String(b.startAt).localeCompare(String(a.startAt))),
    people: [...people.values()].map((p) => ({ ...p, rate: p.meetings ? Math.round(((p.attended + p.late) / p.meetings) * 100) : 0 })).sort((a, b) => a.name.localeCompare(b.name)),
  };
};

// ---------------------------------------------------------------- administration

const adminView = async (ctx) => {
  requireAdmin(ctx);
  const members = await ctx.members();
  const rooms = ctx.rooms.map((room) => {
    const d = ctx.roomDocs[room.id] || {};
    const leader = L.leaderOf(room, d, members);
    return { ...room, leaderUid: leader.uid, leaderChosen: leader.chosen, leaderSuspended: Boolean(d.leaderSuspended), leaderPermissions: Object.fromEntries(L.LEADER_PERMISSIONS.map((p) => [p, d.leaderPermissions?.[p] !== false])), eligible: L.eligibleMembers(members, room, null).length, managers: leader.managers };
  });
  const [meetings, auditRows, posts] = await Promise.all([
    queryDocs(ctx.env, 'meetings', { orderBy: [['startAt', 'desc']], limit: 200 }),
    queryDocs(ctx.env, 'meeting_audit', { orderBy: [['at', 'desc']], limit: 300 }),
    queryDocs(ctx.env, 'meeting_posts', { where: [['status', '==', 'pending']] }),
  ]);
  const candidates = members.filter((m) => m.status === 'active' && !String(m.id).startsWith('mem-'))
    .map((m) => ({ uid: m.id, name: nameOf(m), chapterId: m.chapterId || '', positionId: m.positionId || 'member' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const leaderNames = Object.fromEntries(candidates.map((c) => [c.uid, c.name]));
  return {
    rooms: rooms.map((r) => ({ ...r, leaderName: leaderNames[r.leaderUid] || '' })),
    meetings: meetings.map((m) => view(m)),
    audit: auditRows,
    posts,
    candidates,
    settings: ctx.settings,
    setup: {
      database: true,
      video: videoConfigured(ctx.env),
      turn: Boolean(ctx.env.TURN_KEY_ID && ctx.env.TURN_KEY_API_TOKEN),
    },
  };
};

const roomSettings = async (ctx, b) => {
  requireAdmin(ctx);
  const room = ctx.room(str(b.roomId, 120));
  const before = ctx.roomDocs[room.id] || {};
  const leaderUid = b.leaderUid === null ? '' : str(b.leaderUid ?? before.leaderUid, 128);
  if (leaderUid) {
    const m = (await ctx.members()).find((x) => x.id === leaderUid);
    if (!m || m.status !== 'active') throw new HttpError(400, 'The leader must be an approved, active member.');
  }
  const perms = Object.fromEntries(L.LEADER_PERMISSIONS.map((p) => [p, (b.leaderPermissions || before.leaderPermissions || {})[p] !== false]));
  // Explicit access: people added to the room, people removed from it, and moderators.
  const all = await ctx.members();
  const activeIds = new Set(all.filter((m) => m.status === 'active' && !String(m.id).startsWith('mem-')).map((m) => m.id));
  const ids = (v, fallback) => {
    const list = Array.isArray(v) ? v : (fallback || []);
    const clean = [...new Set(list.map((x) => str(x, 128)).filter(Boolean))];
    const bad = clean.filter((x) => !activeIds.has(x) && !(fallback || []).includes(x));
    if (bad.length) throw new HttpError(400, 'Only approved, active members can be added to a room.');
    return clean.slice(0, 500);
  };
  const members = ids(b.members, before.members);
  const excluded = ids(b.excluded, before.excluded).filter((x) => !members.includes(x));
  const moderators = ids(b.moderators, before.moderators);
  const data = { id: room.id, leaderUid, leaderSuspended: Boolean(b.leaderSuspended ?? before.leaderSuspended), leaderPermissions: perms, members, excluded, moderators, updatedAt: now(), updatedBy: ctx.who.uid };
  await commit(ctx.env, [{ set: `meeting_rooms/${room.id}`, data }]);
  const changes = [];
  if ((before.leaderUid || '') !== leaderUid) changes.push(`leader ${before.leaderUid || 'default'} → ${leaderUid || 'default'}`);
  if (Boolean(before.leaderSuspended) !== data.leaderSuspended) changes.push(data.leaderSuspended ? 'leader suspended' : 'leader restored');
  const offBefore = L.LEADER_PERMISSIONS.filter((p) => before.leaderPermissions?.[p] === false).join(',');
  const offAfter = L.LEADER_PERMISSIONS.filter((p) => !perms[p]).join(',');
  if (offBefore !== offAfter) changes.push(`permissions withheld: ${offAfter || 'none'}`);
  const names = (list) => list.map((u) => nameOf(all.find((m) => m.id === u))).join(', ') || 'none';
  for (const [key, labelText] of [['members', 'added members'], ['excluded', 'removed members'], ['moderators', 'moderators']]) {
    if ((before[key] || []).join() !== data[key].join()) changes.push(`${labelText}: ${names(data[key])}`);
  }
  await audit(ctx, 'room_settings', { roomId: room.id, detail: changes.join('; ') || 'no change' });
  if (leaderUid && leaderUid !== before.leaderUid) {
    await commit(ctx.env, [{ set: `user_notifications/lead-${room.id}-${leaderUid}`, data: {
      id: `lead-${room.id}-${leaderUid}`, userId: leaderUid, type: 'membership', read: false, createdAt: now(), link: '/meetings',
      title: `You lead the ${room.name} meeting room`, body: 'You can now schedule and run its online meetings and confirm attendance.',
    } }]).catch(() => null);
  }
  return { ok: true };
};

/**
 * Publishes a meeting's activity post to "Our activities". Only these
 * fields are ever public: title, purpose, date, group, and the collage.
 */
const publishPost = async (ctx, b) => {
  requireAdmin(ctx);
  const id = str(b.meetingId, 80);
  const post = await getDoc(ctx.env, `meeting_posts/${id}`);
  if (!post || post.status !== 'pending') throw new HttpError(404, 'This post is not waiting for review.');
  const imageRef = str(b.imageRef, 120);
  if (!/^media:img-[a-z0-9-]{6,80}$/.test(imageRef) || !(await getDoc(ctx.env, `media/${imageRef.slice(6)}`))) throw new HttpError(400, 'The photo collage was not saved. Please try again.');
  const title = str(b.title, 160);
  if (title.length < 3) throw new HttpError(400, 'The post needs a title.');
  const at = now();
  await commit(ctx.env, [
    { set: `activity_posts/${id}`, data: {
      id, source: 'meeting', title, purpose: str(b.purpose, 400), date: post.date, groupName: b.showGroup === false ? '' : post.roomName,
      imageRef, attendeeCount: (post.attendees || []).length, status: 'published', publishedAt: at, publishedBy: ctx.who.uid,
    } },
    { update: `meeting_posts/${id}`, data: { status: 'published', reviewedBy: ctx.who.uid, reviewedAt: at } },
  ]);
  await audit(ctx, 'post_published', { meetingId: id, roomId: post.roomId, detail: title });
  return { ok: true };
};

const dismissPost = async (ctx, b) => {
  requireAdmin(ctx);
  const id = str(b.meetingId, 80);
  await commit(ctx.env, [{ update: `meeting_posts/${id}`, data: { status: 'dismissed', reviewedBy: ctx.who.uid, reviewedAt: now() } }]);
  await audit(ctx, 'post_dismissed', { meetingId: id });
  return { ok: true };
};

// ---------------------------------------------------------------- reminders (cron)

/** Every few minutes: reminders, and closing meetings left running long after their end. */
export const runSchedule = async (env) => {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return { skipped: 'no service account' };
  const settings = L.settingsFrom(await getDoc(env, 'site_settings/meetings'));
  const soon = new Date(Date.now() + Math.max(...settings.reminders, 10) * 60000 + 60000).toISOString();
  const [scheduled, live, chapters, roomDocs] = await Promise.all([
    queryDocs(env, 'meetings', { where: [['status', '==', 'scheduled']] }).then((list) => list.filter((m) => m.startAt <= soon)),
    queryDocs(env, 'meetings', { where: [['status', '==', 'live']] }),
    councilsOf(env),
    queryDocs(env, 'meeting_rooms'),
  ]);
  const docs = Object.fromEntries(roomDocs.map((d) => [d.id, d]));
  const rooms = L.roomsFor(chapters, docs);
  let members = null;
  let sent = 0;
  for (const m of scheduled) {
    const due = L.dueReminders(m, settings);
    if (!due.length) continue;
    const room = rooms.find((r) => r.id === m.roomId);
    if (!room) continue;
    if (!members) {
      const [list, seats] = await Promise.all([queryDocs(env, 'members'), queryDocs(env, 'org_assignments').catch(() => [])]);
      members = list.map((x) => ({ ...x, held: seats.filter((a) => a.memberId === x.id).map((a) => a.positionId) }));
    }
    const label = L.reminderLabel(due[0]);
    // Mark every reminder up to this one as sent, then send it.
    const marks = Object.fromEntries(settings.reminders.filter((x) => x >= due[0]).map((x) => [`remindersSent.${x}`, true]));
    await commit(env, [{ update: `meetings/${m.id}`, data: marks }]);
    sent += await notifyMeeting(env, members, room, m, 'reminder', L.leaderOf(room, docs[room.id], members).uid, `in ${label}`);
  }
  // A meeting left "live" 6 hours after its planned end is closed automatically.
  for (const m of live) {
    if (Date.parse(m.startedAt || m.startAt) + ((m.durationMin || 60) + 360) * 60000 > Date.now()) continue;
    await liveRoom(env, m.id, 'end', {}).catch(() => null);
    await commit(env, [{ update: `meetings/${m.id}`, data: { status: 'ended', endedAt: new Date(Date.parse(m.startedAt || m.startAt) + (m.durationMin || 60) * 60000).toISOString(), endedBy: 'system', updatedAt: now() } }]);
  }
  return { sent };
};

// ---------------------------------------------------------------- router

export const handleMeetings = async (request, env) => {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/meetings\/?/, '');
  const method = request.method;
  try {
    if (route === 'status' && method === 'GET') {
      // Set-up check: which settings the running website can see (names only, never values).
      const expected = ['FIREBASE_SERVICE_ACCOUNT', 'SFU_APP_ID', 'SFU_APP_TOKEN', 'TURN_KEY_ID', 'TURN_KEY_API_TOKEN'];
      const present = Object.fromEntries(expected.map((k) => [k, typeof env[k] === 'string' && env[k].trim().length > 0]));
      const similar = Object.keys(env).filter((k) => /firebase|sfu|turn|realtime|service/i.test(k) && !expected.includes(k));
      let database = { ok: false, error: present.FIREBASE_SERVICE_ACCOUNT ? '' : 'FIREBASE_SERVICE_ACCOUNT is not set on the running website.' };
      if (present.FIREBASE_SERVICE_ACCOUNT) database = await checkDatabase(env);
      return json({ database: database.ok, databaseError: database.ok ? '' : database.error, video: await videoReady(env), present, similar });
    }
    if (route.startsWith('sfu/')) return handleSfu(request, env);
    if (route === 'ws') {
      // The live connection. The seat (issued by "join") proves who this is.
      const seat = await readSeat(env, url.searchParams.get('seat'));
      if (!seat) return json({ error: 'Your meeting pass has expired. Please rejoin.' }, 401);
      const headers = new Headers(request.headers);
      headers.set('x-seat', JSON.stringify({ uid: seat.uid, name: seat.name, photo: seat.photo, role: seat.role, host: seat.host }));
      return roomStub(env, seat.mid).fetch('https://room/ws', { headers });
    }
    const ctx = A.withCommit(await contextFor(env, request), env);
    let body = {};
    if (method === 'POST') {
      try { body = await request.json(); } catch { throw new HttpError(400, 'Invalid request.'); }
    }
    const q = (k) => url.searchParams.get(k) || '';
    const routes = {
      'GET overview': () => overview(ctx),
      'GET room': () => roomDetail(ctx, q('id')),
      'GET meeting': () => meetingDetail(ctx, q('id')),
      'GET attendance': () => attendance(ctx, q('id')),
      'GET mine': () => mine(ctx),
      'GET admin': () => adminView(ctx),
      'GET access-check': () => accessCheck(ctx, q('uid')),
      'GET minutes': () => minutesOf(ctx, q('id')),
      'POST minutes': () => saveMinutes(ctx, body),
      'POST notice': () => postNotice(ctx, body),
      'POST notice-delete': () => deleteNotice(ctx, body),
      'GET room-report': () => roomReport(ctx, q('id')),
      'POST schedule': () => schedule(ctx, body),
      'POST update': () => update(ctx, body),
      'POST cancel': () => cancel(ctx, body),
      'POST start': () => start(ctx, body),
      'POST join': () => join(ctx, body),
      'POST lock': () => lock(ctx, body),
      'POST end': () => end(ctx, body),
      'POST remove': () => remove(ctx, body),
      'POST attendance': () => confirmAttendance(ctx, body),
      'POST correct': () => correct(ctx, body),
      'POST room-settings': () => roomSettings(ctx, body),
      'POST publish-post': () => publishPost(ctx, body),
      'GET my-activities': () => A.myActivities(ctx),
      'GET participation': () => A.participationView(ctx, q('activityId')),
      'POST participation': () => A.saveParticipation(ctx, body),
      'GET appreciation-admin': () => A.appreciationAdmin(ctx),
      'POST appreciation-review': () => A.review(ctx, body),
      'POST appreciation-revoke': () => A.revoke(ctx, body),
      'POST dismiss-post': () => dismissPost(ctx, body),
      'POST recalculate': async () => { requireAdmin(ctx); return recalcPoints(env, str(body.uid, 128), ctx.who.uid); },
    };
    const fn = routes[`${method} ${route}`];
    if (!fn) return json({ error: 'Not found' }, 404);
    return json(await fn());
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof SetupError || e?.setup) return json({ error: e.message, setup: true }, 503);
    console.error('meetings', e?.stack || e);
    return json({ error: 'Something went wrong on the server. Please try again in a moment.' }, 500);
  }
};
