import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Download, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { Button, EmptyState } from './ui';
import { ATTENDANCE_LABEL, meetingTime, minutesText, MyMeetings, Overview, useMeetingData } from '../lib/meetings';
import { Award, downloadLetter } from '../lib/letter';

/**
 * Your account › Meetings and participation: upcoming meetings, your
 * attendance record and meeting points, activities you took part in, and
 * your Letters of Appreciation. Nothing here can be changed by you.
 */

const box = 'rounded-2xl border border-line bg-surface p-5 sm:p-6';
const TYPE: Record<string, string> = {
  meeting_attendance: 'Meeting attended',
  meeting_streak_bonus: 'Three meetings in a row',
  meeting_absence_penalty: 'Two meetings missed in a row',
  correction: 'Correction',
};
const REVIEW: Record<string, string> = { pending: 'Waiting for approval', approved: 'Confirmed' };

export const MyMeetingsPanel: React.FC = () => {
  const overview = useMeetingData<Overview>('overview');
  const mine = useMeetingData<MyMeetings>('mine');
  const [busy, setBusy] = useState('');

  if ((overview.loading && !overview.data) || (mine.loading && !mine.data)) return <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p>;
  const error = overview.error || mine.error;
  if (error) return <div className={box}><p className="font-semibold">Not available right now</p><p className="mt-1 text-ink-soft">{error.message}</p></div>;
  const o = overview.data;
  const m = mine.data;
  if (!o || !m) return null;
  const roomName = (id: string) => o.rooms.find((r) => r.id === id)?.name || '';
  const total = m.points.reduce((s, p) => s + p.points, 0);

  const download = async (id: string) => {
    setBusy(id);
    try {
      const snap = await getDoc(doc(db, 'appreciation_awards', id));
      if (snap.exists()) await downloadLetter(snap.data() as Award);
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.375rem] font-semibold">Upcoming meetings</h2>
          <a href="/meetings" className="font-semibold">All your meeting rooms ({o.rooms.length})</a>
        </div>
        {o.upcoming.length ? (
          <ul className="mt-3 divide-y divide-line">{o.upcoming.slice(0, 6).map((x) => {
            const t = meetingTime(x.startAt);
            return (
              <li key={x.id} className="py-3">
                <a href={`/meetings/${x.id}`} className="font-semibold" dir="auto" data-i18n-skip="">{x.title}</a>
                <p className="text-[0.9375rem] text-ink-soft">{roomName(x.roomId)} · {t.official}{x.status === 'live' ? ' · Live now' : ''}</p>
                {t.local && <p className="text-[0.875rem] text-muted">{t.local}</p>}
              </li>
            );
          })}</ul>
        ) : <p className="mt-2 text-muted">No meetings scheduled. You will be notified and reminded 24 hours, 1 hour and 10 minutes before each one.</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={box}><p className="text-[0.875rem] font-semibold text-muted uppercase">Meetings in a row</p><p className="mt-1 font-serif text-[2rem] font-semibold">{m.streak.attended}</p><p className="text-[0.875rem] text-muted">{m.streak.untilBonus} more for the next 10-point bonus</p></div>
        <div className={box}><p className="text-[0.875rem] font-semibold text-muted uppercase">Meeting points</p><p className="mt-1 font-serif text-[2rem] font-semibold">{total}</p><p className="text-[0.875rem] text-muted">Included in your total points</p></div>
        <div className={box}><p className="text-[0.875rem] font-semibold text-muted uppercase">Letters of Appreciation</p><p className="mt-1 font-serif text-[2rem] font-semibold">{m.awards.length}</p><p className="text-[0.875rem] text-muted">For activities you took part in</p></div>
      </div>
      {m.streak.missed >= 1 && <p className="rounded-lg bg-amber-tint px-4 py-3">You missed your last meeting. Missing two in a row deducts 15 points; if you cannot attend, tell your meeting leader in advance so it can be recorded as excused.</p>}

      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">Your Letters of Appreciation</h2>
        {m.awards.length ? (
          <ul className="mt-3 divide-y divide-line">{m.awards.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span><a href={`/appreciation/${a.id}`} className="font-semibold" dir="auto">{a.activityTitle}</a><span className="block text-[0.875rem] text-muted"><span translate="no">{a.number}</span> · issued {new Date(a.issuedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span></span>
              <Button variant="secondary" disabled={busy === a.id} onClick={() => download(a.id)}>{busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} Download PDF</Button>
            </li>
          ))}</ul>
        ) : <p className="mt-2 text-muted">When you take part in an official activity and your council leader’s list is approved, your letter appears here.</p>}
      </section>

      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">Your attendance</h2>
        {m.history.length ? (
          <ul className="mt-3 divide-y divide-line">{m.history.map((h) => (
            <li key={h.meetingId} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span><a href={`/meetings/${h.meetingId}`} dir="auto" data-i18n-skip="">{h.title}</a><span className="block text-[0.875rem] text-muted">{roomName(h.roomId)} · {new Date(h.startAt).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' })}</span></span>
              <span className={`text-[0.9375rem] ${h.status === 'absent' ? 'text-crimson' : ''}`}>{ATTENDANCE_LABEL[h.status]}{h.minutes ? ` · ${minutesText(h.minutes)}` : ''}{h.corrected ? ' · corrected by the leader' : ''}</span>
            </li>
          ))}</ul>
        ) : <EmptyState title="No confirmed meetings yet" body="Your attendance appears here after the leader confirms each meeting’s lists." />}
      </section>

      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">Meeting points history</h2>
        {m.points.length ? (
          <ul className="mt-3 divide-y divide-line">{m.points.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span><span className="font-semibold">{TYPE[p.type] || p.type}</span>{p.title && <span className="block text-[0.875rem] text-muted" dir="auto">{p.title}</span>}<span className="block text-[0.8125rem] text-muted">{new Date(p.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span></span>
              <span className={`font-semibold tabular-nums ${p.points < 0 ? 'text-crimson' : 'text-[#1E6B47]'}`}>{p.points > 0 ? '+' : ''}{p.points}</span>
            </li>
          ))}</ul>
        ) : <p className="mt-2 text-muted">No meeting points yet.</p>}
      </section>

      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">Activities you took part in</h2>
        {m.activities.length ? (
          <ul className="mt-3 divide-y divide-line">{m.activities.map((a) => (
            <li key={a.activityId} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span><span dir="auto">{a.title}</span><span className="block text-[0.875rem] text-muted">{a.date ? new Date(a.date).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : ''}</span></span>
              <span className="text-[0.9375rem]">{a.status === 'attended' ? 'Took part' : a.status === 'excused' ? 'Excused' : 'Did not take part'} · {REVIEW[a.review] || a.review}</span>
            </li>
          ))}</ul>
        ) : <p className="mt-2 text-muted">Your council leader records who took part after each activity.</p>}
      </section>
    </div>
  );
};
