import React from 'react';
import { Trophy } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Initials } from './PersonCard';
import { MediaImage } from './MediaImage';
import { LevelBadge } from './LevelBadge';

/**
 * Public "Top 10 most active members", ranked by total points. Points come
 * from real contributions recorded in the points ledger (published articles,
 * reactions, verified shares, confirmed attendance), never from page views.
 * Equal points: members are listed alphabetically by name.
 */
export const TopMembers: React.FC<{ onNavigate: (tab: string, param?: string) => void; compact?: boolean }> = ({ onNavigate, compact }) => {
  const { publicProfiles, chapters, siteSettings } = useData();
  if (siteSettings.ranking?.enabled === false) return null;

  const total = (p: { points?: Record<string, number> }) => Math.max(0, p.points?.all || 0);
  const ranked = [...publicProfiles]
    .sort((a, b) => total(b) - total(a) || a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' }))
    .slice(0, 10);

  // Equal points share a rank (1, 2, 2, 4…).
  let lastPts = -1;
  let lastRank = 0;
  const rows = ranked.map((p, i) => {
    const pts = total(p);
    const rank = pts === lastPts ? lastRank : i + 1;
    lastPts = pts;
    lastRank = rank;
    return { p, pts, rank };
  });
  const council = (id: string, name?: string) => chapters.find((c) => c.id === id)?.name || name || '';

  return (
    <section aria-labelledby="top10-heading" className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Trophy className="h-4 w-4" aria-hidden="true" /> Recognising our members</p>
      <h2 id="top10-heading" className="mt-1 text-[1.75rem] leading-tight font-semibold">Top 10 most active members</h2>
      <p className="mt-1 text-[0.9375rem] text-muted">Ranked by total points for publishing articles, reacting to articles, verified sharing and confirmed attendance at our activities.</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-stone p-6 text-ink-soft">The ranking appears as soon as members join.</p>
      ) : (
        <ol className={`mt-6 grid gap-x-8 ${compact ? '' : 'md:grid-flow-col md:grid-cols-2'}`} style={compact ? undefined : { gridTemplateRows: `repeat(${Math.ceil(rows.length / 2)}, auto)` }}>
          {rows.map(({ p, pts, rank }, i) => (
            <li key={p.id} className={`border-t border-line first:border-t-0 ${i === Math.ceil(rows.length / 2) ? 'md:border-t-0' : ''}`}>
              <a href={`/people/${encodeURIComponent(p.id)}`} onClick={(e) => { e.preventDefault(); onNavigate('member-profile', p.id); }} className="group flex items-center gap-3 py-3 no-underline sm:gap-4">
                <span className={`w-7 shrink-0 text-center font-serif text-[1.25rem] font-semibold tabular-nums ${rank <= 3 ? 'text-[#B07A12]' : 'text-muted'}`}>{rank}</span>
                {p.photoUrl ? (
                  <MediaImage src={p.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="shrink-0 overflow-hidden rounded-full"><Initials name={p.displayName} size={44} /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink group-hover:underline group-hover:underline-offset-4">{p.displayName}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2">
                    <LevelBadge points={pts} />
                    <span className="truncate text-[0.8438rem] text-muted">{council(p.chapterId, p.chapterName)}</span>
                  </span>
                </span>
                <span className="shrink-0 text-end text-[0.9375rem] font-semibold tabular-nums">{pts.toLocaleString('en-GB')}<span className="block text-[0.75rem] font-normal text-muted">points</span></span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
