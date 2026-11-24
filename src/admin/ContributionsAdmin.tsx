import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  ContributorStats, correctCount, countFor, FeeCategory, feeFor, loadContributorStats, loadPayments, PAYMENT_STATUS_LABEL,
  PaymentStatus, pounds, reportSuspiciousSubmission, setPaymentStatus, SubmissionPayment, DISCOUNT_AFTER, FREE_AFTER, DISCOUNT_PERCENT, FEES,
} from '../lib/contributions';

type View = 'check' | 'all' | 'contributors';

const STATUS_CLS: Record<PaymentStatus, string> = {
  awaiting: 'bg-stone text-ink-soft', claimed: 'bg-amber-tint text-ink', verified: 'bg-navy-tint text-navy', rejected: 'bg-crimson/10 text-crimson',
  refunded: 'bg-stone text-ink-soft', disputed: 'bg-crimson/10 text-crimson', waived: 'bg-navy-tint text-navy',
};

/**
 * Visitors' publication fees: confirm bank payments (which sends the work to
 * editorial review), record refunds and queries, see each contributor's
 * published counts and correct them with a reason. Everything is audited.
 */
export const ContributionsAdmin: React.FC = () => {
  const { articles } = useData();
  const [view, setView] = useState<View>('check');
  const [payments, setPayments] = useState<SubmissionPayment[] | null>(null);
  const [stats, setStats] = useState<ContributorStats[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');

  const load = async () => {
    try {
      const [p, s] = await Promise.all([loadPayments(), loadContributorStats()]);
      setPayments(p);
      setStats(s);
    } catch (e) {
      console.error(e);
      setPayments([]);
      setMsg({ ok: false, text: 'Payments could not be loaded. Check that the latest database rules are published.' });
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: e instanceof Error && !/permission/i.test(e.message) ? e.message : 'That was refused. You need administrator or donations permission, and the latest database rules.' });
    } finally { setBusy(false); }
  };

  const nameOf = (uid: string) => stats.find((s) => s.uid === uid)?.name || articles.find((a) => a.authorUid === uid)?.authorDisplayName || 'Contributor';
  const all = payments || [];
  const toCheck = all.filter((p) => p.status === 'claimed' || p.status === 'awaiting' || p.status === 'disputed')
    .sort((a, b) => (a.status === 'claimed' ? -1 : 0) - (b.status === 'claimed' ? -1 : 0) || a.createdAt.localeCompare(b.createdAt));
  const shown = all.filter((p) => (statusFilter === 'all' || p.status === statusFilter)
    && (!q.trim() || `${p.reference} ${p.title} ${nameOf(p.uid)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const received = all.filter((p) => p.status === 'verified').reduce((n, p) => n + p.amountPence, 0);
  const refunded = all.filter((p) => p.status === 'refunded').reduce((n, p) => n + p.amountPence, 0);

  const contributors = useMemo(() => {
    const ids = new Set([...all.map((p) => p.uid), ...stats.map((s) => s.uid)]);
    return Array.from(ids).map((uid) => {
      const s = stats.find((x) => x.uid === uid) || { uid, name: nameOf(uid), articles: 0, videos: 0, updatedAt: '' };
      const theirs = all.filter((p) => p.uid === uid);
      return { s, submissions: theirs.length, paid: theirs.filter((p) => p.status === 'verified').reduce((n, p) => n + p.amountPence, 0) };
    }).sort((a, b) => b.submissions - a.submissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, stats]);

  const ask = (text: string) => window.prompt(text) ?? null;

  const Row: React.FC<{ p: SubmissionPayment }> = ({ p }) => {
    const [open, setOpen] = useState(false);
    const art = articles.find((a) => a.id === p.articleId);
    return (
      <li className="space-y-2 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-semibold" dir="auto">{p.title}</p>
            <p className="text-[0.875rem] text-ink-soft">
              {nameOf(p.uid)} · {p.category === 'video' ? 'Video' : 'Article'} · <strong>{pounds(p.amountPence)}</strong>{p.tier === 'discount' ? ` (${DISCOUNT_PERCENT}% off)` : p.tier === 'free' ? ' (free)' : ''} · reference <strong className="tabular-nums">{p.reference}</strong>
            </p>
            <p className="text-[0.8125rem] text-muted">Sent {new Date(p.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{p.claimedAt ? ` · marked paid ${new Date(p.claimedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}{art ? ` · work: ${art.status.replace('_', ' ')}` : ''}</p>
            {p.payerNote && <p className="mt-1 text-[0.875rem]">Contributor: “{p.payerNote}”</p>}
          </div>
          <span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${STATUS_CLS[p.status]}`}>{PAYMENT_STATUS_LABEL[p.status]}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {['awaiting', 'claimed', 'disputed', 'rejected'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Confirm that ${pounds(p.amountPence)} with reference ${p.reference} has arrived in the bank account? The work will go to editorial review.`)) run(() => setPaymentStatus(p, 'verified'), `Payment ${p.reference} confirmed. The work is now in Article review.`); }}
              className="cursor-pointer rounded-lg bg-navy px-3.5 py-1.5 text-[0.875rem] font-semibold text-white disabled:opacity-50">Confirm payment received</button>
          )}
          {['awaiting', 'claimed'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { const n = ask('Why can the payment not be found? (shown to the contributor)'); if (n !== null) run(() => setPaymentStatus(p, 'rejected', n), 'Marked as not found. The contributor has been told.'); }}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">Payment not found</button>
          )}
          {['claimed', 'verified'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { const n = ask('What is the question about this payment? (shown to the contributor)'); if (n) run(() => setPaymentStatus(p, 'disputed', n), 'Payment marked as under query.'); }}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold disabled:opacity-50">Query</button>
          )}
          {['verified', 'disputed'].includes(p.status) && (
            <button type="button" disabled={busy} onClick={() => { const n = ask('Record the refund: date, amount and how it was paid back.'); if (n) run(() => setPaymentStatus(p, 'refunded', n), 'Refund recorded.'); }}
              className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold disabled:opacity-50">Record refund</button>
          )}
          <button type="button" disabled={busy} onClick={() => { const n = ask('What looks suspicious about this submission? (for administrators only)'); if (n) run(() => reportSuspiciousSubmission(p, n), 'Reported to the security dashboard.'); }}
            className="cursor-pointer rounded-lg border border-line px-3.5 py-1.5 text-[0.875rem] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">Report as suspicious</button>
          {(p.history || []).length > 0 && <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer px-2 text-[0.875rem] font-semibold underline">{open ? 'Hide history' : `History (${p.history!.length})`}</button>}
        </div>
        {open && (
          <ol className="space-y-1 border-s-2 border-line ps-3 text-[0.8125rem] text-ink-soft">
            {(p.history || []).map((h, i) => <li key={i}>{new Date(h.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {h.by} · {h.action}{h.note ? `: ${h.note}` : ''}</li>)}
          </ol>
        )}
      </li>
    );
  };

  const correct = (s: ContributorStats, category: FeeCategory) => {
    const current = countFor(s, category);
    const v = ask(`Correct ${s.name || 'this contributor'}'s published ${category === 'video' ? 'videos' : 'articles'} (now ${current}). New number:`);
    if (v === null) return;
    const reason = ask('Reason for the correction (kept in the audit log):');
    if (!reason) return;
    run(() => correctCount(s, category, Number(v), reason), 'Count corrected and recorded in the audit log.');
  };

  const tab = (v: View, l: string) => <button type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-[0.875rem] font-semibold ${view === v ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'}`}>{l}</button>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-semibold">Contributions and publication fees</h2>
        <p className="mt-1 max-w-[75ch] text-ink-soft">
          These are submissions sent from contributor accounts before Publish with Us moved to submissions without an account (new ones are under Publish with Us submissions). Fees: {pounds(FEES.article.standard)} per article and {pounds(FEES.video.standard)} per video ({DISCOUNT_PERCENT}% off after {DISCOUNT_AFTER} published, free after {FREE_AFTER}). Check the bank account for the reference, then confirm: the work then goes to Article review.
          Payments are never shown publicly. Records are kept, not deleted; every change is in each payment’s history and the audit log.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Waiting to be checked', String(toCheck.filter((p) => p.status === 'claimed').length)], ['Waiting for payment', String(all.filter((p) => p.status === 'awaiting').length)], ['Confirmed (total)', pounds(received)], ['Refunded (total)', pounds(refunded)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4"><dt className="text-[0.875rem] text-muted">{k}</dt><dd className="mt-1 text-[1.5rem] font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
      <div role="tablist" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit">
        {tab('check', `To check (${toCheck.length})`)}{tab('all', `All payments (${all.length})`)}{tab('contributors', `Contributors (${contributors.length})`)}
      </div>

      {payments === null ? <p className="text-muted">Loading…</p> : view === 'check' ? (
        toCheck.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nothing to check.</p> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{toCheck.map((p) => <Row key={p.id} p={p} />)}</ul>
        )
      ) : view === 'all' ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1 sm:max-w-sm">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, title or name" className="w-full rounded-lg border border-line bg-surface py-2 pe-3 ps-9" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-line bg-surface px-3 py-2" aria-label="Status">
              <option value="all">All statuses</option>
              {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          {shown.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No payments match.</p> : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{shown.map((p) => <Row key={p.id} p={p} />)}</ul>
          )}
        </>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-start text-[0.9375rem]">
            <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
              <tr><th className="px-4 py-2 font-semibold">Contributor</th><th className="px-4 py-2 font-semibold">Published articles</th><th className="px-4 py-2 font-semibold">Published videos</th><th className="px-4 py-2 font-semibold">Submissions</th><th className="px-4 py-2 font-semibold">Fees confirmed</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {contributors.map(({ s, submissions, paid }) => (
                <tr key={s.uid}>
                  <td className="px-4 py-3 font-semibold">{s.name || nameOf(s.uid)}</td>
                  {(['article', 'video'] as FeeCategory[]).map((c) => {
                    const n = countFor(s, c);
                    const f = feeFor(c, n);
                    return (
                      <td key={c} className="px-4 py-3">
                        <span className="tabular-nums font-semibold">{n}</span>
                        <span className="block text-[0.8125rem] text-muted">Next fee {f.amountPence ? pounds(f.amountPence) : 'free'}</span>
                        <button type="button" disabled={busy} onClick={() => correct(s, c)} className="cursor-pointer text-[0.8125rem] font-semibold text-navy underline">Correct</button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 tabular-nums">{submissions}</td>
                  <td className="px-4 py-3 tabular-nums">{pounds(paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
