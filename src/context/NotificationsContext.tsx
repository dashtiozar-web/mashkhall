import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, Query, where } from 'firebase/firestore';
import { db, safeSetDoc, safeUpdateDoc } from '../firebase';
import { useAuth } from './AuthContext';
import { MemberRecord, SiteNotification, UserNotification } from '../types';
import { notifyUser } from '../lib/notify';

/**
 * Notifications are only for signed-in people. Two kinds are merged into one
 * feed:
 *
 * - Personal notifications (`user_notifications`), written when something
 *   happens to that person: an application or article decision, a card issued
 *   or renewed, a role or status change, a card about to expire.
 * - Announcements (`notifications`) broadcast by people with the
 *   manage_notifications permission, to everyone signed in or members only.
 *
 * Read state is stored in the database, so it follows the person between
 * devices.
 */

export const isLive = (n: SiteNotification, now = new Date().toISOString()) =>
  n.status === 'published' && (!n.startAt || n.startAt <= now) && (!n.endAt || n.endAt > now);

const byNewest = (a: SiteNotification, b: SiteNotification) =>
  (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '');

export interface FeedItem {
  id: string;
  kind: 'personal' | 'announcement';
  type: UserNotification['type'];
  title: string;
  body?: string;
  link?: string;
  linkLabel?: string;
  level: SiteNotification['level'];
  createdAt: string;
  read: boolean;
}

interface NotificationsContextType {
  /** Personal notifications and live announcements, newest first. */
  feed: FeedItem[];
  unreadCount: number;
  /** Live announcements this person may see, newest first. */
  live: SiteNotification[];
  /** Every announcement, for people who manage them. */
  all: SiteNotification[];
  canManage: boolean;
  /** Unread live announcements (used for the drop-down banner). */
  unreadIds: string[];
  markRead: (ids: string[]) => void;
  markUnread: (ids: string[]) => void;
  markAllRead: () => void;
  save: (n: Partial<SiteNotification> & Pick<SiteNotification, 'title' | 'body'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile, isMember, hasPermission } = useAuth();
  const canManage = Boolean(currentUser) && hasPermission('manage_notifications');
  const uid = currentUser?.uid;

  const [visible, setVisible] = useState<SiteNotification[]>([]);
  const [all, setAll] = useState<SiteNotification[]>([]);
  const [personal, setPersonal] = useState<UserNotification[] | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [clock, setClock] = useState(() => new Date().toISOString());

  // Re-check time windows every minute so scheduled notifications appear and
  // expire without a page reload.
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toISOString()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Announcements
  useEffect(() => {
    setVisible([]);
    setAll([]);
    if (!uid) return;
    const col = collection(db, 'notifications');
    const sources = new Map<string, SiteNotification[]>();
    const publish = () => {
      const merged = new Map<string, SiteNotification>();
      sources.forEach((list) => list.forEach((n) => merged.set(n.id, n)));
      const list = Array.from(merged.values()).sort(byNewest);
      if (canManage) setAll(list);
      setVisible(list.filter((n) => n.status === 'published' && (n.audience === 'everyone' || isMember || canManage)));
    };
    const listen = (key: string, q: Query) =>
      onSnapshot(
        q,
        (snap) => {
          sources.set(key, snap.docs.map((d) => ({ ...(d.data() as SiteNotification), id: d.id })));
          publish();
        },
        (err) => console.warn(`Notifications (${key}) note:`, err),
      );

    const unsubs: (() => void)[] = [];
    try {
      if (canManage) {
        unsubs.push(listen('all', col));
      } else {
        unsubs.push(listen('everyone', query(col, where('status', '==', 'published'), where('audience', '==', 'everyone'))));
        if (isMember) {
          unsubs.push(listen('members', query(col, where('status', '==', 'published'), where('audience', '==', 'members'))));
        }
      }
    } catch (err) {
      console.warn('Notifications unavailable:', err);
    }
    return () => unsubs.forEach((u) => u());
  }, [canManage, isMember, uid]);

