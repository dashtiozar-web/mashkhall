import React from 'react';
import { Languages } from 'lucide-react';
import { LANGS, setLang, useLang } from '../i18n/lang';

/**
 * Kurdish (Sorani), English and Arabic. Changes the website's own text and
 * reading direction; publications stay in the language they were written in.
 * Each name is written in its own language, so everyone can find theirs.
 */
export const LanguageSwitcher: React.FC<{ tone?: 'dark' | 'light'; className?: string }> = ({ tone = 'dark', className = '' }) => {
  const lang = useLang();
  const dark = tone === 'dark';
  return (
    <div role="group" aria-label="Website language" className={`flex items-center gap-1.5 ${className}`} data-i18n-skip="children">
      <Languages className={`h-4 w-4 shrink-0 ${dark ? 'text-white/60' : 'text-muted'}`} aria-hidden="true" />
      <div className={`inline-flex overflow-hidden rounded-md border ${dark ? 'border-white/20' : 'border-line'}`}>
        {LANGS.map((l, i) => {
          const active = l.code === lang;
          return (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              dir={l.dir}
              translate="no"
              aria-pressed={active}
              title={l.label}
              onClick={() => setLang(l.code)}
              className={[
                'cursor-pointer px-2.5 py-1 text-[0.875rem] leading-tight font-semibold transition-colors sm:px-3',
                l.code === 'en' ? '' : 'font-[family-name:var(--f-arabic-ui)]',
                i > 0 ? (dark ? 'border-s border-white/20' : 'border-s border-line') : '',
                active
                  ? (dark ? 'bg-amber text-[#0B1830]' : 'bg-navy text-white')
                  : (dark ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-ink-soft hover:bg-stone hover:text-ink'),
              ].join(' ')}
            >
              {l.native}
            </button>
          );
        })}
      </div>
    </div>
  );
};
