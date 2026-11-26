import React, { useEffect, useMemo, useState } from 'react';
import { useTiers } from '../lib/useTiers';
import placesConfig from '../config/administrations.json';
import { Globe3D } from './Globe3D';

const GLOBE_POINTS: Record<string, [number, number]> = { britain: [-1.8, 53.2], germany: [10.4, 51.1], usa: [-98, 39.5], canada: [-100, 56.5], australia: [134, -25.5] };
const GLOBE_ISO: Record<string, string> = { britain: '826', germany: '276', usa: '840', canada: '124', australia: '036' };

const ADMINISTRATIONS = placesConfig.administrations;
import { ArrowRight, Globe2, MapPin, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { councilStats, CouncilStat, GROWTH_DAYS, HEAT_LEGEND } from '../lib/councilStats';
import { ABROAD_IDS, COUNTRIES, PROVINCES, PROVINCE_IDS } from '../lib/places';
import { TIERS } from '../lib/tiers';
import {
  KURDISTAN_NEIGHBOURS, KURDISTAN_POINTS, KURDISTAN_REGIONS, KURDISTAN_VIEWBOX, MapShape,
} from '../data/geoMaps';

/*
 * Two live maps of where our members are: the five provinces of Kurdistan,
 * and the world, with the five countries abroad joined to Kurdistan. Colours
 * run from green (fewest members) to red (most) on each map.
 */

interface Node { stat: CouncilStat; x: number; y: number }

const kuName = (id: string) => PROVINCES.find((p) => p.id === id)?.ku || COUNTRIES.find((c) => c.id === id)?.ku || '';

const curve = (a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.12) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x},${a.y} Q${mx - dy * bend},${my + dx * bend} ${b.x},${b.y}`;
};

const useGroupStats = (ids: string[]) => {
  const { chapters, publicProfiles } = useData();
  return useMemo(() => {
    const groups = ids.map((id) => chapters.find((c) => c.id === id)).filter(Boolean) as typeof chapters;
    return councilStats(groups, publicProfiles);
  }, [chapters, publicProfiles, ids]);
};

/** How many of each kind of membership, per province or country: only for Pêşeng members and staff. */
type TierCount = Record<'peshang' | 'pishtiwan' | 'komar', number>;
const useTierCounts = () => {
  const { publicProfiles } = useData();
  const { canSee, tiers } = useTiers();
  return useMemo(() => {
    const m = new Map<string, TierCount>();
    if (!canSee) return { canSee, m };
    for (const p of publicProfiles) {
      const t = tiers.get(p.id);
      if (p.membershipStatus === 'suspended' || !t) continue;
      const row = m.get(p.chapterId) || { peshang: 0, pishtiwan: 0, komar: 0 };
      row[t] += 1;
      m.set(p.chapterId, row);
    }
    return { canSee, m };
  }, [publicProfiles, canSee, tiers]);
};

/** Public totals by city and by independent administration (no names, no kinds). */
interface PlaceStats { total: number; byChapter: Record<string, number>; byCity: Record<string, Record<string, number>>; byAdministration: Record<string, number> }
let statsCache: Promise<PlaceStats | null> | null = null;
const usePlaceStats = () => {
  const [stats, setStats] = useState<PlaceStats | null>(null);
  useEffect(() => {
    let alive = true;
    statsCache = statsCache || fetch('/api/place-stats').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    statsCache.then((d) => { if (alive) setStats(d); });
    return () => { alive = false; };
  }, []);
  return stats;
};
const useAllMembers = () => {
  const { publicProfiles } = useData();
  return publicProfiles.filter((p) => p.membershipStatus !== 'suspended').length;
};
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 1000) / 10}%` : '0%');

