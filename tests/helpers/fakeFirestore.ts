/**
 * An in-memory stand-in for the parts of Google's services the website
 * server uses (Firestore REST, the service-account token exchange and the
 * Firebase sign-in keys), so the server code in worker/ can be tested end to
 * end without a real database. Installed by replacing global fetch.
 */
import { DATABASE, fromFields, PROJECT, toFields } from '../../worker/firestore.js';

const ROOT = `projects/${PROJECT}/databases/${DATABASE}/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;

export interface Fake {
  docs: Map<string, Record<string, unknown>>;
  env: { FIREBASE_SERVICE_ACCOUNT: string };
  /** A signed sign-in token for this account, accepted by the server. */
  idToken: (uid: string, email?: string, verified?: boolean) => Promise<string>;
  set: (path: string, data: Record<string, unknown>) => void;
  get: (path: string) => Record<string, unknown> | undefined;
  list: (collection: string) => Array<Record<string, unknown> & { id: string }>;
  commits: number;
  failNextCommit: boolean;
  restore: () => void;
}

const b64url = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

const get = (obj: Record<string, unknown>, path: string) => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k.replace(/`/g, '')] : undefined), obj);
const setPath = (obj: Record<string, unknown>, path: string, v: unknown) => {
  const parts = path.split('.').map((p) => p.replace(/`/g, ''));
  let cur = obj;
  for (const p of parts.slice(0, -1)) cur = (cur[p] && typeof cur[p] === 'object' ? cur[p] : (cur[p] = {})) as Record<string, unknown>;
  if (v === undefined) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = v;
};

const decodeValue = (v: Record<string, unknown>) => fromFields({ x: v }).x;

const matches = (doc: Record<string, unknown>, f: any): boolean => {
  if (f.compositeFilter) return f.compositeFilter.filters.every((x: any) => matches(doc, x));
  const { field, op, value } = f.fieldFilter;
  const a = get(doc, field.fieldPath);
  const b = decodeValue(value);
  switch (op) {
    case 'EQUAL': return a === b;
    case 'NOT_EQUAL': return a !== b && a !== undefined;
    case 'LESS_THAN': return (a as any) < (b as any);
    case 'LESS_THAN_OR_EQUAL': return (a as any) <= (b as any);
    case 'GREATER_THAN': return (a as any) > (b as any);
    case 'GREATER_THAN_OR_EQUAL': return (a as any) >= (b as any);
    case 'IN': return (b as unknown[]).includes(a);
    case 'ARRAY_CONTAINS': return Array.isArray(a) && a.includes(b);
    default: throw new Error(`fake firestore: op ${op}`);
  }
};

export const installFakeFirestore = async (): Promise<Fake> => {
  const docs = new Map<string, Record<string, unknown>>();
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----\n`;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const realFetch = globalThis.fetch;

  const fake: Fake = {
    docs,
    env: { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'test@test.iam.gserviceaccount.com', private_key: pem }) },
    commits: 0,
    failNextCommit: false,
    async idToken(uid, email = `${uid}@example.org`, verified = true) {
      const t = Math.floor(Date.now() / 1000);
      const unsigned = `${enc({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })}.${enc({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: uid, iat: t, exp: t + 3600, email, email_verified: verified, firebase: { sign_in_provider: 'password' } })}`;
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(unsigned));
      return `${unsigned}.${b64url(sig)}`;
    },
    set(path, data) { docs.set(path, structuredClone(data)); },
    get(path) { return docs.get(path); },
    list(collection) {
      const depth = collection.split('/').length + 1;
      return [...docs.entries()].filter(([p]) => p.startsWith(`${collection}/`) && p.split('/').length === depth).map(([p, d]) => ({ ...d, id: p.split('/').pop()! }));
    },
    restore() { globalThis.fetch = realFetch; },
  };

  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const docJson = (path: string, d: Record<string, unknown>) => ({ name: `${ROOT}/${path}`, fields: toFields(d) });

  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === 'https://oauth2.googleapis.com/token') return reply({ access_token: 'test-access', expires_in: 3600 });
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (url.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')) return reply({ keys: [jwk] });
    if (!url.startsWith(BASE)) throw new Error(`fake firestore: unexpected request to ${url}`);
    const rest = url.slice(BASE.length);

    if (rest === ':batchGet') {
      return reply(body.documents.map((name: string) => {
        const path = name.slice(ROOT.length + 1);
        const d = docs.get(path);
        return d ? { found: docJson(path, d) } : { missing: name };
      }));
    }
    if (rest.endsWith(':runQuery')) {
      const parent = rest.slice(0, -':runQuery'.length).replace(/^\//, '');
      const q = body.structuredQuery;
      const collection = parent ? `${parent}/${q.from[0].collectionId}` : q.from[0].collectionId;
      let rows = fake.list(collection);
      if (q.where) rows = rows.filter((r) => matches(r, q.where));
      for (const o of [...(q.orderBy || [])].reverse()) {
        const f = o.field.fieldPath;
        rows.sort((a, b) => ((get(a, f) as any) < (get(b, f) as any) ? -1 : (get(a, f) as any) > (get(b, f) as any) ? 1 : 0) * (o.direction === 'DESCENDING' ? -1 : 1));
      }
      if (q.limit) rows = rows.slice(0, q.limit);
      return reply(rows.length ? rows.map(({ id, ...d }) => ({ document: docJson(`${collection}/${id}`, d) })) : [{ readTime: new Date().toISOString() }]);
    }
    if (rest === ':commit') {
      fake.commits += 1;
      if (fake.failNextCommit) { fake.failNextCommit = false; return reply({ error: { message: 'UNAVAILABLE' } }, 503); }
      // All or nothing: apply to a copy, then swap in.
      const next = new Map([...docs.entries()].map(([k, v]) => [k, structuredClone(v)]));
      for (const w of body.writes) {
        if (w.delete) { next.delete(w.delete.slice(ROOT.length + 1)); continue; }
        const path = w.update.name.slice(ROOT.length + 1);
        const exists = next.has(path);
        if (w.currentDocument?.exists === true && !exists) return reply({ error: { status: 'NOT_FOUND', message: `no document ${path}` } }, 404);
        if (w.currentDocument?.exists === false && exists) return reply({ error: { status: 'ALREADY_EXISTS', message: path } }, 409);
        const data = fromFields(w.update.fields || {}) as Record<string, unknown>;
        if (w.updateMask) {
          const cur = structuredClone(next.get(path) || {});
          for (const f of w.updateMask.fieldPaths) setPath(cur, f, get(data, f));
          next.set(path, cur);
        } else {
          next.set(path, data);
        }
        for (const t of w.updateTransforms || []) {
          const cur = next.get(path)!;
          setPath(cur, t.fieldPath, Number(get(cur, t.fieldPath) || 0) + Number(decodeValue(t.increment)));
        }
      }
      docs.clear();
      for (const [k, v] of next) docs.set(k, v);
      return reply({ writeResults: [] });
    }
    const path = rest.replace(/^\//, '');
    if (!init.method || init.method === 'GET') {
      const d = docs.get(path);
      return d ? reply(docJson(path, d)) : reply({ error: { status: 'NOT_FOUND' } }, 404);
    }
    throw new Error(`fake firestore: ${init.method} ${url}`);
  }) as typeof fetch;

  return fake;
};
