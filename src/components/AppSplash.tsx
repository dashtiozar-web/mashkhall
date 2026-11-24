import React, { useEffect, useState } from 'react';
import { isInstalled } from '../lib/pwa';

const KEY = '17shubat_splash_shown';

/**
 * Opening screen of the installed app: the Mashkhally Zhyanawa torch and
 * name, shown each time the app is opened.
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
      <img src="/logo.svg" alt="" width={220} height={220} className="h-[220px] w-[220px] rounded-[40px] shadow-[0_30px_70px_-30px_rgba(31,38,34,0.6)]" />
      <p className="mt-8 text-center font-serif text-[1.75rem] font-semibold leading-tight text-ink dark:text-white" translate="no">Mashkhally Zhyanawa</p>
      <p className="mt-2 text-center font-kurdish text-[1.5rem] text-muted" lang="ckb" dir="rtl" translate="no">مەشخەڵی ژیانەوە</p>
    </div>
  );
};
