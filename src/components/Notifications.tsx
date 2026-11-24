import React, { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { FeedItem, useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { SiteNotification } from '../types';
import { formatDate } from './ui';
import { navigateTo, toPath } from '../lib/router';

const LEVEL_STYLES: Record<SiteNotification['level'], { banner: string; dot: string; label: string }> = {
  info: { banner: 'bg-navy-tint text-ink border-navy/25', dot: 'bg-navy', label: 'Notice' },
  important: { banner: 'bg-amber-tint text-ink border-amber/50', dot: 'bg-amber', label: 'Important' },
  urgent: { banner: 'bg-crimson text-white border-crimson', dot: 'bg-crimson', label: 'Urgent' },
};

const NotificationLink: React.FC<{ n: SiteNotification; className?: string; onClick?: () => void }> = ({ n, className, onClick }) => {
  if (!n.linkUrl) return null;
  const external = /^https?:\/\//.test(n.linkUrl);
  const href = external ? n.linkUrl : toPath(n.linkUrl);
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`font-semibold underline underline-offset-4 ${className || ''}`}
    >
      {n.linkLabel || 'Read more'}
    </a>
  );
};

const TYPE_LABEL: Record<FeedItem['type'], string> = {
  application: 'Membership application',
  article: 'Your article',
  membership: 'Membership',
  card: 'Membership card',
  event: 'Event',
  announcement: 'Announcement',
  system: 'Notice',
};

export const feedLabel = (n: FeedItem) => (n.kind === 'announcement' ? LEVEL_STYLES[n.level].label : TYPE_LABEL[n.type]);
export const feedDot = (n: FeedItem) => (n.kind === 'announcement' ? LEVEL_STYLES[n.level].dot : 'bg-navy');

export const feedHref = (link?: string) => {
  if (!link) return '';
  return toPath(link);
};

/** Bell in the header, for signed-in people only: unread count and the latest notifications. */
export const NotificationBell: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { feed, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!currentUser) return null;

  const openItem = (n: FeedItem) => {
    markRead([n.id]);
    setOpen(false);
    const href = feedHref(n.link);
    if (!href) { onNavigate('notifications'); return; }
    if (href.startsWith('/')) navigateTo(href);
    else window.open(href, '_blank', 'noopener,noreferrer');
  };

  const count = unreadCount;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        className="relative inline-flex cursor-pointer items-center rounded-full p-2 text-ink-soft transition-colors hover:bg-stone hover:text-ink"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute top-0.5 end-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-crimson px-1 text-[0.6875rem] leading-none font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="font-serif text-[1.125rem] font-semibold">Notifications</p>
            {count > 0 && (
              <button type="button" onClick={markAllRead} className="cursor-pointer text-[0.875rem] font-semibold text-navy hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {feed.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.9375rem] text-muted">Nothing yet. We’ll let you know when something happens, such as a decision on your application or article.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {feed.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={`block w-full cursor-pointer px-4 py-3.5 text-start hover:bg-stone ${n.read ? '' : 'bg-navy-tint/50'}`}>
                    <span className="flex items-center gap-2 text-[0.8125rem] text-muted">
                      <span className={`h-2 w-2 rounded-full ${n.read ? 'bg-line' : feedDot(n)}`} aria-hidden="true" />
                      {feedLabel(n)}
                      {formatDate(n.createdAt) && <span>· {formatDate(n.createdAt)}</span>}
                      {!n.read && <span className="sr-only">(unread)</span>}
                    </span>
                    <span className={`mt-1 block text-ink ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</span>
                    {n.body && <span className="mt-1 line-clamp-2 block text-[0.9375rem] text-ink-soft">{n.body}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => { setOpen(false); onNavigate('notifications'); }} className="block w-full cursor-pointer border-t border-line px-4 py-3 text-center text-[0.9375rem] font-semibold text-navy hover:bg-stone">
            See all notifications
          </button>
        </div>
      )}
    </div>
  );
};

/** Banner that drops down under the header when a new notification goes live. */
export const NotificationPopup: React.FC = () => {
  const { live, unreadIds, markRead } = useNotifications();
  const current = live.find((n) => unreadIds.includes(n.id));
  if (!current) return null;
  const style = LEVEL_STYLES[current.level];
  const urgent = current.level === 'urgent';

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={`notification-drop sticky top-[68px] z-40 border-b ${style.banner}`}
    >
      <div className="mx-auto flex max-w-[1200px] items-start gap-4 px-5 py-3.5 sm:items-center sm:px-8">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[0.9688rem] leading-snug">
          <span className="font-semibold">{current.title}</span>
          {current.body && <span className={urgent ? 'text-white/90' : 'text-ink-soft'}> {current.body}</span>}
          {current.linkUrl && (
            <>
              {' '}
              <NotificationLink n={current} onClick={() => markRead([current.id])} />
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => markRead([current.id])}
          className={`shrink-0 cursor-pointer rounded-full p-1.5 ${urgent ? 'hover:bg-white/15' : 'hover:bg-ink/5'}`}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
