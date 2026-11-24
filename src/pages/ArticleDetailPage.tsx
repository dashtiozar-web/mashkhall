import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Heart, Link2, Check } from 'lucide-react';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Button, Container, TextLink, categoryLabel, formatDate } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { SharePanel } from '../components/SharePanel';
import { Comments } from '../components/Comments';
import { Initials } from '../components/PersonCard';
import { VideoPlayer } from '../components/VideoEmbed';
import { videoEmbed, subtitlesOf, SUBTITLE_LANGUAGES, visibleTags } from '../lib/video';

interface ArticleDetailPageProps {
  slug: string;
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth?: () => void;
}


/** Renders the simple text format used by the article editor, line by line:
 *  "## " and "### " headings, "- " list items, "> " quotes, and paragraphs
 *  separated by blank lines. */
type Block =
  | { kind: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { kind: 'img'; text: string; src: string }
  | { kind: 'ul'; items: string[] };

const parseArticle = (content: string): Block[] => {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    if (list.length) blocks.push({ kind: 'ul', items: list });
    if (quote.length) blocks.push({ kind: 'quote', text: quote.join(' ') });
    para = []; list = []; quote = [];
  };
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    // A photo on its own line: ![description](media:… or https://…)
    const img = /^!\[([^\]]*)\]\(((?:media:[\w-]+)|(?:https:\/\/[^\s)]+))\)$/.exec(line);
    if (img) { flush(); blocks.push({ kind: 'img', text: img[1], src: img[2] }); continue; }
    if (line.startsWith('### ')) { flush(); blocks.push({ kind: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## ')) { flush(); blocks.push({ kind: 'h2', text: line.slice(3) }); continue; }
    if (/^[-*] /.test(line)) {
      if (para.length || quote.length) { const l = list; list = []; flush(); list = l; }
      list.push(line.slice(2));
      continue;
    }
    if (line.startsWith('>')) {
      if (para.length || list.length) flush();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    if (list.length || quote.length) flush();
    para.push(line);
  }
  flush();
  return blocks;
};

const ArticleBody: React.FC<{ content: string; dir?: 'ltr' | 'rtl'; lang?: string }> = ({ content, dir = 'ltr', lang }) => (
  <div className="prose-article" dir={dir} lang={lang} data-i18n-skip="">
    {parseArticle(content).map((block, idx) => {
      switch (block.kind) {
        case 'h2': return <h2 key={idx}>{block.text}</h2>;
        case 'h3': return <h3 key={idx}>{block.text}</h3>;
        case 'quote': return <blockquote key={idx}>{block.text}</blockquote>;
        case 'img': return <MediaImage key={idx} src={block.src} alt={block.text} loading="lazy" className="my-6 w-full rounded-xl object-cover" />;
        case 'ul': return <ul key={idx} className="list-disc">{block.items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
        default: return <p key={idx}>{block.text}</p>;
      }
    })}
  </div>
);

export const ArticleDetailPage: React.FC<ArticleDetailPageProps> = ({ slug, onNavigate, onOpenAuth }) => {
  const { articles, incrementArticleView, toggleArticleLike, incrementArticleShare, publicProfiles } = useData();
  const { currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  const article = articles.find((a) => a.slug === slug) || articles.find((a) => a.id === slug);

  useEffect(() => {
    if (article) incrementArticleView(article.id);
  }, [article?.id]);

  // Show whether this member has already liked the article.
  useEffect(() => {
    if (!article || !currentUser) {
      setIsLiked(false);
      return;
    }
    getDoc(doc(db, 'articles', article.id, 'likes', currentUser.uid))
      .then((snap) => setIsLiked(snap.exists()))
      .catch(() => setIsLiked(false));
  }, [article?.id, currentUser?.uid]);

  if (!article) {
    return (
      <Container narrow className="py-24">
        <h1 className="text-[2.25rem] font-semibold">This article isn’t available</h1>
        <p className="mt-4 text-ink-soft">
          It may have been moved, or it may not have been published yet.
        </p>
        <Button className="mt-8" onClick={() => onNavigate('news')}>Browse news and reports</Button>
      </Container>
    );
  }

  const handleLike = async () => {
    const liked = await toggleArticleLike(article.id);
    setIsLiked(liked);
  };

  const handleShare = async () => {
    await incrementArticleShare(article.id);
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url });
        return;
      } catch {
        // cancelled — fall back to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable
    }
  };

  const words = (article.content || '').split(/\s+/).filter(Boolean).length;
  const readTime = article.readingTimeMinutes || Math.max(1, Math.ceil(words / 200));
  const date = formatDate(article.publishedAt || article.createdAt);
  const isDraft = article.status !== 'published';
  const dir: 'ltr' | 'rtl' = article.direction === 'rtl' ? 'rtl' : 'ltr';
  const author = publicProfiles.find((p) => p.id === article.authorUid || p.userId === article.authorUid);

  const related = articles
    .filter((a) => a.id !== article.id && a.status === 'published')
    .sort((a, b) => (a.category === article.category ? -1 : 0) - (b.category === article.category ? -1 : 0))
    .slice(0, 3);

  return (
    <article>
      {isDraft && (
        <div className="border-b border-amber/40 bg-amber/15">
          <Container className="py-3 text-[0.9375rem]">
            Preview: this article is <strong>{article.status.replace(/_/g, ' ')}</strong> and is not visible to the public.
          </Container>
        </div>
      )}

      <header className="border-b border-line">
        <Container narrow className="pt-12 pb-10 sm:pt-16">
          <TextLink onClick={() => onNavigate('news')} className="text-[0.9375rem]">News and reports</TextLink>
          <p className="mt-8 text-[0.9375rem] font-semibold text-navy">
            {article.isOfficialNews ? 'Statement from Mashkhally Zhyanawa' : categoryLabel(article.category)}
          </p>
          <h1 dir={dir} lang={article.language} data-i18n-skip="" className={`mt-3 font-semibold ${dir === 'rtl' ? 'text-[2.125rem] leading-[1.5] sm:text-[2.75rem]' : 'text-[2.375rem] leading-[1.1] sm:text-[3.25rem]'}`}>{article.title}</h1>
          {article.excerpt && (
            <p dir={dir} lang={article.language} data-i18n-skip="" className={`mt-6 text-[1.375rem] text-ink-soft ${dir === 'rtl' ? 'leading-[1.9]' : 'font-serif leading-snug'}`}>{article.excerpt}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <p className="text-[0.9375rem] text-muted">
              {article.authorDisplayName && (
                <span className="inline-flex items-center gap-2 align-middle">
                  {author?.photoUrl && <MediaImage src={author.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />}
                  <span className="font-semibold text-ink">{author?.displayName || article.authorDisplayName}</span>
                </span>
              )}
              {date && <span>{article.authorDisplayName ? ', ' : ''}<time dateTime={article.publishedAt || article.createdAt}>{date}</time></span>}
              <span>{'. '}{readTime} min read</span>
              {!isDraft && <span className="tabular-nums">{'  ·  '}{(article.viewsCount || 0).toLocaleString('en-GB')} {article.viewsCount === 1 ? 'view' : 'views'}</span>}
            </p>
            {!isDraft && (
              <div className="flex items-center gap-2">
                {!currentUser && onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    title="Sign in to show your support"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[0.9375rem] text-ink-soft hover:border-ink/40"
                  >
                    <Heart className="h-4 w-4" aria-hidden="true" />
                    Support
                    {(article.likesCount || 0) > 0 && <span className="tabular-nums text-muted">{article.likesCount}</span>}
                  </button>
                )}
                {currentUser && (
                  <button
                    type="button"
                    onClick={handleLike}
                    aria-pressed={isLiked}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.9375rem] ${
                      isLiked ? 'border-crimson/40 bg-crimson/5 text-crimson' : 'border-line text-ink-soft hover:border-ink/40'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? 'fill-crimson' : ''}`} aria-hidden="true" />
                    {isLiked ? 'Supported' : 'Support'}
                    {(article.likesCount || 0) > 0 && <span className="tabular-nums text-muted">{article.likesCount}</span>}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[0.9375rem] text-ink-soft hover:border-ink/40"
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
                  {copied ? 'Link copied' : 'Share'}
                </button>
              </div>
            )}
          </div>
        </Container>
      </header>

      {article.coverImageUrl && (
        <Container className="max-w-[1000px] pt-10">
          <figure>
            <MediaImage src={article.coverImageUrl} alt={article.coverImageAlt || ''} className="w-full object-cover" />
            {article.coverImageAlt && <figcaption className="mt-2 text-[0.875rem] text-muted">{article.coverImageAlt}</figcaption>}
          </figure>
        </Container>
      )}

      {videoEmbed(article.videoUrl) && (
        <Container className="max-w-[1000px] pt-10">
          <VideoPlayer url={article.videoUrl} title={`Video: ${article.title}`} />
        </Container>
      )}

      <Container narrow className="py-12 sm:py-14">
        <ArticleBody content={article.content || ''} dir={dir} lang={article.language} />

        {article.sourceLinks && (
          <aside className="mt-12 border-t border-line pt-8">
            <h2 className="font-sans text-[1rem] font-semibold">Sources</h2>
            <p className="mt-3 text-[0.9688rem] break-words whitespace-pre-line text-ink-soft">{article.sourceLinks}</p>
          </aside>
        )}

        {subtitlesOf(article.tags).length > 0 && (
          <p className="mt-6 text-[0.9375rem] text-muted">Subtitles: {subtitlesOf(article.tags).map((s) => SUBTITLE_LANGUAGES.find((l) => l.id === s)?.label || s).join(', ')}</p>
        )}

        {visibleTags(article.tags).length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2" aria-label="Topics">
            {visibleTags(article.tags).map((tag) => (
              <li key={tag} dir="auto" className="rounded-lg bg-stone px-2.5 py-1 text-[0.875rem] text-ink-soft">{tag}</li>
            ))}
          </ul>
        )}

        {!isDraft && (
          <div className="mt-12">
            <SharePanel targetType="article" targetId={article.id} title={article.title} onShared={() => incrementArticleShare(article.id)} />
          </div>
        )}

        {article.authorDisplayName && !article.isOfficialNews && (
          <aside aria-label="About the author" className="mt-12 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
            {author?.photoUrl ? (
              <MediaImage src={author.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="shrink-0 overflow-hidden rounded-full"><Initials name={author?.displayName || article.authorDisplayName} size={64} /></span>
            )}
            <div className="min-w-0">
              <p className="text-[0.875rem] text-muted">Written by</p>
              {author ? (
                <a href={`/people/${encodeURIComponent(author.id)}`} className="font-serif text-[1.25rem] font-semibold text-ink hover:underline">{author.displayName}</a>
              ) : (
                <p className="font-serif text-[1.25rem] font-semibold">{article.authorDisplayName}</p>
              )}
              {author && (author.designation || author.chapterName) && (
                <p className="text-[0.9375rem] text-ink-soft">{[author.designation, author.chapterName && `${author.chapterName} Council`].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </aside>
        )}

        {!isDraft && <Comments parent={{ type: 'article', id: article.id, title: article.title }} />}
      </Container>

      {related.length > 0 && (
        <section className="border-t border-line bg-stone">
          <Container className="py-14">
            <h2 className="text-[1.75rem] font-semibold">More from Mashkhally Zhyanawa</h2>
            <ul className="mt-8 grid gap-8 md:grid-cols-3">
              {related.map((a) => (
                <li key={a.id}>
                  <a href={`/news/${encodeURIComponent(a.slug || a.id)}`} className="group block border-t-2 border-navy pt-5 no-underline">
                    <p className="text-[0.875rem] text-muted">{formatDate(a.publishedAt || a.createdAt)}</p>
                    <h3 dir="auto" className="mt-2 text-[1.25rem] leading-snug font-semibold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                      {a.title}
                    </h3>
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}
    </article>
  );
};
