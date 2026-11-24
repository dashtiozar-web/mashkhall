import React from 'react';
import { videoEmbed } from '../lib/video';

/** Plays a YouTube, Vimeo or Facebook video inside our page. */
export const VideoPlayer: React.FC<{ url?: string; title: string; className?: string }> = ({ url, title, className }) => {
  const v = videoEmbed(url);
  if (!v) return null;
  return (
    <div className={`${v.vertical ? 'mx-auto aspect-[9/16] max-w-[360px]' : 'aspect-video'} relative w-full overflow-hidden rounded-xl bg-ink ${className || ''}`}>
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
  );
};
