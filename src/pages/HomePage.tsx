import React, { useMemo } from 'react';
import { HandHeart, Landmark, Scale, BookOpen, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Button, Container, EmptyState, SectionHeading, TextLink, categoryLabel, formatDate } from '../components/ui';
import { Article } from '../types';
import { CouncilRanking, UKCouncilMap } from '../components/UKCouncilMap';
import { MemberCount } from '../components/MemberCount';
import { BleedingEdge } from '../components/BleedingEdge';
import { VisitorAnalytics } from '../components/VisitorAnalytics';
import { LandmarkCover } from '../components/LandmarkCover';
import { FacebookFeed } from '../components/FacebookFeed';
import { MediaImage } from '../components/MediaImage';

interface HomePageProps {
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

/** The identity's bold element: a calendar leaf for the date the
 *  organisation is named after, bleeding in memory of the martyrs of the
 *  17 February 2011 demonstrations. */
const DateLeaf: React.FC = () => (
  <figure className="mx-auto w-full max-w-[340px] lg:mx-0 lg:ms-auto">
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_28px_60px_-34px_rgba(31,38,34,0.55)]">
      <div className="relative z-0 flex items-baseline justify-between bg-crimson px-6 py-3 text-white">
        <span className="font-serif text-[1.375rem] font-semibold">Shubat</span>
        <span className="font-kurdish text-[1.125rem] text-white/90" lang="ckb" dir="rtl">شوبات</span>
        <BleedingEdge className="absolute top-full start-0 w-full" />
      </div>
      <p className="date-leaf relative z-10 pt-5 pb-1 text-center text-[8.5rem] leading-[0.95] font-semibold tracking-[-0.04em] text-ink sm:text-[10rem]">
        17
      </p>
      <p className="relative z-10 pb-5 text-center text-[1rem] font-medium text-muted">February 2011</p>
    </div>
    <figcaption className="mt-5 text-[0.9688rem] leading-relaxed text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
      On 17 February 2011, peaceful protests for freedom of expression and an end to corruption began in
      Sulaymaniyah. Protesters lost their lives for those demands. Our organisation carries their name, and we
      remember the martyrs of 17 Shubat.
    </figcaption>
  </figure>
);

const ArticleMeta: React.FC<{ article: Article }> = ({ article }) => (
  <p className="text-[0.875rem] text-muted">
    <span className="font-semibold text-navy">{article.isOfficialNews ? 'Statement' : categoryLabel(article.category)}</span>
    {formatDate(article.publishedAt || article.createdAt) && (
      <>
        {', '}
        <time dateTime={article.publishedAt || article.createdAt}>{formatDate(article.publishedAt || article.createdAt)}</time>
      </>
    )}
    <span className="tabular-nums">{'  ·  '}{(article.viewsCount || 0).toLocaleString('en-GB')} {article.viewsCount === 1 ? 'view' : 'views'}</span>
  </p>
);

