import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Facebook } from 'lucide-react';
import { useData } from '../context/DataContext';

const CONSENT_KEY = '17shubat_show_facebook';

/** Mashkhally Zhyanawa's Facebook Page, used until an administrator sets another one. */
export const DEFAULT_FACEBOOK_PAGE = 'https://www.facebook.com/61555753452199';

const readConsent = () => {
  try { return localStorage.getItem(CONSENT_KEY) === 'yes'; } catch { return false; }
};

/** A page address Facebook's Page Plugin accepts (https://www.facebook.com/…). */
export const normaliseFacebookUrl = (raw?: string) => {
  const v = (raw || '').trim();
  if (!v) return '';
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://www.facebook.com/${v.replace(/^@/, '')}`;
  try {
    const u = new URL(withScheme);
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(u.hostname)) return '';
    u.hostname = 'www.facebook.com';
    u.protocol = 'https:';
    u.hash = '';
    // Drop tracking parameters (http_ref, mibextid…); keep only a profile id.
    const id = u.searchParams.get('id');
    u.search = id && /profile\.php$/.test(u.pathname) ? `?id=${id}` : '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

/**
 * The organisation's Facebook posts, newest first, using Facebook's official
 * Page Plugin. New posts appear automatically. Facebook content (and its
 * cookies) only loads after the visitor agrees, and the choice is remembered.
 */
export const FacebookFeed: React.FC<{ height?: number; className?: string }> = ({ height = 900, className }) => {
  const { siteSettings } = useData();
  const pageUrl = normaliseFacebookUrl(siteSettings.facebookPageUrl || DEFAULT_FACEBOOK_PAGE);
  const [show, setShow] = useState(readConsent);
  const [width, setWidth] = useState(500);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(180, Math.min(500, Math.floor(el.clientWidth))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [show]);

  if (!pageUrl) {
    return (
      <div className={`rounded-2xl border border-dashed border-line bg-surface p-8 text-center ${className || ''}`}>
        <Facebook className="mx-auto h-8 w-8 text-[#1877F2]" aria-hidden="true" />
        <p className="mt-3 font-semibold">Our activity feed is being set up</p>
        <p className="mt-1 text-ink-soft">Our latest activities will appear here soon.</p>
      </div>
    );
  }

  if (!show) {
    return (
      <div className={`rounded-2xl border border-line bg-surface p-8 text-center ${className || ''}`}>
        <Facebook className="mx-auto h-9 w-9 text-[#1877F2]" aria-hidden="true" />
        <p className="mt-3 text-[1.125rem] font-semibold">See our latest activities</p>
        <p className="mx-auto mt-2 max-w-[46ch] text-ink-soft">
          We post our events, workshops and campaigns on Facebook. Showing them here loads content from Facebook,
          which may set its own cookies.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => { setShow(true); try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch { /* not remembered */ } }}
            className="cursor-pointer rounded-lg bg-[#1877F2] px-5 py-2.5 font-semibold text-white hover:bg-[#0f63d4]"
          >
            Show our Facebook posts
          </button>
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 font-semibold text-ink no-underline hover:border-ink/40">
            Open Facebook <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  const src = `https://www.facebook.com/plugins/page.php?${new URLSearchParams({
    href: pageUrl,
    tabs: 'timeline,events',
    width: String(width),
    height: String(height),
    small_header: 'false',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'false',
    lazy: 'true',
  }).toString()}`;

  return (
    <div className={className}>
      <div ref={box} className="mx-auto w-full max-w-[500px] overflow-hidden rounded-2xl border border-line bg-white">
        <iframe
          key={`${width}-${height}`}
          title="Mashkhally Zhyanawa on Facebook: latest posts"
          src={src}
          width={width}
          height={height}
          style={{ border: 'none', overflow: 'hidden', display: 'block' }}
          scrolling="no"
          allow="encrypted-media; clipboard-write; picture-in-picture; web-share"
          loading="lazy"
        />
      </div>
      <p className="mx-auto mt-3 flex max-w-[500px] flex-wrap items-center justify-between gap-2 text-[0.875rem] text-muted">
        <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-navy">
          Follow us on Facebook <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <button type="button" onClick={() => { setShow(false); try { localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ } }} className="cursor-pointer underline underline-offset-2 hover:text-ink">
          Stop showing Facebook content
        </button>
      </p>
    </div>
  );
};
