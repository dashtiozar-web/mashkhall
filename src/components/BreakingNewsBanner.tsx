import React from 'react';
import { NewsBanner } from '../types';
import { toPath } from '../lib/router';
import { activityPath } from '../lib/activities';
import { currentBanners, formatEventDate, useNewsBanners } from '../lib/newsBanner';
import { t } from '../i18n/translator';
import { useLang } from '../i18n/lang';

const hrefFor = (link?: string) => {
  if (!link) return '';
  return toPath(link);
};

/** The words that scroll across the banner. */
export const bannerText = (b: Pick<NewsBanner, 'message' | 'eventAt'>) =>
  [b.message, formatEventDate(b.eventAt)].filter(Boolean).join(' · ');

type StripItem = Pick<NewsBanner, 'message' | 'eventAt' | 'linkUrl' | 'mode'>;

/**
 * The red "BREAKING NEWS" strip at the top of every page. Every live item
 * moves across one after another, each linked to its own page if it has one;
 * people who prefer reduced motion see the first item still. Hovering or
 * focusing it pauses the movement so it can be read and clicked.
 */
export const BreakingNewsStrip: React.FC<{ banner?: StripItem; banners?: StripItem[]; preview?: boolean }> = ({ banner, banners, preview }) => {
  useLang(); // re-render when the language changes
  const list = (banners && banners.length ? banners : banner ? [banner] : []);
  // The built-in everyday message follows the interface language; messages
  // written by administrators stay exactly as written.
  const items = list.map((b) => {
    const href = hrefFor(b.linkUrl);
    return { b, text: t(bannerText(b)), href, external: /^https?:/.test(href) };
  });
  const allText = items.map((i) => i.text).join(' · ');
  const cycleLen = items.reduce((n, i) => n + i.text.length + 6, 0) || 1;
  // The sequence repeats so the strip is always full, and moves at a steady
  // reading speed whatever its length.
  const copies = Math.max(2, Math.ceil(170 / cycleLen));
  const duration = Math.round(copies * cycleLen * 0.17);
  const half = Array.from({ length: copies }, (_, c) => items.map((it, i) => {
    const words = <span className="font-semibold">{it.text}</span>;
    return (
      <span key={`${c}-${i}`} className="bn-item inline-flex items-center">
        {it.href ? (
          <a href={it.href} tabIndex={-1} {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="text-white no-underline hover:underline">{words}</a>
        ) : words}
        <span className="bn-sep mx-6 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />
      </span>
    );
  })).flat();
  const content = <>{half}{half.map((el, i) => React.cloneElement(el, { key: `b${i}` }))}</>;
  const single = items.length === 1 ? items[0] : null;

  return (
    <div
      role={preview ? undefined : 'region'}
      aria-label={preview ? undefined : 'Breaking news'}
      className="breaking-news relative flex items-stretch overflow-hidden bg-[#B3261E] text-white"
    >
      <span className="relative z-10 flex shrink-0 items-center gap-2 bg-[#7A1021] px-3 py-2 text-[0.8125rem] font-bold tracking-[0.08em] uppercase sm:px-4 sm:text-[0.875rem]">
        <span className="breaking-news-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />
        Breaking news
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden py-2 text-[0.9375rem] sm:text-[1rem]">
        {/* Screen readers get each item once, without the moving copies. */}
        <span className="sr-only" data-i18n-skip="">{allText}</span>
        <div dir="ltr" translate="no" data-i18n-skip="" className="breaking-news-track whitespace-nowrap" style={{ animationDuration: `${duration}s` }} aria-hidden="true">
          {content}
        </div>
      </div>
      {single?.href && (
        <a
          href={single.href}
          {...(single.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="relative z-10 hidden shrink-0 items-center bg-[#B3261E] px-4 text-[0.875rem] font-semibold text-white underline underline-offset-4 sm:flex"
        >
          {single.b.mode === 'announcement' ? 'Details and registration' : 'Read more'}
        </a>
      )}
    </div>
  );
};

/** Live banner for the site header: every live item, one after another. */
export const BreakingNewsBanner: React.FC = () => {
  const { banners, clock } = useNewsBanners(false);
  // Activity announcements open their own page, where members can register.
  const items = currentBanners(banners, clock).map((b) => (b.mode === 'announcement' ? { ...b, linkUrl: activityPath(b.id) } : b));
  return <BreakingNewsStrip banners={items} />;
};
