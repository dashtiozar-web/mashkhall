/**
 * Activity levels: 18 steps from Bronze I to Ace III, 100 points apart.
 * Every member starts at Bronze I with 0 points.
 */
export const LEVEL_GROUPS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ace'] as const;
export type LevelGroup = (typeof LEVEL_GROUPS)[number];

export const POINTS_PER_LEVEL = 100;

export interface Level {
  index: number; // 0..17
  number: number; // 1..18
  name: string; // "Silver II"
  group: LevelGroup;
  tier: 'I' | 'II' | 'III';
  minPoints: number;
}

export const LEVELS: Level[] = LEVEL_GROUPS.flatMap((group, g) =>
  (['I', 'II', 'III'] as const).map((tier, t) => {
    const index = g * 3 + t;
    return { index, number: index + 1, name: `${group} ${tier}`, group, tier, minPoints: index * POINTS_PER_LEVEL };
  }),
);

export const MAX_LEVEL = LEVELS[LEVELS.length - 1];

export interface LevelProgress {
  level: Level;
  next: Level | null;
  points: number;
  /** Points earned within the current level (e.g. 75 of 100). */
  intoLevel: number;
  /** Points needed for the next level from the start of this one (100), or 0 at the top. */
  levelSize: number;
  /** Points still needed to reach the next level. */
  toNext: number;
  /** 0..1 */
  ratio: number;
}

export const levelFor = (points = 0): LevelProgress => {
  const p = Math.max(0, Math.floor(points || 0));
  const index = Math.min(LEVELS.length - 1, Math.floor(p / POINTS_PER_LEVEL));
  const level = LEVELS[index];
  const next = LEVELS[index + 1] || null;
  const intoLevel = next ? p - level.minPoints : POINTS_PER_LEVEL;
  return {
    level,
    next,
    points: p,
    intoLevel,
    levelSize: next ? POINTS_PER_LEVEL : 0,
    toNext: next ? next.minPoints - p : 0,
    ratio: next ? intoLevel / POINTS_PER_LEVEL : 1,
  };
};

/** Colours for each level group (badge background, text). */
export const LEVEL_COLOURS: Record<LevelGroup, { bg: string; fg: string; ring: string }> = {
  Bronze: { bg: '#F3E1D0', fg: '#7A4419', ring: '#C77B3A' },
  Silver: { bg: '#E7EAEE', fg: '#3E4651', ring: '#9AA4B1' },
  Gold: { bg: '#FBEFC8', fg: '#7A5A00', ring: '#D9A520' },
  Platinum: { bg: '#E1F1F0', fg: '#1F5E5B', ring: '#5FB3AE' },
  Diamond: { bg: '#E3ECFB', fg: '#203F7A', ring: '#5B8DEF' },
  Ace: { bg: '#F6E0E4', fg: '#7E1022', ring: '#C2361A' },
};
