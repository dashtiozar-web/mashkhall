import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Article, ContentType } from '../types';
import { EmptyState, categoryLabel, formatDate } from './ui';
import { MediaImage } from './MediaImage';
import { VIDEOS_ONLY_TAG, visibleTags } from '../lib/video';

export const viewsLabel = (n?: number) => `${(n || 0).toLocaleString('en-GB')} ${n === 1 ? 'view' : 'views'}`;

const TYPE_LABELS: Record<ContentType, string> = {
  article: 'Articles',
  monitoring_report: 'Reports',
  video_speech: 'Talks and video',
  archive: 'Archive',
};

interface PublicationListProps {
  articles: Article[];
  onNavigate: (tab: string, param?: string) => void;
  /** Show the topic filter as well as the type filter. */
  showTopics?: boolean;
  emptyAction?: React.ReactNode;
}

export const PublicationList: React.FC<PublicationListProps> = ({ articles, showTopics, emptyAction }) => {
  const [type, setType] = useState<'all' | ContentType>('all');
  const [topic, setTopic] = useState('all');
  const [search, setSearch] = useState('');

  const published = useMemo(
    () =>
      articles
        .filter((a) => a.status === 'published' && !(a.tags || []).includes(VIDEOS_ONLY_TAG))
        .sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '')),
    [articles],
  );

  const availableTypes = useMemo(
    () => (Object.keys(TYPE_LABELS) as ContentType[]).filter((t) => published.some((a) => (a.contentType || 'article') === t)),
    [published],
  );
  const availableTopics = useMemo(
    () => Array.from(new Set(published.map((a) => a.category).filter(Boolean))).sort(),
    [published],
  );

  const q = search.trim().toLowerCase();
  const visible = published.filter((a) => {
    if (type !== 'all' && (a.contentType || 'article') !== type) return false;
    if (topic !== 'all' && a.category !== topic) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      (a.excerpt || '').toLowerCase().includes(q) ||
      visibleTags(a.tags).some((t) => t.toLowerCase().includes(q))
    );
  });

  if (published.length === 0) {
    return (
      <EmptyState
        title="Nothing published yet"
        body="Statements, reports and research will appear here once they have been reviewed by our editors."
        action={emptyAction}
      />
    );
  }

  const chip = (active: boolean) =>
    `cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.9375rem] transition-colors ${
      active ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink-soft hover:border-ink/40 hover:text-ink'
    }`;

  return (
    <div>
      <div className="mb-10 flex flex-col gap-5 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          {availableTypes.length > 1 && (
            <div role="group" aria-label="Type" className="flex flex-wrap gap-2">
              <button type="button" className={chip(type === 'all')} aria-pressed={type === 'all'} onClick={() => setType('all')}>
                Everything
              </button>
              {availableTypes.map((t) => (
                <button key={t} type="button" className={chip(type === t)} aria-pressed={type === t} onClick={() => setType(t)}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
          {showTopics && availableTopics.length > 1 && (
            <label className="flex items-center gap-3 text-[0.9375rem] text-muted">
              Topic
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink"
              >
                <option value="all">All topics</option>
                {availableTopics.map((t) => (
                  <option key={t} value={t}>{categoryLabel(t)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="relative block w-full lg:w-80">
          <span className="sr-only">Search publications</span>
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or keyword"
            className="w-full rounded-lg border border-line bg-surface py-2.5 pe-3 ps-9 text-[0.9688rem] placeholder:text-muted focus:border-navy focus:outline-none"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-ink-soft">No publications match your search. Try a different word or clear the filters.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((a) => (
            <li key={a.id}>
              <a href={`/news/${encodeURIComponent(a.slug || a.id)}`} className="group grid gap-6 py-8 no-underline sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[0.875rem] text-muted">
                    <span className="font-semibold text-navy">
                      {a.isOfficialNews ? 'Statement' : TYPE_LABELS[a.contentType || 'article'] === 'Articles' ? categoryLabel(a.category) : TYPE_LABELS[a.contentType]}
                    </span>
                    {formatDate(a.publishedAt || a.createdAt) && <span>{'  /  '}{formatDate(a.publishedAt || a.createdAt)}</span>}
                  </p>
                  <h2 dir="auto" className="mt-2 max-w-[38ch] text-[1.5rem] leading-snug font-semibold text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {a.title}
                  </h2>
                  {a.excerpt && <p dir="auto" className="mt-2 max-w-[68ch] text-ink-soft">{a.excerpt}</p>}
                  <p className="mt-3 text-[0.9375rem] text-muted">
                    {a.authorDisplayName && <span>By {a.authorDisplayName}{'  ·  '}</span>}
                    <span className="tabular-nums">{viewsLabel(a.viewsCount)}</span>
                    {(a.likesCount || 0) > 0 && <span className="tabular-nums">{'  ·  '}{a.likesCount} support</span>}
                  </p>
                </div>
                {a.coverImageUrl && (
                  <MediaImage src={a.coverImageUrl} alt="" loading="lazy" className="hidden aspect-[4/3] w-52 object-cover sm:block" />
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
