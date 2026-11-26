/**
 * The three kinds of membership of Mashkhally Zhyanawa.
 *  - Pêşeng (vanguard): step forward and work seriously and skilfully to move
 *    the movement on, committed to its duties. Only they take on positions
 *    and responsibilities.
 *  - Piştîwan (supporters): help when needed, financially or otherwise.
 *  - Komar (the voters): sympathise with us and help by voting.
 */
export type MembershipTier = 'peshang' | 'pishtiwan' | 'komar';

export interface TierInfo {
  id: MembershipTier;
  ku: string;
  name: string;
  description: string;
  colour: string;
}

export const TIERS: TierInfo[] = [
  {
    id: 'peshang', ku: 'پێشەنگ', name: 'Pêşeng (vanguard)', colour: '#B3261E',
    description: 'You come forward and work seriously and skilfully to move the movement forward, committed to its duties and work. Only Pêşeng members take on positions and responsibilities.',
  },
  {
    id: 'pishtiwan', ku: 'پشتیوان', name: 'Piştîwan (supporter)', colour: '#E08A1E',
    description: 'You help when it is needed, for example with financial support or whatever else the movement needs.',
  },
  {
    id: 'komar', ku: 'کۆمار', name: 'Komar (voter)', colour: '#2E7D5B',
    description: 'You sympathise with us and help us by giving us your vote.',
  },
];

export const TIER_IDS = TIERS.map((t) => t.id);
export const tierById = (id?: string) => TIERS.find((t) => t.id === id);
export const isTier = (id?: string): id is MembershipTier => Boolean(tierById(id));
/** Only Pêşeng members take on positions and responsibilities. */
export const canHoldPositions = (tier?: string) => tier === 'peshang';

/** What a Piştîwan member offers. */
export const SUPPORT_TYPES = [
  { id: 'financial', name: 'Financial support', description: 'Helping the movement with money when it is needed.' },
  { id: 'komar', name: 'Gathering Komar', description: 'Bringing together voters and supporters for the movement.' },
  { id: 'logistics', name: 'Logistical support', description: 'Transport, places, equipment and practical help.' },
];
export const supportLabel = (ids?: string[]) => (ids || []).length === SUPPORT_TYPES.length
  ? 'All of them'
  : SUPPORT_TYPES.filter((o) => (ids || []).includes(o.id)).map((o) => o.name).join(', ') || 'Not chosen';

/** Whether a Komar member may do more later. */
export const FUTURE_INTENTS = [
  { id: 'near_pishtiwan', name: 'Yes, in the near future, as a Piştîwan' },
  { id: 'near_peshang', name: 'Yes, in the near future, as a Pêşeng' },
  { id: 'later_pishtiwan', name: 'Perhaps in the more distant future, as a Piştîwan' },
  { id: 'later_peshang', name: 'Perhaps in the more distant future, as a Pêşeng' },
  { id: 'stay', name: 'No, I would like to stay a Komar' },
];
export const futureLabel = (id?: string) => FUTURE_INTENTS.find((o) => o.id === id)?.name || 'Not answered';
