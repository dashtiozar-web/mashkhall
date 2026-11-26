/**
 * The official structure of Mashkhally Zhyanawa Organisation.
 *
 * Four parts:
 *  1. Board of Directors: the President, the Deputy President, the heads of
 *     the eight centres (Education, Finance, Media and Communications,
 *     Research and Investigation, Public Relations, Administration,
 *     Organising, Kurdish Diaspora) and the Representative of the Lobby
 *     Supervisors.
 *  2. Groups in cities and countries: each has a Lobby Supervisor and four
 *     corners (Education, Organising, Media and Communications, Finance),
 *     each with a head and several members.
 * Only Pêşeng members hold positions.
 *  3. Production Team: one organisation-wide team (not per council).
 *  4. Website Administration: five positions led by the Admin. Holding one
 *     gives no website permissions by itself; those are granted separately.
 *
 * People are appointed to individual seats (see orgStructure.ts). A member's
 * `positionId` is their main title, shown on their card and profile: the
 * most senior position they hold, or "Member".
 */

import structure from '../config/structure.json';

export type UnitId = 'board' | 'council' | 'production' | 'webadmin' | 'membership';

/** Kept as a name for compatibility: a position's part of the organisation. */
export type DepartmentId = UnitId;

export type PositionId =
  // Board of Directors: the President, the Deputy, and the heads of the eight centres
  | 'president'
  | 'deputy_president'
  | 'head_of_education'
  | 'head_of_finance'
  | 'head_of_media'
  | 'research_manager'
  | 'head_of_public_relations'
  | 'administrator'
  | 'head_of_organising'
  | 'head_of_diaspora'
  | 'councils_representative'
  // Each group (province or country): a Lobby Supervisor and four corners
  | 'council_leader'
  | 'head_of_education_corner'
  | 'head_of_organising_corner'
  | 'media_supervisor'
  | 'head_of_finance_corner'
  | 'education_corner_member'
  | 'organising_corner_member'
  | 'media_corner_member'
  | 'finance_corner_member'
  // Production Team
  | 'head_of_production'
  | 'graphic_designer'
  | 'reporter'
  | 'photographer'
  | 'video_editor'
  | 'content_creator'
  // Website Administration
  | 'web_admin'
  | 'web_deputy'
  | 'web_security'
  | 'web_content'
  | 'web_support'
  // Everyone else
  | 'member';

export interface Department {
  id: UnitId;
  number: number;
  name: string;
}

export interface Position {
  id: PositionId;
  /** Order within its part of the organisation, and seniority overall. */
  number: number;
  title: string;
  department: UnitId;
  /** Leads others (shown highlighted in the chart). */
  head: boolean;
  /** Seats per unit: 1, or several for corner members. */
  seats: number;
  /** The position this one reports to, within the same unit. */
  reportsTo?: PositionId;
}

/** From src/config/structure.json, shared with the server and the database rules. */
export const DEPARTMENTS = structure.units as Department[];
export const POSITIONS = structure.positions as Position[];

/** Positions from the previous structure, mapped to today's. */
const LEGACY = structure.legacyPositions as Record<string, PositionId>;

export const POSITION_IDS = POSITIONS.map((p) => p.id);
export const DEFAULT_POSITION: PositionId = 'member';

export const positionById = (id?: string) => POSITIONS.find((p) => p.id === (id && LEGACY[id] ? LEGACY[id] : id));
export const departmentById = (id?: string) => DEPARTMENTS.find((d) => d.id === id);
export const positionsIn = (unit: UnitId) => POSITIONS.filter((p) => p.department === unit);

export const BOARD_POSITIONS = positionsIn('board');
export const COUNCIL_POSITIONS = positionsIn('council');
export const PRODUCTION_POSITIONS = positionsIn('production');
export const WEBADMIN_POSITIONS = positionsIn('webadmin');

/** Title shown on cards and profiles. */
export const positionTitle = (id?: string, fallback = 'Member') => positionById(id)?.title || fallback;

/** The part of the organisation a position belongs to. */
export const departmentFor = (positionId?: string) => departmentById(positionById(positionId)?.department);

/** Title with its unit, e.g. "Reporter, Production Team" or "Reporter, London Council". */
export const positionLabel = (id?: string, councilName?: string) => {
  const p = positionById(id);
  if (!p) return 'Member';
  if (p.department === 'production' && !p.head) return `${p.title}, Production Team`;
  if (p.department === 'webadmin' && p.id !== 'web_admin') return `${p.title}, Website Administration`;
  if (p.department === 'council' && councilName) return `${p.title}, ${councilName}`;
  return p.title;
};

/** Best guess of a position from an older free-text role, for records made before positions existed. */
export const positionFromTitle = (title?: string): PositionId | undefined => {
  const t = (title || '').trim().toLowerCase();
  if (!t) return undefined;
  const map: Record<string, PositionId> = {
    'leader of a council': 'council_leader',
    'representative of councils': 'councils_representative',
    'head of financial management': 'head_of_finance',
    'manager of research and investigation': 'research_manager',
    'head of security': 'head_of_organising_corner',
    security: 'organising_corner_member',
  };
  return map[t] || POSITIONS.find((p) => p.title.toLowerCase() === t)?.id;
};

/** The position of a record, from its position id or (for older records) its role title. */
export const positionOf = (r: { positionId?: string; designation?: string }): PositionId =>
  (positionById(r.positionId)?.id) || positionFromTitle(r.designation) || DEFAULT_POSITION;

/** Council or department line for a member's card: "London Council", "Production Team"… */
export const unitLine = (r: { positionId?: string; designation?: string; chapterId?: string }, councilName: (id?: string) => string) => {
  const p = positionById(positionOf(r));
  if (!p || p.department === 'council' || p.department === 'membership') return r.chapterId ? councilName(r.chapterId) : '';
  return departmentById(p.department)?.name || '';
};
