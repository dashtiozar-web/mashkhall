import React, { useMemo, useState } from 'react';
import world from '../data/worldMap.json';
import { placeName } from '../lib/visits';
import { Flag } from './Flag';

/**
 * World map of visits by country: the darker the country, the more visits.
 * Countries too small to draw at this scale (and any without an outline)
 * still appear in the table next to the map. Hover or focus a country for
 * its figures.
 */

const MAP = world as unknown as { width: number; height: number; shapes: Record<string, string>; centres: Record<string, [number, number]> };

/** Five steps from pale amber to deep crimson. */
const STEPS = ['#F3D9A4', '#EDB25F', '#E07E35', '#C4511F', '#8E1A24'];

export interface MapDatum { code: string; visits: number; people: number }

export const WorldMap: React.FC<{ data: MapDatum[]; metric?: 'visits' | 'people'; selected?: string | null; onSelect?: (code: string | null) => void }> = ({ data, metric = 'visits', selected, onSelect }) => {
  const [hover, setHover] = useState<string | null>(null);
  const byCode = useMemo(() => new Map(data.map((d) => [d.code, d])), [data]);
  const max = Math.max(1, ...data.map((d) => d[metric]));

  // A log scale keeps one very busy country from washing out the rest.
  const colour = (v: number) => {
    if (!v) return 'var(--map-empty)';
    const t = Math.log(v + 1) / Math.log(max + 1);
    return STEPS[Math.min(STEPS.length - 1, Math.floor(t * STEPS.length))];
  };

  const focus = hover || selected || null;
  const focused = focus ? byCode.get(focus) : undefined;
  // Small countries without an outline get a dot at their position, if known.
  const dots = data.filter((d) => d[metric] > 0 && !MAP.shapes[d.code] && MAP.centres[d.code]);

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-xl border border-line bg-[var(--map-land)]">
        <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="block h-auto w-full" role="img"
          aria-label={`World map of visits by country: ${data.filter((d) => d[metric] > 0).length} countries.`}>
          {Object.entries(MAP.shapes).map(([code, d]) => {
            const v = byCode.get(code)?.[metric] || 0;
            const active = focus === code;
            return (
              <path
                key={code}
                d={d}
                fill={colour(v)}
                stroke={active ? 'var(--c-navy)' : 'var(--map-halo)'}
                strokeWidth={active ? 1.6 : 0.5}
                className={v ? 'cursor-pointer outline-none' : ''}
                tabIndex={v ? 0 : -1}
                aria-label={v ? `${placeName(code)}: ${byCode.get(code)!.visits} visits` : undefined}
                onMouseEnter={() => setHover(code)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(code)}
                onBlur={() => setHover(null)}
                onClick={() => v && onSelect?.(selected === code ? null : code)}
              />
            );
          })}
          {dots.map((d) => (
            <circle key={d.code} cx={MAP.centres[d.code][0]} cy={MAP.centres[d.code][1]} r={4} fill={colour(d[metric])} stroke="var(--c-navy)" strokeWidth={0.8} />
          ))}
        </svg>
        {focus && (
          <div className="pointer-events-none absolute top-3 start-3 rounded-lg border border-line bg-surface/95 px-3 py-2 text-[0.875rem] shadow-sm">
            <p className="font-semibold"><span aria-hidden="true"><Flag code={focus} /></span> {placeName(focus)}</p>
            {focused ? (
              <p className="tabular-nums text-ink-soft"><span>{focused.visits.toLocaleString('en-GB')}</span> <span>visits</span> · <span>{focused.people.toLocaleString('en-GB')}</span> <span>visitors</span></p>
            ) : <p className="text-muted">No visits in this period</p>}
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
        <span>Fewer</span>
        <span className="flex overflow-hidden rounded-sm" aria-hidden="true">{STEPS.map((c) => <span key={c} className="h-2.5 w-7" style={{ background: c }} />)}</span>
        <span>More visits</span>
        <span className="ms-auto">Estimated from network location; not exact.</span>
      </figcaption>
    </figure>
  );
};
