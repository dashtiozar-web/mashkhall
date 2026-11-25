import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, safeSetDoc, safeUpdateDoc } from '../firebase';
import { NewsBanner } from '../types';

export const DEFAULT_BANNER_MESSAGE = 'Mashkhally Zhyanawa Organisation';

export type BannerPhase = 'live' | 'scheduled' | 'ended' | 'draft' | 'archived';

export const bannerPhase = (b: NewsBanner, now = new Date().toISOString()): BannerPhase => {
  if (b.status === 'draft') return 'draft';
  if (b.status === 'archived') return 'archived';
  if (b.startAt && b.startAt > now) return 'scheduled';
  if (b.endAt && b.endAt <= now) return 'ended';
  return 'live';
};

/**
 * What the banner shows right now: the newest live breaking news, otherwise
 * the newest live activity announcement, otherwise the default message.
 * Announcements end on their own at their end time, so the banner returns to
 * the default message without anyone having to switch it off.
 */
export const currentBanner = (banners: NewsBanner[], now = new Date().toISOString()) => currentBanners(banners, now)[0];

/**
 * Everything the banner shows right now, one after another: every live
 * breaking news item and activity announcement (newest first), each staying
 * on until it is switched off or reaches its end time. With none, the
 * everyday message.
 */
export const currentBanners = (banners: NewsBanner[], now = new Date().toISOString()): NewsBanner[] => {
  const live = banners
    .filter((b) => bannerPhase(b, now) === 'live')
    .sort((a, b) => (b.startAt || b.updatedAt || '').localeCompare(a.startAt || a.updatedAt || ''));
  const news = [...live.filter((b) => b.mode === 'breaking'), ...live.filter((b) => b.mode === 'announcement')];
  if (news.length) return news;
  return [everydayBanner(live)];
};

const everydayBanner = (live: NewsBanner[]): NewsBanner => {
  const custom = live.find((b) => b.mode === 'default');
  return {
    id: 'default',
    mode: 'default' as const,
    message: custom?.message || DEFAULT_BANNER_MESSAGE,
    linkUrl: custom?.linkUrl,
    status: 'published' as const,
    createdAt: '',
    updatedAt: '',
  } satisfies NewsBanner;
};

/** Published banners for visitors, or every banner for people who manage them. */
export const useNewsBanners = (all = false) => {
  const [banners, setBanners] = useState<NewsBanner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date().toISOString());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toISOString()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const col = collection(db, 'news_banners');
    const q = all ? col : query(col, where('status', '==', 'published'));
    try {
      return onSnapshot(
        q,
        (snap) => { setBanners(snap.docs.map((d) => ({ ...(d.data() as NewsBanner), id: d.id }))); setError(null); },
        (err) => { console.warn('News banner note:', err); setError(err.message); setBanners([]); },
      );
    } catch (e) {
      console.warn('News banner unavailable:', e);
      return undefined;
    }
  }, [all]);

  return { banners, error, clock };
};

export const saveNewsBanner = async (b: Partial<NewsBanner> & Pick<NewsBanner, 'mode' | 'message' | 'status'>) => {
  const now = new Date().toISOString();
  const id = b.id || `nb-${Date.now().toString(36)}`;
  // Keep the live number of registered members when an existing banner is edited.
  let attendeeCount = 0;
  if (b.id) {
    try {
      const cur = await getDoc(doc(db, 'news_banners', b.id));
      attendeeCount = (cur.exists() && (cur.data().attendeeCount as number)) || 0;
    } catch { attendeeCount = b.attendeeCount || 0; }
  }
  const record: NewsBanner = {
    id,
    mode: b.mode,
    message: b.message.trim().slice(0, 300),
    linkUrl: b.linkUrl?.trim() || undefined,
    eventAt: b.eventAt || undefined,
    location: b.location?.trim() || undefined,
    councilId: b.mode === 'announcement' ? b.councilId || undefined : undefined,
    details: b.details?.trim() || undefined,
    videoUrl: b.videoUrl?.trim() || undefined,
    registrationOpen: b.mode === 'announcement' ? b.registrationOpen !== false : undefined,
    attendeeCount,
    status: b.status,
    startAt: b.startAt || undefined,
    endAt: b.endAt || undefined,
    createdBy: b.createdBy || auth.currentUser?.uid,
    createdAt: b.createdAt || now,
    updatedAt: now,
  };
  await safeSetDoc(doc(db, 'news_banners', id), record);
  return record;
};

export const setNewsBannerStatus = (id: string, status: NewsBanner['status']) =>
  safeUpdateDoc(doc(db, 'news_banners', id), { status, updatedAt: new Date().toISOString() });

export const deleteNewsBanner = (id: string) => deleteDoc(doc(db, 'news_banners', id));

/** "Saturday 14 November, 2:00pm" */
export const formatEventDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${day}, ${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }).replace(' ', '')}` : day;
};