/** Members by city or town in one place, with each city's share. */
const CityList: React.FC<{ cities?: Record<string, number>; total: number }> = ({ cities, total }) => {
  const rows = Object.entries(cities || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!rows.length) return null;
  return (
    <div className="mt-4">
      <p className="text-[0.875rem] font-semibold text-muted">By city or town</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map(([city, n]) => (
          <li key={city} className="flex items-center gap-2 text-[0.9375rem]">
            <span className="min-w-0 flex-1 truncate" dir="auto">{city}</span>
            <span className="tabular-nums font-semibold">{n}</span>
            <span className="w-14 text-end text-[0.8125rem] tabular-nums text-muted">{pct(n, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
const sumTiers = (rows: (TierCount | undefined)[]): TierCount => rows.reduce<TierCount>((t, r) => ({ peshang: t.peshang + (r?.peshang || 0), pishtiwan: t.pishtiwan + (r?.pishtiwan || 0), komar: t.komar + (r?.komar || 0) }), { peshang: 0, pishtiwan: 0, komar: 0 });

const TierRow: React.FC<{ c: TierCount; dark?: boolean }> = ({ c, dark }) => (
  <div className="mt-3 grid grid-cols-3 gap-2">
    {TIERS.map((t) => (
      <div key={t.id} className={`rounded-xl px-2 py-1.5 text-center ${dark ? 'bg-white/10' : 'bg-stone'}`} title={t.name}>
        <div className="font-kurdish text-[0.9375rem] font-semibold" lang="ckb" dir="rtl" translate="no" style={{ color: dark ? '#F2C14E' : t.colour }}>{t.ku}</div>
        <div className="text-[1.125rem] font-semibold tabular-nums">{c[t.id]}</div>
      </div>
    ))}
  </div>
);

const Legend: React.FC<{ note: React.ReactNode; dark?: boolean }> = ({ note, dark }) => (
  <figcaption className="mt-3 flex flex-col gap-3 px-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className={`text-[0.8125rem] font-semibold ${dark ? 'text-white/85' : 'text-ink-soft'}`}>Members</p>
      <div className="mt-1 h-2.5 w-56 max-w-full rounded-full" style={{ background: `linear-gradient(90deg, ${HEAT_LEGEND.join(', ')})` }} aria-hidden="true" />
      <div className={`mt-1 flex w-56 max-w-full justify-between text-[0.75rem] ${dark ? 'text-white/65' : 'text-muted'}`}><span>Fewest (green)</span><span>Most (red)</span></div>
    </div>
    <p className={`max-w-[44ch] text-[0.75rem] ${dark ? 'text-white/65' : 'text-muted'}`}>{note} {dark ? null : <>Map data: <a href="https://www.amcharts.com/" target="_blank" rel="noopener noreferrer" className="underline">amCharts</a>.</>}</p>
  </figcaption>
);

/** A circle with the number of members, and the place's name beside it. */
const Marker: React.FC<{
  n: Node; r: number; on: boolean; labelLeft: boolean; font: number; below?: boolean;
  onHover: (id: string | null) => void; onPick: (id: string) => void; picked: boolean;
}> = ({ n, r, on, labelLeft, font, below, onHover, onPick, picked }) => {
  const id = n.stat.council.id;
  return (
    <g role="button" tabIndex={0} aria-label={`${n.stat.council.name}: ${n.stat.members} members, ranked ${n.stat.rank}`}
      aria-pressed={picked} className="cursor-pointer focus:outline-none"
      onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(id)} onBlur={() => onHover(null)}
      onClick={() => onPick(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); } }}>
      <ellipse cx={n.x} cy={n.y + r * 0.95} rx={r * 0.95} ry={r * 0.32} fill="#000" opacity={0.28} />
      {on && <circle cx={n.x} cy={n.y} r={r + r * 0.6} fill={n.stat.colour} fillOpacity={0.3} />}
      <circle cx={n.x} cy={n.y} r={r} fill={n.stat.colour} stroke="#fff" strokeWidth={r * 0.16} filter="url(#mm-shadow)" />
      <circle cx={n.x} cy={n.y} r={r} fill="url(#mm-pin)" />
      <text x={n.x} y={n.y + font * 0.36} textAnchor="middle" className="pointer-events-none fill-white font-sans font-bold" style={{ fontSize: font, paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2 }}>{n.stat.members}</text>
      <text x={below ? n.x : labelLeft ? n.x - r - font * 0.4 : n.x + r + font * 0.4} y={below ? n.y + r + font * 1.3 : n.y + font * 0.42} textAnchor={below ? 'middle' : labelLeft ? 'end' : 'start'}
        className="pointer-events-none fill-[#1F2622] font-sans font-semibold dark:fill-white"
        style={{ fontSize: font * 1.25, paintOrder: 'stroke', stroke: 'var(--map-halo, #ffffff)', strokeWidth: font * 0.3, strokeLinejoin: 'round' }}>
        {n.stat.council.name}
      </text>
    </g>
  );
};

/** The side panel: a total, and the details of the place chosen on the map. */
const Panel: React.FC<{
  icon: React.ReactNode; label: string; total: number; of: string; focus?: CouncilStat; count: number;
  hint: string; onOpen?: (slug: string) => void; tiers?: TierCount; focusTiers?: TierCount;
  allMembers?: number; cities?: Record<string, number>;
}> = ({ icon, label, total, of, focus, count, hint, onOpen, tiers, focusTiers, allMembers = 0, cities }) => (
  <aside className="space-y-5" aria-live="polite">
    <div className="rounded-3xl bg-navy p-5 text-white">
      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white/85">{icon} {label}</p>
      <p className="mt-1 font-serif text-[3rem] leading-none font-semibold tabular-nums">{total.toLocaleString('en-GB')}</p>
      <p className="mt-1 text-white/85">{of}{allMembers ? ` · ${pct(total, allMembers)} of all members` : ''}</p>
      {tiers && <TierRow c={tiers} dark />}
    </div>
    {focus ? (
      <div className="rounded-3xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold" style={{ color: focus.colour }}><MapPin className="h-4 w-4" aria-hidden="true" /> Ranked {focus.rank} of {count}</p>
        <h3 className="mt-1 text-[1.5rem] font-semibold">
          {focus.council.name}
          <span className="ku-sub ms-2 font-kurdish text-[1.125rem] font-normal text-muted" lang="ckb" dir="rtl" translate="no">{kuName(focus.council.id)}</span>
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[0.9375rem]">
          <div><dt className="text-muted">Members</dt><dd className="text-[1.375rem] font-semibold tabular-nums">{focus.members}</dd></div>
          <div><dt className="text-muted">Last {GROWTH_DAYS} days</dt><dd className="text-[1.375rem] font-semibold tabular-nums">{focus.growth ? `+${focus.growth}` : '0'}</dd></div>
          <div className="col-span-2"><dt className="text-muted">Share of all members</dt><dd className="text-[1.375rem] font-semibold tabular-nums">{pct(focus.members, allMembers)}</dd></div>
        </dl>
        <CityList cities={cities} total={focus.members} />
        {focusTiers && <TierRow c={focusTiers} />}
        <a href={`/councils/${encodeURIComponent(focus.council.slug || focus.council.id)}`}
          onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(focus.council.slug || focus.council.id); } }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 font-semibold text-white no-underline hover:bg-navy-deep">
          See the members <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </a>
      </div>
    ) : (
      <p className="rounded-3xl border border-dashed border-line p-5 text-ink-soft">{hint}</p>
    )}
  </aside>
);

/** The five provinces of Kurdistan, coloured by members, with their numbers. */
export const KurdistanMembersMap: React.FC<{ onOpen?: (slug: string) => void }> = ({ onOpen }) => {
  const stats = useGroupStats(PROVINCE_IDS);
  const [focusAdm, setFocusAdm] = useState<string | null>(null);
  const tierCounts = useTierCounts();
  const placeStats = usePlaceStats();
  const allMembers = useAllMembers();
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const focusId = hover || selected;
  const byId = new Map(stats.map((s) => [s.council.id, s]));
  const nodes: Node[] = KURDISTAN_REGIONS.filter((r) => r.province && byId.has(r.id))
    .map((r) => ({ stat: byId.get(r.id)!, x: r.c![0], y: r.c![1] }));
  // Halabja is small: its circle sits on the province itself, Sulaymaniyah's a little apart.
  const place = (n: Node) => (n.stat.council.id === 'sulaymaniyah' ? { ...n, x: n.x - 40, y: n.y - 10 } : n);
  const placed = nodes.map(place);
  const order = ['duhok', 'erbil', 'sulaymaniyah', 'halabja', 'kirkuk'];
  const links: [string, string][] = [['duhok', 'erbil'], ['erbil', 'sulaymaniyah'], ['erbil', 'kirkuk'], ['kirkuk', 'sulaymaniyah'], ['sulaymaniyah', 'halabja']];
  const at = (id: string) => placed.find((n) => n.stat.council.id === id);
  const max = Math.max(1, ...stats.map((s) => s.members));
  const radius = (n: number) => 20 + 14 * Math.sqrt(n / max);
  const total = stats.reduce((a, s) => a + s.members, 0);
  const label = (s: MapShape) => s.name.replace(/[ʾʿ’‘]/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '');

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
      <figure className="relative m-0 overflow-hidden rounded-3xl border border-line bg-[linear-gradient(180deg,#cfe0ea_0%,#e9e4d6_55%,#d9cfb8_100%)] p-2 dark:bg-[linear-gradient(180deg,#14222c_0%,#1d1a14_100%)] sm:p-4" style={{ perspective: '1300px' }}>
        {/* The map is tilted like a relief model on a table, with depth and light. */}
        <div style={{ transform: 'rotateX(24deg) scale(1.04)', transformOrigin: '50% 62%', transformStyle: 'preserve-3d' }}>
        <svg viewBox={`0 0 ${KURDISTAN_VIEWBOX.width} ${KURDISTAN_VIEWBOX.height}`} role="group" aria-label="Map of the five provinces of Kurdistan showing our members" className="mx-auto block h-auto max-h-[78vh] w-full overflow-visible">
          <defs>
            <filter id="mm-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.45" /></filter>
            <clipPath id="mm-k-clip"><rect width={KURDISTAN_VIEWBOX.width} height={KURDISTAN_VIEWBOX.height} /></clipPath>
            {/* Mountains and valleys, lit from the north-west */}
            <filter id="mm-relief" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="5" seed="11" result="n" />
              <feDiffuseLighting in="n" surfaceScale="3.4" diffuseConstant="1.1" lightingColor="#ffffff" result="l">
                <feDistantLight azimuth="225" elevation="40" />
              </feDiffuseLighting>
              <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="lit" />
              <feComposite in="lit" in2="SourceGraphic" operator="in" />
            </filter>
            <radialGradient id="mm-pin" cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
            </radialGradient>
            <linearGradient id="mm-sun" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <g clipPath="url(#mm-k-clip)">
            <g filter="url(#mm-relief)">
              {KURDISTAN_NEIGHBOURS.map((r) => (
                <path key={r.id} d={r.d} fill="#c9bf9f" stroke="#a89c78" strokeWidth={1}><title>{r.name}</title></path>
              ))}
            </g>
            {/* The land's thickness: the provinces stand up from the ground */}
            {[10, 8, 6, 4, 2].map((dy) => (
              <g key={dy} transform={`translate(0 ${dy})`} aria-hidden="true">
                {KURDISTAN_REGIONS.map((r) => <path key={r.id} d={r.d} fill={r.province ? '#3b2416' : '#8e8160'} opacity={r.province ? 0.9 : 0.5} />)}
              </g>
            ))}
            <g filter="url(#mm-relief)">
              {KURDISTAN_REGIONS.map((r) => {
                const s = r.province ? byId.get(r.id) : undefined;
                const on = s && focusId === s.council.id;
                return (
                  <path key={r.id} d={r.d}
                    fill={s ? s.colour : '#ddd2b0'} fillOpacity={s ? (on ? 1 : 0.92) : 1}
                    stroke={s ? '#fff8e8' : '#b5a77f'} strokeWidth={on ? 3.5 : s ? 2 : 1} strokeLinejoin="round"
                    className={s ? 'cursor-pointer' : ''}
                    onMouseEnter={() => s && setHover(s.council.id)} onMouseLeave={() => setHover(null)}
                    onClick={() => s && setSelected(s.council.id)}>
                    <title>{s ? `${s.council.name}: ${s.members} members` : label(r)}</title>
                  </path>
                );
              })}
            </g>
            <rect width={KURDISTAN_VIEWBOX.width} height={KURDISTAN_VIEWBOX.height} fill="url(#mm-sun)" pointerEvents="none" />
            {/* The provinces joined together */}
            {links.map(([a, b]) => {
              const A = at(a); const B = at(b);
              if (!A || !B) return null;
              const lit = focusId === a || focusId === b;
              return <path key={`${a}-${b}`} d={curve(A, B)} fill="none" stroke={lit ? '#1F2622' : '#7A2414'}
                strokeOpacity={focusId && !lit ? 0.25 : 0.8} strokeWidth={lit ? 4 : 2.5} strokeLinecap="round" className="map-flow" />;
            })}
            {/* Independent administrations: Raparin, Garmiyan, Zakho and Soran */}
            {ADMINISTRATIONS.map((a) => {
              const [x, y] = KURDISTAN_POINTS[a.id] || [0, 0];
              const n = placeStats?.byAdministration?.[a.id] || 0;
              const on = focusAdm === a.id;
              return (
                <g key={a.id} role="button" tabIndex={0} className="cursor-pointer focus:outline-none" aria-label={`${a.name} independent administration: ${n} members`}
                  onMouseEnter={() => setFocusAdm(a.id)} onMouseLeave={() => setFocusAdm(null)} onFocus={() => setFocusAdm(a.id)} onBlur={() => setFocusAdm(null)}
                  onClick={() => setFocusAdm(a.id)}>
                  <rect x={x - 15} y={y - 15} width={30} height={30} rx={7} transform={`rotate(45 ${x} ${y})`} fill="#1F100B" stroke={on ? '#F2C14E' : '#ffffff'} strokeWidth={on ? 4 : 3} filter="url(#mm-shadow)" />
                  <text x={x} y={y + 6} textAnchor="middle" className="pointer-events-none fill-white font-sans font-bold" style={{ fontSize: 16 }}>{n}</text>
                  <text x={a.id === 'raparin' ? x + 24 : x} y={a.id === 'raparin' ? y + 6 : a.id === 'zakho' ? y + 40 : y - 26} textAnchor={a.id === 'raparin' ? 'start' : 'middle'} className="pointer-events-none fill-[#1F100B] font-sans font-semibold italic dark:fill-white"
                    style={{ fontSize: 17, paintOrder: 'stroke', stroke: 'var(--map-halo, #ffffff)', strokeWidth: 5, strokeLinejoin: 'round' }}>{a.name}</text>
                </g>
              );
            })}
            {order.map((id) => {
              const n = at(id);
              if (!n) return null;
              return <Marker key={id} n={n} r={radius(n.stat.members)} on={focusId === id} picked={selected === id}
                labelLeft={id === 'kirkuk'} below={id === 'halabja'} font={22} onHover={setHover} onPick={setSelected} />;
            })}
          </g>
        </svg>
        </div>
        <Legend note="Circles show the members in each province; diamonds show the independent administrations of Raparin, Garmiyan, Zakho and Soran." />
        {focusAdm && (() => {
          const a = ADMINISTRATIONS.find((x) => x.id === focusAdm)!;
          const n = placeStats?.byAdministration?.[a.id] || 0;
          const prov = placeStats?.byCity?.[a.province] || {};
          const cities: Record<string, number> = Object.fromEntries(Object.entries(prov).filter(([c]) => a.cities.some((x) => x.toLowerCase() === c.toLowerCase())));
          return (
            <div className="mx-2 mt-3 rounded-2xl border border-line bg-surface p-4">
              <p className="font-semibold">{a.name} <span className="ku-sub ms-1 font-kurdish font-normal text-muted" lang="ckb" dir="rtl" translate="no">{a.ku}</span> <span className="font-normal text-ink-soft">· independent administration in {placeStats ? PROVINCES.find((p) => p.id === a.province)?.name : ''}</span></p>
              <p className="mt-1 text-ink-soft"><strong className="text-ink tabular-nums">{n}</strong> members · {pct(n, allMembers)} of all members</p>
              <CityList cities={cities} total={n} />
            </div>
          );
        })()}
      </figure>
      <Panel icon={<Users className="h-4 w-4" aria-hidden="true" />} label="Members in Kurdistan" total={total} of="approved members in five provinces"
        focus={focusId ? byId.get(focusId) : undefined} count={stats.length} onOpen={onOpen}
        tiers={tierCounts.canSee ? sumTiers(PROVINCE_IDS.map((id) => tierCounts.m.get(id))) : undefined} focusTiers={tierCounts.canSee && focusId ? (tierCounts.m.get(focusId) || sumTiers([])) : undefined}
        allMembers={allMembers} cities={focusId ? placeStats?.byCity?.[focusId] : undefined}
        hint="Choose a province on the map to see its members." />
    </div>
  );
};

