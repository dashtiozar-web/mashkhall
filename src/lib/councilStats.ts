import { CityChapter, PublicProfile } from '../types';

/**
 * Live council figures, all worked out from the same public member profiles
 * as the national total: one profile per approved member, created on
 * approval, moved when a member changes council and removed when a member
 * is revoked or permanently deleted. Suspended members are not counted.
 */

export interface CouncilStat {
  council: CityChapter;
  members: number;
  /** New members in the last 30 days (added to the website in that time). */
  growth: number;
  /** 1 = most members; councils with equal numbers share a rank. */
  rank: number;
  /** 0 = fewest members, 1 = most (equal numbers get equal values). */
  t: number;
  colour: string;
}

export const GROWTH_DAYS = 30;

// Green (fewest) → yellow → orange → red (most).
const STOPS: [number, [number, number, number]][] = [
  [0, [46, 158, 91]],
  [0.36, [242, 194, 48]],
  [0.7, [240, 138, 36]],
  [1, [215, 38, 61]],
];

export const heatColour = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    const [t0, c0] = STOPS[i - 1];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0 || 1);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return 'rgb(215, 38, 61)';
};

export const HEAT_LEGEND = STOPS.map(([t]) => heatColour(t));

export const councilStats = (councils: CityChapter[], profiles: PublicProfile[], now = Date.now()): CouncilStat[] => {
  const active = profiles.filter((p) => p.membershipStatus !== 'suspended');
  const since = now - GROWTH_DAYS * 86_400_000;
  const rows = councils.map((c) => {
    const mine = active.filter((p) => p.chapterId === c.id);
    return {
      council: c,
      members: new Set(mine.map((p) => p.id)).size,
      growth: mine.filter((p) => p.listedAt && Date.parse(p.listedAt) >= since).length,
    };
  });
  const counts = rows.map((r) => r.members);
  const min = Math.min(...counts, 0);
  const max = Math.max(...counts, 0);
  // Ties: equal numbers always get the same rank and the same colour.
  const sorted = [...rows].sort((a, b) => b.members - a.members || a.council.name.localeCompare(b.council.name));
  return sorted.map((r) => {
    const t = max === min ? 0 : (r.members - min) / (max - min);
    return { ...r, rank: 1 + sorted.filter((x) => x.members > r.members).length, t, colour: heatColour(t) };
  });
};
