import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { LevelProgressCard } from './LevelBadge';
import { LEVELS } from '../lib/levels';
import { PointsEntry, POINTS_TYPE_LABEL, POINT_VALUES } from '../lib/ledger';
import { ShareClaim, SHARE_STATUS_LABEL } from '../lib/shares';

/** A member's own level, progress, and every points award they have received. */
export const MyPointsPanel: React.FC<{ uid: string }> = ({ uid }) => {
  const [points, setPoints] = useState(0);
  const [entries, setEntries] = useState<PointsEntry[] | null>(null);
  const [claims, setClaims] = useState<ShareClaim[]>([]);
  const [showLevels, setShowLevels] = useState(false);

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, 'public_profiles', uid), (s) => setPoints(((s.data()?.points || {}).all as number) || 0), () => {}),
      onSnapshot(query(collection(db, 'points_ledger'), where('userId', '==', uid)),
        (s) => setEntries(s.docs.map((d) => ({ ...(d.data() as PointsEntry), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
        () => setEntries([])),
      onSnapshot(query(collection(db, 'share_claims'), where('userId', '==', uid)),
        (s) => setClaims(s.docs.map((d) => ({ ...(d.data() as ShareClaim), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
        () => setClaims([])),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const earn = [
    { label: 'Publish an article (after editorial review)', pts: POINT_VALUES.article_published, note: 'once per article' },
    { label: 'React to an article (the Support button)', pts: POINT_VALUES.article_reaction, note: 'once per article, not your own' },
    { label: 'Share our content and send us the link', pts: POINT_VALUES.share_verified, note: 'after we check it, once per item' },
    { label: 'Attend an activity', pts: POINT_VALUES.activity_attendance, note: 'once an organiser confirms you were there' },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="level-heading" className="rounded-2xl border border-line bg-surface p-6">
        <h3 id="level-heading" className="text-[1.375rem] font-semibold">Your activity level</h3>
        <div className="mt-4"><LevelProgressCard points={points} compact /></div>
        <button type="button" onClick={() => setShowLevels(!showLevels)} aria-expanded={showLevels} className="mt-4 cursor-pointer text-[0.9375rem] font-semibold text-navy underline underline-offset-4">
          {showLevels ? 'Hide all levels' : 'See all 18 levels'}
        </button>
        {showLevels && (
          <ol className="mt-3 grid gap-x-6 gap-y-1 text-[0.9375rem] sm:grid-cols-3">
            {LEVELS.map((l) => (
              <li key={l.name} className={`flex justify-between gap-2 border-b border-line py-1 ${points >= l.minPoints ? 'font-semibold' : 'text-muted'}`}>
                <span>{l.number}. {l.name}</span><span className="tabular-nums">{l.minPoints.toLocaleString('en-GB')}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="earn-heading" className="rounded-2xl border border-line bg-surface p-6">
        <h3 id="earn-heading" className="text-[1.25rem] font-semibold">How to earn points</h3>
        <ul className="mt-3 divide-y divide-line">
          {earn.map((e) => (
            <li key={e.label} className="flex items-center justify-between gap-4 py-2.5">
              <span><span className="font-semibold">{e.label}</span><span className="block text-[0.875rem] text-muted">{e.note}</span></span>
              <span className="shrink-0 rounded-full bg-navy-tint px-3 py-1 font-semibold text-navy tabular-nums">+{e.pts}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.875rem] text-muted">Viewing pages never earns points, and the same action can’t earn points twice.</p>
      </section>

      {claims.length > 0 && (
        <section aria-labelledby="claims-heading" className="rounded-2xl border border-line bg-surface p-6">
          <h3 id="claims-heading" className="text-[1.25rem] font-semibold">Your shares</h3>
          <ul className="mt-3 divide-y divide-line">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0"><span className="block truncate font-semibold">{c.targetTitle || c.targetId}</span><a href={c.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[0.875rem] text-navy underline">{c.url}</a></span>
                <span className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold ${c.status === 'approved' ? 'bg-navy-tint text-navy' : c.status === 'rejected' ? 'bg-crimson/10 text-crimson' : 'bg-amber-tint text-ink'}`}>{SHARE_STATUS_LABEL[c.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-heading" className="rounded-2xl border border-line bg-surface p-6">
        <h3 id="history-heading" className="text-[1.25rem] font-semibold">Your points history</h3>
        {entries === null ? (
          <p className="mt-3 text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-muted">No points yet. Every member starts at Bronze I.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className="block font-semibold">{POINTS_TYPE_LABEL[e.type] || e.type}</span>
                  <span className="block truncate text-[0.875rem] text-muted">{[e.targetTitle, e.note, new Date(e.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${e.points < 0 ? 'text-crimson' : 'text-navy'}`}>{e.points > 0 ? '+' : ''}{e.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
