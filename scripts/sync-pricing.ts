/**
 * Copies the publication fees from src/config/pricing.json into the
 * generated block of firestore.rules, so the database checks exactly the
 * same prices the website shows. Run after changing pricing.json:
 *   npx tsx scripts/sync-pricing.ts          (rewrite the rules)
 *   npx tsx scripts/sync-pricing.ts --check  (fail if they differ; used by the build)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pricing = JSON.parse(readFileSync('src/config/pricing.json', 'utf8'));
const { article, video } = pricing.fees;
const block = `    // BEGIN GENERATED PRICING — from src/config/pricing.json by scripts/sync-pricing.ts. Do not edit by hand.
    function feeStandard(cat) { return cat == 'video' ? ${video.standard} : ${article.standard}; }
    function feeDiscounted(cat) { return cat == 'video' ? ${video.discounted} : ${article.discounted}; }
    function feeDiscountAfter() { return ${pricing.discountAfter}; }
    function feeFreeAfter() { return ${pricing.freeAfter}; }
    // END GENERATED PRICING`;

// The official positions and units, from src/config/structure.json.
const structure = JSON.parse(readFileSync('src/config/structure.json', 'utf8'));
const list = (ids: string[]) => `[${ids.map((id) => `'${id}'`).join(', ')}]`;
const ofUnit = (unit: string) => list(structure.positions.filter((p: { department: string }) => p.department === unit).map((p: { id: string }) => p.id));
const structureBlock = `    // BEGIN GENERATED STRUCTURE — from src/config/structure.json by scripts/sync-pricing.ts. Do not edit by hand.
    function boardPositions() { return ${ofUnit('board')}; }
    function councilPositions() { return ${ofUnit('council')}; }
    function productionPositions() { return ${ofUnit('production')}; }
    function webadminPositions() { return ${ofUnit('webadmin')}; }
    // Older position and department names remain valid on records made before the structure changed.
    function positionIds() { return ${list([...structure.positions.map((p: { id: string }) => p.id), ...Object.keys(structure.legacyPositions)])}; }
    function departmentIds() { return ${list([...structure.units.map((u: { id: string }) => u.id), ...structure.legacyDepartments])}; }
    // END GENERATED STRUCTURE`;

const rules = readFileSync('firestore.rules', 'utf8');
const re = /    \/\/ BEGIN GENERATED PRICING[\s\S]*?\/\/ END GENERATED PRICING/;
const reS = /    \/\/ BEGIN GENERATED STRUCTURE[\s\S]*?\/\/ END GENERATED STRUCTURE/;
if (!re.test(rules)) throw new Error('firestore.rules has no generated pricing block.');
if (!reS.test(rules)) throw new Error('firestore.rules has no generated structure block.');
const next = rules.replace(re, block).replace(reS, structureBlock);
if (process.argv.includes('--check')) {
  if (next !== rules) {
    console.error('firestore.rules differs from src/config/pricing.json or structure.json. Run: npx tsx scripts/sync-pricing.ts');
    process.exit(1);
  }
  console.log('[pricing] database rules match src/config/pricing.json and structure.json');
} else {
  writeFileSync('firestore.rules', next);
  console.log('[pricing] firestore.rules updated from src/config/pricing.json and structure.json');
}
