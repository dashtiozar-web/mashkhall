import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Monitor, MonitorSmartphone, Smartphone, Tablet, X } from 'lucide-react';

/**
 * Lets visitors choose how the site is laid out: Automatic (fits the screen),
 * Desktop, Tablet or Mobile. The choice is remembered on this device.
 *
 * - On a small screen, Desktop or Tablet widens the layout (the browser zooms
 *   out, as with "request desktop site").
 * - On a large screen, Tablet or Mobile shows the site in a frame of that
 *   width, so the real tablet or phone layout is used.
 */
export type ViewMode = 'auto' | 'desktop' | 'tablet' | 'mobile';

const WIDTH: Record<Exclude<ViewMode, 'auto'>, number> = { desktop: 1280, tablet: 820, mobile: 390 };
const KEY = '17shubat_view_mode';
const embedded = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const read = (): ViewMode => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'desktop' || v === 'tablet' || v === 'mobile' ? v : 'auto';
  } catch {
    return 'auto';
  }
};

const ViewModeContext = createContext<{ mode: ViewMode; setMode: (m: ViewMode) => void; embedded: boolean }>({
  mode: 'auto', setMode: () => {}, embedded: false,
});
export const useViewMode = () => useContext(ViewModeContext);

const LABELS: Record<ViewMode, string> = { auto: 'Auto', desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
const ICONS: Record<ViewMode, React.ReactNode> = {
  auto: <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />,
  desktop: <Monitor className="h-4 w-4" aria-hidden="true" />,
  tablet: <Tablet className="h-4 w-4" aria-hidden="true" />,
  mobile: <Smartphone className="h-4 w-4" aria-hidden="true" />,
};

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ViewMode>(embedded ? 'auto' : read);
  const [screenWidth, setScreenWidth] = useState(() => Math.min(window.screen?.width || window.innerWidth, window.outerWidth || window.innerWidth) || window.innerWidth);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const setMode = (m: ViewMode) => {
    // Keep the page the visitor had reached inside the frame.
    try {
      const loc = frameRef.current?.contentWindow?.location;
      const inner = loc ? loc.pathname + loc.search : '';
      if (inner && inner !== window.location.pathname + window.location.search) window.history.replaceState(null, '', inner);
    } catch { /* not reachable */ }
    setModeState(m);
    try { localStorage.setItem(KEY, m); } catch { /* not remembered */ }
  };

  useEffect(() => {
    const onResize = () => setScreenWidth(Math.min(window.screen?.width || window.innerWidth, window.outerWidth || window.innerWidth) || window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const target = mode === 'auto' ? 0 : WIDTH[mode];
  // Wider than the screen: ask the browser to lay the page out at that width.
  const widen = !embedded && target > 0 && target > screenWidth;
  // Narrower than the screen: show the real layout in a frame of that width.
  const frame = !embedded && target > 0 && target + 60 < window.innerWidth;

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', widen ? `width=${target}` : 'width=device-width, initial-scale=1.0');
  }, [widen, target]);

  if (frame) {
    return (
      <ViewModeContext.Provider value={{ mode, setMode, embedded }}>
        <div className="flex min-h-screen flex-col bg-stone-deep">
          <div className="flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-2.5 text-[0.9375rem] text-white">
            <span className="inline-flex items-center gap-2">{ICONS[mode]} Viewing the {mode} layout ({target}px wide)</span>
            <ViewModePicker tone="dark" />
            <button type="button" onClick={() => setMode('auto')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1 font-semibold hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden="true" /> Back to normal
            </button>
          </div>
          <div className="flex flex-1 justify-center py-6">
            <iframe
              ref={frameRef}
              title={`17 Shubat website, ${mode} layout`}
              src={window.location.href}
              className="h-[calc(100vh-7rem)] rounded-[1.75rem] border-[10px] border-ink bg-paper shadow-2xl"
              style={{ width: target + 20 }}
            />
          </div>
        </div>
      </ViewModeContext.Provider>
    );
  }

  return <ViewModeContext.Provider value={{ mode, setMode, embedded }}>{children}</ViewModeContext.Provider>;
};

/** The Automatic / Desktop / Tablet / Mobile buttons. */
export const ViewModePicker: React.FC<{ tone?: 'light' | 'dark'; className?: string }> = ({ tone = 'dark', className }) => {
  const { mode, setMode, embedded: inFrame } = useViewMode();
  if (inFrame) return null;
  return (
    <div role="group" aria-label="Choose layout" className={`inline-flex flex-wrap items-center gap-1 rounded-full border p-1 ${tone === 'dark' ? 'border-white/25' : 'border-line'} ${className || ''}`}>
      {(['auto', 'desktop', 'tablet', 'mobile'] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-semibold sm:px-3 ${
            mode === m
              ? tone === 'dark' ? 'bg-white text-[#1F2622]' : 'bg-navy text-white'
              : tone === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          {ICONS[m]}{LABELS[m]}
        </button>
      ))}
    </div>
  );
};
