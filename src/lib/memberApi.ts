import { auth } from '../firebase';
import { MemberRecord } from '../types';

/**
 * Calls the website server for every change to a member record, position or
 * card (worker/members.js). The server saves the member record and refreshes
 * every copy of it (directory, organisation chart, card verification and
 * account) in one all-or-nothing step, and records who changed what.
 *
 * A promise that resolves means the change is saved. Anything else throws
 * an Error with a message to show; nothing is reported as saved unless the
 * server confirmed it.
 */
export class ServerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const serverApi = async <T,>(path: string, body?: unknown): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new ServerError('Please sign in again.', 401);
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ServerError('Could not reach the website server. Check your connection; nothing was saved.', 0);
  }
  let data: { error?: string } & Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new ServerError(data.error || `The server could not do this (${res.status}). Nothing was saved.`, res.status);
  return data as T;
};

export type MemberChanges = Partial<Pick<MemberRecord, 'fullName' | 'displayName' | 'email' | 'phone' | 'chapterId' | 'joinedAt' | 'validFrom' | 'expiresAt' | 'photoUrl' | 'bio' | 'expertise'>>;

export const updateMember = (memberId: string, changes: MemberChanges, opts: { expectUpdatedAt?: string; reason?: string; effectiveDate?: string } = {}) =>
  serverApi<{ member: MemberRecord; changed: string[] }>('members/update', { memberId, changes, ...opts });

export const updateMyProfile = (changes: Pick<MemberChanges, 'displayName' | 'bio' | 'expertise' | 'photoUrl'>) =>
  serverApi<{ member: MemberRecord; changed: string[] }>('members/self', changes);

export const setMemberStatus = (memberId: string, status: 'active' | 'suspended' | 'revoked', reason = '') =>
  serverApi<{ member: MemberRecord }>('members/status', { memberId, status, reason });

export interface CardInput {
  memberId: string;
  memberNumber?: string;
  joinedAt: string;
  validFrom: string;
  expiresAt: string;
  replaceQr?: boolean;
  kind: 'issued' | 'renewed' | 'updated';
}
export const issueCard = (input: CardInput) => serverApi<{ member: MemberRecord }>('members/card', input);

export type SeatStatus = 'active' | 'acting' | 'on_leave' | 'suspended';
export const SEAT_STATUS_LABEL: Record<SeatStatus, string> = { active: 'Active', acting: 'Acting', on_leave: 'On leave', suspended: 'Suspended' };

export interface AppointInput {
  seatId: string;
  memberId: string;
  /** Keep the member's other positions (only where holding several is allowed). */
  keepOtherPositions?: boolean;
  /** Transfer the member to the council of this position. */
  moveToCouncil?: boolean;
  effectiveDate?: string;
  reason?: string;
  status?: SeatStatus;
  /** Grant the website permissions configured for a Website Administration position. */
  applyPermissions?: boolean;
  removePreviousPermissions?: boolean;
}
export const appointToSeat = (input: AppointInput) => serverApi<{ member: MemberRecord; action: string }>('members/appoint', input);
export const vacateSeat = (seatId: string, opts: { reason?: string; effectiveDate?: string; removePermissions?: boolean } = {}) =>
  serverApi<{ ok: true }>('members/vacate', { seatId, ...opts });
export const updateSeat = (seatId: string, opts: { status?: SeatStatus; reportsTo?: string; reason?: string; effectiveDate?: string }) =>
  serverApi<{ ok: true; changed: string[] }>('members/seat', { seatId, ...opts });

export interface PositionHistoryEntry {
  id: string;
  memberId: string;
  memberName: string;
  action: 'appointed' | 'promoted' | 'demoted' | 'moved' | 'transferred' | 'replaced' | 'removed' | 'status_changed' | 'reporting_changed';
  from: string;
  to: string;
  effectiveDate: string;
  byName: string;
  reason?: string;
  at: string;
}
export interface ChangeLogEntry {
  id: string;
  action: string;
  actorName?: string;
  actorEmail: string;
  details: string;
  changes?: { field: string; from: string; to: string }[];
  timestamp: string;
}
export const memberHistory = (memberId: string) =>
  serverApi<{ positions: PositionHistoryEntry[]; log: ChangeLogEntry[] }>(`members/history?id=${encodeURIComponent(memberId)}`);

export const resyncMembers = (memberIds: string[]) => serverApi<{ done: string[]; failed: { id: string; error: string }[] }>('members/resync', { memberIds });

export const permissionTemplates = () => serverApi<{ templates: Record<string, string[]>; permissions: string[] }>('members/permission-templates');
export const savePermissionTemplates = (templates: Record<string, string[]>) =>
  serverApi<{ templates: Record<string, string[]>; permissions: string[] }>('members/permission-templates', { templates });

export const HISTORY_LABEL: Record<PositionHistoryEntry['action'], string> = {
  appointed: 'Appointed',
  promoted: 'Promoted',
  demoted: 'Moved to a less senior position',
  moved: 'Moved',
  transferred: 'Transferred',
  replaced: 'Replaced',
  removed: 'Position ended',
  status_changed: 'Status changed',
  reporting_changed: 'Reporting line changed',
};

/** What the QR page of a card shows (from the live member record). */
export interface CardCheck {
  found: boolean;
  state?: 'valid' | 'expired' | 'suspended' | 'revoked' | 'replaced';
  name?: string;
  photoUrl?: string;
  memberNumber?: string;
  position?: string;
  unit?: string;
  council?: string;
  memberSince?: string;
  validFrom?: string;
  expiresAt?: string;
  profileId?: string;
  checkedAt?: string;
}
export const checkCard = async (token: string): Promise<CardCheck> => {
  const res = await fetch(`/api/verify/id/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Verification is not available right now (${res.status}).`);
  return res.json();
};

/** Members publish without a fee: make a Publish with Us submission fee-free and send it for review (member or staff). */
export const waivePublicationFee = (id: string) => serverApi<{ ok: true; status: string; already?: boolean }>('members/waive-fee', { id });
