/**
 * Website monitoring (run by .github/workflows/monitor.yml):
 *   - the site and its server answer, over HTTPS, with the security headers;
 *   - the domain still points to Cloudflare (a sign it has not been hijacked);
 *   - the HTTPS certificate is not about to expire;
 *   - optionally (REGIONAL=1): can the site be reached from Iraq and Iran?
 *     Uses Globalping (volunteer test points) and OONI (public censorship
 *     measurements). Where no test point exists, that is reported, not guessed.
 * Writes a Markdown report to monitor-report.md; exits 1 if something critical failed.
 */
import dns from 'node:dns/promises';
import tls from 'node:tls';
import { writeFileSync } from 'node:fs';

const DOMAIN = process.env.MONITOR_DOMAIN || 'mashkhall.com';
const SITE = `https://${DOMAIN}`;
const results = []; // { name, ok, critical, detail }
const add = (name, ok, detail = '', critical = true) => results.push({ name, ok, critical, detail });
const timed = async (fn) => { const t = Date.now(); const r = await fn(); return [r, Date.now() - t]; };
const get = (url, init = {}) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'mashkhall-monitor (GitHub Actions)' }, ...init });

// ---------------------------------------------------------------- website
try {
  const [res, ms] = await timed(() => get(`${SITE}/`));
  const body = await res.text();
  add('Home page', res.status === 200 && /Mashkhally Zhyanawa/i.test(body), `HTTP ${res.status}, ${ms} ms`);
  const h = (k) => res.headers.get(k) || '';
  add('Security headers', /default-src 'self'/.test(h('content-security-policy')) && /max-age=\d+/.test(h('strict-transport-security')) && h('x-content-type-options') === 'nosniff',
    `CSP ${h('content-security-policy') ? 'on' : 'MISSING'}, HSTS ${h('strict-transport-security') ? 'on' : 'MISSING'}, nosniff ${h('x-content-type-options') || 'MISSING'}`);
  add('Microphone allowed for meetings', /microphone=\(self\)/.test(h('permissions-policy')), h('permissions-policy') || 'no Permissions-Policy', false);
} catch (e) { add('Home page', false, e.message); }

try {
  const res = await get(`${SITE}/api/visitors`);
  add('Website server (API)', res.status === 200 && /"total"/.test(await res.text()), `HTTP ${res.status}`);
} catch (e) { add('Website server (API)', false, e.message); }

try {
  const res = await get(`http://${DOMAIN}/`);
  add('HTTP redirects to HTTPS', [301, 302, 307, 308].includes(res.status) && (res.headers.get('location') || '').startsWith('https://'), `HTTP ${res.status} → ${res.headers.get('location') || '—'}`);
} catch (e) { add('HTTP redirects to HTTPS', false, e.message, false); }

try {
  const s = await (await get(`${SITE}/api/meetings/status`)).json();
  add('Meetings set-up', s.database && s.video, `database ${s.database ? 'connected' : 'not connected'}, video ${s.video ? 'connected' : 'not connected'}`, false);
} catch (e) { add('Meetings set-up', false, e.message, false); }

// ---------------------------------------------------------------- DNS and certificate
const inRange = (ip, cidr) => {
  const [range, bits] = cidr.split('/');
  if (ip.includes(':') !== range.includes(':')) return false;
  const toBig = (a) => (a.includes(':')
    ? a.split('::').map((p) => p.split(':').filter(Boolean)).reduce((acc, parts, i, arr) => (i === 0 ? parts : [...acc, ...Array(8 - arr[0].length - parts.length).fill('0'), ...parts]), []).reduce((n, x) => (n << 16n) + BigInt(parseInt(x || '0', 16)), 0n)
    : a.split('.').reduce((n, x) => (n << 8n) + BigInt(x), 0n));
  const size = ip.includes(':') ? 128n : 32n;
  const shift = size - BigInt(bits);
  return (toBig(ip) >> shift) === (toBig(range) >> shift);
};
try {
  const resolver = new dns.Resolver();
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const ns = await resolver.resolveNs(DOMAIN);
  add('Domain name servers', ns.length > 0 && ns.every((n) => n.endsWith('.ns.cloudflare.com')), ns.join(', '));
  const [v4, v6] = await Promise.all([resolver.resolve4(DOMAIN).catch(() => []), resolver.resolve6(DOMAIN).catch(() => [])]);
  const ranges = (await Promise.all(['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'].map(async (u) => (await (await fetch(u)).text()).split('\n').filter(Boolean)))).flat();
  const foreign = [...v4, ...v6].filter((ip) => !ranges.some((r) => inRange(ip, r)));
  add('Domain points to Cloudflare', v4.length + v6.length > 0 && !foreign.length, foreign.length ? `NOT Cloudflare: ${foreign.join(', ')}` : `${v4.length + v6.length} addresses, all Cloudflare`);
  // Node's resolver cannot ask for DS records, so use Cloudflare's DNS-over-HTTPS.
  const doh = await (await fetch(`https://cloudflare-dns.com/dns-query?name=${DOMAIN}&type=DS`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(15000) })).json();
  const ds = (doh.Answer || []).filter((a) => a.type === 43);
  add('DNSSEC', ds.length > 0, ds.length ? 'enabled' : 'not enabled (recommended: Cloudflare › DNS › Settings › DNSSEC)', false);
} catch (e) { add('DNS', false, e.message); }

