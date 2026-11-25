import { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, increment, onSnapshot, query, runTransaction, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Article } from '../types';
import { compressImage } from './media';
import { audit } from './membership';
import { DISCOUNT_AFTER, FEES, FeeCategory, feeFor, FREE_AFTER, newReference, pounds } from './contributions';

/**
 * Publish with Us, without an account.
 *
 * A visitor fills in one form and sends it. Behind the scenes their browser
 * gets a temporary anonymous sign-in (so the database can rate-limit it);
 * that is not an account and never a membership. The submission's id is a
 * long random code which doubles as the visitor's private tracking link.
 *
 *   sent with its fee (from the central pricing and the contributor's
 *   published count) → paid and confirmed (or no fee) → editorial review
 *   → approved → published
 *   (or: changes requested → resubmitted; rejected, and refunded if paid;
 *   withdrawn before payment)
 *
 * Contributors are kept apart from members: nothing here touches the
 * membership register, roles, positions, member numbers or cards. Their
 * published count (for discounts) is kept per email address, as a one-way
 * code, in contributor_stats/guest-….
 */

export type GuestKind = 'article' | 'video' | 'report' | 'news' | 'statement' | 'other';
export type GuestStatus = 'awaiting_payment' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'withdrawn' | 'published' | 'unpublished';
export type GuestPaymentStatus = 'not_due' | 'awaiting' | 'claimed' | 'verified' | 'rejected' | 'refunded' | 'disputed' | 'waived';

export interface GuestPayment {
  status: GuestPaymentStatus;
  amountPence?: number;
  standardPence?: number;
  tier?: 'standard' | 'discount' | 'free';
  reference?: string;
  claimedAt?: string;
  payerNote?: string;
}

export interface GuestHistory { at: string; action: string; by: 'contributor' | 'editor' | 'finance'; note?: string }

export interface GuestSubmission {
  id: string;
  kind: GuestKind;
  feeCategory: FeeCategory;
  title: string;
  excerpt: string;
  content: string;
  topic: string;
  videoUrl?: string;
  sourceLinks?: string;
  /** Topics given by the contributor, and video details (see lib/video.ts). */
  tags?: string[];
  direction: 'ltr' | 'rtl';
  language: string;
  images: string[];
  contact: { name: string; email: string; phone?: string; country?: string };
  terms: { accepted: true; privacy: true; version: string };
  status: GuestStatus;
  payment: GuestPayment;
  ownerUid: string;
  editorNote?: string;
  contributorKey?: string;
  priorCount?: number;
  articleId?: string;
  articleSlug?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  history: GuestHistory[];
}

export const TERMS_VERSION = '2026-10';

export const GUEST_KINDS: { id: GuestKind; label: string; help: string }[] = [
  { id: 'article', label: 'Article', help: 'Analysis, opinion or an investigation.' },
  { id: 'report', label: 'Written report', help: 'A written human-rights or monitoring report.' },
  { id: 'video', label: 'Video', help: 'A video on YouTube, Vimeo or Facebook.' },
  { id: 'news', label: 'News item', help: 'News about an event or development.' },
  { id: 'statement', label: 'Statement', help: 'A public statement or announcement.' },
  { id: 'other', label: 'Other', help: 'Anything else on human rights, democracy, freedom of expression or Kurdish affairs.' },
];

export const GUEST_STATUS_LABEL: Record<GuestStatus, string> = {
  awaiting_payment: 'Waiting for your payment',
  submitted: 'Received, waiting for editorial review',
  under_review: 'In editorial review',
  changes_requested: 'Changes requested by the editors',
  approved: 'Approved by the editors',
  rejected: 'Not accepted for publication',
  withdrawn: 'Withdrawn by you',
  published: 'Published',
  unpublished: 'Removed from the website',
};

export const GUEST_PAYMENT_LABEL: Record<GuestPaymentStatus, string> = {
  not_due: 'No payment needed yet',
  awaiting: 'Waiting for your payment',
  claimed: 'Payment being checked',
  verified: 'Payment confirmed',
  rejected: 'Payment not found',
  refunded: 'Refunded',
  disputed: 'Payment under query',
  waived: 'No fee',
};

