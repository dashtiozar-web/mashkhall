import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { commons, LandmarkPhoto } from '../lib/landmarks';

/**
 * The homepage cover: photographs of Kurdistan, one after another, each
 * moving slowly (a gentle camera drift) and fading into the next — the
 * Citadel of Erbil, Sulaymaniyah, Halabja, Duhok, Amedi, the Qandil
 * mountains, Kirkuk, the mountains of Kurdistan, sixteen more cities and
 * towns (Ranya to Hawraman) and the flag of Kurdistan.
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
    { url: '/images/cities/halabja.jpg', credit: '', source: '' },
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
  { id: 'ranya', name: 'Ranya', ku: 'ڕانیە', photos: [
    { url: '/images/cities/ranya.jpg', credit: '', source: '' },
    commons('Hajiawa Mountain, Rania, Kurdistan- Iraq.jpg', 'Wary Abdullah'),
    commons('Darband-i Rania. Sulaymaniyah Governorate, Iraqi Kurdistan.jpg'),
    commons('Sarkapkan mountain, Rania, Kurdistan- Iraq.jpg', 'Wary Abdullah'),
  ] },
  { id: 'qaladiza', name: 'Qaladiza', ku: 'قەڵادزێ', photos: [
    { url: '/images/cities/qaladiza.jpg', credit: 'Photo: Hiwa Mahmood', source: '' },
    commons('Qaladze17.jpg', 'Saman.h.m'),
    commons('Qaladze14.jpg', 'Saman.h.m'),
    commons('Qaladze.jpg', 'Saman11'),
  ] },
  { id: 'rawanduz', name: 'Rawanduz', ku: 'ڕەواندز', photos: [
    { url: '/images/cities/rawanduz.jpg', credit: '', source: '' },
    commons('Rawanduz, Kurdistan Regional Government.jpg', 'Levi Clancy'),
    commons('Rawanduz - Kurdistan.jpg', 'Claus Weinberg'),
    commons('Rowanduz Gorge.jpg', 'CymbalStone'),
  ] },
  { id: 'soran', name: 'Soran', ku: 'سۆران', photos: [
    { url: '/images/cities/soran.jpg', credit: '', source: '' },
    commons('.Soran City 01.jpg', 'Khoshhat'),
    commons('Iraq Kurdistan Erbil Soran.jpg'),
  ] },
  { id: 'dukan', name: 'Dukan', ku: 'دوکان', photos: [
    commons('Dukan lake- Dukan, Slemani.jpg', 'Hiwa Sherzad'),
    commons('5. Lake Dukan, Sulaymaniyah Governorate, Iraqi Kurdistan.jpg', 'Osama Shukir Muhammed Amin'),
    commons('Dukan Lake.jpg', 'Mhamadkorra'),
  ] },
  { id: 'choman', name: 'Choman', ku: 'چۆمان', photos: [
    { url: '/images/cities/choman.jpg', credit: '', source: '' },
    commons('Choman Erbil Iraq.jpg', 'Kawasuurdawoody'),
    commons('Choman, Irbil, Kurdistan.jpg'),
  ] },
  { id: 'darbandikhan', name: 'Darbandikhan', ku: 'دەربەندیخان', photos: [
    commons('Lake Darbandikhan.jpg', 'Adam Jones'),
    commons('Darbandikhan - panoramio.jpg'),
  ] },
  { id: 'kalar', name: 'Kalar', ku: 'کەلار', photos: [
    commons('Kalar View from Sherwana Castle.jpg'),
    commons('Kalar city - panoramio.jpg'),
  ] },
  { id: 'kifri', name: 'Kifri', ku: 'کفری', photos: [
    commons('Kifri one of the oldest still inhabited cities in Iraq.jpg'),
    commons('Entrance of Kifri.jpg'),
    commons('Mejid Pasha Palace.jpg'),
  ] },
  { id: 'akre', name: 'Akre', ku: 'ئاکرێ', photos: [
    commons('Akre, Iraq.jpg', 'Ara Qadir'),
    commons('The Great Mosque of Akre and the Old Town.jpg'),
    commons('Akre city.jpg'),
  ] },
  { id: 'zakho', name: 'Zakho', ku: 'زاخۆ', photos: [
    commons('Pira Delal Bridge in Zakho, Duhok Governorate, Kurdistan Region 7.jpg', 'Levi Clancy'),
    commons('Delal Bridge in Zakho (201).jpg', 'Zaxo'),
    commons('Pra Delal (Delal Bridge) Zakho.jpg'),
  ] },
  { id: 'chamchamal', name: 'Chamchamal', ku: 'چەمچەماڵ', photos: [
    commons('20190510 163430.Chamchamal.Sulaymaniyah.Kurdistan.jpg'),
    commons('20190510 163435.Chamchamal.Sulaymaniyah.Kurdistan.jpg'),
  ] },
  { id: 'said-sadiq', name: 'Said Sadiq', ku: 'سەیدسادق', photos: [
    commons('Said Sadiq 00964, Iraq - panoramio.jpg'),
    commons('Saidsadiq.jpg'),
  ] },
  { id: 'sharazur', name: 'Sharazur', ku: 'شارەزوور', photos: [
    commons('September 18, 2014. The ancient mound of Bakr Awa, Shahrizor Plain, Sulaymaniyah Governorate, Iraq.jpg'),
    commons('1. The Neolithic site of Bestansur, October 11, 2021. Shahrizor Plane, Sulaymaniyah, Iraqi Kurdistan.jpg'),
  ] },
  { id: 'penjwen', name: 'Penjwen', ku: 'پێنجوێن', photos: [
    commons('Penjwen, Iraq - panoramio (1).jpg'),
    commons('Galoz village in Nalparez district-Penjwen district Kurdistan-Iraq.jpg', 'Dana Jamal'),
  ] },
  { id: 'hawraman', name: 'Hawraman', ku: 'هەورامان', photos: [
    commons('Tawela - Kurdish Village in Hawraman - Southern Kurdistan - Iraq - 2016 - Diyar Mohammed Photography.jpg', 'Diyar Mohammed'),
    commons('Hawraman - Tawela Village in Sulaymaniyah, Kurdistan, Iraq.jpg', 'Diyar Muhammed'),
  ] },
  { id: 'flag', name: 'The flag of Kurdistan', ku: 'ئاڵای کوردستان', photos: [
    commons('Kurdistan flag.jpg', 'Sarchia Khursheed'),
    commons('Kurdish flag Erbil.jpg', 'Giorgio Montersino'),
  ] },
];

const SLIDE_MS = 12_000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const Slide: React.FC<{ scene: Scene; active: boolean; still: boolean; cycle: number; onPhoto: (p?: LandmarkPhoto) => void; onLost: (id: string) => void }> = ({ scene, active, still, cycle, onPhoto, onLost }) => {
  const [n, setN] = useState(0);
  const photo = scene.photos[n];
  useEffect(() => { if (active) onPhoto(photo); }, [active, photo, onPhoto]);
  // No photo of this place could be loaded: leave it out of the slideshow.
  useEffect(() => { if (!photo) onLost(scene.id); }, [photo, scene.id, onLost]);
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
  const [lost, setLost] = useState<string[]>([]);
  const scenes = useMemo(() => KURDISTAN_SCENES.filter((s) => !lost.includes(s.id)), [lost]);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [still] = useState(prefersReducedMotion);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [photo, setPhoto] = useState<LandmarkPhoto | undefined>();
  const n = Math.max(1, scenes.length);
  const at = index % n;
  const onLost = useCallback((id: string) => setLost((l) => (l.includes(id) ? l : [...l, id])), []);
  const go = (step: number) => { setIndex((i) => ((i % n) + step + n) % n); setCycle((c) => c + 1); };

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => { setIndex((i) => ((i % n) + 1) % n); setCycle((c) => c + 1); }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, n]);

  const current = scenes[at];
  return (
    <>
      <div className="absolute inset-0 overflow-hidden bg-[#1F100B]" aria-hidden="true">
        {scenes.map((s, i) => {
          const active = i === at;
          const near = i === (at + 1) % n;
          if (!active && !near) return null;
          return <Slide key={s.id} scene={s} active={active} still={still} cycle={cycle} onPhoto={setPhoto} onLost={onLost} />;
        })}
        {/* Keeps the words readable over every photograph. */}
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[#1F100B]/90 via-[#1F100B]/55 to-[#1F100B]/20" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1F100B]/85 to-transparent" />
      </div>
      {current && (
        <div className="absolute end-4 bottom-5 start-4 z-10 flex items-end justify-between gap-4 sm:end-6 sm:start-auto sm:justify-end">
          <p className="min-w-0 text-end text-[0.8125rem] leading-snug text-white/85" aria-live="polite">
            <span className="block font-semibold text-white">{current.name}</span>
            <span className="ku-sub block font-kurdish text-[0.9375rem] text-[#F2C14E]" lang="ckb" dir="rtl" translate="no">{current.ku}</span>
            {photo?.credit && !photo.source && (
              <span className="mt-0.5 block truncate text-[0.6875rem] text-white/60">{photo.credit}</span>
            )}
            {photo?.credit && photo.source && (
              <a href={photo.source} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[0.6875rem] text-white/60 underline-offset-2 hover:text-white hover:underline">
                {photo.credit}
              </a>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/35 px-1.5 py-1 text-white backdrop-blur-sm">
            <button type="button" onClick={() => go(-1)} aria-label="Previous place"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/15">
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
            <span className="min-w-[3.25rem] text-center text-[0.75rem] tabular-nums text-white/85" dir="ltr" translate="no">{at + 1} / {scenes.length}</span>
            <button type="button" onClick={() => go(1)} aria-label="Next place"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/15">
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the photographs of Kurdistan' : 'Pause the photographs of Kurdistan'}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/15">
              {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
