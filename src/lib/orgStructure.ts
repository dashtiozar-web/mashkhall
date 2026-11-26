import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppointInput, appointToSeat, resyncMembers, SeatStatus, vacateSeat } from './memberApi';
import {
  BOARD_POSITIONS, COUNCIL_POSITIONS, DEFAULT_POSITION, Position, PositionId, PRODUCTION_POSITIONS, positionById, UnitId, WEBADMIN_POSITIONS,
} from './positions';

/**
 * Appointments to the organisation's positions. Each seat is one Firestore
 * document whose id names the seat, so a seat can only ever hold one person:
 *   board__president
 *   council__london__council_leader
 *   council__london__security__3     (Security Members: seats 1 to 5)
 *   production__video_editor
 * Seats are public (the chart reads them). Only the website server changes
 * them (worker/members.js), and council seats only accept members of that
 * council.
 */

export interface Seat {
  id: string;
  unit: Exclude<UnitId, 'membership'>;
  positionId: PositionId;
  councilId?: string;
  /** 1–5 for Security Members. */
  seat?: number;
}

export interface Assignment extends Seat {
  memberId: string;
  memberName: string;
  assignedAt: string;
  assignedBy: string;
  /** Date the appointment takes effect. */
  effectiveDate?: string;
  /** Active unless marked acting, on leave or suspended. */
  status?: SeatStatus;
  /** A different seat this one reports to, if not the standard line. */
  reportsTo?: string;
}

/** How many seats a council position has (corner members have several). */
export const seatCount = (positionId: string) => positionById(positionId)?.seats || 1;

export const seatId = (unit: Seat['unit'], positionId: PositionId, councilId?: string, seat?: number) =>
  unit === 'council'
    ? `council__${councilId}__${positionId}${seatCount(positionId) > 1 ? `__${seat}` : ''}`
    : `${unit}__${positionId}`;

const mk = (unit: Seat['unit'], p: Position, councilId?: string, seat?: number): Seat => ({
  id: seatId(unit, p.id, councilId, seat),
  unit,
  positionId: p.id,
  ...(councilId ? { councilId } : {}),
  ...(seat ? { seat } : {}),
});

export const boardSeats = (): Seat[] => BOARD_POSITIONS.map((p) => mk('board', p));
export const productionSeats = (): Seat[] => PRODUCTION_POSITIONS.map((p) => mk('production', p));
export const webadminSeats = (): Seat[] => WEBADMIN_POSITIONS.map((p) => mk('webadmin', p));

/** Every seat of a unit (councils need the council). */
export const seatsOf = (unit: Seat['unit'], councilId?: string): Seat[] =>
  unit === 'board' ? boardSeats() : unit === 'production' ? productionSeats() : unit === 'webadmin' ? webadminSeats() : councilId ? councilSeats(councilId) : [];
export const councilSeats = (councilId: string): Seat[] =>
  COUNCIL_POSITIONS.flatMap((p) =>
    p.seats > 1
      ? Array.from({ length: p.seats }, (_, i) => mk('council', p, councilId, i + 1))
      : [mk('council', p, councilId)]);

/** Live list of every appointment (public). */
export const useAssignments = () => {
  const [rows, setRows] = useState<Assignment[] | null>(null);
  useEffect(() => onSnapshot(
    collection(db, 'org_assignments'),
    (snap) => setRows(snap.docs.map((d) => ({ ...(d.data() as Assignment), id: d.id }))),
    () => setRows([]),
  ), []);
  return rows;
};

export const byId = (rows: Assignment[] | null | undefined) => new Map((rows || []).map((a) => [a.id, a]));

/** The positions a member holds, most senior first. */
export const heldBy = (rows: Assignment[] | null | undefined, memberId: string) =>
  (rows || []).filter((a) => a.memberId === memberId)
    .sort((a, b) => (positionById(a.positionId)?.number || 99) - (positionById(b.positionId)?.number || 99));

/** Most senior position among a member's appointments. */
export const mainPosition = (held: Pick<Assignment, 'positionId'>[]): PositionId =>
  held.map((a) => positionById(a.positionId)).filter(Boolean)
    .sort((a, b) => a!.number - b!.number)[0]?.id || DEFAULT_POSITION;

/**
 * Rebuild the member's title, card and profile from their appointments (the
 * server keeps these in step automatically; this repairs older records).
 */
export const syncMemberTitle = async (memberId: string) => {
  const { failed } = await resyncMembers([memberId]);
  if (failed.length) throw new Error(failed[0].error);
};

export interface Appointee {
  id: string;
  displayName: string;
  chapterId?: string;
}

export const seatLabel = (s: Seat, councilName?: (id: string) => string) => {
  const p = positionById(s.positionId)!;
  const unit = s.unit === 'board' ? 'Board of Directors' : s.unit === 'production' ? 'Production Team' : s.unit === 'webadmin' ? 'Website Administration' : `${councilName?.(s.councilId!) || s.councilId} Council`;
  return `${p.title}${s.seat ? ` ${s.seat}` : ''}, ${unit}`;
};

/**
 * Appoint a member to a seat (replacing whoever held it). The website server
 * checks the council, frees the member's other positions unless they are
 * kept, updates their card, profile and the chart together, records the
 * change in their position history and tells the people affected.
 */
export const appoint = async (s: Seat, person: Appointee, _rows?: Assignment[], _councilName?: (id: string) => string, opts: Omit<AppointInput, 'seatId' | 'memberId'> = {}) =>
  appointToSeat({ seatId: s.id, memberId: person.id, ...opts });

/** Make a seat vacant. */
export const vacate = async (a: Assignment, _councilName?: (id: string) => string, opts: { reason?: string; effectiveDate?: string; removePermissions?: boolean } = {}) =>
  vacateSeat(a.id, opts);
