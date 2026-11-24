import React from 'react';

/**
 * Blood running from the red band of the 17 Shubat calendar leaf, for the
 * martyrs of the 17 February 2011 demonstrations. It never stops: each drip
 * keeps swelling and drops keep falling down the page, because those
 * responsible have still not been brought to justice and the martyrs are not
 * forgotten.
 */

export interface Drip { x: number; w: number; len: number }

/** The drips, in a 340-wide drawing. */
export const DRIPS: Drip[] = [
  { x: 34, w: 5, len: 30 },
  { x: 86, w: 3.4, len: 14 },
  { x: 132, w: 6.2, len: 56 },
  { x: 196, w: 4, len: 22 },
  { x: 250, w: 5.6, len: 42 },
  { x: 304, w: 3.2, len: 12 },
];

/** Seconds for one drop to form and fall, per drip (different so they never fall together). */
const CYCLE = [10, 12.5, 9, 13.5, 11, 14.5];

/** Outline of one drip hanging from y = 0. */
export const dripPath = ({ x, w, len }: Drip) => {
  const b = 2;
  return `M${x + w * 1.9},0 C${x + w * 1.1},${b} ${x + w},${b + w * 0.6} ${x + w},${b + w * 1.6} L${x + w},${len} A${w} ${w} 0 0 1 ${x - w},${len} L${x - w},${b + w * 1.6} C${x - w},${b + w * 0.6} ${x - w * 1.1},${b} ${x - w * 1.9},0 Z`;
};

/** Height of the drawing: room for drops to fall the length of the leaf. */
const HEIGHT = 300;

export const BleedingEdge: React.FC<{ className?: string; animate?: boolean }> = ({ className = '', animate = true }) => (
  <svg viewBox={`0 0 340 ${HEIGHT}`} className={`pointer-events-none ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="blood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#C8102E" />
        <stop offset="1" stopColor="#8E0B20" />
      </linearGradient>
    </defs>
    {/* A thin, uneven seam where the band meets the page. */}
    <path d="M0,0 H340 V2.2 C300,3.4 270,1.6 240,2.8 C200,4 170,1.8 130,3.2 C90,4.2 60,1.6 0,2.6 Z" fill="#C8102E" />
    {DRIPS.map((d, i) => {
      const t = CYCLE[i % CYCLE.length];
      // Start part-way through each cycle so blood is already running when the page opens.
      const delay = `${-((i * 3.7) % t)}s`;
      const fall = HEIGHT - d.len - 10;
      return (
        <g key={i}>
          <g className={animate ? 'bleed-stem' : ''} style={{ animationDuration: `${t}s`, animationDelay: delay }}>
            <path d={dripPath(d)} fill="url(#blood)" />
            <circle cx={d.x} cy={d.len} r={d.w * 1.12} fill="#9E0C24" />
          </g>
          {animate && (
            <g className="bleed-drop" style={{ animationDuration: `${t}s`, animationDelay: delay, ['--fall' as string]: `${fall}px` }}>
              <path
                d={`M${d.x},${d.len - d.w * 1.6} C${d.x + d.w * 0.6},${d.len - d.w * 0.4} ${d.x + d.w * 1.15},${d.len + d.w * 0.4} ${d.x},${d.len + d.w * 1.3} C${d.x - d.w * 1.15},${d.len + d.w * 0.4} ${d.x - d.w * 0.6},${d.len - d.w * 0.4} ${d.x},${d.len - d.w * 1.6} Z`}
                fill="#9E0C24"
              />
              <ellipse cx={d.x - d.w * 0.3} cy={d.len - d.w * 0.1} rx={d.w * 0.22} ry={d.w * 0.38} fill="#ffffff" fillOpacity="0.4" />
            </g>
          )}
        </g>
      );
    })}
  </svg>
);
