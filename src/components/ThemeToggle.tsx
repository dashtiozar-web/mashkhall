import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const readTheme = (): Theme =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

/** Switches between light and dark mode. Follows the device setting until
 *  the visitor chooses, then remembers their choice on this device. */
export const ThemeToggle: React.FC<{ className?: string; withLabel?: boolean }> = ({ className = '', withLabel }) => {
  const [theme, setTheme] = useState<Theme>(readTheme);

  // Follow the device setting while the visitor hasn't chosen.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem('theme'); } catch { /* storage unavailable */ }
      if (saved) return;
      document.documentElement.classList.toggle('dark', media.matches);
      setTheme(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full p-2 text-ink-soft transition-colors hover:bg-stone hover:text-ink ${className}`}
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
      {withLabel && <span className="text-[0.9688rem] font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
};
