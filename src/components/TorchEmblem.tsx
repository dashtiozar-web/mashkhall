import React, { useEffect, useId, useState } from 'react';

/**
 * The Mashkhally Zhyanawa emblem: the hand raising a burning torch, in
 * front of the slowly turning sun of Kurdistan. Motion stops for visitors who ask their system for
 * reduced motion.
 */


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
          <stop offset="0" stopColor="#FEBD11" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#E9A12A" stopOpacity="0.1" />
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

const STILL = '/brand/torch-still.webp';
const VIDEO = '/brand/torch-anim.webm';
const ANIMATED_IMAGE = '/brand/torch-anim.webp';

/** Safari cannot show the transparent video, so it gets the animated image instead. */
const isSafari = () => {
  try { return /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent); } catch { return false; }
};

/**
 * The logo: the hand raising the torch, its fire burning and sending up
 * sparks, on a transparent background (a looping video; an animated image
 * on Safari; a still picture for visitors who prefer less motion).
 */
export const AnimatedTorch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const reduced = useReducedMotion();
  const [safari] = useState(isSafari);
  const cls = `aspect-[720/1020] object-contain object-bottom ${className}`;
  if (reduced) return <img src={STILL} alt="" aria-hidden="true" className={cls} />;
  if (safari) return <img src={ANIMATED_IMAGE} alt="" aria-hidden="true" className={cls} />;
  return (
    <video autoPlay muted loop playsInline preload="auto" poster={STILL} aria-hidden="true" disablePictureInPicture className={cls}>
      <source src={VIDEO} type="video/webm" />
    </video>
  );
};

/** Torch in front of the turning sun, framed: the home page and app splash emblem. */
export const TorchEmblem: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_50%_30%,#5C1F0E_0%,#2A110A_55%,#140906_100%)] ${className}`}>
    <SunBurst className="absolute inset-0 -z-10" />
    <AnimatedTorch className="absolute inset-x-0 bottom-0 mx-auto h-[97%] w-full" />
  </div>
);
