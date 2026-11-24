import React, { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

/**
 * The homepage cover: animated scenes of Kurdistan, one after another — the
 * Citadel of Erbil, Sulaymaniyah, Halabja, Duhok, Amedi, the Qandil and
 * Zagros mountains and Kirkuk — each with the flag of Kurdistan waving under
 * the turning sun. Each scene moves by itself (public/kurdistan/*.svg);
 * visitors who prefer less motion see them still and can pause or choose one.
 */

export const KURDISTAN_SCENES: { id: string; name: string; ku: string }[] = [
  { id: 'erbil', name: 'The Citadel of Erbil', ku: 'قەڵای هەولێر' },
  { id: 'sulaymaniyah', name: 'Sulaymaniyah', ku: 'سلێمانی' },
  { id: 'halabja', name: 'Halabja', ku: 'هەڵەبجە' },
  { id: 'duhok', name: 'Duhok', ku: 'دهۆک' },
  { id: 'amedi', name: 'Amedi', ku: 'ئامێدی' },
  { id: 'qandil', name: 'The Qandil Mountains', ku: 'چیای قەندیل' },
  { id: 'kirkuk', name: 'Kirkuk', ku: 'کەرکووک' },
  { id: 'zagros', name: 'The Zagros Mountains', ku: 'زنجیرە چیاکانی زاگرۆس' },
];

const SLIDE_MS = 12_000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export const KurdistanCover: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const n = KURDISTAN_SCENES.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % n), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, n]);

  const current = KURDISTAN_SCENES[index];
  return (
    <>
      <div className="absolute inset-0 overflow-hidden bg-[#1F100B]" aria-hidden="true">
        {KURDISTAN_SCENES.map((s, i) => {
          const active = i === index;
          const near = i === (index + 1) % n;
          if (!active && !near) return null;
          return (
            <img
              key={s.id}
              src={`/kurdistan/${s.id}.svg`}
              alt=""
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1800ms] ease-in-out ${active ? 'opacity-100' : 'opacity-0'}`}
            />
          );
        })}
        {/* Keeps the words readable over every scene. */}
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[#1F100B]/88 via-[#1F100B]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1F100B]/75 to-transparent" />
      </div>
      <div className="absolute end-4 bottom-5 start-4 z-10 flex items-end justify-between gap-4 sm:end-6 sm:start-auto sm:justify-end">
        <p className="min-w-0 text-end text-[0.8125rem] leading-snug text-white/85" aria-live="polite">
          <span className="block font-semibold text-white">{current.name}</span>
          <span className="ku-sub block font-kurdish text-[0.9375rem] text-[#F2C14E]" lang="ckb" dir="rtl" translate="no">{current.ku}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-sm">
          {KURDISTAN_SCENES.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setIndex(i)}
              aria-label={`Show ${s.name}`} aria-current={i === index}
              className={`h-2.5 cursor-pointer rounded-full transition-all ${i === index ? 'w-6 bg-[#F2C14E]' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />
          ))}
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the scenes of Kurdistan' : 'Pause the scenes of Kurdistan'}
            className="ms-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/15">
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  );
};