/** Fee category for a kind of publication: videos pay the video fee, everything else the article fee. */
export const feeCategoryOf = (kind: GuestKind): FeeCategory => (kind === 'video' ? 'video' : 'article');

/** Content type used when the work is published. */
const contentTypeOf = (kind: GuestKind): Article['contentType'] =>
  kind === 'video' ? 'video_speech' : kind === 'report' ? 'monitoring_report' : 'article';

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const randomCode = (len: number, alphabet = BASE32) =>
  Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => alphabet[b % alphabet.length]).join('');

/** A new private tracking id (≈120 bits of randomness). */
export const newSubmissionId = () => `gs_${randomCode(24)}`;

export const statusPath = (id: string) => `/contribute/status/${id}`;

/**
 * A one-way code for an email address (SHA-256), so discounts follow the
 * contributor without storing a readable list of emails. The database rules
 * compute the same code to check the fee.
 */
export const contributorKeyFor = async (email: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return `guest-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
};

/** How many items of this kind have been published under this email (for discounts). */
export const guestPublishedCount = async (email: string, category: FeeCategory) => {
  const key = await contributorKeyFor(email);
  try {
    const st = await getDoc(doc(db, 'contributor_stats', key));
    const n = st.exists() ? Number(st.data()[category === 'video' ? 'videos' : 'articles']) || 0 : 0;
    return { key, count: n };
  } catch {
    return { key, count: 0 };
  }
};

/** The fee a visitor pays for this submission, before sending it. */
export const guestFeeFor = async (email: string, category: FeeCategory) => {
  const { key, count } = await guestPublishedCount(email, category);
  return { key, count, ...feeFor(category, count) };
};

/** The temporary sign-in a visitor's browser uses to send work (not an account). */
export const ensureVisitorSession = async () => {
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    return (await signInAnonymously(auth)).user.uid;
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) {
      throw new Error('Sending work without an account is not switched on yet. Please contact us and we will help you publish.');
    }
    if (code.includes('network')) throw new Error('No connection. Please check your internet connection and try again.');
    throw new Error('We could not start sending your work. Please try again.');
  }
};

const now = () => new Date().toISOString();

// ---- Remembering this browser's submissions (stored only in this browser) ----

const MINE_KEY = '17shubat_my_submissions';
export const rememberedSubmissions = (): string[] => {
  try { return (JSON.parse(localStorage.getItem(MINE_KEY) || '[]') as string[]).filter((x) => /^gs_[a-z2-7]{24}$/.test(x)); } catch { return []; }
};
const remember = (id: string) => {
  try { localStorage.setItem(MINE_KEY, JSON.stringify([id, ...rememberedSubmissions().filter((x) => x !== id)].slice(0, 30))); } catch { /* storage blocked */ }
};
export const forgetSubmission = (id: string) => {
  try { localStorage.setItem(MINE_KEY, JSON.stringify(rememberedSubmissions().filter((x) => x !== id))); } catch { /* storage blocked */ }
};

// ---- Visitor side ----

/** Compress and attach a photo to a submission in progress. */
export const uploadGuestImage = async (file: File) => {
  const uid = await ensureVisitorSession();
  const image = await compressImage(file, 1600);
  const id = `gm_${Date.now().toString(36)}${randomCode(10, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'submission_limits', uid), { lastImageAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, 'guest_media', id), { id, dataUrl: image.dataUrl, width: image.width, height: image.height, bytes: image.bytes, ownerUid: uid, createdAt: now() });
  try {
    await batch.commit();
  } catch (e) {
    if (/permission|insufficient/i.test(String((e as Error).message))) throw new Error('Please wait a few seconds between photos, then try again.');
    throw e;
  }
  return { id, preview: image.dataUrl };
};

