import React from 'react';
import { Play } from 'lucide-react';

/** A large round play button over a video's picture, so it is clearly a video. */
export const PlayBadge: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'lg' }) => (
  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-black/10 to-transparent" aria-hidden="true">
    <span className={`flex items-center justify-center rounded-full bg-[#B3261E]/90 text-white shadow-[0_4px_18px_rgba(0,0,0,0.45)] ring-2 ring-white/85 transition-transform group-hover:scale-110 ${size === 'lg' ? 'h-16 w-16' : 'h-11 w-11'}`}>
      <Play className={`${size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} ms-0.5`} fill="currentColor" />
    </span>
  </span>
);
