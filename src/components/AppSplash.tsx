import React, { useEffect, useState } from 'react';
import { BleedingEdge } from './BleedingEdge';
import { isInstalled } from '../lib/pwa';

const KEY = '17shubat_splash_shown';

/**
 * Opening screen of the installed app: the bleeding 17 Shubat calendar,
 * for the martyrs of 17 February 2011, shown each time the app is opened.
 * Tap anywhere to continue at once.
 */
export const AppSplash: React.FC = () => {
  const [show, setShow] = useState(() => {
    try { return isInstalled() && !sessionStorage.getItem(KEY); } catch { return isInstalled(); }
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    const a = setTimeout(() => setLeaving(true), 3200);
    const b = setTimeout(() => setShow(false), 3900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [show]);

  if (!show) return null;
  const close = () => { setLeaving(true); setTimeout(() => setShow(false), 500); };

  return (
    <div role="presentation" onClick={close}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#ECEAE5] px-8 transition-opacity duration-700 dark:bg-[#0A111F] ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <div className="w-full max-w-[300px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_70px_-30px_rgba(31,38,34,0.6)]">
        <div className="relative z-0 flex items-baseline justify-between bg-crimson px-6 py-3.5 text-white">
          <span className="font-serif text-[1.375rem] font-semibold">Shubat</span>
          <span className="font-kurdish text-[1.125rem] text-white/90" lang="ckb" dir="rtl">شوبات</span>
          <BleedingEdge className="absolute top-full start-0 w-full" />
        </div>
        <p className="date-leaf relative z-10 pt-5 pb-1 text-center text-[8rem] leading-[0.95] font-semibold tracking-[-0.04em] text-[#1F2622]">17</p>
        <p className="relative z-10 pb-5 text-center text-[1rem] font-medium text-[#69706A]">February 2011</p>
      </div>
      <p className="mt-8 max-w-[30ch] text-center font-serif text-[1.125rem] leading-snug text-ink dark:text-white">
        We remember the martyrs of 17 Shubat.
      </p>
      <p className="mt-2 text-center font-kurdish text-[1.0625rem] text-muted" lang="ckb" dir="rtl">شەهیدانی ١٧ی شوبات لەبیر ناکەین</p>
    </div>
  );
};
