/**
 * Shared by the backup scripts: signing in with a Firebase service account
 * and talking to the Firestore REST API (or the local emulator).
 */
export const PROJECT = process.env.FIREBASE_PROJECT || 'shubat-ac738';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** An access token for the service account in FIREBASE_SERVICE_ACCOUNT (JSON). */
export const serviceToken = async (json = process.env.FIREBASE_SERVICE_ACCOUNT) => {
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.');
  let raw = json.trim();
  if (raw.startsWith('"')) raw = JSON.parse(raw);
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const { createSign } = await import('node:crypto');
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${b64url(sig)}`,
  });
  if (!res.ok) throw new Error(`Service account refused (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
};

/** A client for one Firestore database: the real project, or the emulator. */
export const client = ({ project = PROJECT, token, emulator = process.env.FIRESTORE_EMULATOR_HOST } = {}) => {
  const host = emulator ? `http://${emulator}` : 'https://firestore.googleapis.com';
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `${host}/v1/${root}`;
  const auth = emulator ? 'Bearer owner' : `Bearer ${token}`;
  const call = async (url, init = {}, attempt = 0) => {
    const res = await fetch(url, { ...init, headers: { authorization: auth, 'content-type': 'application/json', ...(init.headers || {}) } });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      return call(url, init, attempt + 1);
    }
    if (!res.ok) throw new Error(`Firestore ${res.status} for ${url.replace(host, '')}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };
  return {
    root,
    /** Sub-collection names directly under a document ('' = top level). */
    async collectionIds(docPath = '') {
      const ids = [];
      let pageToken;
      do {
        const r = await call(`${docPath ? `${base}/${docPath}` : base}:listCollectionIds`, { method: 'POST', body: JSON.stringify({ pageSize: 300, pageToken }) });
        ids.push(...(r.collectionIds || []));
        pageToken = r.nextPageToken;
      } while (pageToken);
      return ids;
    },
    /** Every document in one collection, page by page. */
    async *documents(collectionPath) {
      let pageToken = '';
      do {
        const r = await call(`${base}/${collectionPath}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
        for (const d of r.documents || []) yield d;
        pageToken = r.nextPageToken || '';
      } while (pageToken);
    },
    /** Writes documents exactly as exported (fields in Firestore's own format). */
    async write(docs) {
      for (let i = 0; i < docs.length; i += 400) {
        const writes = docs.slice(i, i + 400).map((d) => ({ update: { name: `${root}/${d.path}`, fields: d.fields || {} } }));
        await call(`${base}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
      }
    },
  };
};

/** Runs tasks with a limited number at once. */
export const pool = async (items, limit, fn) => {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
};
