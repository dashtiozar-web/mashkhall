import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Crown, MapPin, TrendingUp, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { UK_REGIONS, UK_VIEWBOX, projectUK } from '../data/ukRegions';
import { councilPosition } from '../lib/landmarks';
import { councilStats, CouncilStat, GROWTH_DAYS, HEAT_LEGEND } from '../lib/councilStats';
import { useAssignments } from '../lib/orgStructure';

/** Built-in council → region (others are found from their map position). */
const HOME_REGION: Record<string, string> = {
  london: 'GB-UKI', birmingham: 'GB-UKG', manchester: 'GB-UKD', newcastle: 'GB-UKC', glasgow: 'GB-SCT', cardiff: 'GB-WLS',
};

interface Node { stat: CouncilStat; x: number; y: number }

/** Lines joining the councils: the shortest network that links them all, plus each council's nearest neighbour. */
const networkEdges = (nodes: Node[]) => {
  const n = nodes.length;
  if (n < 2) return [] as [number, number][];
  const dist = (a: number, b: number) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
  const inTree = new Set([0]);
  const edges = new Map<string, [number, number]>();
  const add = (a: number, b: number) => edges.set(a < b ? `${a}-${b}` : `${b}-${a}`, a < b ? [a, b] : [b, a]);
  while (inTree.size < n) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    inTree.forEach((a) => {
      for (let b = 0; b < n; b++) if (!inTree.has(b) && dist(a, b) < bestD) { bestD = dist(a, b); best = [a, b]; }
    });
    if (!best) break;
    inTree.add(best[1]);
    add(best[0], best[1]);
  }
  // A second link for each council to its next-nearest neighbour, so the network reads as a web.
  for (let a = 0; a < n; a++) {
    const order = nodes.map((_, b) => b).filter((b) => b !== a).sort((x, y) => dist(a, x) - dist(a, y));
    if (order[1] !== undefined && dist(a, order[1]) < 380) add(a, order[1]);
  }
  return Array.from(edges.values());
};

const curve = (a: Node, b: Node) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bend = 0.12;
  return `M${a.x},${a.y} Q${mx - dy * bend},${my + dx * bend} ${b.x},${b.y}`;
};

