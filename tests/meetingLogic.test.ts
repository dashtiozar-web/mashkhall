import { describe, expect, it } from 'vitest';
import * as Logic from '../worker/meetingLogic.js';

// The rules are plain JavaScript shared with the server; checked here by behaviour.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Logic;

const m = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: 'active', chapterId: 'erbil', positionId: 'member', ...extra });
const rooms = L.roomsFor([{ id: 'erbil', name: 'Erbil' }, { id: 'britain', name: 'Britain' }]);
const erbil = rooms.find((r: { id: string }) => r.id === 'council-erbil');
const britain = rooms.find((r: { id: string }) => r.id === 'council-britain');
const board = rooms.find((r: { id: string }) => r.id === 'board');
const joint = rooms.find((r: { id: string }) => r.id === 'joint');

describe('meeting room access', () => {
  it('lets a council member into their own council room only', () => {
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: erbil }).allowed).toBe(true);
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: britain }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: board }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: joint }).allowed).toBe(false);
  });

  it('refuses visitors, suspended members and imported records', () => {
    expect(L.accessFor({ uid: 'v', member: null, isAdmin: false, room: erbil }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'a', member: m('a', { status: 'suspended' }), isAdmin: false, room: erbil }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'mem-1', member: m('mem-1'), isAdmin: false, room: erbil }).allowed).toBe(false);
  });

  it('lets the President and Deputy President into all eleven rooms as hosts', () => {
    const all = L.roomsFor(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id })));
    expect(all).toHaveLength(11);
    expect(all.map((r: { id: string }) => r.id).slice(6)).toEqual(['board', 'joint', 'research', 'production', 'webadmin']);
    for (const positionId of ['president', 'deputy_president']) {
      for (const room of all) {
        const r = L.accessFor({ uid: 's', member: m('s', { positionId, chapterId: 'x' }), isAdmin: false, room });
        expect(r.allowed && r.host).toBe(true);
      }
    }
  });

  it('keeps other Board members to the Board and joint rooms, and council leaders to the joint room', () => {
    const finance = m('f', { positionId: 'head_of_finance', chapterId: 'britain' });
    expect(L.accessFor({ uid: 'f', member: finance, isAdmin: false, room: board }).allowed).toBe(true);
    expect(L.accessFor({ uid: 'f', member: finance, isAdmin: false, room: joint }).allowed).toBe(true);
    expect(L.accessFor({ uid: 'f', member: finance, isAdmin: false, room: erbil }).allowed).toBe(false);
    const leader = m('l', { positionId: 'council_leader' });
    expect(L.accessFor({ uid: 'l', member: leader, isAdmin: false, room: joint }).allowed).toBe(true);
    expect(L.accessFor({ uid: 'l', member: leader, isAdmin: false, room: board }).allowed).toBe(false);
  });

  it('makes the appointed leader host of their own room only, unless suspended', () => {
    const lead = { uid: 'a', suspended: false, permissions: {} };
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: erbil, leader: lead }).host).toBe(true);
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: britain, leader: { uid: 'z' } }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: erbil, leader: { ...lead, suspended: true } }).host).toBe(false);
  });

  it('respects a selected-members invitation list', () => {
    const meeting = { invite: 'selected', invitees: ['b'] };
    expect(L.accessFor({ uid: 'a', member: m('a'), isAdmin: false, room: erbil, meeting }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'b', member: m('b'), isAdmin: false, room: erbil, meeting }).allowed).toBe(true);
    expect(L.eligibleMembers([m('a'), m('b')], erbil, meeting).map((x: { id: string }) => x.id)).toEqual(['b']);
  });

  it('chooses the Head of Online Meeting Management as default leader, then the Council Leader', () => {
    const members = [m('x', { positionId: 'council_leader' }), m('y', { positionId: 'head_of_online_meetings' })];
    expect(L.leaderOf(erbil, null, members).uid).toBe('y');
    expect(L.leaderOf(erbil, null, [members[0]]).uid).toBe('x');
    expect(L.leaderOf(erbil, { leaderUid: 'q' }, members).uid).toBe('q');
    expect(L.leaderOf(erbil, { leaderUid: 'q', leaderSuspended: true }, members).permissions.start).toBe(false);
    expect(L.leaderOf(erbil, { leaderPermissions: { remove: false } }, members).permissions.remove).toBe(false);
  });
});

