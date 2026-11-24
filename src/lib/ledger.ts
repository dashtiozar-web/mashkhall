import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, where, writeBatch, WriteBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { periodKeys } from './points';
import { levelFor } from './levels';
import { notifyUser } from './notify';

/**
 * The points ledger: one document per award, so every point can be traced,
 * reviewed and corrected. Automatic awards use a fixed document id made of
 * the member, the kind of award and what it was for, which means the same
 * action can never earn points twice, even if a page is refreshed or a
 * request is repeated.
 */

export type PointsType =
  | 'article_published'
  | 'article_reaction'
  | 'share_verified'
  | 'activity_attendance'
  | 'research_report'
  | 'media_contribution'
  | 'discussion_contribution'
  | 'project_support'
  | 'bonus_awarded'
  | 'meeting_attendance'
  | 'meeting_streak_bonus'
  | 'meeting_absence_penalty'
  | 'correction';

/** Points for automatic awards (fixed by the organisation). */
export const POINT_VALUES = {
  article_published: 25,
  article_reaction: 10,
  share_verified: 15,
  activity_attendance: 10,
} as const;

export const POINTS_TYPE_LABEL: Record<PointsType, string> = {
  article_published: 'Article published',
  article_reaction: 'Reacted to an article',
  share_verified: 'Shared our content (verified)',
  activity_attendance: 'Attended an activity (confirmed)',
  research_report: 'Research or report contributed',
  media_contribution: 'Photograph or video contributed',
  discussion_contribution: 'Valuable contribution to a discussion',
  project_support: 'Supported a project or initiative',
  bonus_awarded: 'Recognition from the committee',
  meeting_attendance: 'Attended an online meeting (confirmed)',
  meeting_streak_bonus: 'Three meetings attended in a row',
  meeting_absence_penalty: 'Two meetings missed in a row',
  correction: 'Correction',
};

/** Awards that administrators can give by hand, with suggested points. */
export const MANUAL_AWARDS: { type: PointsType; points: number }[] = [
  { type: 'research_report', points: 25 },
  { type: 'media_contribution', points: 15 },
  { type: 'discussion_contribution', points: 10 },
  { type: 'project_support', points: 20 },
  { type: 'bonus_awarded', points: 10 },
  { type: 'correction', points: 0 },
];

export interface PointsEntry {
  id: string;
  userId: string;
  userName?: string;
  type: PointsType;
  points: number;
  targetId?: string;
  targetTitle?: string;
  note?: string;
  periodMonth: string;
  periodQuarter: string;
  createdAt: string;
  awardedBy: string;
}

export const entryId = (userId: string, type: PointsType, targetId?: string) =>
  `${userId}__${type}__${targetId || `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`}`;

const profileRef = (userId: string) => doc(db, 'public_profiles', userId);

/** Adds the ledger entry and the matching change to the member's totals to a batch. */
export const addAwardToBatch = (batch: WriteBatch, e: PointsEntry, currentTotal: number, self = false) => {
  batch.set(doc(db, 'points_ledger', e.id), e);
  const newTotal = currentTotal + e.points;
  batch.update(profileRef(e.userId), {
    [`points.all`]: increment(e.points),
    [`points.${e.periodMonth}`]: increment(e.points),
    [`points.${e.periodQuarter}`]: increment(e.points),
    activityTier: levelFor(newTotal).level.name,
    ...(self ? { lastAward: e.id } : {}),
    updatedAt: new Date().toISOString(),
  });
};

const newEntry = (userId: string, type: PointsType, points: number, extra: Partial<PointsEntry> = {}): PointsEntry => {
  const keys = periodKeys();
  // Firestore refuses undefined values, so leave out anything not given.
  const given = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== '')) as Partial<PointsEntry>;
  return {
    id: given.id || entryId(userId, type, given.targetId),
    userId,
    type,
    points,
    periodMonth: keys.month,
    periodQuarter: keys.quarter,
    createdAt: new Date().toISOString(),
    awardedBy: auth.currentUser?.uid || '',
    ...given,
  } as PointsEntry;
};

