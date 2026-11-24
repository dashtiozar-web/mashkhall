import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, AlertTriangle, XCircle, Search } from 'lucide-react';
import { db } from '../firebase';
import { Button, Container, Logo, ORG_NAME } from '../components/ui';
import { cardDate, MEMBER_NUMBER_PATTERN, STATE_LABEL, verificationState } from '../lib/membership';
import { Verification, VerificationState } from '../types';

interface VerifyPageProps {
  memberNumber?: string;
  onNavigate: (tab: string, param?: string) => void;
}

const STATE_STYLE: Record<VerificationState, { box: string; icon: React.ReactNode; message: string }> = {
  active: {
    box: 'border-navy bg-navy-tint',
    icon: <CheckCircle2 className="h-10 w-10 text-navy" aria-hidden="true" />,
    message: 'This is a current member of 17 Shubat Organisation for Human Rights.',
  },
  expired: {
    box: 'border-amber bg-amber-tint',
    icon: <AlertTriangle className="h-10 w-10 text-[#9A6A12]" aria-hidden="true" />,
    message: 'This membership card has expired. The person may have renewed; ask to see a current card.',
  },
  suspended: {
    box: 'border-crimson/50 bg-crimson/5',
    icon: <AlertTriangle className="h-10 w-10 text-crimson" aria-hidden="true" />,
    message: 'This membership is currently suspended and the card is not valid.',
  },
  revoked: {
    box: 'border-crimson bg-crimson/5',
    icon: <XCircle className="h-10 w-10 text-crimson" aria-hidden="true" />,
    message: 'This card is no longer valid.',
  },
};

/** Public page opened by the QR code on a membership card. Shows only what a
 *  verifier needs: name, role, member number, status and validity dates. */
export const VerifyPage: React.FC<VerifyPageProps> = ({ memberNumber: raw, onNavigate }) => {
  const [input, setInput] = useState('');
  const [record, setRecord] = useState<Verification | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'found' | 'missing' | 'replaced' | 'error'>('idle');

  const [numberPart, query] = (raw || '').split('?');
  const memberNumber = decodeURIComponent(numberPart || '').trim().toUpperCase();
  const token = new URLSearchParams(query || '').get('r');

  useEffect(() => {
    if (!memberNumber) { setState('idle'); return; }
    if (!MEMBER_NUMBER_PATTERN.test(memberNumber)) { setState('missing'); return; }
    let cancelled = false;
    setState('loading');
    getDoc(doc(db, 'verifications', memberNumber))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) { setState('missing'); return; }
        const v = snap.data() as Verification;
        // A replaced QR code carries a different token from the current one.
        const currentToken = new URLSearchParams(v.verifyUrl.split('?')[1] || '').get('r');
        if ((currentToken || null) !== (token || null)) { setRecord(v); setState('replaced'); return; }
        setRecord(v);
        setState('found');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [memberNumber, token]);

  const lookUp = (e: React.FormEvent) => {
    e.preventDefault();
    const n = input.trim().toUpperCase();
    if (n) onNavigate('member-profile', n);
  };

  const vstate = record ? verificationState(record.status, record.expiresAt) : 'active';

  return (
    <section className="min-h-[70vh] bg-stone">
      <Container narrow className="py-12 sm:py-16">
        <div className="flex items-center gap-3">
          <Logo size={48} className="rounded-full" />
          <div>
            <p className="font-serif text-[1.25rem] font-semibold leading-tight">Membership verification</p>
            <p className="text-[0.9375rem] text-muted">{ORG_NAME}</p>
          </div>
        </div>

        <div className="mt-8" aria-live="polite">
          {state === 'loading' && <p className="rounded-2xl bg-surface p-8 text-center text-muted">Checking membership {memberNumber}…</p>}

          {state === 'found' && record && (
            <div className={`rounded-3xl border-2 bg-surface p-7 sm:p-9 ${STATE_STYLE[vstate].box}`}>
              <div className="flex items-start gap-4">
                {STATE_STYLE[vstate].icon}
                <div>
                  <p className="text-[0.9688rem] font-semibold text-ink-soft">Status</p>
                  <h1 className="text-[2rem] leading-tight font-semibold">{STATE_LABEL[vstate]}</h1>
                  <p className="mt-2 text-ink-soft">{STATE_STYLE[vstate].message}</p>
                </div>
              </div>
              <dl className="mt-7 grid gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-2">
                <div><dt className="text-[0.875rem] text-muted">Name</dt><dd className="font-serif text-[1.375rem] font-semibold">{record.name}</dd></div>
                <div><dt className="text-[0.875rem] text-muted">Role</dt><dd className="text-[1.125rem] font-semibold">{record.designation || 'Member'}</dd></div>
                <div><dt className="text-[0.875rem] text-muted">Member ID</dt><dd className="text-[1.125rem] font-semibold tabular-nums">{record.memberNumber}</dd></div>
                <div><dt className="text-[0.875rem] text-muted">Valid</dt><dd className="text-[1.125rem] tabular-nums">{cardDate(record.validFrom) || '—'} to {cardDate(record.expiresAt) || '—'}</dd></div>
              </dl>
              <p className="mt-6 text-[0.875rem] text-muted">Checked against our live records on {new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}.</p>
            </div>
          )}

          {state === 'replaced' && (
            <div className="rounded-3xl border-2 border-crimson bg-surface p-7">
              <div className="flex items-start gap-4">
                <XCircle className="h-10 w-10 text-crimson" aria-hidden="true" />
                <div>
                  <h1 className="text-[1.75rem] font-semibold">This QR code has been replaced</h1>
                  <p className="mt-2 text-ink-soft">A newer card has been issued for membership {memberNumber}. This copy is no longer valid.</p>
                </div>
              </div>
            </div>
          )}

          {state === 'missing' && (
            <div className="rounded-3xl border-2 border-crimson/40 bg-surface p-7">
              <h1 className="text-[1.75rem] font-semibold">No membership found</h1>
              <p className="mt-2 text-ink-soft">
                We couldn’t find a membership with the number <strong className="text-ink">{memberNumber || '(none)'}</strong>. Check the number and try
                again. If you were shown this card and believe it should be valid, please contact us.
              </p>
            </div>
          )}

          {state === 'error' && (
            <p className="rounded-2xl border border-crimson/30 bg-crimson/5 p-6 text-crimson">We couldn’t check this membership right now. Please try again in a moment.</p>
          )}
        </div>

        <form onSubmit={lookUp} className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <label htmlFor="verify-number" className="block font-semibold">Check a membership number</label>
          <p className="mt-1 text-[0.9375rem] text-muted">Member IDs look like M0097206 and are printed on the front of the card.</p>
          <div className="mt-3 flex gap-2">
            <input
              id="verify-number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="M0000000"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 uppercase tabular-nums focus:border-navy focus:outline-none"
              autoComplete="off"
            />
            <Button type="submit"><Search className="h-4 w-4" aria-hidden="true" /> Check</Button>
          </div>
        </form>

        <p className="mt-6 text-[0.875rem] text-muted">
          This page shows only what is needed to confirm a membership. Contact details and other personal information are
          never shown. Questions? <button type="button" onClick={() => onNavigate('contact')} className="cursor-pointer font-semibold text-navy underline underline-offset-4">Contact us</button>.
        </p>
      </Container>
    </section>
  );
};
