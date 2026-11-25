/**
 * Restores a backup made by export.mjs, then checks every document arrived.
 *
 * Restore test (what the backup workflow does every day, into an empty local emulator):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/backup/restore.mjs backup-out/
 *
 * Real disaster recovery into a Firebase project (overwrites documents with
 * the backed-up version; documents created after the backup are left alone):
 *   FIREBASE_SERVICE_ACCOUNT='{…}' node scripts/backup/restore.mjs backup-out/ --confirm-project=mashkhall-8206b
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { client, PROJECT, serviceToken } from './common.mjs';

const dir = process.argv[2] || 'backup-out';
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const raw = readFileSync(path.join(dir, 'backup.jsonl'));
const sha = createHash('sha256').update(raw).digest('hex');
if (sha !== manifest.sha256) throw new Error('The backup file does not match its checksum: it is damaged or was changed.');

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const project = emulator ? (process.env.FIREBASE_PROJECT || 'demo-restore') : PROJECT;
if (!emulator && !process.argv.includes(`--confirm-project=${PROJECT}`)) {
  throw new Error(`Restoring into the live project needs --confirm-project=${PROJECT}.`);
}
const db = client({ project, token: emulator ? '' : await serviceToken(), emulator });
const docs = raw.toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
await db.write(docs);
console.log(`Restored ${docs.length} documents into ${emulator ? `the emulator (${project})` : project}.`);

// Check: read everything back and compare counts per collection.
const counts = {};
let total = 0;
const walk = async (collectionPath) => {
  for await (const d of db.documents(collectionPath)) {
    const docPath = d.name.slice(d.name.indexOf('/documents/') + '/documents/'.length);
    const top = collectionPath.replace(/\/[^/]+\/([^/]+)$/, '/*/$1');
    counts[top] = (counts[top] || 0) + 1;
    total += 1;
    for (const sub of await db.collectionIds(docPath)) await walk(`${docPath}/${sub}`);
  }
};
for (const c of await db.collectionIds()) await walk(c);
const problems = Object.entries(manifest.counts).filter(([c, n]) => emulator ? counts[c] !== n : (counts[c] || 0) < n);
if (problems.length) {
  console.error('Restore check FAILED:', problems.map(([c, n]) => `${c}: expected ${n}, found ${counts[c] || 0}`).join('; '));
  process.exit(1);
}
console.log(`Restore check passed: ${total} documents in ${Object.keys(counts).length} collections match the backup (${manifest.createdAt}).`);
