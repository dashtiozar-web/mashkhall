import React, { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { commons, LandmarkPhoto } from '../lib/landmarks';

/**
 * The homepage cover: photographs of Kurdistan, one after another, each
 * moving slowly (a gentle camera drift) and fading into the next — the
 * Citadel of Erbil, Sulaymaniyah, Halabja, Duhok, Amedi, the Qandil
 * mountains, Kirkuk, the mountains of Kurdistan and the flag of Kurdistan.
 * Freely licensed photographs from Wikimedia Commons, credited on screen; if
 * one cannot be loaded, the next photo of the same place is used. Visitors
 * who prefer less motion see still photos and can pause or choose one.
 */

interface Scene { id: string; name: string; ku: string; photos: LandmarkPhoto[] }

export const KURDISTAN_SCENES: Scene[] = [
  { id: 'erbil', name: 'The Citadel of Erbil', ku: 'قەڵای هەولێر', photos: [
    commons('The Citadel of Erbil, Hawler, Erbil Governorate, Iraq.jpg', 'Osama Shukir Muhammed Amin'),
    commons('View of the Erbil citadel in Erbil (Hawler, Arbil, Irbil) in the Kurdistan Region of Iraq.jpg', 'Levi Clancy'),
  ] },
  { id: 'sulaymaniyah', name: 'Sulaymaniyah', ku: 'سلێمانی', photos: [
    commons('Sulaymaniyah at Night.jpg', 'Sarbast T. Hameed'),
    commons('View of Sulaymaniyah (Sulaimani) City , Kurdistan.jpg', 'Diyar Muhammed'),
  ] },
  { id: 'halabja', name: 'Halabja', ku: 'هەڵەبجە', photos: [
    commons('Halabja Monument Museum (15947763505).jpg', 'Enno Lenze'),
    commons('Khurmal, Halabja.jpg', 'Hiwa Sherzad'),
  ] },
  { id: 'duhok', name: 'Duhok', ku: 'دهۆک', photos: [
    commons('Panorama of Duhok.jpg', 'Ahmadkurdi44'),
    commons('Duhok, Kurdistan, Iraq.JPG', 'Kovan kurdish'),
  ] },
  { id: 'amedi', name: 'Amedi', ku: 'ئامێدی', photos: [
    commons('Amedi in Dohuk Governorate, Kurdistan Region of Iraq 01.jpg'),
    commons('Amedi, Iraq - panoramio (5).jpg'),
  ] },
  { id: 'qandil', name: 'The Qandil Mountains', ku: 'چیای قەندیل', photos: [
    commons('Qandil mountain, Hajiawa, Kurdistan- Iraq.jpg', 'Wary Abdullah'),
    commons('Qandil Mountain- Raniya.jpg'),
  ] },
  { id: 'kirkuk', name: 'Kirkuk', ku: 'کەرکووک', photos: [
    commons('Aerial view of Kirkuk Citadel, Kirkuk, Iraq.jpg', 'Enasiqph'),
    commons('Shrine of Gok Cumbet, on the Kirkuk Citadel. Kurdistan and Iraq flags.jpg'),
  ] },
  { id: 'zagros', name: 'The Zagros Mountains', ku: 'زنجیرە چیاکانی زاگرۆس', photos: [
    commons('Mountains of Kurdistan in Erbil and Hakkari provinces.jpg', 'Khoshhat'),
    commons('Zagros Mountains from above.jpg', 'Chrisrabinson'),
  ] },
  { id: 'flag', name: 'The flag of Kurdistan', ku: 'ئاڵای کوردستان', photos: [
    commons('Kurdistan flag.jpg', 'Sarchia Khursheed'),
    commons('Kurdish flag Erbil.jpg', 'Giorgio Montersino'),
  ] },
];

const SLIDE_MS = 12_000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const Slide: React.FC<{ scene: Scene; active: boolean; still: boolean; cycle: number; onPhoto: (p?: LandmarkPhoto) => void }> = ({ scene, active, still, cycle, onPhoto }) => {
  const [n, setN] = useState(0);
  const photo = scene.photos[n];
  useEffect(() => { if (active) onPhoto(photo); }, [active, photo, onPhoto]);
  if (!photo) return null;
  return (
    <img
      key={`${photo.url}-${active ? cycle : 'idle'}`}
      src={photo.url}
      alt=""
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setN((i) => i + 1)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1800ms] ease-in-out ${active ? 'opacity-100' : 'opacity-0'} ${active && !still ? 'cover-drift' : ''}`}
    />
  );
};

export const KurdistanCover: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [still] = useState(prefersReducedMotion);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [photo, setPhoto] = useState<LandmarkPhoto | undefined>();
  const n = KURDISTAN_SCENES.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => { setIndex((i) => (i + 1) % n); setCycle((c) => c + 1); }, SLIDE_MS);
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
          return <Slide key={s.id} scene={s} active={active} still={still} cycle={cycle} onPhoto={setPhoto} />;
        })}
        {/* Keeps the words readable over every photograph. */}
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[#1F100B]/90 via-[#1F100B]/55 to-[#1F100B]/20" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1F100B]/85 to-transparent" />
      </div>
      <div className="absolute end-4 bottom-5 start-4 z-10 flex items-end justify-between gap-4 sm:end-6 sm:start-auto sm:justify-end">
        <p className="min-w-0 text-end text-[0.8125rem] leading-snug text-white/85" aria-live="polite">
          <span className="block font-semibold text-white">{current.name}</span>
          <span className="ku-sub block font-kurdish text-[0.9375rem] text-[#F2C14E]" lang="ckb" dir="rtl" translate="no">{current.ku}</span>
          {photo && (
            <a href={photo.source} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[0.6875rem] text-white/60 underline-offset-2 hover:text-white hover:underline">
              {photo.credit}
            </a>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-sm">
          {KURDISTAN_SCENES.map((s, i) => (
            <button key={s.id} type="button" onClick={() => { setIndex(i); setCycle((c) => c + 1); }}
              aria-label={`Show ${s.name}`} aria-current={i === index}
              className={`h-2.5 cursor-pointer rounded-full transition-all ${i === index ? 'w-6 bg-[#F2C14E]' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />
          ))}
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the photographs of Kurdistan' : 'Pause the photographs of Kurdistan'}
            className="ms-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/15">
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  );
};
