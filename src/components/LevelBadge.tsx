import React from 'react';
import { LEVEL_COLOURS, levelFor } from '../lib/levels';

/** Small coloured badge with the member's activity level, e.g. "Silver II". */
export const LevelBadge: React.FC<{ points?: number; className?: string }> = ({ points = 0, className }) => {
  const { level } = levelFor(points);
  const c = LEVEL_COLOURS[level.group];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] font-bold whitespace-nowrap ${className || ''}`}
      style={{ background: c.bg, color: c.fg, boxShadow: `inset 0 0 0 1px ${c.ring}` }}
      title={`Activity level ${level.number} of 18`}
    >
      {level.name}
    </span>
  );
};

/** Level, points and a bar showing progress to the next level ("75/100 points"). */
export const LevelProgressCard: React.FC<{ points?: number; compact?: boolean }> = ({ points = 0, compact }) => {
  const p = levelFor(points);
  const c = LEVEL_COLOURS[p.level.group];
  return (
    <div className={compact ? '' : 'rounded-2xl border border-line bg-surface p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <LevelBadge points={points} className="text-[0.875rem]" />
          <span className="text-[0.9375rem] text-muted">Level {p.level.number} of 18</span>
        </p>
        <p className="text-[0.9375rem] font-semibold tabular-nums">{p.points.toLocaleString('en-GB')} points</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone" role="progressbar" aria-valuemin={0} aria-valuemax={p.levelSize || 100} aria-valuenow={p.intoLevel} aria-label="Progress to the next level">
        <div className="h-full rounded-full" style={{ width: `${Math.round(p.ratio * 100)}%`, background: c.ring }} />
      </div>
      <p className="mt-2 text-[0.875rem] text-ink-soft">
        {p.next ? <><strong className="tabular-nums">{p.intoLevel}/{p.levelSize}</strong> points towards {p.next.name}</> : 'Highest level reached. Thank you!'}
      </p>
    </div>
  );
};
