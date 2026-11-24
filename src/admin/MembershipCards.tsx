import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Download, QrCode, Search, X } from 'lucide-react';
import { downloadQrPng, downloadQrSvg } from '../lib/qrDownload';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { MemberCardBack, MemberCardFront } from '../components/MemberCard';
import { unitLine } from '../lib/positions';
import { cardDate, DEFAULT_SITE_URL, defaultCardDates, issueCredential, setMembershipStatus, STATE_LABEL, verificationState } from '../lib/membership';
import { MemberRecord, VerificationState } from '../types';
import { CredentialForm, CredentialValues, credentialValid, defaultCredentialValues } from './CredentialForm';

type Filter = 'all' | VerificationState | 'not_issued' | 'expiring';

const STATE_CHIP: Record<VerificationState | 'not_issued', string> = {
  active: 'bg-navy-tint text-navy',
  expired: 'bg-amber-tint text-ink',
  suspended: 'bg-crimson/10 text-crimson',
  revoked: 'bg-crimson/10 text-crimson',
  not_issued: 'bg-stone text-ink-soft',
};

const stateOf = (m: MemberRecord): VerificationState | 'not_issued' =>
  m.verifyUrl && m.expiresAt ? verificationState(m.status, m.expiresAt) : m.status === 'revoked' ? 'revoked' : m.status === 'suspended' ? 'suspended' : 'not_issued';

