import { useEffect, useState } from 'react';
import { getLang, localeOf } from '../i18n/lang';

/**
 * Visitor counts by country. Each browser session reports one visit to the
 * website's own counter (worker/index.js), which takes the country and region
 * from the connection. No IP address is stored or shown.
 */

export interface VisitTotals { people: number; visits: number }
/** In public figures, small numbers are hidden (people is null, "fewer than 5"). */
export interface PartTotals { people: number | null; visits: number | null; fewerThan?: number }
export interface CountryVisits extends VisitTotals { code: string; members?: number; memberVisits?: number }
export interface VisitorStats {
  total: VisitTotals;
  members: VisitTotals;
  visitors: VisitTotals;
  today: VisitTotals;
  iraq: { kurdistan: PartTotals; rest: PartTotals };
  iran: { kurdistan: PartTotals; rest: PartTotals };
  countries: CountryVisits[];
  /** Countries with fewer visitors than the public minimum, grouped together. */
  other?: { countries: number; people: number; visits: number };
  minPublic?: number;
  days: { day: string; people: number; visits: number }[];
  since: string | null;
  /** First day with day-by-day country figures (periods start here at the earliest). */
  dailySince?: string | null;
  range?: { from: string; to: string } | null;
  updatedAt: string;
}

/** Periods anyone can choose; administrators can also pick their own dates. */
export type Period = 'all' | 'today' | '7d' | '30d' | '90d' | '365d';
export const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '365d', label: 'Last 12 months' },
];

export const visitorsUrl = (period: Period, custom?: { from: string; to: string } | null, full = false) => {
  const q = new URLSearchParams();
  if (full) q.set('full', '1');
  if (custom) { q.set('from', custom.from); q.set('to', custom.to); } else if (period !== 'all') q.set('period', period);
  const s = q.toString();
  return `/api/visitors${s ? `?${s}` : ''}`;
};

const SESSION_KEY = '17shubat_visit_counted';

/** Count this visit once per browser session. */
export const recordVisit = async (member: boolean) => {
  try {
    const key = `${SESSION_KEY}_${member ? 'm' : 'v'}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* storage blocked: count anyway */ }
  try {
    await fetch('/api/visit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ member }), keepalive: true });
    window.dispatchEvent(new Event(VISIT_EVENT));
  } catch { /* offline */ }
};

const VISIT_EVENT = '17shubat:visit-counted';

/**
 * Live statistics for a period, refreshed every 30 seconds while the page is
 * open (and straight away when this visit has been counted or the tab comes
 * back into view). Administrators pass their sign-in token for full figures.
 */
export const useVisitorStats = (period: Period = 'all', opts: { custom?: { from: string; to: string } | null; token?: () => Promise<string | undefined> } = {}) => {
  const [stats, setStats] = useState<VisitorStats | null | undefined>(undefined);
  const { custom, token } = opts;
  const key = `${period}|${custom?.from || ''}|${custom?.to || ''}|${token ? 'admin' : 'public'}`;
  useEffect(() => {
    let live = true;
    setStats(undefined);
    const load = async () => {
      try {
        const t = token ? await token() : undefined;
        if (token && !t) { if (live) setStats(null); return; }
        const r = await fetch(visitorsUrl(period, custom, Boolean(token)), { cache: 'no-store', headers: t ? { authorization: `Bearer ${t}` } : {} });
        const d = r.ok && (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
        if (live) setStats(d);
      } catch {
        if (live) setStats(null);
      }
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(VISIT_EVENT, load);
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener(VISIT_EVENT, load); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return stats;
};

const names = new Map<string, Intl.DisplayNames | null>();
/** The Kurdistan Region is counted on its own, so "Iraq" means the rest of Iraq. */
const KURDISTAN_REGION_NAME: Record<string, string> = { en: 'Kurdistan Region', ckb: 'هەرێمی کوردستان', ar: 'إقليم كوردستان' };
const IRAQ_REST_NAME: Record<string, string> = { en: 'Iraq (outside the Kurdistan Region)', ckb: 'عێراق (دەرەوەی هەرێمی کوردستان)', ar: 'العراق (خارج إقليم كوردستان)' };
/** A country's name in the interface language (falls back to English). */
export const countryName = (code: string) => {
  if (code === 'XX') return 'Unknown location';
  if (code === 'T1') return 'Tor network';
  if (code === 'IQ-KR') return KURDISTAN_REGION_NAME[getLang()] || KURDISTAN_REGION_NAME.en;
  const lang = getLang();
  for (const locale of [localeOf(lang), 'en-GB']) {
    try {
      if (!names.has(locale)) names.set(locale, new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }));
      const n = names.get(locale)?.of(code);
      if (n && n !== code) return n;
    } catch { names.set(locale, null); }
  }
  return code;
};

/** For visitor figures, where the Kurdistan Region is listed separately: Iraq is the rest of Iraq. */
export const placeName = (code: string) => (code === 'IQ' ? IRAQ_REST_NAME[getLang()] || IRAQ_REST_NAME.en : countryName(code));

export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) && code !== 'XX' ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌐';

/** Report a security event (counted by day, type and country only). */
export const reportSecurityEvent = (kind: 'login_failed' | 'signup_failed' | 'upload_rejected' | 'comment_blocked' | 'submission_refused' | 'auth_config' | 'rules_outdated') => {
  try {
    fetch('/api/security-event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }), keepalive: true }).catch(() => undefined);
  } catch { /* ignore */ }
};

/** Administrators: full figures and security counts, using their sign-in. */
export const adminFetch = async <T,>(path: string, token: string): Promise<T> => {
  const r = await fetch(path, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!r.ok) throw new Error(r.status === 403 ? 'Administrators only.' : 'Not available.');
  return r.json() as Promise<T>;
};
