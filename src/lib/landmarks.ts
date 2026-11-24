import { CityChapter } from '../types';

/**
 * A landmark picture for each member group. Administrators can upload their
 * own photo for any group (Administration → Councils); until then the
 * built-in animated illustrations below (public/kurdistan) are used.
 */

export interface LandmarkPhoto {
  url: string;
  /** Photographer and licence, shown under the photo. */
  credit: string;
  /** Page with full details of the photo and its licence. */
  source: string;
}

export interface Landmark {
  /** What the photo shows, e.g. "Big Ben and the Houses of Parliament". */
  name: string;
  photos: LandmarkPhoto[];
  /** Map position (latitude, longitude). */
  lat: number;
  lng: number;
  /** Part of the UK the council serves (for the map). */
  region: string;
}

const commons = (file: string, credit = 'Wikimedia Commons (free licence)'): LandmarkPhoto => {
  const name = file.replace(/ /g, '_');
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1920`,
    credit,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
  };
};

const geograph = (id: string, path: string, who: string): LandmarkPhoto => ({
  url: `https://s0.geograph.org.uk/${path}`,
  credit: `${who}, CC BY-SA 2.0, via Geograph`,
  source: `https://www.geograph.org.uk/photo/${id}`,
});

/** An animated illustration made for this website (no photo credit needed). */
const scene = (id: string): LandmarkPhoto => ({ url: `/kurdistan/${id}.svg`, credit: 'Illustration: Mashkhally Zhyanawa', source: '' });

export const LANDMARKS: Record<string, Landmark> = {
  britain: {
    name: 'Big Ben and Westminster, with the flag of Kurdistan',
    lat: 51.5007, lng: -0.1246, region: 'Britain',
    photos: [scene('britain')],
  },
  australia: {
    name: 'Sydney Opera House, with the flag of Kurdistan',
    lat: -33.8568, lng: 151.2153, region: 'Australia',
    photos: [scene('australia')],
  },
  canada: {
    name: 'The CN Tower, Toronto, with the flag of Kurdistan',
    lat: 43.6426, lng: -79.3871, region: 'Canada',
    photos: [scene('canada')],
  },
  germany: {
    name: 'The Brandenburg Gate, Berlin, with the flag of Kurdistan',
    lat: 52.5163, lng: 13.3777, region: 'Germany',
    photos: [scene('germany')],
  },
  usa: {
    name: 'The Statue of Liberty, New York, with the flag of Kurdistan',
    lat: 40.6892, lng: -74.0445, region: 'USA',
    photos: [scene('usa')],
  },
  sulaymaniyah: {
    name: 'Sulaymaniyah beneath Goyzha mountain',
    lat: 35.5613, lng: 45.4303, region: 'Kurdistan',
    photos: [scene('sulaymaniyah')],
  },
  erbil: {
    name: 'The Citadel of Erbil',
    lat: 36.1912, lng: 44.0092, region: 'Kurdistan',
    photos: [scene('erbil')],
  },
  duhok: {
    name: 'Duhok, its dam and mountains',
    lat: 36.8669, lng: 42.9503, region: 'Kurdistan',
    photos: [scene('duhok')],
  },
  halabja: {
    name: 'Halabja beneath the Hawraman mountains',
    lat: 35.1778, lng: 45.9861, region: 'Kurdistan',
    photos: [scene('halabja')],
  },
  kirkuk: {
    name: 'Kirkuk citadel and the eternal fire of Baba Gurgur',
    lat: 35.4681, lng: 44.3922, region: 'Kurdistan',
    photos: [scene('kirkuk')],
  },
};

/** Photos for a council: the administrator's own first, then the built-in ones. */
export const councilPhotos = (c: Pick<CityChapter, 'id' | 'landmarkImage' | 'landmarkCredit'>): LandmarkPhoto[] => {
  const own = c.landmarkImage ? [{ url: c.landmarkImage, credit: c.landmarkCredit || '', source: '' }] : [];
  return [...own, ...(LANDMARKS[c.id]?.photos || [])];
};

export const landmarkName = (c: Pick<CityChapter, 'id' | 'landmarkName' | 'name'>) =>
  c.landmarkName || LANDMARKS[c.id]?.name || `${c.name}`;

/** Map position: set by an administrator, or the built-in one. */
export const councilPosition = (c: Pick<CityChapter, 'id' | 'lat' | 'lng'>) =>
  typeof c.lat === 'number' && typeof c.lng === 'number'
    ? { lat: c.lat, lng: c.lng }
    : LANDMARKS[c.id] ? { lat: LANDMARKS[c.id].lat, lng: LANDMARKS[c.id].lng } : null;
