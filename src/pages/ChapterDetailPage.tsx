import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { isProvince } from '../lib/places';
import { LandmarkImage } from '../components/LandmarkImage';
import { CouncilTeamChart } from '../components/OrgStructureChart';
import { useAssignments } from '../lib/orgStructure';
import { useNewsBanners } from '../lib/newsBanner';
import { activityPath, responseOf } from '../lib/activities';
import { ActivityRegistration } from '../types';
import { Button, Container, TextLink } from '../components/ui';
import { MembersByTier } from '../components/OrgStructureChart';
import { PersonCard } from '../components/PersonCard';
import { useTiers } from '../lib/useTiers';

interface ChapterDetailPageProps {
  slug: string;
  onNavigate: (tab: string, param?: string) => void;
}

export const ChapterDetailPage: React.FC<ChapterDetailPageProps> = ({ slug, onNavigate }) => {
  const { chapters, publicProfiles } = useData();
  const chapter = chapters.find((c) => (c.slug || '').toLowerCase() === slug.toLowerCase() || c.id === slug);
  const assignments = useAssignments();
  const tierView = useTiers();
  const { banners } = useNewsBanners(false);
  const activities = banners.filter((b) => b.mode === 'announcement').sort((a, b) => (b.eventAt || b.createdAt).localeCompare(a.eventAt || a.createdAt)).slice(0, 12);
  const activityKey = activities.map((b) => b.id).join(',');
  // How this council's members responded to recent activities (answers are public).
  const [participation, setParticipation] = useState<{ id: string; title: string; when?: string; attending: number; notAttending: number; attended: number }[] | null>(null);
  useEffect(() => {
    if (!chapter) return;
    let cancelled = false;
    Promise.all(activities.map(async (b) => {
      const snap = await getDocs(collection(db, 'news_banners', b.id, 'registrations')).catch(() => null);
      const rows = (snap?.docs.map((d) => d.data() as ActivityRegistration) || []).filter((r) => r.chapterId === chapter.id);
      return {
        id: b.id, title: b.message, when: b.eventAt,
        attending: rows.filter((r) => responseOf(r) === 'attending').length,
        notAttending: rows.filter((r) => responseOf(r) === 'not_attending').length,
        attended: rows.filter((r) => r.attended).length,
      };
    })).then((list) => { if (!cancelled) setParticipation(list.filter((x) => x.attending + x.notAttending > 0 || banners.find((b) => b.id === x.id)?.councilId === chapter.id)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id, activityKey]);

  if (!chapter) {
    return (
      <Container narrow className="py-24">
        <h1 className="text-[2.25rem] font-semibold">We couldn’t find that place</h1>
        <p className="mt-4 text-ink-soft">It may have been renamed or merged with another province or country.</p>
        <Button className="mt-8" onClick={() => onNavigate('directory')}>See all places</Button>
      </Container>
    );
  }

  const people = publicProfiles.filter((p) => p.chapterId === chapter.id);
  const coordinator = chapter.coordinatorName || chapter.leadCoordinator;

  return (
    <>
      <header className="border-b border-line bg-stone">
        <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <TextLink onClick={() => onNavigate('directory')} className="text-[0.9375rem]">All provinces and countries</TextLink>
            <h1 className="mt-6 text-[2.75rem] leading-[1.05] font-semibold sm:text-[3.75rem]">{chapter.name}</h1>
            <p className="mt-1 text-[1.0625rem] text-muted">{isProvince(chapter.id) ? 'Province of Kurdistan' : 'Members abroad'}</p>
            <p className="mt-6 max-w-[52ch] text-[1.1875rem] leading-relaxed text-ink-soft">{chapter.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => onNavigate('apply', chapter.id)}>Join in {chapter.name}</Button>
              <Button size="lg" variant="secondary" onClick={() => onNavigate('contact')}>Contact us</Button>
            </div>
          </div>
          <LandmarkImage council={chapter} className="aspect-[4/3] w-full rounded-2xl" credit loading="eager" />
        </Container>
      </header>

      {(coordinator || chapter.meetingCadence) && (
        <Container className="py-12">
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {coordinator && (
              <div className="border-t border-line pt-5">
                <dt className="text-[0.9375rem] text-muted">Coordinator</dt>
                <dd className="mt-1 font-serif text-[1.375rem]">{coordinator}</dd>
              </div>
            )}
            {chapter.meetingCadence && (
              <div className="border-t border-line pt-5">
                <dt className="text-[0.9375rem] text-muted">Meetings</dt>
                <dd className="mt-1 font-serif text-[1.375rem]">{chapter.meetingCadence}</dd>
              </div>
            )}
          </dl>
        </Container>
      )}

      <section className="border-t border-line bg-stone">
        <Container className="py-14">
          <h2 className="text-[1.75rem] font-semibold">Leaders and teams</h2>
          <p className="mt-2 text-ink-soft">The leader and teams in {chapter.name}. <a href="/structure" className="font-semibold text-navy underline">See the whole organisation</a>.</p>
          <div className="mt-8">
            {assignments === null ? <p className="text-muted">Loading…</p> : (
              <CouncilTeamChart council={chapter} assignments={assignments} profiles={publicProfiles.filter((p) => p.membershipStatus !== 'suspended')} activities={banners} />
            )}
          </div>
        </Container>
      </section>

      <section className="border-t border-line">
        <Container className="py-14">
          <h2 className="text-[1.75rem] font-semibold">Activity participation</h2>
          <p className="mt-2 text-ink-soft">How members in {chapter.name} answered for recent activities.</p>
          {participation === null ? <p className="mt-6 text-muted">Loading…</p> : participation.length === 0 ? (
            <p className="mt-6 text-ink-soft">No answers from members here yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[560px] text-start text-[0.9375rem]">
                <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
                  <tr><th className="px-4 py-2 font-semibold">Activity</th><th className="px-4 py-2 text-end font-semibold">Attending</th><th className="px-4 py-2 text-end font-semibold">Cannot attend</th><th className="px-4 py-2 text-end font-semibold">Attended (confirmed)</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {participation.map((x) => (
                    <tr key={x.id}>
                      <td className="px-4 py-2"><a href={activityPath(x.id)} className="font-semibold text-ink hover:underline">{x.title}</a></td>
                      <td className="px-4 py-2 text-end tabular-nums">{x.attending}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{x.notAttending}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{x.attended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </section>

      {people.length > 0 && (
        <section className="border-t border-line">
          <Container className="py-14">
            <h2 className="text-[1.75rem] font-semibold">Members in {chapter.name} ({people.length})</h2>
            <p className="mt-2 text-ink-soft">Every approved member in {chapter.name}.</p>
            {tierView.canSee ? (
              <div className="mt-8"><MembersByTier profiles={people} councilName={() => chapter.name} tierOf={tierView.tierOf} /></div>
            ) : (
              <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
                {people.map((p) => <PersonCard key={p.id} profile={p} />)}
              </div>
            )}
          </Container>
        </section>
      )}
    </>
  );
};
