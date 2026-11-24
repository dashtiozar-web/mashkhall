import React from 'react';
import {
  AlertCircle, ArrowRight, Bell, CalendarDays, CheckCircle2, CreditCard, FileText, Mail, Megaphone, PenLine, UserPlus, Users,
} from 'lucide-react';
import { Article, AuditLog, ContactEnquiry, DonationConfig, MemberApplication, MemberRecord } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { bannerPhase, formatEventDate, useNewsBanners } from '../lib/newsBanner';
import { verificationState } from '../lib/membership';

interface AdminOverviewProps {
  applications: MemberApplication[];
  members: MemberRecord[];
  articles: Article[];
  enquiries: ContactEnquiry[];
  auditLogs: AuditLog[];
  donationConfig: DonationConfig | null;
  loading: boolean;
  /** Switch to an administration tab. */
  onGo: (tab: string) => void;
  /** Go to another page of the website. */
  onNavigate: (tab: string, param?: string) => void;
}

interface Task {
  key: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  go: () => void;
  urgency: 'high' | 'normal' | 'low';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ago = (iso?: string) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
const ACTION_LABELS: Record<string, string> = {
  APPLICATION_STATUS_UPDATED: 'Application updated',
  ARTICLE_STATUS_UPDATED: 'Article reviewed',
  MEMBERSHIP_CARD_ISSUED: 'Card issued',
  MEMBERSHIP_CARD_RENEWED: 'Card renewed',
  MEMBERSHIP_CARD_UPDATED: 'Card updated',
  MEMBERSHIP_SUSPENDED: 'Membership suspended',
  MEMBERSHIP_REVOKED: 'Membership revoked',
  MEMBERSHIP_ACTIVE: 'Membership reactivated',
};

/** The first thing an administrator sees: what needs doing, then the numbers. */
export const AdminOverview: React.FC<AdminOverviewProps> = ({
  applications, members, articles, enquiries, auditLogs, donationConfig, loading, onGo, onNavigate,
}) => {
  const { siteSettings } = useData();
  const { userProfile } = useAuth();
  const { banners, clock } = useNewsBanners(true);

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const pendingApps = applications.filter((a) => a.status === 'submitted' || a.status === 'under_review');
  const oldestApp = [...pendingApps].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0];
  const pendingArticles = articles.filter((a) => a.status === 'submitted' || a.status === 'under_review');
  const approvedArticles = articles.filter((a) => a.status === 'approved');
  const published = articles.filter((a) => a.status === 'published');
  const newEnquiries = enquiries.filter((e) => e.status === 'new');

  const stateOf = (m: MemberRecord) => (m.expiresAt ? verificationState(m.status, m.expiresAt) : m.status === 'suspended' ? 'suspended' : m.status === 'revoked' ? 'revoked' : 'active');
  const activeMembers = members.filter((m) => stateOf(m) === 'active');
  const expired = members.filter((m) => stateOf(m) === 'expired');
  const suspended = members.filter((m) => m.status === 'suspended');
  const withoutCard = members.filter((m) => m.status === 'active' && !m.verifyUrl);
  const expiringSoon = members.filter((m) => m.status === 'active' && m.expiresAt && m.expiresAt.slice(0, 10) >= today && m.expiresAt.slice(0, 10) <= in30);

  const upcoming = banners
    .filter((b) => b.mode === 'announcement' && b.eventAt && b.eventAt >= clock && ['live', 'scheduled', 'draft'].includes(bannerPhase(b, clock)))
    .sort((a, b) => (a.eventAt || '').localeCompare(b.eventAt || ''));
  const draftBanners = banners.filter((b) => bannerPhase(b, clock) === 'draft');

