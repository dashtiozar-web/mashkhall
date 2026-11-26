/**
 * Turn a pasted video link into a player that plays on our own pages, so
 * visitors stay on the website. Videos stay hosted (free) on YouTube,
 * Vimeo or Facebook; nothing is stored in our database.
 */
export type VideoProvider = 'youtube' | 'vimeo' | 'facebook';

export interface VideoEmbed {
  provider: VideoProvider;
  src: string;
  /** Vertical videos (YouTube Shorts, Reels) are shown taller. */
  vertical: boolean;
}

/** A Facebook video address without app tracking (e.g. ?mibextid=…), as Facebook's player expects. */
const facebookHref = (url: string) => {
  const u = url.replace(/^https?:\/\/(m|web)\./i, 'https://www.');
  try {
    const p = new URL(u);
    const v = p.searchParams.get('v');
    return `https://www.facebook.com${p.pathname}${v ? `?v=${v}` : ''}`;
  } catch { return u; }
};

export const videoEmbed = (raw?: string): VideoEmbed | null => {
  const url = (raw || '').trim();
  if (!url) return null;

  // YouTube: watch?v=, youtu.be/, /shorts/, /live/, /embed/, music.youtube, m.youtube
  const yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) {
    const t = url.match(/[?&](?:t|start)=(\d+)(?:s)?/);
    const params = new URLSearchParams({ rel: '0', playsinline: '1', ...(t ? { start: t[1] } : {}) });
    return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?${params}`, vertical: /\/shorts\//i.test(url) };
  }

  const vm = url.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d+)/i);
  if (vm) return { provider: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}?dnt=1`, vertical: false };

  // Facebook videos and reels, including the short links from Facebook's
  // Share button (facebook.com/share/v/… and /share/r/…).
  if (/^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\//i.test(url) && /\/(videos?|reel|watch)\b|\/share\/(v|r)\/|fb\.watch/i.test(url)) {
    return {
      provider: 'facebook',
      src: `https://www.facebook.com/plugins/video.php?${new URLSearchParams({ href: facebookHref(url), show_text: 'false' })}`,
      vertical: /\/reel\/|\/share\/r\//i.test(url),
    };
  }
  return null;
};

/** Short links from Facebook's Share button (facebook.com/share/v/…). */
export const isFacebookShareLink = (raw?: string) => /facebook\.com\/share\/(v|r)\//i.test(raw || '');

export const FACEBOOK_SHARE_HELP = 'This is a Facebook share link, which Facebook does not allow to play on other websites. Open it in your browser, wait for the video to load, then copy the full address from the address bar (it contains /videos/ or /reel/ and a long number) and paste that here. The video must be Public.';

/** Why a pasted video link cannot be used, or '' when it can. */
export const videoLinkProblem = (raw?: string) => {
  if (!(raw || '').trim()) return '';
  if (isFacebookShareLink(raw)) return FACEBOOK_SHARE_HELP;
  return videoEmbed(raw) ? '' : VIDEO_HELP;
};

export const VIDEO_HELP = 'Paste a link from YouTube, Vimeo or a Facebook video. It plays on our website; nothing is uploaded here.';

/** A still image for a video: our uploaded thumbnail, else YouTube's own. */
export const videoThumbnail = (url?: string): string => {
  const yt = (url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/i);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : '';
};

/**
 * Video details kept in a publication's tags, so they need no new database
 * fields: subtitle languages ("subtitles:ckb") and whether the video is shown
 * only in the Videos section ("videos-only") rather than also in News.
 */
export const SUBTITLE_TAG = 'subtitles:';
export const VIDEOS_ONLY_TAG = 'videos-only';
export const SUBTITLE_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ckb', label: 'Kurdish (Sorani)' },
  { id: 'ar', label: 'Arabic' },
];
export const isSystemTag = (t: string) => t.startsWith(SUBTITLE_TAG) || t === VIDEOS_ONLY_TAG;
export const subtitlesOf = (tags?: string[]) => (tags || []).filter((t) => t.startsWith(SUBTITLE_TAG)).map((t) => t.slice(SUBTITLE_TAG.length));
export const visibleTags = (tags?: string[]) => (tags || []).filter((t) => !isSystemTag(t));

/** "protest, Sulaimani; press freedom" → up to 8 clean tags. */
export const parseTags = (raw: string) => [...new Set(raw.split(/[,،;\n]+/).map((t) => t.trim().replace(/^#/, '').slice(0, 40)).filter((t) => t.length >= 2 && !isSystemTag(t)))].slice(0, 8);

/** The tags stored for a video: the contributor's topics plus the video details. */
export const videoTags = (topics: string, subtitles: string[], videosOnly: boolean) => [
  ...parseTags(topics),
  ...subtitles.filter((s) => SUBTITLE_LANGUAGES.some((l) => l.id === s)).map((s) => `${SUBTITLE_TAG}${s}`),
  ...(videosOnly ? [VIDEOS_ONLY_TAG] : []),
];
