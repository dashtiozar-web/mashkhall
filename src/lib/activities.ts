import { useEffect, useState } from 'react';
import {
  collection, deleteField, doc, getCountFromServer, getDoc, getDocs, increment, onSnapshot, query, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ActivityRegistration, AttendanceResponse, MemberRecord, NewsBanner } from '../types';
import { awardPoints as ledgerAward, PointsEntry, POINT_VALUES, reverseEntry } from './ledger';
import { notifyUser } from './notify';
import { formatEventDate } from './newsBanner';
import { MEMBER_NUMBER_PATTERN } from './membership';

/** Members can register while the activity is upcoming and registration is open. */
export const canRegister = (b: NewsBanner, now = new Date().toISOString()) =>
  b.mode === 'announcement' && b.status === 'published' && b.registrationOpen !== false && (!b.eventAt || b.eventAt > now);

export const activityPath = (id: string) => `/activities/${encodeURIComponent(id)}`;

const regRef = (bannerId: string, uid: string) => doc(db, 'news_banners', bannerId, 'registrations', uid);

export const responseOf = (r?: Pick<ActivityRegistration, 'status'> | null): AttendanceResponse | null =>
  r ? (r.status || 'attending') : null;

/**
 * Record or change the signed-in member's answer. The registration and the
 * "attending" count change together, so totals stay exact.
 */
export const respondToActivity = async (banner: NewsBanner, status: AttendanceResponse, note = '') => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Please sign in first.');
  const [memberSnap, existingSnap, profileSnap] = await Promise.all([
    getDoc(doc(db, 'members', user.uid)),
    getDoc(regRef(banner.id, user.uid)),
    getDoc(doc(db, 'public_profiles', user.uid)),
  ]);
  if (!memberSnap.exists()) throw new Error('Only approved members can respond to activities.');
  const m = memberSnap.data() as MemberRecord;
  if (m.status !== 'active') throw new Error('Your membership is not active at the moment.');
  const existing = existingSnap.exists() ? (existingSnap.data() as ActivityRegistration) : null;
  const before = responseOf(existing);
  if (before === status && (existing?.note || '') === note.trim()) return;
  const now = new Date().toISOString();
  const photo = (profileSnap.exists() && (profileSnap.data().photoUrl as string)) || m.photoUrl || '';
  const reg: ActivityRegistration = {
    userId: user.uid,
    name: (profileSnap.exists() && (profileSnap.data().displayName as string)) || m.displayName || m.fullName,
    ...(photo ? { photoUrl: photo } : {}),
    ...(m.memberNumber && MEMBER_NUMBER_PATTERN.test(m.memberNumber) ? { memberNumber: m.memberNumber } : {}),
    ...(m.positionId ? { positionId: m.positionId } : {}),
    ...(m.chapterId ? { chapterId: m.chapterId } : {}),
    ...(note.trim() ? { note: note.trim().slice(0, 300) } : {}),
    status,
    ...(existing?.attended !== undefined ? { attended: existing.attended } : {}),
    ...(existing?.attendedAt ? { attendedAt: existing.attendedAt } : {}),
    ...(existing?.attendedBy ? { attendedBy: existing.attendedBy } : {}),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const delta = (status === 'attending' ? 1 : 0) - (before === 'attending' ? 1 : 0);
  const batch = writeBatch(db);
  batch.set(regRef(banner.id, user.uid), reg);
  if (delta !== 0) batch.update(doc(db, 'news_banners', banner.id), { attendeeCount: increment(delta) });
  await batch.commit();
  if (status === 'attending' && before !== 'attending') {
    await notifyUser(user.uid, {
      type: 'event',
      title: `You're attending: ${banner.message}`,
      body: [formatEventDate(banner.eventAt), banner.location].filter(Boolean).join(' · ') || undefined,
      link: activityPath(banner.id),
    });
  }
};

/** Withdraw the member's answer completely. */
export const cancelRegistration = async (bannerId: string) => {
  const user = auth.currentUser;
  if (!user) return;
  const snap = await getDoc(regRef(bannerId, user.uid));
  if (!snap.exists()) return;
  const batch = writeBatch(db);
  batch.delete(regRef(bannerId, user.uid));
  if (responseOf(snap.data() as ActivityRegistration) === 'attending') {
    batch.update(doc(db, 'news_banners', bannerId), { attendeeCount: increment(-1) });
  }
  await batch.commit();
};

/** Organisers remove someone from the list (the count follows). */
export const removeRegistration = async (bannerId: string, userId: string) => {
  const snap = await getDoc(regRef(bannerId, userId));
  if (!snap.exists()) return;
  const batch = writeBatch(db);
  batch.delete(regRef(bannerId, userId));
  if (responseOf(snap.data() as ActivityRegistration) === 'attending') {
    batch.update(doc(db, 'news_banners', bannerId), { attendeeCount: increment(-1) });
  }
  await batch.commit();
};

