import { doc, getDoc } from 'firebase/firestore';
import { db, safeSetDoc } from '../firebase';
import { MediaItem } from '../types';

/**
 * Images are compressed in the browser and stored in the `media` collection,
 * so uploads work without extra cloud storage set-up. Each image stays well
 * under Firestore's 1 MB document limit.
 */

export const MEDIA_PREFIX = 'media:';
const MAX_DATA_URL = 900_000;

export const isMediaRef = (value?: string) => Boolean(value && value.startsWith(MEDIA_PREFIX));
export const mediaRef = (id: string) => `${MEDIA_PREFIX}${id}`;
export const mediaIdFrom = (value: string) => value.slice(MEDIA_PREFIX.length);

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image we can open.')); };
    img.src = url;
  });

export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/** Resize to fit `maxDim` and re-encode as JPEG, lowering quality until it fits. */
export const compressImage = async (file: File, maxDim = 1600): Promise<CompressedImage> => {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Please choose a JPG, PNG or WebP image.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is larger than 25 MB. Please choose a smaller one.');
  const img = await loadImage(file);
  let dim = maxDim;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process that image.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    for (const quality of [0.85, 0.75, 0.65]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_DATA_URL) {
        return { dataUrl, width, height, bytes: Math.round((dataUrl.length * 3) / 4) };
      }
    }
    dim = Math.round(dim * 0.75);
  }
  throw new Error('That image could not be made small enough. Please try a different one.');
};

/** Compress and upload an image; returns a `media:<id>` reference. */
export const uploadImage = async (
  file: File,
  owner: { uid: string; name?: string },
  alt = '',
  maxDim = 1600,
): Promise<{ ref: string; image: CompressedImage }> => {
  const image = await compressImage(file, maxDim);
  const id = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const item: MediaItem = {
    id,
    dataUrl: image.dataUrl,
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    alt: alt.trim() || undefined,
    ownerUid: owner.uid,
    ownerName: owner.name,
    createdAt: new Date().toISOString(),
  };
  await safeSetDoc(doc(db, 'media', id), item);
  cache.set(id, Promise.resolve(image.dataUrl));
  return { ref: mediaRef(id), image };
};

const cache = new Map<string, Promise<string | null>>();

/** Turn an image reference (media:<id> or a normal URL) into something an <img> can show. */
export const resolveImage = (value?: string): Promise<string | null> => {
  if (!value) return Promise.resolve(null);
  if (!isMediaRef(value)) return Promise.resolve(value);
  const id = mediaIdFrom(value);
  if (!cache.has(id)) {
    cache.set(
      id,
      getDoc(doc(db, 'media', id))
        .then((snap) => (snap.exists() ? (snap.data() as MediaItem).dataUrl : null))
        .catch(() => null),
    );
  }
  return cache.get(id)!;
};