const AREA_ICONS = [Scale, Landmark, Users, BookOpen];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { siteSettings, chapters, articles } = useData();

  const published = useMemo(
    () =>
      articles
        .filter((a) => a.status === 'published')
        .sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '')),
    [articles],
  );
  const [lead, ...more] = published;
  const councils = chapters.filter((c) => !c.isArchived);
  const areas = siteSettings.areasOfWork || [];

  return (
    <>
      {/* Hero: rotating council landmarks behind the welcome */}
      <section className="relative isolate overflow-hidden">
        <LandmarkCover councils={councils} />
        <Container className="relative z-10 grid items-center gap-14 pt-12 pb-20 sm:pt-16 sm:pb-24 lg:grid-cols-[1.3fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="text-white">
            <p className="flex flex-wrap items-baseline gap-x-3 text-[1.0625rem] text-[#F0C779]">
              <span className="font-kurdish text-[1.5rem] leading-none" lang="ckb" dir="rtl">بەخێربێن</span>
              <span className="font-medium">Welcome</span>
            </p>
            <h1 className="mt-5 max-w-[21ch] text-[2.5rem] leading-[1.1] font-semibold text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.35)] sm:text-[3.25rem]">
              Standing up for human rights, together and peacefully.
            </h1>
            <p className="mt-6 max-w-[52ch] text-[1.1875rem] leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
              17 Shubat is an independent organisation founded by the Kurdish community in the United Kingdom. We
              document abuses, support people who need help and work for accountability through non-violent means.
              Everyone who shares these values is welcome.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => onNavigate('apply')}>Become a member</Button>
              <Button size="lg" variant="inverse" onClick={() => onNavigate('about')}>Get to know us</Button>
            </div>
          </div>
          <DateLeaf />
        </Container>
        <div className="rule-fire relative z-10" aria-hidden="true" />
      </section>

      {/* Mission */}
      <section className="border-b border-line bg-surface">
        <Container className="grid gap-6 py-10 sm:py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <h2 className="flex items-center gap-3 font-sans text-[0.875rem] font-semibold tracking-[0.08em] text-crimson uppercase">
            <span className="h-[3px] w-8 bg-crimson" aria-hidden="true" /> Our mission
          </h2>
          <div className="border-s-4 border-navy ps-5 sm:ps-7">
            <p className="font-serif text-[1.5rem] leading-snug text-ink sm:text-[1.875rem]">
              {siteSettings.mission}
            </p>
            <TextLink className="mt-5" onClick={() => onNavigate('about')}>
              How we work and what we stand for
            </TextLink>
          </div>
        </Container>
      </section>

      {/* Remembrance and press freedom: the 2011 memorial and Sherwan Sherwani */}
      <section className="border-b border-white/10 bg-[#090F1C] text-white">
        <Container className="grid gap-5 py-10 md:grid-cols-2">
          <a href="/memorial" className="group block rounded-xl border border-white/12 bg-white/[0.04] p-6 no-underline hover:border-white/30">
            <p className="text-[0.8125rem] font-semibold tracking-[0.1em] text-[#F0C779] uppercase">17 Shubat 2011 Memorial</p>
            <p className="mt-2 font-serif text-[1.5rem] leading-snug font-semibold text-white">The Days of the Bloody Streets</p>
            <p className="mt-2 text-white/75">The demonstrations that began in Sulaimani on 17 February 2011, the days that followed, and the martyrs we remember.</p>
            <span className="mt-4 inline-block h-[2px] w-12 bg-[#A3172C]" aria-hidden="true" />
            <p className="mt-3 font-semibold text-white group-hover:underline">Visit the memorial</p>
          </a>
          <a href="/sherwan-sherwani" className="group flex gap-5 rounded-xl border border-white/12 bg-white/[0.04] p-6 no-underline hover:border-white/30">
            <img src="/images/sherwan-sherwani.jpg" alt="" width={96} height={120} loading="lazy" className="h-[120px] w-24 shrink-0 rounded-md object-cover object-top" />
            <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold tracking-[0.1em] text-[#F0C779] uppercase">Press freedom</p>
            <p className="mt-2 font-serif text-[1.5rem] leading-snug font-semibold text-white">Sherwan Sherwani</p>
            <p className="mt-2 text-white/75">Journalist and former member of 17 Shubat, reportedly imprisoned in Erbil since October 2020. His case, the record of his arrests, and the sources.</p>
            <span className="mt-4 inline-block h-[2px] w-12 bg-[#A3172C]" aria-hidden="true" />
            <p className="mt-3 font-semibold text-white group-hover:underline">Read about his case</p>
            </div>
          </a>
        </Container>
      </section>

      {/* Our Membership: live count of approved members */}
      <section>
        <Container className="pt-12 sm:pt-16">
          <MemberCount onNavigate={onNavigate} />
        </Container>
      </section>

      {/* What we do */}
      {areas.length > 0 && (
        <section>
          <Container className="py-12 sm:py-16">
            <SectionHeading title="What we do" intro="Four strands of work, carried out by volunteers in our councils across the UK." />
            <div className="grid gap-5 md:grid-cols-2">
              {areas.map((area, i) => {
                const Icon = AREA_ICONS[i % AREA_ICONS.length];
                return (
                  <div key={area.id} className="flex gap-5 rounded-2xl border border-line bg-surface p-6 sm:p-7">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-tint text-navy">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-[1.3125rem] leading-snug font-semibold">{area.title}</h3>
                      <p className="mt-2 text-[1.0313rem] text-ink-soft">{area.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>
      )}

      {/* Activities from our Facebook Page */}
      <section className="border-y border-line bg-stone">
        <Container className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,500px)] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-[0.9375rem] font-semibold text-navy">Our activities</p>
              <h2 className="mt-2 text-[2rem] leading-tight font-semibold sm:text-[2.5rem]">What we’ve been doing</h2>
              <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-ink-soft">
                Demonstrations, workshops, commemorations and online meetings, shared as they happen. Every new post on our
                Facebook Page appears here automatically.
              </p>
              <Button className="mt-7" onClick={() => onNavigate('activities')}>See all activities</Button>
            </div>
            <FacebookFeed height={700} />
          </div>
        </Container>
      </section>

      {/* Latest publications */}
      <section className="border-t border-line">
        <Container className="py-12 sm:py-16">
          <SectionHeading
            title="Latest from 17 Shubat"
            intro="Statements, research and reports from our members and councils."
            action={
              published.length > 0 ? (
                <Button variant="secondary" onClick={() => onNavigate('news')}>All news and reports</Button>
              ) : undefined
            }
          />

          {lead ? (
            <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
              <article>
                <a href={`/news/${encodeURIComponent(lead.slug || lead.id)}`} className="group block no-underline">
                  {lead.coverImageUrl && (
                    <MediaImage
                      src={lead.coverImageUrl}
                      alt={lead.coverImageAlt || ''}
                      className="mb-6 aspect-[16/9] w-full rounded-2xl object-cover"
                      loading="lazy"
                    />
                  )}
                  <ArticleMeta article={lead} />
                  <h3 dir="auto" className="mt-3 text-[1.75rem] leading-tight font-semibold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-[2.125rem]">
                    {lead.title}
                  </h3>
                  {lead.excerpt && <p dir="auto" className="mt-4 max-w-[60ch] text-[1.0625rem] text-ink-soft">{lead.excerpt}</p>}
                  {lead.authorDisplayName && <p className="mt-4 text-[0.9375rem] text-muted">By {lead.authorDisplayName}</p>}
                </a>
              </article>

              {more.length > 0 && (
                <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-6">
                  {more.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <a href={`/news/${encodeURIComponent(a.slug || a.id)}`} className="group block py-5 no-underline">
                        <ArticleMeta article={a} />
                        <h3 dir="auto" className="mt-1.5 text-[1.1875rem] leading-snug font-semibold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                          {a.title}
                        </h3>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <EmptyState
              title="Our first reports are on their way"
              body="Statements and research from our members will be published here after editorial review. Members can submit articles from their account."
              action={<Button variant="secondary" onClick={() => onNavigate('member-dashboard')}>Submit an article</Button>}
            />
          )}
        </Container>
      </section>

      {/* Councils: map and membership league */}
      <section className="border-y border-line bg-stone">
        <Container className="py-12 sm:py-16">
          <SectionHeading
            title="Our councils across the UK"
            intro="One national organisation, six councils. Colours show how many members each council has, from fewest (green) to most (red). Choose a council to see its details."
            action={<Button variant="secondary" onClick={() => onNavigate('directory')}>All councils</Button>}
          />
          <UKCouncilMap onOpen={(slug) => onNavigate('chapter', slug)} />
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <CouncilRanking />
            <div className="flex flex-col gap-4 rounded-3xl border border-line bg-navy-tint p-6">
              <div>
                <h2 className="text-[1.375rem] font-semibold">Our structure</h2>
                <p className="mt-1 text-ink-soft">The Board of Directors, each council’s leader and teams, and the Production Team.</p>
              </div>
              <div><Button onClick={() => onNavigate('structure')}>See the organisation chart</Button></div>
            </div>
          </div>
        </Container>
      </section>


      {/* Visitors from around the world */}
      <section>
        <Container className="pt-12 sm:pt-16">
          <VisitorAnalytics mode="public" />
        </Container>
      </section>

      {/* Get involved */}
      <section>
        <Container className="py-12 sm:py-16">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="band-texture rounded-2xl p-8 text-white sm:p-10">
              <Users className="h-8 w-8 text-amber" aria-hidden="true" />
              <h2 className="mt-5 text-[1.875rem] font-semibold text-white">Become a member</h2>
              <p className="mt-3 max-w-[44ch] text-[1.0625rem] text-white/85">
                Membership is open to anyone who shares our commitment to non-violence, human rights and freedom of
                expression. Your details stay private unless you choose otherwise.
              </p>
              <Button variant="inverse" size="lg" className="mt-8" onClick={() => onNavigate('apply')}>
                Apply to join
              </Button>
            </div>
            <div className="rounded-2xl border border-line border-t-4 border-t-ember bg-surface p-8 sm:p-10">
              <HandHeart className="h-8 w-8 text-navy" aria-hidden="true" />
              <h2 className="mt-5 text-[1.875rem] font-semibold">Support our work</h2>
              <p className="mt-3 max-w-[44ch] text-[1.0625rem] text-ink-soft">
                We are funded by our members and supporters, not by any government or political party. Your donation
                keeps our documentation and community work independent.
              </p>
              <Button size="lg" className="mt-8" onClick={() => onNavigate('donate')}>
                Make a donation
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
};