export interface GuestDraft {
  kind: GuestKind;
  title: string;
  excerpt: string;
  content: string;
  topic: string;
  videoUrl?: string;
  sourceLinks?: string;
  tags?: string[];
  direction: 'ltr' | 'rtl';
  language: string;
  images: string[];
  contact: { name: string; email: string; phone?: string; country?: string };
}

/**
 * Was a refusal caused by the database still running older rules (which do
 * not know Publish with Us)? The new rules let anyone read a submission by
 * its id; the old ones refuse it.
 */
const rulesOutdated = async () => {
  try { await getDoc(doc(db, 'guest_submissions', newSubmissionId())); return false; } catch { return true; }
};

/** Did this browser send something less than a minute ago? */
const sentRecently = async (uid: string) => {
  try {
    const l = await getDoc(doc(db, 'submission_limits', uid));
    const at = l.exists() ? (l.data().lastSubmissionAt as { toMillis?: () => number } | undefined) : undefined;
    return Boolean(at?.toMillis && Date.now() - at.toMillis() < 65_000);
  } catch { return false; }
};

export class SubmissionRefused extends Error {
  constructor(message: string, readonly reason: 'rules_outdated' | 'too_soon' | 'refused') { super(message); }
}

export const submitGuestWork = async (draft: GuestDraft) => {
  const uid = await ensureVisitorSession();
  const id = newSubmissionId();
  const t = now();
  const feeCategory = feeCategoryOf(draft.kind);
  // The fee is set now, from the central pricing and the contributor's
  // published count; the database rules check it.
  const fee = await guestFeeFor(draft.contact.email, feeCategory);
  const free = fee.amountPence === 0;
  const payment: GuestPayment = {
    status: free ? 'waived' : 'awaiting',
    amountPence: fee.amountPence,
    standardPence: fee.standardPence,
    tier: fee.tier,
    reference: newReference(),
  };
  const contact = Object.fromEntries(Object.entries({
    name: draft.contact.name.trim().slice(0, 120),
    email: draft.contact.email.trim().slice(0, 254),
    phone: draft.contact.phone?.trim().slice(0, 40) || undefined,
    country: draft.contact.country?.trim().slice(0, 80) || undefined,
  }).filter(([, v]) => v !== undefined)) as GuestSubmission['contact'];
  const sub: GuestSubmission = {
    id,
    kind: draft.kind,
    feeCategory,
    title: draft.title.trim().slice(0, 300),
    excerpt: draft.excerpt.trim().slice(0, 600),
    content: draft.content.trim().slice(0, 100000),
    topic: draft.topic,
    ...(draft.videoUrl?.trim() ? { videoUrl: draft.videoUrl.trim().slice(0, 500) } : {}),
    ...(draft.sourceLinks?.trim() ? { sourceLinks: draft.sourceLinks.trim().slice(0, 5000) } : {}),
    ...(draft.tags?.length ? { tags: draft.tags.map((t) => String(t).slice(0, 60)).slice(0, 12) } : {}),
    direction: draft.direction,
    language: draft.language,
    images: draft.images.slice(0, 4),
    contact,
    terms: { accepted: true, privacy: true, version: TERMS_VERSION },
    status: free ? 'submitted' : 'awaiting_payment',
    payment,
    contributorKey: fee.key,
    priorCount: fee.count,
    ownerUid: uid,
    createdAt: t,
    updatedAt: t,
    history: [{ at: t, action: free ? 'Sent for editorial review (no fee due)' : 'Sent; waiting for the publication fee', by: 'contributor' }],
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'submission_limits', uid), { lastSubmissionAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, 'guest_submissions', id), sub);
  try {
    await batch.commit();
  } catch (e) {
    if (/permission|insufficient/i.test(String((e as Error).message))) {
      if (await rulesOutdated()) {
        throw new SubmissionRefused('Publishing without an account is being set up and is not open yet. Please try again later, or contact us and we will help you publish.', 'rules_outdated');
      }
      if (await sentRecently(uid)) {
        throw new SubmissionRefused('You sent something less than a minute ago. Please wait a moment and try again.', 'too_soon');
      }
      throw new SubmissionRefused('Your submission was refused. Please check the form and try again, or contact us.', 'refused');
    }
    throw e;
  }
  remember(id);
  return sub;
};