const currentTotal = async (userId: string) => {
  const snap = await getDoc(profileRef(userId));
  if (!snap.exists()) throw new Error('This member has no public profile yet, so points cannot be added. Open Members in Administration first.');
  return ((snap.data().points || {}).all as number) || 0;
};

/** Has this award already been given? (Only staff, or the member themselves, can check.) */
export const alreadyAwarded = async (id: string) => {
  try {
    return (await getDoc(doc(db, 'points_ledger', id))).exists();
  } catch {
    return false;
  }
};

/**
 * Staff award. Returns false if the same automatic award was already given.
 * `targetId` makes the award unique (one per article, activity or share).
 */
export const awardPoints = async (
  userId: string,
  type: PointsType,
  points: number,
  extra: { targetId?: string; targetTitle?: string; note?: string; userName?: string } = {},
): Promise<boolean> => {
  const e = newEntry(userId, type, points, extra);
  if (extra.targetId && (await alreadyAwarded(e.id))) return false;
  const total = await currentTotal(userId);
  const batch = writeBatch(db);
  addAwardToBatch(batch, e, total);
  await batch.commit();
  const before = levelFor(total).level;
  const after = levelFor(total + points).level;
  if (points > 0) {
    await notifyUser(userId, {
      type: 'membership',
      title: after.index > before.index ? `You reached ${after.name}!` : `You earned ${points} points`,
      body: `${POINTS_TYPE_LABEL[type]}${extra.targetTitle ? `: ${extra.targetTitle}` : ''}. You now have ${total + points} points.`,
      link: '/account',
    });
  }
  return true;
};

