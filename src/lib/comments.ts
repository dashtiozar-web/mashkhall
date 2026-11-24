import { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import {
  collection, collectionGroup, deleteDoc, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ArticleComment, CommentParentType, ContentReport } from '../types';
import { reportSecurityEvent } from './visits';

/**
 * Comments under articles, videos and activities. Members comment with their
 * account; visitors give a name and are signed in anonymously in the
 * background, which lets the database apply a rate limit per person
 * (one comment a minute for visitors, every 20 seconds for members).
 * Comments are shown as plain text: no markup or code is ever run.
 */

export interface CommentParent {
  type: CommentParentType;
  id: string;
  title: string;
}

const col = (p: Pick<CommentParent, 'type' | 'id'>) =>
  collection(db, p.type === 'article' ? 'articles' : 'news_banners', p.id, 'comments');

export const VISITOR_GAP_SECONDS = 60;
export const MEMBER_GAP_SECONDS = 20;
const LINK = /(https?:|www\.|<|>)/i;

/** Live list of the visible comments, oldest first. */
export const useComments = (p: CommentParent | null) => {
  const [rows, setRows] = useState<ArticleComment[] | null>(null);
  const key = p ? `${p.type}/${p.id}` : '';
  useEffect(() => {
    if (!p) return;
    setRows(null);
    return onSnapshot(
      query(col(p), where('status', '==', 'visible')),
      (snap) => setRows(snap.docs.map((d) => ({ ...(d.data() as ArticleComment), id: d.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
      () => setRows([]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
};

const LAST_KEY = '17shubat_last_comment_at';
export const secondsUntilNextComment = (member: boolean) => {
  try {
    const last = Number(localStorage.getItem(LAST_KEY) || 0);
    const wait = (member ? MEMBER_GAP_SECONDS : VISITOR_GAP_SECONDS) * 1000 - (Date.now() - last);
    return wait > 0 ? Math.ceil(wait / 1000) : 0;
  } catch {
    return 0;
  }
};

/**
 * The latest database rules make the organisation chart public. If it can't
 * be read, the rules that also allow comments have not been published yet.
 */
export const rulesAreCurrent = async () => {
  try {
    await getDocs(query(collection(db, 'org_assignments'), limit(1)));
    return true;
  } catch {
    return false;
  }
};

/** A temporary sign-in for visitors (never treated as an account). */
const visitorUid = async () => {
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) {
      throw new Error('Comments from visitors are not switched on yet. Please sign in as a member to comment.');
    }
    throw new Error('We couldn’t send your comment. Check your connection and try again.');
  }
};

export const validateComment = (text: string, name: string, visitor: boolean) => {
  const t = text.trim();
  if (!t) return 'Please write a comment first.';
  if (t.length > (visitor ? 1000 : 2000)) return `Comments can be up to ${visitor ? '1,000' : '2,000'} characters.`;
  if (visitor) {
    const n = name.trim();
    if (n.length < 2) return 'Please enter your name (at least 2 letters).';
    if (n.length > 60) return 'Please shorten your name to 60 characters.';
    if (LINK.test(t) || LINK.test(n)) return 'Comments from visitors cannot include links or the characters < and >. Members can sign in to share links.';
  }
  return '';
};

export const postComment = async (
  p: CommentParent,
  input: { text: string; name: string; replyTo?: string; member: boolean },
) => {
  const member = input.member && Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
  const problem = validateComment(input.text, input.name, !member);
  if (problem) throw new Error(problem);
  const wait = secondsUntilNextComment(member);
  if (wait) throw new Error(`Please wait ${wait} seconds before commenting again.`);
  const uid = member ? auth.currentUser!.uid : await visitorUid();
  const ref = doc(col(p));
  const c: ArticleComment = {
    id: ref.id,
    parentType: p.type,
    parentId: p.id,
    authorUid: uid,
    authorName: input.name.trim().slice(0, member ? 120 : 60),
    visitor: !member,
    text: input.text.trim(),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    status: 'visible',
    createdAt: new Date().toISOString(),
  };
  const batch = writeBatch(db);
  batch.set(ref, c);
  batch.set(doc(db, 'comment_limits', uid), { lastAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'permission-denied' && !(await rulesAreCurrent())) {
      throw new Error('Comments are not switched on in the database yet. An administrator needs to publish the latest database rules in Firebase (Firestore → Rules).');
    }
    if (code === 'permission-denied') {
      reportSecurityEvent('comment_blocked');
      throw new Error(member
        ? 'Your comment couldn’t be posted. You may be commenting too quickly, or comments are closed here.'
        : 'Your comment couldn’t be posted. Please wait a minute between comments, and leave out links. Comments may be limited to members at the moment.');
    }
    throw new Error('We couldn’t send your comment. Check your connection and try again.');
  }
  try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* ignore */ }
  return c;
};

export const editComment = (p: Pick<CommentParent, 'type' | 'id'>, id: string, text: string) =>
  updateDoc(doc(col(p), id), { text: text.trim().slice(0, 2000), editedAt: new Date().toISOString() });

/** The author or a moderator removes a comment (moderators also remove its replies). */
export const deleteComment = async (p: Pick<CommentParent, 'type' | 'id'>, id: string, replies: string[] = []) => {
  const batch = writeBatch(db);
  batch.delete(doc(col(p), id));
  replies.forEach((r) => batch.delete(doc(col(p), r)));
  await batch.commit();
};

export const setCommentHidden = (p: Pick<CommentParent, 'type' | 'id'>, id: string, hidden: boolean) =>
  updateDoc(doc(col(p), id), { status: hidden ? 'hidden' : 'visible' });

/** Anyone can report a comment, once. */
export const reportComment = async (p: CommentParent, c: ArticleComment, reason: string) => {
  const r = reason.trim();
  if (!r) throw new Error('Please say briefly what is wrong with this comment.');
  const uid = auth.currentUser?.uid || (await visitorUid());
  const id = `${c.id}__${uid}`;
  const report: ContentReport = {
    id,
    targetType: 'comment',
    parentType: p.type,
    articleId: p.id,
    commentId: c.id,
    commentText: c.text.slice(0, 2000),
    commentAuthor: c.authorName.slice(0, 120),
    reason: r.slice(0, 500),
    reporterUid: uid,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'reports', id), report);
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return 'already';
    throw new Error('The report couldn’t be sent. Please try again.');
  }
  return 'sent';
};

// ---- Moderation (moderators and administrators) ----

export const loadAllComments = async () => {
  const snap = await getDocs(collectionGroup(db, 'comments'));
  return snap.docs
    .map((d) => ({ ...(d.data() as ArticleComment), id: d.id }))
    .filter((c) => c.parentType && c.parentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const loadOpenReports = async () => {
  const snap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open')));
  return snap.docs.map((d) => ({ ...(d.data() as ContentReport), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const resolveReport = (id: string) =>
  updateDoc(doc(db, 'reports', id), { status: 'resolved', resolvedBy: auth.currentUser?.uid || '' });

export const deleteReport = (id: string) => deleteDoc(doc(db, 'reports', id));

export const commentLink = (c: Pick<ArticleComment, 'parentType' | 'parentId'>, slug?: string) =>
  c.parentType === 'article' ? `/news/${encodeURIComponent(slug || c.parentId)}` : `/activities/${encodeURIComponent(c.parentId)}`;
