import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useInstall } from '../lib/pwa';

/** "Install the app" in the footer: one tap where the browser allows it, instructions on iPhone. */
export const InstallApp: React.FC = () => {
  const { canPrompt, installed, ios, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (installed || (!canPrompt && !ios)) return null;

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
        <div>
          <p className="text-[0.9375rem] font-semibold text-white">17 Shubat app</p>
          <p className="text-[0.875rem] text-white/70">Add the website to your home screen and open it like an app.</p>
        </div>
      </div>
      {canPrompt ? (
        <button type="button" onClick={() => install()} className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg bg-white px-5 py-2.5 font-semibold text-navy hover:bg-white/90 sm:self-auto">
          <Download className="h-4 w-4" aria-hidden="true" /> Install the app
        </button>
      ) : (
        <div className="sm:text-end">
          <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-semibold text-navy hover:bg-white/90">
            <Download className="h-4 w-4" aria-hidden="true" /> Install the app
          </button>
          {help && (
            <p className="mt-2 max-w-xs text-[0.875rem] text-white/85">
              In Safari, tap <Share className="inline h-4 w-4 align-[-2px]" aria-label="Share" /> Share, then <strong>Add to Home Screen</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
