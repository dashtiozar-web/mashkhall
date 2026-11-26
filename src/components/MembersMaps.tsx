import React, { useEffect, useMemo, useState } from 'react';
import { useTiers } from '../lib/useTiers';
import placesConfig from '../config/administrations.json';
import { Globe3D } from './Globe3D';
import { useSvgZoom, ZoomControls } from './MapZoom';

const GLOBE_POINTS: Record<string, [number, number]> = { britain: [-1.8, 53.2], germany: [10.4, 51.1], usa: [-98, 39.5], canada: [-100, 56.5], australia: [134, -25.5] };
const GLOBE_ISO: Record<string, string> = { britain: '826', germany: '276', usa: '840', canada: '124', australia: '036' };

const ADMINISTRATIONS = placesConfig.administrations;
import { ArrowRight, Globe2, MapPin, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { councilStats, CouncilStat, GROWTH_DAYS, HEAT_LEGEND } from '../lib/councilStats';
import { ABROAD_IDS, COUNTRIES, PROVINCES, PROVINCE_IDS } from '../lib/places';
import { TIERS } from '../lib/tiers';

/*
 * Two live maps of where our members are: the five provinces of Kurdistan,
 * and the world, with the five countries abroad joined to Kurdistan. Colours
 * run from green (fewest members) to red (most) on each map.
 */

interface Node { stat: CouncilStat; x: number; y: number }

const kuName = (id: string) => PROVINCES.find((p) => p.id === id)?.ku || COUNTRIES.find((c) => c.id === id)?.ku || '';

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

/*
 * The Kurdistan map is the designed picture itself (public/images/kurdistan-members-map.jpg).
 * Live numbers are written into its buttons and diamonds at these points
 * (in the picture's 1536 × 1024 pixels), and motion is laid over it.
 */
const KMAP = { w: 1536, h: 1024 };
const KMAP_BUTTONS: Record<string, { x: number; y: number; r: number }> = {
  duhok: { x: 393, y: 233, r: 40 },
  erbil: { x: 727, y: 380, r: 38 },
  sulaymaniyah: { x: 943, y: 567, r: 58 },
  kirkuk: { x: 536, y: 623, r: 40 },
  halabja: { x: 1278, y: 671, r: 37 },
};
const KMAP_DIAMONDS: Record<string, { x: number; y: number; s: number }> = {
  zakho: { x: 270, y: 208, s: 17 },
  soran: { x: 776, y: 300, s: 19 },
  raparin: { x: 948, y: 420, s: 18 },
  garmiyan: { x: 1079, y: 817, s: 21 },
};
/** Golden lights of the network and along the map's edges, which twinkle. */
const KMAP_LIGHTS: [number, number][] = [
  [533, 862], [659, 935], [785, 905], [870, 858], [975, 945], [1470, 820], [598, 947], [466, 915], [393, 885], [1290, 905],
  [706, 172], [905, 296], [1368, 552], [1408, 708], [1110, 893], [152, 236], [458, 555], [840, 505],
];
/** Specks of golden dust drifting up through the light. */
const KMAP_DUST = Array.from({ length: 18 }, (_, i) => ({ x: 80 + ((i * 397) % 1400), y: 980 - ((i * 211) % 380), d: (i % 6) * 1.3, t: 9 + (i % 5) * 2 }));

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
  const order = ['duhok', 'erbil', 'sulaymaniyah', 'halabja', 'kirkuk'];
  const total = stats.reduce((a, s) => a + s.members, 0);
  const zoom = useSvgZoom(KMAP.w, KMAP.h);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
      <figure className="relative m-0 overflow-hidden rounded-3xl border border-[#3a2a12] bg-[#0b0906] text-white">
        <ZoomControls {...zoom.controls} />
        <svg viewBox={`0 0 ${KMAP.w} ${KMAP.h}`} role="group" aria-label="Map of the five provinces of Kurdistan showing our members"
          className="block h-auto w-full select-none" style={zoom.style} {...zoom.handlers}>
          <defs>
            <radialGradient id="km-face" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#000000" stopOpacity="0.45" />
            </radialGradient>
            <radialGradient id="km-sun" cx="78%" cy="8%" r="45%">
              <stop offset="0" stopColor="#FFB347" stopOpacity="0.55" />
              <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="km-spark">
              <stop offset="0" stopColor="#FFF4C2" />
              <stop offset="0.35" stopColor="#FFD36B" stopOpacity="0.9" />
              <stop offset="1" stopColor="#FFB000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="km-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFF1C8" stopOpacity="0" />
              <stop offset="0.5" stopColor="#FFF1C8" stopOpacity="0.16" />
              <stop offset="1" stopColor="#FFF1C8" stopOpacity="0" />
            </linearGradient>
            {/* The flags ripple in the wind */}
            <filter id="km-wave" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="3" result="t">
                <animate attributeName="baseFrequency" dur="7s" values="0.006 0.02;0.009 0.026;0.006 0.02" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="t" scale="14" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <clipPath id="km-flag-top"><path d="M0 0 H215 Q245 120 235 205 L0 150 Z" /></clipPath>
            <clipPath id="km-flag-bottom"><path d="M0 860 Q260 830 470 905 L520 1024 H0 Z" /></clipPath>
            <clipPath id="km-frame"><rect width={KMAP.w} height={KMAP.h} /></clipPath>
          </defs>
          <g clipPath="url(#km-frame)">
          <g transform={zoom.transform}>
          <g className="km-drift">
            <image href="/images/kurdistan-members-map.jpg" width={KMAP.w} height={KMAP.h} preserveAspectRatio="none" />
            <g className="km-flag" aria-hidden="true">
              <image href="/images/kurdistan-members-map.jpg" width={KMAP.w} height={KMAP.h} clipPath="url(#km-flag-top)" filter="url(#km-wave)" />
              <image href="/images/kurdistan-members-map.jpg" width={KMAP.w} height={KMAP.h} clipPath="url(#km-flag-bottom)" filter="url(#km-wave)" />
            </g>
            {/* The sunset breathing behind the citadel, and light passing over the land */}
            <rect width={KMAP.w} height={KMAP.h} fill="url(#km-sun)" className="km-sunset" pointerEvents="none" style={{ mixBlendMode: 'screen' }} />
            <g transform="skewX(-16)" pointerEvents="none" aria-hidden="true" style={{ mixBlendMode: 'screen' }}>
              <rect x={-420} y={-60} width={300} height={KMAP.h + 120} fill="url(#km-sheen)" className="km-sheen" />
            </g>
            <g pointerEvents="none" aria-hidden="true">
              {KMAP_LIGHTS.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={14} fill="url(#km-spark)" className="mm-twinkle" style={{ animationDelay: `${(i % 7) * 0.55}s`, mixBlendMode: 'screen' }} />
              ))}
              {KMAP_DUST.map((d, i) => (
                <circle key={`d${i}`} cx={d.x} cy={d.y} r={2.4} fill="#FFD36B" className="km-dust" style={{ animationDelay: `${d.d}s`, animationDuration: `${d.t}s` }} />
              ))}
            </g>
            {/* The live number of members on each province's button */}
            {order.map((id, i) => {
              const b = KMAP_BUTTONS[id];
              const st = byId.get(id);
              if (!b || !st) return null;
              const on = focusId === id;
              return (
                <g key={id} role="button" tabIndex={0} aria-label={`${st.council.name}: ${st.members} members, ranked ${st.rank}`} aria-pressed={selected === id}
                  className="cursor-pointer focus:outline-none"
                  onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(id)} onBlur={() => setHover(null)}
                  onClick={() => setSelected(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id); } }}>
                  <circle cx={b.x} cy={b.y} r={b.r * 1.15} fill="none" stroke={st.colour} strokeWidth={5} className="km-ring" style={{ animationDelay: `${i * 0.5}s` }} />
                  <circle cx={b.x} cy={b.y} r={b.r * 0.8} fill={st.colour} />
                  <circle cx={b.x} cy={b.y} r={b.r * 0.8} fill="#001a05" fillOpacity={0.38} />
                  <circle cx={b.x} cy={b.y} r={b.r * 0.8} fill="url(#km-face)" />
                  {on && <circle cx={b.x} cy={b.y} r={b.r * 1.08} fill="none" stroke="#FFF3C4" strokeWidth={4} />}
                  <text x={b.x} y={b.y + b.r * 0.33} textAnchor="middle" className="pointer-events-none fill-white font-sans font-bold"
                    style={{ fontSize: b.r * (st.members > 99 ? 0.62 : st.members > 9 ? 0.78 : 0.95), paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 3 }}>{st.members}</text>
                </g>
              );
            })}
            {/* Independent administrations: Raparin, Garmiyan, Zakho and Soran */}
            {ADMINISTRATIONS.map((a) => {
              const d = KMAP_DIAMONDS[a.id];
              if (!d) return null;
              const n = placeStats?.byAdministration?.[a.id] || 0;
              const on = focusAdm === a.id;
              return (
                <g key={a.id} role="button" tabIndex={0} className="cursor-pointer focus:outline-none" aria-label={`${a.name} independent administration: ${n} members`}
                  onMouseEnter={() => setFocusAdm(a.id)} onMouseLeave={() => setFocusAdm(null)} onFocus={() => setFocusAdm(a.id)} onBlur={() => setFocusAdm(null)}
                  onClick={() => setFocusAdm(a.id)}>
                  <rect x={d.x - d.s} y={d.y - d.s} width={d.s * 2} height={d.s * 2} rx={3} transform={`rotate(45 ${d.x} ${d.y})`} fill="#050505" stroke={on ? '#FFD873' : 'none'} strokeWidth={4} />
                  <text x={d.x} y={d.y + d.s * 0.45} textAnchor="middle" className="pointer-events-none fill-white font-sans font-bold" style={{ fontSize: d.s * 1.25 }}>{n}</text>
                </g>
              );
            })}
          </g>
          </g>
          </g>
        </svg>
        <p className="px-4 py-3 text-[0.75rem] text-white/70">Numbers are live: circles show the members in each province, diamonds the independent administrations of Raparin, Garmiyan, Zakho and Soran. Use + and − to zoom; drag to move the map when zoomed in.</p>
        {focusAdm && (() => {
          const a = ADMINISTRATIONS.find((x) => x.id === focusAdm)!;
          const n = placeStats?.byAdministration?.[a.id] || 0;
          const prov = placeStats?.byCity?.[a.province] || {};
          const cities: Record<string, number> = Object.fromEntries(Object.entries(prov).filter(([c]) => a.cities.some((x) => x.toLowerCase() === c.toLowerCase())));
          return (
            <div className="mx-2 mt-3 rounded-2xl border border-line bg-surface p-4 text-ink">
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
  const [globeZoom, setGlobeZoom] = useState(1);
  const zoomGlobe = (k: number) => setGlobeZoom(Math.min(4, Math.max(1, Math.round(k * 100) / 100)));
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
        <ZoomControls onIn={() => zoomGlobe(globeZoom * 1.5)} onOut={() => zoomGlobe(globeZoom / 1.5)} onReset={() => setGlobeZoom(1)}
          canIn={globeZoom < 4} canOut={globeZoom > 1} zoomed={globeZoom > 1} />
        <Globe3D zoom={globeZoom}
          places={nodes.map((n) => ({ id: n.stat.council.id, name: n.stat.council.name, lng: GLOBE_POINTS[n.stat.council.id][0], lat: GLOBE_POINTS[n.stat.council.id][1], iso: GLOBE_ISO[n.stat.council.id], members: n.stat.members, colour: n.stat.colour }))}
          home={{ name: 'Kurdistan', lng: 44.4, lat: 36.2, members: kurdistanTotal }}
          focusId={focusId} onHover={setHover} onPick={(id) => setSelected((v) => (v === id ? null : id))} />
        <Legend dark note="Drag the globe to turn it; use + and − to zoom. Numbers are members in each country; Kurdistan shows its total. Lines join each country to Kurdistan. Natural Earth data." />
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
