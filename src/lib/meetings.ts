import { useCallback, useEffect, useState } from 'react';
import { auth } from '../firebase';

/**
 * Online meetings: the website side. Everything goes through the server
 * (worker/meetings.js), which checks who you are and what you may do.
 */

export type RoomKind = 'council' | 'board' | 'joint' | 'research' | 'production' | 'webadmin';
export type MeetingStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type AttendanceStatus = 'attended' | 'late' | 'absent' | 'excused';
export type Permission = 'schedule' | 'start' | 'admit' | 'mute' | 'remove' | 'lock' | 'attendance' | 'activities';

export interface Room {
  id: string;
  kind: RoomKind;
  name: string;
  chapterId?: string;
  role: 'admin' | 'senior' | 'leader' | 'moderator' | 'member';
  host: boolean;
  leaderUid: string | null;
  leaderName?: string;
  can: Record<Permission, boolean>;
}

export interface Meeting {
  id: string;
  roomId: string;
  title: string;
  purpose: string;
  agenda: string;
  startAt: string;
  durationMin: number;
  kind: 'regular' | 'preparation';
  activityId: string;
  invite: 'all' | 'selected';
  invitees?: string[];
  recurrence: 'none' | 'monthly';
  status: MeetingStatus;
  locked: boolean;
  waitingRoom: 'off' | 'host' | 'approve';
  speaking: 'open' | 'controlled';
  /** Audio only (the usual), or audio and video. */
  media: 'audio' | 'video';
  startedAt: string | null;
  endedAt: string | null;
  attendanceStatus: 'none' | 'approved';
  attendedCount: number | null;
  eligibleCount: number | null;
  cancelReason: string;
}

export interface Overview {
  me: { uid: string; isAdmin: boolean; name: string; member: boolean };
  rooms: Room[];
  upcoming: Meeting[];
  recent: Meeting[];
  settings: { thresholdPercent: number; lateMinutes: number; reminders: number[] };
  setup: { database: boolean; video: boolean };
}

export interface Notice {
  id: string;
  roomId: string;
  kind: 'notice' | 'document';
  title: string;
  body: string;
  link: string;
  createdAt: string;
  createdByName: string;
}

export interface RoomDetail {
  room: Room;
  meetings: Meeting[];
  members: { uid: string; name: string; photoUrl: string; positionId: string }[];
  notices: Notice[];
  moderators: { uid: string; name: string }[];
}

export interface ActionPoint {
  id: string;
  text: string;
  owner: string;
  ownerName: string;
  due: string;
  status: 'open' | 'in_progress' | 'done';
}

export interface MinutesView {
  minutes: { text: string; decisions: string; actions: ActionPoint[]; updatedAt: string; updatedByName: string };
  canEdit: boolean;
  people: { uid: string; name: string }[];
}

export interface RoomReport {
  room: { id: string; name: string };
  meetings: { id: string; title: string; startAt: string }[];
  people: { uid: string; name: string; attended: number; late: number; absent: number; excused: number; meetings: number; rate: number }[];
}

export interface AccessCheck {
  member: { uid: string; name: string; status: string; positions: string[]; chapterId: string };
  rooms: { id: string; name: string; kind: RoomKind; allowed: boolean; host: boolean; role: string | null; why: string[] }[];
}

/** How each kind of room is described. */
export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  council: 'Council',
  board: 'Board of Directors',
  joint: 'Board and Council Leaders',
  research: 'Research and Investigation (confidential)',
  production: 'Production Team',
  webadmin: 'Website Administration',
};

export const ACTION_LABEL: Record<ActionPoint['status'], string> = { open: 'To do', in_progress: 'In progress', done: 'Done' };

export interface MeetingDetail {
  meeting: Meeting;
  room: { id: string; name: string; kind: RoomKind };
  me: { role: Room['role']; host: boolean; can: Record<Permission, boolean> };
  leader: { uid: string | null; name: string };
  live: { participants: number } | null;
  video: boolean;
}

export interface AttendanceRow {
  uid: string;
  name: string;
  photoUrl: string;
  chapterId: string;
  eligible: boolean;
  minutes: number;
  percent: number;
  firstJoin: string | null;
  lastLeave: string | null;
  measured: AttendanceStatus;
  status: AttendanceStatus;
}

export interface ConfirmedRow {
  id: string;
  uid: string;
  name: string;
  photoUrl: string;
  status: AttendanceStatus;
  measured: AttendanceStatus;
  minutes: number;
  percent: number;
  firstJoin: string | null;
  override?: { from: string; reason: string; by: string; at: string };
  corrections?: { from: string; to: string; reason: string; by: string; at: string }[];
}

