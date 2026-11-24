import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, BadgeCheck, CheckCircle2, Circle, Clock, Copy, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { waivePublicationFee } from '../lib/memberApi';
import { db } from '../firebase';
import { Button, Container, formatDate, PageHeader } from '../components/ui';
import { BankTransferDetails } from '../components/BankTransferDetails';
import { pounds, DISCOUNT_PERCENT } from '../lib/contributions';
import {
  claimGuestPayment, forgetSubmission, GUEST_KINDS, GUEST_PAYMENT_LABEL, GUEST_STATUS_LABEL, GuestSubmission,
  resubmitGuestWork, statusPath, useGuestSubmission, withdrawGuestWork,
} from '../lib/guestSubmissions';
import { localeOf } from '../i18n/lang';

const field = 'mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[1rem] font-normal text-ink focus:border-navy focus:outline-none';

const tone = (s: GuestSubmission) =>
  s.status === 'published' ? 'bg-navy-tint text-navy'
    : ['rejected', 'withdrawn', 'unpublished'].includes(s.status) ? 'bg-crimson/10 text-crimson'
      : 'bg-amber-tint text-ink';

const kindLabel = (k: GuestSubmission['kind']) => GUEST_KINDS.find((x) => x.id === k)?.label || 'Publication';

/** Where the work is: sent → paid (or no fee) → editorial review → published. */
const Timeline: React.FC<{ s: GuestSubmission }> = ({ s }) => {
  const paidOrFree = ['verified', 'waived'].includes(s.payment.status);
  const reviewed = ['approved', 'published'].includes(s.status);
  const legacy = s.payment.status === 'not_due' || (s.status === 'approved' && !paidOrFree);
  const steps: { label: string; done: boolean; current: boolean }[] = legacy ? [
    { label: 'Received', done: true, current: s.status === 'submitted' },
    { label: 'Editorial review', done: reviewed, current: ['under_review', 'changes_requested'].includes(s.status) },
    { label: 'Payment', done: reviewed && paidOrFree, current: s.status === 'approved' && !paidOrFree },
    { label: 'Published', done: s.status === 'published', current: s.status === 'approved' && paidOrFree },
  ] : [
    { label: 'Sent', done: true, current: false },
    { label: s.payment.status === 'waived' ? 'No fee due' : 'Payment', done: paidOrFree, current: s.status === 'awaiting_payment' },
    { label: 'Editorial review', done: reviewed, current: ['submitted', 'under_review', 'changes_requested'].includes(s.status) },
    { label: 'Published', done: s.status === 'published', current: s.status === 'approved' },
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {steps.map((st) => (
        <li key={st.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.9375rem] ${st.done ? 'border-navy/30 bg-navy-tint' : st.current ? 'border-ember/50 bg-amber-tint' : 'border-line bg-surface text-muted'}`}>
          {st.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-navy" aria-hidden="true" /> : st.current ? <Clock className="h-4 w-4 shrink-0 text-ember" aria-hidden="true" /> : <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="font-semibold">{st.label}</span>
          <span className="sr-only">{st.done ? '(done)' : st.current ? '(now)' : '(not yet)'}</span>
        </li>
      ))}
    </ol>
  );
};

export const ContributeStatus: React.FC<{ id: string; onNavigate: (tab: string, param?: string) => void; onOpenAuth?: (mode?: 'signin' | 'signup') => void }> = ({ id, onNavigate, onOpenAuth }) => {
  const s = useGuestSubmission(id);
  const { currentUser, isMember } = useAuth();
  const signedIn = Boolean(currentUser && !currentUser.isAnonymous);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', excerpt: '', content: '', videoUrl: '', sourceLinks: '' });
  const [copied, setCopied] = useState(false);
  // Just sent from this browser: show the private link prominently once.
  const [fresh] = useState(() => { try { const k = `17shubat_new_${id}`; const v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return Boolean(v); } catch { return false; } });
  const link = typeof window !== 'undefined' ? `${window.location.origin}${statusPath(id)}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* not allowed */ } };

  useEffect(() => {
    if (s) setDraft({ title: s.title, excerpt: s.excerpt, content: s.content, videoUrl: s.videoUrl || '', sourceLinks: s.sourceLinks || '' });
  }, [s?.id, s?.status]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: e instanceof Error && !/permission|insufficient/i.test(e.message) ? e.message : 'That did not work. Please refresh the page and try again.' });
    } finally { setBusy(false); }
  };

  if (s === undefined) {
    return <><PageHeader title="Your submission" /><Container className="py-10"><p className="text-muted">Loading…</p></Container></>;
  }
  if (s === null) {
    return (
      <>
        <PageHeader title="Submission not found" />
        <Container className="space-y-4 py-10">
          <p className="max-w-[62ch] text-ink-soft">We could not find a submission with this link. Check that you copied the whole link. If you still cannot find it, contact us with your name and the title of your work.</p>
          <div className="flex flex-wrap gap-3"><Button onClick={() => onNavigate('contribute')}>Publish with us</Button><Button variant="secondary" onClick={() => onNavigate('contact')}>Contact us</Button></div>
        </Container>
      </>
    );
  }

  const fee = s.payment.amountPence || 0;
  const payable = s.status === 'awaiting_payment' || (s.status === 'approved' && s.payment.status !== 'not_due');
  const canPay = payable && ['awaiting', 'rejected'].includes(s.payment.status) && fee > 0;
  const canWithdraw = ['awaiting_payment', 'submitted', 'under_review', 'changes_requested', 'approved'].includes(s.status) && ['not_due', 'awaiting', 'rejected', 'waived'].includes(s.payment.status);

  return (
    <>
      <PageHeader title="Your submission" kicker={<a href="/contribute" className="underline underline-offset-4">Publish with us</a>} />
      <Container className="grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="min-w-0 space-y-6">
          {msg && (
            <p role={msg.ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-lg px-4 py-3 ${msg.ok ? 'border border-navy/20 bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>
              {msg.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}<span>{msg.text}</span>
            </p>
          )}

          {fresh && (
            <section role="status" className="rounded-xl border border-line border-t-4 border-t-navy bg-surface p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[1.375rem] font-semibold"><CheckCircle2 className="h-6 w-6 text-navy" aria-hidden="true" /> Thank you. Your work has been received.</h2>
              <p className="mt-2 text-ink-soft">{s.status === 'awaiting_payment'
                ? 'Please pay the publication fee below. Editorial review starts as soon as we have confirmed the payment.'
                : 'No fee is due. Your work is now waiting for editorial review.'}</p>
              <p className="mt-4 text-[0.9375rem] font-semibold">Your private tracking link</p>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <code className="ltr-value min-w-0 flex-1 truncate rounded-lg border border-line bg-paper px-3 py-2 text-[0.875rem]" dir="ltr" translate="no">{link}</code>
                <Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</Button>
              </div>
              <p className="mt-2 text-[0.8125rem] text-muted">Keep this link private: anyone who has it can see the status of your submission. It is also remembered in this browser. If you lose it, contact us with your name and the title of your work.</p>
            </section>
          )}

          <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.875rem] text-muted"><span>{kindLabel(s.kind)}</span> · <span>sent</span> <span>{formatDate(s.createdAt)}</span></p>
                <h2 dir="auto" data-i18n-skip="" className="mt-1 text-[1.5rem] leading-snug font-semibold">{s.title}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[0.875rem] font-semibold ${tone(s)}`}>{GUEST_STATUS_LABEL[s.status]}</span>
            </div>
            <div className="mt-5"><Timeline s={s} /></div>

            {s.editorNote && ['changes_requested', 'rejected', 'approved'].includes(s.status) && (
              <div className="mt-5 rounded-lg border-s-4 border-navy bg-paper p-4">
                <p className="font-semibold">From the editors</p>
                <p dir="auto" data-i18n-skip="" className="mt-1 whitespace-pre-line">{s.editorNote}</p>
              </div>
            )}

            {s.status === 'awaiting_payment' && <p className="mt-5 text-ink-soft">Your work is waiting for the publication fee. Editorial review starts once we have confirmed the payment.</p>}
            {s.status === 'submitted' && <p className="mt-5 text-ink-soft">Your work is waiting for editorial review. We will update this page when there is news, and the editors may contact you by email.</p>}
            {s.status === 'under_review' && <p className="mt-5 text-ink-soft">The editors are reviewing your work.</p>}
            {s.status === 'rejected' && <p className="mt-5 text-ink-soft">{['verified', 'disputed'].includes(s.payment.status)
              ? 'The editors have decided not to publish this work. We will refund your fee; this page shows when the refund has been made.'
              : 'The editors have decided not to publish this work. No fee is due; if you paid, you can ask us for a refund.'}</p>}
            {s.status === 'withdrawn' && <p className="mt-5 text-ink-soft">You withdrew this submission. It will not be published.</p>}
            {s.status === 'published' && s.articleSlug && (
              <a href={`/news/${encodeURIComponent(s.articleSlug)}`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-2.5 font-semibold text-white no-underline hover:bg-navy-deep">View it on the website <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
            )}
          </section>

          {payable && ['awaiting', 'claimed', 'rejected', 'disputed'].includes(s.payment.status) && fee > 0 && (
            <section className="rounded-xl border border-navy/25 bg-navy-tint p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[1.25rem] font-semibold"><BadgeCheck className="h-5 w-5 text-navy" aria-hidden="true" /> Members publish without a fee</h2>
              {signedIn && isMember ? (
                <>
                  <p className="mt-2 text-ink-soft">You are signed in as a member of 17 Shubat, so you do not need to pay. Your work will go straight to editorial review.</p>
                  <Button className="mt-3" disabled={busy} onClick={() => run(() => waivePublicationFee(id), 'No fee is due. Your work has been sent for editorial review.')}>{busy ? 'Please wait…' : 'Send for review without a fee'}</Button>
                </>
              ) : signedIn ? (
                <p className="mt-2 text-ink-soft">This account is not linked to a membership. If you are a member, sign in with the account your membership was approved on, or contact us and we will remove the fee.</p>
              ) : (
                <>
                  <p className="mt-2 text-ink-soft">If you are a member of 17 Shubat, sign in with your member account and you will not be asked to pay. Your work then goes straight to editorial review. Keep this page open.</p>
                  {onOpenAuth && <Button className="mt-3" onClick={() => onOpenAuth('signin')}>Sign in as a member</Button>}
                </>
              )}
            </section>
          )}

          {(payable || s.status === 'approved') && (
            <section className="rounded-xl border border-line border-t-4 border-t-ember bg-surface p-5 sm:p-6">
              <h2 className="text-[1.25rem] font-semibold">{fee > 0 ? 'Publication fee' : 'No fee is due'}</h2>
              {fee > 0 ? (
                <>
                  <p className="mt-2 text-[1.0625rem]"><span>Amount to pay:</span> <strong className="text-navy tabular-nums">{pounds(fee)}</strong>
                    {s.payment.tier === 'discount' && <span className="ms-2 text-[0.875rem] text-ink-soft"><span>({DISCOUNT_PERCENT}% off</span> <span className="tabular-nums">{pounds(s.payment.standardPence || 0)}</span><span>, for your earlier published work)</span></span>}
                  </p>
                  <p className="mt-1 text-[0.9375rem] text-ink-soft"><span>Payment status:</span> <strong>{GUEST_PAYMENT_LABEL[s.payment.status]}</strong></p>
                  {canPay && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[0.9375rem]">{s.status === 'awaiting_payment'
                        ? 'Pay by bank transfer using the reference below, then tell us you have paid. Editorial review starts once we have confirmed the payment. If the editors do not accept your work, we refund the fee.'
                        : 'Pay by bank transfer using the reference below. Then tell us you have paid. Your work is published once we have confirmed the payment.'}</p>
                      <BankTransferDetails amount={pounds(fee)} reference={s.payment.reference} />
                      <label className="block text-[0.9375rem] font-semibold">When and how did you pay? <span className="font-normal text-muted">(optional)</span>
                        <input dir="auto" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={field} />
                      </label>
                      <Button onClick={() => run(() => claimGuestPayment(s, note), 'Thank you. We will check the payment and update this page.')} disabled={busy}>I have paid</Button>
                    </div>
                  )}
                  {s.payment.status === 'claimed' && <p className="mt-3 text-ink-soft">We are checking your payment. This page updates when it is confirmed.</p>}
                  {s.payment.status === 'verified' && <p className="mt-3 text-ink-soft">{s.status === 'approved' ? 'Your payment is confirmed. Your work will be published shortly.' : 'Your payment is confirmed. Thank you.'}</p>}
                  {s.payment.status === 'refunded' && <p className="mt-3 text-ink-soft">Your fee has been refunded.</p>}
                </>
              ) : (
                <p className="mt-2 text-ink-soft">{s.status === 'approved'
                  ? 'Your work has been approved and no fee is due, thanks to your earlier published work. It will be published shortly.'
                  : 'No fee is due, thanks to your earlier published work.'}</p>
              )}
            </section>
          )}

          {s.status === 'changes_requested' && (
            <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
              <h2 className="text-[1.25rem] font-semibold">Make the requested changes</h2>
              {!editing ? (
                <Button className="mt-3" onClick={() => setEditing(true)}>Edit my work</Button>
              ) : (
                <form className="mt-3 space-y-4" onSubmit={(e) => { e.preventDefault(); if (draft.title.trim().length < 5) { setMsg({ ok: false, text: 'Please give your work a title (at least 5 characters).' }); return; } run(async () => { await resubmitGuestWork(s, draft); setEditing(false); }, 'Your changes have been sent back to the editors.'); }}>
                  <label className="block font-semibold">Title<input dir="auto" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={300} className={field} /></label>
                  <label className="block font-semibold">Short summary<textarea dir={s.direction} rows={2} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} maxLength={500} className={field} /></label>
                  <label className="block font-semibold">{s.kind === 'video' ? 'Description' : 'Text'}<textarea dir={s.direction} rows={12} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} className={field} /></label>
                  <label className="block font-semibold">Video link<input type="url" value={draft.videoUrl} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} className={field} /></label>
                  <label className="block font-semibold">Sources<textarea dir="ltr" rows={3} value={draft.sourceLinks} onChange={(e) => setDraft({ ...draft, sourceLinks: e.target.value })} className={field} /></label>
                  <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>Send back for review</Button><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button></div>
                </form>
              )}
            </section>
          )}

          <details className="rounded-xl border border-line bg-surface p-5">
            <summary className="cursor-pointer font-semibold">What you sent</summary>
            <div className="mt-3 space-y-3 text-[0.9375rem]">
              {s.excerpt && <p dir={s.direction} data-i18n-skip="" className="text-ink-soft">{s.excerpt}</p>}
              <p dir={s.direction} data-i18n-skip="" className="max-h-80 overflow-y-auto whitespace-pre-line rounded-lg bg-paper p-3">{s.content || '—'}</p>
              {s.videoUrl && <p><span className="font-semibold">Video link:</span> <span className="ltr-value break-all" dir="ltr" translate="no">{s.videoUrl}</span></p>}
              {s.images?.length > 0 && <p><span className="font-semibold">Photos:</span> <span className="tabular-nums">{s.images.length}</span></p>}
              <p><span className="font-semibold">Name to publish:</span> <span dir="auto" data-i18n-skip="">{s.contact.name}</span></p>
            </div>
          </details>

          {s.history?.length > 0 && (
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-sans text-[1.0625rem] font-semibold">History</h2>
              <ol className="mt-3 space-y-2 text-[0.9375rem]">
                {[...s.history].reverse().map((h, i) => (
                  <li key={i} className="flex flex-col gap-0.5 border-s-2 border-line ps-3 sm:flex-row sm:gap-3">
                    <time className="shrink-0 text-muted tabular-nums" dateTime={h.at}>{new Date(h.at).toLocaleString(localeOf(), { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    <span>{h.action.replace(/; fee £[\d.]+ requested$/, '')}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {canWithdraw && (
            <p className="text-[0.9375rem]">
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('Withdraw this submission? It will not be published.')) run(() => withdrawGuestWork(s), 'Your submission has been withdrawn.'); }}
                className="cursor-pointer font-semibold text-crimson underline underline-offset-4">Withdraw this submission</button>
            </p>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-xl border border-line bg-surface p-5 text-[0.9375rem]">
            <h2 className="font-sans text-[1.0625rem] font-semibold">Keep this page private</h2>
            <p className="mt-1 text-ink-soft">This page’s address is your private tracking link. Anyone who has it can see your submission, so do not share it.</p>
            <p className="mt-3 text-ink-soft">Questions? <a href="/contact" className="font-semibold underline">Contact us</a> and mention the title of your work{s.payment.reference ? <> <span>and the reference</span> <strong className="ltr-value" translate="no">{s.payment.reference}</strong></> : null}.</p>
          </section>
          <section className="rounded-xl border border-line bg-paper p-5 text-[0.9375rem] text-ink-soft">
            Contributors are independent authors. Publishing with us does not make you a member of the organisation.
          </section>
        </aside>
      </Container>
    </>
  );
};

/** Submissions sent from this browser (remembered only here). */
export const MySubmissionsInThisBrowser: React.FC<{ ids: string[] }> = ({ ids }) => {
  const [rows, setRows] = useState<(GuestSubmission | null)[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(ids.map((id) => getDoc(doc(db, 'guest_submissions', id)).then((d) => (d.exists() ? (d.data() as GuestSubmission) : null)).catch(() => null)))
      .then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, [ids.join('|')]);
  const found = (rows || []).filter(Boolean) as GuestSubmission[];
  if (!found.length) return null;
  return (
    <section aria-labelledby="browser-subs" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="browser-subs" className="text-[1.25rem] font-semibold">Sent from this browser</h2>
      <ul className="mt-3 divide-y divide-line">
        {found.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <a href={statusPath(s.id)} className="min-w-0 font-semibold text-navy underline-offset-4 hover:underline"><span dir="auto" data-i18n-skip="">{s.title}</span></a>
            <span className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${tone(s)}`}>{GUEST_STATUS_LABEL[s.status]}</span>
              <button type="button" onClick={() => { forgetSubmission(s.id); setRows((r) => (r || []).filter((x) => x?.id !== s.id)); }} className="cursor-pointer text-[0.8125rem] text-muted underline">Forget on this device</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