try {
  const days = await new Promise((resolve, reject) => {
    const s = tls.connect({ host: DOMAIN, port: 443, servername: DOMAIN, timeout: 15000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(Math.floor((Date.parse(c.valid_to) - Date.now()) / 86400000));
    });
    s.on('error', reject);
    s.on('timeout', () => reject(new Error('TLS timeout')));
  });
  add('HTTPS certificate', days > 14, `${days} days left`);
} catch (e) { add('HTTPS certificate', false, e.message); }

// ---------------------------------------------------------------- Iraq and Iran
const regional = [];
if (process.env.REGIONAL === '1') {
  const gp = async (body) => {
    const r = await fetch('https://api.globalping.io/v1/measurements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return { error: j.error?.message || `HTTP ${r.status}` };
    for (let i = 0; i < 20; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const m = await (await fetch(`https://api.globalping.io/v1/measurements/${j.id}`)).json();
      if (m.status !== 'in-progress') return m;
    }
    return { error: 'timed out' };
  };
  for (const [cc, label] of [['IQ', 'Iraq (incl. Kurdistan Region)'], ['IR', 'Iran']]) {
    const http = await gp({ type: 'http', target: DOMAIN, locations: [{ country: cc }], limit: 3, measurementOptions: { protocol: 'HTTPS', request: { method: 'HEAD', path: '/' } } });
    const dnsm = await gp({ type: 'dns', target: DOMAIN, locations: [{ country: cc }], limit: 3, measurementOptions: { query: { type: 'A' } } });
    const lines = [];
    if (http.error) lines.push(`HTTPS: no result (${http.error})`);
    else for (const r of http.results || []) lines.push(`HTTPS from ${r.probe?.city || '?'} (${r.probe?.network || '?'}): ${r.result?.status === 'finished' ? `HTTP ${r.result.statusCode}, ${r.result.timings?.total ?? '?'} ms` : `failed: ${(r.result?.rawOutput || '').slice(0, 80)}`}`);
    if (!dnsm.error) {
      for (const r of dnsm.results || []) {
        const ips = (r.result?.answers || []).map((a) => a.value);
        // Iran's filter answers blocked names with private addresses such as 10.10.34.x.
        const poisoned = ips.some((ip) => /^(10\.|127\.|0\.|192\.168\.)/.test(ip));
        lines.push(`DNS from ${r.probe?.city || '?'} (${r.probe?.network || '?'}): ${ips.join(', ') || 'no answer'}${poisoned ? ' ← BLOCKED (filter address)' : ''}`);
      }
    }
    // Public censorship measurements by volunteers (OONI), last 30 days.
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const o = await (await fetch(`https://api.ooni.io/api/v1/measurements?domain=${DOMAIN}&probe_cc=${cc}&since=${since}&limit=50`)).json();
      const rows = o.results || [];
      const blocked = rows.filter((r) => r.confirmed || r.anomaly).length;
      lines.push(rows.length ? `OONI (30 days): ${rows.length} tests, ${blocked} showing blocking or problems` : 'OONI (30 days): no volunteer tests of this site yet');
    } catch { lines.push('OONI: not available'); }
    regional.push({ label, lines });
  }
}

// ---------------------------------------------------------------- report
const critical = results.filter((r) => !r.ok && r.critical);
let md = `## Website monitoring: ${critical.length ? `${critical.length} problem(s)` : 'all critical checks passed'}\n\n${new Date().toUTCString()}\n\n| Check | Result | Detail |\n|---|---|---|\n`;
for (const r of results) md += `| ${r.name} | ${r.ok ? '✅' : r.critical ? '❌' : '⚠️'} | ${r.detail.replace(/\|/g, '/')} |\n`;
if (regional.length) {
  md += '\n### Access from Iraq and Iran\n\nTest points are volunteers\' computers; one test point is not proof for a whole country.\n';
  for (const g of regional) md += `\n**${g.label}**\n${g.lines.map((l) => `- ${l}`).join('\n')}\n`;
}
writeFileSync('monitor-report.md', md);
console.log(md);
process.exit(critical.length ? 1 : 0);