export const UKCouncilMap: React.FC<{ onOpen?: (councilId: string) => void }> = ({ onOpen }) => {
  const { chapters, publicProfiles } = useData();
  const assignments = useAssignments();
  const stats = useMemo(() => councilStats(chapters, publicProfiles), [chapters, publicProfiles]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const regionRefs = useRef<Record<string, SVGPathElement | null>>({});
  const [found, setFound] = useState<Record<string, string>>({});

  const nodes: Node[] = useMemo(() => stats.flatMap((stat) => {
    const pos = councilPosition(stat.council);
    if (!pos) return [];
    const [x, y] = projectUK(pos.lng, pos.lat);
    return [{ stat, x, y }];
  }), [stats]);
  const edges = useMemo(() => networkEdges(nodes), [nodes]);

  // Councils added later are matched to the region their position falls in.
  useEffect(() => {
    const next: Record<string, string> = {};
    nodes.forEach((n) => {
      if (HOME_REGION[n.stat.council.id]) return;
      for (const r of UK_REGIONS) {
        const el = regionRefs.current[r.id];
        try {
          if (el && el.isPointInFill(new DOMPoint(n.x, n.y))) { next[n.stat.council.id] = r.id; break; }
        } catch { /* older browsers: marker only */ }
      }
    });
    setFound(next);
  }, [nodes]);

  // A region takes the colour of the largest council in it.
  const regionStat = useMemo(() => {
    const m = new Map<string, CouncilStat>();
    stats.forEach((s) => {
      const r = HOME_REGION[s.council.id] || found[s.council.id];
      if (r && (!m.has(r) || m.get(r)!.members < s.members)) m.set(r, s);
    });
    return m;
  }, [stats, found]);

  const total = new Set(publicProfiles.filter((p) => p.membershipStatus !== 'suspended').map((p) => p.id)).size;
  const leaderOf = (id: string) => {
    const a = assignments?.find((x) => x.id === `council__${id}__council_leader`);
    return a ? publicProfiles.find((p) => p.id === a.memberId)?.displayName : undefined;
  };
  const focusId = hover || selected;
  const focus = stats.find((s) => s.council.id === focusId);
  const maxMembers = Math.max(1, ...stats.map((s) => s.members));
  const radius = (n: number) => 13 + 11 * Math.sqrt(n / maxMembers);
  const linked = (i: number, j: number) => {
    if (!focusId) return false;
    return nodes[i]?.stat.council.id === focusId || nodes[j]?.stat.council.id === focusId;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
      <figure className="relative m-0 rounded-3xl border border-line bg-[#EAF1F4] p-2 dark:bg-[#1b2a31] sm:p-4">
        <svg viewBox={`0 0 ${UK_VIEWBOX.width} ${UK_VIEWBOX.height}`} role="group" aria-label="Map of the United Kingdom showing our councils" className="mx-auto block h-auto max-h-[78vh] w-full">
          <defs>
            <filter id="mk-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.35" /></filter>
          </defs>
          {UK_REGIONS.map((r) => {
            const s = regionStat.get(r.id);
            const on = s && focusId === s.council.id;
            return (
              <path key={r.id} ref={(el) => { regionRefs.current[r.id] = el; }} d={r.d}
                fill={s ? s.colour : 'var(--map-land, #FBF8F2)'} fillOpacity={s ? (on ? 0.95 : 0.72) : 1}
                stroke="#ffffff" strokeWidth={on ? 2.5 : 1.2} strokeLinejoin="round"
                className={s ? 'cursor-pointer transition-[fill-opacity]' : ''}
                onMouseEnter={() => s && setHover(s.council.id)} onMouseLeave={() => setHover(null)}
                onClick={() => s && setSelected(s.council.id)}>
                <title>{s ? `${r.name}: ${s.council.name} Council, ${s.members} members` : r.name}</title>
              </path>
            );
          })}

          {/* The national network */}
          {edges.map(([i, j]) => (
            <path key={`${i}-${j}`} d={curve(nodes[i], nodes[j])} fill="none"
              stroke={linked(i, j) ? '#1F2622' : '#276A4F'} strokeOpacity={focusId && !linked(i, j) ? 0.25 : 0.85}
              strokeWidth={linked(i, j) ? 3 : 2} strokeLinecap="round" className="map-flow" />
          ))}

          {nodes.map((n) => {
            const id = n.stat.council.id;
            const on = focusId === id;
            const r = radius(n.stat.members);
            const left = n.x > UK_VIEWBOX.width * 0.62 ? false : n.x < UK_VIEWBOX.width * 0.45;
            return (
              <g key={id} role="button" tabIndex={0} aria-label={`${n.stat.council.name} Council: ${n.stat.members} members, ranked ${n.stat.rank}`}
                aria-pressed={selected === id} className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(id)} onBlur={() => setHover(null)}
                onClick={() => setSelected(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id); } }}>
                {on && <circle cx={n.x} cy={n.y} r={r + 9} fill={n.stat.colour} fillOpacity={0.25} />}
                <circle cx={n.x} cy={n.y} r={r} fill={n.stat.colour} stroke="#fff" strokeWidth={3} filter="url(#mk-shadow)" />
                <text x={n.x} y={n.y + 6} textAnchor="middle" className="pointer-events-none fill-white font-sans text-[17px] font-bold" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2 }}>{n.stat.members}</text>
                <text x={left ? n.x - r - 7 : n.x + r + 7} y={n.y + 7} textAnchor={left ? 'end' : 'start'}
                  className="pointer-events-none fill-[#1F2622] font-sans text-[22px] font-semibold dark:fill-white" style={{ paintOrder: 'stroke', stroke: 'var(--map-halo, #ffffff)', strokeWidth: 5, strokeLinejoin: 'round' }}>
                  {n.stat.council.name}
                </text>
              </g>
            );
          })}
        </svg>

        <figcaption className="mt-3 flex flex-col gap-3 px-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-soft">Members per council</p>
            <div className="mt-1 h-2.5 w-56 max-w-full rounded-full" style={{ background: `linear-gradient(90deg, ${HEAT_LEGEND.join(', ')})` }} aria-hidden="true" />
            <div className="mt-1 flex w-56 max-w-full justify-between text-[0.75rem] text-muted"><span>Fewest (green)</span><span>Most (red)</span></div>
          </div>
          <p className="text-[0.75rem] text-muted">Numbers on the circles are members. Lines show our national network. Map data: <a href="https://www.amcharts.com/" target="_blank" rel="noopener noreferrer" className="underline">amCharts</a>.</p>
        </figcaption>
      </figure>

      <aside className="space-y-5" aria-live="polite">
        <div className="rounded-3xl bg-navy p-5 text-white">
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white/85"><Users className="h-4 w-4" aria-hidden="true" /> National total</p>
          <p className="mt-1 font-serif text-[3rem] leading-none font-semibold tabular-nums">{total.toLocaleString('en-GB')}</p>
          <p className="mt-1 text-white/85">approved members in {stats.length} councils</p>
        </div>

        {focus ? (
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="flex items-center gap-2 text-[0.875rem] font-semibold" style={{ color: focus.colour }}><MapPin className="h-4 w-4" aria-hidden="true" /> Ranked {focus.rank} of {stats.length}</p>
            <h3 className="mt-1 text-[1.5rem] font-semibold">{focus.council.name} Council</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[0.9375rem]">
              <div><dt className="text-muted">Members</dt><dd className="text-[1.375rem] font-semibold tabular-nums">{focus.members}</dd></div>
              <div><dt className="text-muted">Last {GROWTH_DAYS} days</dt><dd className="text-[1.375rem] font-semibold tabular-nums">{focus.growth ? `+${focus.growth}` : '0'}</dd></div>
              <div className="col-span-2"><dt className="text-muted">Council Leader</dt><dd className="font-semibold">{leaderOf(focus.council.id) || 'Vacant'}</dd></div>
            </dl>
            {focus.council.description && <p className="mt-3 text-[0.9375rem] text-ink-soft">{focus.council.description}</p>}
            <a href={`/councils/${encodeURIComponent(focus.council.slug || focus.council.id)}`} onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(focus.council.slug || focus.council.id); } }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 font-semibold text-white no-underline hover:bg-navy-deep">
              Open the council page <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-line p-5 text-ink-soft">Choose a council on the map to see its members, leader and links to the rest of the network.</p>
        )}
      </aside>
    </div>
  );
};