/** Admin tool: issue, renew, edit, suspend, reactivate and revoke membership cards. */
export const MembershipCards: React.FC<{ initialFilter?: Filter }> = ({ initialFilter = 'all' }) => {
  const { siteSettings, chapters, updateSiteSettings } = useData();
  const savedSiteUrl = siteSettings.siteUrl || DEFAULT_SITE_URL;
  const [siteUrlDraft, setSiteUrlDraft] = useState(savedSiteUrl);
  useEffect(() => { setSiteUrlDraft(savedSiteUrl); }, [savedSiteUrl]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ member: MemberRecord; mode: 'issue' | 'renew' | 'edit'; values: CredentialValues } | null>(null);
  const [viewing, setViewing] = useState<MemberRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'members'));
      setMembers(snap.docs.map((d) => ({ ...(d.data() as MemberRecord), id: d.id })).sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      console.warn('Members load error:', e);
      setMessage({ kind: 'error', text: 'Members could not be loaded. Check your permissions.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: members.length, active: 0, expired: 0, suspended: 0, revoked: 0, not_issued: 0, expiring: 0 };
    members.forEach((m) => {
      const s = stateOf(m);
      c[s] += 1;
      if (s === 'active' && m.expiresAt && m.expiresAt.slice(0, 10) <= in30) c.expiring += 1;
    });
    return c;
  }, [members, in30]);

  const q = search.trim().toLowerCase();
  const visible = members.filter((m) => {
    const s = stateOf(m);
    if (filter === 'expiring') { if (!(s === 'active' && m.expiresAt && m.expiresAt.slice(0, 10) <= in30)) return false; }
    else if (filter !== 'all' && s !== filter) return false;
    if (!q) return true;
    return [m.fullName, m.displayName, m.email, m.memberNumber, m.designation].some((v) => (v || '').toLowerCase().includes(q));
  });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
      return true;
    } catch (e) {
      console.error(e);
      const text = e instanceof Error ? e.message : String(e);
      setMessage({ kind: 'error', text: /permission/i.test(text) ? 'The database refused this change. Check that the latest rules are deployed and that you have permission.' : text });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveCard = async () => {
    if (!editing) return;
    if (!credentialValid(editing.values)) {
      setMessage({ kind: 'error', text: 'Please complete the card details. The expiry date must be after the valid-from date.' });
      return;
    }
    const { member, values, mode } = editing;
    const ok = await run(
      () => issueCredential({
        memberId: member.id,
        memberNumber: values.memberNumber,
        positionId: values.positionId,
        designation: values.designation,
        joinedAt: values.joinedAt,
        validFrom: values.validFrom,
        expiresAt: values.expiresAt,
        replaceQr: values.replaceQr,
        siteUrl: siteSettings.siteUrl,
        kind: mode === 'issue' ? 'issued' : mode === 'renew' ? 'renewed' : 'updated',
      }),
      mode === 'renew' ? `Card renewed for ${member.fullName}.` : mode === 'issue' ? `Card issued for ${member.fullName}.` : `Card updated for ${member.fullName}.`,
    );
    if (ok) setEditing(null);
  };

  const changeStatus = async (m: MemberRecord, status: 'active' | 'suspended' | 'revoked') => {
    const verb = { active: 'reactivate', suspended: 'suspend', revoked: 'revoke' }[status];
    const reason = status === 'active' ? '' : window.prompt(`Why are you ${status === 'suspended' ? 'suspending' : 'revoking'} ${m.fullName}'s membership? (shown to them)`) ?? null;
    if (reason === null) return;
    if (status === 'revoked' && !window.confirm(`Revoke ${m.fullName}'s membership? Their card will show as revoked and they will be removed from the directory.`)) return;
    await run(() => setMembershipStatus(m, status, reason), `Membership ${verb}d for ${m.fullName}.`);
  };

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      aria-pressed={filter === f}
      className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.875rem] ${filter === f ? 'border-navy bg-navy text-white' : 'border-line hover:border-ink/40'}`}
    >
      {label} <span className="tabular-nums opacity-80">{counts[f] ?? 0}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-semibold">Membership cards</h2>
        <p className="mt-1 text-ink-soft">Issue and renew digital cards, assign roles, and suspend or revoke memberships. Every change updates the member’s card, their profile page and the directory, and notifies the member.</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="qr-heading">
        <div className="flex items-start gap-3">
          <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 id="qr-heading" className="font-semibold">Where the QR codes point</h3>
              <p className="text-[0.9375rem] text-ink-soft">
                Every card’s QR code opens that member’s profile page on this website, which shows whether the card is valid. Enter the website’s address exactly as people type it.
                Cards already issued keep their link, so set this before issuing cards. To move an issued card to a new address, use Edit and tick “Issue a new QR code”.
              </p>
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const v = siteUrlDraft.trim().replace(/\/+$/, '');
                if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(v)) {
                  setMessage({ kind: 'error', text: 'Enter the full address starting with https://, for example https://mashkhall.com' });
                  return;
                }
                run(() => updateSiteSettings({ siteUrl: v }), `QR codes will now point to ${v}.`);
              }}
            >
              <label className="sr-only" htmlFor="site-url">Website address</label>
              <input id="site-url" value={siteUrlDraft} onChange={(e) => setSiteUrlDraft(e.target.value)} inputMode="url" className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 focus:border-navy focus:outline-none" />
              <button type="submit" disabled={busy || (Boolean(siteSettings.siteUrl) && siteUrlDraft.trim().replace(/\/+$/, '') === savedSiteUrl)} className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">{siteSettings.siteUrl ? 'Save address' : 'Confirm address'}</button>
            </form>
            <div className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
              <span className="text-ink-soft">QR code for the website itself, for posters and new printed cards:</span>
              <button type="button" onClick={() => downloadQrPng(savedSiteUrl, 'mashkhally-zhyanawa-website-qr.png')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-ink/40"><Download className="h-4 w-4" aria-hidden="true" />PNG</button>
              <button type="button" onClick={() => downloadQrSvg(savedSiteUrl, 'mashkhally-zhyanawa-website-qr.svg')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-ink/40"><Download className="h-4 w-4" aria-hidden="true" />SVG</button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {chip('all', 'All')}
          {chip('active', 'Active')}
          {chip('expiring', 'Expiring in 30 days')}
          {chip('expired', 'Expired')}
          {chip('not_issued', 'No card yet')}
          {chip('suspended', 'Suspended')}
          {chip('revoked', 'Revoked')}
        </div>
        <label className="relative w-full lg:w-72">
          <span className="sr-only">Search members</span>
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or member ID" className="w-full rounded-full border border-line bg-surface py-2 pe-3 ps-9 text-[0.9375rem] focus:border-navy focus:outline-none" />
        </label>
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${message.kind === 'ok' ? 'bg-navy-tint text-ink' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-muted">Loading members…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-muted">No members match.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-start text-[0.9375rem]">
            <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">ID and role</th>
                <th className="px-4 py-3 font-semibold">Card</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-end font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((m) => {
                const s = stateOf(m);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{m.fullName}</p>
                      <p className="text-[0.8438rem] text-muted">{chapters.find((c) => c.id === m.chapterId)?.name || m.chapterId}{m.joinedAt ? `, joined ${cardDate(m.joinedAt)}` : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="tabular-nums">{m.memberNumber || '—'}</p>
                      <p className="text-[0.8438rem] text-muted">{m.designation || 'Member'}</p>
                    </td>
                    <td className="px-4 py-3 text-[0.875rem] tabular-nums">{m.expiresAt ? `${cardDate(m.validFrom)} to ${cardDate(m.expiresAt)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold ${STATE_CHIP[s]}`}>{s === 'not_issued' ? 'No card yet' : STATE_LABEL[s]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {s === 'not_issued' ? (
                          <button type="button" disabled={busy || m.status === 'revoked'} onClick={() => setEditing({ member: m, mode: 'issue', values: defaultCredentialValues({ ...m, designation: m.designation, joinedAt: (m.joinedAt || new Date().toISOString()).slice(0, 10), ...defaultCardDates(m.joinedAt || new Date().toISOString(), m.appliedAt) }) })} className="cursor-pointer rounded-lg bg-navy px-3 py-1.5 text-[0.8438rem] font-semibold text-white disabled:opacity-50">Issue card</button>
                        ) : (
                          <>
                            <button type="button" onClick={() => setViewing(m)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:border-ink/40">View</button>
                            <button
                              type="button"
                              disabled={busy || m.status === 'revoked'}
                              onClick={() => {
                                const from = m.expiresAt && m.expiresAt.slice(0, 10) > new Date().toISOString().slice(0, 10) ? m.expiresAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                setEditing({ member: m, mode: 'renew', values: { ...defaultCredentialValues({ ...m, validFrom: from, expiresAt: undefined }), memberNumber: m.memberNumber } });
                              }}
                              className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:border-ink/40 disabled:opacity-50"
                            >
                              Renew
                            </button>
                            <button type="button" disabled={busy || m.status === 'revoked'} onClick={() => setEditing({ member: m, mode: 'edit', values: defaultCredentialValues(m) })} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:border-ink/40 disabled:opacity-50">Edit</button>
                          </>
                        )}
                        {m.status === 'suspended' || m.status === 'revoked' ? (
                          <button type="button" disabled={busy} onClick={() => changeStatus(m, 'active')} className="cursor-pointer rounded-lg border border-navy px-3 py-1.5 text-[0.8438rem] font-semibold text-navy disabled:opacity-50">Reactivate</button>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => changeStatus(m, 'suspended')} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:border-crimson/50 hover:text-crimson disabled:opacity-50">Suspend</button>
                        )}
                        {m.status !== 'revoked' && (
                          <button type="button" disabled={busy} onClick={() => changeStatus(m, 'revoked')} className="cursor-pointer rounded-lg px-3 py-1.5 text-[0.8438rem] font-semibold text-crimson hover:bg-crimson/5 disabled:opacity-50">Revoke</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="cred-title">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 id="cred-title" className="text-[1.375rem] font-semibold">
                  {editing.mode === 'issue' ? 'Issue card' : editing.mode === 'renew' ? 'Renew card' : 'Edit card'}
                </h3>
                <p className="text-[0.9375rem] text-muted">{editing.member.fullName}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <CredentialForm
              values={editing.values}
              onChange={(values) => setEditing({ ...editing, values })}
              mode={editing.mode === 'issue' ? 'approve' : editing.mode}
              hasExistingCard={Boolean(editing.member.verifyUrl)}
            />
            <div className="mt-6 flex justify-end gap-2 border-t border-line pt-5">
              <button type="button" onClick={() => setEditing(null)} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft hover:bg-stone">Cancel</button>
              <button type="button" disabled={busy} onClick={saveCard} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">
                {busy ? 'Saving…' : editing.mode === 'issue' ? 'Issue card' : editing.mode === 'renew' ? 'Renew card' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-label={`Card for ${viewing.fullName}`}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[1.375rem] font-semibold">{viewing.fullName}</h3>
              <button type="button" onClick={() => setViewing(null)} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="mx-auto w-full max-w-[300px]"><MemberCardFront member={viewing} unit={unitLine(viewing, (id) => chapters.find((c) => c.id === id)?.name || id || '')} /></div>
              <div className="mx-auto w-full max-w-[300px]"><MemberCardBack member={viewing} /></div>
            </div>
            {viewing.verifyUrl && (
              <div className="mt-5 space-y-3">
                <p className="break-all text-[0.875rem] text-muted">Verification link: <a href={viewing.verifyUrl} target="_blank" rel="noopener noreferrer" className="text-navy underline">{viewing.verifyUrl}</a></p>
                <div className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
                  <span className="text-ink-soft">This member’s QR code, for printing on the plastic card:</span>
                  <button type="button" onClick={() => downloadQrPng(viewing.verifyUrl!, `${viewing.memberNumber}-qr.png`)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-ink/40"><Download className="h-4 w-4" aria-hidden="true" />PNG</button>
                  <button type="button" onClick={() => downloadQrSvg(viewing.verifyUrl!, `${viewing.memberNumber}-qr.svg`)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-ink/40"><Download className="h-4 w-4" aria-hidden="true" />SVG</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
