import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, query, setDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MemberRecord } from '../types';
import { MEMBER_NUMBER_PATTERN } from './membership';

/**
 * Permanently delete a member and everything linked to them.
 *
 * Deleted: member record, application, account record, public profile and
 * photo, uploaded images, membership card and QR verification, points and
 * points history, share claims, articles they wrote (with their reactions,
 * comments and revisions), their reactions, likes and comments on other
 * articles, activity answers and views, notifications and settings.
 *
 * Kept: the audit log, which records that a member was deleted and by whom
 * (by member number only, without name or contact details), because the
 * organisation must be able to account for administrative actions. Counts
 * on other people's articles and activities are reduced so nothing is left
 * pointing at the deleted member.
 *
 * Login: a website cannot delete another person's sign-in account directly,
 * so a marker is left that deletes the login the moment anyone signs in with
 * it. Administrators can also remove it straight away in the Firebase console.
 */

export interface DeleteProgress { step: string; done: number; total: number }

const deleteAll = async (paths: { path: string }[]) => {
  // Firestore batches hold up to 500 writes.
  for (let i = 0; i < paths.length; i += 400) {
    const batch = writeBatch(db);
    paths.slice(i, i + 400).forEach((p) => batch.delete(doc(db, p.path)));
    await batch.commit();
  }
};

const safe = async <T,>(label: string, fn: () => Promise<T>, problems: string[]): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (e) {
    console.warn(`Delete member: ${label} failed`, e);
    problems.push(label);
    return undefined;
  }
};

