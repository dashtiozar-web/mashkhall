import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import { LevelBadge } from '../components/LevelBadge';
import { LEVELS } from '../lib/levels';
import {
  awardPoints, loadLedger, MANUAL_AWARDS, PointsEntry, PointsType, POINTS_TYPE_LABEL, POINT_VALUES, recalculateMember, resetAllPointsToCurrentRules, reverseEntry,
} from '../lib/ledger';
import { loadClaims, PLATFORMS, reviewClaim, ShareClaim } from '../lib/shares';

type View = 'claims' | 'ledger' | 'award' | 'levels';

/**
 * Points administration: verify share claims, review every award in the
 * ledger and reverse mistakes, give manual awards, and rebuild a member's
 * totals from the ledger.
 */
export const PointsAdmin: React.FC = () => {
  const { publicProfiles } = useData();
  const [view, setView] = useState<View>('claims');
  const [claims, setClaims] = useState<ShareClaim[] | null>(null);
  const [ledger, setLedger] = useState<PointsEntry[] | null>(null);
  const [member, setMember] = useState('all');
  const [type, setType] = useState<'all' | PointsType>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [awardTo, setAwardTo] = useState('');
  const [awardType, setAwardType] = useState<PointsType>('research_report');
  const [awardPts, setAwardPts] = useState(25);
  const [awardNote, setAwardNote] = useState('');

  const people = useMemo(() => [...publicProfiles].sort((a, b) => a.displayName.localeCompare(b.displayName)), [publicProfiles]);
  const nameOf = (uid: string) => publicProfiles.find((p) => p.id === uid)?.displayName || uid;

  const loadAll = async () => {
    setMsg(null);
    try {
      const [c, l] = await Promise.all([loadClaims(), loadLedger({ userId: member === 'all' ? undefined : member, max: 300 })]);
      setClaims(c);
      setLedger(l);
    } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: 'Points could not be loaded. Check that the latest database rules are published.' });
      setClaims([]);
      setLedger([]);
    }
  };
  useEffect(() => { loadAll(); }, [member]);

  const [progress, setProgress] = useState('');
  const resetAll = () => {
    if (!window.confirm('Recalculate every member’s points under the current rules?\n\nArticles already published (25 each) and reactions already given (10 each) are credited, then every total and level is rebuilt from the record of awards. Points from the old scheme are removed. Nothing is ever counted twice.')) return;
    run('resetAll', async () => {
      const r = await resetAllPointsToCurrentRules(setProgress);
      setProgress('');
      setMsg(null);
      return r;
    }, 'Every member is now on the current rules. Totals, levels and the Top 10 have been updated.');
  };

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await loadAll();
    } catch (e) {
      console.error(e);
      const text = e instanceof Error ? e.message : '';
      setMsg({ ok: false, text: /permission/i.test(text) ? 'The database refused this change. Check the rules are published and your permissions.' : text || 'Something went wrong.' });
    } finally {
      setBusy(null);
    }
  };

  const pending = (claims || []).filter((c) => c.status === 'pending');
  const shownLedger = (ledger || []).filter((e) => type === 'all' || e.type === type);
  const tab = (v: View, label: string) => (
    <button type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`cursor-pointer rounded-lg px-4 py-1.5 text-[0.9375rem] font-semibold ${view === v ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'}`}>{label}</button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-semibold">Points, levels and Top 10</h2>
        <p className="mt-1 max-w-[75ch] text-ink-soft">
          Points are added automatically: {POINT_VALUES.article_published} for a published article, {POINT_VALUES.article_reaction} for reacting to an article, {POINT_VALUES.share_verified} for a share you verify, and {POINT_VALUES.activity_attendance} for confirmed attendance at an activity. Each action counts once. Every award is listed here and can be reversed.
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
        {tab('claims', `Shares to verify (${pending.length})`)}
        {tab('ledger', 'All awards')}
        {tab('award', 'Give points')}
        {tab('levels', 'Levels')}
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      {view === 'claims' && (
        claims === null ? <p className="text-muted">Loading…</p> : pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No shares waiting. When members send the link to a post where they shared our content, it appears here.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{c.userName || nameOf(c.userId)} <span className="font-normal text-muted">shared on {PLATFORMS.find((p) => p.id === c.platform)?.label}</span></p>
                  <p className="truncate text-[0.9375rem] text-ink-soft">{c.targetType === 'article' ? 'Article' : 'Activity'}: {c.targetTitle}</p>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-[0.9375rem] font-semibold text-navy underline">Open their post <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></a>
                  <p className="text-[0.8125rem] text-muted">Open the post and check it is public, shared by this member, and links to our {c.targetType}.</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={Boolean(busy)} onClick={() => run(c.id, () => reviewClaim(c, true), `Verified. ${POINT_VALUES.share_verified} points added for ${c.userName || nameOf(c.userId)}.`)} className="cursor-pointer rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">Verify (+{POINT_VALUES.share_verified})</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => { const note = window.prompt('Why can’t it be verified? (shown to the member)') ?? null; if (note !== null) run(c.id, () => reviewClaim(c, false, note), 'Marked as not verified. The member can send a new link.'); }} className="cursor-pointer rounded-lg border border-line px-4 py-2 font-semibold hover:border-crimson/50 hover:text-crimson disabled:opacity-50">Not verified</button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {view === 'ledger' && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-stone p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.9375rem] text-ink-soft"><strong className="text-ink">Recalculate everyone.</strong> Credits past articles and reactions at today’s values, then rebuilds every member’s total and level from the awards below.</p>
            <button type="button" disabled={Boolean(busy)} onClick={resetAll} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {busy === 'resetAll' ? (progress || 'Working…') : 'Recalculate all members'}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={member} onChange={(e) => setMember(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2" aria-label="Member">
              <option value="all">Latest awards (all members)</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-lg border border-line bg-surface px-3 py-2" aria-label="Kind of award">
              <option value="all">All kinds</option>
              {(Object.keys(POINTS_TYPE_LABEL) as PointsType[]).filter((t) => !t.startsWith('meeting_')).map((t) => <option key={t} value={t}>{POINTS_TYPE_LABEL[t]}</option>)}
            </select>
            {member !== 'all' && (
              <button type="button" disabled={Boolean(busy)} onClick={() => run('recalc', () => recalculateMember(member), `Totals rebuilt from the ledger for ${nameOf(member)}.`)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-semibold hover:border-ink/40">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Rebuild totals
              </button>
            )}
          </div>
          {member !== 'all' && (() => {
            const p = publicProfiles.find((x) => x.id === member);
            const total = p?.points?.all || 0;
            const sum = shownLedger.reduce((n, e) => n + e.points, 0);
            return <p className="text-[0.9375rem] text-ink-soft">{nameOf(member)}: <strong>{total} points</strong> <LevelBadge points={total} />{type === 'all' && sum !== total ? <span className="ms-2 text-crimson">The ledger adds up to {sum}. Use “Rebuild totals” to correct it.</span> : null}</p>;
          })()}
          {ledger === null ? <p className="text-muted">Loading…</p> : shownLedger.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No awards yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[720px] text-start text-[0.9375rem]">
                <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
                  <tr><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold">Member</th><th className="px-3 py-2 font-semibold">For</th><th className="px-3 py-2 text-end font-semibold">Points</th><th className="px-3 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shownLedger.map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-ink-soft">{new Date(e.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td>
                      <td className="px-3 py-2 font-semibold">{e.userName || nameOf(e.userId)}</td>
                      <td className="px-3 py-2"><span className="block">{POINTS_TYPE_LABEL[e.type] || e.type}</span>{(e.targetTitle || e.note) && <span className="block truncate text-[0.8438rem] text-muted">{[e.targetTitle, e.note].filter(Boolean).join(' · ')}</span>}</td>
                      <td className={`px-3 py-2 text-end font-semibold tabular-nums ${e.points < 0 ? 'text-crimson' : 'text-navy'}`}>{e.points > 0 ? '+' : ''}{e.points}</td>
                      <td className="px-3 py-2 text-end">
                        <button type="button" disabled={Boolean(busy)} onClick={() => { if (window.confirm(`Reverse this award? ${e.userName || nameOf(e.userId)} will lose ${e.points} points.`)) run(e.id, () => reverseEntry(e), 'Award reversed.'); }} className="cursor-pointer text-[0.875rem] font-semibold text-crimson hover:underline">Reverse</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === 'award' && (
        <form
          className="max-w-xl space-y-4 rounded-2xl border border-line bg-surface p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!awardTo) { setMsg({ ok: false, text: 'Choose a member.' }); return; }
            if (!awardPts) { setMsg({ ok: false, text: 'Enter the number of points (negative to take points away).' }); return; }
            run('award', () => awardPoints(awardTo, awardType, awardPts, { note: awardNote.trim() || undefined, userName: nameOf(awardTo) }), `${awardPts > 0 ? 'Added' : 'Removed'} ${Math.abs(awardPts)} points ${awardPts > 0 ? 'for' : 'from'} ${nameOf(awardTo)}.`)
              .then(() => { setAwardNote(''); });
          }}
        >
          <p className="text-ink-soft">For contributions the website can’t see by itself. Use a negative number to correct a mistake.</p>
          <label className="block font-semibold">Member
            <select value={awardTo} onChange={(e) => setAwardTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 font-normal">
              <option value="">Choose…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}{p.chapterName ? ` (${p.chapterName})` : ''}</option>)}
            </select>
          </label>
          <label className="block font-semibold">For
            <select value={awardType} onChange={(e) => { const t = e.target.value as PointsType; setAwardType(t); setAwardPts(MANUAL_AWARDS.find((m) => m.type === t)?.points || 0); }} className="mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 font-normal">
              {MANUAL_AWARDS.map((m) => <option key={m.type} value={m.type}>{POINTS_TYPE_LABEL[m.type]}</option>)}
            </select>
          </label>
          <label className="block font-semibold">Points
            <input type="number" min={-1000} max={1000} step={1} value={awardPts} onChange={(e) => setAwardPts(Math.round(Number(e.target.value)))} className="mt-1 block w-32 rounded-lg border border-line bg-paper px-3 py-2 font-normal tabular-nums" />
          </label>
          <label className="block font-semibold">Note <span className="font-normal text-muted">(shown to the member)</span>
            <input value={awardNote} onChange={(e) => setAwardNote(e.target.value)} maxLength={500} className="mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 font-normal" placeholder="e.g. Translated the annual report" />
          </label>
          <button type="submit" disabled={Boolean(busy)} className="cursor-pointer rounded-lg bg-navy px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy === 'award' ? 'Saving…' : 'Save'}</button>
        </form>
      )}

      {view === 'levels' && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-start text-[0.9375rem]">
            <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Level</th><th className="px-3 py-2 text-end">Total points required</th><th className="px-3 py-2 text-end">Members now</th></tr></thead>
            <tbody className="divide-y divide-line">
              {LEVELS.map((l) => {
                const n = publicProfiles.filter((p) => { const t = p.points?.all || 0; return t >= l.minPoints && (l.index === LEVELS.length - 1 || t < l.minPoints + 100); }).length;
                return <tr key={l.name}><td className="px-3 py-2 text-muted tabular-nums">{l.number}</td><td className="px-3 py-2"><LevelBadge points={l.minPoints} /></td><td className="px-3 py-2 text-end tabular-nums">{l.minPoints.toLocaleString('en-GB')}</td><td className="px-3 py-2 text-end tabular-nums">{n}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
