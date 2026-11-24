/**
 * Full backup of the website database (every collection and sub-collection)
 * to a folder: backup.jsonl (one document per line, exactly as stored) and
 * manifest.json (counts and a checksum). Used by .github/workflows/backup.yml.
 *
 *   FIREBASE_SERVICE_ACCOUNT='{…}' node scripts/backup/export.mjs out/
 */
import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { client, pool, PROJECT, serviceToken } from './common.mjs';

const outDir = process.argv[2] || 'backup-out';
mkdirSync(outDir, { recursive: true });
const token = process.env.FIRESTORE_EMULATOR_HOST ? '' : await serviceToken();
const db = client({ token });
const file = path.join(outDir, 'backup.jsonl');
const stream = createWriteStream(file);
const counts = {};
let total = 0;

const walk = async (collectionPath) => {
  const docs = [];
  for await (const d of db.documents(collectionPath)) {
    const docPath = d.name.slice(d.name.indexOf('/documents/') + '/documents/'.length);
    stream.write(`${JSON.stringify({ path: docPath, fields: d.fields || {}, updateTime: d.updateTime })}\n`);
    const top = collectionPath.replace(/\/[^/]+\/([^/]+)$/, '/*/$1');
    counts[top] = (counts[top] || 0) + 1;
    total += 1;
    docs.push(docPath);
  }
  // Sub-collections (for example an article's comments).
  await pool(docs, 16, async (docPath) => {
    for (const sub of await db.collectionIds(docPath)) await walk(`${docPath}/${sub}`);
  });
};

const started = Date.now();
for (const c of await db.collectionIds()) await walk(c);
await new Promise((r) => stream.end(r));
const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest = { project: PROJECT, createdAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), total, counts, sha256 };
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Backed up ${total} documents in ${Object.keys(counts).length} collections (${manifest.seconds}s).`);
