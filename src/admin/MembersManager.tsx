import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { LayoutList, Network, Pencil, RefreshCw, Search } from 'lucide-react';
// Network: link to the Organisation structure tab.
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { formatDate } from '../components/ui';
import { cardDate, setMembershipStatus, verificationState } from '../lib/membership';
import { resyncMembers } from '../lib/memberApi';
import { MemberAdminPanel } from './MemberAdminPanel';
import {
  DEPARTMENTS, DepartmentId, departmentFor, PositionId, positionById, positionOf, positionsIn, positionTitle,
} from '../lib/positions';
import { MemberApplication, MemberRecord } from '../types';
import { ApplicationReview } from './ApplicationReview';
import { useAuth } from '../context/AuthContext';
import { DeleteProgress, permanentlyDeleteMember } from '../lib/deleteMember';

type View = 'members' | 'applicants';
type MemberStatusFilter = 'all' | 'active' | 'expired' | 'suspended' | 'revoked';
type AppStatusFilter = 'waiting' | 'changes_requested' | 'rejected' | 'all';

const APP_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-stone text-ink-soft' },
  submitted: { label: 'Waiting for review', cls: 'bg-amber-tint text-ink' },
  under_review: { label: 'In review', cls: 'bg-amber-tint text-ink' },
  changes_requested: { label: 'Changes requested', cls: 'bg-stone text-ink-soft' },
  approved: { label: 'Approved', cls: 'bg-navy-tint text-navy' },
  rejected: { label: 'Declined', cls: 'bg-crimson/10 text-crimson' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-stone text-muted' },
};

const MEMBER_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-navy-tint text-navy' },
  expired: { label: 'Card expired', cls: 'bg-amber-tint text-ink' },
  suspended: { label: 'Suspended', cls: 'bg-crimson/10 text-crimson' },
  revoked: { label: 'Revoked', cls: 'bg-crimson/10 text-crimson' },
};

const memberState = (m: MemberRecord) =>
  m.status === 'revoked' || m.status === 'archived' ? 'revoked' : m.status === 'suspended' ? 'suspended' : m.expiresAt ? verificationState(m.status, m.expiresAt) : 'active';

/**
 * Applicants and members in one place: search and filter by name, position,
 * department and status; correct details; change positions; approve, decline,
 * suspend, reactivate or revoke; and see everyone on the organisation chart.
 */
