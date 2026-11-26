import { TIERS, tierById } from '../lib/tiers';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, Building2, Camera, GitBranch, History, IdCard, Pencil, Shuffle, ToggleLeft, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDate } from '../components/ui';
import { MediaImage } from '../components/MediaImage';
import { Initials } from '../components/PersonCard';
import { MemberRecord } from '../types';
import { cardDate, isSecureQr, verificationState, STATE_LABEL, addYears } from '../lib/membership';
import {
  appointToSeat, ChangeLogEntry, HISTORY_LABEL, memberHistory, permissionTemplates, PositionHistoryEntry, SEAT_STATUS_LABEL, SeatStatus,
  updateMember, updateSeat, vacateSeat,
} from '../lib/memberApi';
import { Assignment, byId, heldBy, mainPosition, Seat, seatLabel, seatsOf, useAssignments } from '../lib/orgStructure';
import { DEPARTMENTS, positionById, positionOf, positionTitle, UnitId } from '../lib/positions';

const field = 'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-[0.9688rem] font-normal text-ink focus:border-navy focus:outline-none';
const label = 'block text-[0.875rem] font-semibold text-ink';
const today = () => new Date().toISOString().slice(0, 10);

type Tab = 'details' | 'position' | 'history';
type PositionMode = 'change' | 'promote' | 'department' | 'transfer';

/** Resize a photo for the member record and card (about 40–80 KB). */
const photoFrom = (file: File) => new Promise<string>((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Please choose a JPG, PNG or WebP photo.')); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Your browser could not process that photo.')); return; }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.86, 0.76, 0.66, 0.56]) {
      const d = canvas.toDataURL('image/jpeg', q);
      if (d.length < 190_000) { resolve(d); return; }
    }
    reject(new Error('That photo could not be made small enough. Please try another.'));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a photo we can open.')); };
  img.src = url;
});

interface Props {
  member: MemberRecord;
  onClose: () => void;
  /** Called after every saved change, with the saved record, so lists refresh. */
  onSaved: (m?: MemberRecord) => void;
  onOpenCards?: () => void;
  canAppoint: boolean;
  isAdmin: boolean;
  /** Extra section for administrators (permanent deletion). */
  dangerZone?: React.ReactNode;
  initialTab?: Tab;
}

/**
 * A member's administrative profile: edit their details, change their
 * position (appoint, promote, transfer, another department), position status
 * and reporting line, and review their history. Every change is saved by the
 * website server, which updates the member's card, profile, the directory
 * and the organisation chart together.
 */
