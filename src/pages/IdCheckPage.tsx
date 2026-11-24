import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Container, Logo, ORG_NAME } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { Initials } from '../components/PersonCard';
import { cardDate } from '../lib/membership';
import { CardCheck, checkCard } from '../lib/memberApi';

type State = NonNullable<CardCheck['state']>;

const LOOK: Record<State, { box: string; icon: React.ReactNode; title: string; message: string }> = {
  valid: {
    box: 'border-navy bg-navy-tint',
    icon: <CheckCircle2 className="h-9 w-9 shrink-0 text-navy" aria-hidden="true" />,
    title: 'Valid membership',
    message: 'This person is a current member of 17 Shubat Organisation for Human Rights.',
  },
  expired: {
    box: 'border-amber bg-amber-tint',
    icon: <AlertTriangle className="h-9 w-9 shrink-0 text-[#9A6A12]" aria-hidden="true" />,
    title: 'Expired',
    message: 'This membership card has expired. The member may have renewed: ask to see their current card.',
  },
  suspended: {
    box: 'border-crimson bg-crimson/5',
    icon: <AlertTriangle className="h-9 w-9 shrink-0 text-crimson" aria-hidden="true" />,
    title: 'Suspended',
    message: 'This membership is currently suspended. The card is not valid.',
  },
  revoked: {
    box: 'border-crimson bg-crimson/5',
    icon: <XCircle className="h-9 w-9 shrink-0 text-crimson" aria-hidden="true" />,
    title: 'Revoked',
    message: 'This membership has ended. The card is no longer valid.',
  },
  replaced: {
    box: 'border-crimson bg-crimson/5',
    icon: <XCircle className="h-9 w-9 shrink-0 text-crimson" aria-hidden="true" />,
    title: 'Replaced card',
    message: 'A newer card has been issued to this member. This copy, and its QR code, are no longer valid.',
  },
};

/**
 * The page a membership card's QR code opens (/id/<code>). The code is a
 * random, unguessable token; the server looks up the live member record, so
 * the page always shows the current name, photo, position and status.
 */
export const IdCheckPage: React.FC<{ token: string; onNavigate: (tab: string, param?: string) => void }> = ({ token, onNavigate }) => {
  const [data, setData] = useState<CardCheck | null>(null);
  const [error, setError] = useState('');
  const load = () => {
    setError('');
    setData(null);
    checkCard(token).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Verification is not available right now.'));
  };
  useEffect(load, [token]);

  return (
    <Container narrow className="py-12 sm:py-16">
      <div className="mb-6 flex items-center gap-3">
        <Logo size={44} />
        <div>
          <p className="font-semibold">{ORG_NAME}</p>
          <p className="text-[0.875rem] text-muted">Official membership verification</p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-crimson/30 bg-crimson/5 p-6">
          <p className="text-crimson">{error}</p>
          <button type="button" onClick={load} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 font-semibold text-navy"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again</button>
        </div>
      ) : !data ? (
        <p className="py-16 text-center text-muted">Checking…</p>
      ) : !data.found || !data.state ? (
        <div className="rounded-3xl border-2 border-crimson bg-surface p-7">
          <div className="flex items-start gap-4">
            <XCircle className="h-9 w-9 shrink-0 text-crimson" aria-hidden="true" />
            <div>
              <h1 className="text-[1.75rem] font-semibold">Not recognised</h1>
              <p className="mt-2 text-ink-soft">This QR code does not belong to a membership card issued by {ORG_NAME}. It may have been copied wrongly, or the card may not be genuine.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-3xl border-2 bg-surface ${LOOK[data.state].box}`}>
          <div className="flex items-start gap-4 p-6">
            {LOOK[data.state].icon}
            <div>
              <h1 className="text-[1.75rem] font-semibold leading-tight">{LOOK[data.state].title}</h1>
              <p className="mt-1 text-ink-soft">{LOOK[data.state].message}</p>
            </div>
          </div>
          {data.name && (
            <div className="grid gap-5 border-t border-line bg-surface p-6 sm:grid-cols-[8rem_1fr]">
              {data.photoUrl
                ? <MediaImage src={data.photoUrl} alt={`Photograph of ${data.name}`} className="h-36 w-32 rounded-xl object-cover" />
                : <span className="overflow-hidden rounded-xl"><Initials name={data.name} size={128} /></span>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.9688rem]">
                <dt className="text-muted">Name</dt><dd className="font-semibold" dir="auto">{data.name}</dd>
                <dt className="text-muted">Membership number</dt><dd className="font-semibold tabular-nums" dir="ltr">{data.memberNumber}</dd>
                <dt className="text-muted">Position</dt><dd>{data.position}</dd>
                {data.unit && <><dt className="text-muted">Council or department</dt><dd>{data.unit}</dd></>}
                {data.memberSince && <><dt className="text-muted">Member since</dt><dd className="tabular-nums">{cardDate(data.memberSince)}</dd></>}
                {data.validFrom && <><dt className="text-muted">Valid from</dt><dd className="tabular-nums">{cardDate(data.validFrom)}</dd></>}
                {data.expiresAt && <><dt className="text-muted">Expires</dt><dd className="tabular-nums">{cardDate(data.expiresAt)}</dd></>}
              </dl>
            </div>
          )}
          {!data.name && data.memberNumber && <p className="border-t border-line bg-surface px-6 py-4 text-[0.9375rem]">Membership number <span className="tabular-nums" dir="ltr">{data.memberNumber}</span></p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4 text-[0.875rem] text-muted">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Checked against the official record {data.checkedAt ? `at ${new Date(data.checkedAt).toLocaleString('en-GB')}` : 'just now'}</span>
            {data.profileId && <button type="button" onClick={() => onNavigate('member-profile', data.profileId)} className="cursor-pointer font-semibold text-navy hover:underline">View public profile</button>}
          </div>
        </div>
      )}
      <p className="mt-6 text-[0.875rem] text-muted">Only scan cards with your phone’s camera and check that the address starts with https://17shubat.org.uk/id/. If anything looks wrong, contact us through the website.</p>
    </Container>
  );
};