export interface AttendanceView {
  meeting: Meeting;
  room: { id: string; name: string };
  rows: AttendanceRow[];
  length: number;
  needed: number;
  start: string;
  end: string;
  confirmed: ConfirmedRow[];
  settings: { thresholdPercent: number; lateMinutes: number };
}

export interface MyMeetings {
  history: { meetingId: string; title: string; roomId: string; startAt: string; status: AttendanceStatus; minutes: number; corrected: boolean }[];
  streak: { attended: number; missed: number; untilBonus: number };
  points: { id: string; type: string; points: number; title: string; note: string; createdAt: string }[];
  activities: { activityId: string; title: string; date: string; status: 'attended' | 'not_attended' | 'excused'; review: string }[];
  awards: { id: string; number: string; activityTitle: string; activityDate: string; issuedAt: string }[];
}

export class MeetingError extends Error {
  status: number;
  setup: boolean;
  constructor(message: string, status: number, setup = false) {
    super(message);
    this.status = status;
    this.setup = setup;
  }
}

export const meetingApi = async <T,>(path: string, body?: unknown): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new MeetingError('Please sign in with your member account.', 401);
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`/api/meetings/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new MeetingError('Could not reach the server. Check your connection and try again.', 0);
  }
  let data: { error?: string; setup?: boolean } & Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new MeetingError(data.error || `The server could not do this (${res.status}).`, res.status, Boolean(data.setup));
  return data as T;
};

/** Loads something from the meetings server, with reload. */
export const useMeetingData = <T,>(path: string | null, deps: unknown[] = []) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<MeetingError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [uid, setUid] = useState<string | null | undefined>(auth.currentUser?.uid);
  useEffect(() => auth.onAuthStateChanged((u) => setUid(u?.uid ?? null)), []);
  const load = useCallback(async () => {
    if (!path || !uid) { setLoading(false); return; }
    setLoading(true);
    try {
      setData(await meetingApi<T>(path));
      setError(null);
    } catch (e) {
      setError(e as MeetingError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, uid, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, signedIn: Boolean(uid), authKnown: uid !== undefined };
};

// ---------------------------------------------------------------- display

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  attended: 'Attended',
  late: 'Attended (late)',
  absent: 'Absent',
  excused: 'Excused absence',
};

export const ROLE_LABEL: Record<Room['role'], string> = {
  admin: 'Administrator',
  senior: 'Senior official',
  leader: 'Meeting leader',
  moderator: 'Moderator',
  member: 'Member',
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  schedule: 'Schedule, change and cancel meetings',
  start: 'Start and end meetings',
  admit: 'Admit people from the waiting room',
  mute: 'Mute participants and control who speaks',
  remove: 'Remove participants',
  lock: 'Lock the meeting',
  attendance: 'Confirm attendance and absence lists',
  activities: 'Submit activity participation lists',
};

const UK = 'Europe/London';

/** "Sunday 1 November 2026" in the reader's own time zone. */
export const dayText = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone });

export const timeText = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });

const localZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return UK; }
};

/** Official (UK) time, and the reader's local time if they are elsewhere. */
export const meetingTime = (iso: string) => {
  const official = `${dayText(iso, UK)}, ${timeText(iso, UK)} UK time`;
  const zone = localZone();
  const differs = timeText(iso, zone) !== timeText(iso, UK) || dayText(iso, zone) !== dayText(iso, UK);
  return { official, local: differs ? `${dayText(iso, zone)}, ${timeText(iso, zone)} your time` : '' };
};

/** Date and time inputs (UK time) to an ISO timestamp. */
export const ukToIso = (date: string, time: string) => {
  // Find the UK offset for that moment (it changes with summer time).
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit' }).formatToParts(guess);
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const shownMin = (h % 24) * 60 + m;
  const wantedMin = guess.getUTCHours() * 60 + guess.getUTCMinutes();
  let offset = shownMin - wantedMin;
  if (offset > 720) offset -= 1440;
  if (offset < -720) offset += 1440;
  return new Date(guess.getTime() - offset * 60000).toISOString();
};

export const isoToUk = (iso: string) => {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: UK, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
};

export const minutesText = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ''}`.trim() : `${n} min`);

/** A meeting can be joined (by members) once it is live, and started by hosts from an hour before. */
export const joinable = (m: Meeting, host: boolean) =>
  m.status === 'live' || (host && m.status === 'scheduled' && Date.parse(m.startAt) - Date.now() < 60 * 60000);