/** Live status of one submission, by its private tracking id. */
export const useGuestSubmission = (id?: string) => {
  const [sub, setSub] = useState<GuestSubmission | null | undefined>(undefined);
  useEffect(() => {
    if (!id || !/^gs_[a-z2-7]{24}$/.test(id)) { setSub(null); return; }
    setSub(undefined);
    return onSnapshot(doc(db, 'guest_submissions', id), (s) => setSub(s.exists() ? (s.data() as GuestSubmission) : null), () => setSub(null));
  }, [id]);
  return sub;
};

const append = (s: GuestSubmission, action: string, by: GuestHistory['by'], note?: string): GuestHistory[] =>
  [...(s.history || []), { at: now(), action, by, ...(note?.trim() ? { note: note.trim().slice(0, 1000) } : {}) }];

export const claimGuestPayment = async (s: GuestSubmission, note: string) => {
  await ensureVisitorSession();
  const payment: GuestPayment = { ...s.payment, status: 'claimed', claimedAt: now(), ...(note.trim() ? { payerNote: note.trim().slice(0, 500) } : {}) };
  const batch = writeBatch(db);
  batch.update(doc(db, 'guest_submissions', s.id), { payment, updatedAt: now(), history: append(s, 'Contributor reported the payment', 'contributor', note) });
  await batch.commit();
};

export const resubmitGuestWork = async (s: GuestSubmission, changes: Pick<GuestSubmission, 'title' | 'excerpt' | 'content'> & { videoUrl?: string; sourceLinks?: string }) => {
  await ensureVisitorSession();
  const batch = writeBatch(db);
  batch.update(doc(db, 'guest_submissions', s.id), {
    title: changes.title.trim().slice(0, 300),
    excerpt: changes.excerpt.trim().slice(0, 600),
    content: changes.content.trim().slice(0, 100000),
    ...(changes.videoUrl?.trim() ? { videoUrl: changes.videoUrl.trim().slice(0, 500) } : {}),
    ...(changes.sourceLinks?.trim() ? { sourceLinks: changes.sourceLinks.trim().slice(0, 5000) } : {}),
    status: 'submitted',
    updatedAt: now(),
    history: append(s, 'Changes made and sent back for review', 'contributor'),
  });
  await batch.commit();
};

export const withdrawGuestWork = async (s: GuestSubmission) => {
  await ensureVisitorSession();
  const batch = writeBatch(db);
  batch.update(doc(db, 'guest_submissions', s.id), { status: 'withdrawn', updatedAt: now(), history: append(s, 'Withdrawn by the contributor', 'contributor') });
  await batch.commit();
};

// ---- Editors and finance ----

export const loadGuestSubmissions = async () => {
  const snap = await getDocs(collection(db, 'guest_submissions'));
  return snap.docs.map((d) => d.data() as GuestSubmission).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const loadGuestImage = async (id: string) => {
  const s = await getDoc(doc(db, 'guest_media', id));
  return s.exists() ? (s.data() as { dataUrl: string; width: number; height: number; bytes: number }) : null;
};

/**
 * How many items of this type the contributor has had published: their count
 * under this email, plus any count from an older contributor account with
 * the same email (when the reviewer can see accounts).
 */
export const publishedCountFor = async (s: GuestSubmission) => {
  const field = s.feeCategory === 'video' ? 'videos' : 'articles';
  const { key, count: own } = await guestPublishedCount(s.contact.email, s.feeCategory);
  let count = own;
  try {
    const users = await getDocs(query(collection(db, 'users'), where('email', '==', s.contact.email.trim().toLowerCase())));
    for (const u of users.docs) {
      const st = await getDoc(doc(db, 'contributor_stats', u.id));
      if (st.exists()) count += Number(st.data()[field]) || 0;
    }
  } catch { /* reviewers without access to accounts see the email count only */ }
  return { key, count };
};

/** The fee that applies, from the central pricing, for display before approval. */
export const feePreview = (category: FeeCategory, count: number) => {
  const fee = feeFor(category, count);
  return { ...fee, text: fee.amountPence ? pounds(fee.amountPence) : 'Free', discountAfter: DISCOUNT_AFTER, freeAfter: FREE_AFTER, standard: FEES[category].standard };
};

const editorAction = async (s: GuestSubmission, patch: Partial<GuestSubmission>, action: string, by: GuestHistory['by'], note?: string) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'guest_submissions', s.id), { ...patch, updatedAt: now(), history: append(s, action, by, note) });
  await batch.commit();
  await audit(`GUEST_SUBMISSION_${action.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_|_$/g, '')}`, s.id, `"${s.title}"${note ? `: ${note}` : ''}`).catch(() => undefined);
};

