import { useEffect, useState } from 'react';
import {
  collection, doc, getDoc, getDocs, increment, onSnapshot, query, runTransaction, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Article } from '../types';
import { audit } from './membership';
import { notifyUser } from './notify';
import pricing from '../config/pricing.json';

/**
 * Publishing by visitors (non-members) with publication fees.
 *
 * Fees come from src/config/pricing.json (the only place they are set), per
 * contributor and kept separately for articles and videos: a standard fee, a
 * discounted fee after a number of published items, and free after more.
 * Only published submissions count.
 *
 * This file also holds the older account-based visitor submissions (in the
 * `articles` collection); new work from visitors arrives through Publish with
 * Us without an account (see guestSubmissions.ts).
 *
 * A paid submission waits for an administrator to confirm the bank payment
 * before it enters editorial review. Payment details are private to the
 * contributor and the finance administrators and never shown with the work.
 */

export type FeeCategory = 'article' | 'video';
export type PaymentStatus = 'awaiting' | 'claimed' | 'verified' | 'rejected' | 'refunded' | 'disputed' | 'waived';

// The one pricing configuration (also copied into the database rules).
export const FEES: Record<FeeCategory, { standard: number; discounted: number }> = pricing.fees;
export const DISCOUNT_AFTER: number = pricing.discountAfter;
export const FREE_AFTER: number = pricing.freeAfter;
/** Percentage off after DISCOUNT_AFTER published items (e.g. 25). */
export const DISCOUNT_PERCENT = Math.round((1 - FEES.article.discounted / FEES.article.standard) * 100);

export const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export interface ContributorStats {
  uid: string;
  name?: string;
  articles: number;
  videos: number;
  updatedAt: string;
}

export interface PaymentEvent { at: string; by: string; action: string; note?: string }

export interface SubmissionPayment {
  id: string;
  articleId: string;
  uid: string;
  category: FeeCategory;
  amountPence: number;
  standardPence: number;
  tier: 'standard' | 'discount' | 'free';
  reference: string;
  status: PaymentStatus;
  title: string;
  payerNote?: string;
  claimedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  adminNote?: string;
  history?: PaymentEvent[];
  createdAt: string;
  updatedAt: string;
}

export const categoryOf = (contentType?: string): FeeCategory => (contentType === 'video_speech' ? 'video' : 'article');

export const feeFor = (category: FeeCategory, published: number) => {
  const f = FEES[category];
  if (published >= FREE_AFTER) return { amountPence: 0, standardPence: f.standard, tier: 'free' as const };
  if (published >= DISCOUNT_AFTER) return { amountPence: f.discounted, standardPence: f.standard, tier: 'discount' as const };
  return { amountPence: f.standard, standardPence: f.standard, tier: 'standard' as const };
};

export const countFor = (stats: ContributorStats | null | undefined, category: FeeCategory) =>
  category === 'video' ? stats?.videos || 0 : stats?.articles || 0;

/** "17S-K7Q4M2": a short reference the contributor puts on their bank transfer. */
export const newReference = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `17S-${Array.from(bytes, (b) => chars[b % chars.length]).join('')}`;
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  awaiting: 'Waiting for your payment',
  claimed: 'Payment being checked',
  verified: 'Payment confirmed',
  rejected: 'Payment not found',
  refunded: 'Refunded',
  disputed: 'Payment under query',
  waived: 'No fee',
};

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Waiting for payment',
  draft: 'Draft',
  submitted: 'Waiting for editorial review',
  under_review: 'In editorial review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  published: 'Published',
  archived: 'Not accepted',
};

// ---- Contributor side ----

export const useMyStats = (uid?: string) => {
  const [stats, setStats] = useState<ContributorStats | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) { setStats(null); return; }
    return onSnapshot(doc(db, 'contributor_stats', uid), (s) => setStats(s.exists() ? (s.data() as ContributorStats) : null), () => setStats(null));
  }, [uid]);
  return stats;
};

export const useMySubmissions = (uid?: string) => {
  const [rows, setRows] = useState<{ articles: Article[]; payments: Record<string, SubmissionPayment> } | null>(null);
  useEffect(() => {
    if (!uid) { setRows(null); return; }
    let arts: Article[] = [];
    let pays: Record<string, SubmissionPayment> = {};
    const push = () => setRows({ articles: [...arts].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), payments: pays });
    const u1 = onSnapshot(query(collection(db, 'articles'), where('authorUid', '==', uid)), (s) => { arts = s.docs.map((d) => ({ ...(d.data() as Article), id: d.id })); push(); }, () => push());
    const u2 = onSnapshot(query(collection(db, 'submission_payments'), where('uid', '==', uid)), (s) => { pays = Object.fromEntries(s.docs.map((d) => [d.id, { ...(d.data() as SubmissionPayment), id: d.id }])); push(); }, () => push());
    return () => { u1(); u2(); };
  }, [uid]);
  return rows;
};

/**
 * A visitor's submission: the work and, if a fee applies, its payment record,
 * written together. Free submissions go straight to editorial review.
 */
export const submitVisitorWork = async (article: Article, stats: ContributorStats | null) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Please sign in first.');
  const category = categoryOf(article.contentType);
  const fee = feeFor(category, countFor(stats, category));
  const now = new Date().toISOString();
  const free = fee.amountPence === 0;
  const art: Article = { ...article, contributorType: 'visitor', feeCategory: category, status: free ? 'submitted' : 'awaiting_payment' };
  const pay: SubmissionPayment = {
    id: article.id,
    articleId: article.id,
    uid: user.uid,
    category,
    ...fee,
    reference: newReference(),
    status: free ? 'waived' : 'awaiting',
    title: article.title.slice(0, 300),
    createdAt: now,
    updatedAt: now,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'articles', article.id), JSON.parse(JSON.stringify(art)));
  batch.set(doc(db, 'submission_payments', article.id), pay);
  await batch.commit();
  return pay;
};

