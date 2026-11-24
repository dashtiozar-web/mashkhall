/**
 * The meetings server (worker/meetings.js) against an in-memory database:
 * a member cannot reach another group's meetings by changing the address or
 * calling the server directly (acceptance tests 5–8).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installFakeFirestore, Fake } from './helpers/fakeFirestore';
import { handleMeetings } from '../worker/meetings.js';

let fake: Fake;
const tokens: Record<string, string> = {};
const call = async (path: string, body?: unknown, as = 'owner') => {
  const res = await handleMeetings(new Request(`https://17shubat.org.uk/api/meetings/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${tokens[as] || ''}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ...fake.env, SFU_APP_ID: 'x', SFU_APP_TOKEN: 'y' });
  return { status: res.status, data: await res.json() as any };
};
const member = (id: string, extra: Record<string, unknown> = {}) => ({ userId: id, fullName: id, displayName: id, status: 'active', chapterId: 'london', positionId: 'member', ...extra });
const future = new Date(Date.now() + 86400000).toISOString();

beforeAll(async () => {
  fake = await installFakeFirestore();
  for (const u of ['owner', 'hom', 'ana', 'rex', 'pat', 'cl']) tokens[u] = await fake.idToken(u === 'owner' ? 'owner-uid' : u, u === 'owner' ? 'dashtiozar@gmail.com' : `${u}@example.org`, true);
});
afterAll(() => fake.restore());
beforeEach(() => {
  fake.docs.clear();
  fake.set('chapters/london', { name: 'London', order: 1 });
  fake.set('chapters/manchester', { name: 'Manchester', order: 2 });
  fake.set('members/owner-uid', member('owner-uid', { positionId: 'deputy_president' }));
  fake.set('members/hom', member('hom', { positionId: 'head_of_media' }));
  fake.set('members/ana', member('ana', { chapterId: 'manchester' }));
  fake.set('members/rex', member('rex', { positionId: 'research_manager' }));
  fake.set('members/pat', member('pat', { positionId: 'video_editor', chapterId: 'manchester' }));
  fake.set('members/cl', member('cl', { positionId: 'council_leader' }));
  fake.set('org_assignments/council__london__council_leader', { unit: 'council', positionId: 'council_leader', councilId: 'london', memberId: 'cl', memberName: 'cl' });
  for (const [id, roomId] of [['m-research', 'research'], ['m-production', 'production'], ['m-board', 'board'], ['m-london', 'council-london'], ['m-webadmin', 'webadmin']]) {
    fake.set(`meetings/${id}`, { id, roomId, title: `${roomId} meeting`, startAt: future, durationMin: 60, status: 'scheduled', invite: 'all' });
  }
});

describe('meeting rooms and access through the server', () => {
  it('each group has its own room; the administrator sees all of them (tests 5, 7)', async () => {
    const r = await call('overview');
    expect(r.status).toBe(200);
    // All six councils have a room, including built-in ones never saved in the database.
    expect(r.data.rooms.map((x: { id: string }) => x.id)).toEqual(['council-london', 'council-birmingham', 'council-manchester', 'council-newcastle', 'council-glasgow', 'council-cardiff', 'board', 'joint', 'research', 'production', 'webadmin']);
    expect(r.data.upcoming).toHaveLength(5);
  });

  it('the Head of Media sees Board, Production and their own council only (test 8)', async () => {
    const r = await call('overview', undefined, 'hom');
    expect(r.data.rooms.map((x: { id: string }) => x.id).sort()).toEqual(['board', 'council-london', 'joint', 'production']);
    expect((await call('meeting?id=m-research', undefined, 'hom')).status).toBe(403);
    expect((await call('meeting?id=m-webadmin', undefined, 'hom')).status).toBe(403);
    expect((await call('meeting?id=m-production', undefined, 'hom')).status).toBe(200);
  });

  it('a member cannot open, join or read the minutes of another group’s meeting by changing the address (test 6)', async () => {
    for (const id of ['m-research', 'm-board', 'm-london', 'm-production']) {
      expect((await call(`meeting?id=${id}`, undefined, 'ana')).status).toBe(403);
      expect((await call('join', { id }, 'ana')).status).toBe(403);
      expect((await call(`minutes?id=${id}`, undefined, 'ana')).status).toBe(403);
    }
    expect((await call('room?id=research', undefined, 'ana')).status).toBe(403);
    expect((await call('room-report?id=council-london', undefined, 'ana')).status).toBe(403);
    expect((await call('schedule', { roomId: 'research', title: 'Sneaky', startAt: future, durationMin: 30 }, 'ana')).status).toBe(403);
    expect(fake.list('meeting_audit').some((a: any) => a.ok === false && a.uid === 'ana')).toBe(true);
  });

  it('administrators add people to a room by name, and can check why someone can or cannot enter', async () => {
    expect((await call('room?id=research', undefined, 'pat')).status).toBe(403);
    const s = await call('room-settings', { roomId: 'research', members: ['pat'] });
    expect(s.status).toBe(200);
    expect((await call('room?id=research', undefined, 'pat')).status).toBe(200);
    expect((await call('room-settings', { roomId: 'research', members: ['nobody'] })).status).toBe(400);
    const c = await call('access-check?uid=ana');
    expect(c.status).toBe(200);
    const research = c.data.rooms.find((r: { id: string }) => r.id === 'research');
    expect(research.allowed).toBe(false);
    expect(c.data.rooms.find((r: { id: string }) => r.id === 'council-manchester').allowed).toBe(true);
    expect((await call('access-check?uid=ana', undefined, 'pat')).status).toBe(403);
  });

  it('a Council Leader runs their council’s meetings: notices, minutes and action points', async () => {
    const n = await call('notice', { roomId: 'council-london', title: 'Next protest plan', body: 'Read before Friday', link: 'https://drive.google.com/file/d/abc' }, 'cl');
    expect(n.status).toBe(200);
    expect((await call('notice', { roomId: 'council-manchester', title: 'Not mine' }, 'cl')).status).toBe(403);
    const room = await call('room?id=council-london', undefined, 'hom');
    expect(room.data.notices[0]).toMatchObject({ title: 'Next protest plan', kind: 'document' });
    const save = await call('minutes', { id: 'm-london', text: 'We agreed the plan.', decisions: 'Hold the event on 1 December.', actions: [{ text: 'Book the hall', owner: 'hom', due: '2026-11-20' }] }, 'cl');
    expect(save.status).toBe(200);
    const read = await call('minutes?id=m-london', undefined, 'hom');
    expect(read.data.minutes).toMatchObject({ decisions: 'Hold the event on 1 December.' });
    expect(read.data.minutes.actions[0]).toMatchObject({ text: 'Book the hall', owner: 'hom', status: 'open' });
    expect(read.data.canEdit).toBe(false);
    expect((await call('minutes', { id: 'm-london', text: 'changed' }, 'hom')).status).toBe(403);
    expect(fake.list('user_notifications').some((x: any) => x.userId === 'hom' && /Action point/.test(x.title))).toBe(true);
  });
});
