import React from 'react';
import { PublicProfile } from '../types';
import { MediaImage } from './MediaImage';

export const Initials: React.FC<{ name: string; size?: number }> = ({ name, size = 64 }) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-navy-tint font-serif font-semibold text-navy-deep"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

export const PersonCard: React.FC<{ profile: PublicProfile }> = ({ profile }) => (
  <a
    href={`/people/${encodeURIComponent(profile.id)}`}
    className="group flex items-start gap-4 border-t border-line pt-5 no-underline"
  >
    {profile.photoUrl ? (
      <MediaImage src={profile.photoUrl} alt="" className="h-16 w-16 shrink-0 object-cover" loading="lazy" />
    ) : (
      <Initials name={profile.displayName} />
    )}
    <span className="min-w-0">
      <span className="block font-serif text-[1.25rem] leading-snug font-semibold text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
        {profile.displayName}
      </span>
      {(profile.boardTitle || profile.designation) && <span className="mt-0.5 block text-[0.9688rem] text-ink-soft">{profile.boardTitle || profile.designation}</span>}
      <span className="mt-0.5 block text-[0.9063rem] text-muted">{profile.chapterName || profile.chapterId}</span>
    </span>
  </a>
);
