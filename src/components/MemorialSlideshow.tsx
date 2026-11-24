import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

/**
 * A slow, dignified slideshow for the memorial. One slide at a time, with
 * previous, next, pause and play. It never starts moving for people who
 * prefer reduced motion, pauses while it is hovered or focused, and pauses
 * for good once someone uses the controls, so text can always be read.
 */

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export interface SlideshowLabels {
  previous: string; next: string; pause: string; play: string; slide: (n: number, total: number) => string; region: string;
}

export const MemorialSlideshow: React.FC<{
  slides: { key: string; label: string; node: React.ReactNode }[];
  intervalMs?: number;
  labels: SlideshowLabels;
  dir: 'ltr' | 'rtl';
  className?: string;
  /** Small labels under the controls (e.g. dates) to jump to a slide. */
  showIndex?: boolean;
}> = ({ slides, intervalMs = 10000, labels, dir, className = '', showIndex = true }) => {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [hold, setHold] = useState(false);
  const total = slides.length;
  const timer = useRef<number | null>(null);

  const go = useCallback((n: number) => setI(((n % total) + total) % total), [total]);

  useEffect(() => {
    if (!playing || hold || total < 2) return;
    timer.current = window.setTimeout(() => go(i + 1), intervalMs);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, playing, hold, total, intervalMs, go]);

  useEffect(() => { if (i >= total) setI(0); }, [total, i]);

  const onKey = (e: React.KeyboardEvent) => {
    const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === fwd) { e.preventDefault(); setPlaying(false); go(i + 1); }
    if (e.key === back) { e.preventDefault(); setPlaying(false); go(i - 1); }
  };

  if (!total) return null;
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const btn = 'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/25 text-white hover:border-white/60 hover:bg-white/10 focus-visible:outline-amber';

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      dir={dir}
      onKeyDown={onKey}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
      className={`memorial-slideshow relative ${className}`}
    >
      <div className="relative" aria-live={playing && !hold ? 'off' : 'polite'}>
        {slides.map((s, n) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${labels.slide(n + 1, total)}: ${s.label}`}
            aria-hidden={n !== i}
            className={`memorial-slide ${n === i ? 'is-current' : ''}`}
          >
            {n === i || Math.abs(n - i) <= 1 ? s.node : null}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={btn} onClick={() => { setPlaying(false); go(i - 1); }} aria-label={labels.previous}><Prev className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" className={btn} onClick={() => setPlaying((p) => !p)} aria-label={playing ? labels.pause : labels.play} aria-pressed={!playing}>
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button type="button" className={btn} onClick={() => { setPlaying(false); go(i + 1); }} aria-label={labels.next}><Next className="h-5 w-5" aria-hidden="true" /></button>
        <span className="min-w-[4.5rem] text-center text-[0.9375rem] text-white/70 tabular-nums" aria-hidden="true" dir="ltr">{i + 1} / {total}</span>
      </div>
      {showIndex && total > 1 && (
        <ol className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label={labels.region}>
          {slides.map((s, n) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => { setPlaying(false); go(n); }}
                aria-current={n === i ? 'true' : undefined}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-[0.8125rem] tabular-nums ${n === i ? 'bg-[#B3261E] text-white' : 'text-white/65 hover:text-white'}`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