export const startReview = (s: GuestSubmission) => editorAction(s, { status: 'under_review' }, 'Editorial review started', 'editor');
export const requestChanges = (s: GuestSubmission, note: string) => editorAction(s, { status: 'changes_requested', editorNote: note.trim().slice(0, 2000) }, 'Changes requested', 'editor', note);
export const rejectSubmission = (s: GuestSubmission, note: string) => editorAction(s, { status: 'rejected', editorNote: note.trim().slice(0, 2000) }, 'Not accepted', 'editor', note);

/**
 * Approve. Work sent since payment-first publishing is already paid (or
 * free). Older submissions without a fee get it now, from the central
 * pricing and the contributor's published count.
 */
export const approveSubmission = async (s: GuestSubmission, note = '') => {
  if (s.payment.status !== 'not_due') {
    if (!['verified', 'waived'].includes(s.payment.status)) throw new Error('The payment has not been confirmed yet.');
    await editorAction(s, { status: 'approved', ...(note.trim() ? { editorNote: note.trim().slice(0, 2000) } : {}) }, 'Approved by the editors', 'editor', note);
    return s.payment;
  }
  const { key, count } = await publishedCountFor(s);
  const fee = feeFor(s.feeCategory, count);
  const payment: GuestPayment = {
    status: fee.amountPence === 0 ? 'waived' : 'awaiting',
    amountPence: fee.amountPence,
    standardPence: fee.standardPence,
    tier: fee.tier,
    reference: newReference(),
  };
  await editorAction(s, { status: 'approved', payment, contributorKey: key, priorCount: count, ...(note.trim() ? { editorNote: note.trim().slice(0, 2000) } : {}) },
    fee.amountPence ? `Approved; fee ${pounds(fee.amountPence)} requested` : 'Approved; no fee due', 'editor', note);
  return payment;
};

export const setGuestPayment = (s: GuestSubmission, status: GuestPaymentStatus, note = '') =>
  editorAction(s, { payment: { ...s.payment, status } }, `Payment: ${GUEST_PAYMENT_LABEL[status]}`, 'finance', note);

/** Finance confirms the fee has arrived; paid work then goes to editorial review. */
export const confirmGuestPayment = (s: GuestSubmission) =>
  s.status === 'awaiting_payment'
    ? editorAction(s, { status: 'submitted', payment: { ...s.payment, status: 'verified' } }, 'Payment confirmed; sent for editorial review', 'finance')
    : setGuestPayment(s, 'verified');

/** Turn away work that was never paid for (for example spam). */
export const declineUnpaid = (s: GuestSubmission, note: string) =>
  editorAction(s, { status: 'rejected', editorNote: note.trim().slice(0, 2000) }, 'Not accepted', 'editor', note);

const slugify = (t: string, id: string) =>
  `${t.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'publication'}-${id.slice(3, 9)}`;

/**
 * Publish an approved and paid (or free) submission: it becomes a normal
 * article in its original language, under the contributor's name, and
 * counts once towards their discounts. The contributor is not given any
 * account, role or membership.
 */