describe('attendance', () => {
  const meeting = { startAt: '2026-11-01T18:00:00Z', startedAt: '2026-11-01T18:00:00Z', endedAt: '2026-11-01T19:00:00Z', durationMin: 60 };
  const eligible = [m('a'), m('b'), m('c'), m('d')];

  it('counts real connected time, joins overlapping connections and applies the threshold', () => {
    const joined = [
      { uid: 'a', intervals: [['2026-11-01T18:00:00Z', '2026-11-01T18:40:00Z'], ['2026-11-01T18:30:00Z', '2026-11-01T19:00:00Z']] },
      { uid: 'b', intervals: [['2026-11-01T18:20:00Z', '2026-11-01T19:00:00Z']] },
      { uid: 'c', intervals: [['2026-11-01T18:00:00Z', '2026-11-01T18:10:00Z']] },
      { uid: 'guest', intervals: [['2026-11-01T18:00:00Z', '2026-11-01T19:00:00Z']] },
    ];
    const r = L.measureAttendance({ eligible, joined, meeting, settings: { thresholdPercent: 50, lateMinutes: 10 } });
    const by = Object.fromEntries(r.rows.map((x: { uid: string }) => [x.uid, x]));
    expect(by.a).toMatchObject({ minutes: 60, status: 'attended' });
    expect(by.b).toMatchObject({ minutes: 40, status: 'late' });
    expect(by.c).toMatchObject({ minutes: 10, status: 'absent' });
    expect(by.d).toMatchObject({ minutes: 0, status: 'absent' });
    expect(by.guest.eligible).toBe(false);
  });
});

describe('meeting points', () => {
  const h = (n: number, status: string) => ({ meetingId: `m${n}`, startAt: `2026-0${n}-01T18:00:00Z`, status });
  const total = (entries: { points: number }[]) => entries.reduce((s, e) => s + e.points, 0);

  it('gives 30 per meeting and 10 extra for three in a row (100 for three)', () => {
    const e = L.meetingPointsFor('u', [h(1, 'attended'), h(2, 'attended'), h(3, 'late')]);
    expect(total(e)).toBe(100);
    expect(e.filter((x: { type: string }) => x.type === 'meeting_streak_bonus')).toHaveLength(1);
  });

  it('takes 15 once for two missed in a row, not again for the same run', () => {
    const e = L.meetingPointsFor('u', [h(1, 'absent'), h(2, 'absent'), h(3, 'absent'), h(4, 'absent')]);
    expect(e).toHaveLength(1);
    expect(total(e)).toBe(-15);
  });

  it('starts a new run of absences after attending', () => {
    const e = L.meetingPointsFor('u', [h(1, 'absent'), h(2, 'absent'), h(3, 'attended'), h(4, 'absent'), h(5, 'absent')]);
    expect(e.filter((x: { type: string }) => x.type === 'meeting_absence_penalty')).toHaveLength(2);
  });

  it('ignores excused absences: no penalty, and the attendance run continues', () => {
    expect(total(L.meetingPointsFor('u', [h(1, 'absent'), h(2, 'excused'), h(3, 'attended')]))).toBe(30);
    const e = L.meetingPointsFor('u', [h(1, 'attended'), h(2, 'excused'), h(3, 'attended'), h(4, 'attended')]);
    expect(total(e)).toBe(100);
  });

  it('resets the run when a meeting is missed', () => {
    const e = L.meetingPointsFor('u', [h(1, 'attended'), h(2, 'attended'), h(3, 'absent'), h(4, 'attended')]);
    expect(e.some((x: { type: string }) => x.type === 'meeting_streak_bonus')).toBe(false);
  });

  it('never pays twice, and reverses awards that no longer apply', () => {
    const expected = L.meetingPointsFor('u', [h(1, 'attended')]);
    const ledger = [{ id: 'u__meeting_attendance__m1', type: 'meeting_attendance', points: 30 }];
    expect(L.reconcile('u', expected, ledger)).toEqual({ add: [], reverse: [] });
    const after = L.reconcile('u', L.meetingPointsFor('u', [h(1, 'excused')]), ledger);
    expect(after.reverse.map((e: { id: string }) => e.id)).toEqual(['u__meeting_attendance__m1']);
    const reversed = [...ledger, { id: 'u__correction__reverse:u__meeting_attendance__m1', type: 'correction', targetId: 'reverse:u__meeting_attendance__m1', points: -30 }];
    const again = L.reconcile('u', expected, reversed);
    expect(again.add.map((e: { id: string }) => e.id)).toEqual(['u__meeting_attendance__m1~2']);
  });
});

describe('schedule', () => {
  it('repeats monthly on the same day, or the last day of a shorter month', () => {
    expect(L.nextMonthly('2026-01-31T18:00:00.000Z')).toBe('2026-02-28T18:00:00.000Z');
    expect(L.nextMonthly('2026-11-15T19:30:00.000Z')).toBe('2026-12-15T19:30:00.000Z');
  });

  it('sends only the most urgent reminder that is due and not yet sent', () => {
    const start = Date.parse('2026-11-01T18:00:00Z');
    const meeting = { status: 'scheduled', startAt: '2026-11-01T18:00:00Z', remindersSent: { 1440: true } };
    expect(L.dueReminders(meeting, null, start - 30 * 60000)).toEqual([60]);
    expect(L.dueReminders(meeting, null, start - 5 * 60000)).toEqual([10]);
    expect(L.dueReminders({ ...meeting, remindersSent: { 1440: true, 60: true, 10: true } }, null, start - 5 * 60000)).toEqual([]);
    expect(L.dueReminders({ ...meeting, status: 'cancelled' }, null, start - 5 * 60000)).toEqual([]);
  });
});

