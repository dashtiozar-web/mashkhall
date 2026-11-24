import React from 'react';
import { NewsBanner } from '../types';
import { toPath } from '../lib/router';
import { activityPath } from '../lib/activities';
import { currentBanner, formatEventDate, useNewsBanners } from '../lib/newsBanner';
import { t } from '../i18n/translator';
import { useLang } from '../i18n/lang';

const hrefFor = (link?: string) => {
  if (!link) return '';
  return toPath(link);
};

/** The words that scroll across the banner. */
export const bannerText = (b: Pick<NewsBanner, 'message' | 'eventAt'>) =>
  [b.message, formatEventDate(b.eventAt)].filter(Boolean).join(' · ');

/**
 * The red "BREAKING NEWS" strip at the top of every page. The message moves
 * from one side to the other; people who prefer reduced motion see it still.
 * Hovering or focusing it pauses the movement so it can be read and clicked.
 */
export const BreakingNewsStrip: React.FC<{ banner: Pick<NewsBanner, 'message' | 'eventAt' | 'linkUrl' | 'mode'>; preview?: boolean }> = ({ banner, preview }) => {
  useLang(); // re-render when the language changes
  // The built-in everyday message follows the interface language; messages
  // written by administrators stay exactly as written.
  const text = t(bannerText(banner));
  const href = hrefFor(banner.linkUrl);
  const external = /^https?:/.test(href);
  // The message repeats so the strip is always full, and moves at a steady
  // reading speed whatever its length.
  const copies = Math.max(2, Math.ceil(170 / (text.length + 6)));
  const duration = Math.round(copies * (text.length + 6) * 0.17);
  const half = Array.from({ length: copies }, (_, i) => (
    <span key={i} className="bn-item inline-flex items-center">
      <span className="font-semibold">{text}</span>
      <span className="bn-sep mx-6 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />
    </span>
  ));
  const content = <>{half}{half.map((el, i) => React.cloneElement(el, { key: `b${i}` }))}</>;

  return (
    <div
      role={preview ? undefined : 'region'}
      aria-label={preview ? undefined : 'Breaking news'}
      className="breaking-news relative flex items-stretch overflow-hidden bg-[#A3172C] text-white"
    >
      <span className="relative z-10 flex shrink-0 items-center gap-2 bg-[#7A1021] px-3 py-2 text-[0.8125rem] font-bold tracking-[0.08em] uppercase sm:px-4 sm:text-[0.875rem]">
        <span className="breaking-news-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />
        Breaking news
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden py-2 text-[0.9375rem] sm:text-[1rem]">
        {/* Screen readers get the text once, without the moving copy. */}
        <span className="sr-only" data-i18n-skip="">{text}</span>
        <div dir="ltr" translate="no" data-i18n-skip="" className="breaking-news-track whitespace-nowrap" style={{ animationDuration: `${duration}s` }} aria-hidden="true">
          {href ? (
            <a href={href} tabIndex={-1} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="inline-flex text-white no-underline hover:underline">
              {content}
            </a>
          ) : content}
        </div>
      </div>
      {href && (
        <a
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="relative z-10 hidden shrink-0 items-center bg-[#A3172C] px-4 text-[0.875rem] font-semibold text-white underline underline-offset-4 sm:flex"
        >
          {banner.mode === 'announcement' ? 'Details and registration' : 'Read more'}
        </a>
      )}
    </div>
  );
};

/** Live banner for the site header. */
export const BreakingNewsBanner: React.FC = () => {
  const { banners, clock } = useNewsBanners(false);
  const b = currentBanner(banners, clock);
  // Activity announcements open their own page, where members can register.
  return <BreakingNewsStrip banner={b.mode === 'announcement' ? { ...b, linkUrl: activityPath(b.id) } : b} />;
};
