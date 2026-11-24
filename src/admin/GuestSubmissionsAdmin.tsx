import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { pounds, DISCOUNT_AFTER, FREE_AFTER } from '../lib/contributions';
import {
  approveSubmission, confirmGuestPayment, declineUnpaid, feePreview, GUEST_KINDS, GUEST_PAYMENT_LABEL, GUEST_STATUS_LABEL, GuestPaymentStatus, GuestStatus, GuestSubmission,
  loadGuestImage, loadGuestSubmissions, publishedCountFor, publishGuestWork, rejectSubmission, requestChanges, setGuestPayment, startReview,
} from '../lib/guestSubmissions';
import { localeOf } from '../i18n/lang';
import { VideoPlayer } from '../components/VideoEmbed';
import { subtitlesOf, VIDEOS_ONLY_TAG, visibleTags } from '../lib/video';
import { waivePublicationFee } from '../lib/memberApi';

type View = 'review' | 'payments' | 'publish' | 'all';

const STATUS_CLS: Record<GuestStatus, string> = {
  awaiting_payment: 'bg-stone text-ink', submitted: 'bg-amber-tint text-ink', under_review: 'bg-amber-tint text-ink', changes_requested: 'bg-stone text-ink-soft',
  approved: 'bg-navy-tint text-navy', published: 'bg-navy text-white', rejected: 'bg-crimson/10 text-crimson',
  withdrawn: 'bg-stone text-ink-soft', unpublished: 'bg-stone text-ink-soft',
};

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(localeOf(), { dateStyle: 'medium', timeStyle: 'short' }) : '');
const kindLabel = (k: GuestSubmission['kind']) => GUEST_KINDS.find((x) => x.id === k)?.label || k;

const Photo: React.FC<{ id: string }> = ({ id }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { loadGuestImage(id).then((i) => setSrc(i?.dataUrl || null)).catch(() => setSrc(null)); }, [id]);
  return src ? <img src={src} alt="" className="h-24 w-36 rounded-md border border-line object-cover" /> : <span className="flex h-24 w-36 items-center justify-center rounded-md border border-dashed border-line text-[0.75rem] text-muted">Photo</span>;
};

/**
 * Publish with Us: editorial review, fees and publication of work sent
 * without an account. Editors review and approve (which sets the fee from
 * the central pricing); finance confirms payments; publishers publish once
 * the work is approved and paid (or free). Payment and publication status
 * are shown side by side. Contributors are never members.
 */