/** Live league of the provinces and countries by approved members, with growth and recognition. */
export const CouncilRanking: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { chapters, publicProfiles } = useData();
  const stats = useMemo(() => councilStats(chapters, publicProfiles), [chapters, publicProfiles]);
  const max = Math.max(1, ...stats.map((s) => s.members));
  const topGrowth = Math.max(0, ...stats.map((s) => s.growth));
  const total = stats.reduce((n, s) => n + s.members, 0);

  return (
    <section aria-labelledby="council-league" className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.9375rem] font-semibold text-navy">Growing together</p>
          <h2 id="council-league" className="text-[1.625rem] leading-tight font-semibold">Membership league</h2>
        </div>
        <p className="text-[0.9375rem] text-ink-soft"><strong className="tabular-nums text-ink">{total}</strong> members in total</p>
      </div>
      {!compact && <p className="mt-2 max-w-[62ch] text-[0.9375rem] text-ink-soft">Every province and country counts. The league updates by itself as members are approved, and celebrates both the largest and the fastest growing.</p>}
      <ol className="mt-5 space-y-3">
        {stats.map((s) => (
          <li key={s.council.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className={`text-center font-serif text-[1.25rem] font-semibold tabular-nums ${s.rank === 1 && s.members > 0 ? 'text-[#B07A12]' : 'text-muted'}`}>{s.rank}</span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <a href={`/councils/${encodeURIComponent(s.council.slug || s.council.id)}`} className="font-semibold text-ink hover:underline">{s.council.name}</a>
                {s.rank === 1 && s.members > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-tint px-2 py-0.5 text-[0.75rem] font-semibold text-[#8a5b00]"><Crown className="h-3 w-3" aria-hidden="true" /> Most members</span>}
                {topGrowth > 0 && s.growth === topGrowth && <span className="inline-flex items-center gap-1 rounded-full bg-navy-tint px-2 py-0.5 text-[0.75rem] font-semibold text-navy"><TrendingUp className="h-3 w-3" aria-hidden="true" /> Fastest growing</span>}
              </p>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-stone" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (s.members / max) * 100)}%`, background: s.colour }} />
              </span>
            </div>
            <span className="text-end text-[0.9375rem] tabular-nums">
              <strong>{s.members}</strong>
              <span className="block text-[0.75rem] text-muted">{s.growth ? `+${s.growth} in ${GROWTH_DAYS} days` : `in ${GROWTH_DAYS} days: 0`}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};
