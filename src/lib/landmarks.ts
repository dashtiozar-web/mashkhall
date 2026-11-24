import { CityChapter } from '../types';

/**
 * Landmark photographs for each council. Administrators can upload their own
 * photo for any council (Administration → Councils); until then the
 * built-in photographs below are used. They are freely licensed photographs
 * from Wikimedia Commons and Geograph Britain and Ireland, shown with credit.
 * If one cannot be loaded, the next one is tried.
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

export const LANDMARKS: Record<string, Landmark> = {
  london: {
    name: 'Big Ben, the Houses of Parliament and the London Eye',
    lat: 51.5007, lng: -0.1246, region: 'London',
    photos: [
      commons('Palace of Westminster from the dome on Methodist Central Hall.jpg', 'Colin, CC BY-SA 4.0, via Wikimedia Commons'),
      geograph('40176', 'photos/04/01/040176_de70a9e0.jpg', 'Christine Matthews'),
    ],
  },
  birmingham: {
    name: 'The Library of Birmingham, Centenary Square',
    lat: 52.4796, lng: -1.9086, region: 'West Midlands',
    photos: [
      commons('Birmingham, Library of Birmingham (23042834336).jpg'),
      geograph('7714503', 'geophotos/07/71/45/7714503_1a89ed79.jpg', 'Roger D Kidd'),
      geograph('7713964', 'geophotos/07/71/39/7713964_765292d4.jpg', 'Oliver Dixon'),
    ],
  },
  manchester: {
    name: 'Manchester Town Hall, Albert Square',
    lat: 53.4794, lng: -2.2453, region: 'North West England',
    photos: [
      commons('Manchester Town Hall and Memorial.jpg'),
      geograph('2120812', 'geophotos/02/12/08/2120812_39af309d.jpg', 'David Dixon'),
    ],
  },
  newcastle: {
    name: 'The Tyne Bridge',
    lat: 54.9681, lng: -1.6064, region: 'North East England',
    photos: [
      commons('Tyne Bridges and The Sage at dusk.jpg'),
      geograph('7190799', 'geophotos/07/19/07/7190799_27726e7f.jpg', 'habiloid'),
      geograph('6899882', 'geophotos/06/89/98/6899882_47b03cb0.jpg', 'habiloid'),
    ],
  },
  glasgow: {
    name: 'Glasgow City Chambers, George Square',
    lat: 55.8611, lng: -4.2499, region: 'Scotland',
    photos: [
      commons('Glasgow, George Square mit City Chambers (38584813792).jpg'),
      commons('City Chambers, George Square, Glasgow 05.jpg'),
    ],
  },
  cardiff: {
    name: 'Cardiff Castle',
    lat: 51.4822, lng: -3.1812, region: 'Wales',
    photos: [
      commons('Cardiff Castle - 2022-08-17.jpg'),
      geograph('7824560', 'geophotos/07/82/45/7824560_b7203458.jpg', 'DS Pugh'),
      commons('Cardiff Castle clock tower.jpg'),
    ],
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