  const tasks: Task[] = [];
  if (pendingApps.length) tasks.push({
    key: 'apps', urgency: 'high', icon: <Users className="h-5 w-5" />, action: 'Review applications', go: () => onGo('applications'),
    title: `${plural(pendingApps.length, 'membership application')} waiting for a decision`,
    detail: oldestApp ? `Oldest submitted ${ago(oldestApp.createdAt)} by ${oldestApp.fullName}.` : '',
  });
  if (pendingArticles.length) tasks.push({
    key: 'articles', urgency: 'high', icon: <FileText className="h-5 w-5" />, action: 'Review articles', go: () => onGo('submissions'),
    title: `${plural(pendingArticles.length, 'article')} waiting for review`,
    detail: pendingArticles.slice(0, 2).map((a) => `“${a.title}”`).join(', ') + (pendingArticles.length > 2 ? '…' : ''),
  });
  if (approvedArticles.length) tasks.push({
    key: 'approved', urgency: 'normal', icon: <CheckCircle2 className="h-5 w-5" />, action: 'Publish', go: () => onGo('submissions'),
    title: `${plural(approvedArticles.length, 'approved article')} not yet published`,
    detail: 'Approved by a reviewer and ready to go live.',
  });
  if (withoutCard.length) tasks.push({
    key: 'nocard', urgency: 'high', icon: <CreditCard className="h-5 w-5" />, action: 'Issue cards', go: () => onGo('cards'),
    title: `${plural(withoutCard.length, 'member')} without a membership card`,
    detail: withoutCard.slice(0, 3).map((m) => m.fullName).join(', ') + (withoutCard.length > 3 ? '…' : ''),
  });
  if (expiringSoon.length) tasks.push({
    key: 'expiring', urgency: 'normal', icon: <CreditCard className="h-5 w-5" />, action: 'Renew cards', go: () => onGo('cards'),
    title: `${plural(expiringSoon.length, 'card')} expiring in the next 30 days`,
    detail: 'Members are reminded automatically; renew to keep their cards valid.',
  });
  if (newEnquiries.length) tasks.push({
    key: 'enquiries', urgency: 'normal', icon: <Mail className="h-5 w-5" />, action: 'Reply', go: () => onGo('enquiries'),
    title: `${plural(newEnquiries.length, 'new message')} from the contact form`,
    detail: newEnquiries[0] ? `Latest: “${newEnquiries[0].subject}” from ${newEnquiries[0].name}, ${ago(newEnquiries[0].createdAt)}.` : '',
  });
  if (draftBanners.length) tasks.push({
    key: 'drafts', urgency: 'low', icon: <Megaphone className="h-5 w-5" />, action: 'Open', go: () => onGo('banners'),
    title: `${plural(draftBanners.length, 'banner draft')} not published`,
    detail: draftBanners[0].message,
  });
  if (!siteSettings.siteUrl) tasks.push({
    key: 'siteurl', urgency: 'low', icon: <AlertCircle className="h-5 w-5" />, action: 'Set address', go: () => onGo('cards'),
    title: 'Confirm the website address used in QR codes',
    detail: 'Do this before issuing cards so every QR code opens the right website.',
  });
  if (!donationConfig?.isPublished) tasks.push({
    key: 'donate', urgency: 'low', icon: <AlertCircle className="h-5 w-5" />, action: 'Set up', go: () => onGo('donations'),
    title: 'Donation details are not published',
    detail: 'The Donate page cannot show bank details until they are published.',
  });

  const order = { high: 0, normal: 1, low: 2 };
  tasks.sort((a, b) => order[a.urgency] - order[b.urgency]);

  const quick = [
    { label: 'Announce an activity', hint: 'Workshop, meeting or event on the banner', icon: <CalendarDays className="h-5 w-5" />, go: () => onGo('banners') },
    { label: 'Write an article', hint: 'News, report or statement', icon: <PenLine className="h-5 w-5" />, go: () => onNavigate('member-dashboard', 'submissions') },
    { label: 'Send a notification', hint: 'To everyone signed in, or members', icon: <Bell className="h-5 w-5" />, go: () => onNavigate('notifications') },
    { label: 'Issue a card', hint: 'Membership IDs and QR codes', icon: <CreditCard className="h-5 w-5" />, go: () => onGo('cards') },
    { label: 'Add a member', hint: 'One person, or import a list', icon: <UserPlus className="h-5 w-5" />, go: () => onGo('members') },
  ];