export const GuestSubmissionsAdmin: React.FC = () => {
  const { currentUser, userProfile, isAdmin, isPublisher, hasPermission } = useAuth();
  const canEdit = isAdmin || isPublisher || (userProfile?.roles || []).includes('content_reviewer');
  const canFinance = isAdmin || hasPermission('manage_donations');
  const [rows, setRows] = useState<GuestSubmission[] | null>(null);
  const [view, setView] = useState<View>('review');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, { count: number; text: string }>>({});

  const load = async () => {
    try { setRows(await loadGuestSubmissions()); } catch (e) {
      console.error(e);
      setRows([]);
      setMsg({ ok: false, text: 'Submissions could not be loaded. You need editor, publisher or finance rights, and the latest database rules must be published.' });
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: e instanceof Error && !/permission|insufficient/i.test(e.message) ? e.message : 'That was refused by the database. Check your permissions and that the latest rules are published.' });
    } finally { setBusy(false); }
  };

  const all = rows || [];
  const lists: Record<View, GuestSubmission[]> = useMemo(() => ({
    review: all.filter((s) => ['submitted', 'under_review', 'changes_requested'].includes(s.status)),
    payments: all.filter((s) => ['awaiting_payment', 'approved'].includes(s.status) && ['awaiting', 'claimed', 'rejected', 'disputed'].includes(s.payment.status)),
    publish: all.filter((s) => s.status === 'approved' && ['verified', 'waived'].includes(s.payment.status)),
    all: all.filter((s) => !q.trim() || `${s.title} ${s.contact.name} ${s.contact.email} ${s.payment.reference || ''} ${s.id}`.toLowerCase().includes(q.trim().toLowerCase())),
  }), [all, q]);
  const received = all.filter((s) => s.payment.status === 'verified').reduce((n, s) => n + (s.payment.amountPence || 0), 0);

  const ask = (text: string) => window.prompt(text);

  const loadPreview = async (s: GuestSubmission) => {
    if (preview[s.id]) return;
    const { count } = await publishedCountFor(s).catch(() => ({ count: 0 }));
    setPreview((p) => ({ ...p, [s.id]: { count, text: feePreview(s.feeCategory, count).text } }));
  };

  const tab = (v: View, l: string, n: number) => (
    <button type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
      className={`cursor-pointer rounded-md px-3.5 py-1.5 text-[0.875rem] font-semibold ${view === v ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'}`}>
      <span>{l}</span> <span className="tabular-nums">({n})</span>
    </button>
  );

  const Row: React.FC<{ s: GuestSubmission }> = ({ s }) => {
    const open = openId === s.id;
    const p = s.payment;
    const pv = preview[s.id];
    return (
      <li className="space-y-3 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button type="button" onClick={() => { setOpenId(open ? null : s.id); if (!open) loadPreview(s); }} className="cursor-pointer text-start font-semibold hover:underline">
              <span dir="auto" data-i18n-skip="">{s.title}</span>
            </button>
            <p className="text-[0.875rem] text-ink-soft">
              <span>{kindLabel(s.kind)}</span> · <span dir="auto" data-i18n-skip="">{s.contact.name}</span> · <span className="ltr-value" translate="no">{s.contact.email}</span> · <span>{when(s.createdAt)}</span>
            </p>
            {p.status !== 'not_due' && (
              <p className="text-[0.875rem]"><span>Fee</span> <strong className="tabular-nums">{pounds(p.amountPence || 0)}</strong>{p.reference && <> · <span>reference</span> <strong className="ltr-value tabular-nums" translate="no">{p.reference}</strong></>}{p.payerNote && <> · <span>contributor:</span> “<span data-i18n-skip="">{p.payerNote}</span>”</>}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5 self-start">
            <span className={`rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${STATUS_CLS[s.status]}`} title="Publication status">{GUEST_STATUS_LABEL[s.status]}</span>
            <span className="rounded-full border border-line px-2.5 py-1 text-[0.8125rem] font-semibold" title="Payment status">{GUEST_PAYMENT_LABEL[p.status]}</span>
          </div>
        </div>

        {open && (
          <div className="space-y-3 rounded-lg border border-line bg-paper p-4 text-[0.9375rem]">
            {s.excerpt && <p dir={s.direction} data-i18n-skip="" className="font-semibold text-ink-soft">{s.excerpt}</p>}
            <div dir={s.direction} data-i18n-skip="" className="max-h-96 overflow-y-auto whitespace-pre-line rounded-md bg-surface p-3 font-serif">{s.content || '—'}</div>
            {s.videoUrl && <div className="max-w-xl"><VideoPlayer url={s.videoUrl} title={`Preview: ${s.title}`} /></div>}
            {s.videoUrl && <p><span className="font-semibold">Video:</span> <a href={s.videoUrl} target="_blank" rel="noopener noreferrer" className="ltr-value break-all underline" translate="no">{s.videoUrl}</a></p>}
            {(s.tags || []).length > 0 && <p><span className="font-semibold">Tags:</span> <span data-i18n-skip="" dir="auto">{visibleTags(s.tags).join(', ') || '—'}</span>{subtitlesOf(s.tags).length > 0 && <> · <span className="font-semibold">Subtitles:</span> {subtitlesOf(s.tags).join(', ')}</>}{(s.tags || []).includes(VIDEOS_ONLY_TAG) && <> · <span>Videos section only</span></>}</p>}
            {s.sourceLinks && <p className="whitespace-pre-line"><span className="font-semibold">Sources:</span> <span dir="ltr" data-i18n-skip="">{s.sourceLinks}</span></p>}
            {s.images?.length > 0 && <div className="flex flex-wrap gap-2">{s.images.map((id) => <Photo key={id} id={id} />)}</div>}
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="inline font-semibold">Language:</dt> <dd className="inline" translate="no">{s.language}</dd></div>
              <div><dt className="inline font-semibold">Phone:</dt> <dd className="ltr-value inline" translate="no">{s.contact.phone || '—'}</dd></div>
              <div><dt className="inline font-semibold">Country:</dt> <dd className="inline" data-i18n-skip="">{s.contact.country || '—'}</dd></div>
              <div><dt className="inline font-semibold">Tracking id:</dt> <dd className="ltr-value inline" translate="no">{s.id}</dd></div>
              {pv && s.payment.status === 'not_due' && <div className="sm:col-span-2"><dt className="inline font-semibold">Fee if approved now:</dt> <dd className="inline"><strong>{pv.text}</strong> (<span>published before:</span> <span className="tabular-nums">{pv.count}</span>; <span>discount after</span> <span className="tabular-nums">{DISCOUNT_AFTER}</span>, <span>free after</span> <span className="tabular-nums">{FREE_AFTER}</span>)</dd></div>}
            </dl>
            {s.editorNote && <p className="rounded-md border-s-4 border-navy bg-surface p-3"><strong>Note to contributor:</strong> <span dir="auto" data-i18n-skip="">{s.editorNote}</span></p>}
            <ol className="space-y-1 border-s-2 border-line ps-3 text-[0.8125rem] text-ink-soft">
              {(s.history || []).map((h, i) => <li key={i}><span className="tabular-nums">{when(h.at)}</span> · <span>{h.by}</span> · <span>{h.action}</span>{h.note ? <>: <span data-i18n-skip="">{h.note}</span></> : null}</li>)}
            </ol>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canEdit && s.status === 'submitted' && (
            <button type="button" disabled={busy} onClick={() => run(() => startReview(s), 'Marked as in review.')} className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold disabled:opacity-50">Start review</button>
          )}
          {canEdit && ['submitted', 'under_review', 'changes_requested'].includes(s.status) && (
            <>
              <button type="button" disabled={busy} onClick={() => { const n = ask('Optional note to the contributor:'); if (n !== null) run(() => approveSubmission(s, n), p.status === 'not_due' ? 'Approved. The fee from the pricing table is now shown to the contributor.' : 'Approved. It is ready to publish.'); }}
                className="cursor-pointer rounded-lg bg-navy px-3.5 py-1.5 text-[0.875rem] font-semibold text-white disabled:opacity-50">{p.status === 'not_due' ? 'Approve and request fee' : 'Approve'}</button>
              <button type="button" disabled={busy} onClick={() => { const n = ask('What should the contributor change? (shown to them)'); if (n) run(() => requestChanges(s, n), 'Changes requested.'); }}
                className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold disabled:opacity-50">Request changes</button>
              <button type="button" disabled={busy} onClick={() => { const n = ask('Why is it not accepted? (shown to the contributor)'); if (n) run(() => rejectSubmission(s, n), 'Marked as not accepted.'); }}
                className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">Do not accept</button>
            </>
          )}
          {canFinance && ['awaiting_payment', 'approved'].includes(s.status) && ['awaiting', 'claimed', 'disputed', 'rejected'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Confirm that ${pounds(p.amountPence || 0)} with reference ${p.reference} has arrived in the bank account?`)) run(() => confirmGuestPayment(s), s.status === 'awaiting_payment' ? 'Payment confirmed. The work is now waiting for editorial review.' : 'Payment confirmed. The work can now be published.'); }}
              className="cursor-pointer rounded-lg bg-navy px-3.5 py-1.5 text-[0.875rem] font-semibold text-white disabled:opacity-50">Confirm payment received</button>
          )}
          {(canEdit || canFinance) && ['awaiting_payment', 'submitted', 'under_review', 'changes_requested', 'approved'].includes(s.status) && ['awaiting', 'claimed', 'rejected', 'disputed'].includes(p.status) && (p.amountPence || 0) > 0 && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove the fee for “${s.title}” (for example because a member sent it) and send it for editorial review?${p.status === 'claimed' ? ' The sender reported a payment: refund it if it arrives.' : ''}`)) run(() => waivePublicationFee(s.id), 'No fee. The work is now waiting for editorial review.'); }}
              className="cursor-pointer rounded-lg border border-navy px-3.5 py-1.5 text-[0.875rem] font-semibold text-navy disabled:opacity-50">No fee (member)</button>
          )}
          {canFinance && ['awaiting', 'claimed'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { const n = ask('Why can the payment not be found? (shown to the contributor)'); if (n !== null) run(() => setGuestPayment(s, 'rejected', n), 'Marked as not found.'); }}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold disabled:opacity-50">Payment not found</button>
          )}
          {(canEdit || canFinance) && s.status === 'awaiting_payment' && ['awaiting', 'rejected'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { const n = ask('Why is it not accepted? (shown to the contributor)'); if (n) run(() => declineUnpaid(s, n), 'Marked as not accepted.'); }}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">Do not accept</button>
          )}
          {canFinance && ['verified', 'disputed'].includes(p.status) && s.status !== 'published' && (
            <button type="button" disabled={busy} onClick={() => { const n = ask('Record the refund: date, amount and how it was paid back.'); if (n) run(() => setGuestPayment(s, 'refunded' as GuestPaymentStatus, n), 'Refund recorded.'); }}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold disabled:opacity-50">Record refund</button>
          )}
          {(isAdmin || isPublisher) && s.status === 'approved' && ['verified', 'waived'].includes(p.status) && currentUser && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm('Publish this work on the website now, under the contributor’s name?')) run(() => publishGuestWork(s, { uid: currentUser.uid }), 'Published. It now appears in News and reports.'); }}
              className="cursor-pointer rounded-lg bg-crimson px-3.5 py-1.5 text-[0.875rem] font-semibold text-white disabled:opacity-50">Publish now</button>
          )}
          {s.status === 'published' && s.articleSlug && (
            <a href={`/news/${encodeURIComponent(s.articleSlug)}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold no-underline">View <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
          )}
        </div>
      </li>
    );
  };

  const list = lists[view];
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[1.5rem] font-semibold">Publish with Us submissions</h2>
          <p className="mt-1 max-w-[80ch] text-ink-soft">Work sent through Publish with Us. Members publish free: if a member sent work here before signing in, press “No fee (member)” and it goes to Review. The fee is set from the central pricing table when the work is sent (with any discount for the contributor’s published work under the same email) and paid first: confirm the payment, and the work moves to Review. Approve it, then publish. If paid work is not accepted, record the refund. Contributors are never added to the membership register.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2 font-semibold hover:border-navy"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Waiting for review', lists.review.length],
          ['Waiting for payment', lists.payments.length],
          ['Ready to publish', lists.publish.length],
          ['Fees confirmed (total)', pounds(received)],
        ] as [string, number | string][]).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-4"><dt className="text-[0.875rem] text-muted">{k}</dt><dd className="mt-1 text-[1.5rem] font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
          {tab('review', 'Review', lists.review.length)}{tab('payments', 'Payments', lists.payments.length)}{tab('publish', 'Ready to publish', lists.publish.length)}{tab('all', 'All', all.length)}
        </div>
        {view === 'all' && (
          <label className="relative sm:w-80">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, name, email or reference" className="w-full rounded-lg border border-line bg-surface py-2 pe-3 ps-9" />
          </label>
        )}
      </div>
      {rows === null ? <p className="text-muted">Loading…</p> : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{list.map((s) => <Row key={s.id} s={s} />)}</ul>
      )}
    </div>
  );
};
