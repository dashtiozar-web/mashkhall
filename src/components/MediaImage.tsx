import React, { useEffect, useState } from 'react';
import { isMediaRef, resolveImage } from '../lib/media';

/** <img> that understands uploaded images (media:<id>) as well as normal URLs. */
export const MediaImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src?: string }> = ({ src, alt = '', className, ...rest }) => {
  const [resolved, setResolved] = useState<string | null>(src && !isMediaRef(src) ? src : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!src) { setResolved(null); return; }
    if (!isMediaRef(src)) { setResolved(src); return; }
    setResolved(null);
    resolveImage(src).then((url) => { if (!cancelled) { setResolved(url); setFailed(!url); } });
    return () => { cancelled = true; };
  }, [src]);

  if (!src || failed) return null;
  if (!resolved) return <span className={`block animate-pulse bg-stone ${className || ''}`} aria-hidden="true" />;
  return <img src={resolved} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} {...rest} />;
};
