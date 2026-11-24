import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, BadgeCheck, CheckCircle2, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { Button, Container, TextLink } from '../components/ui';
import { Initials } from '../components/PersonCard';
import { MediaImage } from '../components/MediaImage';
import { cardDate, isSecureQr, MEMBER_NUMBER_PATTERN, STATE_LABEL, verificationState } from '../lib/membership';
import { PublicProfile, Verification, VerificationState } from '../types';
import { departmentFor, positionOf } from '../lib/positions';
import { LevelProgressCard } from '../components/LevelBadge';
import { heldBy, seatLabel, useAssignments } from '../lib/orgStructure';

interface MemberProfilePageProps {
  /** A directory profile id, or a member number from the QR code on a card. */
  memberId: string;
  onNavigate: (tab: string, param?: string) => void;
}

const STATE_STYLE: Record<VerificationState, { box: string; icon: React.ReactNode; message: string }> = {
  active: {
    box: 'border-navy/40 bg-navy-tint',
    icon: <CheckCircle2 className="h-7 w-7 shrink-0 text-navy" aria-hidden="true" />,
    message: 'A current member of Mashkhally Zhyanawa Organisation.',
  },
  expired: {
    box: 'border-amber bg-amber-tint',
    icon: <AlertTriangle className="h-7 w-7 shrink-0 text-[#9A6A12]" aria-hidden="true" />,
    message: 'This membership card has expired. The member may have renewed; ask to see a current card.',
  },
  suspended: {
    box: 'border-crimson/50 bg-crimson/5',
    icon: <AlertTriangle className="h-7 w-7 shrink-0 text-crimson" aria-hidden="true" />,
    message: 'This membership is currently suspended and the card is not valid.',
  },
  revoked: {
    box: 'border-crimson bg-crimson/5',
    icon: <XCircle className="h-7 w-7 shrink-0 text-crimson" aria-hidden="true" />,
    message: 'This card is no longer valid.',
  },
};

type Load = 'loading' | 'ready' | 'missing' | 'replaced' | 'error';

/**
 * A member's public page. The QR code on each membership card opens this page
 * (/#/people/M0097206): it shows the member's directory profile, if they have
 * chosen to publish one, together with the live status of their card.
 */