export const publishGuestWork = async (s: GuestSubmission, me: { uid: string }) => {
  if (s.status !== 'approved') throw new Error('Only approved work can be published.');
  if (!['verified', 'waived'].includes(s.payment.status)) throw new Error('The payment has not been confirmed yet.');
  // Photos move into the public image store when the work is published.
  const refs: string[] = [];
  for (const imgId of s.images || []) {
    const img = await loadGuestImage(imgId);
    if (!img) continue;
    const id = `img-${Date.now().toString(36)}-${randomCode(8, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
    const b = writeBatch(db);
    b.set(doc(db, 'media', id), { id, dataUrl: img.dataUrl, width: img.width, height: img.height, bytes: img.bytes, alt: s.title.slice(0, 300), ownerUid: me.uid, ownerName: s.contact.name.slice(0, 120), createdAt: now() });
    await b.commit();
    refs.push(`media:${id}`);
  }
  const articleId = `art-g-${s.id.slice(3)}`;
  const t = now();
  const words = (s.content || s.excerpt).split(/\s+/).filter(Boolean).length;
  const extraImages = refs.slice(1).map((r) => `\n\n![${s.title.replace(/[[\]]/g, '')}](${r})`).join('');
  const article: Article = {
    id: articleId,
    title: s.title,
    slug: slugify(s.title, s.id),
    excerpt: (s.excerpt || s.content.slice(0, 180)).slice(0, 2000),
    content: `${s.content}${extraImages}`,
    category: s.kind === 'statement' ? 'political' : s.kind === 'news' ? (s.topic?.startsWith('news_') ? s.topic : 'news_kurdistan') : s.topic || 'political',
    tags: [...(s.kind === 'statement' ? ['statement'] : s.kind === 'news' ? ['news'] : []), ...(Array.isArray(s.tags) ? s.tags.slice(0, 12) : [])],
    authorUid: `guest:${s.id}`,
    authorDisplayName: s.contact.name,
    isOfficialNews: false,
    contentType: contentTypeOf(s.kind),
    status: 'published',
    publishedAt: t,
    createdAt: s.createdAt,
    updatedAt: t,
    viewsCount: 0, likesCount: 0, sharesCount: 0,
    readingTimeMinutes: Math.max(1, Math.ceil(words / 200)),
    contributorType: 'visitor',
    feeCategory: s.feeCategory,
    direction: s.direction,
    language: s.language,
    ...(refs[0] ? { coverImageUrl: refs[0], coverImageAlt: s.title.slice(0, 300) } : {}),
    ...(s.videoUrl ? { videoUrl: s.videoUrl } : {}),
    ...(s.sourceLinks ? { sourceLinks: s.sourceLinks } : {}),
  };
  const key = s.contributorKey || (await contributorKeyFor(s.contact.email));
  const recRef = doc(db, 'contribution_records', s.id);
  const statsRef = doc(db, 'contributor_stats', key);
  await runTransaction(db, async (tx) => {
    const rec = await tx.get(recRef);
    const stats = await tx.get(statsRef);
    tx.set(doc(db, 'articles', articleId), article);
    tx.update(doc(db, 'guest_submissions', s.id), {
      status: 'published', articleId, articleSlug: article.slug, publishedAt: t, updatedAt: t,
      history: append(s, 'Published on the website', 'editor'),
    });
    // Counted once, only now that it is published (and paid, or free).
    if (!rec.exists()) {
      tx.set(recRef, { id: s.id, uid: key, category: s.feeCategory, title: s.title.slice(0, 300), countedAt: t, countedBy: me.uid });
      const field = s.feeCategory === 'video' ? 'videos' : 'articles';
      if (stats.exists()) tx.update(statsRef, { [field]: increment(1), updatedAt: t });
      else tx.set(statsRef, { uid: key, name: s.contact.name.slice(0, 120), articles: field === 'articles' ? 1 : 0, videos: field === 'videos' ? 1 : 0, updatedAt: t });
    }
  });
  await audit('GUEST_SUBMISSION_PUBLISHED', s.id, `"${s.title}" published as ${articleId}`).catch(() => undefined);
  return article;
};
