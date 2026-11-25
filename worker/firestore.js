/**
 * Server access to the website database (Firestore) for the meetings
 * system, using a Firebase service account kept as a Worker secret
 * (FIREBASE_SERVICE_ACCOUNT, the JSON key file). The server writes the
 * records that members must not be able to write themselves: meeting
 * status, attendance, points and appreciation awards.
 *
 * Also checks Firebase sign-in tokens (ID tokens) against Google's public
 * keys, so every request is tied to a real, signed-in account.
 */

import firebaseConfig from '../firebase-applet-config.json';

/** Mashkhally Zhyanawa's own Firebase project and database (the same ones the website uses). */
export const PROJECT = firebaseConfig.projectId;
export const DATABASE = firebaseConfig.firestoreDatabaseId || '(default)';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
const ROOT = `projects/${PROJECT}/databases/${DATABASE}/documents`;

export class SetupError extends Error {
  constructor(what) { super(what); this.setup = true; }
}

// ---------------------------------------------------------------- tokens

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(new TextEncoder().encode(s));
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

let cachedAccess = null; // { token, exp, email }

const serviceAccount = (env) => {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new SetupError('The Firebase service account (FIREBASE_SERVICE_ACCOUNT) has not been added to the website server yet.');
  try {
    // Accept the file pasted as it is, or wrapped in quotation marks.
    let raw = String(env.FIREBASE_SERVICE_ACCOUNT).trim();
    if (raw.startsWith('"')) raw = JSON.parse(raw);
    const sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!sa.client_email || !sa.private_key) throw new Error('incomplete');
    return sa;
  } catch {
    throw new SetupError('The Firebase service account secret is not a valid JSON key file.');
  }
};

/** An access token for the service account (cached for most of its hour). */
const accessToken = async (env) => {
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccess.email === sa.client_email && cachedAccess.exp > now + 120) return cachedAccess.token;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlText(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${b64url(sig)}`,
  });
  if (!res.ok) throw new SetupError(`The Firebase service account was refused (${res.status}). Check that the key is current and belongs to project ${PROJECT}.`);
  const data = await res.json();
  cachedAccess = { token: data.access_token, exp: now + (data.expires_in || 3600), email: sa.client_email };
  return cachedAccess.token;
};

let jwks = null; // { keys, exp }

/**
 * Checks a Firebase ID token and returns its claims, or null if it is not
 * valid. Anonymous (visitor) sign-ins are refused.
 */
export const verifyIdToken = async (token) => {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(fromB64url(h)));
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    if (header.alg !== 'RS256' || !header.kid) return null;
    if (!jwks || jwks.exp < Date.now()) {
      const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
      if (!r.ok) return null;
      const age = Number((r.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
      jwks = { keys: (await r.json()).keys || [], exp: Date.now() + Math.min(age, 21600) * 1000 };
    }
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.aud !== PROJECT || claims.iss !== `https://securetoken.google.com/${PROJECT}`) return null;
    if (!(claims.exp > now) || !(claims.iat <= now + 300) || !claims.sub || claims.sub.length > 128) return null;
    if (claims.firebase?.sign_in_provider === 'anonymous') return null;
    return { uid: claims.sub, email: claims.email || '', emailVerified: claims.email_verified === true, name: claims.name || '' };
  } catch {
    return null;
  }
};

export const bearer = (request) => (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

// ---------------------------------------------------------------- values

const toValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== undefined).map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
};

export const toFields = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));

const fromValue = (v) => {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  return null;
};

export const fromFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromValue(v)]));

const fieldPath = (k) => k.split('.').map((part) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part) ? part : `\`${part.replace(/`/g, '\\`')}\``)).join('.');

// ---------------------------------------------------------------- access

const call = async (env, url, init = {}) => {
  const token = await accessToken(env);
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  return res;
};

/** One document, or null. */
export const getDoc = async (env, path) => {
  const res = await call(env, `${BASE}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Database read failed (${res.status}) for ${path.split('/')[0]}`);
  const d = await res.json();
  return { id: d.name.split('/').pop(), ...fromFields(d.fields) };
};

