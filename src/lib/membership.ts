import { doc } from 'firebase/firestore';
import { auth, db, safeSetDoc } from '../firebase';
import { MemberRecord, Verification, VerificationState } from '../types';
import { issueCard, setMemberStatus } from './memberApi';

/** Used in QR codes until an administrator sets the address in Settings. */
export const DEFAULT_SITE_URL = 'https://mashkhall.com';

/** Membership numbers follow the printed cards: M followed by seven digits. */
export const MEMBER_NUMBER_PATTERN = /^M\d{7}$/;
export const formatMemberNumber = (n: number) => `M${String(n).padStart(7, '0')}`;

export const DESIGNATIONS = [
  'Member',
  'Human Rights Activist',
  'Human Rights Researcher',
  'Journalist',
  'Photographer',
  'Media Officer',
  'Public Relations Officer',
  'Council Coordinator',
  'Board Member',
];

/** Fixed link printed as the card's QR code: the member's profile page on the
 *  website, which also shows the live status of the card. */
export const verifyUrlFor = (siteUrl: string | undefined, memberNumber: string) =>
  `${(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '')}/#/people/${encodeURIComponent(memberNumber)}`;

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const addYears = (isoDate: string, years: number) => {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
};

/** dd/mm/yyyy, as printed on the cards. */
export const cardDate = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

/** The state a verifier sees. Expiry is worked out from the date, so it is
 *  never out of date even if nobody updates the record. */
export const verificationState = (
  status: Verification['status'] | MemberRecord['status'] | undefined,
  expiresAt?: string,
): VerificationState => {
  if (status === 'revoked' || status === 'archived') return 'revoked';
  if (status === 'suspended') return 'suspended';
  if (expiresAt && expiresAt.slice(0, 10) < todayIso()) return 'expired';
  return 'active';
};

export const STATE_LABEL: Record<VerificationState, string> = {
  active: 'Valid',
  expired: 'Expired',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

export const audit = async (action: string, targetId: string, details: string) => {
  const actor = auth.currentUser;
  if (!actor) return;
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await safeSetDoc(doc(db, 'audit_logs', id), {
      id, actorUid: actor.uid, actorEmail: actor.email || '', action, targetType: 'members', targetId, details,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Audit log note:', e);
  }
};

export interface CredentialInput {
  memberId: string;
  /** Leave empty to keep the current number or allocate the next one. */
  memberNumber?: string;
  /** No longer used: the title always comes from the member's positions. */
  positionId?: string;
  designation?: string;
  joinedAt: string;
  validFrom: string;
  expiresAt: string;
  siteUrl?: string;
  /** Issues a new QR code (the old one stops verifying). */
  replaceQr?: boolean;
  kind: 'issued' | 'renewed' | 'updated';
}

/**
 * Issue, renew or update a member's card. The website server saves the
 * member record, the card verification record and the directory profile
 * together, gives new cards an unguessable QR link, and tells the member.
 */
export const issueCredential = async (input: CredentialInput): Promise<MemberRecord> => {
  const { member } = await issueCard({
    memberId: input.memberId,
    memberNumber: input.memberNumber,
    joinedAt: input.joinedAt,
    validFrom: input.validFrom,
    expiresAt: input.expiresAt,
    replaceQr: input.replaceQr,
    kind: input.kind,
  });
  return member;
};

/** Suspend, revoke or reactivate a membership everywhere it shows (server). */
export const setMembershipStatus = async (
  member: MemberRecord,
  status: 'active' | 'suspended' | 'revoked',
  reason = '',
) => {
  await setMemberStatus(member.id, status, reason);
};

/** A QR link in the newer, unguessable form (/id/…), rather than the member number. */
export const isSecureQr = (url?: string) => Boolean(url && /\/id\/[A-Za-z0-9]{20,}$/.test(url));

/**
 * Official joining date from an application: the date the applicant said
 * they became a member, or, for new members, the day they applied.
 */
export const statedMemberSince = (app: { involvement?: { period?: string; since?: string }; createdAt?: string }) => {
  const since = app.involvement?.since?.slice(0, 10);
  if (app.involvement?.period !== 'new' && since && /^\d{4}-\d{2}-\d{2}$/.test(since)) return since;
  return (app.createdAt || new Date().toISOString()).slice(0, 10);
};

/**
 * Default card dates: valid from the joining date, expiring one year after
 * the day the person applied on the website.
 */
export const defaultCardDates = (joinedAt: string, appliedAt?: string) => {
  const validFrom = joinedAt.slice(0, 10);
  let expiresAt = addYears((appliedAt || new Date().toISOString()).slice(0, 10), 1);
  if (expiresAt <= validFrom) expiresAt = addYears(validFrom, 1);
  return { validFrom, expiresAt };
};
