import { PointRules } from '../types';

/** Default points for contributions. Administrators can change these. */
export const DEFAULT_POINT_RULES: PointRules = {
  article_published: 100,
  research_report: 60,
  event_participation: 30,
  media_contribution: 20,
  discussion_contribution: 10,
  project_support: 40,
};

export const POINT_LABELS: Record<keyof PointRules, string> = {
  article_published: 'Article published',
  research_report: 'Research or report contributed',
  event_participation: 'Took part in a workshop or activity',
  media_contribution: 'Photograph or video approved',
  discussion_contribution: 'Valuable contribution to a discussion',
  project_support: 'Supported a project or initiative',
};

/** Keys used to store points per ranking period on public profiles. */
export const periodKeys = (date = new Date()) => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return {
    all: 'all',
    month: `m${y}${String(m).padStart(2, '0')}`,
    quarter: `q${y}${Math.ceil(m / 3)}`,
  };
};

export const periodLabel = (period: 'all' | 'month' | 'quarter', date = new Date()) => {
  if (period === 'all') return 'All time';
  if (period === 'month') return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `Quarter ${Math.ceil((date.getUTCMonth() + 1) / 3)}, ${date.getUTCFullYear()}`;
};
