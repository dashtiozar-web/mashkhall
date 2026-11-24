import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { awardPoints, POINT_VALUES } from './ledger';
import { notifyUser } from './notify';

/**
 * Sharing our content elsewhere. Sharing itself can't be checked by the
 * website, so a member sends the link to their post and an administrator
 * opens it; only then are the 15 points awarded. One claim per member per
 * article or activity, so the same share can't be claimed twice.
 */

export type SharePlatform = 'facebook' | 'x' | 'whatsapp' | 'telegram' | 'instagram' | 'tiktok' | 'linkedin' | 'other';
export type ShareStatus = 'pending' | 'approved' | 'rejected';

export interface ShareClaim {
  id: string;
  userId: string;
  userName?: string;
  targetType: 'article' | 'activity';
  targetId: string;
  targetTitle?: string;
  platform: SharePlatform;
  url: string;
  status: ShareStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export const SHARE_STATUS_LABEL: Record<ShareStatus, string> = {
  pending: 'Waiting for a check',
  approved: `Verified (+${POINT_VALUES.share_verified} points)`,
  rejected: 'Not accepted',
};

export const PLATFORMS: { id: SharePlatform; label: string; host: RegExp }[] = [
  { id: 'facebook', label: 'Facebook', host: /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i },
  { id: 'x', label: 'X (Twitter)', host: /(^|\.)(x\.com|twitter\.com)$/i },
  { id: 'whatsapp', label: 'WhatsApp channel', host: /(^|\.)(whatsapp\.com)$/i },
  { id: 'telegram', label: 'Telegram', host: /(^|\.)(t\.me|telegram\.me)$/i },
  { id: 'instagram', label: 'Instagram', host: /(^|\.)instagram\.com$/i },
  { id: 'tiktok', label: 'TikTok', host: /(^|\.)tiktok\.com$/i },
  { id: 'linkedin', label: 'LinkedIn', host: /(^|\.)linkedin\.com$/i },
  { id: 'other', label: 'Another website', host: /.*/ },
];

export const claimId = (uid: string, targetType: ShareClaim['targetType'], targetId: string) => `${uid}__${targetType}_${targetId}`;

/** Build the share links for the usual platforms. */
export const shareLinks = (url: string, title: string) => {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];
};

export const getMyClaim = async (targetType: ShareClaim['targetType'], targetId: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'share_claims', claimId(uid, targetType, targetId)));
    return snap.exists() ? ({ ...(snap.data() as ShareClaim), id: snap.id }) : null;
  } catch {
    return null;
  }
};

export const submitShareClaim = async (c: { targetType: ShareClaim['targetType']; targetId: string; targetTitle: string; platform: SharePlatform; url: string; userName?: string }) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in first.');
  const url = c.url.trim();
  if (!/^https:\/\/[^\s]+\.[^\s]+/.test(url)) throw new Error('Paste the full link to your post, starting with https://');
  const claim: ShareClaim = {
    id: claimId(uid, c.targetType, c.targetId),
    userId: uid,
    ...(c.userName ? { userName: c.userName } : {}),
    targetType: c.targetType,
    targetId: c.targetId,
    targetTitle: c.targetTitle.slice(0, 300),
    platform: c.platform,
    url: url.slice(0, 500),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const existing = await getMyClaim(c.targetType, c.targetId);
  if (existing && existing.status !== 'rejected') throw new Error('You have already sent a link for this.');
  if (existing) {
    // A rejected claim can be sent again with a new link.
    await updateDoc(doc(db, 'share_claims', claim.id), { url: claim.url, platform: claim.platform, status: 'pending', createdAt: claim.createdAt });
  } else {
    await setDoc(doc(db, 'share_claims', claim.id), claim);
  }
  return claim;
};

export const loadClaims = async (status?: ShareStatus) => {
  const col = collection(db, 'share_claims');
  const snap = await getDocs(status ? query(col, where('status', '==', status)) : col);
  return snap.docs.map((d) => ({ ...(d.data() as ShareClaim), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** Administrator decision. Approving awards 15 points, once. */
export const reviewClaim = async (c: ShareClaim, approve: boolean, note = '') => {
  await updateDoc(doc(db, 'share_claims', c.id), {
    status: approve ? 'approved' : 'rejected',
    reviewedBy: auth.currentUser?.uid || '',
    reviewedAt: new Date().toISOString(),
    reviewNote: note.trim().slice(0, 300),
  });
  if (approve) {
    await awardPoints(c.userId, 'share_verified', POINT_VALUES.share_verified, {
      targetId: `${c.targetType}_${c.targetId}`, targetTitle: c.targetTitle, userName: c.userName,
    });
  } else {
    await notifyUser(c.userId, {
      type: 'membership',
      title: 'Your share could not be verified',
      body: note.trim() || 'We could not find the post at the link you sent. You can send a new link.',
      link: '/account/activity',
    });
  }
};
