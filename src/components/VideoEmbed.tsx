import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { isFacebookShareLink, videoEmbed } from '../lib/video';

/** Plays a YouTube, Vimeo or Facebook video inside our page. */
export const VideoPlayer: React.FC<{ url?: string; title: string; className?: string }> = ({ url, title, className }) => {
  const v = videoEmbed(url);
  if (!v || !url) return null;
  // Facebook will not play its short share links on other websites:
  // offer the video on Facebook instead of a broken player.
  if (isFacebookShareLink(url)) {
    return (
      <div className={className || ''}>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="group relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-[#1F100B] via-[#3A1A10] to-[#7A2414] text-white no-underline">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1877F2] shadow-lg transition-transform group-hover:scale-105">
            <Play className="ms-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-1.5 text-[1.0625rem] font-semibold">Watch this video on Facebook <ExternalLink className="h-4 w-4" aria-hidden="true" /></span>
        </a>
      </div>
    );
  }
  return (
    <div className={className || ''}>
      <div className={`${v.vertical ? 'mx-auto aspect-[9/16] max-w-[360px]' : 'aspect-video'} relative w-full overflow-hidden rounded-xl bg-ink`}>
        <iframe
          src={v.src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {v.provider === 'facebook' && (
        <p className="mt-2 text-[0.875rem]">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-navy underline underline-offset-2">
            Watch on Facebook <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </p>
      )}
    </div>
  );
};