describe('separate rooms for every group (tests 5–8)', () => {
  const all = L.roomsFor([{ id: 'erbil', name: 'Erbil' }, { id: 'britain', name: 'Britain' }]);
  const room = (id: string) => all.find((r: { id: string }) => r.id === id);
  const can = (member: Record<string, unknown>, id: string, r = room(id)) => L.accessFor({ uid: member.id, member, isAdmin: false, room: r }).allowed;

  it('the Head of Media enters the Board, Production Team and their own council, and nothing else', () => {
    const hom = m('h', { positionId: 'head_of_media', chapterId: 'britain' });
    expect(can(hom, 'board')).toBe(true);
    expect(can(hom, 'production')).toBe(true);
    expect(can(hom, 'council-britain')).toBe(true);
    expect(can(hom, 'council-erbil')).toBe(false);
    expect(can(hom, 'research')).toBe(false);
    expect(can(hom, 'webadmin')).toBe(false);
    // …unless an administrator adds them.
    const research = L.roomsFor([], { research: { members: ['h'] } }).find((r: { id: string }) => r.id === 'research');
    expect(can(hom, 'research', research)).toBe(true);
  });

  it('Research and Investigation is confidential: its head, and people added by name only', () => {
    expect(can(m('r', { positionId: 'research_manager' }), 'research')).toBe(true);
    expect(can(m('p', { positionId: 'head_of_public_relations' }), 'research')).toBe(false);
    expect(can(m('x'), 'research')).toBe(false);
    const withMember = L.roomsFor([], { research: { members: ['x'] } }).find((r: { id: string }) => r.id === 'research');
    expect(can(m('x'), 'research', withMember)).toBe(true);
    expect(can(m('y'), 'research', withMember)).toBe(false);
  });

  it('Production Team and Website Administration rooms follow positions, including second positions', () => {
    expect(can(m('v', { positionId: 'video_editor' }), 'production')).toBe(true);
    expect(can(m('w', { positionId: 'web_support' }), 'webadmin')).toBe(true);
    expect(can(m('w', { positionId: 'web_support' }), 'production')).toBe(false);
    // A council photographer who is also the Production Team's video editor.
    expect(can(m('c', { positionId: 'council_photographer', held: ['council_photographer', 'video_editor'] }), 'production')).toBe(true);
    expect(can(m('c', { positionId: 'council_photographer' }), 'production')).toBe(false);
  });

  it('an administrator can remove someone from a room even if their position would allow them', () => {
    const r = L.roomsFor([{ id: 'britain', name: 'Britain' }], { 'council-britain': { excluded: ['a'] } }).find((x: { id: string }) => x.id === 'council-britain');
    const a = m('a', { chapterId: 'britain' });
    expect(L.accessFor({ uid: 'a', member: a, isAdmin: false, room: r }).allowed).toBe(false);
    expect(L.accessFor({ uid: 'a', member: a, isAdmin: false, room: r }).reason).toMatch(/removed/);
    expect(L.accessFor({ uid: 'admin', member: null, isAdmin: true, room: r }).allowed).toBe(true);
  });

  it('a Council Leader runs their own council’s meetings; moderators chosen by an administrator too', () => {
    const lon = room('council-britain');
    const cl = m('cl', { positionId: 'council_leader', chapterId: 'britain' });
    const hom = m('ho', { positionId: 'head_of_online_meetings', chapterId: 'britain' });
    const leader = L.leaderOf(lon, null, [cl, hom]);
    expect(leader.uid).toBe('ho');
    expect(leader.managers).toEqual(['cl']);
    const a = L.accessFor({ uid: 'cl', member: cl, isAdmin: false, room: lon, leader });
    expect(a).toMatchObject({ allowed: true, host: true, role: 'moderator' });
    expect(L.canManage(a, leader, 'schedule')).toBe(true);
    const erbilLeader = L.leaderOf(room('council-erbil'), null, [cl, hom]);
    expect(L.accessFor({ uid: 'cl', member: cl, isAdmin: false, room: room('council-erbil'), leader: erbilLeader }).allowed).toBe(false);
    const prod = L.roomsFor([], { production: { moderators: ['z'] } }).find((r: { id: string }) => r.id === 'production');
    const z = m('z');
    const pl = L.leaderOf(prod, { leaderPermissions: { remove: false } }, [z]);
    const za = L.accessFor({ uid: 'z', member: z, isAdmin: false, room: prod, leader: pl });
    expect(za.role).toBe('moderator');
    expect(L.canManage(za, pl, 'remove')).toBe(false);
  });

  it('explains to administrators why someone can or cannot enter', () => {
    const e = L.explainAccess(m('a', { chapterId: 'britain' }), room('council-erbil'), null, false);
    expect(e.allowed).toBe(false);
    expect(e.why.join(' ')).toMatch(/different council/);
  });
});
