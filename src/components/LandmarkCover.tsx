import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { CityChapter } from '../types';
import { landmarkName } from '../lib/landmarks';
import { useLandmarkPhoto } from './LandmarkImage';

const SLIDE_MS = 20_000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Saves mobile data: no videos with Data Saver on or on a slow connection. */
const videosAllowed = () => {
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !(c?.saveData || /(^|-)2g$/.test(c?.effectiveType || '')) && !prefersReducedMotion();
};

const Layer: React.FC<{ council: CityChapter; active: boolean; near: boolean; still: boolean; allowVideo: boolean; cycle: number }> = ({ council, active, near, still, allowVideo, cycle }) => {
  const { src, failed } = useLandmarkPhoto(council);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const useVideo = Boolean(allowVideo && council.coverVideoUrl && !videoFailed);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) { v.currentTime = 0; v.play().catch(() => undefined); } else v.pause();
  }, [active, cycle]);

  // Only the current and next slides are loaded, to save data.
  if (!near && !active) return null;
  return (
    <div className={`absolute inset-0 transition-opacity duration-[1600ms] ease-in-out ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
      {src && (
        <img
          key={`${src}-${active ? cycle : 'idle'}`}
          src={src}
          alt=""
          onError={failed}
          referrerPolicy="no-referrer"
          className={`h-full w-full object-cover ${active && !still && !useVideo ? 'cover-drift' : ''}`}
        />
      )}
      {useVideo && (
        <video
          ref={videoRef}
          src={council.coverVideoUrl}
          muted
          playsInline
          loop
          preload={active ? 'auto' : 'metadata'}
          poster={src || undefined}
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
};

/**
 * The homepage cover: each council's landmarks in turn, 20 seconds each,
 * fading from one to the next and starting again after the last. A council
 * with a cover video plays it; otherwise its landmark photo moves slowly.
 * Visitors who prefer less motion see still photos; they and anyone else can
 * pause it or choose a city.
 */
export const LandmarkCover: React.FC<{ councils: CityChapter[] }> = ({ councils }) => {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [still] = useState(prefersReducedMotion);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [allowVideo] = useState(videosAllowed);
  const n = councils.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => { setIndex((i) => (i + 1) % n); setCycle((c) => c + 1); }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, n]);

  if (!n) return null;
  const current = councils[index % n];

  return (
    <>
      <div className="absolute inset-0 overflow-hidden bg-[#0B1830]">
        {councils.map((c, i) => (
          <Layer key={c.id} council={c} active={i === index % n} near={i === (index + 1) % n} still={still} allowVideo={allowVideo} cycle={cycle} />
        ))}
        {/* Keeps the words readable over any photo. */}
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[#0B1830]/90 via-[#0B1830]/65 to-[#0B1830]/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0B1830]/70 to-transparent" />
      </div>
      <div className="absolute end-4 bottom-5 start-4 z-10 flex items-end justify-between gap-4 sm:end-6 sm:start-auto sm:justify-end">
        <p className="min-w-0 text-end text-[0.8125rem] leading-snug text-white/85" aria-live="polite">
          <span className="block font-semibold text-white">{current.name} Council</span>
          <span className="block truncate">{landmarkName(current)}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-sm">
          {councils.map((c, i) => (
            <button key={c.id} type="button" onClick={() => { setIndex(i); setCycle((x) => x + 1); }}
              aria-label={`Show ${c.name}`} aria-current={i === index % n}
              className={`h-2.5 cursor-pointer rounded-full transition-all ${i === index % n ? 'w-6 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />
          ))}
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the city photos' : 'Pause the city photos'}
            className="ms-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/15">
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  );
};