export const MembersManager: React.FC<{ onGo: (tab: string) => void; onChanged?: () => void; initialView?: View }> = ({ onGo, onChanged, initialView = 'members' }) => {
  const { chapters, publicProfiles } = useData();
  const listedIds = useMemo(() => new Set(publicProfiles.map((p) => p.id)), [publicProfiles]);
  const onOpenStructure = () => onGo('structure');
  const isListed = (m: MemberRecord) => listedIds.has(m.id);
  const [view, setView] = useState<View>(initialView);
  useEffect(() => { setView(initialView); }, [initialView]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [apps, setApps] = useState<MemberApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<'all' | DepartmentId>('all');
  const [pos, setPos] = useState<'all' | PositionId>('all');
  const [council, setCouncil] = useState('all');
  const [mStatus, setMStatus] = useState<MemberStatusFilter>('all');
  const [aStatus, setAStatus] = useState<AppStatusFilter>('waiting');
  const [reviewing, setReviewing] = useState<MemberApplication | null>(null);
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const { isAdmin, hasPermission } = useAuth();
  const canAppoint = isAdmin || hasPermission('manage_members');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState<DeleteProgress | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Organisation policy: every approved member is shown publicly. Members
  // approved before this rule, or added by import, are added by the server.
  const syncAllPublic = async (list: MemberRecord[]) => {
    const missing = list.filter((m) => (m.status === 'active' || m.status === 'suspended') && !listedIds.has(m.id));
    if (!missing.length || !publicProfiles.length) return;
    try {
      const { done } = await resyncMembers(missing.slice(0, 50).map((m) => m.id));
      if (done.length) setMessage({ kind: 'ok', text: `${done.length} ${done.length === 1 ? 'member was' : 'members were'} added to the public Structure, Councils and People pages.` });
    } catch (e) {
      console.warn('Public listing not added:', e);
    }
  };

  /** Rebuild every member's directory profile, chart name and card record from their member record. */
  const repairAll = async () => {
    if (!window.confirm(`Re-synchronise all ${members.length} member records? Each member’s directory profile, organisation chart name and card verification record are rebuilt from their member record. Nothing else changes.`)) return;
    setBusy(true);
    setMessage(null);
    let done = 0;
    const failed: string[] = [];
    try {
      for (let i = 0; i < members.length; i += 25) {
        const r = await resyncMembers(members.slice(i, i + 25).map((m) => m.id));
        done += r.done.length;
        failed.push(...r.failed.map((f) => `${members.find((m) => m.id === f.id)?.fullName || f.id}: ${f.error}`));
      }
      setMessage(failed.length ? { kind: 'error', text: `${done} records repaired; ${failed.length} could not be: ${failed.slice(0, 5).join('; ')}` } : { kind: 'ok', text: `All ${done} member records are in step.` });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'The repair could not run.' });
    } finally {
      setBusy(false);
      await load();
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [ms, as] = await Promise.all([getDocs(collection(db, 'members')), getDocs(collection(db, 'applications'))]);
      const list = ms.docs.map((d) => ({ ...(d.data() as MemberRecord), id: d.id })).sort((a, b) => a.fullName.localeCompare(b.fullName));
      setMembers(list);
      syncAllPublic(list);
      setApps(as.docs.map((d) => ({ ...(d.data() as MemberApplication), id: d.id })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (e) {
      console.warn('Members load error:', e);
      setMessage({ kind: 'error', text: 'Members and applications could not be loaded. Check that the latest database rules are published and that you have permission.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const councilName = (id?: string) => chapters.find((c) => c.id === id)?.name || id || '';
  const q = search.trim().toLowerCase();
  const matchesPosition = (positionId: string) => {
    if (pos !== 'all') return positionId === pos;
    if (dept !== 'all') return positionById(positionId)?.department === dept;
    return true;
  };

  const waitingApps = apps.filter((a) => a.status === 'submitted' || a.status === 'under_review');
  const visibleApps = apps.filter((a) => {
    if (aStatus === 'waiting' && !(a.status === 'submitted' || a.status === 'under_review')) return false;
    if (aStatus === 'changes_requested' && a.status !== 'changes_requested') return false;
    if (aStatus === 'rejected' && a.status !== 'rejected') return false;
    if (aStatus === 'all' && a.status === 'approved') return false;
    if (!matchesPosition(positionOf({ positionId: a.positionId }))) return false;
    if (council !== 'all' && a.chapterId !== council) return false;
    if (!q) return true;
    return [a.fullName, a.displayName, a.email, a.phone, positionTitle(positionOf({ positionId: a.positionId }))].some((v) => (v || '').toLowerCase().includes(q));
  });

  const visibleMembers = members.filter((m) => {
    const st = memberState(m);
    if (mStatus !== 'all' && st !== mStatus) return false;
    if (!matchesPosition(positionOf(m))) return false;
    if (council !== 'all' && m.chapterId !== council) return false;
    if (!q) return true;
    return [m.fullName, m.displayName, m.email, m.phone, m.memberNumber, positionTitle(positionOf(m))].some((v) => (v || '').toLowerCase().includes(q));
  });

  const memberCounts = useMemo(() => {
    const c: Record<string, number> = { all: members.length, active: 0, expired: 0, suspended: 0, revoked: 0 };
    members.forEach((m) => { c[memberState(m)] += 1; });
    return c;
  }, [members]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      console.error(e);
      const text = e instanceof Error ? e.message : String(e);
      setMessage({ kind: 'error', text: /permission/i.test(text) ? 'The database refused this change. Check that the latest rules are published and that your account may manage members.' : text });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (m: MemberRecord) => {
    setMessage(null);
    setConfirmName('');
    setEditing(m);
  };

  const deletePermanently = async (m: MemberRecord) => {
    if (!window.confirm(`Last check: permanently delete ${m.fullName} and all their data? This cannot be undone.`)) return;
    setMessage(null);
    setDeleting({ step: 'Starting', done: 0, total: 12 });
    try {
      const { problems } = await permanentlyDeleteMember(m, setDeleting);
      setEditing(null);
      setConfirmName('');
      setMessage(problems.length
        ? { kind: 'error', text: `${m.fullName} was deleted, but some items could not be removed: ${problems.join(', ')}. Check that the latest database rules are published, then try again from the Firebase console if needed.` }
        : { kind: 'ok', text: `${m.fullName} and all their data were permanently deleted.` });
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      const text = e instanceof Error ? e.message : '';
      setMessage({ kind: 'error', text: /permission/i.test(text) ? 'The database refused the deletion. Only administrators can delete members, and the latest rules must be published.' : text || 'The member could not be deleted.' });
    } finally {
      setDeleting(null);
    }
  };

  const changeStatus = async (m: MemberRecord, status: 'active' | 'suspended' | 'revoked') => {
    const reason = status === 'active' ? '' : window.prompt(`Why are you ${status === 'suspended' ? 'suspending' : 'revoking'} ${m.fullName}'s membership? (shown to them)`) ?? null;
    if (reason === null) return;
    if (status === 'revoked' && !window.confirm(`Revoke ${m.fullName}'s membership? Their card will show as revoked and they will be removed from the directory.`)) return;
    const verb = { active: 'reactivated', suspended: 'suspended', revoked: 'revoked' }[status];
    await run(() => setMembershipStatus(m, status, reason), `Membership ${verb} for ${m.fullName}.`);
  };

  const filterBar = (
    <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="relative sm:col-span-2 lg:col-span-1">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone or ID" className="w-full rounded-lg border border-line bg-paper py-2 pe-3 ps-9 text-[0.9375rem] focus:border-navy focus:outline-none" />
      </label>
      <label className="text-[0.8125rem] font-semibold text-muted">
        <span className="sr-only">Department</span>
        <select value={dept} onChange={(e) => { setDept(e.target.value as typeof dept); setPos('all'); }} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[0.9375rem] font-normal text-ink">
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.number}. {d.name}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Position</span>
        <select value={pos} onChange={(e) => setPos(e.target.value as typeof pos)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink">
          <option value="all">All positions</option>
          {(dept === 'all' ? DEPARTMENTS : DEPARTMENTS.filter((d) => d.id === dept)).map((d) => (
            <optgroup key={d.id} label={d.name}>
              {positionsIn(d.id).map((p) => <option key={p.id} value={p.id}>{p.number}. {p.title}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Council</span>
        <select value={council} onChange={(e) => setCouncil(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink">
          <option value="all">All councils</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
    </div>
  );

  const chip = (active: boolean) => `cursor-pointer rounded-full border px-3.5 py-1.5 text-[0.875rem] ${active ? 'border-navy bg-navy text-white' : 'border-line hover:border-ink/40'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[1.5rem] font-semibold">Members and applicants</h2>
          <p className="mt-1 max-w-[70ch] text-ink-soft">
            Applicants are not members until approved. Open a member’s profile to edit their details, change or promote their position, transfer them to another council, and see their history. Every saved change updates their digital ID, profile, the directory and the organisation chart together, and is recorded with who made it.
          </p>
          {isAdmin && members.length > 0 && (
            <button type="button" disabled={busy} onClick={repairAll} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[0.875rem] font-semibold text-navy hover:underline disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Check that every member’s ID, profile and chart entry match their record
            </button>
          )}
        </div>
        <div role="tablist" aria-label="View" className="flex shrink-0 gap-1 rounded-full border border-line bg-surface p-1">
          {([['members', `Approved members (${members.length})`, LayoutList], ['applicants', `Applicants (${waitingApps.length} waiting)`, LayoutList]] as const).map(([v, l, Icon]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[0.875rem] font-semibold ${view === v ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{l}
            </button>
          ))}
          {onOpenStructure && (
            <button type="button" onClick={onOpenStructure} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[0.875rem] font-semibold text-ink-soft hover:bg-stone">
              <Network className="h-4 w-4" aria-hidden="true" /> Organisation structure
            </button>
          )}
        </div>
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${message.kind === 'ok' ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{message.text}</p>
      )}

      {filterBar}

      {loading ? (
        <p className="py-10 text-center text-muted">Loading…</p>
      ) : view === 'applicants' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {([['waiting', `Waiting for review (${waitingApps.length})`], ['changes_requested', 'Changes requested'], ['rejected', 'Declined'], ['all', 'All not yet approved']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={aStatus === v} onClick={() => setAStatus(v)} className={chip(aStatus === v)}>{l}</button>
            ))}
          </div>
          {visibleApps.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line py-10 text-center text-muted">No applicants match.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[760px] text-start text-[0.9375rem]">
                <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
                  <tr><th className="px-4 py-3 font-semibold">Applicant</th><th className="px-4 py-3 font-semibold">Position applied for</th><th className="px-4 py-3 font-semibold">Council</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-end font-semibold">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visibleApps.map((a) => {
                    const pid = positionOf({ positionId: a.positionId });
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-3"><p className="font-semibold">{a.fullName}</p><p className="text-[0.8438rem] text-muted">{a.email} · applied {formatDate(a.createdAt)}</p></td>
                        <td className="px-4 py-3"><p>{positionTitle(pid)}</p><p className="text-[0.8438rem] text-muted">{departmentFor(pid)?.name}{!a.positionId && ' (not chosen)'}</p></td>
                        <td className="px-4 py-3">{councilName(a.chapterId)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap ${APP_STATUS[a.status]?.cls}`}>{APP_STATUS[a.status]?.label || a.status}</span></td>
                        <td className="px-4 py-3 text-end">
                          <button type="button" onClick={() => setReviewing(a)} className="cursor-pointer rounded-lg bg-navy px-3.5 py-1.5 text-[0.875rem] font-semibold text-white hover:bg-navy-deep">Review</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'expired', 'suspended', 'revoked'] as MemberStatusFilter[]).map((v) => (
              <button key={v} type="button" aria-pressed={mStatus === v} onClick={() => setMStatus(v)} className={chip(mStatus === v)}>
                {v === 'all' ? 'All' : MEMBER_STATUS[v].label} <span className="tabular-nums opacity-80">{memberCounts[v]}</span>
              </button>
            ))}
          </div>
          {visibleMembers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line py-10 text-center text-muted">No members match.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[900px] text-start text-[0.9375rem]">
                <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
                  <tr><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Position and department</th><th className="px-4 py-3 font-semibold">Member ID</th><th className="px-4 py-3 font-semibold">Membership</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-end font-semibold">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visibleMembers.map((m) => {
                    const pid = positionOf(m);
                    const st = memberState(m);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3"><p className="font-semibold">{m.fullName}</p><p className="text-[0.8438rem] text-muted">{[councilName(m.chapterId), m.email].filter(Boolean).join(' · ')}</p></td>
                        <td className="px-4 py-3"><p className={positionById(pid)?.head ? 'font-semibold' : ''}>{positionTitle(pid)}</p><p className="text-[0.8438rem] text-muted">{departmentFor(pid)?.name}</p></td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{m.memberNumber || <span className="text-muted">No card yet</span>}</td>
                        <td className="px-4 py-3 text-[0.875rem] tabular-nums">
                          {m.joinedAt && <p>Joined {cardDate(m.joinedAt)}</p>}
                          {m.expiresAt && <p className="text-muted">Valid {cardDate(m.validFrom)} to {cardDate(m.expiresAt)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap ${MEMBER_STATUS[st].cls}`}>{MEMBER_STATUS[st].label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button type="button" disabled={busy} onClick={() => openEdit(m)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:border-ink/40"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Open profile</button>
                            {!m.verifyUrl && m.status === 'active' && (
                              <button type="button" onClick={() => onGo('cards')} className="cursor-pointer rounded-lg bg-navy px-3 py-1.5 text-[0.8438rem] font-semibold text-white">Issue card</button>
                            )}
                            {m.status === 'suspended' || m.status === 'revoked' ? (
                              <button type="button" disabled={busy} onClick={() => changeStatus(m, 'active')} className="cursor-pointer rounded-lg border border-navy px-3 py-1.5 text-[0.8438rem] font-semibold text-navy">Reactivate</button>
                            ) : (
                              <button type="button" disabled={busy} onClick={() => changeStatus(m, 'suspended')} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:text-crimson">Suspend</button>
                            )}
                            {m.status !== 'revoked' && (
                              <button type="button" disabled={busy} onClick={() => changeStatus(m, 'revoked')} className="cursor-pointer rounded-lg px-3 py-1.5 text-[0.8438rem] font-semibold text-crimson hover:bg-crimson/5">Revoke</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {reviewing && (
        <ApplicationReview
          app={reviewing}
          chapters={chapters}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); load(); onChanged?.(); }}
        />
      )}

      {editing && (
        <MemberAdminPanel
          member={editing}
          onClose={() => { setEditing(null); load(); }}
          onSaved={() => { onChanged?.(); }}
          onOpenCards={() => onGo('cards')}
          canAppoint={canAppoint}
          isAdmin={isAdmin}
          dangerZone={(
            <>
                  {isAdmin && (
                    <details className="rounded-xl border border-crimson/30 bg-crimson/5 p-4">
                      <summary className="cursor-pointer font-semibold text-crimson">Delete this member permanently</summary>
                      <div className="mt-3 space-y-3 text-[0.9375rem]">
                        <p className="text-ink">
                          This <strong>cannot be undone</strong>. It permanently removes {editing.fullName}’s member record, application, profile and photo,
                          uploaded images, membership card and QR verification, points and level, articles they wrote, their reactions and comments,
                          activity answers and attendance, and notifications. Their sign-in account is removed the next time it is used.
                        </p>
                        <p className="text-ink-soft">Only a note that a member ({editing.memberNumber || 'without a card'}) was deleted is kept in the audit log, without their name or contact details. To stop someone’s membership but keep their records, use Suspend or Revoke instead.</p>
                        <label className="block font-semibold">
                          Type the member’s full name to confirm: <span className="font-normal">{editing.fullName}</span>
                          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="mt-1 block w-full rounded-lg border border-crimson/40 bg-surface px-3 py-2 font-normal" autoComplete="off" />
                        </label>
                        {deleting && <p role="status" className="text-ink-soft">Deleting: {deleting.step} ({deleting.done} of {deleting.total})…</p>}
                        <button
                          type="button"
                          disabled={busy || Boolean(deleting) || confirmName.trim().toLowerCase() !== editing.fullName.trim().toLowerCase()}
                          onClick={() => deletePermanently(editing)}
                          className="cursor-pointer rounded-lg bg-crimson px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete permanently
                        </button>
                      </div>
                    </details>
                  )}

            </>
          )}
        />
      )}
    </div>
  );
};