/** The world, with our five countries abroad joined to Kurdistan. */
export const WorldMembersMap: React.FC<{ onOpen?: (slug: string) => void }> = ({ onOpen }) => {
  const stats = useGroupStats(ABROAD_IDS);
  const tierCounts = useTierCounts();
  const placeStats = usePlaceStats();
  const allMembers = useAllMembers();
  const kurdistanTotal = useGroupStats(PROVINCE_IDS).reduce((a, s) => a + s.members, 0);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const focusId = hover || selected;
  const byId = new Map(stats.map((s) => [s.council.id, s]));
  const nodes: Node[] = ABROAD_IDS.filter((id) => byId.has(id) && GLOBE_POINTS[id])
    .map((id) => ({ stat: byId.get(id)!, x: 0, y: 0 }));
  const total = stats.reduce((a, s) => a + s.members, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
      <figure className="relative m-0 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(ellipse_at_center,#13263a_0%,#07111c_70%)] p-2 text-white sm:p-4">
        <Globe3D
          places={nodes.map((n) => ({ id: n.stat.council.id, name: n.stat.council.name, lng: GLOBE_POINTS[n.stat.council.id][0], lat: GLOBE_POINTS[n.stat.council.id][1], iso: GLOBE_ISO[n.stat.council.id], members: n.stat.members, colour: n.stat.colour }))}
          home={{ name: 'Kurdistan', lng: 44.4, lat: 36.2, members: kurdistanTotal }}
          focusId={focusId} onHover={setHover} onPick={(id) => setSelected((v) => (v === id ? null : id))} />
        <Legend dark note="Drag the globe to turn it. Numbers are members in each country; Kurdistan shows its total. Lines join each country to Kurdistan. Natural Earth data." />
      </figure>
      <Panel icon={<Globe2 className="h-4 w-4" aria-hidden="true" />} label="Members abroad" total={total} of="approved members in five countries"
        focus={focusId ? byId.get(focusId) : undefined} count={stats.length} onOpen={onOpen}
        tiers={tierCounts.canSee ? sumTiers(ABROAD_IDS.map((id) => tierCounts.m.get(id))) : undefined} focusTiers={tierCounts.canSee && focusId ? (tierCounts.m.get(focusId) || sumTiers([])) : undefined}
        allMembers={allMembers} cities={focusId ? placeStats?.byCity?.[focusId] : undefined}
        hint="Choose a country on the map to see its members." />
    </div>
  );
};

/** Both maps, as shown on the home page. */
const MembersMaps: React.FC<{ onOpen?: (slug: string) => void }> = ({ onOpen }) => (
  <div className="space-y-10">
    <div>
      <h3 className="mb-4 text-[1.5rem] font-semibold">Kurdistan <span className="ku-sub ms-2 font-kurdish text-[1.25rem] font-normal text-muted" lang="ckb" dir="rtl" translate="no">کوردستان</span></h3>
      <KurdistanMembersMap onOpen={onOpen} />
    </div>
    <div>
      <h3 className="mb-4 text-[1.5rem] font-semibold">Around the world</h3>
      <WorldMembersMap onOpen={onOpen} />
    </div>
  </div>
);

export default MembersMaps;
