import { sectionOfCategory } from '../lib/sections';
import React from 'react';
import { localeOf } from '../i18n/lang';

/**
 * Shared building blocks for the Mashkhally Zhyanawa site.
 * Keep pages composed from these so spacing, type and colour stay consistent.
 */

export const LOGO_URL = '/logo-512.png';
export const ORG_NAME = 'Mashkhally Zhyanawa Organisation';
export const ORG_SHORT = 'Mashkhally Zhyanawa';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export const Container: React.FC<{ className?: string; children: React.ReactNode; narrow?: boolean }> = ({
  className,
  children,
  narrow,
}) => (
  <div className={cx('mx-auto w-full px-5 sm:px-8', narrow ? 'max-w-[760px]' : 'max-w-[1200px]', className)}>
    {children}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'inverse' | 'quiet' | 'accent';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-navy text-white hover:bg-navy-deep border border-navy hover:border-navy-deep shadow-[0_1px_0_rgba(0,0,0,0.12)] focus-visible:outline-amber',
  secondary:
    'bg-surface text-ink border border-ink/25 hover:border-navy hover:text-navy',
  inverse:
    'bg-white text-[#3A140C] border border-white hover:bg-[#F3E6CC] hover:border-[#F3E6CC]',
  quiet:
    'bg-transparent text-navy border border-transparent underline underline-offset-4 decoration-navy/40 hover:decoration-navy px-0',
  accent:
    'bg-crimson text-white border border-crimson hover:brightness-110 shadow-[0_1px_0_rgba(0,0,0,0.12)]',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'md' | 'lg' }
> = ({ variant = 'primary', size = 'md', className, children, type = 'button', ...rest }) => (
  <button
    type={type}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
      size === 'lg' ? 'px-7 py-3.5 text-[1.0625rem]' : 'px-5 py-2.5 text-[0.9688rem]',
      buttonStyles[variant],
      variant === 'quiet' && 'px-0',
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

/** Inline text link that behaves like a button (in-app navigation). */
export const TextLink: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...rest }) => (
  <button
    type="button"
    className={cx(
      'cursor-pointer text-start font-semibold text-navy underline decoration-navy/35 underline-offset-4 hover:decoration-navy',
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

/** Top band for interior pages: title, a short introduction, optional actions. */
export const PageHeader: React.FC<{
  title: string;
  intro?: React.ReactNode;
  kicker?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, intro, kicker, children }) => (
  <header className="band-texture">
    <Container className="py-9 sm:py-12">
      {kicker && <div className="mb-3 text-[0.9375rem] text-[#F2C14E] [&_a]:text-white [&_button]:text-white">{kicker}</div>}
      <h1 className="max-w-[24ch] text-[2.125rem] leading-[1.12] font-semibold text-white sm:text-[2.625rem]">{title}</h1>
      {intro && <div className="mt-3 max-w-[66ch] text-[1.0938rem] leading-relaxed text-white/80">{intro}</div>}
      {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
    </Container>
    <div className="rule-fire" aria-hidden="true" />
  </header>
);

export const SectionHeading: React.FC<{
  title: string;
  intro?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, intro, action, className }) => (
  <div className={cx('mb-7 flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div>
      <span className="mb-3 block h-[3px] w-10 bg-crimson" aria-hidden="true" />
      <h2 className="text-[1.75rem] leading-tight font-semibold sm:text-[2rem]">{title}</h2>
      {intro && <p className="mt-3 max-w-[60ch] text-[1.0625rem] text-ink-soft">{intro}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const EmptyState: React.FC<{ title: string; body?: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  body,
  action,
}) => (
  <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
    <p className="font-serif text-xl font-semibold">{title}</p>
    {body && <p className="mx-auto mt-2 max-w-[52ch] text-muted">{body}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

/** Organisation logo with a text fallback if the image fails to load. */
export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 44, className }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <span
        className={cx('date-leaf inline-flex items-center justify-center rounded-lg bg-crimson font-bold text-white', className)}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        aria-hidden="true"
      >
        MZ
      </span>
    );
  }
  return (
    <img
      src={LOGO_URL}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cx('object-cover', className)}
      style={{ width: size, height: size }}
    />
  );
};

export const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(localeOf(), { day: 'numeric', month: 'long', year: 'numeric' });
};

export const categoryLabel = (category?: string) => {
  if (!category) return 'Article';
  const section = sectionOfCategory(category);
  if (section) return section.group === 'news' ? `News: ${section.name}` : section.name;
  const map: Record<string, string> = {
    political: 'Politics',
    human_rights: 'Human rights',
    'human-rights': 'Human rights',
    social: 'Society',
    economic: 'Economy',
    community: 'Community',
    legal: 'Law',
    culture: 'Culture',
    research: 'Research',
  };
  return map[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/[_-]/g, ' ');
};
