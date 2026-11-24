/**
 * Firestore security rules tests for the Mashkhally Zhyanawa platform.
 *
 * Run with:  npm run test:rules
 * (starts the Firestore emulator, runs these tests, then shuts it down)
 *
 * Each `describe` block matches one class of attack from the security review:
 * reading private data, giving yourself more power, taking over someone
 * else's records, skipping review, and gaming counters or points.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const NOW = '2026-10-19T00:00:00.000Z';

// Test identities
const ALICE = 'alice'; // signed-in visitor with a pending application
const BOB = 'bob'; // approved member, did NOT consent to the directory
const CAROL = 'carol'; // approved member who consented
const MALLORY = 'mallory'; // attacker with an ordinary account
const REVIEWER = 'reviewer'; // membership_reviewer
const EDITOR = 'editor'; // content_reviewer
const PUBLISHER = 'publisher';
const ADMIN = 'admin'; // listed in /admins

const asUser = (uid: string, token: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, ...token }).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

const validApplication = (uid: string) => ({
  id: `app-${uid}`,
  userId: uid,
  fullName: 'Test Person',
  displayName: 'Tester',
  email: `${uid}@example.com`,
  phone: '',
  country: 'United Kingdom',
  chapterId: 'britain',
  reason: 'I want to support peaceful civic work.',
  skills: '',
  photoUrl: '',
  agreedToPolicies: true,
  consentToDirectory: false,
  status: 'submitted',
  createdAt: NOW,
  updatedAt: NOW,
});

const article = (overrides: Record<string, unknown> = {}) => ({
  id: 'x',
  title: 'A report',
  slug: 'a-report',
  excerpt: 'Summary',
  content: 'Body text',
  category: 'political',
  tags: [],
  authorUid: BOB,
  authorDisplayName: 'Bob',
  isOfficialNews: false,
  contentType: 'article',
  status: 'submitted',
  viewsCount: 0,
  likesCount: 0,
  sharesCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-17shubat',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (uid: string, roles: string[]) =>
      setDoc(doc(db, 'users', uid), { uid, email: `${uid}@example.com`, displayName: uid, roles, permissions: [], activityScore: 15, createdAt: NOW });

    await user(ALICE, ['visitor']);
    await user(BOB, ['visitor', 'member']);
    await user(CAROL, ['visitor', 'member']);
    await user(MALLORY, ['visitor']);
    await user(REVIEWER, ['membership_reviewer']);
    await user(EDITOR, ['content_reviewer']);
    await user(PUBLISHER, ['publisher']);
    await user(ADMIN, ['administrator']);
    await setDoc(doc(db, 'users', 'notifier'), { uid: 'notifier', email: 'notifier@example.com', displayName: 'n', roles: ['member'], permissions: ['manage_notifications'], activityScore: 15, createdAt: NOW });
    await setDoc(doc(db, 'admins', ADMIN), { uid: ADMIN, role: 'administrator', createdAt: NOW });

    await setDoc(doc(db, 'applications', `app-${ALICE}`), validApplication(ALICE));

    const member = (uid: string, consent: boolean) =>
      setDoc(doc(db, 'members', uid), {
        id: uid, userId: uid, memberNumber: '17S-00001', fullName: `${uid} Legalname`,
        displayName: uid, email: `${uid}@example.com`, phone: '+44 7000 000000',
        chapterId: 'britain', status: 'active', roles: ['member'],
        consentToDirectory: consent, joinedAt: NOW, updatedAt: NOW,
      });
    await member(BOB, false);
    await member(CAROL, true);
    await setDoc(doc(db, 'public_profiles', CAROL), {
      id: CAROL, userId: CAROL, displayName: 'Carol', chapterId: 'britain', chapterName: 'Britain', updatedAt: NOW,
    });

    await setDoc(doc(db, 'articles', 'published-1'), article({ id: 'published-1', status: 'published', viewsCount: 5 }));
    await setDoc(doc(db, 'articles', 'draft-1'), article({ id: 'draft-1', status: 'draft' }));
    await setDoc(doc(db, 'articles', 'submitted-1'), article({ id: 'submitted-1', status: 'submitted' }));

    await setDoc(doc(db, 'user_activities', 'act-bob'), {
      id: 'act-bob', userId: BOB, userEmail: '', userName: 'bob', type: 'bonus_awarded', points: 10, description: 'x', timestamp: NOW,
    });
  });
});

// ---------------------------------------------------------------------------
describe('Private data is not public', () => {
  it('anonymous visitors cannot read member records (legal name, email, phone)', async () => {
    await assertFails(getDoc(doc(asAnon(), 'members', BOB)));
    await assertFails(getDocs(collection(asAnon(), 'members')));
  });

  it('other signed-in users cannot read a member record', async () => {
    await assertFails(getDoc(doc(asUser(MALLORY), 'members', BOB)));
  });

  it('members can read their own record; membership reviewers can list all', async () => {
    await assertSucceeds(getDoc(doc(asUser(BOB), 'members', BOB)));
    await assertSucceeds(getDocs(collection(asUser(REVIEWER), 'members')));
  });

  it('user account documents (emails, roles) are private', async () => {
    await assertFails(getDoc(doc(asAnon(), 'users', BOB)));
    await assertFails(getDocs(collection(asUser(MALLORY), 'users')));
    await assertSucceeds(getDoc(doc(asUser(BOB), 'users', BOB)));
  });

  it('activity history is private to the member and admins', async () => {
    await assertFails(getDocs(collection(asAnon(), 'user_activities')));
    await assertFails(getDoc(doc(asUser(MALLORY), 'user_activities', 'act-bob')));
    await assertSucceeds(getDocs(query(collection(asUser(BOB), 'user_activities'), where('userId', '==', BOB))));
    await assertSucceeds(getDocs(collection(asUser(ADMIN), 'user_activities')));
  });

  it('applications are private to the applicant and membership staff', async () => {
    await assertFails(getDoc(doc(asUser(MALLORY), 'applications', `app-${ALICE}`)));
    await assertFails(getDocs(collection(asUser(MALLORY), 'applications')));
    await assertSucceeds(getDoc(doc(asUser(ALICE), 'applications', `app-${ALICE}`)));
    // An applicant can check for their own application before it exists.
    await assertSucceeds(getDoc(doc(asUser(MALLORY), 'applications', `app-${MALLORY}`)));
  });

  it('public profiles stay readable by everyone', async () => {
    await assertSucceeds(getDoc(doc(asAnon(), 'public_profiles', CAROL)));
  });
});

// ---------------------------------------------------------------------------
describe('Drafts are visible only to author and editors', () => {
  it('anonymous visitors can read published articles only', async () => {
    await assertSucceeds(getDoc(doc(asAnon(), 'articles', 'published-1')));
    await assertFails(getDoc(doc(asAnon(), 'articles', 'draft-1')));
    await assertSucceeds(getDocs(query(collection(asAnon(), 'articles'), where('status', '==', 'published'))));
    await assertFails(getDocs(collection(asAnon(), 'articles')));
  });

  it('authors see their own drafts; editors see everything', async () => {
    await assertSucceeds(getDoc(doc(asUser(BOB), 'articles', 'draft-1')));
    await assertSucceeds(getDocs(query(collection(asUser(BOB), 'articles'), where('authorUid', '==', BOB))));
    await assertFails(getDoc(doc(asUser(MALLORY), 'articles', 'draft-1')));
    await assertSucceeds(getDocs(collection(asUser(EDITOR), 'articles')));
  });
});

// ---------------------------------------------------------------------------
describe('Nobody can give themselves more power', () => {
  it('a user cannot add admin roles or permissions to their own account', async () => {
    const db = asUser(MALLORY);
    await assertFails(updateDoc(doc(db, 'users', MALLORY), { roles: ['administrator'] }));
    await assertFails(updateDoc(doc(db, 'users', MALLORY), { permissions: ['manage_users'] }));
  });

  it('a user cannot award themselves points', async () => {
    await assertFails(updateDoc(doc(asUser(MALLORY), 'users', MALLORY), { activityScore: 9999 }));
    await assertFails(setDoc(doc(asUser(MALLORY), 'user_activities', 'self'), {
      id: 'self', userId: MALLORY, points: 500, type: 'bonus_awarded', description: 'x', timestamp: NOW,
    }));
  });

  it('a user can still edit their own display name and photo', async () => {
    await assertSucceeds(updateDoc(doc(asUser(MALLORY), 'users', MALLORY), { displayName: 'New name', updatedAt: NOW }));
  });

  it('new accounts must start as plain visitors', async () => {
    const db = asUser('newbie');
    const base = { uid: 'newbie', email: 'newbie@example.com', displayName: 'n', permissions: [], activityScore: 15, createdAt: NOW };
    await assertFails(setDoc(doc(db, 'users', 'newbie'), { ...base, roles: ['owner'] }));
    await assertSucceeds(setDoc(doc(db, 'users', 'newbie'), { ...base, roles: ['visitor'] }));
  });

  it('ordinary users cannot write to the admin registry', async () => {
    await assertFails(setDoc(doc(asUser(MALLORY), 'admins', MALLORY), { uid: MALLORY, role: 'owner' }));
  });

  it('the owner email only counts once the email is verified', async () => {
    const unverified = env.authenticatedContext('squatter', { email: 'dashtiozar@gmail.com', email_verified: false }).firestore();
    await assertFails(setDoc(doc(unverified, 'admins', 'squatter'), { uid: 'squatter', role: 'owner' }));
    await assertFails(getDocs(collection(unverified, 'members')));

    const verified = env.authenticatedContext('real-owner', { email: 'dashtiozar@gmail.com', email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(verified, 'admins', 'real-owner'), { uid: 'real-owner', role: 'owner' }));
  });

  it('membership reviewers can add the member role but nothing higher', async () => {
    const db = asUser(REVIEWER);
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), { roles: ['visitor', 'member'], updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { roles: ['visitor', 'administrator'], updatedAt: NOW }));
  });
});

// ---------------------------------------------------------------------------
const DAVE_APPLICANT = 'dave-applicant';

describe("Nobody can take over someone else's records", () => {
  it("an attacker cannot overwrite another person's application", async () => {
    await assertFails(setDoc(doc(asUser(MALLORY), 'applications', `app-${ALICE}`), validApplication(MALLORY)));
  });

  it('applicants cannot approve themselves or write reviewer notes', async () => {
    const db = asUser(ALICE);
    await assertFails(updateDoc(doc(db, 'applications', `app-${ALICE}`), { status: 'approved' }));
    await assertFails(updateDoc(doc(db, 'applications', `app-${ALICE}`), { staffNotes: 'looks great' }));
  });

  it('applicants can resubmit, withdraw, or delete their own application', async () => {
    const db = asUser(ALICE);
    await assertSucceeds(updateDoc(doc(db, 'applications', `app-${ALICE}`), { status: 'withdrawn', updatedAt: NOW }));
    await assertSucceeds(updateDoc(doc(db, 'applications', `app-${ALICE}`), { status: 'submitted', updatedAt: NOW }));
    await assertSucceeds(deleteDoc(doc(db, 'applications', `app-${ALICE}`)));
  });

  it('a new applicant can submit a valid application under their own id only', async () => {
    const db = asUser(MALLORY);
    await assertSucceeds(setDoc(doc(db, 'applications', `app-${MALLORY}`), validApplication(MALLORY)));
    await assertFails(setDoc(doc(db, 'applications', `app-${MALLORY}`), { ...validApplication(MALLORY), status: 'approved' }));
  });

  it('an applicant chooses exactly one official position', async () => {
    const db = asUser(DAVE_APPLICANT);
    await assertFails(setDoc(doc(db, 'applications', `app-${DAVE_APPLICANT}`), { ...validApplication(DAVE_APPLICANT), positionId: ['president', 'reporter'] }));
    await assertFails(setDoc(doc(db, 'applications', `app-${DAVE_APPLICANT}`), { ...validApplication(DAVE_APPLICANT), positionId: 'supreme_leader' }));
    await assertSucceeds(setDoc(doc(db, 'applications', `app-${DAVE_APPLICANT}`), { ...validApplication(DAVE_APPLICANT), positionId: 'reporter' }));
  });

  it("an attacker cannot overwrite another member's public profile", async () => {
    await assertFails(setDoc(doc(asUser(MALLORY), 'public_profiles', CAROL), {
      id: CAROL, userId: MALLORY, displayName: 'Hijacked', chapterId: 'britain', chapterName: 'Britain', updatedAt: NOW,
    }));
  });

  it('the full approval used by the admin screen succeeds (application, member, role, profile, number)', async () => {
    for (const staff of [ADMIN, REVIEWER]) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'applications', `app-${ALICE}`), { ...validApplication(ALICE), consentToDirectory: true });
      });
      const db = asUser(staff);
      const appRef = doc(db, 'applications', `app-${ALICE}`);
      const memberRef = doc(db, 'members', ALICE);
      const userRef = doc(db, 'users', ALICE);
      await assertSucceeds(runTransaction(db, async (tx) => {
        await tx.get(memberRef);
        const userSnap = await tx.get(userRef);
        tx.update(appRef, { status: 'approved', reviewerUid: staff, updatedAt: NOW });
        tx.set(memberRef, {
          id: ALICE, userId: ALICE, memberNumber: '17S-P000001', fullName: 'Test Person', displayName: 'Tester',
          email: 'alice@example.com', phone: '', chapterId: 'britain', status: 'active', roles: ['member'],
          consentToDirectory: true, photoUrl: '', joinedAt: NOW, updatedAt: NOW,
        }, { merge: true });
        const roles = (userSnap.data()?.roles || []) as string[];
        if (!roles.includes('member')) tx.update(userRef, { roles: [...roles, 'member'], updatedAt: NOW });
        tx.set(doc(db, 'public_profiles', ALICE), {
          id: ALICE, userId: ALICE, displayName: 'Tester', photoUrl: '', chapterId: 'britain', chapterName: 'Britain', updatedAt: NOW,
        }, { merge: true });
      }));
      await assertSucceeds(runTransaction(db, async (tx) => {
        const counterRef = doc(db, 'counters', 'members');
        const snap = await tx.get(counterRef);
        const next = ((snap.exists() ? snap.data().next : 0) || 0) + 1;
        tx.set(counterRef, { next, updatedAt: NOW }, { merge: true });
        tx.update(memberRef, { memberNumber: `17S-${String(next).padStart(5, '0')}`, updatedAt: NOW });
      }));
    }
  });

  it('membership reviewers can approve applications', async () => {
    await assertSucceeds(updateDoc(doc(asUser(REVIEWER), 'applications', `app-${ALICE}`), { status: 'approved', reviewerUid: REVIEWER }));
  });
});

// ---------------------------------------------------------------------------
describe('The public directory is opt-in', () => {
  const profile = (uid: string, extra: Record<string, unknown> = {}) => ({
    id: uid, userId: uid, displayName: uid, chapterId: 'britain', chapterName: 'Britain', updatedAt: NOW, ...extra,
  });

  it('a member who has not consented cannot publish a profile', async () => {
    await assertFails(setDoc(doc(asUser(BOB), 'public_profiles', BOB), profile(BOB)));
  });

  it('once staff mark them as listed, they can publish their profile', async () => {
    await assertFails(updateDoc(doc(asUser(BOB), 'members', BOB), { consentToDirectory: true, updatedAt: NOW }));
    await assertSucceeds(updateDoc(doc(asUser(REVIEWER), 'members', BOB), { consentToDirectory: true, updatedAt: NOW }));
    await assertSucceeds(setDoc(doc(asUser(BOB), 'public_profiles', BOB), profile(BOB)));
  });

  it('members cannot set their own rank, board title or points', async () => {
    await assertFails(setDoc(doc(asUser(CAROL), 'public_profiles', CAROL), profile(CAROL, { activityScore: 9999 })));
    await assertFails(updateDoc(doc(asUser(CAROL), 'public_profiles', CAROL), { isBoardMember: true }));
  });

  it('members cannot change their own legal name, email or status', async () => {
    await assertFails(updateDoc(doc(asUser(BOB), 'members', BOB), { fullName: 'Someone Else' }));
    await assertFails(updateDoc(doc(asUser(BOB), 'members', BOB), { status: 'active', roles: ['administrator'] }));
  });

  it('every member is listed: members cannot remove their own listing, staff can', async () => {
    await assertFails(deleteDoc(doc(asUser(CAROL), 'public_profiles', CAROL)));
    await assertFails(updateDoc(doc(asUser(CAROL), 'members', CAROL), { consentToDirectory: false }));
    await assertSucceeds(deleteDoc(doc(asUser(REVIEWER), 'public_profiles', CAROL)));
  });
});

// ---------------------------------------------------------------------------
describe('Articles go through review', () => {
  it('members can submit but not self-publish', async () => {
    const db = asUser(BOB);
    await assertSucceeds(setDoc(doc(db, 'articles', 'new-1'), article({ id: 'new-1', status: 'submitted' })));
    await assertFails(setDoc(doc(db, 'articles', 'new-2'), article({ id: 'new-2', status: 'published' })));
    await assertFails(updateDoc(doc(db, 'articles', 'submitted-1'), { status: 'published' }));
  });

  it('visitors who are not members cannot create articles', async () => {
    await assertFails(setDoc(doc(asUser(MALLORY), 'articles', 'spam'), article({ id: 'spam', authorUid: MALLORY })));
  });

  it("authors cannot edit someone else's article", async () => {
    await assertFails(updateDoc(doc(asUser(CAROL), 'articles', 'draft-1'), { title: 'Defaced' }));
  });

  it('content reviewers cannot publish; publishers can', async () => {
    await assertFails(updateDoc(doc(asUser(EDITOR), 'articles', 'submitted-1'), { status: 'published' }));
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'articles', 'submitted-1'), { status: 'changes_requested' }));
    await assertSucceeds(updateDoc(doc(asUser(PUBLISHER), 'articles', 'submitted-1'), { status: 'published' }));
  });
});

// ---------------------------------------------------------------------------
describe('Counters cannot be gamed', () => {
  it('anyone can add exactly one view to a published article', async () => {
    await assertSucceeds(updateDoc(doc(asAnon(), 'articles', 'published-1'), { viewsCount: increment(1) }));
    await assertFails(updateDoc(doc(asAnon(), 'articles', 'published-1'), { viewsCount: 100000 }));
    await assertFails(updateDoc(doc(asAnon(), 'articles', 'published-1'), { viewsCount: increment(1), title: 'Defaced' }));
  });

  it('counters on drafts cannot be touched', async () => {
    await assertFails(updateDoc(doc(asAnon(), 'articles', 'draft-1'), { viewsCount: increment(1) }));
  });

  it('a member can like once, and unlike once', async () => {
    const db = asUser(CAROL);
    const like = () => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'articles', 'published-1', 'likes', CAROL), { createdAt: NOW });
      batch.update(doc(db, 'articles', 'published-1'), { likesCount: increment(1) });
      return batch.commit();
    };
    await assertSucceeds(like());
    await assertFails(like()); // second like rejected

    const unlike = writeBatch(db);
    unlike.delete(doc(db, 'articles', 'published-1', 'likes', CAROL));
    unlike.update(doc(db, 'articles', 'published-1'), { likesCount: increment(-1) });
    await assertSucceeds(unlike.commit());
  });

  it('likes without a matching like record are rejected', async () => {
    await assertFails(updateDoc(doc(asUser(CAROL), 'articles', 'published-1'), { likesCount: increment(1) }));
    await assertFails(updateDoc(doc(asAnon(), 'articles', 'published-1'), { likesCount: increment(1) }));
  });

  it('staff can award points', async () => {
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'user_activities', 'award'), {
      id: 'award', userId: BOB, points: 50, type: 'bonus_awarded', description: 'x', timestamp: NOW,
    }));
  });
});

// ---------------------------------------------------------------------------
describe('Contact form, audit log and counters', () => {
  const enquiry = {
    id: 'enq-1', name: 'Visitor', email: 'v@example.com', phone: '', subject: 'Hello',
    message: 'A message', privacyAgreed: true, status: 'new', createdAt: NOW,
  };

  it('anyone can send a contact enquiry, but only admins can read them', async () => {
    await assertSucceeds(setDoc(doc(asAnon(), 'contact_enquiries', 'enq-1'), enquiry));
    await assertFails(getDoc(doc(asAnon(), 'contact_enquiries', 'enq-1')));
    await assertFails(getDoc(doc(asUser(MALLORY), 'contact_enquiries', 'enq-1')));
  });

  it('contact enquiries cannot carry extra or staff-only fields', async () => {
    await assertFails(setDoc(doc(asAnon(), 'contact_enquiries', 'enq-2'), { ...enquiry, id: 'enq-2', status: 'resolved' }));
    await assertFails(setDoc(doc(asAnon(), 'contact_enquiries', 'enq-3'), { ...enquiry, id: 'enq-3', staffNotes: 'x' }));
  });

  it('audit entries can only be written in your own name, and never edited', async () => {
    const db = asUser(MALLORY);
    await assertFails(setDoc(doc(db, 'audit_logs', 'fake'), { actorUid: ADMIN, action: 'X', details: 'forged', timestamp: NOW }));
    await assertSucceeds(setDoc(doc(db, 'audit_logs', 'real'), { actorUid: MALLORY, action: 'X', details: 'ok', timestamp: NOW }));
    await assertFails(updateDoc(doc(db, 'audit_logs', 'real'), { details: 'changed' }));
  });

  it('member-number counter is staff-only', async () => {
    await assertFails(setDoc(doc(asUser(BOB), 'counters', 'members'), { next: 1 }));
    await assertSucceeds(setDoc(doc(asUser(REVIEWER), 'counters', 'members'), { next: 1 }));
  });
});

describe('Only the one owner email is recognised', () => {
  it('a former bootstrap email has no admin rights', async () => {
    const other = env.authenticatedContext('former', { email: 'someone.else@example.org', email_verified: true }).firestore();
    await assertFails(setDoc(doc(other, 'admins', 'former'), { uid: 'former', role: 'owner' }));
  });
});

describe('Notifications', () => {
  const note = (overrides: Record<string, unknown> = {}) => ({
    id: 'n1', title: 'Event this Saturday', body: 'Details here.', level: 'info', audience: 'everyone',
    status: 'published', createdBy: 'notifier', createdAt: NOW, updatedAt: NOW, ...overrides,
  });

  it('people with the permission can broadcast; others cannot', async () => {
    await assertSucceeds(setDoc(doc(asUser('notifier'), 'notifications', 'n1'), note()));
    await assertFails(setDoc(doc(asUser(MALLORY), 'notifications', 'n2'), note({ id: 'n2', createdBy: MALLORY })));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'notifications', 'n3'), note({ id: 'n3', createdBy: ADMIN })));
  });

  it('users cannot grant themselves the permission', async () => {
    await assertFails(updateDoc(doc(asUser(MALLORY), 'users', MALLORY), { permissions: ['manage_notifications'] }));
  });

  it('announcements are for signed-in users; drafts and members-only ones are restricted', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'notifications', 'pub'), note({ id: 'pub' }));
      await setDoc(doc(db, 'notifications', 'draft'), note({ id: 'draft', status: 'draft' }));
      await setDoc(doc(db, 'notifications', 'mem'), note({ id: 'mem', audience: 'members' }));
    });
    await assertFails(getDoc(doc(asAnon(), 'notifications', 'pub')));
    await assertSucceeds(getDoc(doc(asUser(MALLORY), 'notifications', 'pub')));
    await assertFails(getDoc(doc(asUser(MALLORY), 'notifications', 'draft')));
    await assertFails(getDoc(doc(asUser(MALLORY), 'notifications', 'mem')));
    await assertSucceeds(getDoc(doc(asUser(BOB), 'notifications', 'mem')));
    await assertSucceeds(getDocs(query(collection(asUser(MALLORY), 'notifications'), where('status', '==', 'published'), where('audience', '==', 'everyone'))));
  });

  it('notifications are validated', async () => {
    await assertFails(setDoc(doc(asUser('notifier'), 'notifications', 'bad'), note({ id: 'bad', level: 'panic' })));
    await assertFails(setDoc(doc(asUser('notifier'), 'notifications', 'bad2'), note({ id: 'bad2', title: '' })));
  });
});

// ---------------------------------------------------------------------------
describe('Membership verification (QR codes)', () => {
  const ver = (overrides: Record<string, unknown> = {}) => ({
    id: 'M0000001', memberNumber: 'M0000001', name: 'Test Person', designation: 'Journalist',
    status: 'active', validFrom: NOW, expiresAt: NOW, verifyUrl: 'https://mashkhall.com/#/verify/M0000001', updatedAt: NOW, ...overrides,
  });

  it('anyone can check a member number, but nobody can list the register', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'verifications', 'M0000001'), ver()); });
    await assertSucceeds(getDoc(doc(asAnon(), 'verifications', 'M0000001')));
    await assertFails(getDocs(collection(asAnon(), 'verifications')));
    await assertFails(getDocs(collection(asUser(MALLORY), 'verifications')));
  });

  it('cards are written only by the website server, which keeps them in step with the member record', async () => {
    await assertFails(setDoc(doc(asUser(MALLORY), 'verifications', 'M0000002'), ver({ id: 'M0000002', memberNumber: 'M0000002' })));
    await assertFails(setDoc(doc(asUser(BOB), 'verifications', 'M0000003'), ver({ id: 'M0000003', memberNumber: 'M0000003' })));
    await assertFails(setDoc(doc(asUser(REVIEWER), 'verifications', 'M0000004'), ver({ id: 'M0000004', memberNumber: 'M0000004' })));
    await assertFails(setDoc(doc(asUser(ADMIN), 'verifications', 'M0000005'), ver({ id: 'M0000005', memberNumber: 'M0000005' })));
  });

  it('member positions must be one of the official ones', async () => {
    await assertSucceeds(updateDoc(doc(asUser(REVIEWER), 'members', BOB), { positionId: 'reporter', department: 'production', designation: 'Reporter' }));
    await assertSucceeds(updateDoc(doc(asUser(REVIEWER), 'members', BOB), { positionId: 'web_content', department: 'webadmin', designation: 'Website Content and Translation Manager' }));
    await assertFails(updateDoc(doc(asUser(REVIEWER), 'members', BOB), { positionId: 'king' }));
    await assertFails(updateDoc(doc(asUser(BOB), 'members', BOB), { positionId: 'president' }));
  });

  it('members cannot change their own designation, dates or status', async () => {
    await assertFails(updateDoc(doc(asUser(BOB), 'members', BOB), { designation: 'Board President' }));
    await assertFails(updateDoc(doc(asUser(BOB), 'members', BOB), { expiresAt: '2099-01-01' }));
  });

  it('public profile shows the joining date only exactly as recorded', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'members', CAROL), { joinedAt: '2020-05-01', designation: 'Researcher', memberNumber: 'M0000009' });
    });
    await assertSucceeds(updateDoc(doc(asUser(CAROL), 'public_profiles', CAROL), { memberSince: '2020-05-01', designation: 'Researcher', memberNumber: 'M0000009' }));
    await assertFails(updateDoc(doc(asUser(CAROL), 'public_profiles', CAROL), { memberSince: '2010-01-01' }));
    await assertFails(updateDoc(doc(asUser(CAROL), 'public_profiles', CAROL), { designation: 'Board President' }));
  });
});

// ---------------------------------------------------------------------------
describe('Personal notifications', () => {
  const pn = (userId: string, overrides: Record<string, unknown> = {}) => ({
    id: 'x', userId, type: 'application', title: 'Your application was approved', read: false, createdAt: NOW, ...overrides,
  });

  it('only the recipient can read or mark their notifications', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'user_notifications', 'n-bob'), pn(BOB, { id: 'n-bob' })); });
    await assertSucceeds(getDoc(doc(asUser(BOB), 'user_notifications', 'n-bob')));
    await assertFails(getDoc(doc(asUser(MALLORY), 'user_notifications', 'n-bob')));
    await assertFails(getDoc(doc(asAnon(), 'user_notifications', 'n-bob')));
    await assertSucceeds(updateDoc(doc(asUser(BOB), 'user_notifications', 'n-bob'), { read: true }));
    await assertFails(updateDoc(doc(asUser(BOB), 'user_notifications', 'n-bob'), { title: 'Changed' }));
    await assertSucceeds(getDocs(query(collection(asUser(BOB), 'user_notifications'), where('userId', '==', BOB))));
  });

  it('staff can notify others; ordinary users only themselves', async () => {
    await assertSucceeds(setDoc(doc(asUser(REVIEWER), 'user_notifications', 'r1'), pn(ALICE, { id: 'r1' })));
    await assertFails(setDoc(doc(asUser(MALLORY), 'user_notifications', 'm1'), pn(BOB, { id: 'm1' })));
    await assertSucceeds(setDoc(doc(asUser(BOB), 'user_notifications', 'b1'), pn(BOB, { id: 'b1', type: 'card' })));
    await assertFails(setDoc(doc(asUser(REVIEWER), 'user_notifications', 'r2'), pn(ALICE, { id: 'r2', read: true })));
  });

  it('read state for announcements belongs to each user', async () => {
    await assertSucceeds(setDoc(doc(asUser(BOB), 'notification_state', BOB), { readIds: ['a'], updatedAt: NOW }));
    await assertFails(setDoc(doc(asUser(MALLORY), 'notification_state', BOB), { readIds: [], updatedAt: NOW }));
  });
});

// ---------------------------------------------------------------------------
describe('Reactions and comments', () => {
  it('signed-in people react once per article; visitors cannot react', async () => {
    await assertSucceeds(setDoc(doc(asUser(MALLORY), 'articles', 'published-1', 'reactions', MALLORY), { type: 'solidarity', createdAt: NOW }));
    await assertSucceeds(setDoc(doc(asUser(MALLORY), 'articles', 'published-1', 'reactions', MALLORY), { type: 'like', createdAt: NOW }));
    await assertFails(setDoc(doc(asUser(MALLORY), 'articles', 'published-1', 'reactions', BOB), { type: 'like', createdAt: NOW }));
    await assertFails(setDoc(doc(asUser(MALLORY), 'articles', 'published-1', 'reactions', MALLORY), { type: 'angry', createdAt: NOW }));
    await assertFails(setDoc(doc(asUser(MALLORY), 'articles', 'draft-1', 'reactions', MALLORY), { type: 'like', createdAt: NOW }));
    await assertSucceeds(getDocs(collection(asAnon(), 'articles', 'published-1', 'reactions')));
  });

  const comment = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1', parentType: 'article', parentId: 'published-1', authorUid: MALLORY, authorName: 'Mallory', visitor: false,
    text: 'Thank you for this report.', status: 'visible', createdAt: NOW, ...overrides,
  });
  // A comment is written together with the person's rate-limit document.
  const post = (db: ReturnType<typeof asUser>, path: string[], c: Record<string, unknown>, uid: string) => {
    const batch = writeBatch(db);
    batch.set(doc(db, path.join('/')), c);
    batch.set(doc(db, 'comment_limits', uid), { lastAt: serverTimestamp() });
    return batch.commit();
  };
  const VISITOR = 'visitor-1';
  const asVisitor = (uid = VISITOR) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

  it('signed-in people can comment and reply on published articles only', async () => {
    const db = asUser(MALLORY);
    await assertSucceeds(post(db, ['articles', 'published-1', 'comments', 'c1'], comment(), MALLORY));
    await assertFails(post(asUser(CAROL), ['articles', 'draft-1', 'comments', 'c3'], comment({ id: 'c3', parentId: 'draft-1', authorUid: CAROL }), CAROL));
    await assertFails(post(asUser(CAROL), ['articles', 'published-1', 'comments', 'c4'], comment({ id: 'c4', authorUid: BOB }), CAROL));
    // Without the rate-limit document the comment is refused.
    await assertFails(setDoc(doc(asUser(BOB), 'articles', 'published-1', 'comments', 'c6'), comment({ id: 'c6', authorUid: BOB })));
    // Fully signed-out people cannot write at all.
    await assertFails(setDoc(doc(asAnon(), 'articles', 'published-1', 'comments', 'c5'), comment({ id: 'c5' })));
  });

  it('commenting too quickly is refused', async () => {
    const db = asUser(MALLORY);
    await assertSucceeds(post(db, ['articles', 'published-1', 'comments', 'q1'], comment({ id: 'q1' }), MALLORY));
    await assertFails(post(db, ['articles', 'published-1', 'comments', 'q2'], comment({ id: 'q2', replyTo: 'q1' }), MALLORY));
  });

  it('visitors can comment with a name, without links, and are not treated as signed in', async () => {
    const v = asVisitor();
    const vc = (o: Record<string, unknown> = {}) => comment({ id: 'v1', authorUid: VISITOR, authorName: 'Shilan', visitor: true, ...o });
    await assertFails(post(v, ['articles', 'published-1', 'comments', 'v1'], vc({ visitor: false }), VISITOR));
    await assertFails(post(v, ['articles', 'published-1', 'comments', 'v1'], vc({ text: 'Visit https://spam.example' }), VISITOR));
    await assertFails(post(v, ['articles', 'published-1', 'comments', 'v1'], vc({ text: '<script>alert(1)</script>' }), VISITOR));
    await assertSucceeds(post(v, ['articles', 'published-1', 'comments', 'v1'], vc(), VISITOR));
    await assertSucceeds(getDocs(query(collection(asAnon(), 'articles', 'published-1', 'comments'), where('status', '==', 'visible'))));
    // The visitor sign-in gives no other access.
    await assertFails(setDoc(doc(v, 'articles', 'published-1', 'reactions', VISITOR), { type: 'like', createdAt: NOW }));
    await assertFails(setDoc(doc(v, 'applications', `app-${VISITOR}`), validApplication(VISITOR)));
    await assertFails(updateDoc(doc(v, 'articles', 'published-1', 'comments', 'v1'), { text: 'changed', editedAt: NOW }));
    await assertSucceeds(deleteDoc(doc(v, 'articles', 'published-1', 'comments', 'v1')));
  });

  it('visitors and members can comment on published activities', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'news_banners', 'act-1'), { id: 'act-1', mode: 'announcement', message: 'Vigil', status: 'published', createdAt: NOW, updatedAt: NOW });
      await setDoc(doc(ctx.firestore(), 'news_banners', 'act-draft'), { id: 'act-draft', mode: 'announcement', message: 'Draft', status: 'draft', createdAt: NOW, updatedAt: NOW });
    });
    await assertSucceeds(post(asUser(CAROL), ['news_banners', 'act-1', 'comments', 'a1'], comment({ id: 'a1', parentType: 'activity', parentId: 'act-1', authorUid: CAROL }), CAROL));
    await assertSucceeds(post(asVisitor(), ['news_banners', 'act-1', 'comments', 'a2'], comment({ id: 'a2', parentType: 'activity', parentId: 'act-1', authorUid: VISITOR, visitor: true, authorName: 'Guest' }), VISITOR));
    await assertFails(post(asUser(BOB), ['news_banners', 'act-draft', 'comments', 'a3'], comment({ id: 'a3', parentType: 'activity', parentId: 'act-draft', authorUid: BOB }), BOB));
    // A comment cannot claim to belong to another page.
    await assertFails(post(asUser(BOB), ['news_banners', 'act-1', 'comments', 'a4'], comment({ id: 'a4', parentType: 'article', parentId: 'published-1', authorUid: BOB }), BOB));
  });

  it('moderators hide or delete comments; authors edit their own text only', async () => {
    await assertSucceeds(post(asUser(MALLORY), ['articles', 'published-1', 'comments', 'c1'], comment(), MALLORY));
    await assertFails(updateDoc(doc(asUser(BOB), 'articles', 'published-1', 'comments', 'c1'), { status: 'hidden' }));
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'articles', 'published-1', 'comments', 'c1'), { status: 'hidden' }));
    await assertFails(getDoc(doc(asAnon(), 'articles', 'published-1', 'comments', 'c1')));
    await assertSucceeds(updateDoc(doc(asUser(MALLORY), 'articles', 'published-1', 'comments', 'c1'), { text: 'Edited', editedAt: NOW }));
    await assertFails(updateDoc(doc(asUser(MALLORY), 'articles', 'published-1', 'comments', 'c1'), { status: 'visible' }));
    await assertFails(deleteDoc(doc(asUser(BOB), 'articles', 'published-1', 'comments', 'c1')));
    await assertSucceeds(getDocs(collectionGroup(asUser(EDITOR), 'comments')));
    await assertSucceeds(deleteDoc(doc(asUser(EDITOR), 'articles', 'published-1', 'comments', 'c1')));
  });

  it('administrators can stop visitors commenting', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'site_settings', 'default'), { interactions: { commentsEnabled: true, commentsMembersOnly: true, reactionsEnabled: true } });
    });
    await assertFails(post(asVisitor(), ['articles', 'published-1', 'comments', 'v9'], comment({ id: 'v9', authorUid: VISITOR, visitor: true }), VISITOR));
    await assertSucceeds(post(asUser(BOB), ['articles', 'published-1', 'comments', 'b1'], comment({ id: 'b1', authorUid: BOB }), BOB));
  });

  it('anyone, including visitors, can report a comment once; only moderators read reports', async () => {
    const rep = (uid: string) => ({ id: `c1__${uid}`, targetType: 'comment', parentType: 'article', articleId: 'published-1', commentId: 'c1', reason: 'Abusive', reporterUid: uid, status: 'open', createdAt: NOW });
    await assertSucceeds(setDoc(doc(asUser(MALLORY), 'reports', `c1__${MALLORY}`), rep(MALLORY)));
    await assertSucceeds(setDoc(doc(asVisitor(), 'reports', `c1__${VISITOR}`), rep(VISITOR)));
    await assertFails(setDoc(doc(asUser(MALLORY), 'reports', `c1__${MALLORY}`), rep(MALLORY)));
    await assertFails(setDoc(doc(asUser(MALLORY), 'reports', 'other-id'), { ...rep(MALLORY), id: 'other-id' }));
    await assertFails(getDoc(doc(asUser(MALLORY), 'reports', `c1__${MALLORY}`)));
    await assertSucceeds(getDoc(doc(asUser(EDITOR), 'reports', `c1__${MALLORY}`)));
  });
});

// ---------------------------------------------------------------------------
describe('Appreciation drafts stay private', () => {
  it('anyone can check issued, revoked and replaced letters; drafts only administrators', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'appreciation_awards', 'pub1'), { id: 'pub1', status: 'published', uid: CAROL });
      await setDoc(doc(db, 'appreciation_awards', 'old1'), { id: 'old1', status: 'superseded', uid: CAROL });
      await setDoc(doc(db, 'appreciation_awards', 'dr1'), { id: 'dr1', status: 'draft', uid: CAROL });
      await setDoc(doc(db, 'appreciation_awards', 'pe1'), { id: 'pe1', status: 'pending', uid: CAROL });
    });
    await assertSucceeds(getDoc(doc(asAnon(), 'appreciation_awards', 'pub1')));
    await assertSucceeds(getDoc(doc(asAnon(), 'appreciation_awards', 'old1')));
    await assertFails(getDoc(doc(asAnon(), 'appreciation_awards', 'dr1')));
    await assertFails(getDoc(doc(asUser(CAROL), 'appreciation_awards', 'pe1')));
    await assertSucceeds(getDoc(doc(asUser(ADMIN), 'appreciation_awards', 'dr1')));
    await assertFails(setDoc(doc(asUser(ADMIN), 'appreciation_awards', 'x1'), { id: 'x1', status: 'published' }));
  });
});

describe('Organisation structure appointments', () => {
  const seat = (id: string, o: Record<string, unknown>) => ({ id, memberId: CAROL, memberName: 'Carol', assignedAt: NOW, assignedBy: ADMIN, ...o });

  it('everyone can see appointments; only the website server makes them', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'org_assignments', 'board__president'), seat('board__president', { unit: 'board', positionId: 'president' })); });
    await assertSucceeds(getDocs(collection(asAnon(), 'org_assignments')));
    await assertFails(setDoc(doc(asUser(ADMIN), 'org_assignments', 'board__head_of_media'), seat('board__head_of_media', { unit: 'board', positionId: 'head_of_media' })));
    await assertFails(setDoc(doc(asUser(CAROL), 'org_assignments', 'board__head_of_media'), seat('board__head_of_media', { unit: 'board', positionId: 'head_of_media', assignedBy: CAROL })));
    await assertFails(setDoc(doc(asUser(REVIEWER), 'org_assignments', 'board__head_of_media'), seat('board__head_of_media', { unit: 'board', positionId: 'head_of_media', assignedBy: REVIEWER })));
    await assertFails(updateDoc(doc(asUser(ADMIN), 'org_assignments', 'board__president'), { memberId: BOB }));
    // Deleting a member permanently also clears their seats.
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN), 'org_assignments', 'board__president')));
  });

  it('position history is private to staff and the member, and written only by the server', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'position_history', 'ph1'), { id: 'ph1', memberId: CAROL, action: 'promoted' }); });
    await assertSucceeds(getDoc(doc(asUser(CAROL), 'position_history', 'ph1')));
    await assertSucceeds(getDoc(doc(asUser(REVIEWER), 'position_history', 'ph1')));
    await assertFails(getDoc(doc(asUser(BOB), 'position_history', 'ph1')));
    await assertFails(getDoc(doc(asAnon(), 'position_history', 'ph1')));
    await assertFails(setDoc(doc(asUser(ADMIN), 'position_history', 'ph2'), { id: 'ph2', memberId: CAROL }));
  });

  it('members keep valid records with the new and older position names', async () => {
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'members', CAROL), { positionId: 'media_supervisor', department: 'council', designation: 'Media Supervisor' }));
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'members', CAROL), { positionId: 'head_of_activities', department: 'activities' }));
    await assertFails(updateDoc(doc(asUser(ADMIN), 'members', CAROL), { positionId: 'emperor' }));
  });
});

// ---------------------------------------------------------------------------
describe('Media, events and the news banner', () => {
  const img = (owner: string, overrides: Record<string, unknown> = {}) => ({
    id: 'img1', dataUrl: 'data:image/jpeg;base64,AAAA', width: 10, height: 10, bytes: 4, ownerUid: owner, createdAt: NOW, ...overrides,
  });

  it('members and verified contributors can upload images; unverified accounts and visitors cannot', async () => {
    await assertSucceeds(setDoc(doc(asUser(BOB), 'media', 'img1'), img(BOB)));
    await assertSucceeds(setDoc(doc(asUser(MALLORY), 'media', 'img2'), img(MALLORY, { id: 'img2' })));
    const unverified = env.authenticatedContext(MALLORY, { email: 'm@example.com', email_verified: false }).firestore();
    await assertFails(setDoc(doc(unverified, 'media', 'img4'), img(MALLORY, { id: 'img4' })));
    await assertFails(setDoc(doc(asAnon(), 'media', 'img5'), img(MALLORY, { id: 'img5' })));
    await assertFails(setDoc(doc(asUser(BOB), 'media', 'img3'), img(BOB, { id: 'img3', dataUrl: 'javascript:alert(1)' })));
    await assertSucceeds(getDoc(doc(asAnon(), 'media', 'img1')));
    await assertFails(getDocs(collection(asAnon(), 'media')));
  });

  const event = { id: 'e1', title: 'Workshop', description: 'Know your rights', type: 'workshop', startAt: '2026-11-15T18:00:00Z', status: 'published', createdBy: ADMIN, createdAt: NOW, updatedAt: NOW };

  it('only event managers create events; published ones are public', async () => {
    await assertFails(setDoc(doc(asUser(BOB), 'events', 'e1'), event));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'events', 'e1'), event));
    await assertSucceeds(getDocs(query(collection(asAnon(), 'events'), where('status', 'in', ['published', 'cancelled']))));
  });

  const banner = { id: 'b1', mode: 'announcement', message: 'Workshop on 15 November', status: 'published', createdAt: NOW, updatedAt: NOW };

  it('only publishers manage the news banner; published banners are public', async () => {
    await assertFails(setDoc(doc(asUser(BOB), 'news_banners', 'b1'), banner));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'news_banners', 'b1'), banner));
    await assertFails(setDoc(doc(asUser(ADMIN), 'news_banners', 'b2'), { ...banner, id: 'b2', mode: 'flashing' }));
    await assertSucceeds(getDocs(query(collection(asAnon(), 'news_banners'), where('status', '==', 'published'))));
  });

  it('an activity announcement can carry its date, but no unexpected fields', async () => {
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'news_banners', 'b3'), { ...banner, id: 'b3', eventAt: NOW, startAt: NOW, endAt: NOW, videoUrl: 'https://youtu.be/dQw4w9WgXcQ', location: 'Erbil', details: 'Bring a friend' }));
    await assertFails(setDoc(doc(asUser(ADMIN), 'news_banners', 'b4'), { ...banner, id: 'b4', html: '<script>' }));
  });

  it('staff can award points but members cannot', async () => {
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'users', BOB), { activityScore: 115, activityTier: 'Silver', updatedAt: NOW }));
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'public_profiles', CAROL), { points: { all: 100 }, updatedAt: NOW }));
    await assertFails(updateDoc(doc(asUser(CAROL), 'public_profiles', CAROL), { points: { all: 9999 } }));
  });
});

// ---------------------------------------------------------------------------
describe('Activity answers: attending or cannot attend', () => {
  const activity = { id: 'act1', mode: 'announcement', message: 'Workshop', status: 'published', attendeeCount: 0, createdAt: NOW, updatedAt: NOW };
  const reg = (uid: string, status: string) => ({ userId: uid, name: 'Member', chapterId: 'britain', status, createdAt: NOW });
  const seed = async (extra: Record<string, unknown> = {}) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'news_banners', 'act1'), { ...activity, ...extra });
    });
  };
  const answer = (db: ReturnType<typeof asUser>, uid: string, status: string, delta: number) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'news_banners', 'act1', 'registrations', uid), reg(uid, status));
    if (delta) batch.update(doc(db, 'news_banners', 'act1'), { attendeeCount: increment(delta) });
    return batch.commit();
  };

  it('a member answers attending; the count moves by exactly one, once', async () => {
    await seed();
    const db = asUser(CAROL);
    await assertSucceeds(answer(db, CAROL, 'attending', 1));
    await assertFails(answer(db, CAROL, 'attending', 1));
  });

  it('cannot attend does not change the attending count; switching moves it', async () => {
    await seed();
    const db = asUser(CAROL);
    await assertFails(answer(db, CAROL, 'not_attending', 1));
    await assertSucceeds(answer(db, CAROL, 'not_attending', 0));
    await assertSucceeds(answer(db, CAROL, 'attending', 1));
    await assertSucceeds(answer(db, CAROL, 'not_attending', -1));
  });

  it('nobody can inflate the count, answer for someone else, or confirm their own attendance', async () => {
    await seed();
    await assertFails(updateDoc(doc(asUser(CAROL), 'news_banners', 'act1'), { attendeeCount: 50 }));
    await assertFails(answer(asUser(CAROL), BOB, 'attending', 1));
    await assertSucceeds(answer(asUser(CAROL), CAROL, 'attending', 1));
    await assertFails(updateDoc(doc(asUser(CAROL), 'news_banners', 'act1', 'registrations', CAROL), { attended: true }));
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'news_banners', 'act1', 'registrations', CAROL), { attended: true, attendedAt: NOW, attendedBy: ADMIN }));
  });

  it('answers are public; visitors cannot answer; closed responses are respected', async () => {
    await seed();
    await assertSucceeds(answer(asUser(CAROL), CAROL, 'attending', 1));
    await assertSucceeds(getDocs(collection(asAnon(), 'news_banners', 'act1', 'registrations')));
    await assertSucceeds(getDocs(query(collectionGroup(asAnon(), 'registrations'), where('userId', '==', CAROL))));
    await assertFails(setDoc(doc(asAnon(), 'news_banners', 'act1', 'registrations', 'anon'), reg('anon', 'attending')));
    await seed({ registrationOpen: false });
    await assertFails(answer(asUser(BOB), BOB, 'attending', 1));
  });

  it('anyone can be counted as a viewer once; only organisers see the list', async () => {
    await seed();
    await assertSucceeds(setDoc(doc(asAnon(), 'news_banners', 'act1', 'views', 'v-device-1'), { at: NOW, member: false }));
    await assertFails(setDoc(doc(asAnon(), 'news_banners', 'act1', 'views', 'v-device-1'), { at: NOW, member: false }));
    await assertFails(setDoc(doc(asAnon(), 'news_banners', 'act1', 'views', 'v-device-2'), { at: NOW, member: true }));
    await assertFails(getDocs(collection(asUser(CAROL), 'news_banners', 'act1', 'views')));
    await assertSucceeds(getDocs(collection(asUser(ADMIN), 'news_banners', 'act1', 'views')));
  });
});

// ---------------------------------------------------------------------------
describe('Points ledger', () => {
  const entry = (uid: string, extra: Record<string, unknown> = {}) => ({
    id: `${uid}__article_reaction__published-1`, userId: uid, type: 'article_reaction', points: 10, targetId: 'published-1',
    periodMonth: 'm202610', periodQuarter: 'q20264', createdAt: NOW, awardedBy: uid, ...extra,
  });
  const react = (db: ReturnType<typeof asUser>, uid: string, opts: { points?: number; total?: number; id?: string } = {}) => {
    const id = opts.id || `${uid}__article_reaction__published-1`;
    const batch = writeBatch(db);
    batch.set(doc(db, 'articles', 'published-1', 'likes', uid), { createdAt: NOW });
    batch.update(doc(db, 'articles', 'published-1'), { likesCount: increment(1) });
    batch.set(doc(db, 'points_ledger', id), entry(uid, { id, points: opts.points ?? 10 }));
    batch.update(doc(db, 'public_profiles', uid), {
      'points.all': increment(opts.total ?? 10), 'points.m202610': increment(opts.total ?? 10), 'points.q20264': increment(opts.total ?? 10),
      lastAward: id, activityTier: 'Bronze I', updatedAt: NOW,
    });
    return batch.commit();
  };

  it('a member earns 10 points for reacting to an article, only once', async () => {
    await assertSucceeds(react(asUser(CAROL), CAROL));
    // Unlike and like again: the like works, but no second award is possible.
    const db = asUser(CAROL);
    const un = writeBatch(db);
    un.delete(doc(db, 'articles', 'published-1', 'likes', CAROL));
    un.update(doc(db, 'articles', 'published-1'), { likesCount: increment(-1) });
    await assertSucceeds(un.commit());
    await assertFails(react(db, CAROL));
  });

  it('members cannot award themselves more points or other kinds of points', async () => {
    await assertFails(react(asUser(CAROL), CAROL, { points: 100, total: 100 }));
    await assertFails(react(asUser(CAROL), CAROL, { total: 50 }));
    await assertFails(setDoc(doc(asUser(CAROL), 'points_ledger', `${CAROL}__article_published__x`), entry(CAROL, { id: `${CAROL}__article_published__x`, type: 'article_published', points: 25 })));
    await assertFails(updateDoc(doc(asUser(CAROL), 'public_profiles', CAROL), { 'points.all': 1000 }));
  });

  it('authors earn nothing for reacting to their own article', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'public_profiles', BOB), { id: BOB, userId: BOB, displayName: 'Bob', chapterId: 'britain', updatedAt: NOW });
      await updateDoc(doc(ctx.firestore(), 'members', BOB), { consentToDirectory: true });
    });
    await assertFails(react(asUser(BOB), BOB));
  });

  it('members read only their own ledger; staff award and reverse', async () => {
    await assertSucceeds(react(asUser(CAROL), CAROL));
    await assertSucceeds(getDoc(doc(asUser(CAROL), 'points_ledger', `${CAROL}__article_reaction__published-1`)));
    await assertFails(getDoc(doc(asUser(BOB), 'points_ledger', `${CAROL}__article_reaction__published-1`)));
    await assertSucceeds(getDocs(query(collection(asUser(CAROL), 'points_ledger'), where('userId', '==', CAROL))));
    await assertFails(getDocs(collection(asUser(CAROL), 'points_ledger')));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'points_ledger', `${CAROL}__activity_attendance__act1`), entry(CAROL, { id: `${CAROL}__activity_attendance__act1`, type: 'activity_attendance', targetId: 'act1', awardedBy: ADMIN })));
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN), 'points_ledger', `${CAROL}__activity_attendance__act1`)));
    await assertFails(deleteDoc(doc(asUser(CAROL), 'points_ledger', `${CAROL}__article_reaction__published-1`)));
  });
});

// ---------------------------------------------------------------------------
describe('Share claims', () => {
  const claim = (uid: string, extra: Record<string, unknown> = {}) => ({
    id: `${uid}__article_published-1`, userId: uid, targetType: 'article', targetId: 'published-1', targetTitle: 'A report',
    platform: 'facebook', url: 'https://www.facebook.com/x/posts/1', status: 'pending', createdAt: NOW, ...extra,
  });

  it('a member claims once per item; only staff approve', async () => {
    await assertSucceeds(setDoc(doc(asUser(CAROL), 'share_claims', `${CAROL}__article_published-1`), claim(CAROL)));
    await assertFails(setDoc(doc(asUser(CAROL), 'share_claims', `${CAROL}__article_published-1`), claim(CAROL)));
    await assertFails(setDoc(doc(asUser(CAROL), 'share_claims', `${CAROL}__article_published-2`), claim(CAROL, { status: 'approved', id: `${CAROL}__article_published-2`, targetId: 'published-2' })));
    await assertFails(updateDoc(doc(asUser(CAROL), 'share_claims', `${CAROL}__article_published-1`), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'share_claims', `${CAROL}__article_published-1`), { status: 'rejected', reviewedBy: ADMIN, reviewedAt: NOW, reviewNote: 'Not public' }));
    await assertSucceeds(updateDoc(doc(asUser(CAROL), 'share_claims', `${CAROL}__article_published-1`), { url: 'https://www.facebook.com/x/posts/2', platform: 'facebook', status: 'pending', createdAt: NOW }));
  });

  it('visitors and non-members cannot claim, and links must be https', async () => {
    await assertFails(setDoc(doc(asUser(ALICE), 'share_claims', `${ALICE}__article_published-1`), claim(ALICE)));
    await assertFails(setDoc(doc(asUser(CAROL), 'share_claims', `${CAROL}__article_published-1`), claim(CAROL, { url: 'javascript:alert(1)' })));
  });
});

// ---------------------------------------------------------------------------
describe('Permanently deleting a member', () => {
  it('only administrators can remove a member and their records', async () => {
    await assertFails(deleteDoc(doc(asUser(REVIEWER), 'members', CAROL)));
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN), 'members', CAROL)));
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN), 'users', CAROL)));
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN), 'notification_state', CAROL)));
    await assertSucceeds(getDocs(collectionGroup(asUser(ADMIN), 'likes')));
    await assertFails(getDocs(collectionGroup(asUser(CAROL), 'likes')));
  });

  it('the deleted-account marker is set by admins and read by the person', async () => {
    await assertFails(setDoc(doc(asUser(CAROL), 'deleted_accounts', BOB), { deletedAt: NOW, deletedBy: CAROL }));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'deleted_accounts', BOB), { deletedAt: NOW, deletedBy: ADMIN }));
    await assertSucceeds(getDoc(doc(asUser(BOB), 'deleted_accounts', BOB)));
    await assertFails(getDoc(doc(asUser(CAROL), 'deleted_accounts', BOB)));
  });
});

// ---------------------------------------------------------------------------
describe('Visitor submissions and publication fees', () => {
  const work = (id: string, o: Record<string, unknown> = {}) => article({
    id, authorUid: MALLORY, authorDisplayName: 'Mallory', contributorType: 'visitor', feeCategory: 'article', contentType: 'article', status: 'awaiting_payment', ...o,
  });
  const pay = (id: string, o: Record<string, unknown> = {}) => ({
    id, articleId: id, uid: MALLORY, category: 'article', amountPence: 1500, standardPence: 1500, tier: 'standard',
    reference: '17S-ABCD23', status: 'awaiting', title: 'A report', createdAt: NOW, updatedAt: NOW, ...o,
  });
  const submit = (db: ReturnType<typeof asUser>, id: string, a: Record<string, unknown>, p: Record<string, unknown>) => {
    const b = writeBatch(db);
    b.set(doc(db, 'articles', id), a);
    b.set(doc(db, 'submission_payments', id), p);
    return b.commit();
  };
  const stats = (articles: number, videos: number) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'contributor_stats', MALLORY), { uid: MALLORY, articles, videos, updatedAt: NOW });
  });

  // Earlier submissions from contributor accounts, already in the database.
  const seedLegacy = (id: string) => env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'articles', id), work(id));
    await setDoc(doc(db, 'submission_payments', id), pay(id));
  });

  it('1. new work can no longer be sent from a contributor account (Publish with Us needs no account)', async () => {
    const db = asUser(MALLORY);
    await assertFails(submit(db, 'v1', work('v1'), pay('v1')));
    await stats(20, 0);
    await assertFails(submit(db, 'f1', work('f1', { status: 'submitted' }), pay('f1', { amountPence: 0, tier: 'free', status: 'waived' })));
  });

  it('6. members submit without any fee, and cannot pose as visitors', async () => {
    const db = asUser(BOB);
    await assertSucceeds(setDoc(doc(db, 'articles', 'm1'), article({ id: 'm1', status: 'submitted' })));
    await assertFails(setDoc(doc(db, 'articles', 'm2'), article({ id: 'm2', status: 'submitted', contributorType: 'visitor' })));
  });

  it('7. unpaid and unapproved submissions are invisible to the public', async () => {
    await seedLegacy('h1');
    await assertFails(getDoc(doc(asAnon(), 'articles', 'h1')));
    await assertFails(getDoc(doc(asUser(CAROL), 'articles', 'h1')));
    await assertSucceeds(getDoc(doc(asAnon(), 'articles', 'published-1')));
  });

  it('a visitor cannot release their own unpaid submission; finance administrators confirm payment', async () => {
    const db = asUser(MALLORY);
    await seedLegacy('p1');
    await assertFails(updateDoc(doc(db, 'articles', 'p1'), { status: 'submitted', updatedAt: NOW }));
    await assertFails(updateDoc(doc(asUser(EDITOR), 'articles', 'p1'), { status: 'submitted' }));
    await assertSucceeds(updateDoc(doc(db, 'submission_payments', 'p1'), { status: 'claimed', claimedAt: NOW, payerNote: 'Paid by bank transfer today', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db, 'submission_payments', 'p1'), { status: 'verified' }));
    await assertFails(updateDoc(doc(db, 'submission_payments', 'p1'), { amountPence: 1 }));
    const admin = asUser(ADMIN);
    await assertFails(updateDoc(doc(admin, 'submission_payments', 'p1'), { amountPence: 100 }));
    const b = writeBatch(admin);
    b.update(doc(admin, 'submission_payments', 'p1'), { status: 'verified', verifiedAt: NOW, updatedAt: NOW });
    b.update(doc(admin, 'articles', 'p1'), { status: 'submitted', updatedAt: NOW });
    await assertSucceeds(b.commit());
    await assertFails(deleteDoc(doc(admin, 'submission_payments', 'p1')));
  });

  it('8. counts change only through the editors, and each submission counts once', async () => {
    await assertFails(setDoc(doc(asUser(MALLORY), 'contributor_stats', MALLORY), { uid: MALLORY, articles: 25, videos: 25, updatedAt: NOW }));
    await assertFails(setDoc(doc(asUser(MALLORY), 'contribution_records', 'r1'), { id: 'r1', uid: MALLORY, category: 'article' }));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'contribution_records', 'r1'), { id: 'r1', uid: MALLORY, category: 'article' }));
    await assertFails(setDoc(doc(asUser(ADMIN), 'contribution_records', 'r1'), { id: 'r1', uid: MALLORY, category: 'article' }));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'contributor_stats', MALLORY), { uid: MALLORY, articles: 1, videos: 0, updatedAt: NOW }));
  });

  it('9. payment records stay private', async () => {
    await seedLegacy('q1');
    await assertSucceeds(getDoc(doc(asUser(MALLORY), 'submission_payments', 'q1')));
    await assertFails(getDoc(doc(asAnon(), 'submission_payments', 'q1')));
    await assertFails(getDoc(doc(asUser(CAROL), 'submission_payments', 'q1')));
    await assertFails(getDoc(doc(asUser(EDITOR), 'submission_payments', 'q1')));
    await assertSucceeds(getDoc(doc(asUser(ADMIN), 'submission_payments', 'q1')));
  });

  it('11. security reports are for administrators only', async () => {
    await assertSucceeds(setDoc(doc(asUser(EDITOR), 'security_events', 's1'), { id: 's1', kind: 'suspicious_submission', status: 'open', createdAt: NOW }));
    await assertFails(getDoc(doc(asUser(EDITOR), 'security_events', 's1')));
    await assertSucceeds(getDoc(doc(asUser(ADMIN), 'security_events', 's1')));
    await assertFails(deleteDoc(doc(asUser(ADMIN), 'security_events', 's1')));
  });
});

// ---------------------------------------------------------------------------
describe('Publish with Us without an account', () => {
  const GUEST = 'guest-browser-1';
  const asGuest = (uid = GUEST) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const ID = 'gs_abcdefghijklmnopqrstuvwx';
  const ID2 = 'gs_bcdefghijklmnopqrstuvwxy';
  // The one-way code for the contributor's email, as the website and rules make it.
  const KEY = `guest-${createHash('sha256').update('rezan@example.org').digest('hex')}`;
  const FEE = { status: 'awaiting', amountPence: 1500, standardPence: 1500, tier: 'standard', reference: '17S-ABCD23' };
  // New work: sent with its fee, waiting for payment before review.
  const sub = (id = ID, o: Record<string, unknown> = {}) => ({
    id, kind: 'article', feeCategory: 'article', title: 'Report from Sulaymaniyah', excerpt: 'Summary', content: 'Body '.repeat(60),
    topic: 'legal', direction: 'ltr', language: 'en', images: [],
    contact: { name: 'Rezan', email: 'rezan@example.org' },
    terms: { accepted: true, privacy: true, version: '2026-10' },
    status: 'awaiting_payment', payment: FEE, contributorKey: KEY, priorCount: 0, ownerUid: GUEST,
    createdAt: NOW, updatedAt: NOW, history: [{ at: NOW, action: 'Sent; waiting for the publication fee', by: 'contributor' }],
    ...o,
  });
  // Work sent before payment-first publishing (no fee set yet).
  const old = (id = ID, o: Record<string, unknown> = {}) => {
    const { contributorKey: _k, priorCount: _p, ...rest } = sub(id, { status: 'submitted', payment: { status: 'not_due' }, ...o }) as Record<string, unknown>;
    return rest;
  };
  const published = (articles: number, videos = 0) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'contributor_stats', KEY), { uid: KEY, articles, videos, updatedAt: NOW });
  });
  const send = (db: ReturnType<typeof asGuest>, data: Record<string, unknown>, uid = GUEST) => {
    const b = writeBatch(db);
    b.set(doc(db, 'submission_limits', uid), { lastSubmissionAt: serverTimestamp() }, { merge: true });
    b.set(doc(db, 'guest_submissions', data.id as string), data);
    return b.commit();
  };
  const seed = (data: Record<string, unknown>) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'guest_submissions', data.id as string), data);
  });
  const step = (s: Record<string, unknown>, action: string) => [...(s.history as unknown[]), { at: NOW, action, by: 'editor' }];
  const approved = (o: Record<string, unknown> = {}) => old(ID, {
    status: 'approved', payment: { status: 'awaiting', amountPence: 1500, standardPence: 1500, tier: 'standard', reference: '17S-ABCD23' }, ...o,
  });

  it('a visitor sends work without an account; the private link reads it; the public cannot list submissions', async () => {
    await assertSucceeds(send(asGuest(), sub()));
    await assertSucceeds(getDoc(doc(asAnon(), 'guest_submissions', ID)));
    await assertFails(getDocs(collection(asAnon(), 'guest_submissions')));
    await assertFails(getDocs(collection(asUser(CAROL), 'guest_submissions')));
    await assertSucceeds(getDocs(collection(asUser(EDITOR), 'guest_submissions')));
  });

  it('work is sent with the fee from the central pricing, waiting for payment', async () => {
    const db = asGuest();
    await assertFails(send(db, sub(ID, { status: 'approved' })));
    await assertFails(send(db, sub(ID, { status: 'submitted' })));
    await assertFails(send(db, sub(ID, { payment: { status: 'not_due' } })));
    await assertFails(send(db, sub(ID, { payment: { ...FEE, amountPence: 1000 } })));
    await assertFails(send(db, sub(ID, { payment: { ...FEE, amountPence: 1125, tier: 'discount' } })));
    await assertFails(send(db, sub(ID, { payment: { status: 'waived', amountPence: 0, standardPence: 1500, tier: 'free', reference: '17S-ABCD23' }, status: 'submitted' })));
    await assertFails(send(db, sub(ID, { payment: { ...FEE, status: 'verified' } })));
    await assertFails(send(db, sub(ID, { priorCount: 20 })));
    await assertFails(send(db, sub(ID, { contributorKey: `guest-${'0'.repeat(64)}` })));
    await assertFails(send(db, sub(ID, { kind: 'video', feeCategory: 'video', videoUrl: 'https://youtu.be/abcdefghijk' })));
    await assertSucceeds(send(db, sub(ID, { kind: 'video', feeCategory: 'video', videoUrl: 'https://youtu.be/abcdefghijk', payment: { ...FEE, amountPence: 2500, standardPence: 2500 } })));
  });

  it('discounts and free publication follow the published count under the same email', async () => {
    await published(5);
    await assertFails(send(asGuest('b1'), sub(ID, { ownerUid: 'b1', priorCount: 5 }), 'b1'));
    await assertSucceeds(send(asGuest('b2'), sub(ID, { ownerUid: 'b2', priorCount: 5, payment: { ...FEE, amountPence: 1125, tier: 'discount' } }), 'b2'));
    await published(20);
    await assertFails(send(asGuest('b3'), sub(ID2, { id: ID2, ownerUid: 'b3', priorCount: 20, payment: { ...FEE, amountPence: 1125, tier: 'discount' } }), 'b3'));
    await assertSucceeds(send(asGuest('b4'), sub(ID2, { id: ID2, ownerUid: 'b4', priorCount: 20, status: 'submitted', payment: { status: 'waived', amountPence: 0, standardPence: 1500, tier: 'free', reference: '17S-ABCD23' } }), 'b4'));
    // Anyone can read the count for an email code (two numbers), not list them.
    await assertSucceeds(getDoc(doc(asAnon(), 'contributor_stats', KEY)));
    await assertFails(getDocs(collection(asAnon(), 'contributor_stats')));
  });

  it('paid work reaches the editors only after finance confirms the payment', async () => {
    const s = sub();
    await seed(s);
    const ed = asUser(EDITOR);
    await assertFails(updateDoc(doc(ed, 'guest_submissions', ID), { status: 'under_review', history: step(s, 'Review') }));
    await assertFails(updateDoc(doc(ed, 'guest_submissions', ID), { status: 'approved', history: step(s, 'Approved') }));
    // The contributor reports paying; only finance can confirm.
    const claimed = { ...FEE, status: 'claimed', claimedAt: NOW };
    await assertSucceeds(updateDoc(doc(asGuest('phone'), 'guest_submissions', ID), { payment: claimed, updatedAt: NOW, history: step(s, 'Paid') }));
    const c = { ...s, payment: claimed, history: step(s, 'Paid') };
    await assertFails(updateDoc(doc(asGuest('phone'), 'guest_submissions', ID), { status: 'submitted', history: step(c, 'x') }));
    await assertFails(updateDoc(doc(ed, 'guest_submissions', ID), { status: 'submitted', payment: { ...claimed, status: 'verified' }, history: step(c, 'v') }));
    await assertFails(updateDoc(doc(asUser(ADMIN), 'guest_submissions', ID), { status: 'submitted', history: step(c, 'v') }));
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'guest_submissions', ID), { status: 'submitted', payment: { ...claimed, status: 'verified' }, history: step(c, 'Payment confirmed') }));
    const paid = { ...c, status: 'submitted', payment: { ...claimed, status: 'verified' }, history: step(c, 'Payment confirmed') };
    // Now the editors review and approve, without touching the payment; then it is published.
    await assertSucceeds(updateDoc(doc(ed, 'guest_submissions', ID), { status: 'approved', history: step(paid, 'Approved') }));
    const ok = { ...paid, status: 'approved', history: step(paid, 'Approved') };
    await assertSucceeds(updateDoc(doc(asUser(PUBLISHER), 'guest_submissions', ID), { status: 'published', articleId: 'art-g-1', history: step(ok, 'Published') }));
  });

  it('unpaid work can be withdrawn by the contributor or turned away by the editors', async () => {
    const s = sub();
    await seed(s);
    await assertSucceeds(updateDoc(doc(asGuest('x'), 'guest_submissions', ID), { status: 'withdrawn', updatedAt: NOW, history: step(s, 'Withdrawn') }));
    await seed(sub(ID2, { id: ID2 }));
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID2), { status: 'rejected', editorNote: 'Spam', history: step(sub(ID2), 'Not accepted') }));
  });

  it('a submission needs accepted terms and valid contact details', async () => {
    const db = asGuest();
    await assertFails(send(db, sub(ID, { terms: { accepted: false, privacy: true, version: '2026-10' } })));
    await assertFails(send(db, sub(ID, { contact: { name: 'R', email: 'not-an-email' } })));
    await assertFails(send(db, sub(ID, { roles: ['member'] })));
    await assertFails(send(db, sub('gs_short', { id: 'gs_short' })));
    await assertFails(send(db, sub(ID, { ownerUid: 'someone-else' })));
    await assertFails(send(db, sub(ID, { feeCategory: 'article', kind: 'video' })));
    // Without the rate-limit record in the same write.
    await assertFails(setDoc(doc(db, 'guest_submissions', ID), sub()));
    await assertSucceeds(send(db, sub()));
  });

  it('one submission a minute from each browser', async () => {
    await assertSucceeds(send(asGuest(), sub()));
    await assertFails(send(asGuest(), sub(ID2, { id: ID2 })));
  });

  it('the contributor cannot approve, price or publish their own work, or change their contact details', async () => {
    await seed(sub());
    const db = asGuest('another-browser');
    const s = sub();
    await assertFails(updateDoc(doc(db, 'guest_submissions', ID), { status: 'approved', history: step(s, 'x') }));
    await assertFails(updateDoc(doc(db, 'guest_submissions', ID), { payment: { status: 'waived', amountPence: 0, standardPence: 1500, tier: 'free', reference: '17S-ABCD23' }, history: step(s, 'x') }));
    await assertFails(updateDoc(doc(db, 'guest_submissions', ID), { status: 'published', articleId: 'a', history: step(s, 'x') }));
    await assertFails(updateDoc(doc(asAnon(), 'guest_submissions', ID), { status: 'withdrawn', history: step(s, 'x') }));
  });

  it('older work without a fee: editors approve with the fee from the central pricing; other amounts are refused', async () => {
    await seed(old());
    const ed = asUser(EDITOR);
    const s = old();
    const approve = (payment: Record<string, unknown>) => updateDoc(doc(ed, 'guest_submissions', ID), { status: 'approved', payment, history: step(s, 'Approved') });
    await assertFails(approve({ status: 'awaiting', amountPence: 1000, standardPence: 1500, tier: 'standard', reference: '17S-ABCD23' }));
    await assertFails(approve({ status: 'awaiting', amountPence: 0, standardPence: 1500, tier: 'free', reference: '17S-ABCD23' }));
    await assertFails(approve({ status: 'awaiting', amountPence: 2500, standardPence: 2500, tier: 'standard', reference: '17S-ABCD23' }));
    await assertFails(updateDoc(doc(ed, 'guest_submissions', ID), { status: 'approved', history: step(s, 'Approved') }));
    await assertSucceeds(approve({ status: 'awaiting', amountPence: 1125, standardPence: 1500, tier: 'discount', reference: '17S-ABCD23' }));
  });

  it('older work: free publication after the threshold is recorded as no fee due; videos use the video fee', async () => {
    await seed(old());
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID), {
      status: 'approved', payment: { status: 'waived', amountPence: 0, standardPence: 1500, tier: 'free', reference: '17S-ABCD23' }, history: step(old(), 'Approved'),
    }));
    await seed(old(ID2, { id: ID2, kind: 'video', feeCategory: 'video', videoUrl: 'https://youtu.be/abcdefghijk' }));
    await assertFails(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID2), {
      status: 'approved', payment: { status: 'awaiting', amountPence: 1500, standardPence: 1500, tier: 'standard', reference: '17S-ABCD24' }, history: step(sub(), 'Approved'),
    }));
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID2), {
      status: 'approved', payment: { status: 'awaiting', amountPence: 2500, standardPence: 2500, tier: 'standard', reference: '17S-ABCD24' }, history: step(sub(), 'Approved'),
    }));
  });

  it('nothing is published before payment is confirmed; then a publisher publishes it', async () => {
    const a = approved();
    await seed(a);
    const pub = asUser(PUBLISHER);
    await assertFails(updateDoc(doc(pub, 'guest_submissions', ID), { status: 'published', articleId: 'art-g-1', history: step(a, 'Published') }));
    // The contributor reports the payment, but cannot confirm it.
    const g = asGuest('phone-browser');
    const claimed = { ...a.payment as Record<string, unknown>, status: 'claimed', claimedAt: NOW, payerNote: 'Bank transfer today' };
    await assertFails(updateDoc(doc(g, 'guest_submissions', ID), { payment: { ...claimed, status: 'verified' }, history: step(a, 'x') }));
    await assertFails(updateDoc(doc(g, 'guest_submissions', ID), { payment: { ...claimed, amountPence: 1 }, history: step(a, 'x') }));
    await assertSucceeds(updateDoc(doc(g, 'guest_submissions', ID), { payment: claimed, updatedAt: NOW, history: step(a, 'Paid') }));
    // Editors cannot confirm payments; finance can, without changing the amount.
    const afterClaim = { ...a, payment: claimed, history: step(a, 'Paid') };
    await assertFails(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID), { payment: { ...claimed, status: 'verified' }, history: step(afterClaim, 'v') }));
    const fin = asUser(ADMIN);
    await assertFails(updateDoc(doc(fin, 'guest_submissions', ID), { payment: { ...claimed, status: 'verified', amountPence: 100 }, history: step(afterClaim, 'v') }));
    await assertSucceeds(updateDoc(doc(fin, 'guest_submissions', ID), { payment: { ...claimed, status: 'verified' }, history: step(afterClaim, 'Verified') }));
    const paid = { ...afterClaim, payment: { ...claimed, status: 'verified' }, history: step(afterClaim, 'Verified') };
    // Content reviewers cannot publish; publishers can, with the published article's id.
    await assertFails(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID), { status: 'published', articleId: 'art-g-1', history: step(paid, 'Published') }));
    await assertFails(updateDoc(doc(pub, 'guest_submissions', ID), { status: 'published', history: step(paid, 'Published') }));
    await assertSucceeds(updateDoc(doc(pub, 'guest_submissions', ID), { status: 'published', articleId: 'art-g-1', history: step(paid, 'Published') }));
  });

  it('the history can only grow', async () => {
    const a = approved();
    await seed(a);
    await assertFails(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID), { editorNote: 'x', history: [] }));
    await assertFails(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID), { editorNote: 'x' }));
    await assertSucceeds(updateDoc(doc(asUser(EDITOR), 'guest_submissions', ID), { editorNote: 'x', history: step(a, 'Note') }));
  });

  it('the contributor makes requested changes and can withdraw before publication', async () => {
    const c = old(ID, { status: 'changes_requested', editorNote: 'Please add sources.' });
    await seed(c);
    const g = asGuest('laptop');
    await assertFails(updateDoc(doc(g, 'guest_submissions', ID), { content: 'New text', status: 'approved', history: step(c, 'x') }));
    await assertSucceeds(updateDoc(doc(g, 'guest_submissions', ID), { content: 'New text with sources', sourceLinks: 'https://example.org', status: 'submitted', updatedAt: NOW, history: step(c, 'Resubmitted') }));
    const r = { ...c, content: 'New text with sources', sourceLinks: 'https://example.org', status: 'submitted', history: step(c, 'Resubmitted') };
    await assertSucceeds(updateDoc(doc(g, 'guest_submissions', ID), { status: 'withdrawn', updatedAt: NOW, history: step(r, 'Withdrawn') }));
  });

  it('contributors are never members: a visitor browser cannot write member, role or card records', async () => {
    const g = asGuest();
    await assertFails(setDoc(doc(g, 'members', GUEST), { id: GUEST, userId: GUEST, status: 'active' }));
    await assertFails(setDoc(doc(g, 'users', GUEST), { uid: GUEST, roles: ['visitor'], permissions: [] }));
    await assertFails(setDoc(doc(g, 'public_profiles', GUEST), { id: GUEST, userId: GUEST, displayName: 'x' }));
    await assertFails(setDoc(doc(g, 'verifications', '17S-00002'), { memberNumber: '17S-00002' }));
  });

  it('photos: the sender and the editors can see them, nobody else; one every few seconds', async () => {
    const g = asGuest();
    const img = (id: string) => ({ id, dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1, bytes: 3, ownerUid: GUEST, createdAt: NOW });
    const upload = (id: string) => {
      const b = writeBatch(g);
      b.set(doc(g, 'submission_limits', GUEST), { lastImageAt: serverTimestamp() }, { merge: true });
      b.set(doc(g, 'guest_media', id), img(id));
      return b.commit();
    };
    await assertSucceeds(upload('gm_abc12345xyz'));
    await assertFails(upload('gm_abc12345xy2'));
    await assertSucceeds(getDoc(doc(g, 'guest_media', 'gm_abc12345xyz')));
    await assertSucceeds(getDoc(doc(asUser(EDITOR), 'guest_media', 'gm_abc12345xyz')));
    await assertFails(getDoc(doc(asAnon(), 'guest_media', 'gm_abc12345xyz')));
    await assertFails(getDoc(doc(asGuest('other'), 'guest_media', 'gm_abc12345xyz')));
    await assertFails(setDoc(doc(g, 'guest_media', 'gm_nolimit1'), img('gm_nolimit1')));
  });
});

// ---------------------------------------------------------------------------
describe('17 Shubat 2011 memorial additions', () => {
  const RID = 'mr_abc123def456';
  const rec = (o: Record<string, unknown> = {}) => ({
    id: RID, kind: 'note', data: { targetId: 'rezhwan', noteType: 'evidence', text: { en: 'x', ckb: 'x' }, verified: false },
    published: true, createdAt: NOW, createdBy: ADMIN, updatedAt: NOW, lastRevision: 'rv_rev0000001', ...o,
  });
  const save = (db: ReturnType<typeof asUser>, data: Record<string, unknown>, rev: string) => {
    const b = writeBatch(db);
    b.set(doc(db, 'memorial_revisions', rev), { id: rev, recordId: data.id, snapshot: data, at: NOW, by: (data.by as string) || ADMIN });
    b.set(doc(db, 'memorial_records', data.id as string), { ...data, lastRevision: rev });
    return b.commit();
  };

  it('administrators add records together with a revision; others cannot', async () => {
    await assertFails(save(asUser(MALLORY), rec(), 'rv_rev0000001'));
    await assertFails(setDoc(doc(asUser(ADMIN), 'memorial_records', RID), rec()));
    await assertSucceeds(save(asUser(ADMIN), rec(), 'rv_rev0000001'));
  });

  it('the public sees only shown additions; nothing can be deleted', async () => {
    await assertSucceeds(save(asUser(ADMIN), rec(), 'rv_rev0000001'));
    await assertSucceeds(getDoc(doc(asAnon(), 'memorial_records', RID)));
    await assertSucceeds(save(asUser(ADMIN), rec({ published: false }), 'rv_rev0000002'));
    await assertFails(getDoc(doc(asAnon(), 'memorial_records', RID)));
    await assertSucceeds(getDoc(doc(asUser(ADMIN), 'memorial_records', RID)));
    await assertFails(deleteDoc(doc(asUser(ADMIN), 'memorial_records', RID)));
    await assertFails(deleteDoc(doc(asUser(ADMIN), 'memorial_revisions', 'rv_rev0000001')));
    await assertFails(updateDoc(doc(asUser(ADMIN), 'memorial_revisions', 'rv_rev0000001'), { snapshot: {} }));
    await assertFails(getDoc(doc(asAnon(), 'memorial_revisions', 'rv_rev0000001')));
  });

  it('a change must keep its kind and creation details and add a new revision', async () => {
    await assertSucceeds(save(asUser(ADMIN), rec(), 'rv_rev0000001'));
    await assertFails(save(asUser(ADMIN), rec({ kind: 'event' }), 'rv_rev0000002'));
    await assertFails(save(asUser(ADMIN), rec({ createdAt: '2020-01-01T00:00:00.000Z' }), 'rv_rev0000003'));
    await assertFails(updateDoc(doc(asUser(ADMIN), 'memorial_records', RID), { published: false }));
    await assertSucceeds(save(asUser(ADMIN), rec({ data: { targetId: 'rezhwan', noteType: 'correction', text: { en: 'y', ckb: 'y' }, verified: true } }), 'rv_rev0000004'));
  });
});

// ---------------------------------------------------------------------------
describe('Online meetings and Appreciation', () => {
  const seed = (path: string, data: Record<string, unknown>) => env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });

  it('meeting records are closed to every browser, even administrators', async () => {
    await seed('meetings/mt1', { id: 'mt1', roomId: 'council-britain', title: 'x', status: 'scheduled' });
    await seed('meeting_attendance/mt1__bob', { uid: BOB, meetingId: 'mt1', status: 'attended' });
    await seed('meeting_rooms/board', { leaderUid: ADMIN });
    for (const who of [asAnon(), asUser(BOB), asUser(ADMIN)]) {
      await assertFails(getDoc(doc(who, 'meetings', 'mt1')));
      await assertFails(getDoc(doc(who, 'meeting_attendance', 'mt1__bob')));
      await assertFails(setDoc(doc(who, 'meeting_rooms', 'board'), { leaderUid: MALLORY }));
      await assertFails(setDoc(doc(who, 'meeting_attendance', 'mt2__mallory'), { uid: MALLORY, status: 'attended' }));
      await assertFails(setDoc(doc(who, 'activity_participants', 'a__mallory'), { uid: MALLORY, review: 'approved' }));
    }
  });

  it('letters can be checked by anyone but issued by nobody in a browser', async () => {
    await seed('appreciation_awards/ap-1', { id: 'ap-1', status: 'published', name: 'Bob' });
    await seed('appreciation_awards/ap-2', { id: 'ap-2', status: 'revoked', name: 'Old' });
    await assertSucceeds(getDoc(doc(asAnon(), 'appreciation_awards', 'ap-1')));
    await assertSucceeds(getDoc(doc(asAnon(), 'appreciation_awards', 'ap-2')));
    await assertSucceeds(getDocs(query(collection(asAnon(), 'appreciation_awards'), where('status', '==', 'published'))));
    await assertFails(getDocs(collection(asAnon(), 'appreciation_awards')));
    await assertFails(setDoc(doc(asUser(MALLORY), 'appreciation_awards', 'ap-3'), { id: 'ap-3', status: 'published', name: 'Mallory' }));
    await assertFails(setDoc(doc(asUser(ADMIN), 'appreciation_awards', 'ap-3'), { id: 'ap-3', status: 'published', name: 'Fake' }));
    await assertFails(updateDoc(doc(asUser(ADMIN), 'appreciation_awards', 'ap-2'), { status: 'published' }));
  });

  it('activity posts are public once published and cannot be written from a browser', async () => {
    await seed('activity_posts/mt1', { id: 'mt1', status: 'published', title: 'Council meeting' });
    await assertSucceeds(getDocs(query(collection(asAnon(), 'activity_posts'), where('status', '==', 'published'))));
    await assertFails(setDoc(doc(asUser(ADMIN), 'activity_posts', 'mt2'), { id: 'mt2', status: 'published', title: 'x' }));
  });
});

describe('Translation corrections', () => {
  const entries = (who: string) => ({ entries: { 'Online meetings': 'کۆبوونەوە ئۆنلاینەکان' }, updatedAt: NOW, updatedBy: who, updatedByName: who });
  it('everyone reads them; only administrators and translators change them, and every change is recorded', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'translator'), { uid: 'translator', email: 't@example.com', displayName: 't', roles: ['member'], permissions: ['manage_translations'], activityScore: 15, createdAt: NOW });
    });
    await assertSucceeds(getDoc(doc(asAnon(), 'translations', 'ckb')));
    await assertFails(setDoc(doc(asUser(MALLORY), 'translations', 'ckb'), entries(MALLORY)));
    await assertFails(setDoc(doc(asUser(BOB), 'translations', 'ar'), entries(BOB)));
    await assertSucceeds(setDoc(doc(asUser('translator'), 'translations', 'ckb'), entries('translator')));
    await assertSucceeds(setDoc(doc(asUser(ADMIN), 'translations', 'ar'), entries(ADMIN)));
    // Only the two interface languages, only these fields, and signed with your own account.
    await assertFails(setDoc(doc(asUser(ADMIN), 'translations', 'fr'), entries(ADMIN)));
    await assertFails(setDoc(doc(asUser(ADMIN), 'translations', 'ckb'), { ...entries(ADMIN), extra: true }));
    await assertFails(setDoc(doc(asUser(ADMIN), 'translations', 'ckb'), entries('translator')));
    await assertFails(deleteDoc(doc(asUser(ADMIN), 'translations', 'ckb')));
    const change = { id: 'c1', lang: 'ckb', key: 'Online meetings', before: '', after: 'x', by: 'translator', byName: 't', at: NOW };
    await assertSucceeds(setDoc(doc(asUser('translator'), 'translations', 'ckb', 'changes', 'c1'), change));
    await assertFails(setDoc(doc(asUser('translator'), 'translations', 'ckb', 'changes', 'c1'), { ...change, after: 'y' }));
    await assertFails(getDoc(doc(asAnon(), 'translations', 'ckb', 'changes', 'c1')));
    await assertFails(setDoc(doc(asUser(MALLORY), 'translations', 'ckb', 'changes', 'c2'), { ...change, id: 'c2', by: MALLORY }));
  });
});