/** The contributor says they have paid; an administrator then checks the bank. */
export const claimPayment = async (p: SubmissionPayment, note: string) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'submission_payments', p.id), {
    status: 'claimed', claimedAt: new Date().toISOString(), payerNote: note.trim().slice(0, 500), updatedAt: new Date().toISOString(),
  });
  await batch.commit();
};

// ---- Administration ----

export const loadPayments = async () => {
  const snap = await getDocs(collection(db, 'submission_payments'));
  return snap.docs.map((d) => ({ ...(d.data() as SubmissionPayment), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const loadContributorStats = async () => {
  const snap = await getDocs(collection(db, 'contributor_stats'));
  return snap.docs.map((d) => ({ ...(d.data() as ContributorStats), uid: d.id }));
};

const event = (action: string, note?: string): PaymentEvent => ({
  at: new Date().toISOString(), by: auth.currentUser?.email || auth.currentUser?.uid || '', action, ...(note ? { note: note.slice(0, 500) } : {}),
});

/**
 * Change a payment's status. Confirming a payment moves the work into
 * editorial review; every change is kept in the payment's history and the
 * audit log.
 */
export const setPaymentStatus = async (p: SubmissionPayment, status: PaymentStatus, note = '') => {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, 'submission_payments', p.id), {
    status,
    updatedAt: now,
    ...(status === 'verified' ? { verifiedAt: now, verifiedBy: auth.currentUser?.uid || '' } : {}),
    ...(note ? { adminNote: note.slice(0, 500) } : {}),
    history: [...(p.history || []), event(`Status: ${PAYMENT_STATUS_LABEL[status]}`, note)],
  });
  const art = await getDoc(doc(db, 'articles', p.articleId));
  if (status === 'verified' && art.exists() && (art.data() as Article).status === 'awaiting_payment') {
    batch.update(doc(db, 'articles', p.articleId), { status: 'submitted', updatedAt: now });
  }
  await batch.commit();
  await audit(`SUBMISSION_PAYMENT_${status.toUpperCase()}`, p.uid, `${p.reference} (${pounds(p.amountPence)}) for "${p.title}"${note ? `: ${note}` : ''}`);
  const msg: Partial<Record<PaymentStatus, string>> = {
    verified: `Payment confirmed for "${p.title}". It is now waiting for editorial review.`,
    rejected: `We could not find your payment for "${p.title}" (reference ${p.reference}).`,
    refunded: `Your payment for "${p.title}" has been refunded.`,
    disputed: `We have a question about your payment for "${p.title}".`,
  };
  if (msg[status]) {
    await notifyUser(p.uid, { type: 'article', title: msg[status]!, body: note || undefined, link: '/contribute' }).catch(() => undefined);
  }
};

/**
 * Count a published visitor submission towards the contributor's discounts,
 * once only (the record's id is the submission's id).
 */
export const countPublishedVisitorWork = async (a: Pick<Article, 'id' | 'authorUid' | 'authorDisplayName' | 'contentType' | 'feeCategory' | 'title'>) => {
  const category = a.feeCategory || categoryOf(a.contentType);
  const recRef = doc(db, 'contribution_records', a.id);
  const statsRef = doc(db, 'contributor_stats', a.authorUid);
  return runTransaction(db, async (tx) => {
    const rec = await tx.get(recRef);
    if (rec.exists()) return false;
    const stats = await tx.get(statsRef);
    const now = new Date().toISOString();
    tx.set(recRef, { id: a.id, uid: a.authorUid, category, title: a.title.slice(0, 300), countedAt: now, countedBy: auth.currentUser?.uid || '' });
    if (stats.exists()) {
      tx.update(statsRef, { [category === 'video' ? 'videos' : 'articles']: increment(1), updatedAt: now });
    } else {
      tx.set(statsRef, { uid: a.authorUid, name: a.authorDisplayName || '', articles: category === 'article' ? 1 : 0, videos: category === 'video' ? 1 : 0, updatedAt: now });
    }
    return true;
  });
};

/** Administrators correct a contributor's count; the old and new numbers are audited. */
export const correctCount = async (s: ContributorStats, category: FeeCategory, value: number, reason: string) => {
  if (!reason.trim()) throw new Error('Please give a reason for the correction.');
  if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error('Please enter a whole number.');
  const field = category === 'video' ? 'videos' : 'articles';
  const before = s[field] || 0;
  const batch = writeBatch(db);
  batch.set(doc(db, 'contributor_stats', s.uid), { ...s, [field]: value, updatedAt: new Date().toISOString() });
  await batch.commit();
  await audit('CONTRIBUTOR_COUNT_CORRECTED', s.uid, `${s.name || s.uid}: published ${field} ${before} → ${value}. Reason: ${reason.trim()}`);
};

export const reportSuspiciousSubmission = async (p: Pick<SubmissionPayment, 'articleId' | 'uid' | 'title'>, note: string) => {
  const id = `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'security_events', id), {
    id, kind: 'suspicious_submission', articleId: p.articleId, uid: p.uid, title: p.title.slice(0, 300), note: note.slice(0, 1000),
    status: 'open', createdAt: new Date().toISOString(), createdBy: auth.currentUser?.uid || '',
  });
  await batch.commit();
  await audit('SECURITY_EVENT_REPORTED', p.uid, `Suspicious submission "${p.title}": ${note}`);
};
