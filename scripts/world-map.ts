/**
 * Builds src/data/worldMap.json: one SVG outline per country (by ISO
 * alpha-2 code) for the visitor map, from Natural Earth 1:110m data
 * (world-atlas, public domain). Run once when the map needs regenerating:
 *   npx tsx scripts/world-map.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'));
const geo = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;

const W = 960;
const H = 470;
const projection = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], {
  type: 'FeatureCollection',
  features: geo.features.filter((f) => (f.properties as { name?: string })?.name !== 'Antarctica'),
} as GeoJSON.FeatureCollection);
const path = geoPath(projection);

// Places without an ISO number in the data, by name.
const BY_NAME: Record<string, string> = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO' };

const shapes: Record<string, string> = {};
const centres: Record<string, [number, number]> = {};
for (const f of geo.features) {
  const name = (f.properties as { name?: string })?.name || '';
  if (name === 'Antarctica') continue;
  const code = BY_NAME[name] || countries.numericToAlpha2(String(f.id).padStart(3, '0'));
  if (!code) { console.warn('No code for', f.id, name); continue; }
  const d = path(f);
  if (!d) continue;
  // Round to whole pixels: much smaller, and invisible at this size.
  const compact = d.replace(/(\d+\.\d+)/g, (n) => String(Math.round(Number(n))));
  shapes[code] = shapes[code] ? `${shapes[code]}${compact}` : compact;
  if (!centres[code]) {
    const [x, y] = path.centroid(f);
    centres[code] = [Math.round(x), Math.round(y)];
  }
}

// Countries too small for the 1:110m outlines: a dot at their position (lon, lat).
const SMALL: Record<string, [number, number]> = {
  BH: [50.55, 26.07], MT: [14.4, 35.9], SG: [103.82, 1.35], LU: [6.13, 49.61], AD: [1.52, 42.51], MC: [7.42, 43.74],
  LI: [9.55, 47.16], SM: [12.46, 43.94], VA: [12.45, 41.9], HK: [114.17, 22.32], MO: [113.54, 22.2], MU: [57.55, -20.35],
  MV: [73.22, 3.2], BB: [-59.54, 13.19], SC: [55.45, -4.68], GI: [-5.35, 36.14], IM: [-4.55, 54.23], JE: [-2.13, 49.21],
  GG: [-2.58, 49.45], KM: [43.87, -11.88], CV: [-23.6, 15.1], ST: [6.61, 0.19], TO: [-175.2, -21.18], WS: [-172.1, -13.76],
  BM: [-64.78, 32.3], KY: [-81.25, 19.31], AG: [-61.8, 17.06], DM: [-61.37, 15.41], LC: [-60.98, 13.91], GD: [-61.68, 12.12],
  VC: [-61.2, 13.25], KN: [-62.78, 17.36], AW: [-69.97, 12.52], CW: [-68.99, 12.17], PS: [35.2, 31.9], FO: [-6.91, 61.89],
  AX: [19.92, 60.18], PF: [-149.4, -17.68], RE: [55.53, -21.12], GP: [-61.55, 16.25], MQ: [-61.02, 14.64], GU: [144.79, 13.44],
  PR: [-66.5, 18.22], FJ: [178.07, -17.71], KI: [-157.36, 1.87], MH: [171.18, 7.13], FM: [158.2, 6.92], PW: [134.58, 7.51],
  NR: [166.93, -0.52], TV: [179.2, -8.52], BN: [114.73, 4.54], TL: [125.73, -8.87],
};
for (const [code, lonLat] of Object.entries(SMALL)) {
  if (shapes[code] || centres[code]) continue;
  const p = projection(lonLat);
  if (p) centres[code] = [Math.round(p[0]), Math.round(p[1])];
}

// The Kurdistan Region of Iraq (Erbil, Sulaymaniyah, Duhok and Halabja),
// counted separately from the rest of Iraq: an approximate outline of the
// area the Kurdistan Regional Government administers (lon, lat).
const KURDISTAN_REGION: [number, number][] = [
  [42.36, 37.11], [42.79, 37.38], [43.33, 37.33], [44.12, 37.32], [44.62, 37.18], [44.79, 37.0],
  [45.0, 36.7], [45.38, 36.33], [45.65, 35.95], [45.97, 35.69], [46.15, 35.3], [45.98, 35.08],
  [45.6, 35.05], [45.2, 35.25], [44.82, 35.5], [44.5, 35.75], [44.15, 35.98], [43.75, 36.08],
  [43.45, 36.45], [43.12, 36.62], [42.75, 36.75], [42.45, 36.9],
];
{
  const ring = [...KURDISTAN_REGION, KURDISTAN_REGION[0]];
  const f: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  const d = path(f);
  if (d) {
    shapes['IQ-KR'] = d.replace(/(\d+\.\d+)/g, (n) => String(Math.round(Number(n))));
    const [x, y] = path.centroid(f);
    centres['IQ-KR'] = [Math.round(x), Math.round(y)];
  }
}

writeFileSync('src/data/worldMap.json', JSON.stringify({ width: W, height: H, shapes, centres }));
console.log(`${Object.keys(shapes).length} countries written to src/data/worldMap.json`);
