import React, { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { CityChapter, NewsBanner, PublicProfile } from '../types';
import { positionById } from '../lib/positions';
import { TIERS, isTier } from '../lib/tiers';
import { Assignment, boardSeats, byId, councilSeats, productionSeats, Seat, webadminSeats } from '../lib/orgStructure';
import { SEAT_STATUS_LABEL } from '../lib/memberApi';
import { activityPath } from '../lib/activities';
import { formatEventDate } from '../lib/newsBanner';
import { Initials } from './PersonCard';
import { MediaImage } from './MediaImage';

/**
 * The organisation chart: Board of Directors, the six councils, the
 * Production Team and Website Administration, drawn from the live
 * appointments. Every seat shows the
 * person appointed or "Vacant". In administration, `renderAction` adds the
 * controls to appoint or remove someone.
 */

export interface ChartProps {
  assignments: Assignment[];
  profiles: PublicProfile[];
  councils: CityChapter[];
  /** Upcoming activities (for council online meetings). */
  activities?: NewsBanner[];
  renderAction?: (seat: Seat, a?: Assignment) => React.ReactNode;
  /** Administration: show who holds a seat even if their profile is hidden. */
  admin?: boolean;
  initialCouncil?: string;
}

type Ctx = Pick<ChartProps, 'renderAction' | 'admin'> & {
  seats: Map<string, Assignment>;
  profile: (id: string) => PublicProfile | undefined;
  councilName: (id?: string) => string;
};

const SeatCard: React.FC<{ seat: Seat; ctx: Ctx; size?: 'lg' | 'md' | 'sm'; showCouncil?: boolean; label?: string }> = ({ seat, ctx, size = 'md', showCouncil, label }) => {
  const a = ctx.seats.get(seat.id);
  const p = a ? ctx.profile(a.memberId) : undefined;
  const pos = positionById(seat.positionId)!;
  const filled = Boolean(a && (p || ctx.admin));
  const name = p?.displayName || a?.memberName || '';
  const img = size === 'lg' ? 56 : size === 'md' ? 44 : 36;
  const body = (
    <>
      {filled ? (
        p?.photoUrl
          ? <MediaImage src={p.photoUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: img, height: img }} loading="lazy" />
          : <span className="shrink-0 overflow-hidden rounded-full"><Initials name={name} size={img} /></span>
      ) : (
        <span className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line text-muted" style={{ width: img, height: img }} aria-hidden="true">
          <Users className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-[0.75rem] font-semibold tracking-wide uppercase ${pos.head ? 'text-navy' : 'text-muted'}`}>{label || pos.title}</span>
        {filled ? (
          <>
            <span className={`block truncate font-semibold text-ink ${size === 'lg' ? 'text-[1.125rem]' : 'text-[0.9688rem]'}`}>{name}</span>
            {a?.status && a.status !== 'active' && <span className="mt-0.5 inline-block rounded-full bg-amber-tint px-2 py-px text-[0.75rem] font-semibold text-ink">{SEAT_STATUS_LABEL[a.status]}</span>}
            {(showCouncil || (ctx.admin && !p)) && (
              <span className="block truncate text-[0.8125rem] text-muted">
                {[showCouncil && p?.chapterId ? ctx.councilName(p.chapterId) : '', ctx.admin && !p ? 'Not shown publicly (suspended)' : ''].filter(Boolean).join(' · ')}
              </span>
            )}
          </>
        ) : (
          <span className="block text-[0.9375rem] text-muted italic">Vacant</span>
        )}
      </span>
    </>
  );
  const cls = `flex items-center gap-3 rounded-2xl border bg-surface ${size === 'lg' ? 'p-4' : size === 'md' ? 'p-3' : 'px-3 py-2'} ${pos.head ? 'border-navy/40 shadow-[0_10px_24px_-18px_rgba(39,106,79,0.6)]' : 'border-line'}`;
  return (
    <div className="relative">
      {p && !ctx.renderAction ? (
        <a href={`/people/${encodeURIComponent(p.id)}`} className={`${cls} no-underline hover:border-navy`}>{body}</a>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {ctx.renderAction && <div className="mt-1.5">{ctx.renderAction(seat, a)}</div>}
    </div>
  );
};

/** A short vertical connector between levels. */
const Down: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`mx-auto h-6 w-px bg-ink/25 ${className}`} aria-hidden="true" />
);

/**
 * Children hanging from one line on wide screens. `cols` is the number of
 * columns on large screens, so the line spans from the first to the last.
 */
const Branch: React.FC<{ cols: number; className?: string; children: React.ReactNode }> = ({ cols, className = '', children }) => (
  <div className={`relative ${className}`}>
    <div className="absolute top-0 hidden h-px bg-ink/25 lg:block" style={{ left: `${50 / cols}%`, right: `${50 / cols}%` }} aria-hidden="true" />
    <div className="lg:pt-6">{children}</div>
  </div>
);

const Twig: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative">
    <div className="absolute -top-6 left-1/2 hidden h-6 w-px bg-ink/25 lg:block" aria-hidden="true" />
    {children}
  </div>
);

const SectionHead: React.FC<{ n: number; title: string; intro: string; id: string }> = ({ n, title, intro, id }) => (
  <div className="mb-8 max-w-[70ch]">
    <p className="text-[0.875rem] font-semibold tracking-[0.08em] text-navy uppercase">Part {n}</p>
    <h2 id={id} className="mt-1 text-[1.875rem] leading-tight font-semibold">{title}</h2>
    <p className="mt-2 text-ink-soft">{intro}</p>
  </div>
);

const isOnline = (b: NewsBanner) => /online|zoom|teams|google meet|meet\.google|webinar|virtual/i.test(`${b.location || ''} ${b.message}`);

const CORNERS = [
  { head: 'head_of_education_corner', member: 'education_corner_member', name: 'Education Corner' },
  { head: 'head_of_organising_corner', member: 'organising_corner_member', name: 'Organising Corner' },
  { head: 'media_supervisor', member: 'media_corner_member', name: 'Media and Communications Corner' },
  { head: 'head_of_finance_corner', member: 'finance_corner_member', name: 'Finance Corner' },
] as const;

const CouncilTeam: React.FC<{ council: CityChapter; ctx: Ctx; activities: NewsBanner[]; memberCount: number }> = ({ council, ctx, activities, memberCount }) => {
  const seats = councilSeats(council.id);
  const one = (pid: string) => seats.find((s) => s.positionId === pid)!;
  const now = new Date().toISOString();
  const meetings = activities.filter((b) => b.councilId === council.id && isOnline(b) && (!b.eventAt || b.eventAt > now)).slice(0, 3);

  return (
    <div className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.5rem] font-semibold">{council.name}</h3>
        <a href={`/councils/${encodeURIComponent(council.slug || council.id)}`} className="text-[0.9375rem] font-semibold text-navy underline underline-offset-4">
          Members in {council.name} · {memberCount}
        </a>
      </div>
      <div className="mx-auto mt-5 max-w-sm"><SeatCard seat={one('council_leader')} ctx={ctx} size="lg" /></div>
      <Down className="hidden lg:block" />
      <Branch cols={4} className="mt-4 lg:mt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {CORNERS.map((c) => (
            <Twig key={c.head}>
              <div className="space-y-2 rounded-2xl bg-stone p-3">
                <SeatCard seat={one(c.head)} ctx={ctx} />
                <p className="px-1 pt-1 text-[0.8125rem] font-semibold text-muted">{c.name} members</p>
                <div className="space-y-1.5 border-s-2 border-ink/15 ps-3">
                  {seats.filter((s) => s.positionId === c.member).map((s) => <SeatCard key={s.id} seat={s} ctx={ctx} size="sm" label={`Member ${s.seat}`} />)}
                </div>
              </div>
            </Twig>
          ))}
        </div>
      </Branch>
      {meetings.length > 0 && (
        <div className="mt-5 rounded-2xl bg-stone p-4">
          <p className="text-[0.875rem] font-semibold text-muted">Online meetings</p>
          <ul className="mt-2 space-y-1.5 text-[0.9375rem]">
            {meetings.map((b) => (
              <li key={b.id}><a href={activityPath(b.id)} className="font-semibold text-ink hover:underline">{b.message}</a><span className="block text-[0.8125rem] text-muted">{formatEventDate(b.eventAt)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Every member, in three groups by kind of membership: Pêşeng, Piştîwan and Komar. */
export const MembersByTier: React.FC<{ profiles: PublicProfile[]; councilName: (id?: string) => string; councilId?: string }> = ({ profiles, councilName, councilId }) => {
  const shown = profiles.filter((p) => (p as { membershipStatus?: string }).membershipStatus !== 'suspended' && (!councilId || p.chapterId === councilId));
  const groups = [...TIERS.map((t) => ({ t, people: shown.filter((p) => p.tier === t.id) })), { t: undefined, people: shown.filter((p) => !isTier(p.tier)) }]
    .filter((g) => g.t || g.people.length);
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {groups.map(({ t, people }) => (
        <div key={t?.id || 'none'} className={`rounded-2xl border-2 bg-surface p-4 ${t ? '' : 'lg:col-span-3'}`} style={{ borderColor: t ? `${t.colour}66` : 'var(--c-line)' }}>
          <div className="flex items-baseline justify-between gap-2">
            {t ? (
              <h3 className="font-semibold">
                <span className="font-kurdish text-[1.375rem]" lang="ckb" dir="rtl" translate="no" style={{ color: t.colour }}>{t.ku}</span>
                <span className="ku-sub ms-2 text-[1rem] text-ink-soft">{t.name}</span>
              </h3>
            ) : <h3 className="text-[1.0625rem] font-semibold text-ink-soft">Kind of membership not yet set</h3>}
            <span className="text-[1.25rem] font-semibold tabular-nums">{people.length}</span>
          </div>
          {t && <p className="mt-1 text-[0.875rem] text-muted">{t.description}</p>}
          {people.length === 0 ? (
            <p className="mt-3 text-[0.9375rem] text-muted italic">No members yet.</p>
          ) : (
            <ul className={`mt-3 grid gap-1.5 ${t ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {people.slice(0, 60).map((p) => (
                <li key={p.id}>
                  <a href={`/people/${encodeURIComponent(p.id)}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 no-underline hover:bg-stone">
                    {p.photoUrl ? <MediaImage src={p.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" /> : <span className="shrink-0 overflow-hidden rounded-full"><Initials name={p.displayName} size={32} /></span>}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{p.displayName}</span>
                      <span className="block truncate text-[0.8125rem] text-muted">{councilName(p.chapterId)}{p.designation && p.designation !== 'Member' ? ` · ${p.designation}` : ''}</span>
                    </span>
                  </a>
                </li>
              ))}
              {people.length > 60 && <li className="px-2 text-[0.875rem] text-muted">and {people.length - 60} more</li>}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export const OrgStructureChart: React.FC<ChartProps> = ({ assignments, profiles, councils, activities = [], renderAction, admin, initialCouncil }) => {
  const seatsMap = useMemo(() => byId(assignments), [assignments]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const councilName = (id?: string) => councils.find((c) => c.id === id)?.name || id || '';
  const ctx: Ctx = { seats: seatsMap, profile: (id) => profileMap.get(id), councilName, renderAction, admin };
  const [selected, setSelected] = useState(initialCouncil || councils[0]?.id || '');
  const council = councils.find((c) => c.id === selected) || councils[0];
  const board = boardSeats();
  const production = productionSeats();
  const webadmin = webadminSeats();
  const count = (cid: string) => profiles.filter((p) => p.chapterId === cid).length;
  const filledIn = (cid: string) => councilSeats(cid).filter((s) => seatsMap.has(s.id) && (admin || profileMap.has(seatsMap.get(s.id)!.memberId))).length;
  const totalCouncilSeats = council ? councilSeats(council.id).length : 0;

  return (
    <div className="space-y-16">
      {/* Part 1 */}
      <section aria-labelledby="org-board">
        <SectionHead n={1} id="org-board" title="Board of Directors" intro="The organisation’s central leadership. The Deputy President supports the President, and the heads of eight centres lead the organisation’s work everywhere. The Representative of the Lobby Supervisors speaks for the groups in cities and countries." />
        <div className="mx-auto max-w-sm"><SeatCard seat={board[0]} ctx={ctx} size="lg" showCouncil /></div>
        <Down />
        <div className="mx-auto max-w-sm"><SeatCard seat={board[1]} ctx={ctx} size="lg" showCouncil /></div>
        <Down className="hidden lg:block" />
        <Branch cols={4} className="mt-4 lg:mt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
            {board.filter((s) => s.positionId !== 'councils_representative').slice(2).map((s, i) => i < 4 ? <Twig key={s.id}><SeatCard seat={s} ctx={ctx} showCouncil /></Twig> : <SeatCard key={s.id} seat={s} ctx={ctx} showCouncil />)}
          </div>
        </Branch>
        <div className="mx-auto mt-6 max-w-sm">{board.filter((s) => s.positionId === 'councils_representative').map((s) => <SeatCard key={s.id} seat={s} ctx={ctx} showCouncil />)}</div>
      </section>

      {/* Part 2 */}
      <section aria-labelledby="org-councils">
        <SectionHead n={2} id="org-councils" title="Groups in cities and countries" intro="Wherever we have members, in the provinces of Kurdistan and in countries abroad, the group is led by a Lobby Supervisor with four corners: Education, Organising, Media and Communications, and Finance. Each corner has a head and several members. Only Pêşeng members take on these positions." />
        <div className="mb-6 flex items-center justify-center gap-3 text-[0.9375rem] text-ink-soft">
          <span className="h-px w-10 bg-ink/25" aria-hidden="true" />
          Board of Directors · Representative of the Lobby Supervisors
          <span className="h-px w-10 bg-ink/25" aria-hidden="true" />
        </div>
        <div role="tablist" aria-label="Groups" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {councils.map((c) => {
            const lead = seatsMap.get(councilSeats(c.id)[0].id);
            const lp = lead ? profileMap.get(lead.memberId) : undefined;
            const on = c.id === council?.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setSelected(c.id)}
                className={`cursor-pointer rounded-2xl border p-3 text-start transition ${on ? 'border-navy bg-navy text-white' : 'border-line bg-surface hover:border-navy/50'}`}>
                <span className="block font-semibold">{c.name}</span>
                <span className={`block truncate text-[0.8125rem] ${on ? 'text-white/85' : 'text-muted'}`}>Lobby Supervisor: {lp?.displayName || (admin && lead?.memberName) || 'Vacant'}</span>
                <span className={`block text-[0.8125rem] ${on ? 'text-white/85' : 'text-muted'}`}>{count(c.id)} members · {filledIn(c.id)}/{councilSeats(c.id).length} positions</span>
              </button>
            );
          })}
        </div>
        {council && (
          <div role="tabpanel" className="mt-6">
            <CouncilTeam council={council} ctx={ctx} activities={activities} memberCount={count(council.id)} />
            <p className="mt-3 text-center text-[0.875rem] text-muted">{filledIn(council.id)} of {totalCouncilSeats} positions filled in {council.name}.</p>
          </div>
        )}
      </section>

      {/* Part 3 */}
      <section aria-labelledby="org-tiers">
        <SectionHead n={3} id="org-tiers" title="Members by kind of membership" intro="Every member belongs to one of three groups: Pêşeng, who carry the movement’s work and take on positions; Piştîwan, who support it; and Komar, who give it their vote." />
        <MembersByTier profiles={profiles} councilName={councilName} />
      </section>

      {/* Part 4 */}
      <section aria-labelledby="org-production">
        <SectionHead n={4} id="org-production" title="Production Team" intro="One organisation-wide team that produces our design, reports, photography, video and online content. It is separate from the media corners of the groups." />
        <div className="mx-auto max-w-sm"><SeatCard seat={production[0]} ctx={ctx} size="lg" showCouncil /></div>
        <Down className="hidden lg:block" />
        <Branch cols={5} className="mt-4 lg:mt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
            {production.slice(1).map((s) => <Twig key={s.id}><SeatCard seat={s} ctx={ctx} showCouncil /></Twig>)}
          </div>
        </Branch>
      </section>

      {/* Part 5 */}
      <section aria-labelledby="org-webadmin">
        <SectionHead n={5} id="org-webadmin" title="Website Administration" intro="The team that runs the organisation’s website: security, content and translation, and member support. A position here does not by itself give access to the website’s administration." />
        <div className="mx-auto max-w-sm"><SeatCard seat={webadmin[0]} ctx={ctx} size="lg" showCouncil /></div>
        <Down className="hidden lg:block" />
        <Branch cols={4} className="mt-4 lg:mt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
            {webadmin.slice(1).map((s) => <Twig key={s.id}><SeatCard seat={s} ctx={ctx} showCouncil /></Twig>)}
          </div>
        </Branch>
      </section>
    </div>
  );
};

/** One council's team on its own (used on the council's page). */
export const CouncilTeamChart: React.FC<{ council: CityChapter; assignments: Assignment[]; profiles: PublicProfile[]; activities?: NewsBanner[] }> = ({ council, assignments, profiles, activities = [] }) => {
  const seats = useMemo(() => byId(assignments), [assignments]);
  const map = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const ctx: Ctx = { seats, profile: (id) => map.get(id), councilName: () => council.name };
  return <CouncilTeam council={council} ctx={ctx} activities={activities} memberCount={profiles.filter((p) => p.chapterId === council.id).length} />;
};
