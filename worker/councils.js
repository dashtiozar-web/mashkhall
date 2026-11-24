import builtIn from '../src/config/councils.json';
import { queryDocs } from './firestore.js';

/** Councils of the earlier United Kingdom structure, replaced by countries and Kurdish provinces. */
const RETIRED = ['london', 'birmingham', 'manchester', 'newcastle', 'glasgow', 'cardiff'];

/**
 * Every member group (country or Kurdish province), as the website shows them: the built-in groups
 * (src/config/councils.json), with anything an administrator saved in the
 * database applied on top, plus councils added by administrators. Archived
 * councils are left out unless asked for.
 *
 * Reading only the database missed built-in councils that had never been
 * saved there, so positions and meeting rooms in them were refused.
 */
export const councilsOf = async (env, { includeArchived = false } = {}) => {
  const saved = await queryDocs(env, 'chapters');
  const byId = new Map(saved.map((c) => [c.id, c]));
  const merged = [
    ...builtIn.councils.map((c) => ({ ...c, isArchived: false, ...(byId.get(c.id) || {}), id: c.id })),
    ...saved.filter((c) => !builtIn.councils.some((b) => b.id === c.id) && !RETIRED.includes(c.id)),
  ];
  return merged
    .filter((c) => includeArchived || !c.isArchived)
    .map((c) => ({ ...c, order: c.order ?? c.displayOrder ?? 99 }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
};
