import React, { useEffect, useMemo, useState } from 'react';
import { doc } from 'firebase/firestore';
import { Loader2, RefreshCw } from 'lucide-react';
import { db, safeSetDoc } from '../firebase';
import { Button } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../context/AuthContext';
import { meetingApi, useMeetingData } from '../lib/meetings';
import { uploadImage } from '../lib/media';
import { Award } from '../lib/letter';
import { CategoriesEditor, CertificateDrawer, CertificateEditor, CertificateList, CertificateOverview, MemberAppreciation, useCertificates } from './CertificatesAdmin';

/**
 * Administration › Appreciation: letters and certificates issued directly
 * (draft, approval, issue, correction and revocation), lists of activity
 * participants submitted by council leaders, and the letter settings.
 */

type Tab = 'overview' | 'new' | 'drafts' | 'issued' | 'withdrawn' | 'members' | 'activities' | 'settings';
const TABS: [Tab, string][] = [
  ['overview', 'Overview'], ['new', 'New letter or certificate'], ['drafts', 'Drafts and approvals'], ['issued', 'Issued'],
  ['withdrawn', 'Revoked and replaced'], ['members', 'By member'], ['activities', 'Activity participation'], ['settings', 'Settings'],
];

interface Entry {
  id: string; activityId: string; activityTitle: string; activityDate: string; councilId: string; uid: string; name: string;
  status: 'attended' | 'not_attended' | 'excused'; note?: string; review: string; reviewNote?: string; submittedBy?: string; submittedAt?: string;
}
interface AdminData {
  pending: Entry[];
  returned: Entry[];
  awards: (Award & { approvedBy?: string })[];
  settings: { signatoryName?: string; signatoryTitle?: string; signatureImage?: string; statement?: string };
  signatory: { name: string; title: string };
}

const box = 'rounded-2xl border border-line bg-surface p-5 sm:p-6';
const field = 'mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2';
const STATUS: Record<Entry['status'], string> = { attended: 'Took part', not_attended: 'Did not take part', excused: 'Excused' };

