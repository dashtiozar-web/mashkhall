import React, { useEffect, useState } from 'react';
import { CityChapter } from '../types';
import { councilPhotos, landmarkName, LandmarkPhoto } from '../lib/landmarks';
import { isMediaRef, resolveImage } from '../lib/media';

/** The current landmark photo of a council, moving on to the next if one fails to load. */
export const useLandmarkPhoto = (c: Pick<CityChapter, 'id' | 'landmarkImage' | 'landmarkCredit'>) => {
  const photos = councilPhotos(c);
  const [index, setIndex] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const key = photos.map((p) => p.url).join('|');
  useEffect(() => { setIndex(0); }, [key]);
  const photo: LandmarkPhoto | undefined = photos[index];
  useEffect(() => {
    let live = true;
    if (!photo) { setSrc(null); return; }
    if (isMediaRef(photo.url)) resolveImage(photo.url).then((u) => { if (live) { if (u) setSrc(u); else setIndex((i) => i + 1); } });
    else setSrc(photo.url);
    return () => { live = false; };
  }, [photo?.url]);
  return { photo, src, failed: () => setIndex((i) => i + 1) };
};

export const LandmarkImage: React.FC<{
  council: CityChapter;
  className?: string;
  credit?: boolean;
  loading?: 'lazy' | 'eager';
}> = ({ council, className = '', credit, loading = 'lazy' }) => {
  const { photo, src, failed } = useLandmarkPhoto(council);
  if (!photo || !src) {
    return <div className={`band-texture ${className}`} aria-hidden="true" />;
  }
  return (
    <figure className="relative m-0">
      <img src={src} alt={landmarkName(council)} loading={loading} decoding="async" referrerPolicy="no-referrer"
        onError={failed} className={`bg-stone-deep object-cover ${className}`} />
      {credit && (photo.credit || photo.source) && (
        <figcaption className="mt-1.5 text-[0.75rem] text-muted">
          {landmarkName(council)}.{' '}
          {photo.source ? <a href={photo.source} target="_blank" rel="noopener noreferrer" className="underline">{photo.credit || 'Photo details'}</a> : photo.credit}
        </figcaption>
      )}
    </figure>
  );
};
