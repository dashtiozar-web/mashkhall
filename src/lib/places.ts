import { CityChapter } from '../types';

/**
 * Where Mashkhally Zhyanawa's members are: five countries abroad, and
 * Kurdistan with its five provinces. Every group (stored as a "chapter") is
 * one of the countries abroad or one of the provinces; a member also names
 * the city or town they joined from.
 */

export interface Country { id: string; name: string; ku: string }
export interface Province { id: string; name: string; ku: string; cities: string[] }

export const KURDISTAN = 'kurdistan';

export const COUNTRIES: Country[] = [
  { id: 'britain', name: 'Britain', ku: 'بەریتانیا' },
  { id: 'australia', name: 'Australia', ku: 'ئوسترالیا' },
  { id: 'canada', name: 'Canada', ku: 'کەنەدا' },
  { id: 'germany', name: 'Germany', ku: 'ئەڵمانیا' },
  { id: 'usa', name: 'USA', ku: 'ئەمریکا' },
  { id: KURDISTAN, name: 'Kurdistan', ku: 'کوردستان' },
];

/** The five provinces, with the main cities and towns offered as suggestions. */
export const PROVINCES: Province[] = [
  { id: 'sulaymaniyah', name: 'Sulaymaniyah', ku: 'سلێمانی', cities: ['Sulaymaniyah', 'Ranya', 'Qaladiza', 'Chamchamal', 'Kalar', 'Darbandikhan', 'Dukan', 'Penjwen', 'Said Sadiq', 'Sharazur', 'Mawat', 'Sharbazher', 'Qaradagh', 'Kifri', 'Khanaqin'] },
  { id: 'erbil', name: 'Erbil', ku: 'هەولێر', cities: ['Erbil', 'Koya', 'Shaqlawa', 'Soran', 'Rawanduz', 'Choman', 'Mergasor', 'Khabat', 'Makhmur', 'Dashti Hawler', 'Harir'] },
  { id: 'duhok', name: 'Duhok', ku: 'دهۆک', cities: ['Duhok', 'Zakho', 'Amedi', 'Akre', 'Semel', 'Shekhan', 'Bardarash', 'Sarsing', 'Deraluk'] },
  { id: 'halabja', name: 'Halabja', ku: 'هەڵەبجە', cities: ['Halabja', 'Hawraman', 'Khurmal', 'Byara', 'Sirwan', 'Tawella'] },
  { id: 'kirkuk', name: 'Kirkuk', ku: 'کەرکووک', cities: ['Kirkuk', 'Dibis', 'Daquq', 'Hawija', 'Prde (Altun Kupri)', 'Shwan', 'Qara Hanjir'] },
];

export const PROVINCE_IDS = PROVINCES.map((p) => p.id);
export const ABROAD_IDS = COUNTRIES.filter((c) => c.id !== KURDISTAN).map((c) => c.id);
export const GROUP_IDS = [...ABROAD_IDS, ...PROVINCE_IDS];

/** The councils of the earlier United Kingdom structure, no longer shown. */
export const RETIRED_GROUP_IDS = ['london', 'birmingham', 'manchester', 'newcastle', 'glasgow', 'cardiff'];

export const isProvince = (id?: string) => Boolean(id && PROVINCE_IDS.includes(id));

/** The country a group belongs to: Kurdistan for a province, otherwise the group itself. */
export const countryOfGroup = (id?: string) => (isProvince(id) ? KURDISTAN : id || '');

export const countryName = (id?: string) => COUNTRIES.find((c) => c.id === id)?.name || '';
export const provinceName = (id?: string) => PROVINCES.find((p) => p.id === id)?.name || '';

/** "Sulaymaniyah, Kurdistan" or "Britain". */
export const groupLabel = (g?: Pick<CityChapter, 'id' | 'name'>) =>
  !g ? '' : isProvince(g.id) ? `${g.name}, Kurdistan` : g.name;

/** Other spellings of Kurdistan's cities, so each city is counted once. */
const CITY_SPELLINGS: Record<string, string> = {
  rania: 'Ranya', raniya: 'Ranya', ranya: 'Ranya', ranye: 'Ranya',
  qaladiza: 'Qaladiza', qalladiza: 'Qaladiza', qaladze: 'Qaladiza', qaladize: 'Qaladiza', qalatdiza: 'Qaladiza',
  rawanduz: 'Rawanduz', rwandiz: 'Rawanduz', rawandiz: 'Rawanduz', rewanduz: 'Rawanduz', rowanduz: 'Rawanduz', rwanduz: 'Rawanduz',
  soran: 'Soran', diana: 'Soran', diyana: 'Soran',
  dukan: 'Dukan', dwkan: 'Dukan', dokan: 'Dukan',
  choman: 'Choman', chuman: 'Choman',
  darbandikhan: 'Darbandikhan', derbendikhan: 'Darbandikhan', darbandixan: 'Darbandikhan', darbandkhan: 'Darbandikhan',
  kalar: 'Kalar', kelar: 'Kalar',
  kifri: 'Kifri', kfry: 'Kifri', kifry: 'Kifri', kfri: 'Kifri',
  akre: 'Akre', akri: 'Akre', aqrah: 'Akre', akra: 'Akre', akrê: 'Akre',
  zakho: 'Zakho', zaxo: 'Zakho', zakhu: 'Zakho',
  chamchamal: 'Chamchamal', chemchemal: 'Chamchamal', chamchemal: 'Chamchamal',
  saidsadiq: 'Said Sadiq', saydsadiq: 'Said Sadiq', sayidsadiq: 'Said Sadiq', seyidsadiq: 'Said Sadiq',
  sharazur: 'Sharazur', sharazwr: 'Sharazur', sharazoor: 'Sharazur', shahrizor: 'Sharazur', shahrazur: 'Sharazur',
  penjwen: 'Penjwen', penjwin: 'Penjwen', penjween: 'Penjwen', panjwen: 'Penjwen',
  hawraman: 'Hawraman', horaman: 'Hawraman', hewraman: 'Hawraman', uraman: 'Hawraman',
  sulaymaniyah: 'Sulaymaniyah', sulaimani: 'Sulaymaniyah', slemani: 'Sulaymaniyah', sulaimaniya: 'Sulaymaniyah', sulaymaniya: 'Sulaymaniyah', silemani: 'Sulaymaniyah',
  erbil: 'Erbil', hawler: 'Erbil', hewler: 'Erbil', arbil: 'Erbil', irbil: 'Erbil',
  duhok: 'Duhok', dohuk: 'Duhok', dihok: 'Duhok',
  amedi: 'Amedi', amadiya: 'Amedi', amadiyah: 'Amedi', amedy: 'Amedi',
};

/** A tidy form of a city name, so "  ranya", "Rania" and "Ranya" count as one city. */
export const normaliseCity = (raw?: string) => {
  const tidy = (raw || '').trim().replace(/\s+/g, ' ').replace(/(^|[\s-])(\p{Ll})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
  return CITY_SPELLINGS[tidy.toLowerCase().replace(/[\s'’.-]/g, '')] || tidy;
};