/** Staff: undo an award (the member's totals go down by the same amount). */
export const reverseEntry = async (e: PointsEntry) => {
  const total = await currentTotal(e.userId).catch(() => null);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'points_ledger', e.id));
  if (total !== null) {
    batch.update(profileRef(e.userId), {
      [`points.all`]: increment(-e.points),
      [`points.${e.periodMonth}`]: increment(-e.points),
      [`points.${e.periodQuarter}`]: increment(-e.points),
      activityTier: levelFor(Math.max(0, total - e.points)).level.name,
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
};

/** Staff: rebuild a member's totals from their ledger entries (fixes any drift). */
export const recalculateMember = async (userId: string) => {
  const snap = await getDocs(query(collection(db, 'points_ledger'), where('userId', '==', userId)));
  const totals: Record<string, number> = { all: 0 };
  snap.docs.forEach((d) => {
    const e = d.data() as PointsEntry;
    totals.all += e.points;
    totals[e.periodMonth] = (totals[e.periodMonth] || 0) + e.points;
    totals[e.periodQuarter] = (totals[e.periodQuarter] || 0) + e.points;
  });
  const batch = writeBatch(db);
  batch.update(profileRef(userId), { points: totals, activityTier: levelFor(totals.all).level.name, updatedAt: new Date().toISOString() });
  await batch.commit();
  return totals.all;
};

/**
 * Administrators: put every member on the current points rules at once.
 * 1. Articles already published, and reactions already given, are credited
 *    at today's values (25 and 10) if they have no ledger entry yet.
 * 2. Every member's total and level is then rebuilt from the ledger, so
 *    points from the old scheme (for example 100 per article) disappear.
 * Safe to run more than once: nothing is ever credited twice.
 */
export const resetAllPointsToCurrentRules = async (onProgress?: (text: string) => void) => {
  const me = auth.currentUser?.uid || '';
  const say = (t: string) => onProgress?.(t);
  say('Reading members, articles and awards…');
  const [profilesSnap, articlesSnap, ledgerSnap, likesSnap] = await Promise.all([
    getDocs(collection(db, 'public_profiles')),
    getDocs(query(collection(db, 'articles'), where('status', '==', 'published'))),
    getDocs(collection(db, 'points_ledger')),
    getDocs(collectionGroup(db, 'likes')),
  ]);
  const profiles = new Map(profilesSnap.docs.map((d) => [d.id, d.data() as { displayName?: string }]));
  const ledger = new Map(ledgerSnap.docs.map((d) => [d.id, { ...(d.data() as PointsEntry), id: d.id }]));
  const articles = new Map(articlesSnap.docs.map((d) => [d.id, d.data() as { authorUid?: string; title?: string; publishedAt?: string; createdAt?: string }]));

  const toAdd: PointsEntry[] = [];
  const add = (userId: string, type: PointsType, points: number, targetId: string, title: string, when?: string) => {
    const id = `${userId}__${type}__${targetId}`;
    if (!profiles.has(userId) || ledger.has(id)) return;
    const date = when && !Number.isNaN(Date.parse(when)) ? new Date(when) : new Date();
    const keys = periodKeys(date);
    const name = profiles.get(userId)?.displayName;
    const e: PointsEntry = {
      id, userId, type, points, targetId,
      targetTitle: (title || '').slice(0, 200),
      ...(name ? { userName: name } : {}),
      note: 'Credited when points were moved to the current rules',
      periodMonth: keys.month, periodQuarter: keys.quarter,
      createdAt: date.toISOString(), awardedBy: me,
    };
    toAdd.push(e);
    ledger.set(id, e);
  };

  articles.forEach((a, id) => {
    if (a.authorUid) add(a.authorUid, 'article_published', POINT_VALUES.article_published, id, a.title || '', a.publishedAt || a.createdAt);
  });
  likesSnap.docs.forEach((d) => {
    const parent = d.ref.parent.parent;
    if (!parent || parent.parent.id !== 'articles') return;
    const a = articles.get(parent.id);
    if (!a || a.authorUid === d.id) return;
    const at = (d.data() as { createdAt?: string }).createdAt;
    add(d.id, 'article_reaction', POINT_VALUES.article_reaction, parent.id, a.title || '', at);
  });

  for (let i = 0; i < toAdd.length; i += 400) {
    say(`Crediting past articles and reactions (${Math.min(i + 400, toAdd.length)} of ${toAdd.length})…`);
    const batch = writeBatch(db);
    toAdd.slice(i, i + 400).forEach((e) => batch.set(doc(db, 'points_ledger', e.id), e));
    await batch.commit();
  }

  // Rebuild every member's totals from the full ledger.
  const totals = new Map<string, Record<string, number>>();
  profiles.forEach((_, id) => totals.set(id, { all: 0 }));
  ledger.forEach((e) => {
    const t = totals.get(e.userId);
    if (!t) return;
    t.all += e.points;
    t[e.periodMonth] = (t[e.periodMonth] || 0) + e.points;
    t[e.periodQuarter] = (t[e.periodQuarter] || 0) + e.points;
  });
  const ids = Array.from(totals.keys());
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 400) {
    say(`Updating totals and levels (${Math.min(i + 400, ids.length)} of ${ids.length} members)…`);
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => {
      const t = totals.get(id)!;
      batch.update(profileRef(id), { points: t, activityTier: levelFor(t.all).level.name, updatedAt: now });
    });
    await batch.commit();
  }
  return { credited: toAdd.length, members: ids.length };
};

export const loadLedger = async (opts: { userId?: string; max?: number } = {}) => {
  const col = collection(db, 'points_ledger');
  const q = opts.userId
    ? query(col, where('userId', '==', opts.userId))
    : query(col, orderBy('createdAt', 'desc'), limit(opts.max || 200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as PointsEntry), id: d.id }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

export const deleteEntryOnly = (id: string) => deleteDoc(doc(db, 'points_ledger', id));

/** The member's own reaction award, added to the like batch (see DataContext). */
export const reactionEntry = (userId: string, articleId: string, title: string, userName?: string) =>
  newEntry(userId, 'article_reaction', POINT_VALUES.article_reaction, {
    id: `${userId}__article_reaction__${articleId}`,
    targetId: articleId,
    targetTitle: title.slice(0, 200),
    ...(userName ? { userName } : {}),
    awardedBy: userId,
  });
