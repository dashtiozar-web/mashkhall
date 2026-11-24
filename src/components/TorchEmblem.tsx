import React, { useEffect, useId, useState } from 'react';

/**
 * The Mashkhally Zhyanawa emblem: the painted hand raising a torch, with a
 * living flame (gently displaced and swaying) in front of the slowly turning
 * sun of Kurdistan. Motion stops for visitors who ask their system for
 * reduced motion.
 */

const TORCH_SRC = '/brand/torch.webp';

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return; }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
};

/**
 * Behind the torch: the sun of the Kurdistan flag, 21 long golden rays
 * turning very slowly, with a soft light that breathes at its centre.
 */
export const SunBurst: React.FC<{ className?: string }> = ({ className = '' }) => {
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const rays = Array.from({ length: 21 }, (_, i) => {
    const a = (i / 21) * Math.PI * 2 - Math.PI / 2;
    const da = (Math.PI / 21) * 0.42;
    const r = 1400;
    const p = (ang: number, rad: number) => `${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`;
    return `M${p(a - 0.012, 40)} L${p(a - da, r)} L${p(a + da, r)} L${p(a + 0.012, 40)} Z`;
  }).join(' ');
  return (
    <svg viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={`pointer-events-none block h-full w-full ${className}`}>
      <defs>
        <radialGradient id={`${id}-ray`} cx="0" cy="0" r="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEBD11" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#E9A12A" stopOpacity="0.22" />
          <stop offset="1" stopColor="#B8461C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx="0" cy="0" r="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD873" stopOpacity="0.65" />
          <stop offset="0.5" stopColor="#F08A2E" stopOpacity="0.2" />
          <stop offset="1" stopColor="#B8461C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(0 -110)">
        <g className={reduced ? '' : 'sunburst-spin'}>
          <path d={rays} fill={`url(#${id}-ray)`} />
        </g>
        <circle r="330" fill={`url(#${id}-core)`} className={reduced ? '' : 'torch-glow'} />
        <circle r="250" fill="none" stroke="#FEBD11" strokeOpacity="0.28" strokeWidth="1.5" />
        <circle r="268" fill="none" stroke="#FEBD11" strokeOpacity="0.14" strokeWidth="1" />
      </g>
    </svg>
  );
};

/** The painted torch with a moving flame (SVG turbulence and a slow sway). */
export const AnimatedTorch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 800 1344" className={className} aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={`${id}-fg`} x1="0" y1="0" x2="0" y2="1344" gradientUnits="userSpaceOnUse">
          <stop offset="0.37" stopColor="#fff" />
          <stop offset="0.47" stopColor="#000" />
        </linearGradient>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1344" gradientUnits="userSpaceOnUse">
          <stop offset="0.37" stopColor="#000" />
          <stop offset="0.47" stopColor="#fff" />
        </linearGradient>
        <mask id={`${id}-flame`} maskUnits="userSpaceOnUse" x="-100" y="-100" width="1000" height="1544">
          <rect x="-100" y="-100" width="1000" height="1544" fill={`url(#${id}-fg)`} />
        </mask>
        <mask id={`${id}-body`} maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="1344">
          <rect width="800" height="1344" fill={`url(#${id}-bg)`} />
        </mask>
        <radialGradient id={`${id}-glow`} cx="400" cy="300" r="380" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD36B" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#F07A2A" stopOpacity="0.22" />
          <stop offset="1" stopColor="#C2361A" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-fire`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.028" numOctaves="2" seed="7" result="noise">
            {!reduced && (
              <animate attributeName="baseFrequency" dur="3.2s" repeatCount="indefinite"
                values="0.009 0.028;0.012 0.040;0.008 0.032;0.009 0.028" />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <ellipse cx="400" cy="320" rx="380" ry="360" fill={`url(#${id}-glow)`} className={reduced ? '' : 'torch-glow'} />
      <image href={TORCH_SRC} width="800" height="1344" mask={`url(#${id}-body)`} />
      <g mask={`url(#${id}-flame)`}>
        <g className={reduced ? '' : 'torch-flame'}>
          <image href={TORCH_SRC} width="800" height="1344" filter={`url(#${id}-fire)`} />
        </g>
      </g>
    </svg>
  );
};

/** Torch in front of the turning sun, framed: the home page and app splash emblem. */
export const TorchEmblem: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_50%_30%,#5C1F0E_0%,#2A110A_55%,#140906_100%)] ${className}`}>
    <SunBurst className="absolute inset-0 -z-10" />
    <AnimatedTorch className="absolute inset-x-0 bottom-0 mx-auto h-[97%] w-full" />
  </div>
);
