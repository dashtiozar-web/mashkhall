import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { NewsBanner, ActivityRegistration } from '../types';
import { ActivityStats, confirmAttendance, councilSummary, loadActivityStats, loadRegistrations, removeRegistration, responseOf } from '../lib/activities';
import { formatEventDate } from '../lib/newsBanner';
import { positionTitle } from '../lib/positions';

const csvCell = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;

/** For organisers: who registered for an activity, and how many people looked at it. */
export const ActivityAttendees: React.FC<{ banner: NewsBanner; onClose: () => void }> = ({ banner, onClose }) => {
  const { chapters } = useData();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [rows, setRows] = useState<ActivityRegistration[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([loadActivityStats(banner.id), loadRegistrations(banner.id)])
      .then(([s, r]) => { setStats(s); setRows(r); })
      .catch((e) => {
        console.error(e);
        setError('Could not load registrations. Check that the latest database rules are published.');
      });
  };
  useEffect(load, [banner.id]);

  const council = (id?: string) => chapters.find((c) => c.id === id)?.name || id || '';

  const attendingRows = (rows || []).filter((r) => responseOf(r) === 'attending');
  const notRows = (rows || []).filter((r) => responseOf(r) === 'not_attending');
  const summary = councilSummary(rows || []);
  const [confirming, setConfirming] = useState<string | null>(null);

  const toggleAttended = async (r: ActivityRegistration) => {
    setConfirming(r.userId);
    setError(null);
    try {
      await confirmAttendance(banner, r, !r.attended);
      load();
    } catch (e) {
      console.error(e);
      setError('Attendance could not be updated. Check that the latest database rules are published.');
    } finally {
      setConfirming(null);
    }
  };

  const download = () => {
    if (!rows) return;
    const header = ['Name', 'Member ID', 'Position', 'Council', 'Answer', 'Attendance confirmed', 'Note', 'Answered'];
    const lines = [...attendingRows, ...notRows].map((r) => [r.name, r.memberNumber || '', positionTitle(r.positionId), council(r.chapterId), responseOf(r) === 'attending' ? 'Attending' : 'Cannot attend', r.attended ? 'Yes' : '', r.note || '', new Date(r.updatedAt || r.createdAt).toLocaleString('en-GB')].map(csvCell).join(','));
    const blob = new Blob([`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendees-${banner.message.slice(0, 40).replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const remove = async (r: ActivityRegistration) => {
    if (!window.confirm(`Remove ${r.name} from the list?`)) return;
    try {
      await removeRegistration(banner.id, r.userId);
      load();
    } catch {
      setError('Could not remove this registration.');
    }
  };

  const conversion = stats && rows && stats.memberViews ? Math.round((attendingRows.length / stats.memberViews) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="att-title">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 id="att-title" className="text-[1.375rem] font-semibold">{banner.message}</h3>
            <p className="text-[0.9375rem] text-muted">{[formatEventDate(banner.eventAt), banner.location].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{error}</p>}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ['Attending', rows ? attendingRows.length : undefined],
            ['Cannot attend', rows ? notRows.length : undefined],
            ['Attendance confirmed', rows ? attendingRows.filter((r) => r.attended).length : undefined],
            ['People who viewed it', stats?.views],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border border-line bg-paper p-4">
              <p className="text-[0.875rem] text-ink-soft">{l}</p>
              <p className="mt-1 font-serif text-[1.75rem] leading-none font-semibold tabular-nums">{v === undefined ? '…' : (v as number).toLocaleString('en-GB')}</p>
            </div>
          ))}
        </div>
        {stats && <p className="mt-2 text-[0.875rem] text-muted">{stats.memberViews} members and {stats.views - stats.memberViews} visitors viewed it (each counted once).{conversion !== null ? ` ${conversion}% of members who viewed it said they would attend.` : ''}</p>}

        {summary.length > 0 && (
          <div className="mt-5">
            <h4 className="font-semibold">By council <span className="font-normal text-muted">(highest participation first)</span></h4>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {summary.map((c, i) => (
                <li key={c.chapterId || 'none'} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.9375rem]">
                  <span className="font-semibold">{council(c.chapterId) || 'No council'}{i === 0 && summary.length > 1 ? <span className="ms-2 rounded-full bg-navy-tint px-2 py-0.5 text-[0.75rem] text-navy">highest</span> : null}{i === summary.length - 1 && summary.length > 1 ? <span className="ms-2 rounded-full bg-stone px-2 py-0.5 text-[0.75rem] text-muted">lowest</span> : null}</span>
                  <span className="tabular-nums text-ink-soft">{c.attending} attending · {c.notAttending} cannot attend</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <h4 className="font-semibold">Answers</h4>
          <button type="button" disabled={!rows?.length} onClick={download} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3.5 py-1.5 text-[0.9375rem] font-semibold hover:border-ink/40 disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" /> Download list (CSV)
          </button>
        </div>
        {rows === null ? (
          <p className="mt-3 text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-muted">Nobody has answered yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] text-start text-[0.9375rem]">
              <thead className="border-b border-line bg-stone text-[0.8438rem] text-muted">
                <tr><th className="px-3 py-2 font-semibold">Name</th><th className="px-3 py-2 font-semibold">Council</th><th className="px-3 py-2 font-semibold">Answer</th><th className="px-3 py-2 font-semibold">Attended?</th><th className="px-3 py-2 font-semibold">Note</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...attendingRows, ...notRows].map((r) => (
                  <tr key={r.userId}>
                    <td className="px-3 py-2"><p className="font-semibold">{r.name}</p><p className="text-[0.8125rem] text-muted">{[r.memberNumber, positionTitle(r.positionId)].filter(Boolean).join(' · ')}</p></td>
                    <td className="px-3 py-2">{council(r.chapterId)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap ${responseOf(r) === 'attending' ? 'bg-navy-tint text-navy' : 'bg-stone text-ink-soft'}`}>{responseOf(r) === 'attending' ? 'Attending' : 'Cannot attend'}</span></td>
                    <td className="px-3 py-2">
                      {responseOf(r) === 'attending' && (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-[0.875rem]">
                          <input type="checkbox" checked={Boolean(r.attended)} disabled={confirming === r.userId} onChange={() => toggleAttended(r)} />
                          {r.attended ? 'Confirmed (+10 points)' : 'Confirm'}
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{r.note || ''}</td>
                    <td className="px-3 py-2 text-end"><button type="button" onClick={() => remove(r)} className="cursor-pointer text-[0.875rem] font-semibold text-crimson hover:underline">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
