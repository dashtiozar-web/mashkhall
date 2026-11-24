import { useSyncExternalStore } from 'react';

/**
 * The interface language: Kurdish (Sorani), English or Arabic.
 *
 * Only the website's own text changes language. Articles, reports, comments
 * and other publications always stay in the language they were written in.
 * The choice is kept in this browser only (localStorage), never sent anywhere.
 */

export type Lang = 'ckb' | 'en' | 'ar';

export const LANGS: { code: Lang; label: string; native: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ckb', label: 'Kurdish (Sorani)', native: 'کوردی', dir: 'rtl' },
  { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
];

const KEY = '17shubat_lang';
const listeners = new Set<() => void>();

const isLang = (v: unknown): v is Lang => v === 'ckb' || v === 'en' || v === 'ar';

/** First visit: suggest a language from the browser's own preference. */
const fromBrowser = (): Lang => {
  try {
    for (const l of navigator.languages || [navigator.language]) {
      const tag = (l || '').toLowerCase();
      if (tag.startsWith('ckb') || tag === 'ku-iq' || tag.startsWith('ku-arab') || tag === 'ku') return 'ckb';
      if (tag.startsWith('ar')) return 'ar';
      if (tag.startsWith('en')) return 'en';
    }
  } catch { /* no navigator */ }
  return 'en';
};

const initial = (): Lang => {
  try {
    const url = new URLSearchParams(window.location.search).get('lang');
    if (isLang(url)) return url;
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage blocked */ }
  return typeof navigator === 'undefined' ? 'en' : fromBrowser();
};

let current: Lang = typeof window === 'undefined' ? 'en' : initial();

export const getLang = () => current;
export const dirOf = (lang: Lang = current) => (lang === 'en' ? 'ltr' : 'rtl');
export const isRtl = (lang: Lang = current) => dirOf(lang) === 'rtl';

/** BCP 47 tag for dates and country names (Western digits in every language). */
export const localeOf = (lang: Lang = current) =>
  lang === 'ckb' ? 'ckb-IQ-u-nu-latn' : lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB';

export const setLang = (lang: Lang) => {
  if (!isLang(lang) || lang === current) return;
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked: this visit only */ }
  listeners.forEach((l) => l());
};

export const subscribeLang = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** React components re-render when the language changes. */
export const useLang = () => useSyncExternalStore(subscribeLang, getLang, () => 'en' as Lang);
