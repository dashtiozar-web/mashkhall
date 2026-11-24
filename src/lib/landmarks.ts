import { CityChapter } from '../types';

/**
 * A landmark photograph for each member group. Administrators can upload
 * their own photo for any group (Administration → Provinces and countries);
 * until then the built-in photographs below are used. They are freely
 * licensed photographs from Wikimedia Commons, shown with credit and a link
 * to the photo's page (author and licence). If one cannot be loaded, the
 * next one is tried.
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

export const commons = (file: string, author = ''): LandmarkPhoto => {
  const credit = author ? `Photo: ${author}, via Wikimedia Commons (free licence)` : 'Photo: Wikimedia Commons (free licence)';
  const name = file.replace(/ /g, '_');
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1920`,
    credit,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
  };
};

export const LANDMARKS: Record<string, Landmark> = {
  britain: {
    name: 'Big Ben and the Palace of Westminster, London',
    lat: 51.5007, lng: -0.1246, region: 'Britain',
    photos: [commons("Palace of Westminster from the dome on Methodist Central Hall.jpg", "Colin")],
  },
  australia: {
    name: 'Sydney Opera House',
    lat: -33.8568, lng: 151.2153, region: 'Australia',
    photos: [commons("Sydney Opera House and Harbour Bridge Dusk (2) 2019-06-21.jpg"), commons("Sydneyoperahouse at night.jpg"), commons("Sydney Opera House - Dec 2008.jpg")],
  },
  canada: {
    name: 'Toronto and the CN Tower',
    lat: 43.6426, lng: -79.3871, region: 'Canada',
    photos: [commons("Toronto - ON - Skyline bei Nacht.jpg"), commons("Toronto-CN-tower-and-Canadian-flag-skyline.jpg", "Jchmrt")],
  },
  germany: {
    name: 'The Brandenburg Gate, Berlin',
    lat: 52.5163, lng: 13.3777, region: 'Germany',
    photos: [commons("Brandenburger Tor abends.jpg", "Thomas Wolf, www.foto-tw.de"), commons("Brandenburger Tor nachts 2012-07.jpg", "Thomas Wolf, www.foto-tw.de")],
  },
  usa: {
    name: 'The Statue of Liberty, New York',
    lat: 40.6892, lng: -74.0445, region: 'USA',
    photos: [commons("Statue Of Liberty (23478051151).jpg"), commons("Statue of Liberty 3a.jpg", "PumpkinSky")],
  },
  sulaymaniyah: {
    name: 'Sulaymaniyah at night, from Azmar mountain',
    lat: 35.5613, lng: 45.4303, region: 'Kurdistan',
    photos: [commons("Sulaymaniyah at Night.jpg", "Sarbast T. Hameed"), commons("View of Sulaymaniyah (Sulaimani) City , Kurdistan.jpg", "Diyar Muhammed"), commons("Sulaimani (Slemani) City - Kurdistan - Iraq.jpg", "Diyar Muhammed")],
  },
  erbil: {
    name: 'The Citadel of Erbil',
    lat: 36.1912, lng: 44.0092, region: 'Kurdistan',
    photos: [commons("The Citadel of Erbil, Hawler, Erbil Governorate, Iraq.jpg", "Osama Shukir Muhammed Amin"), commons("View of the Erbil citadel in Erbil (Hawler, Arbil, Irbil) in the Kurdistan Region of Iraq.jpg", "Levi Clancy"), commons("12. Erbil Citadel, Erbil Governorate, Iraqi Kurdistan.jpg", "Osama Shukir Muhammed Amin")],
  },
  duhok: {
    name: 'Duhok, from Barzani Park',
    lat: 36.8669, lng: 42.9503, region: 'Kurdistan',
    photos: [commons("Panorama of Duhok.jpg", "Ahmadkurdi44"), commons("Duhok, Kurdistan, Iraq.JPG", "Kovan kurdish"), commons("Duhok City 2.jpg")],
  },
  halabja: {
    name: 'The Halabja Monument',
    lat: 35.1778, lng: 45.9861, region: 'Kurdistan',
    photos: [commons("Halabja Monument Museum (15947763505).jpg", "Enno Lenze"), commons("Halabja monuments.jpg"), commons("Khurmal, Halabja.jpg", "Hiwa Sherzad")],
  },
  kirkuk: {
    name: 'The Citadel of Kirkuk',
    lat: 35.4681, lng: 44.3922, region: 'Kurdistan',
    photos: [commons("Aerial view of Kirkuk Citadel, Kirkuk, Iraq.jpg", "Enasiqph"), commons("Shrine of Gok Cumbet, on the Kirkuk Citadel. Kurdistan and Iraq flags.jpg")],
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