  const stats = [
    { label: 'Active members', value: activeMembers.length, sub: `${expired.length} expired · ${suspended.length} suspended`, go: () => onGo('cards') },
    { label: 'Applications waiting', value: pendingApps.length, sub: `${applications.filter((a) => a.status === 'approved').length} approved in total`, go: () => onGo('applications') },
    { label: 'Articles published', value: published.length, sub: `${pendingArticles.length} waiting for review`, go: () => onGo('metrics') },
    { label: 'Article views', value: published.reduce((n, a) => n + (a.viewsCount || 0), 0), sub: `${published.reduce((n, a) => n + (a.likesCount || 0), 0)} likes`, go: () => onGo('metrics') },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (userProfile?.displayName || '').split(' ')[0];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-[1.75rem] font-semibold">{greeting}{firstName ? `, ${firstName}` : ''}</h2>
        <p className="mt-1 text-ink-soft">
          {loading ? 'Checking what needs your attention…'
            : tasks.filter((t) => t.urgency !== 'low').length === 0 ? 'Nothing is waiting for you. Everything is up to date.'
            : `${plural(tasks.filter((t) => t.urgency !== 'low').length, 'thing')} need${tasks.filter((t) => t.urgency !== 'low').length === 1 ? 's' : ''} your attention.`}
        </p>
      </div>

      <section aria-labelledby="tasks-heading">
        <h3 id="tasks-heading" className="text-[1.125rem] font-semibold">Tasks requiring attention</h3>
        {!loading && tasks.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface p-5 text-ink-soft">
            <CheckCircle2 className="h-5 w-5 text-navy" aria-hidden="true" /> All clear.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {tasks.map((t) => (
              <li key={t.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.urgency === 'high' ? 'bg-crimson/10 text-crimson' : t.urgency === 'normal' ? 'bg-amber-tint text-[#8A5D0E]' : 'bg-stone text-ink-soft'}`} aria-hidden="true">
                  {t.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.title}</p>
                  {t.detail && <p className="truncate text-[0.9375rem] text-muted">{t.detail}</p>}
                </div>
                <button type="button" onClick={t.go} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-lg bg-navy px-4 py-2 text-[0.9375rem] font-semibold text-white hover:bg-navy-deep sm:self-auto">
                  {t.action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="quick-heading">
        <h3 id="quick-heading" className="text-[1.125rem] font-semibold">Quick actions</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={q.go} className="group cursor-pointer rounded-2xl border border-line bg-surface p-4 text-start transition-colors hover:border-navy">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-tint text-navy" aria-hidden="true">{q.icon}</span>
              <span className="mt-3 block font-semibold group-hover:text-navy">{q.label}</span>
              <span className="block text-[0.875rem] text-muted">{q.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="upcoming-heading">
          <div className="flex items-baseline justify-between">
            <h3 id="upcoming-heading" className="text-[1.125rem] font-semibold">Upcoming activities</h3>
            <button type="button" onClick={() => onGo('banners')} className="cursor-pointer text-[0.9375rem] font-semibold text-navy hover:underline">Announce one</button>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-ink-soft">
              No activity announced. Planning a workshop, meeting or event? Announce it on the Breaking News banner so members know it’s coming.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-semibold">{b.message}</p>
                    <p className="text-[0.9375rem] text-muted">{formatEventDate(b.eventAt)} · {bannerPhase(b, clock) === 'live' ? 'on the banner now' : bannerPhase(b, clock) === 'draft' ? 'draft, not published' : 'scheduled'}</p>
                    <p className="text-[0.9375rem] font-semibold text-navy">{b.attendeeCount || 0} {(b.attendeeCount || 0) === 1 ? 'member' : 'members'} registered to attend</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <h3 id="recent-heading" className="text-[1.125rem] font-semibold">Recent activity</h3>
          {auditLogs.length === 0 ? (
            <p className="mt-3 text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {auditLogs.slice(0, 6).map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <p className="text-[0.9375rem] font-semibold">{ACTION_LABELS[l.action] || l.action.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p>
                  <p className="truncate text-[0.875rem] text-muted">{l.details}</p>
                  <p className="text-[0.8125rem] text-muted">{l.actorEmail} · {ago(l.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => onGo('audit')} className="mt-2 cursor-pointer text-[0.9375rem] font-semibold text-navy hover:underline">Full audit log</button>
        </section>
      </div>

      <section aria-labelledby="numbers-heading">
        <h3 id="numbers-heading" className="text-[1.125rem] font-semibold">At a glance</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <button key={s.label} type="button" onClick={s.go} className="cursor-pointer rounded-2xl border border-line bg-surface p-5 text-start hover:border-navy">
              <span className="block text-[0.9375rem] text-ink-soft">{s.label}</span>
              <span className="mt-1 block font-serif text-[2rem] leading-none font-semibold tabular-nums">{loading ? '…' : s.value.toLocaleString('en-GB')}</span>
              <span className="mt-2 block text-[0.875rem] text-muted">{s.sub}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
