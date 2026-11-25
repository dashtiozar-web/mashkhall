import { departmentFor, positionOf, positionTitle, unitLine } from '../lib/positions';
import { useData } from '../context/DataContext';
import { LevelBadge } from './LevelBadge';
import React, { useState } from 'react';
import { Printer, Link2, Check, RotateCcw } from 'lucide-react';
import { MemberCardBack, MemberCardFront } from './MemberCard';
import { CardDownloads } from './CardDownloads';
import { Button, formatDate } from './ui';
import { STATE_LABEL, verificationState } from '../lib/membership';
import { MemberRecord } from '../types';

/** The member's digital card in their account: both sides, status, dates,
 *  verification link, and printing (which also saves as PDF). */
export const MembershipCardPanel: React.FC<{ member: MemberRecord | null; onNavigate: (tab: string) => void }> = ({ member, onNavigate }) => {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [copied, setCopied] = useState(false);
  const { publicProfiles, chapters } = useData();
  const councilName = (id?: string) => chapters.find((c) => c.id === id)?.name || id || '';
  const myPoints = member ? publicProfiles.find((p) => p.id === member.id)?.points?.all || 0 : 0;

  if (!member) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="font-serif text-[1.375rem] font-semibold">Your membership card appears here once you are a member</p>
        <p className="mx-auto mt-2 max-w-[48ch] text-ink-soft">After the membership committee approves your application, your digital card is issued here with a QR code anyone can scan to check it.</p>
        <Button className="mt-6" onClick={() => onNavigate('apply')}>Check your application</Button>
      </div>
    );
  }

  const issued = Boolean(member.verifyUrl && member.validFrom && member.expiresAt);
  const state = verificationState(member.status, member.expiresAt);
  const daysLeft = member.expiresAt ? Math.ceil((new Date(member.expiresAt).getTime() - Date.now()) / 86_400_000) : null;

  const copyLink = async () => {
    if (!member.verifyUrl) return;
    try {
      await navigator.clipboard.writeText(member.verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        {/* Screen view: side by side on wide screens, one side at a time on phones */}
        <div className="print:hidden">
          <div className="mb-4 flex gap-2 sm:hidden" role="tablist" aria-label="Card side">
            {(['front', 'back'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={side === s}
                onClick={() => setSide(s)}
                className={`cursor-pointer rounded-lg px-4 py-2 text-[0.9375rem] font-semibold ${side === s ? 'bg-navy text-white' : 'border border-line'}`}
              >
                {s === 'front' ? 'Front' : 'Back and QR code'}
              </button>
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className={`mx-auto w-full max-w-[340px] ${side === 'front' ? '' : 'hidden sm:block'}`}><MemberCardFront member={member} unit={unitLine(member, councilName)} /></div>
            <div className={`mx-auto w-full max-w-[340px] ${side === 'back' ? '' : 'hidden sm:block'}`}><MemberCardBack member={member} /></div>
          </div>
          {issued && <CardDownloads className="mt-5" member={member} unit={unitLine(member, councilName)} />}
        </div>

        {/* Print view: both sides at real card size (54 × 85.6 mm) */}
        <div id="member-card-print" className="hidden print:flex print:gap-[10mm]">
          <div style={{ width: '54mm' }}><MemberCardFront member={member} unit={unitLine(member, councilName)} /></div>
          <div style={{ width: '54mm' }}><MemberCardBack member={member} /></div>
        </div>
      </div>

      <aside className="space-y-5 print:hidden">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="text-[0.875rem] text-muted">Status</p>
          <p className={`mt-1 inline-flex rounded-full px-3 py-1 font-semibold ${state === 'active' ? 'bg-navy text-white' : state === 'expired' ? 'bg-amber-tint text-ink' : 'bg-crimson/10 text-crimson'}`}>
            {issued ? STATE_LABEL[state] : 'Not issued yet'}
          </p>
          {state === 'active' && daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && (
            <p className="mt-3 rounded-lg bg-amber-tint px-3 py-2 text-[0.9375rem]">Your card expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}. Contact us to renew.</p>
          )}
          <dl className="mt-5 space-y-3 text-[0.9688rem]">
            <div className="flex justify-between gap-4"><dt className="text-muted">Member ID</dt><dd className="font-semibold tabular-nums">{member.memberNumber}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Position</dt><dd className="text-end font-semibold">{positionTitle(positionOf(member))}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Department</dt><dd className="text-end">{departmentFor(positionOf(member))?.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Activity level</dt><dd className="text-end"><LevelBadge points={myPoints} /> <span className="tabular-nums">{myPoints} points</span></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Member since</dt><dd className="font-semibold">{formatDate(member.joinedAt) || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Card valid from</dt><dd className="font-semibold">{formatDate(member.validFrom) || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Card expires</dt><dd className="font-semibold">{formatDate(member.expiresAt) || '—'}</dd></div>
          </dl>
        </div>

        {issued ? (
          <div className="space-y-3">
            <Button className="w-full" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" /> Print or save as PDF</Button>
            <Button variant="secondary" className="w-full" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Link copied' : 'Copy verification link'}
            </Button>
            <p className="text-[0.875rem] text-muted">
              Anyone can scan the QR code on the back to check that your membership is valid. They see your name, role,
              member ID and dates, never your contact details.
            </p>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-stone p-4 text-[0.9375rem] text-ink-soft">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Your card is being prepared by the membership committee. You will get a notification when it is issued.
          </p>
        )}
      </aside>
    </div>
  );
};
