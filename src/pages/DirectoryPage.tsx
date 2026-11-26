import React, { useMemo, useState } from 'react';
import { TIERS, isTier } from '../lib/tiers';
import { useTiers } from '../lib/useTiers';
import { Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Button, Container, EmptyState, PageHeader, SectionHeading } from '../components/ui';
import { PersonCard } from '../components/PersonCard';
import { TopMembers } from '../components/TopMembers';
import { LandmarkImage } from '../components/LandmarkImage';
import { landmarkName } from '../lib/landmarks';
import { groupLabel, isProvince } from '../lib/places';
import { MemberHierarchyLevel, PublicProfile } from '../types';

interface DirectoryPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

const GROUPS: { level: MemberHierarchyLevel; title: string }[] = [
  { level: 'board_executive', title: 'Board and trustees' },
  { level: 'chapter_coordinator', title: 'Council coordinators' },
  { level: 'advisory_fellow', title: 'Advisers and researchers' },
  { level: 'general_member', title: 'Members' },
  { level: 'honorary_member', title: 'Honorary members' },
];

const resolveLevel = (profile: PublicProfile): MemberHierarchyLevel => {
  if (profile.hierarchyLevel) return profile.hierarchyLevel;
  const title = (profile.boardTitle || '').toLowerCase();
  if (profile.isBoardMember || (title && !title.includes('coordinator'))) return 'board_executive';
  if (title.includes('coordinator')) return 'chapter_coordinator';
  return 'general_member';
};

export const DirectoryPage: React.FC<DirectoryPageProps> = ({ onNavigate }) => {
  const { chapters, publicProfiles } = useData();
  const [chapterFilter, setChapterFilter] = useState('all');
  const [search, setSearch] = useState('');
  const activeChapters = chapters.filter((c) => !c.isArchived);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return publicProfiles.filter((p) => {
      if (chapterFilter !== 'all' && p.chapterId !== chapterFilter) return false;
      if (!q) return true;
      return [p.displayName, p.boardTitle, p.expertise, p.bio].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [publicProfiles, chapterFilter, search]);

  // Pêşeng members and staff see members in three groups: Pêşeng, Piştîwan and Komar.
  const tierView = useTiers();
  const bySeniority = (a: PublicProfile, b: PublicProfile) => (a.displayRankOrder ?? 99) - (b.displayRankOrder ?? 99) || a.displayName.localeCompare(b.displayName);
  const grouped = tierView.canSee ? [
    ...TIERS.map((t) => ({ level: t.id, title: t.name, ku: t.ku, colour: t.colour, description: t.description, people: filtered.filter((p) => tierView.tierOf(p.id) === t.id).sort(bySeniority) })),
    { level: 'unset', title: 'Kind of membership not yet set', ku: '', colour: '', description: '', people: filtered.filter((p) => !isTier(tierView.tierOf(p.id))).sort(bySeniority) },
  ].filter((g) => g.people.length > 0)
    // Visitors, Piştîwan and Komar see every member in one list: kinds of membership are private.
    : [{ level: 'all', title: 'Members', ku: '', colour: '', description: '', people: [...filtered].sort(bySeniority) }].filter((g) => g.people.length > 0);

  return (
    <>
      <PageHeader
        title="Members and people"
        intro="Our members are organised by place: the five provinces of Kurdistan, and Britain, Australia, Canada, Germany and the USA. See how many members each place has, and meet them."
      />

      <section>
        <Container className="pt-12 pb-16 sm:pt-16 sm:pb-20">
          <SectionHeading title="Members in Kurdistan" intro="The five provinces of Kurdistan." />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeChapters.filter((c) => isProvince(c.id)).map((chapter) => (
              <li key={chapter.id}>
                <a href={`/councils/${encodeURIComponent(chapter.slug || chapter.id)}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface no-underline transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(31,38,34,0.6)]">
                  <LandmarkImage council={chapter} className="aspect-[16/9] w-full" />
                  <span className="flex flex-1 flex-col p-6">
                    <span className="font-serif text-[1.5rem] font-semibold text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{chapter.name}</span>
                    <span className="text-[0.9063rem] text-muted">{(() => { const n = publicProfiles.filter((p) => p.chapterId === chapter.id).length; return `${n} ${n === 1 ? "member" : "members"}`; })()} · {landmarkName(chapter)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-14"><SectionHeading title="Members abroad" intro="Members living in Britain, Australia, Canada, Germany and the USA." /></div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeChapters.filter((c) => !isProvince(c.id)).map((chapter) => (
              <li key={chapter.id}>
                <a href={`/councils/${encodeURIComponent(chapter.slug || chapter.id)}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface no-underline transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(31,38,34,0.6)]">
                  <LandmarkImage council={chapter} className="aspect-[16/9] w-full" />
                  <span className="flex flex-1 flex-col p-6">
                    <span className="font-serif text-[1.5rem] font-semibold text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{chapter.name}</span>
                    <span className="text-[0.9063rem] text-muted">{(() => { const n = publicProfiles.filter((p) => p.chapterId === chapter.id).length; return `${n} ${n === 1 ? "member" : "members"}`; })()} · {landmarkName(chapter)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-14"><TopMembers onNavigate={onNavigate} /></div>
          <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-line bg-navy-tint p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[1.375rem] font-semibold">Our structure</h2>
              <p className="mt-1 text-ink-soft">The Board of Directors, the leaders and teams of each province and country, and the Production Team.</p>
            </div>
            <div className="shrink-0"><Button onClick={() => onNavigate('structure')}>See the organisation chart</Button></div>
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-stone">
        <Container className="py-16 sm:py-20">
          <SectionHeading
            title="Our people"
            intro="Every approved member of Mashkhally Zhyanawa."
          />

          {publicProfiles.length > 0 && (
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <label className="relative block w-full sm:w-80">
                <span className="sr-only">Search people</span>
                <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or role"
                  className="w-full rounded-lg border border-line bg-surface py-2.5 pe-3 ps-9 focus:border-navy focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-3 text-[0.9375rem] text-muted">
                Place
                <select
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-3 py-2.5 text-ink"
                >
                  <option value="all">All places</option>
                  {activeChapters.map((c) => <option key={c.id} value={c.id}>{groupLabel(c)}</option>)}
                </select>
              </label>
            </div>
          )}

          {publicProfiles.length === 0 ? (
            <EmptyState
              title="The public directory is being prepared"
              body="Members who choose to be listed will appear here. Membership is private unless a member decides otherwise."
              action={<Button variant="secondary" onClick={() => onNavigate('apply')}>Become a member</Button>}
            />
          ) : grouped.length === 0 ? (
            <p className="text-ink-soft">No one matches your search.</p>
          ) : (
            <div className="space-y-14">
              {grouped.map((g) => (
                <div key={g.level} className={g.colour ? 'rounded-3xl border-2 bg-surface p-5 sm:p-7' : ''} style={g.colour ? { borderColor: `${g.colour}55` } : undefined}>
                  <h3 className="text-[1.5rem] font-semibold">
                    {g.ku && <span className="font-kurdish me-2 text-[1.75rem]" lang="ckb" dir="rtl" translate="no" style={{ color: g.colour }}>{g.ku}</span>}
                    <span className={g.ku ? 'ku-sub text-ink-soft' : ''}>{g.title}</span>
                    <span className="ms-3 text-[1.125rem] font-normal text-muted tabular-nums">{g.people.length}</span>
                  </h3>
                  {g.description && <p className="mt-1 mb-6 max-w-[70ch] text-ink-soft">{g.description}</p>}
                  <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
                    {g.people.map((p) => <PersonCard key={p.id} profile={p} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
};
