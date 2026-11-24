/**
 * Appreciation letters and certificates (worker/certificates.js), against
 * an in-memory database: acceptance tests 3 and 4 and the workflow.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installFakeFirestore, Fake } from './helpers/fakeFirestore';
import { handleCertificates } from '../worker/certificates.js';
import { handleMembers } from '../worker/members.js';

let fake: Fake;
const tokens: Record<string, string> = {};
const call = async (path: string, body?: unknown, as = 'owner') => {
  const handler = path.startsWith('appreciation/') ? handleCertificates : handleMembers;
  const res = await handler(new Request(`https://mashkhall.com/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${tokens[as] || ''}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), fake.env);
  return { status: res.status, data: await res.json() as any };
};

const draft = { memberId: 'alice', kind: 'certificate', category: 'media', achievement: 'Coverage of the 17 February commemoration', reason: 'For outstanding photography and reporting of the commemoration in London.', issueDate: '2026-11-01' };

beforeAll(async () => {
  fake = await installFakeFirestore();
  tokens.owner = await fake.idToken('owner-uid', 'dashtiozar@gmail.com', true);
  tokens.reviewer = await fake.idToken('reviewer');
  tokens.carol = await fake.idToken('carol');
});
afterAll(() => fake.restore());
beforeEach(() => {
  fake.docs.clear();
  fake.set('chapters/london', { name: 'London', isArchived: false });
  fake.set('users/owner-uid', { roles: ['owner'] });
  fake.set('users/reviewer', { roles: ['member', 'membership_reviewer'] });
  fake.set('users/carol', { roles: ['member'] });
  fake.set('members/alice', { userId: 'alice', fullName: 'Alice Kareem', displayName: 'Alice K.', chapterId: 'london', status: 'active', positionId: 'council_photographer', memberNumber: 'M0000005', updatedAt: '2026-01-01T00:00:00.000Z', verifyToken: 'MemberCardTokenAAAAAAAA', verifyUrl: 'https://mashkhall.com/id/MemberCardTokenAAAAAAAA', credentialIssuedAt: '2025-01-01' });
  fake.set('members/carol', { userId: 'carol', fullName: 'Carol', status: 'active', chapterId: 'london' });
  fake.set('site_settings/appreciation', { signatoryName: 'Sangar Hussein', signatoryTitle: 'Vice President' });
});

describe('Appreciation workflow', () => {
  it('draft, preview data, approve and issue: unique number and its own verification address (test 3)', async () => {
    const d = await call('appreciation/save', draft);
    expect(d.status).toBe(200);
    const id = d.data.award.id;
    expect(id).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(fake.get(`appreciation_awards/${id}`)).toMatchObject({ status: 'draft', number: '', categoryLabel: 'Media Contribution', signatoryName: 'Sangar Hussein' });

    const i = await call('appreciation/issue', { id });
    expect(i.status).toBe(200);
    const a = fake.get(`appreciation_awards/${id}`) as any;
    expect(a.status).toBe('published');
    expect(a.number).toMatch(/^17S-APP-2026-[2-9A-Z]{6}$/);
    expect(a.verifyUrl).toBe(`https://mashkhall.com/appreciation/${id}`);
    // Separate from the membership card's verification.
    expect(a.verifyUrl).not.toContain('MemberCardToken');
    expect(a.name).toBe('Alice Kareem');
    expect(fake.list('user_notifications')[0]).toMatchObject({ userId: 'alice', link: `/appreciation/${id}` });

    const second = await call('appreciation/save', { ...draft, achievement: 'Another achievement' });
    await call('appreciation/issue', { id: second.data.award.id });
    expect(fake.get(`appreciation_awards/${second.data.award.id}`)?.number).not.toBe(a.number);
  });

  it('revoked and replaced letters show their status; the original stays on record (test 4)', async () => {
    const one = (await call('appreciation/save', draft)).data.award.id;
    await call('appreciation/issue', { id: one });
    const r = await call('appreciation/replace', { id: one, correction: 'Spelling of the event', achievement: 'Coverage of the 17 February 2026 commemoration' });
    expect(r.status).toBe(200);
    const newId = r.data.award.id;
    expect(fake.get(`appreciation_awards/${one}`)).toMatchObject({ status: 'superseded', supersededBy: newId });
    expect(fake.get(`appreciation_awards/${newId}`)).toMatchObject({ status: 'published', replaces: one, achievement: 'Coverage of the 17 February 2026 commemoration' });
    const rv = await call('appreciation/revoke', { id: newId, reason: 'Issued in error' });
    expect(rv.status).toBe(200);
    expect(fake.get(`appreciation_awards/${newId}`)).toMatchObject({ status: 'revoked', revokedReason: 'Issued in error' });
    expect((await call('appreciation/revoke', { id: one, reason: 'x x x' })).status).toBe(409);
  });

  it('issued letters are not rewritten when the member’s profile changes', async () => {
    const id = (await call('appreciation/save', draft)).data.award.id;
    await call('appreciation/issue', { id });
    await call('members/update', { memberId: 'alice', changes: { fullName: 'Alice Kareem Rasul' } });
    expect(fake.get(`appreciation_awards/${id}`)?.name).toBe('Alice Kareem');
    expect((await call('appreciation/save', { ...draft, id })).status).toBe(409);
  });

  it('membership staff prepare and submit; only administrators issue', async () => {
    const d = await call('appreciation/save', draft, 'reviewer');
    expect(d.status).toBe(200);
    expect((await call('appreciation/submit', { id: d.data.award.id }, 'reviewer')).status).toBe(200);
    expect(fake.get(`appreciation_awards/${d.data.award.id}`)?.status).toBe('pending');
    expect((await call('appreciation/issue', { id: d.data.award.id }, 'reviewer')).status).toBe(403);
    expect((await call('appreciation/save', draft, 'carol')).status).toBe(403);
    expect((await call('appreciation/dashboard', undefined, 'carol')).status).toBe(403);
    const dash = await call('appreciation/dashboard');
    expect(dash.data.awards.map((a: any) => a.status)).toEqual(['pending']);
    expect(dash.data.categories).toHaveLength(7);
    expect(dash.data.members.map((m: any) => m.id).sort()).toEqual(['alice', 'carol']);
  });

  it('checks the input and lets administrators add categories', async () => {
    expect((await call('appreciation/save', { ...draft, category: 'nonsense' })).data.error).toMatch(/category/);
    expect((await call('appreciation/save', { ...draft, reason: 'short' })).status).toBe(400);
    expect((await call('appreciation/save', { ...draft, memberId: 'nobody' })).status).toBe(400);
    const c = await call('appreciation/categories', { categories: [{ id: 'media', label: 'Media Contribution' }, { label: 'Translation' }] });
    expect(c.data.categories).toEqual([{ id: 'media', label: 'Media Contribution' }, { id: 'translation', label: 'Translation' }]);
    expect((await call('appreciation/save', { ...draft, category: 'translation' })).status).toBe(200);
  });
});