export const MemberAdminPanel: React.FC<Props> = ({ member: initial, onClose, onSaved, onOpenCards, canAppoint, isAdmin, dangerZone, initialTab = 'details' }) => {
  const { chapters, publicProfiles } = useData();
  const assignments = useAssignments();
  const [m, setM] = useState<MemberRecord>(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const councilName = (id?: string) => chapters.find((c) => c.id === id)?.name || id || '';
  const held = heldBy(assignments, m.id);
  const taken = byId(assignments);
  const nameOf = (memberId: string) => publicProfiles.find((p) => p.id === memberId)?.displayName || assignments?.find((a) => a.memberId === memberId)?.memberName || 'a member';

  useEffect(() => { setM(initial); }, [initial.id]);

  const run = async (fn: () => Promise<{ member?: MemberRecord } | unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await fn()) as { member?: MemberRecord } | undefined;
      if (r && typeof r === 'object' && 'member' in r && r.member) setM({ ...r.member, id: m.id });
      setMsg({ ok: true, text: ok });
      onSaved(r && typeof r === 'object' && 'member' in r ? r.member : undefined);
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'That could not be saved. Nothing was changed.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const state = m.verifyUrl && m.expiresAt ? verificationState(m.status, m.expiresAt) : null;
  const tabs: [Tab, string, React.ElementType][] = [['details', 'Edit member details', Pencil], ['position', 'Position', GitBranch], ['history', 'Position history', History]];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink/55" role="dialog" aria-modal="true" aria-labelledby="member-admin-title">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-s border-line bg-surface shadow-xl">
        <header className="flex items-start gap-4 border-b border-line p-5">
          {m.photoUrl ? <MediaImage src={m.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <Initials name={m.fullName} />}
          <div className="min-w-0 flex-1">
            <h2 id="member-admin-title" className="truncate text-[1.375rem] font-semibold">{m.fullName}</h2>
            <p className="text-[0.9375rem] text-ink-soft">{positionTitle(positionOf(m))}{m.chapterId ? ` · ${councilName(m.chapterId)} Council` : ''}{tierById(m.tier) ? ` · ${tierById(m.tier)!.ku}` : ''}</p>
            <p className="text-[0.8438rem] text-muted tabular-nums">
              {m.memberNumber || 'No card yet'}
              {state && ` · Card ${STATE_LABEL[state].toLowerCase()}, valid to ${cardDate(m.expiresAt)}`}
              {m.updatedAt && ` · Last changed ${formatDate(m.updatedAt)}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist" aria-label="Member administration">
          {tabs.map(([id, text, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMsg(null); }}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 text-[0.9375rem] font-semibold ${tab === id ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{text}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
          {tab === 'details' && <DetailsForm m={m} busy={busy} run={run} councilName={councilName} chapters={chapters} held={held} onOpenCards={onOpenCards} />}
          {tab === 'position' && (
            <PositionTab m={m} busy={busy} run={run} held={held} taken={taken} nameOf={nameOf} councilName={councilName} chapters={chapters} canAppoint={canAppoint} isAdmin={isAdmin} assignments={assignments || []} />
          )}
          {tab === 'history' && <HistoryTab memberId={m.id} refreshKey={m.updatedAt} isAdmin={isAdmin} />}
          {tab === 'details' && dangerZone && <div className="mt-8">{dangerZone}</div>}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- details

type Run = (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;

const DetailsForm: React.FC<{ m: MemberRecord; busy: boolean; run: Run; councilName: (id?: string) => string; chapters: { id: string; name: string }[]; held: Assignment[]; onOpenCards?: () => void }> = ({ m, busy, run, councilName, chapters, held, onOpenCards }) => {
  const initialForm = () => ({
    fullName: m.fullName || '', displayName: m.displayName || '', email: m.email || '', phone: m.phone || '', chapterId: m.chapterId || '',
    joinedAt: (m.joinedAt || '').slice(0, 10), validFrom: (m.validFrom || '').slice(0, 10), expiresAt: (m.expiresAt || '').slice(0, 10),
    photoUrl: m.photoUrl || '', bio: m.bio || '', expertise: m.expertise || '', reason: '',
    tier: m.tier || '', city: m.city || '',
  });
  const [f, setF] = useState(initialForm);
  const [photoError, setPhotoError] = useState('');
  useEffect(() => { setF(initialForm()); }, [m.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const hasCard = Boolean(m.verifyUrl && m.expiresAt);
  const councilChanged = f.chapterId !== (m.chapterId || '');
  const councilSeatsLost = held.filter((a) => a.unit === 'council' && a.councilId !== f.chapterId);

  const save = async () => {
    const changes: Record<string, string> = {};
    (['fullName', 'displayName', 'email', 'phone', 'chapterId', 'joinedAt', 'photoUrl', 'bio', 'expertise', 'tier', 'city'] as const).forEach((k) => {
      if ((f[k] || '') !== ((m[k] as string | undefined) || '').slice(0, k === 'joinedAt' ? 10 : undefined)) changes[k] = f[k];
    });
    if (hasCard) {
      if (f.validFrom !== (m.validFrom || '').slice(0, 10)) changes.validFrom = f.validFrom;
      if (f.expiresAt !== (m.expiresAt || '').slice(0, 10)) changes.expiresAt = f.expiresAt;
    }
    if (changes.tier === '') delete changes.tier;
    if (!Object.keys(changes).length) return;
    if (councilSeatsLost.length && !window.confirm(`Moving ${m.fullName} to the ${councilName(f.chapterId)} Council makes these positions vacant: ${councilSeatsLost.map((a) => seatLabel(a, councilName)).join(', ')}. Continue?`)) return;
    await run(() => updateMember(m.id, changes, { expectUpdatedAt: m.updatedAt, reason: f.reason }), `Saved. ${m.fullName}’s profile, membership card, the directory and the organisation chart now show the new details.`);
  };

  return (
    <div className="space-y-6">
      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="mb-2 text-[1rem] font-semibold">Photograph</legend>
        {f.photoUrl ? <MediaImage src={f.photoUrl} alt="Member photograph" className="h-24 w-24 rounded-xl object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-stone text-muted"><Camera className="h-7 w-7" aria-hidden="true" /></div>}
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[0.875rem] font-semibold hover:border-ink/40">
            <Camera className="h-4 w-4" aria-hidden="true" /> Choose a new photo
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setPhotoError('');
              try { set({ photoUrl: await photoFrom(file) }); } catch (err) { setPhotoError(err instanceof Error ? err.message : 'That photo could not be used.'); }
            }} />
          </label>
          {f.photoUrl && <button type="button" onClick={() => set({ photoUrl: '' })} className="block cursor-pointer text-[0.875rem] font-semibold text-crimson">Remove photo</button>}
          {photoError && <p role="alert" className="text-[0.875rem] text-crimson">{photoError}</p>}
          <p className="text-[0.8125rem] text-muted">Shown on the digital ID, the profile and the organisation chart.</p>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-[1rem] font-semibold">Personal and contact details</legend>
        <label className={label}>Full name (as on the card)<input value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} className={field} dir="auto" /></label>
        <label className={label}>Name shown publicly<input value={f.displayName} onChange={(e) => set({ displayName: e.target.value })} className={field} dir="auto" /></label>
        <label className={label}>Email<input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={field} dir="ltr" /></label>
        <label className={label}>Phone<input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={field} dir="ltr" /></label>
        <label className={`${label} sm:col-span-2`}>Council
          <select value={f.chapterId} onChange={(e) => set({ chapterId: e.target.value })} className={field}>
            {!f.chapterId && <option value="">Choose a council</option>}
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {councilChanged && <span className="mt-1 block text-[0.8125rem] font-normal text-ink-soft">This transfers them to the {councilName(f.chapterId)} Council.{councilSeatsLost.length ? ` Their positions in the ${councilName(m.chapterId)} Council become vacant.` : ''} Board, Production Team and Website Administration positions are kept.</span>}
        </label>
        <label className={label}>Kind of membership
          <select value={f.tier} onChange={(e) => set({ tier: e.target.value })} className={field}>
            {!f.tier && <option value="">Not chosen yet</option>}
            {TIERS.map((t) => <option key={t.id} value={t.id}>{t.ku} — {t.name}</option>)}
          </select>
          <span className="mt-1 block text-[0.8125rem] font-normal text-ink-soft">Only Pêşeng members take on positions and responsibilities.</span>
        </label>
        <label className={label}>City or town<input value={f.city} onChange={(e) => set({ city: e.target.value })} className={field} dir="auto" /></label>
        <label className={label}>Expertise<input value={f.expertise} onChange={(e) => set({ expertise: e.target.value })} className={field} dir="auto" /></label>
        <label className={`${label} sm:col-span-2`}>Biography<textarea value={f.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} className={field} dir="auto" /></label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-[1rem] font-semibold">Membership dates</legend>
        <label className={label}>Membership start<input type="date" value={f.joinedAt} onChange={(e) => set({ joinedAt: e.target.value })} className={field} /></label>
        {hasCard ? (
          <>
            <label className={label}>Card valid from<input type="date" value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value, expiresAt: f.expiresAt <= e.target.value ? addYears(e.target.value, 1) : f.expiresAt })} className={field} /></label>
            <label className={label}>Card expiry<input type="date" value={f.expiresAt} min={f.validFrom} onChange={(e) => set({ expiresAt: e.target.value })} className={field} /></label>
          </>
        ) : (
          <p className="text-[0.875rem] text-muted sm:col-span-2 sm:self-end">Card dates are set when the membership card is issued{onOpenCards ? <> in <button type="button" onClick={onOpenCards} className="cursor-pointer font-semibold text-navy underline">Membership cards</button></> : ''}.</p>
        )}
      </fieldset>

      {hasCard && (
        <p className="flex items-start gap-2 rounded-lg bg-stone px-3 py-2 text-[0.875rem] text-ink-soft">
          <IdCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>The digital ID updates as soon as you save; its number and QR code stay the same.{!isSecureQr(m.verifyUrl) && ' This card still uses the older QR link (based on the member number). Issue a replacement QR code in Membership cards to switch to a secure, unguessable link.'}</span>
        </p>
      )}

      <label className={label}>Reason for the change (optional, kept in the change log)
        <input value={f.reason} onChange={(e) => set({ reason: e.target.value })} className={field} placeholder="For example: corrected spelling at the member’s request" />
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <button type="button" disabled={busy} onClick={() => setF(initialForm())} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft hover:bg-stone">Undo my edits</button>
        <button type="button" disabled={busy || f.fullName.trim().length < 2} onClick={save} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- positions

const UNIT_ORDER: Exclude<UnitId, 'membership'>[] = ['board', 'council', 'production', 'webadmin'];

const PositionTab: React.FC<{
  m: MemberRecord; busy: boolean; run: Run; held: Assignment[]; taken: Map<string, Assignment>; nameOf: (id: string) => string;
  councilName: (id?: string) => string; chapters: { id: string; name: string }[]; canAppoint: boolean; isAdmin: boolean; assignments: Assignment[];
}> = ({ m, busy, run, held, taken, nameOf, councilName, chapters, canAppoint, isAdmin, assignments }) => {
  const [mode, setMode] = useState<PositionMode | null>(null);
  const [unit, setUnit] = useState<Exclude<UnitId, 'membership'>>('council');
  const [councilId, setCouncilId] = useState(m.chapterId || chapters[0]?.id || '');
  const [seatId, setSeatId] = useState('');
  const [keep, setKeep] = useState(false);
  const [effective, setEffective] = useState(today());
  const [reason, setReason] = useState('');
  const [applyPerms, setApplyPerms] = useState(false);
  const [templates, setTemplates] = useState<Record<string, string[]>>({});
  const [transferTo, setTransferTo] = useState('');
  const current = mainPosition(held);
  const currentNumber = positionById(current)?.number ?? 99;

  useEffect(() => {
    if (isAdmin) permissionTemplates().then((t) => setTemplates(t.templates)).catch(() => undefined);
  }, [isAdmin]);

  const seats: Seat[] = useMemo(() => {
    const list = seatsOf(unit, unit === 'council' ? councilId : undefined);
    return mode === 'promote' ? list.filter((s) => (positionById(s.positionId)?.number ?? 99) < currentNumber) : list;
  }, [unit, councilId, mode, currentNumber]);
  const seat = seats.find((s) => s.id === seatId);
  const holder = seat ? taken.get(seat.id) : undefined;
  const crossCouncil = seat?.unit === 'council' && seat.councilId !== m.chapterId;
  const perms = seat ? templates[seat.positionId] || [] : [];

  const open = (next: PositionMode) => {
    setMode(next);
    setSeatId('');
    setReason('');
    setApplyPerms(false);
    setKeep(false);
    if (next === 'department') setUnit(held[0]?.unit === 'production' ? 'board' : 'production');
    else setUnit(held[0]?.unit || 'council');
    setCouncilId(m.chapterId || chapters[0]?.id || '');
  };

  if (!canAppoint) {
    return <p className="rounded-xl bg-stone p-4 text-ink-soft">Only administrators (or staff with the “manage members” permission) can change positions.</p>;
  }

  const verb = seat ? ((positionById(seat.positionId)?.number ?? 99) < currentNumber && current !== 'member' ? 'Promote to' : 'Appoint as') : 'Appoint';
  const actions: [PositionMode, string, React.ElementType][] = [
    ['change', 'Change organisational position', Shuffle],
    ['promote', 'Promote member', ArrowUpCircle],
    ['transfer', 'Transfer to another council', Building2],
    ['department', 'Assign to a different department', GitBranch],
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[1.0625rem] font-semibold">Current positions</h3>
        {held.length === 0 ? (
          <p className="mt-2 rounded-lg bg-stone px-3 py-2 text-ink-soft">Member, with no position.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {held.map((a) => <HeldSeat key={a.id} a={a} busy={busy} run={run} councilName={councilName} assignments={assignments} nameOf={nameOf} hasTemplate={(templates[a.positionId] || []).length > 0} memberName={m.fullName} />)}
          </ul>
        )}
        <p className="mt-2 text-[0.8125rem] text-muted">The most senior position is the title on the member’s card and profile.</p>
      </section>

      <section>
        <h3 className="text-[1.0625rem] font-semibold">Make a change</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {actions.map(([id, text, Icon]) => (
            <button key={id} type="button" aria-pressed={mode === id} onClick={() => open(id)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-[0.9375rem] font-semibold ${mode === id ? 'border-navy bg-navy-tint text-navy' : 'border-line hover:border-ink/40'}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{text}
            </button>
          ))}
        </div>
      </section>

      {mode === 'transfer' && (
        <section className="space-y-4 rounded-xl border border-line p-4">
          <label className={label}>New council
            <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className={field}>
              <option value="">Choose a council</option>
              {chapters.filter((c) => c.id !== m.chapterId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <TransferNotes held={held} target={transferTo} councilName={councilName} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Effective date<input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className={field} /></label>
            <label className={label}>Reason (optional)<input value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label>
          </div>
          <div className="flex justify-end">
            <button type="button" disabled={busy || !transferTo} onClick={() => run(() => updateMember(m.id, { chapterId: transferTo }, { expectUpdatedAt: m.updatedAt, reason, effectiveDate: effective }), `${m.fullName} now belongs to the ${councilName(transferTo)} Council.`).then((ok) => ok && setMode(null))}
              className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50">Transfer to {transferTo ? `the ${councilName(transferTo)} Council` : 'council'}</button>
          </div>
        </section>
      )}

      {mode && mode !== 'transfer' && (
        <section className="space-y-4 rounded-xl border border-line p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Department
              <select value={unit} onChange={(e) => { setUnit(e.target.value as typeof unit); setSeatId(''); }} className={field}>
                {UNIT_ORDER.map((u) => <option key={u} value={u}>{DEPARTMENTS.find((d) => d.id === u)?.name}</option>)}
              </select>
            </label>
            {unit === 'council' && (
              <label className={label}>Council
                <select value={councilId} onChange={(e) => { setCouncilId(e.target.value); setSeatId(''); }} className={field}>
                  {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}{c.id === m.chapterId ? ' (their council)' : ''}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className={label}>{mode === 'promote' ? 'Promote to' : 'Position'}
            <select value={seatId} onChange={(e) => setSeatId(e.target.value)} className={field}>
              <option value="">{seats.length ? 'Choose a position' : 'No more senior position in this department'}</option>
              {seats.map((s) => {
                const h = taken.get(s.id);
                return <option key={s.id} value={s.id} disabled={h?.memberId === m.id}>{seatLabel(s, councilName)} — {h ? (h.memberId === m.id ? 'held by them' : `held by ${nameOf(h.memberId)}`) : 'vacant'}</option>;
              })}
            </select>
          </label>

          {seat && (
            <div className="space-y-3 text-[0.9375rem]">
              {holder && holder.memberId !== m.id && <p className="rounded-lg bg-amber-tint px-3 py-2">{nameOf(holder.memberId)} holds this position now and will be replaced. They will be told, and it is recorded in their history.</p>}
              {crossCouncil && <p className="rounded-lg bg-amber-tint px-3 py-2">This position belongs to the {councilName(seat.councilId)} Council, so {m.fullName} will also be transferred there. Their positions in the {councilName(m.chapterId)} Council become vacant.</p>}
              {held.filter((a) => a.id !== seat.id).length > 0 && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="mt-1" />
                  <span>Keep their other positions as well ({held.filter((a) => a.id !== seat.id).map((a) => seatLabel(a, councilName)).join(', ')}). Leave this unticked when the person should hold only one position.</span>
                </label>
              )}
              {seat.unit === 'webadmin' && (
                perms.length ? (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={applyPerms} onChange={(e) => setApplyPerms(e.target.checked)} className="mt-1" />
                    <span>Also grant the website permissions configured for this position: {perms.join(', ').replace(/_/g, ' ')}.</span>
                  </label>
                ) : <p className="text-[0.875rem] text-muted">This position gives no website permissions by itself. Permissions are configured in Users and roles.</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Effective date<input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className={field} /></label>
            <label className={label}>Reason (optional, kept in their history)<input value={reason} onChange={(e) => setReason(e.target.value)} className={field} placeholder="Activity, performance, experience…" /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode(null)} className="cursor-pointer rounded-lg px-4 py-2 font-semibold text-ink-soft hover:bg-stone">Cancel</button>
            <button type="button" disabled={busy || !seat}
              onClick={() => seat && run(() => appointToSeat({ seatId: seat.id, memberId: m.id, keepOtherPositions: keep, moveToCouncil: crossCouncil, effectiveDate: effective, reason, applyPermissions: applyPerms }), `${m.fullName}: ${verb.toLowerCase()} ${seatLabel(seat, councilName)}. Their card, profile and the organisation chart are updated.`).then((ok) => ok && setMode(null))}
              className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50">{seat ? `${verb} ${positionById(seat.positionId)?.title}` : 'Choose a position'}</button>
          </div>
        </section>
      )}
    </div>
  );
};

const TransferNotes: React.FC<{ held: Assignment[]; target: string; councilName: (id?: string) => string }> = ({ held, target, councilName }) => {
  const lost = held.filter((a) => a.unit === 'council' && a.councilId !== target);
  if (!target) return null;
  return <p className="rounded-lg bg-stone px-3 py-2 text-[0.875rem] text-ink-soft">{lost.length ? `These council positions become vacant: ${lost.map((a) => seatLabel(a, councilName)).join(', ')}.` : 'They hold no council position, so no position becomes vacant.'} Board, Production Team and Website Administration positions are kept.</p>;
};

const HeldSeat: React.FC<{ a: Assignment; busy: boolean; run: Run; councilName: (id?: string) => string; assignments: Assignment[]; nameOf: (id: string) => string; hasTemplate: boolean; memberName: string }> = ({ a, busy, run, councilName, assignments, nameOf, hasTemplate, memberName }) => {
  const [edit, setEdit] = useState<'status' | 'reports' | 'remove' | null>(null);
  const [status, setStatus] = useState<SeatStatus>(a.status || 'active');
  const [reportsTo, setReportsTo] = useState(a.reportsTo || '');
  const [reason, setReason] = useState('');
  const [removePerms, setRemovePerms] = useState(true);
  const standard = positionById(positionById(a.positionId)?.reportsTo);
  const reportOptions = assignments.filter((x) => x.id !== a.id).sort((x, y) => (positionById(x.positionId)?.number ?? 99) - (positionById(y.positionId)?.number ?? 99));
  const line = a.reportsTo ? assignments.find((x) => x.id === a.reportsTo) : null;

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{seatLabel(a, councilName)}</p>
          <p className="text-[0.8438rem] text-muted">
            {SEAT_STATUS_LABEL[a.status || 'active']}
            {a.effectiveDate ? ` · since ${formatDate(a.effectiveDate)}` : a.assignedAt ? ` · since ${formatDate(a.assignedAt)}` : ''}
            {' · reports to '}{line ? `${seatLabel(line, councilName)} (${nameOf(line.memberId)})` : standard ? `${standard.title} (standard)` : 'the Board (standard)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setEdit(edit === 'status' ? null : 'status')} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[0.8438rem] font-semibold"><ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" />Position status</button>
          <button type="button" onClick={() => setEdit(edit === 'reports' ? null : 'reports')} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[0.8438rem] font-semibold"><GitBranch className="h-3.5 w-3.5" aria-hidden="true" />Reporting line</button>
          <button type="button" onClick={() => setEdit(edit === 'remove' ? null : 'remove')} className="cursor-pointer rounded-lg px-2.5 py-1 text-[0.8438rem] font-semibold text-crimson hover:bg-crimson/5">Remove from position</button>
        </div>
      </div>
      {edit && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {edit === 'status' && (
            <label className={label}>Status
              <select value={status} onChange={(e) => setStatus(e.target.value as SeatStatus)} className={field}>
                {(Object.keys(SEAT_STATUS_LABEL) as SeatStatus[]).map((s) => <option key={s} value={s}>{SEAT_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          )}
          {edit === 'reports' && (
            <label className={label}>Reports to
              <select value={reportsTo} onChange={(e) => setReportsTo(e.target.value)} className={field}>
                <option value="">Standard line{standard ? ` (${standard.title})` : ''}</option>
                {reportOptions.map((x) => <option key={x.id} value={x.id}>{seatLabel(x, councilName)} — {nameOf(x.memberId)}</option>)}
              </select>
            </label>
          )}
          {edit === 'remove' && (
            <>
              <p className="text-[0.9375rem]">{memberName} stops holding this position; the position shows as Vacant. Their membership, card and past certificates are unchanged.</p>
              {a.unit === 'webadmin' && hasTemplate && (
                <label className="flex items-start gap-2 text-[0.9375rem]"><input type="checkbox" checked={removePerms} onChange={(e) => setRemovePerms(e.target.checked)} className="mt-1" /><span>Also remove the website permissions configured for this position</span></label>
              )}
            </>
          )}
          <label className={label}>Reason (optional, kept in their history)<input value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEdit(null)} className="cursor-pointer rounded-lg px-3 py-1.5 font-semibold text-ink-soft hover:bg-stone">Cancel</button>
            {edit === 'remove' ? (
              <button type="button" disabled={busy} onClick={() => run(() => vacateSeat(a.id, { reason, removePermissions: a.unit === 'webadmin' && hasTemplate && removePerms }), `${memberName} no longer holds ${seatLabel(a, councilName)}.`).then((ok) => ok && setEdit(null))} className="cursor-pointer rounded-lg bg-crimson px-4 py-1.5 font-semibold text-white disabled:opacity-50">Remove</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => run(() => updateSeat(a.id, edit === 'status' ? { status, reason } : { reportsTo, reason }), 'Saved and recorded in the position history.').then((ok) => ok && setEdit(null))} className="cursor-pointer rounded-lg bg-navy px-4 py-1.5 font-semibold text-white disabled:opacity-50">Save</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

// ---------------------------------------------------------------- history

const FIELD_LABEL: Record<string, string> = {
  fullName: 'Full name', displayName: 'Public name', email: 'Email', phone: 'Phone', chapterId: 'Council', joinedAt: 'Membership start',
  validFrom: 'Card valid from', expiresAt: 'Card expiry', photoUrl: 'Photo', bio: 'Biography', expertise: 'Expertise', positionId: 'Position',
  memberNumber: 'Membership number', status: 'Status', reportsTo: 'Reports to',
};

const HistoryTab: React.FC<{ memberId: string; refreshKey?: string; isAdmin: boolean }> = ({ memberId, refreshKey, isAdmin }) => {
  const [data, setData] = useState<{ positions: PositionHistoryEntry[]; log: ChangeLogEntry[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    memberHistory(memberId).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'History could not be loaded.'));
  }, [memberId, refreshKey]);
  if (error) return <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{error}</p>;
  if (!data) return <p className="py-8 text-center text-muted">Loading…</p>;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-[1.0625rem] font-semibold">Appointments, promotions and transfers</h3>
        {data.positions.length === 0 ? <p className="mt-2 text-ink-soft">No changes recorded yet. (Changes made before 29 October 2026 are in the audit log.)</p> : (
          <ol className="mt-3 space-y-3 border-s-2 border-line ps-4">
            {data.positions.map((h) => (
              <li key={h.id}>
                <p className="font-semibold">{HISTORY_LABEL[h.action] || h.action}: <span className="font-normal">{h.from} → {h.to}</span></p>
                <p className="text-[0.8438rem] text-muted">Effective {formatDate(h.effectiveDate)} · by {h.byName} · recorded {formatDate(h.at)}</p>
                {h.reason && <p className="text-[0.9375rem] text-ink-soft">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
      {isAdmin && (
        <section>
          <h3 className="text-[1.0625rem] font-semibold">Change log</h3>
          {data.log.length === 0 ? <p className="mt-2 text-ink-soft">Nothing recorded yet.</p> : (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {data.log.map((l) => (
                <li key={l.id} className="p-3">
                  <p className="text-[0.9375rem]"><span className="font-semibold">{l.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span> · {l.details}</p>
                  {l.changes && l.changes.length > 0 && (
                    <ul className="mt-1 text-[0.8438rem] text-ink-soft">{l.changes.map((c, i) => <li key={i}>{FIELD_LABEL[c.field] || c.field}: {c.from} → {c.to}</li>)}</ul>
                  )}
                  <p className="text-[0.8125rem] text-muted">{l.actorName || l.actorEmail} · {new Date(l.timestamp).toLocaleString('en-GB')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
