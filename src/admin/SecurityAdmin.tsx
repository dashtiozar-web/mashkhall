import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { CheckCircle2, CircleAlert, RefreshCw } from 'lucide-react';
import { auth, db } from '../firebase';
import { adminFetch, countryName, flag } from '../lib/visits';
import { audit } from '../lib/membership';

interface SecRow { day: string; kind: string; country: string; n: number }
interface SecurityEvent { id: string; kind: string; title?: string; note?: string; status: 'open' | 'resolved'; createdAt: string; resolution?: string }

const KIND_LABEL: Record<string, string> = {
  login_failed: 'Failed sign-ins',
  signup_failed: 'Failed account creations',
  bot: 'Automated visits (bots) ignored',
  excessive_requests: 'Unusually many requests from one visitor',
  upload_rejected: 'Rejected uploads',
  comment_blocked: 'Comments refused',
  submission_refused: 'Submissions refused',
  auth_config: 'Sign-in set-up problems (for example a web address not authorised in Firebase)',
  rules_outdated: 'Publish with Us refused because the latest database rules are not published in Firebase',
  rate_limited: 'Too many requests from one visitor (temporarily refused)',
  csp_violation: 'Content blocked by the browser security policy',
};

type Check = { done: boolean; title: string; detail: string };

/** What the website does, and what still needs action outside the website. */
const FRAMEWORK: Check[] = [
  { done: true, title: 'HTTPS everywhere', detail: 'Cloudflare serves the site only over HTTPS, and browsers are told to always use HTTPS (HSTS). Pages also send headers that stop other sites framing them and limit what is shared with other sites.' },
  { done: true, title: 'Roles and permissions', detail: 'Owner, administrators, membership reviewers, content reviewers, publishers and finance permission are separate, and the database rules enforce them. Payments and security reports are visible only to administrators (payments also to people with the donations permission).' },
  { done: false, title: 'Two-step sign-in (MFA) for administrators', detail: 'Needs your action: in the Firebase console, upgrade Authentication to Identity Platform and turn on multi-factor authentication (authenticator app). Until then, administrators should use a Google account that has 2-Step Verification turned on.' },
  { done: true, title: 'Forms protected against spam', detail: 'Publish with Us submissions are limited in size and number per browser, checked by the database rules, and nothing is published without editorial approval; comments are rate-limited and visitors cannot post links; automated programs are not counted and unusual request volumes are flagged here.' },
  { done: true, title: 'Private records', detail: 'Unpublished submissions, payment records, contributor counts and security reports are readable only by the people who need them; nothing financial is ever shown with published work.' },
  { done: true, title: 'Photo metadata removed', detail: 'Uploaded photos are redrawn in the browser before upload, which removes GPS location and camera details. Videos are linked (YouTube, Vimeo, Facebook), not uploaded; contributors are warned to check them.' },
  { done: true, title: 'Contributor safety warnings', detail: 'The submission form warns about faces, voices, usernames and backgrounds, and links to the safety advice in the privacy page. The site never promises anonymity.' },
  { done: true, title: 'Minimal data about visitors', detail: 'Visitor statistics keep only totals by country and day (and Kurdish regions of Iraq and Iran). IP addresses are never stored; a daily one-way code de-duplicates visitors and is deleted the next day. Public pages show totals per country, with the Kurdistan Region listed on its own, and members and visitors are shown separately only to administrators.' },
  { done: true, title: 'Retention periods', detail: 'Visitor de-duplication codes: 1 day. Security counts: 90 days. Rejected or cancelled submissions: delete after 12 months. Payment records: 6 years (financial records). Audit log: kept.' },
  { done: false, title: 'Encrypted backups and recovery', detail: 'Needs your action: in Google Cloud console → Firestore → Disaster recovery, turn on scheduled backups (daily, kept 14 days) and point-in-time recovery. Google encrypts backups automatically. Test a restore to a separate database twice a year.' },
  { done: false, title: 'Automatic deployment of database rules', detail: 'Recommended: add a FIREBASE_SERVICE_ACCOUNT secret to the GitHub repository so security rules are published automatically and never fall behind the website.' },
  { done: true, title: 'Hosting-level protection', detail: 'Cloudflare protects against denial-of-service attacks. Recommended: in Cloudflare, turn on Bot Fight Mode and set Security Level to Medium.' },
];

const THIRD_PARTIES = [
  ['Cloudflare (hosting, statistics)', 'Sees each connection to serve the site; we keep only totals.'],
  ['Google Firebase (accounts, database)', 'Stores accounts, members, submissions and payments, in Google Cloud.'],
  ['YouTube, Vimeo, Facebook (videos and feed)', 'When a video plays or the Facebook feed loads, that company sees the visit. Facebook content loads only after the visitor agrees.'],
  ['Wikimedia Commons, Geograph (council photos)', 'The visitor’s browser loads the photo from them; no referrer is sent.'],
];

