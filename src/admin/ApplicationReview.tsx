import React, { useState } from 'react';
import { X, ArrowLeft, Pencil } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { db, safeUpdateDoc } from '../firebase';
import { DEPARTMENTS, departmentFor, positionById, positionOf, positionsIn, positionTitle } from '../lib/positions';
import { appoint, byId, seatLabel, seatsOf, useAssignments } from '../lib/orgStructure';
import { useData } from '../context/DataContext';
import { defaultCardDates, issueCredential, statedMemberSince } from '../lib/membership';
import { formatDate } from '../components/ui';
import { CityChapter, MemberApplication } from '../types';
import { CredentialForm, credentialValid, defaultCredentialValues } from './CredentialForm';

const INVOLVEMENT_LABEL: Record<string, string> = {
  new: 'New member',
  lt6m: 'Less than six months',
  '6to12m': 'Six months to one year',
  '1to3y': 'One to three years',
  gt3y: 'More than three years',
  specific: 'Since a specific date',
};

const describeError = (e: unknown) => {
  const text = e instanceof Error ? e.message : String(e);
  if (/permission|insufficient/i.test(text)) {
    return 'The database refused this change. The latest database rules may not be deployed yet (see DEPLOYMENT.md), or your account may lack permission.';
  }
  if (/offline|network|unavailable/i.test(text)) return 'Could not reach the database. Check your connection and try again.';
  return text.length < 200 ? text : 'Something went wrong while saving. Please try again.';
};

/** Review one membership application: approve (and issue the card), ask for
 *  changes, or decline. Every decision notifies the applicant. */