  // Personal notifications and read state
  useEffect(() => {
    setPersonal(null);
    setReadIds([]);
    if (!uid) return;
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'user_notifications'), where('userId', '==', uid)),
        (snap) => setPersonal(snap.docs.map((d) => ({ ...(d.data() as UserNotification), id: d.id }))),
        (err) => { console.warn('Personal notifications note:', err); setPersonal([]); },
      ));
      unsubs.push(onSnapshot(
        doc(db, 'notification_state', uid),
        (snap) => setReadIds(snap.exists() ? ((snap.data().readIds as string[]) || []) : []),
        (err) => console.warn('Notification state note:', err),
      ));
    } catch (err) {
      console.warn('Notifications unavailable:', err);
    }
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // Remind members 30 days before their card expires (once per expiry date).
  useEffect(() => {
    if (!uid || !isMember || personal === null) return;
    let cancelled = false;
    getDoc(doc(db, 'members', uid))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const m = snap.data() as MemberRecord;
        if (!m.expiresAt || m.status !== 'active') return;
        const exp = m.expiresAt.slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
        if (exp < today || exp > soon) return;
        const id = `exp-${uid}-${exp}`;
        if (personal.some((n) => n.id === id)) return;
        const [y, mo, d] = exp.split('-');
        notifyUser(uid, {
          type: 'card',
          title: 'Your membership card expires soon',
          body: `Your card is valid until ${d}/${mo}/${y}. Please contact your council or the committee to renew it.`,
          link: '/account',
        }, id);
      })
      .catch(() => { /* no member record */ });
    return () => { cancelled = true; };
  }, [uid, isMember, personal]);

  const live = useMemo(() => visible.filter((n) => isLive(n, clock)), [visible, clock]);
  const unreadIds = useMemo(() => live.filter((n) => !readIds.includes(n.id)).map((n) => n.id), [live, readIds]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...(personal || []).map((n) => ({
        id: n.id, kind: 'personal' as const, type: n.type, title: n.title, body: n.body, link: n.link,
        level: 'info' as const, createdAt: n.createdAt, read: n.read,
      })),
      ...live.map((n) => ({
        id: n.id, kind: 'announcement' as const, type: 'announcement' as const, title: n.title, body: n.body,
        link: n.linkUrl, linkLabel: n.linkLabel, level: n.level, createdAt: n.publishedAt || n.createdAt,
        read: readIds.includes(n.id),
      })),
    ];
    return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [personal, live, readIds]);
  const unreadCount = feed.filter((n) => !n.read).length;

  const writeReadIds = useCallback((next: string[]) => {
    if (!uid) return;
    const trimmed = next.slice(-400);
    setReadIds(trimmed);
    safeSetDoc(doc(db, 'notification_state', uid), { readIds: trimmed, updatedAt: new Date().toISOString() })
      .catch((e) => console.warn('Read state not saved:', e));
  }, [uid]);

  const setRead = useCallback((ids: string[], read: boolean) => {
    if (!uid || ids.length === 0) return;
    const personalIds = new Set((personal || []).map((n) => n.id));
    ids.filter((id) => personalIds.has(id)).forEach((id) => {
      const n = personal!.find((x) => x.id === id);
      if (n && n.read !== read) {
        safeUpdateDoc(doc(db, 'user_notifications', id), { read }).catch((e) => console.warn('Read state not saved:', e));
      }
    });
    setPersonal((prev) => prev && prev.map((n) => (ids.includes(n.id) ? { ...n, read } : n)));
    const announcementIds = ids.filter((id) => !personalIds.has(id));
    if (announcementIds.length) {
      writeReadIds(read
        ? Array.from(new Set([...readIds, ...announcementIds]))
        : readIds.filter((id) => !announcementIds.includes(id)));
    }
  }, [uid, personal, readIds, writeReadIds]);

  const markRead = useCallback((ids: string[]) => setRead(ids, true), [setRead]);
  const markUnread = useCallback((ids: string[]) => setRead(ids, false), [setRead]);
  const markAllRead = useCallback(() => setRead(feed.filter((n) => !n.read).map((n) => n.id), true), [feed, setRead]);

  const save: NotificationsContextType['save'] = async (n) => {
    if (!currentUser || !canManage) throw new Error('You do not have permission to manage notifications.');
    const now = new Date().toISOString();
    const id = n.id || `ntf-${Date.now()}`;
    const existing = all.find((x) => x.id === id);
    const record: SiteNotification = {
      id,
      title: n.title.trim(),
      body: n.body.trim(),
      linkLabel: n.linkLabel?.trim() || undefined,
      linkUrl: n.linkUrl?.trim() || undefined,
      level: n.level || 'info',
      audience: n.audience || 'everyone',
      status: n.status || 'draft',
      startAt: n.startAt || undefined,
      endAt: n.endAt || undefined,
      createdBy: existing?.createdBy || currentUser.uid,
      createdByName: existing?.createdByName || userProfile?.displayName || currentUser.email || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      publishedAt:
        n.status === 'published'
          ? (existing?.status === 'published' && existing.publishedAt) || now
          : existing?.publishedAt,
    };
    // Write the whole document so cleared optional fields are removed.
    await safeSetDoc(doc(db, 'notifications', id), record);
  };

  const remove = async (id: string) => {
    if (!canManage) throw new Error('You do not have permission to manage notifications.');
    await deleteDoc(doc(db, 'notifications', id));
  };

  return (
    <NotificationsContext.Provider value={{ feed, unreadCount, live, all, canManage, unreadIds, markRead, markUnread, markAllRead, save, remove }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

// Re-exported for screens that only update status.
export const setNotificationStatus = (id: string, status: SiteNotification['status']) =>
  safeUpdateDoc(doc(db, 'notifications', id), {
    status,
    updatedAt: new Date().toISOString(),
    ...(status === 'published' ? { publishedAt: new Date().toISOString() } : {}),
  });
