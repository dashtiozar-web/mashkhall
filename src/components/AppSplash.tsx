import React, { useEffect, useState } from 'react';
import { isInstalled } from '../lib/pwa';
import { FireRain, AnimatedTorch } from './TorchEmblem';

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
      className={`fixed inset-0 z-[100] isolate flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(120%_80%_at_50%_30%,#5C1F0E_0%,#2A110A_55%,#140906_100%)] px-8 transition-opacity duration-700 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <FireRain className="absolute inset-0 -z-10" density={1.3} />
      <AnimatedTorch className="h-[52vh] max-h-[460px] w-auto" />
      <p className="mt-6 text-center font-serif text-[1.75rem] font-semibold leading-tight text-white" translate="no">Mashkhally Zhyanawa</p>
      <p className="mt-2 text-center font-kurdish text-[1.5rem] text-[#F2C14E]" lang="ckb" dir="rtl" translate="no">مەشخەڵی ژیانەوە</p>
    </div>
  );
};
