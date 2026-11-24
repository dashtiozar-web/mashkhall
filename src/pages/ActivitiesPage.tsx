import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MediaImage } from '../components/MediaImage';
import { CalendarDays } from 'lucide-react';
import { Button, Container, PageHeader } from '../components/ui';
import { FacebookFeed } from '../components/FacebookFeed';
import { formatEventDate, useNewsBanners } from '../lib/newsBanner';
import { activityPath, canRegister } from '../lib/activities';

interface ActivitiesPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

interface ActivityPost { id: string; title: string; purpose: string; date: string; groupName?: string; imageRef: string; attendeeCount: number }

/** Recent meetings and activities, published by administrators after review. */
const RecentActivities: React.FC = () => {
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  useEffect(() => onSnapshot(
    // Sorted here, so no extra database index is needed.
    query(collection(db, 'activity_posts'), where('status', '==', 'published'), limit(60)),
    (snap) => setPosts(snap.docs.map((d) => d.data() as ActivityPost).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)),
    () => setPosts([]),
  ), []);
  if (!posts.length) return null;
  return (
    <section aria-labelledby="recent-activities" className="mb-14">
      <h2 id="recent-activities" className="text-[1.75rem] font-semibold">Recent activities</h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <MediaImage src={p.imageRef} alt={`Members who took part in ${p.title}`} className="aspect-[16/10] w-full bg-navy object-cover" />
            <div className="p-5">
              <p className="text-[0.875rem] text-navy">{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}{p.groupName ? ` · ${p.groupName}` : ''}</p>
              <h3 className="mt-1 text-[1.1875rem] font-semibold" dir="auto" data-i18n-skip="">{p.title}</h3>
              {p.purpose && <p className="mt-2 text-ink-soft" dir="auto" data-i18n-skip="">{p.purpose}</p>}
              <p className="mt-3 text-[0.875rem] text-muted">{p.attendeeCount} {p.attendeeCount === 1 ? 'member' : 'members'} took part</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Our activities: upcoming events from the banner, and every post from our Facebook Page. */
export const ActivitiesPage: React.FC<ActivitiesPageProps> = ({ onNavigate }) => {
  const { banners, clock } = useNewsBanners(false);
  const upcoming = banners
    .filter((b) => b.mode === 'announcement' && b.eventAt && b.eventAt >= clock && (!b.endAt || b.endAt > clock))
    .sort((a, b) => (a.eventAt || '').localeCompare(b.eventAt || ''));

  return (
    <>
      <PageHeader
        title="Our activities"
        intro="Demonstrations, workshops, commemorations, online meetings and community work by our members and councils. New posts appear here as soon as we share them."
      />
      <Container className="py-12 sm:py-16">
        <RecentActivities />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,500px)_1fr] lg:items-start lg:justify-center">
          <section aria-label="Latest posts">
            <FacebookFeed height={1400} />
          </section>

          <aside className="space-y-6 lg:sticky lg:top-28">
            <section aria-labelledby="coming-up" className="rounded-2xl border border-line bg-surface p-6">
              <h2 id="coming-up" className="flex items-center gap-2 text-[1.375rem] font-semibold">
                <CalendarDays className="h-5 w-5 text-navy" aria-hidden="true" /> Coming up
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-ink-soft">No upcoming activity announced right now. Keep an eye on the red banner at the top of the page.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {upcoming.map((b) => (
                    <li key={b.id} className="py-4 first:pt-0 last:pb-0">
                      <a href={activityPath(b.id)} className="font-semibold text-ink hover:underline" dir="auto">{b.message}</a>
                      <p className="text-[0.9375rem] text-navy">{formatEventDate(b.eventAt)}{b.location ? ` · ${b.location}` : ''}</p>
                      <p className="mt-1 text-[0.875rem] text-muted">{b.attendeeCount || 0} {(b.attendeeCount || 0) === 1 ? 'member' : 'members'} attending</p>
                      {canRegister(b) && (
                        <a href={activityPath(b.id)} className="mt-2 inline-block rounded-full bg-navy px-4 py-1.5 text-[0.9375rem] font-semibold text-white no-underline hover:bg-navy-deep">Will you attend?</a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-navy p-6 text-white">
              <h2 className="text-[1.375rem] font-semibold text-white">Take part</h2>
              <p className="mt-2 text-white/85">Members organise and join these activities through their local council. Everyone who shares our values is welcome.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="inverse" onClick={() => onNavigate('apply')}>Become a member</Button>
                <button type="button" onClick={() => onNavigate('directory')} className="cursor-pointer px-2 font-semibold text-white underline underline-offset-4">Find your council</button>
              </div>
            </section>
          </aside>
        </div>
      </Container>
    </>
  );
};
