import React, { useState } from 'react';
import { isLive, setNotificationStatus, useNotifications } from '../context/NotificationsContext';
import { Button, Container, EmptyState, PageHeader, formatDate } from '../components/ui';
import { SiteNotification } from '../types';
import { useAuth } from '../context/AuthContext';
import { feedDot, feedHref, feedLabel } from '../components/Notifications';

interface NotificationsPageProps {
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

const LEVELS: { value: SiteNotification['level']; label: string; hint: string }[] = [
  { value: 'info', label: 'Notice', hint: 'Events, news and general updates' },
  { value: 'important', label: 'Important', hint: 'Deadlines and changes people should not miss' },
  { value: 'urgent', label: 'Urgent', hint: 'Safety or time-critical messages (shown in red)' },
];

const LEVEL_BADGE: Record<SiteNotification['level'], string> = {
  info: 'bg-navy-tint text-navy',
  important: 'bg-amber-tint text-ink',
  urgent: 'bg-crimson/10 text-crimson',
};

const statusOf = (n: SiteNotification) => {
  if (n.status === 'draft') return { label: 'Draft', cls: 'bg-stone text-ink-soft' };
  if (n.status === 'archived') return { label: 'Withdrawn', cls: 'bg-stone text-muted' };
  const now = new Date().toISOString();
  if (n.startAt && n.startAt > now) return { label: `Scheduled for ${formatDate(n.startAt)}`, cls: 'bg-amber-tint text-ink' };
  if (n.endAt && n.endAt <= now) return { label: 'Ended', cls: 'bg-stone text-muted' };
  return { label: 'Live now', cls: 'bg-navy text-white' };
};

// datetime-local works in local time without seconds.
const toInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (v: string) => (v ? new Date(v).toISOString() : '');

const EMPTY: Partial<SiteNotification> = { title: '', body: '', level: 'info', audience: 'everyone', linkLabel: '', linkUrl: '', startAt: '', endAt: '' };

const Composer: React.FC<{ editing: Partial<SiteNotification> | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { save } = useNotifications();
  const [form, setForm] = useState<Partial<SiteNotification>>(editing || EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof SiteNotification, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (status: SiteNotification['status']) => {
    setError(null);
    if (!form.title?.trim()) {
      setError('Give the notification a short title.');
      return;
    }
    if (form.endAt && form.startAt && form.endAt <= form.startAt) {
      setError('The end time must be after the start time.');
      return;
    }
    setBusy(true);
    try {
      await save({ ...form, title: form.title || '', body: form.body || '', status } as SiteNotification);
      onDone();
    } catch (e) {
      console.error('Save notification error:', e);
      setError('The notification could not be saved. Check your connection and permissions, then try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1.5 block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 font-normal text-ink focus:border-navy focus:outline-none';
  const label = 'block text-[0.9688rem] font-semibold text-ink';

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <h2 className="text-[1.5rem] font-semibold">{editing?.id ? 'Edit notification' : 'New notification'}</h2>
      <div className="mt-6 space-y-5">
        <label className={label}>
          Title
          <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} maxLength={200} className={field} placeholder="For example: Commemoration event on 17 February" />
        </label>
        <label className={label}>
          Message
          <textarea value={form.body || ''} onChange={(e) => set('body', e.target.value)} maxLength={2000} rows={3} className={field} placeholder="One or two sentences. Keep it short; add a link for details." />
        </label>

        <fieldset>
          <legend className={label}>How important is it?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {LEVELS.map((l) => (
              <label key={l.value} className={`cursor-pointer rounded-xl border p-3.5 ${form.level === l.value ? 'border-navy bg-navy-tint' : 'border-line hover:border-ink/30'}`}>
                <input type="radio" name="level" value={l.value} checked={form.level === l.value} onChange={() => set('level', l.value)} className="sr-only" />
                <span className="block font-semibold">{l.label}</span>
                <span className="mt-0.5 block text-[0.875rem] text-muted">{l.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={label}>Who should see it?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['everyone', 'members'] as const).map((a) => (
              <label key={a} className={`cursor-pointer rounded-lg border px-4 py-2 text-[0.9375rem] ${form.audience === a ? 'border-navy bg-navy text-white' : 'border-line hover:border-ink/30'}`}>
                <input type="radio" name="audience" value={a} checked={form.audience === a} onChange={() => set('audience', a)} className="sr-only" />
                {a === 'everyone' ? 'Everyone signed in' : 'Members only'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={label}>
            Link text <span className="font-normal text-muted">(optional)</span>
            <input value={form.linkLabel || ''} onChange={(e) => set('linkLabel', e.target.value)} maxLength={80} className={field} placeholder="Read more" />
          </label>
          <label className={label}>
            Link <span className="font-normal text-muted">(optional)</span>
            <input value={form.linkUrl || ''} onChange={(e) => set('linkUrl', e.target.value)} maxLength={500} className={field} placeholder="https://… or a page such as news" />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={label}>
            Show from <span className="font-normal text-muted">(optional)</span>
            <input type="datetime-local" value={toInput(form.startAt)} onChange={(e) => set('startAt', fromInput(e.target.value))} className={field} />
          </label>
          <label className={label}>
            Stop showing after <span className="font-normal text-muted">(optional)</span>
            <input type="datetime-local" value={toInput(form.endAt)} onChange={(e) => set('endAt', fromInput(e.target.value))} className={field} />
          </label>
        </div>

        {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{error}</p>}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={() => submit('published')} disabled={busy}>{busy ? 'Saving…' : 'Publish now'}</Button>
          <Button variant="secondary" onClick={() => submit('draft')} disabled={busy}>Save as draft</Button>
          <Button variant="quiet" onClick={onDone} disabled={busy}>Cancel</Button>
        </div>
        <p className="text-[0.875rem] text-muted">
          Published announcements appear in the bell for signed-in people, and as a banner the first time each
          person sees them. For public news, use the Breaking News banner in Administration.
        </p>
      </div>
    </div>
  );
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate, onOpenAuth }) => {
  const { currentUser } = useAuth();
  const { feed, unreadCount, all, canManage, remove, markRead, markUnread, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const shown = filter === 'unread' ? feed.filter((n) => !n.read) : feed;
  const [editing, setEditing] = useState<Partial<SiteNotification> | null>(null);
  const [composing, setComposing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      console.error('Notification action error:', e);
      setActionError('That change could not be saved. Please try again.');
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        intro="Updates about your membership, your articles and announcements from the committee."
      >
        {canManage && !composing && (
          <Button onClick={() => { setEditing(null); setComposing(true); }}>Write a notification</Button>
        )}
      </PageHeader>

      <Container className="py-12 sm:py-16">
        {canManage && composing && (
          <div className="mb-14">
            <Composer key={editing?.id || 'new'} editing={editing} onDone={() => { setComposing(false); setEditing(null); }} />
          </div>
        )}

        <section aria-labelledby="current-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="current-heading" className="text-[1.75rem] font-semibold">Your notifications</h2>
            {currentUser && feed.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter notifications">
                {(['all', 'unread'] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.9375rem] ${filter === f ? 'border-navy bg-navy text-white' : 'border-line hover:border-ink/40'}`}>
                    {f === 'all' ? 'All' : `Unread (${unreadCount})`}
                  </button>
                ))}
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="cursor-pointer px-2 text-[0.9375rem] font-semibold text-navy hover:underline">Mark all as read</button>
                )}
              </div>
            )}
          </div>
          {!currentUser ? (
            <div className="mt-6">
              <EmptyState title="Sign in to see your notifications" body="Members get notified about their applications, articles, membership card and announcements from the committee." />
              <Button className="mt-5" onClick={onOpenAuth}>Sign in</Button>
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-6">
              <EmptyState title={filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'} body="We’ll let you know here when something happens: a decision on your application or article, your membership card, or an announcement." />
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
              {shown.map((n) => {
                const href = feedHref(n.link);
                return (
                  <li key={n.id} className={`flex gap-4 p-5 sm:p-6 ${n.read ? '' : 'bg-navy-tint/40'}`}>
                    <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-line' : feedDot(n)}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[0.875rem] text-muted">
                        <span className="font-semibold text-ink-soft">{feedLabel(n)}</span>
                        <span>{formatDate(n.createdAt)}</span>
                        {!n.read && <span className="rounded-full bg-navy px-2 py-0.5 text-[0.75rem] font-semibold text-white">New</span>}
                      </p>
                      <h3 className={`mt-1 text-[1.1875rem] ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</h3>
                      {n.body && <p className="mt-1.5 max-w-[68ch] whitespace-pre-line text-ink-soft">{n.body}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9375rem]">
                        {href && (
                          <a href={href} onClick={() => markRead([n.id])} {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="font-semibold text-navy underline underline-offset-4">
                            {n.linkLabel || 'Open'}
                          </a>
                        )}
                        <button type="button" onClick={() => (n.read ? markUnread([n.id]) : markRead([n.id]))} className="cursor-pointer text-ink-soft hover:text-ink hover:underline">
                          {n.read ? 'Mark as unread' : 'Mark as read'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canManage && (
          <section aria-labelledby="manage-heading" className="mt-16 border-t border-line pt-12">
            <h2 id="manage-heading" className="text-[1.75rem] font-semibold">Manage notifications</h2>
            <p className="mt-2 text-ink-soft">Every notification, including drafts, scheduled and withdrawn ones. Only people with permission to manage notifications see this section.</p>
            {actionError && <p role="alert" className="mt-4 rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{actionError}</p>}
            {all.length === 0 ? (
              <p className="mt-6 text-muted">Nothing written yet.</p>
            ) : (
              <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
                {all.map((n) => {
                  const st = statusOf(n);
                  return (
                    <li key={n.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${LEVEL_BADGE[n.level]}`}>{LEVELS.find((l) => l.value === n.level)?.label}</span>
                          <span className="text-muted">{n.audience === 'members' ? 'Members only' : 'Everyone'}</span>
                        </p>
                        <p className="mt-1.5 truncate font-semibold">{n.title}</p>
                        <p className="text-[0.875rem] text-muted">
                          {n.createdByName ? `By ${n.createdByName}, ` : ''}updated {formatDate(n.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => { setEditing(n); setComposing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button>
                        {isLive(n) || (n.status === 'published') ? (
                          <Button variant="secondary" onClick={() => act(() => setNotificationStatus(n.id, 'archived'))}>Withdraw</Button>
                        ) : (
                          <Button onClick={() => act(() => setNotificationStatus(n.id, 'published'))}>Publish</Button>
                        )}
                        <button
                          type="button"
                          className="cursor-pointer rounded-lg px-4 py-2.5 font-semibold text-crimson hover:bg-crimson/5"
                          onClick={() => { if (window.confirm(`Delete “${n.title}”? This cannot be undone.`)) act(() => remove(n.id)); }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {!canManage && currentUser && (
          <p className="mt-14 text-[0.9375rem] text-muted">
            Want to stay involved?{' '}
            <button type="button" onClick={() => onNavigate('apply')} className="cursor-pointer font-semibold text-navy underline underline-offset-4">Become a member</button>{' '}
            to receive members-only notices.
          </p>
        )}
      </Container>
    </>
  );
};