/** Several documents at once (missing ones are left out). */
export const getDocs = async (env, paths) => {
  if (!paths.length) return [];
  const out = [];
  for (let i = 0; i < paths.length; i += 100) {
    const res = await call(env, `${BASE}:batchGet`, { method: 'POST', body: JSON.stringify({ documents: paths.slice(i, i + 100).map((p) => `${ROOT}/${p}`) }) });
    if (!res.ok) throw new Error(`Database read failed (${res.status})`);
    for (const r of await res.json()) if (r.found) out.push({ id: r.found.name.split('/').pop(), ...fromFields(r.found.fields) });
  }
  return out;
};

/**
 * A query on one collection. `where` is a list of [field, op, value] with
 * op one of == != < <= > >= in array-contains.
 */
export const queryDocs = async (env, collection, { where = [], orderBy = [], limit } = {}) => {
  const OPS = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN', 'array-contains': 'ARRAY_CONTAINS' };
  const filters = where.map(([f, op, v]) => ({ fieldFilter: { field: { fieldPath: fieldPath(f) }, op: OPS[op], value: toValue(v) } }));
  // "news_banners/abc/registrations" queries a sub-collection of one document.
  const parts = collection.split('/');
  const collectionId = parts.pop();
  const parent = parts.length ? `${BASE}/${parts.join('/')}` : BASE;
  const structuredQuery = {
    from: [{ collectionId }],
    ...(filters.length === 1 ? { where: filters[0] } : filters.length ? { where: { compositeFilter: { op: 'AND', filters } } } : {}),
    ...(orderBy.length ? { orderBy: orderBy.map(([f, dir]) => ({ field: { fieldPath: fieldPath(f) }, direction: dir === 'desc' ? 'DESCENDING' : 'ASCENDING' })) } : {}),
    ...(limit ? { limit } : {}),
  };
  const res = await call(env, `${parent}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
  if (!res.ok) throw new Error(`Database query failed (${res.status}) on ${collection}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).filter((r) => r.document).map((r) => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields) }));
};

/**
 * Write several changes at once, all or nothing.
 *   { set: path, data }                       – replace the document
 *   { create: path, data }                    – only if it does not exist yet
 *   { update: path, data }                    – change these fields (dotted names allowed); document must exist
 *   { merge: path, data }                     – change these fields, creating the document if needed
 *   { increment: path, fields: { 'points.all': 30 }, data? } – add to numbers (document must exist)
 *   { delete: path }
 * Returns false if a `create` found the document already there.
 */
export const commit = async (env, ops) => {
  const writes = ops.map((op) => {
    if (op.delete) return { delete: `${ROOT}/${op.delete}` };
    const path = op.set || op.create || op.update || op.merge || op.increment;
    const flat = {};
    const nested = {};
    for (const [k, v] of Object.entries(op.data || {})) {
      if (v === undefined) continue;
      if (k.includes('.')) flat[k] = v; else nested[k] = v;
    }
    // Dotted names become nested maps for the document body, with an exact mask.
    const body = { ...nested };
    for (const [k, v] of Object.entries(flat)) {
      const parts = k.split('.');
      let cur = body;
      for (const p of parts.slice(0, -1)) cur = cur[p] = (cur[p] && typeof cur[p] === 'object' && !Array.isArray(cur[p])) ? cur[p] : {};
      cur[parts[parts.length - 1]] = v;
    }
    const w = { update: { name: `${ROOT}/${path}`, fields: toFields(body) } };
    if (op.update || op.merge || op.increment) w.updateMask = { fieldPaths: [...Object.keys(nested), ...Object.keys(flat)].map(fieldPath) };
    if (op.update || op.increment) w.currentDocument = { exists: true };
    if (op.create) w.currentDocument = { exists: false };
    if (op.increment) {
      w.updateTransforms = Object.entries(op.fields).map(([f, n]) => ({ fieldPath: fieldPath(f), increment: toValue(n) }));
      if (!Object.keys(op.data || {}).length) w.updateMask = { fieldPaths: [] };
    }
    return w;
  });
  const res = await call(env, `${BASE}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  if (res.ok) return true;
  const text = await res.text();
  if (res.status === 409 || /ALREADY_EXISTS/.test(text)) return false;
  throw new Error(`Database write failed (${res.status}): ${text.slice(0, 300)}`);
};

/** Is the service account configured and working? */
export const checkDatabase = async (env) => {
  try {
    await getDoc(env, 'site_settings/default');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