/**
 * Organisers confirm that a member actually attended. The member earns 10
 * points, once per activity (the points ledger prevents duplicates).
 */
export const confirmAttendance = async (banner: NewsBanner, r: ActivityRegistration, attended: boolean) => {
  const now = new Date().toISOString();
  await updateDoc(regRef(banner.id, r.userId), attended
    ? { attended: true, attendedAt: now, attendedBy: auth.currentUser?.uid || '' }
    : { attended: false, attendedAt: deleteField(), attendedBy: deleteField() });
  const id = `${r.userId}__activity_attendance__${banner.id}`;
  if (attended) {
    await ledgerAward(r.userId, 'activity_attendance', POINT_VALUES.activity_attendance, { targetId: banner.id, targetTitle: banner.message, userName: r.name });
  } else {
    // Undo the points if attendance is un-confirmed.
    const snap = await getDoc(doc(db, 'points_ledger', id));
    if (snap.exists()) await reverseEntry({ ...(snap.data() as PointsEntry), id });
  }
};

/** Live list of everyone's responses for an activity (public). */
export const useRegistrations = (bannerId: string | undefined) => {
  const [rows, setRows] = useState<ActivityRegistration[] | null>(null);
  useEffect(() => {
    if (!bannerId) return;
    return onSnapshot(
      collection(db, 'news_banners', bannerId, 'registrations'),
      (snap) => setRows(snap.docs.map((d) => ({ ...(d.data() as ActivityRegistration), userId: d.id }))),
      () => setRows([]),
    );
  }, [bannerId]);
  return rows;
};

/** Totals per council (attending and cannot attend), highest attendance first. */
export const councilSummary = (rows: ActivityRegistration[]) => {
  const map = new Map<string, { chapterId: string; attending: number; notAttending: number }>();
  rows.forEach((r) => {
    const key = r.chapterId || '';
    const cur = map.get(key) || { chapterId: key, attending: 0, notAttending: 0 };
    if (responseOf(r) === 'attending') cur.attending += 1; else cur.notAttending += 1;
    map.set(key, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.attending - a.attending || a.notAttending - b.notAttending || a.chapterId.localeCompare(b.chapterId));
};

/** The signed-in member's own response (live). undefined while checking. */
export const useMyRegistration = (bannerId: string | undefined, uid: string | undefined) => {
  const [mine, setMine] = useState<ActivityRegistration | null | undefined>(undefined);
  useEffect(() => {
    if (!bannerId || !uid) { setMine(null); return; }
    setMine(undefined);
    return onSnapshot(regRef(bannerId, uid), (s) => setMine(s.exists() ? (s.data() as ActivityRegistration) : null), () => setMine(null));
  }, [bannerId, uid]);
  return mine;
};

const VIEWER_KEY = '17shubat_viewer_id';
const viewerId = () => {
  try {
    let id = localStorage.getItem(VIEWER_KEY);
    if (!id) {
      id = `v-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VIEWER_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
};

/**
 * Record that someone looked at an activity: once per member, or once per
 * device for visitors. Nothing personal is stored for visitors.
 */
export const recordActivityView = async (bannerId: string) => {
  const uid = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : undefined;
  const id = uid || viewerId();
  if (!id) return;
  const key = `17shubat_viewed_activity_${bannerId}_${id}`;
  try { if (localStorage.getItem(key)) return; } catch { /* count anyway */ }
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'news_banners', bannerId, 'views', id), { at: new Date().toISOString(), member: Boolean(uid) });
    await batch.commit();
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
  } catch {
    // Already counted (documents can't be overwritten) or offline.
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
  }
};

export interface ActivityStats {
  views: number;
  memberViews: number;
}

/** For organisers: how many people looked at the activity (each counted once). */
export const loadActivityStats = async (bannerId: string): Promise<ActivityStats> => {
  const views = collection(db, 'news_banners', bannerId, 'views');
  const [all, members] = await Promise.all([
    getCountFromServer(views),
    getCountFromServer(query(views, where('member', '==', true))),
  ]);
  return { views: all.data().count, memberViews: members.data().count };
};

export const loadRegistrations = async (bannerId: string): Promise<ActivityRegistration[]> => {
  const snap = await getDocs(collection(db, 'news_banners', bannerId, 'registrations'));
  return snap.docs.map((d) => ({ ...(d.data() as ActivityRegistration), userId: d.id })).sort((a, b) => a.name.localeCompare(b.name));
};
