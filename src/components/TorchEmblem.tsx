import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * The Mashkhally Zhyanawa emblem: the painted hand raising a torch, with a
 * living flame (gently displaced and swaying) in front of a curtain of fire
 * that falls from top to bottom. Motion stops for visitors who ask their
 * system for reduced motion, and the fire pauses while it is off screen.
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

interface Flame {
  x: number; y: number; vy: number; size: number; age: number; life: number; phase: number; sway: number;
}

/** Tongues of fire drifting down from the top edge, drawn on a canvas. */
export const FireRain: React.FC<{ className?: string; density?: number }> = ({ className = '', density = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = true;
    const flames: Flame[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (anywhere = false): Flame => {
      const size = (9 + Math.random() * 26) * Math.max(0.7, Math.min(1.4, w / 360));
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -size * 2,
        vy: 35 + Math.random() * 70,
        size,
        age: 0,
        life: (h + size * 3) / 60 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        sway: 6 + Math.random() * 18,
      };
    };
    const target = () => Math.round((w * h) / 3600 * density);

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(1.5px)';
      while (flames.length < target()) flames.push(spawn(flames.length === 0 || last === 0));
      for (let i = flames.length - 1; i >= 0; i--) {
        const f = flames[i];
        f.age += dt;
        f.y += f.vy * dt;
        const k = Math.min(1, f.y / Math.max(1, h)); // 0 at the top, 1 at the bottom
        if (f.y - f.size * 2 > h || f.age > f.life) { flames[i] = spawn(); continue; }
        const x = f.x + Math.sin(f.age * 2.2 + f.phase) * f.sway;
        const flick = 0.75 + 0.25 * Math.sin(f.age * 13 + f.phase * 3);
        const s = f.size * (1 - k * 0.45) * flick;
        // Yellow at the top, through orange, to deep red as it falls.
        const r = 255, g = Math.round(205 - 150 * k), b = Math.round(90 - 70 * k);
        const a = (0.7 - k * 0.35) * flick;
        // A tongue of flame: hot, wide base; narrow tip that licks from side to side.
        const tip = Math.sin(f.age * 7 + f.phase) * s * 0.55;
        const lick = Math.sin(f.age * 11 + f.phase * 2) * s * 0.18;
        ctx.save();
        ctx.translate(x, f.y);
        const grad = ctx.createLinearGradient(0, -s * 3.2, 0, s * 0.9);
        grad.addColorStop(0, `rgba(${Math.round(200 - 60 * k)},${Math.round(40 - 20 * k)},10,0)`);
        grad.addColorStop(0.35, `rgba(${r},${Math.round(g * 0.55)},${Math.round(b * 0.3)},${a * 0.55})`);
        grad.addColorStop(0.72, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(0.9, `rgba(255,${Math.min(255, g + 50)},${Math.min(255, b + 90)},${a})`);
        grad.addColorStop(1, `rgba(${r},${Math.round(g * 0.6)},20,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(tip, -s * 3.2);
        ctx.bezierCurveTo(tip * 0.6 + s * 0.25 + lick, -s * 2, s * 0.95, -s * 0.9, s * 0.75, s * 0.2);
        ctx.quadraticCurveTo(s * 0.45, s * 0.9, 0, s * 0.9);
        ctx.quadraticCurveTo(-s * 0.45, s * 0.9, -s * 0.75, s * 0.2);
        ctx.bezierCurveTo(-s * 0.95, -s * 0.9, tip * 0.6 - s * 0.25 + lick, -s * 2, tip, -s * 3.2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    };

    const loop = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      draw(dt);
      if (visible && !reduced) raf = requestAnimationFrame(loop);
    };
    const start = () => { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop); };

    resize();
    if (reduced) {
      for (let i = 0; i < 90; i++) draw(0.05);
    } else start();

    const ro = new ResizeObserver(() => { resize(); if (reduced) draw(0); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting && !document.hidden;
      if (visible && !was && !reduced) start();
    });
    io.observe(canvas);
    const onVis = () => {
      const was = visible;
      visible = !document.hidden;
      if (visible && !was && !reduced) start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [reduced, density]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none block h-full w-full ${className}`} />;
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

/** Torch in front of falling fire, framed: the home page and app splash emblem. */
export const TorchEmblem: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_50%_30%,#5C1F0E_0%,#2A110A_55%,#140906_100%)] ${className}`}>
    <FireRain className="absolute inset-0 -z-10" />
    <AnimatedTorch className="absolute inset-x-0 bottom-0 mx-auto h-[97%] w-full" />
  </div>
);
