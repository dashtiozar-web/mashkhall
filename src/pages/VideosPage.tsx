import React, { useMemo, useState } from 'react';
import { Captions, PlayCircle, Search, Upload } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Container, EmptyState, PageHeader, categoryLabel, formatDate } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { subtitlesOf, SUBTITLE_LANGUAGES, videoEmbed, videoThumbnail, visibleTags } from '../lib/video';
import { viewsLabel } from '../components/PublicationList';

/**
 * Videos: every published video, newest first. Videos arrive through
 * Publish with Us (members free, visitors with the video fee) and are shown
 * only after the editors approve them; each plays on its own page.
 */

const LANGUAGE_LABEL: Record<string, string> = { en: 'English', ckb: 'Kurdish (Sorani)', ar: 'Arabic', kmr: 'Kurdish (Kurmanji)', fa: 'Persian', other: 'Other languages' };

export const VideosPage: React.FC<{ onNavigate: (tab: string, param?: string) => void }> = ({ onNavigate }) => {
  const { articles } = useData();
  const [language, setLanguage] = useState('all');
  const [topic, setTopic] = useState('all');
  const [search, setSearch] = useState('');

  const videos = useMemo(() => articles
    .filter((a) => a.status === 'published' && a.contentType === 'video_speech' && videoEmbed(a.videoUrl))
    .sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '')), [articles]);
  const languages = useMemo(() => [...new Set(videos.map((v) => v.language || 'en'))], [videos]);
  const topics = useMemo(() => [...new Set(videos.map((v) => v.category).filter(Boolean))].sort(), [videos]);

  const q = search.trim().toLowerCase();
  const shown = videos.filter((v) => (language === 'all' || (v.language || 'en') === language)
    && (topic === 'all' || v.category === topic)
    && (!q || v.title.toLowerCase().includes(q) || (v.excerpt || '').toLowerCase().includes(q) || visibleTags(v.tags).some((t) => t.toLowerCase().includes(q)) || (v.authorDisplayName || '').toLowerCase().includes(q)));

  const select = 'rounded-lg border border-line bg-surface px-3 py-2 text-ink';

  return (
    <>
      <PageHeader title="Videos" intro="Talks, interviews, reports and footage from our members and contributors, in Kurdish, Arabic and English. Every video is reviewed by our editors before it appears here." />
      <Container className="py-12 sm:py-14">
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-soft"><strong className="text-ink">Have a video to share?</strong> Send the link from YouTube, Vimeo or Facebook. Members publish without a fee.</p>
          <a href="/contribute?kind=video" className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-5 py-2.5 font-semibold text-white no-underline hover:bg-navy-deep"><Upload className="h-4 w-4" aria-hidden="true" /> Submit a video</a>
        </div>

        {videos.length === 0 ? (
          <EmptyState title="No videos yet" body="Approved videos will appear here." />
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-3 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap gap-3">
                {languages.length > 1 && (
                  <label className="flex items-center gap-2 text-[0.9375rem] text-muted">Language
                    <select className={select} value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="all">All languages</option>
                      {languages.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l] || l}</option>)}
                    </select>
                  </label>
                )}
                {topics.length > 1 && (
                  <label className="flex items-center gap-2 text-[0.9375rem] text-muted">Topic
                    <select className={select} value={topic} onChange={(e) => setTopic(e.target.value)}>
                      <option value="all">All topics</option>
                      {topics.map((t) => <option key={t} value={t}>{categoryLabel(t)}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <label className="relative block w-full md:w-80">
                <span className="sr-only">Search videos</span>
                <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, tag or name" className="w-full rounded-lg border border-line bg-surface py-2.5 pe-3 ps-9 placeholder:text-muted" />
              </label>
            </div>

            {shown.length === 0 ? <p className="py-8 text-ink-soft">No videos match. Try another word or clear the filters.</p> : (
              <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((v) => {
                  const thumb = v.coverImageUrl || videoThumbnail(v.videoUrl);
                  const subs = subtitlesOf(v.tags);
                  return (
                    <li key={v.id}>
                      <a href={`/news/${encodeURIComponent(v.slug || v.id)}`} className="group block no-underline">
                        <div className="relative aspect-video overflow-hidden rounded-xl bg-ink">
                          {thumb ? <MediaImage src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" /> : null}
                          <span className="absolute inset-0 flex items-center justify-center bg-ink/20"><PlayCircle className="h-14 w-14 text-white drop-shadow" aria-hidden="true" /></span>
                        </div>
                        <p className="mt-3 text-[0.8125rem] text-muted">
                          <span className="font-semibold text-navy">{categoryLabel(v.category)}</span>
                          {formatDate(v.publishedAt || v.createdAt) && <span>{'  ·  '}{formatDate(v.publishedAt || v.createdAt)}</span>}
                          <span>{'  ·  '}{LANGUAGE_LABEL[v.language || 'en'] || v.language}</span>
                        </p>
                        <h2 dir="auto" className="mt-1 text-[1.1875rem] leading-snug font-semibold text-ink group-hover:underline group-hover:underline-offset-4">{v.title}</h2>
                        {v.excerpt && <p dir="auto" className="mt-1 line-clamp-2 text-[0.9375rem] text-ink-soft">{v.excerpt}</p>}
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[0.875rem] text-muted">
                          {v.authorDisplayName && <span>By <span data-i18n-skip="" dir="auto">{v.authorDisplayName}</span></span>}
                          <span className="tabular-nums">{viewsLabel(v.viewsCount)}</span>
                          {subs.length > 0 && <span className="inline-flex items-center gap-1"><Captions className="h-4 w-4" aria-hidden="true" />{subs.map((s) => SUBTITLE_LANGUAGES.find((l) => l.id === s)?.label || s).join(', ')}</span>}
                        </p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Container>
    </>
  );
};
