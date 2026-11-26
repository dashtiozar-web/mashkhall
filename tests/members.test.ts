/**
 * The member records, positions and card verification server
 * (worker/members.js), run against an in-memory database. These are the
 * acceptance tests for editing members, promotions and digital IDs.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installFakeFirestore, Fake } from './helpers/fakeFirestore';
import { handleMembers } from '../worker/members.js';

let fake: Fake;
const OWNER_UID = 'owner-uid';
const tokens: Record<string, string> = {};

const call = async (path: string, body?: unknown, as = 'owner') => {
  const res = await handleMembers(new Request(`https://mashkhall.com/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${tokens[as] || ''}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), fake.env);
  return { status: res.status, data: await res.json() as any };
};

const member = (id: string, extra: Record<string, unknown> = {}) => ({
  userId: id, fullName: `${id} Full`, displayName: id, email: `${id}@example.org`, chapterId: 'britain',
  tier: 'peshang', status: 'active', roles: ['member'], consentToDirectory: true, joinedAt: '2024-01-01', updatedAt: '2026-01-01T00:00:00.000Z', ...extra,
});

beforeAll(async () => {
  fake = await installFakeFirestore();
  tokens.owner = await fake.idToken(OWNER_UID, 'dashtiozar@gmail.com', true);
  tokens.impostor = await fake.idToken('impostor', 'dashtiozar@gmail.com', false);
  tokens.carol = await fake.idToken('carol');
  tokens.reviewer = await fake.idToken('reviewer');
  tokens.alice = await fake.idToken('alice');
});
afterAll(() => fake.restore());

beforeEach(() => {
  fake.docs.clear();
  fake.set('chapters/britain', { name: 'Britain', order: 1, isArchived: false });
  fake.set('chapters/erbil', { name: 'Erbil', order: 2, isArchived: false });
  fake.set(`users/${OWNER_UID}`, { uid: OWNER_UID, roles: ['owner'], displayName: 'Owner' });
  fake.set(`members/${OWNER_UID}`, member(OWNER_UID, { fullName: 'Dashti Othman Rasul', positionId: 'deputy_president' }));
  fake.set('users/reviewer', { uid: 'reviewer', roles: ['member', 'membership_reviewer'] });
  fake.set('users/carol', { uid: 'carol', roles: ['member'] });
  fake.set('members/carol', member('carol'));
  fake.set('users/alice', { uid: 'alice', roles: ['member'], displayName: 'alice', permissions: [] });
  fake.set('members/alice', member('alice', { positionId: 'media_corner_member', designation: 'Media and Communications Corner Member', memberNumber: 'M0000005', credentialIssuedAt: '2025-01-01', validFrom: '2025-01-01', expiresAt: '2099-01-01', verifyUrl: 'https://mashkhall.com/#/people/M0000005' }));
  fake.set('public_profiles/alice', { id: 'alice', userId: 'alice', displayName: 'alice', chapterId: 'britain', chapterName: 'Britain', positionId: 'media_corner_member', designation: 'Media and Communications Corner Member' });
  fake.set('verifications/M0000005', { id: 'M0000005', memberNumber: 'M0000005', name: 'alice Full', designation: 'Media and Communications Corner Member', status: 'active' });
  fake.set('org_assignments/council__britain__media_corner_member__1', { id: 'council__britain__media_corner_member__1', unit: 'council', positionId: 'media_corner_member', councilId: 'britain', seat: 1, memberId: 'alice', memberName: 'alice' });
});

describe('Editing a member updates every place they appear (tests 1, 10, 13)', () => {
  it('saves the details and refreshes the directory, the chart, the card record and the account', async () => {
    const r = await call('members/update', { memberId: 'alice', changes: { fullName: 'Alice Kareem', displayName: 'Alice K.', photoUrl: 'data:image/jpeg;base64,AAAA' } });
    expect(r.status).toBe(200);
    expect(r.data.changed.sort()).toEqual(['displayName', 'fullName', 'photoUrl']);
    expect(fake.get('members/alice')).toMatchObject({ fullName: 'Alice Kareem', displayName: 'Alice K.', photoUrl: 'data:image/jpeg;base64,AAAA' });
    expect(fake.get('public_profiles/alice')).toMatchObject({ displayName: 'Alice K.', photoUrl: 'data:image/jpeg;base64,AAAA', designation: 'Media and Communications Corner Member' });
    expect(fake.get('verifications/M0000005')).toMatchObject({ name: 'Alice Kareem', designation: 'Media and Communications Corner Member', status: 'active' });
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toMatchObject({ memberName: 'Alice K.' });
    expect(fake.get('users/alice')).toMatchObject({ displayName: 'Alice K.' });
  });

  it('records who changed what, and from what to what', async () => {
    await call('members/update', { memberId: 'alice', changes: { phone: '07000 000000' }, reason: 'Member asked' });
    const log = fake.list('audit_logs')[0] as any;
    expect(log).toMatchObject({ actorUid: OWNER_UID, action: 'MEMBER_DETAILS_UPDATED', targetId: 'alice' });
    expect(log.changes).toEqual([{ field: 'phone', from: '(empty)', to: '07000 000000' }]);
    expect(log.details).toContain('Member asked');
  });

  it('never reports success when the database refuses the write, and changes nothing (test 14)', async () => {
    const before = structuredClone(fake.get('members/alice'));
    fake.failNextCommit = true;
    const r = await call('members/update', { memberId: 'alice', changes: { fullName: 'Should Not Save' } });
    expect(r.status).toBe(502);
    expect(r.data.error).toMatch(/could not be saved/i);
    expect(fake.get('members/alice')).toEqual(before);
    expect(fake.get('public_profiles/alice')?.displayName).toBe('alice');
  });

  it('refuses a save made from an out-of-date copy', async () => {
    const r = await call('members/update', { memberId: 'alice', changes: { phone: '1' }, expectUpdatedAt: '2020-01-01T00:00:00.000Z' });
    expect(r.status).toBe(409);
  });

  it('refuses invalid values with a clear message', async () => {
    expect((await call('members/update', { memberId: 'alice', changes: { email: 'not-an-email' } })).data.error).toMatch(/email/);
    expect((await call('members/update', { memberId: 'alice', changes: { chapterId: 'atlantis' } })).status).toBe(400);
    expect((await call('members/update', { memberId: 'alice', changes: { roles: ['owner'] } })).status).toBe(400);
  });

  it('only staff can edit members; an unverified copy of the owner email gets nothing', async () => {
    expect((await call('members/update', { memberId: 'alice', changes: { phone: '1' } }, 'carol')).status).toBe(403);
    expect((await call('members/update', { memberId: 'alice', changes: { phone: '1' } }, 'impostor')).status).toBe(403);
    expect((await call('members/update', { memberId: 'alice', changes: { phone: '1' } }, 'nobody')).status).toBe(401);
    expect((await call('members/update', { memberId: 'alice', changes: { phone: '1' } }, 'reviewer')).status).toBe(200);
  });

  it('moving a member to another council frees their old council positions and records it', async () => {
    const r = await call('members/update', { memberId: 'alice', changes: { chapterId: 'erbil' } });
    expect(r.status).toBe(200);
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toBeUndefined();
    expect(fake.get('members/alice')).toMatchObject({ chapterId: 'erbil', positionId: 'member', designation: 'Member' });
    expect(fake.get('public_profiles/alice')).toMatchObject({ chapterId: 'erbil', chapterName: 'Erbil', designation: 'Member' });
    expect(fake.list('position_history')[0]).toMatchObject({ memberId: 'alice', action: 'transferred', to: 'Erbil Council' });
  });

  it('a member can edit their own profile text and photo, and nothing official', async () => {
    const r = await call('members/self', { displayName: 'Ali', bio: 'Hello', fullName: 'Hacked', positionId: 'president' }, 'alice');
    expect(r.status).toBe(200);
    expect(fake.get('members/alice')).toMatchObject({ displayName: 'Ali', bio: 'Hello', fullName: 'alice Full', positionId: 'media_corner_member' });
    expect(fake.get('public_profiles/alice')).toMatchObject({ displayName: 'Ali', bio: 'Hello' });
  });
});

describe('Older titles', () => {
  it('a title given before positions were appointed is kept when other details change', async () => {
    fake.set('members/dina', member('dina', { positionId: 'head_of_public_relations', designation: 'Head of Public Relations' }));
    await call('members/update', { memberId: 'dina', changes: { phone: '1' } });
    expect(fake.get('members/dina')).toMatchObject({ positionId: 'head_of_public_relations', designation: 'Head of the Public Relations Centre' });
    await call('members/resync', { memberIds: ['dina'] });
    expect(fake.get('members/dina')).toMatchObject({ positionId: 'head_of_public_relations' });
    expect(fake.get('public_profiles/dina')).toMatchObject({ designation: 'Head of the Public Relations Centre', displayName: 'dina' });
  });
});

describe('Promotions and positions (test 2)', () => {
  it('only Pêşeng members can be appointed, and holders cannot leave Pêşeng', async () => {
    fake.set('members/carol', member('carol', { tier: 'komar' }));
    const no = await call('members/appoint', { seatId: 'production__video_editor', memberId: 'carol' });
    expect(no.status).toBe(409);
    expect(no.data.error).toMatch(/Pêşeng/);
    await call('members/appoint', { seatId: 'production__video_editor', memberId: 'alice', keepOtherPositions: true });
    const leave = await call('members/update', { memberId: 'alice', changes: { tier: 'pishtiwan' } });
    expect(leave.status).toBe(409);
    // Kinds of membership are private: kept in member_tiers, never on the public profile.
    await call('members/resync', { memberIds: ['carol'] });
    expect(fake.get('member_tiers/carol')).toMatchObject({ tier: 'komar' });
    expect(fake.get('public_profiles/carol')?.tier).toBeUndefined();
  });

  it('a Photographer promoted to Media Supervisor leaves the Photographer seat and shows under Media Supervisor', async () => {
    const r = await call('members/appoint', { seatId: 'council__britain__media_supervisor', memberId: 'alice', reason: 'Excellent coverage', effectiveDate: '2026-11-01' });
    expect(r.status).toBe(200);
    expect(r.data.action).toBe('promoted');
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toBeUndefined();
    expect(fake.get('org_assignments/council__britain__media_supervisor')).toMatchObject({ memberId: 'alice', positionId: 'media_supervisor', councilId: 'britain', status: 'active', effectiveDate: '2026-11-01' });
    expect(fake.get('members/alice')).toMatchObject({ positionId: 'media_supervisor', designation: 'Head of the Media and Communications Corner', department: 'council' });
    expect(fake.get('public_profiles/alice')).toMatchObject({ positionId: 'media_supervisor', designation: 'Head of the Media and Communications Corner' });
    expect(fake.get('verifications/M0000005')).toMatchObject({ designation: 'Head of the Media and Communications Corner' });
    const h = fake.list('position_history')[0] as any;
    expect(h).toMatchObject({ memberId: 'alice', action: 'promoted', from: 'Media and Communications Corner Member 1, Britain', to: 'Head of the Media and Communications Corner, Britain', effectiveDate: '2026-11-01', byUid: OWNER_UID, reason: 'Excellent coverage' });
    expect(fake.list('user_notifications').some((n: any) => n.userId === 'alice' && /Media and Communications Corner/.test(n.title))).toBe(true);
  });

  it('can keep other positions when more than one is allowed, without duplicating the member', async () => {
    await call('members/appoint', { seatId: 'production__video_editor', memberId: 'alice', keepOtherPositions: true });
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toBeTruthy();
    expect(fake.get('org_assignments/production__video_editor')).toMatchObject({ memberId: 'alice' });
    expect(fake.list('members').filter((m) => m.id === 'alice')).toHaveLength(1);
    expect(fake.get('members/alice')?.positionId).toBe('media_corner_member');
  });

  it('a council position needs a member of that council, unless they are transferred with it', async () => {
    const no = await call('members/appoint', { seatId: 'council__erbil__council_leader', memberId: 'alice' });
    expect(no.status).toBe(409);
    expect(no.data.error).toMatch(/different council/);
    const yes = await call('members/appoint', { seatId: 'council__erbil__council_leader', memberId: 'alice', moveToCouncil: true });
    expect(yes.status).toBe(200);
    expect(fake.get('members/alice')).toMatchObject({ chapterId: 'erbil', positionId: 'council_leader' });
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toBeUndefined();
  });

  it('the person who held the seat before is told and goes back to their remaining title', async () => {
    await call('members/appoint', { seatId: 'council__britain__media_corner_member__1', memberId: 'carol' });
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toMatchObject({ memberId: 'carol' });
    expect(fake.get('members/alice')).toMatchObject({ positionId: 'member', designation: 'Member' });
    expect(fake.list('position_history').some((h: any) => h.memberId === 'alice' && h.action === 'replaced')).toBe(true);
  });

  it('position status and reporting line can be changed and are recorded', async () => {
    const r = await call('members/seat', { seatId: 'council__britain__media_corner_member__1', status: 'on_leave', reportsTo: 'council__britain__council_leader', reason: 'Studying' });
    expect(r.status).toBe(200);
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toMatchObject({ status: 'on_leave', reportsTo: 'council__britain__council_leader' });
    expect(fake.list('position_history')[0]).toMatchObject({ action: 'status_changed', reason: 'Studying' });
  });

  it('vacating a position records it; the history can be reviewed', async () => {
    await call('members/vacate', { seatId: 'council__britain__media_corner_member__1', reason: 'Stepped down' });
    expect(fake.get('org_assignments/council__britain__media_corner_member__1')).toBeUndefined();
    const h = await call('members/history?id=alice');
    expect(h.status).toBe(200);
    expect(h.data.positions[0]).toMatchObject({ action: 'removed', reason: 'Stepped down' });
    expect(h.data.log[0]).toMatchObject({ action: 'POSITION_VACATED' });
  });

  it('only administrators (or managers with the permission) can change positions', async () => {
    expect((await call('members/appoint', { seatId: 'board__president', memberId: 'carol' }, 'reviewer')).status).toBe(403);
    expect((await call('members/appoint', { seatId: 'board__president', memberId: 'carol' }, 'carol')).status).toBe(403);
    expect((await call('members/appoint', { seatId: 'board__emperor', memberId: 'carol' })).status).toBe(400);
  });
});

describe('Website Administration (tests 9, 10)', () => {
  it('holding a Website Administration position gives no website permissions by itself', async () => {
    await call('members/appoint', { seatId: 'webadmin__web_admin', memberId: 'alice' });
    expect(fake.get('members/alice')).toMatchObject({ positionId: 'web_admin' });
    expect(fake.get('users/alice')?.permissions).toEqual([]);
  });

  it('the administrator can grant the permissions configured for that position, on purpose', async () => {
    const t = await call('members/permission-templates', { templates: { web_admin: ['manage_content', 'manage_settings'], web_content: ['manage_content'] } });
    expect(t.status).toBe(200);
    expect(t.data.templates.web_admin).toEqual(['manage_content', 'manage_settings']);
    await call('members/appoint', { seatId: 'webadmin__web_admin', memberId: 'alice', applyPermissions: true });
    expect(fake.get('users/alice')?.permissions).toEqual(['manage_content', 'manage_settings']);
    await call('members/vacate', { seatId: 'webadmin__web_admin', removePermissions: true });
    expect(fake.get('users/alice')?.permissions).toEqual([]);
  });

  it('the owner account (identified by its user id and verified email) can manage members without a second account', async () => {
    const r = await call('members/appoint', { seatId: 'board__head_of_media', memberId: 'carol' });
    expect(r.status).toBe(200);
  });
});

describe('Digital membership ID and QR verification', () => {
  it('issues a card with an unguessable QR link that shows the live record', async () => {
    const r = await call('members/card', { memberId: 'carol', joinedAt: '2024-01-01', validFrom: '2024-01-01', expiresAt: '2099-12-31', kind: 'issued' });
    expect(r.status).toBe(200);
    const m = fake.get('members/carol') as any;
    expect(m.memberNumber).toBe('M0000001');
    expect(m.verifyUrl).toBe(`https://mashkhall.com/id/${m.verifyToken}`);
    expect(m.verifyToken).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(m.verifyUrl).not.toContain('carol');
    const v = await call(`verify/id/${m.verifyToken}`, undefined, 'none');
    expect(v.data).toMatchObject({ found: true, state: 'valid', name: 'carol Full', memberNumber: 'M0000001', position: 'Member', council: 'Britain' });
    expect(v.data.email).toBeUndefined();
    expect(v.data.phone).toBeUndefined();

    // Edits show at once on the same QR code.
    await call('members/update', { memberId: 'carol', changes: { fullName: 'Carol New' } });
    await call('members/appoint', { seatId: 'board__head_of_finance', memberId: 'carol' });
    expect((await call(`verify/id/${m.verifyToken}`, undefined, 'none')).data).toMatchObject({ name: 'Carol New', position: 'Head of the Finance Centre', state: 'valid' });

    // Suspension shows immediately; a position change does not end membership.
    await call('members/status', { memberId: 'carol', status: 'suspended', reason: 'Review' });
    expect((await call(`verify/id/${m.verifyToken}`, undefined, 'none')).data.state).toBe('suspended');
    await call('members/status', { memberId: 'carol', status: 'revoked' });
    const rv = (await call(`verify/id/${m.verifyToken}`, undefined, 'none')).data;
    expect(rv.state).toBe('revoked');
    expect(rv.name).toBeUndefined();
    expect(fake.get('verifications/M0000001')).toMatchObject({ status: 'revoked' });
    expect(fake.get('public_profiles/carol')).toBeUndefined();
  });

  it('a replaced QR code stops verifying; an expired card says so', async () => {
    await call('members/card', { memberId: 'carol', joinedAt: '2024-01-01', validFrom: '2024-01-01', expiresAt: '2025-01-01', kind: 'issued' });
    const first = (fake.get('members/carol') as any).verifyToken;
    expect((await call(`verify/id/${first}`, undefined, 'none')).data.state).toBe('expired');
    await call('members/card', { memberId: 'carol', joinedAt: '2024-01-01', validFrom: '2024-01-01', expiresAt: '2099-01-01', kind: 'renewed', replaceQr: true });
    const second = (fake.get('members/carol') as any).verifyToken;
    expect(second).not.toBe(first);
    expect((await call(`verify/id/${first}`, undefined, 'none')).data.state).toBe('replaced');
    expect((await call(`verify/id/${second}`, undefined, 'none')).data.state).toBe('valid');
    expect((await call('verify/id/guessGuessGuessGuess12', undefined, 'none')).data.found).toBe(false);
  });

  it('a renewal keeps the printed QR code; a number cannot be used twice', async () => {
    const r = await call('members/card', { memberId: 'alice', joinedAt: '2024-01-01', validFrom: '2026-01-01', expiresAt: '2027-01-01', kind: 'renewed' });
    expect(r.status).toBe(200);
    expect(fake.get('members/alice')?.verifyUrl).toBe('https://mashkhall.com/#/people/M0000005');
    const dup = await call('members/card', { memberId: 'carol', memberNumber: 'M0000005', joinedAt: '2024-01-01', validFrom: '2024-01-01', expiresAt: '2099-01-01', kind: 'issued' });
    expect(dup.status).toBe(409);
  });
});

describe('Built-in councils that were never saved in the database', () => {
  it('positions in them can be given, as the website shows them (Britain Council Leader)', async () => {
    fake.docs.delete('chapters/britain');
    fake.docs.delete('chapters/erbil');
    fake.set('members/adil', member('adil', { fullName: 'Adil Mohammed Qadir', positionId: 'council_leader', designation: 'Lobby Supervisor' }));
    const r = await call('members/appoint', { seatId: 'council__britain__council_leader', memberId: 'adil', effectiveDate: '2026-11-03' });
    expect(r.status).toBe(200);
    expect(fake.get('org_assignments/council__britain__council_leader')).toMatchObject({ memberId: 'adil', positionId: 'council_leader', councilId: 'britain' });
    expect(fake.get('members/adil')).toMatchObject({ positionId: 'council_leader', designation: 'Lobby Supervisor' });
    // Kirkuk is built in too; a council that does not exist is still refused.
    expect((await call('members/appoint', { seatId: 'council__kirkuk__media_supervisor', memberId: 'carol', moveToCouncil: true })).status).toBe(200);
    expect((await call('members/appoint', { seatId: 'council__atlantis__council_leader', memberId: 'carol', moveToCouncil: true })).status).toBe(400);
  });

  it('a built-in council archived by an administrator takes no new positions', async () => {
    fake.set('chapters/cardiff', { name: 'Cardiff', isArchived: true });
    expect((await call('members/appoint', { seatId: 'council__cardiff__council_leader', memberId: 'carol', moveToCouncil: true })).status).toBe(400);
  });
});

describe('Members publish without a fee', () => {
  const sub = (id: string, extra: Record<string, unknown> = {}) => ({
    id, kind: 'article', feeCategory: 'article', title: 'A report', status: 'awaiting_payment', ownerUid: 'anon-1',
    payment: { status: 'claimed', amountPence: 1500, standardPence: 1500, tier: 'standard', reference: '17S-ABCDEF', claimedAt: '2026-11-03T16:38:00Z' },
    contact: { name: 'Carol', email: 'carol@example.org' }, history: [{ at: '2026-11-03T16:38:00Z', action: 'Sent; waiting for the publication fee', by: 'contributor' }], ...extra,
  });
  const ID = 'gs_p3ansimactnnwwfiihwa27ni';

  it('a signed-in member makes their submission fee-free and it goes to editorial review', async () => {
    fake.set(`guest_submissions/${ID}`, sub(ID));
    const r = await call('members/waive-fee', { id: ID }, 'carol');
    expect(r.status).toBe(200);
    const s = fake.get(`guest_submissions/${ID}`) as any;
    expect(s.status).toBe('submitted');
    expect(s.payment).toMatchObject({ status: 'waived', amountPence: 0, waivedReason: 'member', reference: '17S-ABCDEF' });
    expect(s.memberUid).toBe('carol');
    expect(s.history.at(-1)).toMatchObject({ by: 'contributor' });
    expect(s.history.at(-1).note).toMatch(/refund/);
    expect(fake.list('audit_logs').some((a: any) => a.action === 'PUBLICATION_FEE_WAIVED')).toBe(true);
    // Doing it again changes nothing.
    expect((await call('members/waive-fee', { id: ID }, 'carol')).data.already).toBe(true);
  });

  it('people who are not members cannot avoid the fee; staff can waive it', async () => {
    fake.set('users/visitor', { uid: 'visitor', roles: ['visitor'] });
    tokens.visitor = await fake.idToken('visitor');
    fake.set(`guest_submissions/${ID}`, sub(ID));
    expect((await call('members/waive-fee', { id: ID }, 'visitor')).status).toBe(403);
    expect((await call('members/waive-fee', { id: ID })).status).toBe(200);
    expect((fake.get(`guest_submissions/${ID}`) as any).payment.waivedReason).toBe('staff');
  });

  it('a fee already paid, or a closed submission, is not changed', async () => {
    fake.set(`guest_submissions/${ID}`, sub(ID, { payment: { status: 'verified', amountPence: 1500, standardPence: 1500, tier: 'standard', reference: '17S-ABCDEF' }, status: 'submitted' }));
    expect((await call('members/waive-fee', { id: ID }, 'carol')).status).toBe(409);
    fake.set(`guest_submissions/${ID}`, sub(ID, { status: 'withdrawn' }));
    expect((await call('members/waive-fee', { id: ID }, 'carol')).status).toBe(409);
    expect((await call('members/waive-fee', { id: 'gs_nothere000000' }, 'carol')).status).toBe(404);
  });
});