export const SecurityAdmin: React.FC = () => {
  const [sec, setSec] = useState<SecRow[] | null>(null);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Please sign in again.');
      const s = await adminFetch<{ rows: SecRow[] }>('/api/security', token).then((r) => r.rows).catch(() => null);
      setSec(s);
      if (!s) setErr('Traffic and security counts are not available here (they come from the live website, and need administrator rights).');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load.');
    }
    try {
      const snap = await getDocs(collection(db, 'security_events'));
      setEvents(snap.docs.map((d) => ({ ...(d.data() as SecurityEvent), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      setEvents([]);
    }
  };
  useEffect(() => { load(); }, []);

  const last30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const byKind = useMemo(() => {
    const m = new Map<string, number>();
    (sec || []).filter((r) => r.day >= last30).forEach((r) => m.set(r.kind, (m.get(r.kind) || 0) + r.n));
    return m;
  }, [sec, last30]);
  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    (sec || []).filter((r) => r.day >= last30 && r.kind !== 'bot').forEach((r) => m.set(r.country, (m.get(r.country) || 0) + r.n));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sec, last30]);

  const resolve = async (e: SecurityEvent) => {
    const note = window.prompt('What was found and done? (kept with the report and in the audit log)');
    if (!note) return;
    await updateDoc(doc(db, 'security_events', e.id), { status: 'resolved', resolution: note.slice(0, 1000), resolvedAt: new Date().toISOString(), resolvedBy: auth.currentUser?.uid || '' });
    await audit('SECURITY_EVENT_RESOLVED', e.id, note);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[1.5rem] font-semibold">Security</h2>
          <p className="mt-1 max-w-[75ch] text-ink-soft">
            Traffic trends and security signals, aggregated by day, type and country. These figures cannot show who anyone is, and they are not evidence of surveillance:
            locations from IP addresses are approximate, and VPNs and Tor hide real locations. Investigate only under the privacy policy and record what you do.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2 font-semibold hover:border-navy"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
      </div>
      {err && <p className="rounded-lg border border-line bg-stone px-4 py-3 text-[0.9375rem] text-ink-soft">{err}</p>}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-[1.125rem] font-semibold">Security signals, last 30 days</h3>
          <dl className="mt-3 divide-y divide-line text-[0.9375rem]">
            {Object.keys(KIND_LABEL).map((k) => (
              <div key={k} className="flex justify-between gap-3 py-2"><dt>{KIND_LABEL[k]}</dt><dd className="font-semibold tabular-nums">{(byKind.get(k) || 0).toLocaleString('en-GB')}</dd></div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-[1.125rem] font-semibold">Where signals came from (approximate)</h3>
          {byCountry.length === 0 ? <p className="mt-3 text-muted">Nothing recorded.</p> : (
            <ul className="mt-3 space-y-1.5 text-[0.9375rem]">{byCountry.map(([c, v]) => <li key={c} className="flex justify-between"><span>{flag(c)} {countryName(c)}</span><strong className="tabular-nums">{v}</strong></li>)}</ul>
          )}
          <p className="mt-3 text-[0.8125rem] text-muted">A country here is not proof of who is behind the traffic. Do not describe activity as government surveillance without independent evidence.</p>
        </div>
      </section>

      <p className="rounded-xl border border-line bg-surface p-4 text-[0.9375rem] text-ink-soft">Visitor figures by country, with members and visitors shown separately and any period you choose, are under <strong>Visitor analytics</strong>.</p>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-[1.125rem] font-semibold">Reported submissions and incidents</h3>
        {events === null ? <p className="mt-3 text-muted">Loading…</p> : events.length === 0 ? <p className="mt-3 text-muted">No reports.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{e.title || e.kind.replace('_', ' ')}</p>
                  <p className="text-[0.875rem] text-ink-soft">{new Date(e.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{e.note ? ` · ${e.note}` : ''}</p>
                  {e.resolution && <p className="text-[0.875rem] text-navy">Resolved: {e.resolution}</p>}
                </div>
                {e.status === 'open' && <button type="button" onClick={() => resolve(e)} className="shrink-0 cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold">Mark resolved</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-[1.125rem] font-semibold">Security and privacy framework</h3>
        <p className="mt-1 text-[0.9375rem] text-ink-soft">Because we report on Iran, Iraq and Kurdistan, we assume the site may be monitored, analysed or attacked, and protect contributors and readers accordingly. We cannot tell whether a particular visitor is being watched, and we never promise anonymity.</p>
        <ul className="mt-4 space-y-3">
          {FRAMEWORK.map((c) => (
            <li key={c.title} className="flex gap-3">
              {c.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-label="In place" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#B07A12]" aria-label="Needs action" />}
              <div><p className="font-semibold">{c.title}{!c.done && <span className="ms-2 rounded-full bg-amber-tint px-2 py-0.5 text-[0.75rem] font-semibold text-[#8a5b00]">Needs your action</span>}</p><p className="text-[0.9375rem] text-ink-soft">{c.detail}</p></div>
            </li>
          ))}
        </ul>
        <h4 className="mt-6 font-semibold">If something goes wrong (data breach or attack)</h4>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-[0.9375rem] text-ink-soft">
          <li>Contain it: change passwords, remove the affected person’s administrator role, and if needed turn on Cloudflare “Under Attack” mode.</li>
          <li>Record what happened here (report and resolution) and in the audit log.</li>
          <li>If personal data may be exposed, assess the risk to the people involved, especially contributors in Iran or Iraq, and warn them directly and safely.</li>
          <li>Report to the Information Commissioner’s Office within 72 hours if the breach is likely to put people at risk.</li>
          <li>Review what failed and update this framework.</li>
        </ol>
        <h4 className="mt-6 font-semibold">Third-party services that can see visits</h4>
        <ul className="mt-2 space-y-1 text-[0.9375rem] text-ink-soft">{THIRD_PARTIES.map(([a, b]) => <li key={a}><strong className="text-ink">{a}:</strong> {b}</li>)}</ul>
      </section>
    </div>
  );
};
