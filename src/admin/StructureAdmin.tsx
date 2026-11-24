import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Search, UserPlus, UserMinus, X } from 'lucide-react';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { OrgStructureChart } from '../components/OrgStructureChart';
import { Initials } from '../components/PersonCard';
import { MediaImage } from '../components/MediaImage';
import { useNewsBanners } from '../lib/newsBanner';
import {
  appoint, Assignment, boardSeats, byId, councilSeats, heldBy, mainPosition, productionSeats, Seat, seatLabel, seatsOf, syncMemberTitle, useAssignments, vacate, webadminSeats,
} from '../lib/orgStructure';
import { positionById, positionOf, positionTitle } from '../lib/positions';
import { MemberApplication, PublicProfile } from '../types';

/**
 * Role management: appoint, replace and remove people in every seat of the
 * Board of Directors, the six councils and the Production Team. Changes show
 * immediately on the public chart, the member's profile and their card.
 */
export const StructureAdmin: React.FC = () => {
  const { chapters, publicProfiles } = useData();
  const assignments = useAssignments();
  const { banners } = useNewsBanners(false);
  const [picking, setPicking] = useState<{ seat: Seat; current?: Assignment } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wants, setWants] = useState<Map<string, string>>(new Map());
  const councilName = (id?: string) => chapters.find((c) => c.id === id)?.name || id || '';
  const rows = assignments || [];

  // Positions members said they hold or want, from their applications.
  useEffect(() => {
    getDocs(query(collection(db, 'applications'), where('status', '==', 'approved')))
      .then((snap) => setWants(new Map(snap.docs.map((d) => {
        const a = d.data() as MemberApplication;
        return [a.userId, positionOf({ positionId: a.positionId })] as [string, string];
      }))))
      .catch(() => undefined);
  }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setPicking(null);
    } catch (e) {
      console.error(e);
      const text = e instanceof Error ? e.message : '';
      setMsg({ ok: false, text: /permission|insufficient/i.test(text) ? 'The change was refused. Check that the latest database rules are published and that you are an administrator.' : text || 'That did not work. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  // Members whose title does not match their appointments (from before seats existed).
  const mismatched = useMemo(() => publicProfiles.filter((p) => {
    const title = positionOf(p);
    return title !== 'member' && title !== mainPosition(heldBy(rows, p.id));
  }), [publicProfiles, rows]);

  const vacantSeatFor = (p: PublicProfile) => {
    const pos = positionById(positionOf(p));
    if (!pos || pos.id === 'member') return undefined;
    const list = seatsOf(pos.department as Exclude<typeof pos.department, 'membership'>, p.chapterId);
    const taken = byId(rows);
    return list.find((s) => s.positionId === pos.id && !taken.has(s.id));
  };

  const perCouncil = chapters.map((c) => {
    const seats = councilSeats(c.id);
    const taken = byId(rows);
    return { c, members: publicProfiles.filter((p) => p.chapterId === c.id).length, filled: seats.filter((s) => taken.has(s.id)).length, seats: seats.length };
  });

  const action = (seat: Seat, a?: Assignment) => (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" disabled={busy} onClick={() => { setMsg(null); setPicking({ seat, current: a }); }}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[0.8125rem] font-semibold hover:border-navy disabled:opacity-50">
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {a ? 'Change' : 'Appoint'}
      </button>
      {a && (
        <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${a.memberName} as ${seatLabel(a, councilName)}? The position will show as Vacant.`)) run(() => vacate(a, councilName), `${a.memberName} removed. The position is now vacant.`); }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[0.8125rem] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">
          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" /> Remove
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[1.5rem] font-semibold">Organisation structure</h2>
        <p className="mt-1 max-w-[75ch] text-ink-soft">
          Appoint members to positions. Each position holds one person (each council has five Security Member places). Council positions can only go to members of that council.
          A person holds one position unless you choose to keep their others. Their main title on the card and profile is their most senior position. For promotions, transfers, position status and history, open the member’s profile in Members.
        </p>
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      <section aria-labelledby="council-totals" className="rounded-2xl border border-line bg-surface p-5">
        <h3 id="council-totals" className="text-[1.125rem] font-semibold">Members and positions by council</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-[0.9375rem]">
            <thead className="text-[0.8438rem] text-muted"><tr><th className="py-1.5 font-semibold">Council</th><th className="py-1.5 text-end font-semibold">Members</th><th className="py-1.5 text-end font-semibold">Positions filled</th></tr></thead>
            <tbody className="divide-y divide-line">
              {perCouncil.map(({ c, members, filled, seats }) => (
                <tr key={c.id}><td className="py-1.5 font-semibold">{c.name}</td><td className="py-1.5 text-end tabular-nums">{members}</td><td className="py-1.5 text-end tabular-nums">{filled} of {seats}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">All councils</td><td className="py-1.5 text-end tabular-nums">{publicProfiles.length}</td><td className="py-1.5 text-end tabular-nums">{perCouncil.reduce((n, x) => n + x.filled, 0)} of {perCouncil.reduce((n, x) => n + x.seats, 0)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {mismatched.length > 0 && (
        <section aria-labelledby="mismatch" className="rounded-2xl border border-amber bg-amber-tint p-5">
          <h3 id="mismatch" className="text-[1.125rem] font-semibold">Titles to confirm ({mismatched.length})</h3>
          <p className="mt-1 text-[0.9375rem] text-ink-soft">These members have a position title from before positions were appointed. Appoint them to the position, or set them to Member.</p>
          <ul className="mt-3 divide-y divide-ink/10">
            {mismatched.map((p) => {
              const seat = vacantSeatFor(p);
              return (
                <li key={p.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span><strong>{p.displayName}</strong> <span className="text-ink-soft">· {positionTitle(positionOf(p))} · {councilName(p.chapterId)}</span></span>
                  <span className="flex flex-wrap gap-2">
                    {seat && <button type="button" disabled={busy} onClick={() => run(() => appoint(seat, p, rows, councilName), `${p.displayName} appointed ${seatLabel(seat, councilName)}.`)} className="cursor-pointer rounded-lg bg-navy px-3 py-1 text-[0.875rem] font-semibold text-white disabled:opacity-50">Appoint as {seatLabel(seat, councilName)}</button>}
                    <button type="button" disabled={busy} onClick={() => run(() => syncMemberTitle(p.id), `${p.displayName}’s title now matches their positions.`)} className="cursor-pointer rounded-lg border border-ink/20 px-3 py-1 text-[0.875rem] font-semibold disabled:opacity-50">{heldBy(rows, p.id).length ? 'Use their appointed position' : 'Set to Member'}</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {assignments === null ? <p className="text-muted">Loading…</p> : (
        <div className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
          <OrgStructureChart assignments={rows} profiles={publicProfiles} councils={chapters} activities={banners} renderAction={action} admin />
        </div>
      )}

      {picking && (
        <Picker
          seat={picking.seat}
          current={picking.current}
          rows={rows}
          profiles={publicProfiles}
          wants={wants}
          councilName={councilName}
          busy={busy}
          onClose={() => setPicking(null)}
          onPick={(p, opts) => run(() => appoint(picking.seat, p, rows, councilName, opts), `${p.displayName} appointed ${seatLabel(picking.seat, councilName)}.${opts.keepOtherPositions ? '' : ' Any other positions they held are now vacant.'}`)}
        />
      )}
    </div>
  );
};

const Picker: React.FC<{
  seat: Seat;
  current?: Assignment;
  rows: Assignment[];
  profiles: PublicProfile[];
  wants: Map<string, string>;
  councilName: (id?: string) => string;
  busy: boolean;
  onClose: () => void;
  onPick: (p: PublicProfile, opts: { keepOtherPositions: boolean; reason: string }) => void;
}> = ({ seat, current, rows, profiles, wants, councilName, busy, onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [keep, setKeep] = useState(false);
  const [reason, setReason] = useState('');
  const eligible = profiles
    .filter((p) => seat.unit !== 'council' || p.chapterId === seat.councilId)
    .filter((p) => !q.trim() || p.displayName.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(wants.get(b.id) === seat.positionId) - Number(wants.get(a.id) === seat.positionId) || a.displayName.localeCompare(b.displayName));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pick-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-surface sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <h3 id="pick-title" className="text-[1.25rem] font-semibold">{seatLabel(seat, councilName)}</h3>
            <p className="text-[0.9375rem] text-muted">{current ? `Currently ${current.memberName}. Choose who should replace them.` : 'Vacant. Choose a member to appoint.'}{seat.unit === 'council' ? ` Only members of the ${councilName(seat.councilId)} Council are listed.` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 pb-2">
          <label className="relative block">
            <span className="sr-only">Search members</span>
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="w-full rounded-lg border border-line bg-paper py-2 pe-3 ps-9" />
          </label>
          <label className="mt-3 flex items-start gap-2 text-[0.875rem]">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="mt-0.5" />
            <span>Keep the person’s other positions as well. Leave unticked when they should hold only this position (their other positions become vacant).</span>
          </label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, kept in their position history)" className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[0.9375rem]" />
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto px-2 pb-3">
          {eligible.length === 0 && <li className="p-6 text-center text-muted">No members {seat.unit === 'council' ? 'in this council ' : ''}match.</li>}
          {eligible.map((p) => {
            const held = heldBy(rows, p.id);
            const isCurrent = current?.memberId === p.id;
            return (
              <li key={p.id}>
                <button type="button" disabled={busy || isCurrent} onClick={() => onPick(p, { keepOtherPositions: keep, reason })} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-stone disabled:cursor-default disabled:opacity-60">
                  {p.photoUrl ? <MediaImage src={p.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="shrink-0 overflow-hidden rounded-full"><Initials name={p.displayName} size={40} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.displayName}{isCurrent ? ' (current)' : ''}</span>
                    <span className="block truncate text-[0.8125rem] text-muted">
                      {councilName(p.chapterId)} · {held.length ? held.map((a) => seatLabel(a, councilName)).join('; ') : 'No position'}
                    </span>
                  </span>
                  {wants.get(p.id) === seat.positionId && <span className="shrink-0 rounded-full bg-navy-tint px-2 py-0.5 text-[0.75rem] font-semibold text-navy">Applied for this</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