export const MemberProfilePage: React.FC<MemberProfilePageProps> = ({ memberId: raw, onNavigate }) => {
  const { publicProfiles, chapters } = useData();
  const [idPart, queryPart] = (raw || '').split('?');
  const key = decodeURIComponent(idPart || '').trim();
  const asNumber = key.toUpperCase();
  const isNumber = MEMBER_NUMBER_PATTERN.test(asNumber);
  const token = new URLSearchParams(queryPart || '').get('r');

  const [verification, setVerification] = useState<Verification | null>(null);
  const [fetchedProfile, setFetchedProfile] = useState<PublicProfile | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const assignments = useAssignments();

  const listed = publicProfiles.find((p) =>
    isNumber ? p.memberNumber === asNumber || (verification?.profileId && p.id === verification.profileId) : p.id === key || p.userId === key,
  );
  const profile = listed || fetchedProfile;
  const memberNumber = isNumber ? asNumber : profile?.memberNumber && MEMBER_NUMBER_PATTERN.test(profile.memberNumber) ? profile.memberNumber : '';

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    setVerification(null);
    setFetchedProfile(null);
    (async () => {
      try {
        let v: Verification | null = null;
        if (memberNumber) {
          const snap = await getDoc(doc(db, 'verifications', memberNumber));
          if (snap.exists()) v = snap.data() as Verification;
        }
        if (v && isNumber) {
          // Cards now use a secure QR link (/id/…); a number link is then an old copy.
          if (isSecureQr(v.verifyUrl)) {
            if (!cancelled) { setVerification(v); setLoad('replaced'); }
            return;
          }
          // A replaced QR code carries a different token from the current one.
          const currentToken = new URLSearchParams(v.verifyUrl.split('?')[1] || '').get('r');
          if ((currentToken || null) !== (token || null)) {
            if (!cancelled) { setVerification(v); setLoad('replaced'); }
            return;
          }
        }
        // The directory list only holds listed members; fetch the profile directly if needed.
        const profileId = v?.profileId || (!isNumber ? key : '');
        if (profileId && !publicProfiles.some((p) => p.id === profileId)) {
          try {
            const ps = await getDoc(doc(db, 'public_profiles', profileId));
            if (ps.exists() && !cancelled) setFetchedProfile({ ...(ps.data() as PublicProfile), id: ps.id });
          } catch { /* not public */ }
        }
        if (cancelled) return;
        setVerification(v);
        setLoad(isNumber && !v ? 'missing' : 'ready');
      } catch {
        if (!cancelled) setLoad('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, memberNumber, token]);

  if (load === 'loading') {
    return <Container narrow className="py-24 text-center text-muted">Loading…</Container>;
  }

  if (load === 'error') {
    return (
      <Container narrow className="py-24">
        <p className="rounded-2xl border border-crimson/30 bg-crimson/5 p-6 text-crimson">We couldn’t load this page right now. Please try again in a moment.</p>
      </Container>
    );
  }

  if (load === 'replaced') {
    return (
      <Container narrow className="py-16">
        <div className="rounded-3xl border-2 border-crimson bg-surface p-7">
          <div className="flex items-start gap-4">
            <XCircle className="h-10 w-10 shrink-0 text-crimson" aria-hidden="true" />
            <div>
              <h1 className="text-[1.75rem] font-semibold">This QR code has been replaced</h1>
              <p className="mt-2 text-ink-soft">A newer card has been issued for membership {asNumber}. This copy is no longer valid.</p>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const revoked = verification && verificationState(verification.status, verification.expiresAt) === 'revoked';
  if (load === 'missing' || (!profile && !verification) || (revoked && !profile)) {
    return (
      <Container narrow className="py-24">
        <h1 className="text-[2.25rem] font-semibold">{isNumber && !verification ? 'No membership found' : 'This profile isn’t public'}</h1>
        <p className="mt-4 text-ink-soft">
          {isNumber && !verification
            ? `We couldn’t find a membership with the number ${asNumber}. If you were shown this card and believe it should be valid, please contact us.`
            : revoked
              ? 'This card is no longer valid.'
              : 'The member may have chosen not to be listed, or the link may be out of date.'}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => onNavigate('directory')}>See councils and people</Button>
          <Button variant="secondary" onClick={() => onNavigate('verify')}>Check a membership number</Button>
        </div>
      </Container>
    );
  }

  const name = profile?.displayName || verification?.name || '';
  const designation = verification?.designation || profile?.designation || profile?.boardTitle || '';
  const dept = departmentFor(verification?.positionId || profile?.positionId || positionOf({ designation }));
  const council = profile ? chapters.find((c) => c.id === profile.chapterId)?.name || profile.chapterName || profile.chapterId : '';
  const skills = (profile?.expertise || '').split(',').map((s) => s.trim()).filter(Boolean);
  const vstate = verification ? verificationState(verification.status, verification.expiresAt) : null;

  return (
    <Container narrow className="py-12 sm:py-16">
      <TextLink onClick={() => onNavigate('directory')} className="text-[0.9375rem]">Councils and people</TextLink>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
        {profile?.photoUrl ? (
          <MediaImage src={profile.photoUrl} alt="" className="h-32 w-32 rounded-2xl object-cover" />
        ) : (
          <span className="overflow-hidden rounded-2xl"><Initials name={name} size={128} /></span>
        )}
        <div className="min-w-0">
          <h1 className="text-[2.5rem] leading-tight font-semibold">{name}</h1>
          {designation && <p className="mt-1 text-[1.125rem] text-ink-soft">{designation}</p>}
          {dept && <p className="text-[0.9688rem] text-muted"><a href="/structure" className="hover:underline">{dept.name}</a></p>}
          {profile?.boardTitle && profile.boardTitle !== designation && <p className="text-[1.0625rem] text-ink-soft">{profile.boardTitle}</p>}
          {council && (
            <p className="mt-1 text-muted">
              <TextLink onClick={() => onNavigate('chapter', profile!.chapterId)} className="font-normal">{council} Council</TextLink>
            </p>
          )}
          {profile?.memberSince && <p className="mt-1 text-[0.9375rem] text-muted">Member since {new Date(profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>}
        </div>
      </div>

      {profile && heldBy(assignments, profile.id).length > 0 && (
        <section aria-labelledby="positions-heading" className="mt-8">
          <h2 id="positions-heading" className="font-sans text-[1rem] font-semibold">Positions in Mashkhally Zhyanawa</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {heldBy(assignments, profile.id).map((a) => (
              <li key={a.id}><a href="/structure" className="inline-block rounded-full border border-navy/40 bg-navy-tint px-3 py-1 text-[0.9375rem] font-semibold text-navy no-underline hover:underline">{seatLabel(a, (id) => chapters.find((c) => c.id === id)?.name || id)}</a></li>
            ))}
          </ul>
        </section>
      )}

      {profile && (
        <section aria-label="Activity level" className="mt-8">
          <LevelProgressCard points={profile.points?.all || 0} />
        </section>
      )}

      {verification && vstate && (
        <section aria-labelledby="membership-heading" className={`mt-10 rounded-2xl border-2 p-5 sm:p-6 ${STATE_STYLE[vstate].box}`}>
          <div className="flex items-start gap-3">
            {vstate === 'active' ? <BadgeCheck className="h-7 w-7 shrink-0 text-navy" aria-hidden="true" /> : STATE_STYLE[vstate].icon}
            <div className="min-w-0">
              <h2 id="membership-heading" className="font-sans text-[1.125rem] font-semibold">
                Membership: {STATE_LABEL[vstate]}
              </h2>
              <p className="mt-0.5 text-ink-soft">{STATE_STYLE[vstate].message}</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-3 border-t border-ink/10 pt-4 text-[0.9688rem] sm:grid-cols-3">
            <div><dt className="text-muted">Member ID</dt><dd className="font-semibold tabular-nums">{verification.memberNumber}</dd></div>
            <div><dt className="text-muted">Valid from</dt><dd className="tabular-nums">{cardDate(verification.validFrom) || '—'}</dd></div>
            <div><dt className="text-muted">Expires</dt><dd className="tabular-nums">{cardDate(verification.expiresAt) || '—'}</dd></div>
          </dl>
          <p className="mt-4 text-[0.8438rem] text-muted">Checked against our live records on {new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}.</p>
        </section>
      )}

      {profile?.bio && (
        <div className="prose-article mt-12 border-t border-line pt-10" data-i18n-skip="">
          {profile.bio.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}

      {skills.length > 0 && (
        <div className="mt-10">
          <h2 className="font-sans text-[1rem] font-semibold">Areas of expertise</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {skills.map((s) => <li key={s} className="rounded-full bg-stone px-3 py-1 text-[0.9375rem] text-ink-soft">{s}</li>)}
          </ul>
        </div>
      )}

      {!profile && (
        <p className="mt-10 rounded-2xl border border-line bg-surface p-5 text-ink-soft">
          This member hasn’t published a directory profile, so only their membership details are shown.
        </p>
      )}
    </Container>
  );
};