export const AppreciationAdmin: React.FC = () => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const certs = useCertificates();
  const [open, setOpen] = useState<Award | null>(null);
  const [note, setNote] = useState('');
  const { data: activityData, error, loading, reload } = useMeetingData<AdminData>('appreciation-admin');
  const [decisions, setDecisions] = useState<Record<string, { decision: string; note: string }>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<AdminData['settings']>({});
  const [search, setSearch] = useState('');
  useEffect(() => { if (activityData) setSettings(activityData.settings || {}); }, [activityData]);

  const groups = useMemo(() => {
    const g = new Map<string, Entry[]>();
    for (const e of activityData?.pending || []) g.set(e.activityId, [...(g.get(e.activityId) || []), e]);
    return [...g.values()];
  }, [activityData]);

  if (loading && !activityData && !certs.data && !certs.error) return <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p>;
  const data: AdminData = activityData || { pending: [], returned: [], awards: [], settings: {}, signatory: { name: '', title: '' } };

  const decideAll = (entries: Entry[], decision: string) => setDecisions((d) => ({ ...d, ...Object.fromEntries(entries.map((e) => [e.id, { decision, note: d[e.id]?.note || '' }])) }));
  const submit = async (entries: Entry[]) => {
    const list = entries.filter((e) => decisions[e.id]?.decision).map((e) => ({ id: e.id, ...decisions[e.id] }));
    if (!list.length) { setMessage('Choose a decision for at least one person.'); return; }
    setBusy('review');
    setMessage('');
    try {
      const r = await meetingApi<{ approved: number; rejected: number; returned: number }>('appreciation-review', { decisions: list });
      setMessage(`Saved: ${r.approved} approved (letters issued), ${r.rejected} rejected, ${r.returned} returned to the leader.`);
      setDecisions({});
      reload();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };

  const revoke = async (a: Award) => {
    const reason = window.prompt(`Revoke letter ${a.number} for ${a.name}? Its verification page will show it as revoked. Reason:`);
    if (!reason) return;
    try { await meetingApi('appreciation-revoke', { id: a.id, reason }); setMessage(`Letter ${a.number} revoked.`); reload(); } catch (e) { setMessage((e as Error).message); }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('settings');
    try {
      await safeSetDoc(doc(db, 'site_settings', 'appreciation'), { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
      setMessage('Letter settings saved. New letters will use them.');
      reload();
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(''); }
  };

  const uploadSignature = async (file: File) => {
    if (!currentUser) return;
    setBusy('signature');
    try {
      const { ref } = await uploadImage(file, { uid: currentUser.uid, name: currentUser.displayName || '' }, 'Signature for Appreciation Letters', 900);
      setSettings((s) => ({ ...s, signatureImage: ref }));
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(''); }
  };

  const go = (t: string) => { setTab(t as Tab); setNote(''); };
  const changed = (msg: string) => { setOpen(null); setNote(msg); certs.reload(); reload(); if (tab === 'new') setTab('issued'); };
  const cd = certs.data;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.625rem] font-semibold">Appreciation</h2>
        <p className="text-ink-soft">Official letters and certificates of appreciation for members’ activity, research, media work, leadership and service. Each one has its own number and QR code that anyone can check.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Appreciation">
        {TABS.map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => go(id)}
            className={`shrink-0 cursor-pointer border-b-2 px-3 py-2.5 text-[0.9375rem] font-semibold ${tab === id ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            {text}{id === 'drafts' && cd ? ` (${cd.awards.filter((a) => a.status === 'draft' || a.status === 'pending').length})` : ''}{id === 'activities' && data.pending.length ? ` (${data.pending.length})` : ''}
          </button>
        ))}
      </nav>
      {(note || message) && <p className="rounded-lg bg-navy-tint px-4 py-3" role="status">{note || message}</p>}
      {certs.error && ['overview', 'new', 'drafts', 'issued', 'withdrawn', 'members'].includes(tab) && <div className={box}><p className="font-semibold">Not available right now</p><p className="mt-1 text-ink-soft">{certs.error}</p><Button variant="secondary" className="mt-3" onClick={certs.reload}>Try again</Button></div>}
      {cd && tab === 'overview' && <CertificateOverview data={cd} onGo={go} onOpen={setOpen} />}
      {cd && tab === 'new' && <CertificateEditor key={note} data={cd} onDone={changed} />}
      {cd && tab === 'drafts' && <CertificateList data={cd} statuses={['pending', 'draft']} title="Drafts and letters waiting for approval" empty="No drafts." onOpen={setOpen} />}
      {cd && tab === 'issued' && <CertificateList data={cd} statuses={['published']} title="Issued and valid" empty="Nothing issued yet." onOpen={setOpen} />}
      {cd && tab === 'withdrawn' && <CertificateList data={cd} statuses={['revoked', 'superseded']} title="Revoked and replaced" empty="None." onOpen={setOpen} />}
      {cd && tab === 'members' && <MemberAppreciation data={cd} onOpen={setOpen} />}
      {cd && open && <CertificateDrawer award={open} data={cd} onClose={() => setOpen(null)} onChanged={changed} />}

      {error && (tab === 'activities' || tab === 'settings') && <div className={box}><p className="font-semibold">Activity participation is not available right now</p><p className="mt-1 text-ink-soft">{error.message}</p><Button variant="secondary" className="mt-3" onClick={reload}>Try again</Button></div>}
      {tab === 'activities' && (<>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[70ch] text-ink-soft">Council leaders record who took part in an activity and submit the list. You decide on each person; approved participants receive a numbered, verifiable Letter of Appreciation.</p>
        <div className="flex gap-2">
          <a href="/meetings/participation" className="inline-flex items-center rounded-lg border border-line px-3 py-2 font-semibold no-underline">Record participation</a>
          <Button variant="secondary" onClick={reload}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button>
        </div>
      </div>
      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">Waiting for your decision ({data.pending.length})</h2>
        {!groups.length && <p className="mt-2 text-muted">No lists are waiting.</p>}
        <div className="mt-4 space-y-6">
          {groups.map((entries) => (
            <div key={entries[0].activityId} className="rounded-xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[1.125rem] font-semibold" dir="auto">{entries[0].activityTitle}</h3>
                <span className="text-[0.875rem] text-muted">{entries[0].activityDate ? new Date(entries[0].activityDate).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : ''}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[0.875rem]">
                <button type="button" className="cursor-pointer font-semibold text-navy underline" onClick={() => decideAll(entries.filter((e) => e.status === 'attended'), 'approved')}>Approve everyone who took part</button>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {entries.map((e) => (
                  <li key={e.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold" data-i18n-skip="" dir="auto">{e.name}</span>
                      <span className="block text-[0.875rem] text-muted">{STATUS[e.status]}{e.note ? ` · ${e.note}` : ''}{e.submittedBy === currentUser?.uid ? ' · submitted by you' : ''}</span>
                    </span>
                    <span className="flex flex-col gap-1.5 sm:w-[320px]">
                      <select aria-label={`Decision for ${e.name}`} value={decisions[e.id]?.decision || ''} onChange={(ev) => setDecisions((d) => ({ ...d, [e.id]: { decision: ev.target.value, note: d[e.id]?.note || '' } }))} className="rounded-lg border border-line bg-surface px-2 py-1.5">
                        <option value="">Decide later</option>
                        <option value="approved">{e.status === 'attended' ? 'Approve and issue letter' : 'Approve (no letter)'}</option>
                        <option value="returned">Return to the leader for correction</option>
                        <option value="rejected">Reject</option>
                      </select>
                      {decisions[e.id]?.decision && decisions[e.id].decision !== 'approved' && (
                        <input placeholder="Reason (required)" value={decisions[e.id].note} onChange={(ev) => setDecisions((d) => ({ ...d, [e.id]: { ...d[e.id], note: ev.target.value } }))} className="rounded-lg border border-amber bg-surface px-2 py-1.5" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="mt-3" disabled={busy === 'review'} onClick={() => submit(entries)}>{busy === 'review' ? 'Saving…' : 'Save decisions'}</Button>
            </div>
          ))}
        </div>
        {data.returned.length > 0 && <p className="mt-4 text-[0.9375rem] text-muted">{data.returned.length} entries are back with leaders for correction.</p>}
      </section>
      </>)}

      {tab === 'settings' && (<>

      <form onSubmit={saveSettings} className={box}>
        <h2 className="text-[1.375rem] font-semibold">Default signatory and wording</h2>
        <p className="mt-1 text-ink-soft">Letters and certificates are signed by <strong>{data.signatory.name || 'nobody yet'}</strong>, {data.signatory.title}, unless you choose someone else when preparing one. Leave the name empty to use the President recorded in the organisation structure.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block font-semibold">Signatory’s name<input className={field} value={settings.signatoryName || ''} onChange={(e) => setSettings({ ...settings, signatoryName: e.target.value })} dir="auto" /></label>
          <label className="block font-semibold">Signatory’s position<input className={field} value={settings.signatoryTitle || ''} placeholder="President" onChange={(e) => setSettings({ ...settings, signatoryTitle: e.target.value })} /></label>
          <label className="block font-semibold sm:col-span-2">Statement on the letter
            <textarea rows={3} maxLength={600} className={field} value={settings.statement || ''} placeholder="In recognition of your active participation and your contribution to the work of 17 Shubat Organisation for Human Rights." onChange={(e) => setSettings({ ...settings, statement: e.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <p className="font-semibold">Signature image <span className="font-normal text-muted">(optional; only if the signatory has authorised it)</span></p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {settings.signatureImage && <MediaImage src={settings.signatureImage} alt="Signature" className="h-16 rounded border border-line bg-white p-1" />}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSignature(f); }} />
              {settings.signatureImage && <button type="button" className="cursor-pointer text-crimson underline" onClick={() => setSettings({ ...settings, signatureImage: '' })}>Remove</button>}
            </div>
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={busy === 'settings' || busy === 'signature'}>Save letter settings</Button>
      </form>

      {cd && <CategoriesEditor data={cd} onSaved={(m) => { setNote(m); certs.reload(); }} />}
      </>)}
    </div>
  );
};