export const permanentlyDeleteMember = async (m: MemberRecord, onProgress?: (p: DeleteProgress) => void) => {
  const uid = m.userId || m.id;
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('Please sign in again.');
  if (uid === me || m.id === me) throw new Error('You cannot delete your own membership here.');
  const adminSnap = await getDoc(doc(db, 'admins', uid)).catch(() => null);
  if (adminSnap?.exists()) throw new Error('This person is an administrator. Remove their administrator role in Users and roles first.');

  const problems: string[] = [];
  const steps = 13;
  let done = 0;
  const tick = (step: string) => onProgress?.({ step, done: ++done, total: steps });

  // 1. Articles they wrote, with everything attached to them.
  tick('Articles they wrote');
  await safe('articles', async () => {
    const arts = await getDocs(query(collection(db, 'articles'), where('authorUid', '==', uid)));
    for (const a of arts.docs) {
      for (const sub of ['likes', 'reactions', 'comments', 'revisions']) {
        const subDocs = await getDocs(collection(db, 'articles', a.id, sub)).catch(() => null);
        if (subDocs) await deleteAll(subDocs.docs.map((d) => ({ path: d.ref.path })));
      }
      await deleteDoc(a.ref);
    }
  }, problems);

  // 2. Their likes and reactions on other articles (counts go down).
  tick('Reactions on other articles');
  await safe('likes', async () => {
    const likes = await getDocs(collectionGroup(db, 'likes'));
    for (const l of likes.docs.filter((d) => d.id === uid)) {
      const articleRef = l.ref.parent.parent;
      const batch = writeBatch(db);
      batch.delete(l.ref);
      if (articleRef) batch.update(articleRef, { likesCount: increment(-1) });
      await batch.commit();
    }
    const reactions = await getDocs(collectionGroup(db, 'reactions')).catch(() => null);
    if (reactions) await deleteAll(reactions.docs.filter((d) => d.id === uid).map((d) => ({ path: d.ref.path })));
    // Comments on articles, videos and activities (read in full: a filtered
    // search across all comment lists would need an extra database index).
    const comments = await getDocs(collectionGroup(db, 'comments')).catch(() => null);
    if (comments) await deleteAll(comments.docs.filter((d) => d.data().authorUid === uid).map((d) => ({ path: d.ref.path })));
    await deleteDoc(doc(db, 'comment_limits', uid)).catch(() => undefined);
  }, problems);

  // 3. Activity answers (attending counts go down) and activity views.
  tick('Activity answers');
  await safe('activity answers', async () => {
    const regs = await getDocs(collectionGroup(db, 'registrations'));
    for (const r of regs.docs.filter((d) => d.id === uid || d.data().userId === uid)) {
      const bannerRef = r.ref.parent.parent;
      const attending = (r.data().status || 'attending') === 'attending';
      const batch = writeBatch(db);
      batch.delete(r.ref);
      if (bannerRef && attending) batch.update(bannerRef, { attendeeCount: increment(-1) });
      await batch.commit();
    }
    const banners = await getDocs(collection(db, 'news_banners'));
    for (const b of banners.docs) {
      await deleteDoc(doc(db, 'news_banners', b.id, 'views', uid)).catch(() => undefined);
    }
  }, problems);

  // 4. Points history and share claims.
  tick('Points and shares');
  await safe('points', async () => {
    const ledger = await getDocs(query(collection(db, 'points_ledger'), where('userId', '==', uid)));
    await deleteAll(ledger.docs.map((d) => ({ path: d.ref.path })));
    const claims = await getDocs(query(collection(db, 'share_claims'), where('userId', '==', uid)));
    await deleteAll(claims.docs.map((d) => ({ path: d.ref.path })));
  }, problems);

  // 5. Images they uploaded (including their photo).
  tick('Photos and images');
  await safe('images', async () => {
    const media = await getDocs(query(collection(db, 'media'), where('ownerUid', '==', uid)));
    await deleteAll(media.docs.map((d) => ({ path: d.ref.path })));
  }, problems);

  // 6. Notifications and their settings.
  tick('Notifications');
  await safe('notifications', async () => {
    const notes = await getDocs(query(collection(db, 'user_notifications'), where('userId', '==', uid)));
    await deleteAll(notes.docs.map((d) => ({ path: d.ref.path })));
    await deleteDoc(doc(db, 'notification_state', uid)).catch(() => undefined);
  }, problems);

  // 7. Older activity records.
  tick('Activity history');
  await safe('activity history', async () => {
    const acts = await getDocs(query(collection(db, 'user_activities'), where('userId', '==', uid)));
    await deleteAll(acts.docs.map((d) => ({ path: d.ref.path })));
  }, problems);

  // 8. Membership card and QR verification.
  tick('Membership card');
  await safe('membership card', async () => {
    if (m.memberNumber && MEMBER_NUMBER_PATTERN.test(m.memberNumber)) {
      await deleteDoc(doc(db, 'verifications', m.memberNumber));
    }
  }, problems);

  // Positions they held become vacant on the organisation chart.
  tick('Positions held');
  await safe('positions', async () => {
    const seats = await getDocs(query(collection(db, 'org_assignments'), where('memberId', '==', uid)));
    const extra = uid !== m.id ? await getDocs(query(collection(db, 'org_assignments'), where('memberId', '==', m.id))) : null;
    await deleteAll([...seats.docs, ...(extra?.docs || [])].map((d) => ({ path: d.ref.path })));
  }, problems);

  // 9. Public profile.
  tick('Public profile');
  await safe('public profile', () => deleteDoc(doc(db, 'public_profiles', m.id)), problems);
  if (uid !== m.id) await safe('public profile', () => deleteDoc(doc(db, 'public_profiles', uid)), problems);

  // 10. Application and account record.
  tick('Application and account');
  await safe('application', () => deleteDoc(doc(db, 'applications', `app-${uid}`)), problems);
  await safe('account record', () => deleteDoc(doc(db, 'users', uid)), problems);

  // 11. The member record itself.
  tick('Member record');
  await deleteDoc(doc(db, 'members', m.id));

  // 12. Remove the login the next time it is used; record the action.
  tick('Login account');
  if (!uid.startsWith('mem-')) {
    await safe('login marker', () => setDoc(doc(db, 'deleted_accounts', uid), { deletedAt: new Date().toISOString(), deletedBy: me }), problems);
  }
  const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await safe('audit log', () => setDoc(doc(db, 'audit_logs', logId), {
    id: logId, actorUid: me, actorEmail: auth.currentUser?.email || '', action: 'MEMBER_PERMANENTLY_DELETED',
    targetType: 'members', targetId: m.memberNumber || 'member',
    details: `A member${m.memberNumber ? ` (${m.memberNumber})` : ''} and all their data were permanently deleted.`,
    timestamp: new Date().toISOString(),
  }), problems);

  return { problems };
};

/** Called at sign-in: if this account was deleted, remove the login itself. */
export const removeIfDeleted = async () => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, 'deleted_accounts', user.uid));
    if (!snap.exists()) return false;
    // Remove the sign-in account. If that isn't possible right now, sign out;
    // the marker stays so it is tried again next time.
    await user.delete().catch(() => undefined);
    await auth.signOut().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
};