export const ApplicationReview: React.FC<{
  app: MemberApplication;
  chapters: CityChapter[];
  onClose: () => void;
  onDone: () => void;
}> = ({ app: initialApp, chapters, onClose, onDone }) => {
  const { updateMembershipApplication, siteSettings, addAuditLog } = useData();
  const [app, setApp] = useState(initialApp);
  const [editing, setEditing] = useState(false);
  const [corrected, setCorrected] = useState(false);
  const [form, setForm] = useState({
    fullName: app.fullName, displayName: app.displayName, email: app.email, phone: app.phone || '',
    country: app.country || '', chapterId: app.chapterId, positionId: positionOf({ positionId: app.positionId }),
  });
  const [notes, setNotes] = useState(app.staffNotes || '');
  const [message, setMessage] = useState(app.applicantFeedback || '');
  const [approving, setApproving] = useState(false);
  const joined = statedMemberSince(app);
  const [cred, setCred] = useState(() => defaultCredentialValues({ positionId: 'member', joinedAt: joined, ...defaultCardDates(joined, app.createdAt) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignments = useAssignments();
  const [appointNow, setAppointNow] = useState(true);

  // The seat for the position applied for (in the applicant's own council).
  const wanted = positionById(positionOf({ positionId: app.positionId }));
  const seatsForWanted = !wanted || wanted.id === 'member' ? [] :
    seatsOf(wanted.department as Exclude<typeof wanted.department, 'membership'>, app.chapterId)
      .filter((x) => x.positionId === wanted.id);
  const taken = byId(assignments);
  const vacantSeat = seatsForWanted.find((x) => !taken.has(x.id));
  const heldBy = !vacantSeat && seatsForWanted.length ? seatsForWanted.map((x) => taken.get(x.id)?.memberName).filter(Boolean).join(', ') : '';

  const decide = async (status: MemberApplication['status']) => {
    setError(null);
    if ((status === 'changes_requested') && !message.trim()) {
      setError('Write a message to the applicant explaining what to change.');
      return;
    }
    if (status === 'approved' && !credentialValid(cred)) {
      setError('Please complete the card details. The expiry date must be after the valid-from date.');
      return;
    }
    setBusy(true);
    try {
      await updateMembershipApplication(app.id, { status }, notes, message);
      if (status === 'approved') {
        try {
          await issueCredential({
            memberId: app.userId,
            memberNumber: cred.memberNumber,
            positionId: cred.positionId,
            designation: cred.designation,
            joinedAt: cred.joinedAt,
            validFrom: cred.validFrom,
            expiresAt: cred.expiresAt,
            siteUrl: siteSettings.siteUrl,
            kind: 'issued',
          });
        } catch (e) {
          setError(`The membership was approved, but the card could not be issued: ${describeError(e)} You can issue it from Membership cards.`);
          setBusy(false);
          return;
        }
        if (appointNow && vacantSeat) {
          try {
            await appoint(vacantSeat, { id: app.userId, displayName: app.displayName || app.fullName, chapterId: app.chapterId }, assignments || [], (id) => chapters.find((c) => c.id === id)?.name || id);
          } catch (e) {
            setError(`The membership was approved and the card issued, but the appointment did not go through: ${describeError(e)} You can appoint them in Organisation structure.`);
            setBusy(false);
            return;
          }
        }
      }
      onDone();
    } catch (e) {
      console.error('Application decision error:', e);
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    setError(null);
    if (!form.fullName.trim() || !form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('A full name and a valid email address are required.');
      return;
    }
    const patch = {
      fullName: form.fullName.trim(),
      displayName: form.displayName.trim() || form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      chapterId: form.chapterId,
      positionId: form.positionId,
    };
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => (app[k] || '') !== patch[k]);
    if (changed.length === 0) { setEditing(false); return; }
    setBusy(true);
    try {
      await safeUpdateDoc(doc(db, 'applications', app.id), { ...patch, updatedAt: new Date().toISOString() });
      await addAuditLog('APPLICATION_DETAILS_CORRECTED', 'applications', app.id, `${app.fullName}: changed ${changed.join(', ')}`);
      const next = { ...app, ...patch };
      setApp(next);
      setCorrected(true);
      setEditing(false);
    } catch (e) {
      console.error('Application edit error:', e);
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const council = chapters.find((c) => c.id === app.chapterId)?.name || app.chapterId;
  const pid = positionOf({ positionId: app.positionId });
  const box = 'w-full rounded-lg border border-line bg-surface p-2.5 text-[0.9375rem] text-ink';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 id="review-title" className="text-[1.5rem] font-semibold">{app.fullName}</h2>
            <p className="text-[0.9375rem] text-muted">
              {app.displayName !== app.fullName && `Shown as ${app.displayName}. `}{app.email}{app.phone ? `, ${app.phone}` : ''}
            </p>
          </div>
          <button type="button" onClick={corrected ? onDone : onClose} className="cursor-pointer rounded-full p-1.5 text-muted hover:bg-stone" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {editing ? (
          <div className="mt-5 space-y-4">
            <h3 className="text-[1.25rem] font-semibold">Correct the application</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {([['fullName', 'Full name'], ['displayName', 'Name shown publicly'], ['email', 'Email'], ['phone', 'Phone'], ['country', 'Country']] as const).map(([k, l]) => (
                <label key={k} className="block text-[0.9375rem] font-semibold">
                  {l}
                  <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={`mt-1 ${box}`} type={k === 'email' ? 'email' : 'text'} />
                </label>
              ))}
              <label className="block text-[0.9375rem] font-semibold">
                Council
                <select value={form.chapterId} onChange={(e) => setForm({ ...form, chapterId: e.target.value })} className={`mt-1 ${box}`}>
                  {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-[0.9375rem] font-semibold sm:col-span-2">
                Position applied for
                <select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value as typeof form.positionId })} className={`mt-1 ${box}`}>
                  {DEPARTMENTS.map((d) => (
                    <optgroup key={d.id} label={d.name}>
                      {positionsIn(d.id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[0.875rem] text-muted">Corrections are recorded in the audit log.</p>
          </div>
        ) : !approving ? (
          <>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setEditing(true)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3.5 py-1.5 text-[0.9375rem] font-semibold hover:border-ink/40">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Correct details
              </button>
            </div>
            <dl className="mt-3 grid gap-4 text-[0.9375rem] sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-xl bg-navy-tint px-4 py-3">
                <dt className="text-muted">Position applied for</dt>
                <dd className="font-semibold">{positionTitle(pid)} <span className="font-normal text-ink-soft">· {departmentFor(pid)?.name}</span></dd>
              </div>
              <div><dt className="text-muted">Council</dt><dd className="font-semibold">{council}</dd></div>
              <div><dt className="text-muted">Country</dt><dd className="font-semibold">{app.country}</dd></div>
              <div>
                <dt className="text-muted">Member of 17 Shubat since</dt>
                <dd className="font-semibold">
                  {!app.involvement || app.involvement.period === 'new'
                    ? `New member (applied ${formatDate(app.createdAt)})`
                    : app.involvement.since
                      ? formatDate(app.involvement.since)
                      : `${INVOLVEMENT_LABEL[app.involvement.period] || 'Not answered'} (no exact date given)`}
                </dd>
                {app.involvement?.note && <dd className="mt-1 text-ink-soft">{app.involvement.note}</dd>}
              </div>
              <div className="sm:col-span-2"><dt className="text-muted">Why they want to join</dt><dd className="mt-1 whitespace-pre-line">{app.reason}</dd></div>
              {app.skills && <div className="sm:col-span-2"><dt className="text-muted">Skills</dt><dd className="mt-1">{app.skills}</dd></div>}
            </dl>
            <p className="mt-4 rounded-lg bg-stone px-3 py-2 text-[0.875rem] text-ink-soft">
              When you approve, the joining date and the card’s “valid from” date start as {app.involvement?.period === 'new' || !app.involvement?.since ? 'the day they applied' : 'the date they gave'} ({formatDate(joined)}), and the card expires one year after they applied. You can change these before confirming.
            </p>

            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <label className="block text-[0.9375rem] font-semibold">
                Private notes for the committee
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${box}`} placeholder="Only reviewers see this." />
              </label>
              <label className="block text-[0.9375rem] font-semibold">
                Message to the applicant
                <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={`mt-1 ${box}`} placeholder="Shown to the applicant if you ask for changes or decline." />
              </label>
            </div>
          </>
        ) : (
          <div className="mt-5">
            <button type="button" onClick={() => setApproving(false)} className="mb-4 inline-flex cursor-pointer items-center gap-1 text-[0.9375rem] font-semibold text-navy">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the application
            </button>
            <h3 className="text-[1.25rem] font-semibold">Membership card details</h3>
            <p className="mt-1 mb-4 text-[0.9375rem] text-ink-soft">These appear on {app.displayName || app.fullName}’s digital card and profile page.</p>
            {wanted && wanted.id !== 'member' && (
              <div className="mb-4 rounded-xl border border-line bg-stone p-4 text-[0.9375rem]">
                {vacantSeat ? (
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={appointNow} onChange={(e) => setAppointNow(e.target.checked)} className="mt-1 h-4 w-4" />
                    <span><strong>Also appoint as {seatLabel(vacantSeat, (id) => chapters.find((c) => c.id === id)?.name || id)}</strong><span className="block text-ink-soft">This position is vacant. The card and the organisation chart will show it.</span></span>
                  </label>
                ) : (
                  <p>They applied for <strong>{wanted.title}</strong>{heldBy ? `, which is held by ${heldBy}` : ''}. They will start as Member; you can appoint them in Organisation structure.</p>
                )}
              </div>
            )}
            <CredentialForm values={cred} onChange={setCred} mode="approve" />
          </div>
        )}

        {error && <p role="alert" className="mt-5 rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-[0.9375rem] text-crimson">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
          {editing ? (
            <>
              <button type="button" disabled={busy} onClick={() => setEditing(false)} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft hover:bg-stone">Cancel</button>
              <button type="button" disabled={busy} onClick={saveDetails} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">{busy ? 'Saving…' : 'Save corrections'}</button>
            </>
          ) : !approving ? (
            <>
              <button type="button" disabled={busy} onClick={() => decide('rejected')} className="cursor-pointer rounded-lg border border-line px-4 py-2 font-semibold text-ink-soft hover:border-crimson/50 hover:text-crimson disabled:opacity-50">
                Decline
              </button>
              <button type="button" disabled={busy} onClick={() => decide('changes_requested')} className="cursor-pointer rounded-lg border border-amber px-4 py-2 font-semibold hover:bg-amber-tint disabled:opacity-50">
                Ask for changes
              </button>
              <button type="button" disabled={busy} onClick={() => { setError(null); setApproving(true); }} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">
                Approve…
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => decide('approved')} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">
              {busy ? 'Saving…' : 'Approve and issue card'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
