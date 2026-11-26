import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { videoEmbed } from '../lib/video';

const FB_SHARE = /facebook\.com\/share\/(v|r)\//i;
const resolved = new Map<string, string>();

/**
 * Facebook's short share links (facebook.com/share/v/…) cannot be played by
 * Facebook's own player, so the website first looks up the video's full
 * address.
 */
const usePlayableUrl = (url?: string) => {
  const [full, setFull] = useState(() => (url && resolved.get(url)) || '');
  useEffect(() => {
    if (!url || !FB_SHARE.test(url) || resolved.has(url)) { setFull((url && resolved.get(url)) || ''); return; }
    let alive = true;
    fetch(`/api/video-link?url=${encodeURIComponent(url.trim())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string } | null) => { if (d?.url) { resolved.set(url, d.url); if (alive) setFull(d.url); } })
      .catch(() => { /* fall back to the link as given */ });
    return () => { alive = false; };
  }, [url]);
  return full || url;
};

/** Plays a YouTube, Vimeo or Facebook video inside our page. */
export const VideoPlayer: React.FC<{ url?: string; title: string; className?: string }> = ({ url, title, className }) => {
  const playable = usePlayableUrl(url?.trim());
  const v = videoEmbed(playable);
  if (!v) return null;
  return (
    <div className={className || ''}>
      <div className={`${v.vertical ? 'mx-auto aspect-[9/16] max-w-[360px]' : 'aspect-video'} relative w-full overflow-hidden rounded-xl bg-ink`}>
        <iframe
          key={v.src}
          src={v.src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {v.provider === 'facebook' && url && (
        <p className="mt-2 text-[0.875rem]">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-navy underline underline-offset-2">
            Watch on Facebook <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </p>
      )}
    </div>
  );
};
