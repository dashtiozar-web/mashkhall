import React, { useState } from 'react';
import { Megaphone, X, ArrowRight } from 'lucide-react';
import { Banner } from '../types';

interface AnnouncementBarProps {
  banners: Banner[];
  onNavigate: (tab: string, param?: string) => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ banners, onNavigate }) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Filter top-bar placement and not dismissed
  const activeBanners = banners.filter(
    b => b.placement === 'announcement_bar' && !dismissedIds.includes(b.id)
  );

  if (activeBanners.length === 0) return null;

  const currentBanner = activeBanners[0]; // highest priority

  const handleDismiss = () => {
    if (currentBanner.allowDismissal) {
      setDismissedIds(prev => [...prev, currentBanner.id]);
    }
  };

  const handleAction = () => {
    if (currentBanner.actionUrl) {
      if (currentBanner.actionUrl.startsWith('http')) {
        window.location.href = currentBanner.actionUrl;
      } else {
        onNavigate(currentBanner.actionUrl);
      }
    }
  };

  return (
    <div role="region" aria-label="Announcement" className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-2.5 text-[0.9375rem] sm:px-8">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{currentBanner.title}</span>
          {currentBanner.supportingText && (
            <span className="hidden text-white/75 md:inline"> {currentBanner.supportingText}</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {currentBanner.actionLabel && (
            <button
              type="button"
              onClick={handleAction}
              className="cursor-pointer font-semibold underline decoration-white/50 underline-offset-4 hover:decoration-white"
            >
              {currentBanner.actionLabel}
            </button>
          )}
          {currentBanner.allowDismissal && (
            <button
              type="button"
              onClick={handleDismiss}
              className="cursor-pointer p-1 text-white/70 hover:text-white"
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
