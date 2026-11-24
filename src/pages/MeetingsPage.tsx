import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, CalendarPlus, ChevronRight, ClipboardCheck, Clock, Download, FileText, Link2, ListChecks, Loader2, Lock, Megaphone, Mic, Pencil, Play, Plus, Repeat, ShieldCheck, Trash2, Users, Video, XCircle,
} from 'lucide-react';
import { Button, Container, EmptyState, PageHeader, SectionHeading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNewsBanners } from '../lib/newsBanner';
import {
  ACTION_LABEL, ActionPoint, ATTENDANCE_LABEL, AttendanceStatus, AttendanceView, isoToUk, joinable, Meeting, meetingApi, MeetingDetail, MeetingError, meetingTime,
  MinutesView, minutesText, Overview, ROLE_LABEL, ROOM_KIND_LABEL, RoomDetail, RoomKind, RoomReport, STATUS_LABEL, ukToIso, useMeetingData,
} from '../lib/meetings';
import { positionTitle } from '../lib/positions';
import { SetupStatus } from '../components/SetupStatus';

const MeetingCall = lazy(() => import('../components/MeetingCall'));

interface Props {
  param?: string;
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

const card = 'rounded-2xl border border-line bg-surface';
const field = 'mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[1rem]';
const label = 'block text-[0.9375rem] font-semibold';

const StatusBadge: React.FC<{ m: Meeting }> = ({ m }) => {
  const tone = m.status === 'live' ? 'bg-crimson text-white' : m.status === 'scheduled' ? 'bg-navy-tint text-navy' : m.status === 'cancelled' ? 'bg-stone text-muted line-through' : 'bg-stone text-ink-soft';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold ${tone}`}>{m.status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />}{STATUS_LABEL[m.status]}</span>;
};

const Problem: React.FC<{ error: MeetingError | null; onRetry?: () => void }> = ({ error, onRetry }) => (error ? (
  <div className={`${card} border-crimson/40 p-5`} role="alert">
    <p className="font-semibold">{error.setup ? 'Video meetings are being set up' : error.status === 403 ? 'Not available to you' : 'Something went wrong'}</p>
    <p className="mt-1 text-ink-soft">{error.message}</p>
    {error.setup && <div className="mt-4 border-t border-line pt-4"><SetupStatus /></div>}
    {onRetry && error.status !== 403 && <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>}
  </div>
) : null);

const Loading: React.FC = () => (
  <p className="flex items-center gap-2 py-10 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p>
);

const When: React.FC<{ iso: string; duration?: number }> = ({ iso, duration }) => {
  const t = meetingTime(iso);
  return (
    <span className="block">
      <span className="block">{t.official}{duration ? ` · ${minutesText(duration)}` : ''}</span>
      {t.local && <span className="block text-[0.875rem] text-muted">{t.local}</span>}
    </span>
  );
};

// ---------------------------------------------------------------- hub

const MeetingRow: React.FC<{ m: Meeting; roomName?: string; showRoom?: boolean }> = ({ m, roomName, showRoom }) => (
  <li>
    <a href={`/meetings/${m.id}`} className="group flex flex-col gap-2 rounded-xl border border-line bg-paper p-4 no-underline hover:border-navy sm:flex-row sm:items-center">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge m={m} />
          {m.kind === 'preparation' && <span className="rounded-full bg-amber-tint px-2.5 py-0.5 text-[0.8125rem] font-semibold">Activity preparation</span>}
          <span className="inline-flex items-center gap-1 text-[0.8125rem] text-muted">{m.media === 'video' ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}{m.media === 'video' ? 'Audio and video' : 'Audio only'}</span>
          {m.recurrence === 'monthly' && <span className="inline-flex items-center gap-1 text-[0.8125rem] text-muted"><Repeat className="h-3.5 w-3.5" aria-hidden="true" /> Monthly</span>}
        </span>
        <span className="mt-1.5 block text-[1.125rem] font-semibold text-ink group-hover:underline" dir="auto" data-i18n-skip="">{m.title}</span>
        {showRoom && roomName && <span className="block text-[0.9375rem] text-ink-soft">{roomName}</span>}
        <span className="mt-1 block text-[0.9375rem] text-ink-soft"><When iso={m.startAt} duration={m.durationMin} /></span>
      </span>
      {m.status === 'ended' && m.attendanceStatus === 'approved' && <span className="text-[0.875rem] text-muted">{m.attendedCount} of {m.eligibleCount} attended</span>}
      <ChevronRight className="hidden h-5 w-5 text-muted sm:block" aria-hidden="true" />
    </a>
  </li>
);

const Hub: React.FC<{ onNavigate: Props['onNavigate'] }> = ({ onNavigate }) => {
  const { data, error, loading, reload } = useMeetingData<Overview>('overview');
  const roomName = (id: string) => data?.rooms.find((r) => r.id === id)?.name || '';
  return (
    <>
      <PageHeader title="Online meetings" intro="Private meeting rooms for each council, the Board of Directors, the Board with Council Leaders, Research and Investigation, the Production Team and Website Administration. Only the members of each room can enter it, and the server checks this every time." />
      <Container className="space-y-12 py-10 sm:py-14">
        {loading && !data && <Loading />}
        <Problem error={error} onRetry={reload} />
        {data && !data.setup.video && (
          <div className="rounded-2xl border border-amber/50 bg-amber-tint p-5">
            <p className="font-semibold">Video meetings are being set up</p>
            <p className="mt-1 text-ink-soft">You can already see your rooms and scheduled meetings. Joining will be possible once the video service is connected{data.me.isAdmin ? ' (see Administration > Online meetings)' : ''}.</p>
          </div>
        )}
        {data && (
          <>
            <section>
              <SectionHeading title="Upcoming meetings" intro="Times are UK time. Your own time is shown underneath if you are elsewhere." />
              {data.upcoming.length ? <ul className="space-y-3">{data.upcoming.map((m) => <MeetingRow key={m.id} m={m} roomName={roomName(m.roomId)} showRoom />)}</ul>
                : <EmptyState title="No meetings scheduled" body="You will be notified when a meeting is scheduled in one of your rooms." />}
            </section>
            <section>
              <SectionHeading title="Your meeting rooms" intro="Each council, the Board and each team has its own room, meetings, notices and records. You see only the rooms you belong to." />
              {data.rooms.length ? (
                <div className="space-y-8">
                  {([['Councils', ['council']], ['Leadership', ['board', 'joint']], ['Teams and departments', ['research', 'production', 'webadmin']]] as [string, RoomKind[]][]).map(([group, kinds]) => {
                    const list = data.rooms.filter((r) => kinds.includes(r.kind));
                    if (!list.length) return null;
                    return (
                      <div key={group}>
                        <h3 className="mb-3 text-[1.0625rem] font-semibold text-ink-soft">{group}</h3>
                        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map((r) => (
                            <li key={r.id}>
                              <a href={`/meetings/room/${r.id}`} className={`${card} group flex h-full flex-col p-5 no-underline hover:border-navy`}>
                                <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-crimson">{r.kind === 'council' ? <Users className="h-4 w-4" aria-hidden="true" /> : r.kind === 'research' ? <Lock className="h-4 w-4" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}{ROOM_KIND_LABEL[r.kind]}</span>
                                <span className="mt-2 text-[1.25rem] font-semibold text-ink group-hover:underline">{r.name}</span>
                                <span className="mt-1 text-[0.9375rem] text-ink-soft">Leader: {r.leaderName ? <span data-i18n-skip="" dir="auto">{r.leaderName}</span> : 'not yet appointed'}</span>
                                <span className="mt-auto pt-3 text-[0.8125rem] text-muted">You: {ROLE_LABEL[r.role]} · {data.upcoming.filter((m) => m.roomId === r.id).length} upcoming</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="No meeting rooms yet" body="Meeting rooms are for approved members. Once your membership is approved, your council’s room appears here." action={<Button variant="secondary" onClick={() => onNavigate('apply')}>Become a member</Button>} />}
            </section>
            {data.recent.length > 0 && (
              <section>
                <SectionHeading title="Past meetings" />
                <ul className="space-y-3">{data.recent.slice(0, 12).map((m) => <MeetingRow key={m.id} m={m} roomName={roomName(m.roomId)} showRoom />)}</ul>
              </section>
            )}
            {(data.me.isAdmin || data.rooms.some((r) => r.kind === 'council' && r.can.activities && r.role !== 'member')) && (
              <section className={`${card} flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between`}>
                <div>
                  <h2 className="text-[1.25rem] font-semibold">Activity participation</h2>
                  <p className="text-ink-soft">Record who took part in an official activity, for Letters of Appreciation.</p>
                </div>
                <a href="/meetings/participation" className="inline-flex items-center justify-center rounded-lg bg-navy px-5 py-2.5 font-semibold text-white no-underline">Record participation</a>
              </section>
            )}
            <section className={`${card} p-6`}>
              <h2 className="text-[1.25rem] font-semibold">How attendance and points work</h2>
              <ul className="mt-3 list-disc space-y-1.5 ps-5 text-ink-soft">
                <li>Attendance is measured from the time you are actually in the meeting. You need to be present for at least {data.settings.thresholdPercent}% of it.</li>
                <li>The meeting leader confirms the list after each meeting. You earn 30 points for each meeting attended, and 10 extra points for every three meetings in a row.</li>
                <li>Missing two meetings in a row deducts 15 points, once. Excused absences agreed with your leader do not count.</li>
                <li>Reminders are sent 24 hours, 1 hour and 10 minutes before each meeting.</li>
              </ul>
            </section>
          </>
        )}
      </Container>
    </>
  );
};

// ---------------------------------------------------------------- schedule form

interface FormState {
  title: string; purpose: string; agenda: string; date: string; time: string; durationMin: number; kind: 'regular' | 'preparation';
  activityId: string; invite: 'all' | 'selected'; invitees: string[]; recurrence: 'none' | 'monthly'; waitingRoom: 'off' | 'host' | 'approve'; speaking: 'open' | 'controlled'; media: 'audio' | 'video';
}

const ScheduleForm: React.FC<{ room: RoomDetail; editing?: Meeting | null; onDone: () => void; onCancel: () => void }> = ({ room, editing, onDone, onCancel }) => {
  const { banners } = useNewsBanners(false);
  const activities = useMemo(() => banners.filter((b) => b.mode === 'announcement' && b.eventAt && Date.parse(b.eventAt) > Date.now() - 86400000)
    .filter((b) => room.room.kind !== 'council' || !b.councilId || b.councilId === room.room.chapterId), [banners, room.room]);
  const start = editing ? isoToUk(editing.startAt) : { date: '', time: '19:00' };
  const [f, setF] = useState<FormState>({
    title: editing?.title || '', purpose: editing?.purpose || '', agenda: editing?.agenda || '', date: start.date, time: start.time,
    durationMin: editing?.durationMin || 60, kind: editing?.kind || 'regular', activityId: editing?.activityId || '', invite: editing?.invite || 'all',
    invitees: editing?.invitees || [], recurrence: editing?.recurrence || 'none', waitingRoom: editing?.waitingRoom || 'host', speaking: editing?.speaking || 'open', media: editing?.media || 'audio',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.date || !f.time) { setError('Choose a date and time.'); return; }
    setBusy(true);
    try {
      const body = { ...f, startAt: ukToIso(f.date, f.time) };
      if (editing) await meetingApi('update', { id: editing.id, ...body });
      else await meetingApi('schedule', { roomId: room.room.id, ...body });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-5 p-5 sm:p-6`}>
      <h2 className="text-[1.375rem] font-semibold">{editing ? 'Change meeting' : 'Schedule a meeting'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>Title<input required minLength={3} maxLength={160} value={f.title} onChange={(e) => set('title', e.target.value)} className={field} dir="auto" /></label>
        <label className={`${label} sm:col-span-2`}>Purpose <span className="font-normal text-muted">(one or two sentences; used for the public activity post)</span>
          <textarea maxLength={400} rows={2} value={f.purpose} onChange={(e) => set('purpose', e.target.value)} className={field} dir="auto" /></label>
        <label className={`${label} sm:col-span-2`}>Agenda <span className="font-normal text-muted">(seen only by the people invited)</span>
          <textarea maxLength={4000} rows={5} value={f.agenda} onChange={(e) => set('agenda', e.target.value)} className={field} dir="auto" /></label>
        <label className={label}>Date<input type="date" required value={f.date} onChange={(e) => set('date', e.target.value)} className={field} /></label>
        <label className={label}>Start time (UK time)<input type="time" required value={f.time} onChange={(e) => set('time', e.target.value)} className={field} /></label>
        <label className={label}>Expected duration
          <select value={f.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} className={field}>
            {[30, 45, 60, 90, 120, 150, 180, 240].map((n) => <option key={n} value={n}>{minutesText(n)}</option>)}
          </select>
        </label>
        <label className={label}>Type of meeting
          <select value={f.kind} onChange={(e) => set('kind', e.target.value as FormState['kind'])} className={field}>
            <option value="regular">Regular meeting</option>
            <option value="preparation">Preparation for an activity</option>
          </select>
        </label>
        {f.kind === 'preparation' && (
          <label className={`${label} sm:col-span-2`}>Activity being prepared
            <select value={f.activityId} onChange={(e) => set('activityId', e.target.value)} className={field}>
              <option value="">Not linked to a published activity</option>
              {activities.map((b) => <option key={b.id} value={b.id}>{b.message.slice(0, 90)}</option>)}
            </select>
          </label>
        )}
        {!editing && (
          <label className={label}>Repeat
            <select value={f.recurrence} onChange={(e) => set('recurrence', e.target.value as FormState['recurrence'])} className={field}>
              <option value="none">Does not repeat</option>
              <option value="monthly">Every month on this day</option>
            </select>
          </label>
        )}
        <label className={label}>Call type
          <select value={f.media} onChange={(e) => set('media', e.target.value as FormState['media'])} className={field}>
            <option value="audio">Audio only</option>
            <option value="video">Audio and video</option>
          </select>
        </label>
        <label className={label}>Waiting room
          <select value={f.waitingRoom} onChange={(e) => set('waitingRoom', e.target.value as FormState['waitingRoom'])} className={field}>
            <option value="host">Members wait until the leader joins</option>
            <option value="approve">The leader lets each person in</option>
            <option value="off">No waiting room</option>
          </select>
        </label>
        <label className={label}>Speaking
          <select value={f.speaking} onChange={(e) => set('speaking', e.target.value as FormState['speaking'])} className={field}>
            <option value="open">Members can unmute themselves</option>
            <option value="controlled">Members raise a hand; the leader gives permission</option>
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className={label}>Who is invited</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="radio" checked={f.invite === 'all'} onChange={() => set('invite', 'all')} /> Everyone in {room.room.name} ({room.members.length})</label>
            <label className="flex items-center gap-2"><input type="radio" checked={f.invite === 'selected'} onChange={() => set('invite', 'selected')} /> Selected members</label>
          </div>
          {f.invite === 'selected' && (
            <ul className="mt-3 grid max-h-64 gap-1.5 overflow-y-auto rounded-lg border border-line bg-paper p-3 sm:grid-cols-2">
              {room.members.map((m) => (
                <li key={m.uid}><label className="flex items-center gap-2 text-[0.9375rem]">
                  <input type="checkbox" checked={f.invitees.includes(m.uid)} onChange={(e) => set('invitees', e.target.checked ? [...f.invitees, m.uid] : f.invitees.filter((u) => u !== m.uid))} />
                  <span data-i18n-skip="" dir="auto">{m.name}</span> <span className="text-muted">· {positionTitle(m.positionId)}</span>
                </label></li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
      {error && <p className="text-crimson" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes and notify' : 'Schedule and notify members'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------- room

type RoomTab = 'upcoming' | 'past' | 'notices' | 'report' | 'people';

const RoomView: React.FC<{ id: string }> = ({ id }) => {
  const { data, error, loading, reload } = useMeetingData<RoomDetail>(`room?id=${encodeURIComponent(id)}`);
  const [form, setForm] = useState<{ editing: Meeting | null } | null>(null);
  const [tab, setTab] = useState<RoomTab>('upcoming');
  const upcoming = (data?.meetings || []).filter((m) => m.status === 'scheduled' || m.status === 'live').sort((a, b) => a.startAt.localeCompare(b.startAt));
  const past = (data?.meetings || []).filter((m) => m.status === 'ended' || m.status === 'cancelled');
  const tabs: [RoomTab, string, boolean][] = data ? [
    ['upcoming', `Upcoming (${upcoming.length})`, true],
    ['past', `Past meetings (${past.length})`, true],
    ['notices', `Notices and documents (${data.notices.length})`, true],
    ['report', 'Attendance report', data.room.can.attendance],
    ['people', `Members (${data.members.length})`, true],
  ] : [];
  return (
    <>
      <PageHeader title={data?.room.name || 'Meeting room'} kicker={<><a href="/meetings">Online meetings</a>{data ? ` · ${ROOM_KIND_LABEL[data.room.kind]}` : ''}</>}
        intro={data ? <>Leader: {data.room.leaderName ? <span data-i18n-skip="" dir="auto">{data.room.leaderName}</span> : 'not yet appointed'}{data.moderators.length ? <> · Moderators: <span data-i18n-skip="" dir="auto">{data.moderators.map((x) => x.name).join(', ')}</span></> : null} · {data.members.length} members · You: {ROLE_LABEL[data.room.role]}</> : undefined} />
      <Container className="space-y-8 py-10 sm:py-14">
        {loading && !data && <Loading />}
        <Problem error={error} onRetry={reload} />
        {data && (
          <>
            {data.room.kind === 'research' && <p className="flex items-start gap-2 rounded-xl border border-crimson/30 bg-crimson/5 px-4 py-3 text-[0.9375rem]"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />Confidential room. Its meetings, notices and minutes are visible only to the people in it. Do not share what is discussed here.</p>}
            {data.room.can.schedule && !form && <Button onClick={() => { setForm({ editing: null }); setTab('upcoming'); }}><CalendarPlus className="h-5 w-5" aria-hidden="true" /> Schedule a meeting</Button>}
            {form && <ScheduleForm room={data} editing={form.editing} onDone={() => { setForm(null); reload(); }} onCancel={() => setForm(null)} />}
            <nav className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Room">
              {tabs.filter(([, , show]) => show).map(([t, text]) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`shrink-0 cursor-pointer border-b-2 px-3 py-2.5 font-semibold ${tab === t ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink'}`}>{text}</button>
              ))}
            </nav>
            {tab === 'upcoming' && (
              <section>
                {upcoming.length ? (
                  <ul className="space-y-3">{upcoming.map((m) => (
                    <li key={m.id} className="space-y-2">
                      <ul><MeetingRow m={m} /></ul>
                      {data.room.can.schedule && m.status === 'scheduled' && (
                        <div className="flex flex-wrap gap-3 ps-1">
                          <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-[0.9375rem] font-semibold text-navy underline" onClick={() => setForm({ editing: m })}><Pencil className="h-4 w-4" aria-hidden="true" /> Change or move</button>
                          <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-[0.9375rem] font-semibold text-crimson underline" onClick={async () => {
                            const reason = window.prompt('Cancel this meeting? Members will be notified. Reason (optional):');
                            if (reason === null) return;
                            try { await meetingApi('cancel', { id: m.id, reason }); reload(); } catch (e) { window.alert((e as Error).message); }
                          }}><XCircle className="h-4 w-4" aria-hidden="true" /> Cancel</button>
                        </div>
                      )}
                    </li>
                  ))}</ul>
                ) : <EmptyState title="Nothing scheduled" body={data.room.can.schedule ? 'Schedule the next meeting; everyone in the room is notified and reminded.' : 'You will be notified when the leader schedules a meeting.'} />}
              </section>
            )}
            {tab === 'past' && (past.length ? <ul className="space-y-3">{past.map((m) => <MeetingRow key={m.id} m={m} />)}</ul> : <EmptyState title="No past meetings yet" />)}
            {tab === 'notices' && <Notices room={data} onChanged={reload} />}
            {tab === 'report' && <Report roomId={data.room.id} roomName={data.room.name} />}
            {tab === 'people' && (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.members.map((p) => (
                  <li key={p.uid} className={`${card} flex items-center gap-3 p-3`}>
                    {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-tint font-semibold text-navy">{p.name.slice(0, 1)}</span>}
                    <span className="min-w-0"><span className="block truncate font-semibold" dir="auto" data-i18n-skip="">{p.name}</span><span className="block truncate text-[0.8125rem] text-muted">{positionTitle(p.positionId)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Container>
    </>
  );
};

const Notices: React.FC<{ room: RoomDetail; onChanged: () => void }> = ({ room, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', body: '', link: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const can = room.room.can.schedule;
  const post = async () => {
    setBusy(true);
    setErr('');
    try { await meetingApi('notice', { roomId: room.room.id, ...f }); setF({ title: '', body: '', link: '' }); setOpen(false); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-4">
      {can && !open && <Button variant="secondary" onClick={() => setOpen(true)}><Megaphone className="h-4 w-4" aria-hidden="true" /> Post a notice or share a document</Button>}
      {open && (
        <div className={`${card} space-y-3 p-5`}>
          <label className="block font-semibold">Title<input className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} dir="auto" /></label>
          <label className="block font-semibold">Message<textarea rows={4} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} dir="auto" /></label>
          <label className="block font-semibold">Document link (optional)<input className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://drive.google.com/…" dir="ltr" /></label>
          <p className="text-[0.8125rem] text-muted">Share documents as links to a protected folder (for example Google Drive shared only with the room’s members). Everyone in the room is notified.</p>
          {err && <p role="alert" className="text-crimson">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || f.title.trim().length < 3} onClick={post}>Post</Button></div>
        </div>
      )}
      {room.notices.length ? (
        <ul className="space-y-3">
          {room.notices.map((n) => (
            <li key={n.id} className={`${card} p-5`}>
              <div className="flex items-start gap-3">
                {n.kind === 'document' ? <FileText className="mt-1 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /> : <Megaphone className="mt-1 h-5 w-5 shrink-0 text-navy" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold" dir="auto" data-i18n-skip="">{n.title}</h3>
                  {n.body && <p className="mt-1 whitespace-pre-wrap text-ink-soft" dir="auto" data-i18n-skip="">{n.body}</p>}
                  {n.link && <a href={n.link} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-navy" dir="ltr"><Link2 className="h-4 w-4" aria-hidden="true" /> Open the document</a>}
                  <p className="mt-2 text-[0.8125rem] text-muted"><span data-i18n-skip="" dir="auto">{n.createdByName}</span> · {new Date(n.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</p>
                </div>
                {can && <button type="button" aria-label="Delete notice" className="cursor-pointer rounded p-1 text-crimson hover:bg-crimson/5" onClick={async () => { if (!window.confirm('Delete this notice?')) return; try { await meetingApi('notice-delete', { id: n.id }); onChanged(); } catch (e) { window.alert((e as Error).message); } }}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No notices yet" body={can ? 'Post announcements and share document links with everyone in this room.' : 'The leader’s notices and shared documents appear here.'} />}
    </section>
  );
};

const Report: React.FC<{ roomId: string; roomName: string }> = ({ roomId, roomName }) => {
  const { data, error, loading, reload } = useMeetingData<RoomReport>(`room-report?id=${encodeURIComponent(roomId)}`);
  const csv = () => {
    if (!data) return;
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Member', 'Meetings', 'Attended', 'Late', 'Absent', 'Excused', 'Attendance %'], ...data.people.map((p) => [p.name, p.meetings, p.attended, p.late, p.absent, p.excused, p.rate])];
    const blob = new Blob([`\ufeff${rows.map((r) => r.map(q).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${roomName.replace(/[^A-Za-z0-9]+/g, '-')}-attendance.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  if (loading && !data) return <Loading />;
  if (error) return <Problem error={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">From the {data.meetings.length} meetings whose attendance has been confirmed.</p>
        <Button variant="secondary" disabled={!data.people.length} onClick={csv}><Download className="h-4 w-4" aria-hidden="true" /> Download (CSV)</Button>
      </div>
      {data.people.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[0.9375rem]">
            <thead className="border-b border-line text-[0.8438rem] text-muted"><tr><th className="py-2 font-semibold">Member</th><th className="py-2 text-end font-semibold">Meetings</th><th className="py-2 text-end font-semibold">Attended</th><th className="py-2 text-end font-semibold">Late</th><th className="py-2 text-end font-semibold">Absent</th><th className="py-2 text-end font-semibold">Excused</th><th className="py-2 text-end font-semibold">Rate</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.people.map((p) => <tr key={p.uid}><td className="py-2 font-semibold" dir="auto" data-i18n-skip="">{p.name}</td><td className="py-2 text-end tabular-nums">{p.meetings}</td><td className="py-2 text-end tabular-nums">{p.attended}</td><td className="py-2 text-end tabular-nums">{p.late}</td><td className="py-2 text-end tabular-nums">{p.absent}</td><td className="py-2 text-end tabular-nums">{p.excused}</td><td className="py-2 text-end tabular-nums">{p.rate}%</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-4 text-muted">No confirmed attendance yet.</p>}
    </section>
  );
};

/** Minutes, decisions and action points of a meeting. */
const Minutes: React.FC<{ meetingId: string }> = ({ meetingId }) => {
  const { data, error, loading, reload } = useMeetingData<MinutesView>(`minutes?id=${encodeURIComponent(meetingId)}`);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<{ text: string; decisions: string; actions: ActionPoint[] }>({ text: '', decisions: '', actions: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (data) setF({ text: data.minutes.text, decisions: data.minutes.decisions, actions: data.minutes.actions }); }, [data]);
  if (loading && !data) return null;
  if (error) return <Problem error={error} onRetry={reload} />;
  if (!data) return null;
  const m = data.minutes;
  const empty = !m.text && !m.decisions && !m.actions.length;
  if (empty && !data.canEdit) return null;
  const save = async () => {
    setBusy(true);
    setErr('');
    try { await meetingApi('minutes', { id: meetingId, ...f }); setEdit(false); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const setAction = (i: number, patch: Partial<ActionPoint>) => setF({ ...f, actions: f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const input = 'w-full rounded-lg border border-line bg-paper px-3 py-2';
  return (
    <section className={`${card} space-y-4 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[1.125rem] font-semibold"><ListChecks className="h-5 w-5 text-navy" aria-hidden="true" /> Minutes and action points</h2>
        {data.canEdit && !edit && <button type="button" onClick={() => setEdit(true)} className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-navy"><Pencil className="h-4 w-4" aria-hidden="true" /> {empty ? 'Write the minutes' : 'Edit'}</button>}
      </div>
      {!edit ? (
        <>
          {m.text && <div><h3 className="font-semibold">Minutes</h3><p className="mt-1 whitespace-pre-wrap" dir="auto" data-i18n-skip="">{m.text}</p></div>}
          {m.decisions && <div><h3 className="font-semibold">Decisions</h3><p className="mt-1 whitespace-pre-wrap" dir="auto" data-i18n-skip="">{m.decisions}</p></div>}
          {m.actions.length > 0 && (
            <div>
              <h3 className="font-semibold">Action points</h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {m.actions.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1" dir="auto" data-i18n-skip="">{a.text}</span>
                    <span className="text-[0.875rem] text-ink-soft">{a.ownerName ? <span data-i18n-skip="" dir="auto">{a.ownerName}</span> : 'Unassigned'}{a.due ? ` · by ${a.due.split('-').reverse().join('/')}` : ''}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.8125rem] font-semibold ${a.status === 'done' ? 'bg-[#EAF6EF] text-[#1E6B47]' : a.status === 'in_progress' ? 'bg-amber-tint' : 'bg-stone'}`}>{ACTION_LABEL[a.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {m.updatedAt && <p className="text-[0.8125rem] text-muted">Last updated {new Date(m.updatedAt).toLocaleString('en-GB')} by <span data-i18n-skip="" dir="auto">{m.updatedByName}</span></p>}
          {empty && <p className="text-muted">No minutes yet.</p>}
        </>
      ) : (
        <div className="space-y-3">
          <label className="block font-semibold">Minutes<textarea rows={6} className={`mt-1 ${input}`} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} dir="auto" /></label>
          <label className="block font-semibold">Decisions<textarea rows={3} className={`mt-1 ${input}`} value={f.decisions} onChange={(e) => setF({ ...f, decisions: e.target.value })} dir="auto" /></label>
          <div>
            <p className="font-semibold">Action points</p>
            <ul className="mt-2 space-y-2">
              {f.actions.map((a, i) => (
                <li key={a.id || i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_11rem_9rem_8rem_auto]">
                  <input aria-label="Action" className={input} value={a.text} onChange={(e) => setAction(i, { text: e.target.value })} placeholder="What needs doing" dir="auto" />
                  <select aria-label="Who" className={input} value={a.owner} onChange={(e) => setAction(i, { owner: e.target.value, ownerName: data.people.find((p) => p.uid === e.target.value)?.name || '' })}>
                    <option value="">Unassigned</option>
                    {data.people.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
                  </select>
                  <input aria-label="Due date" type="date" className={input} value={a.due} onChange={(e) => setAction(i, { due: e.target.value })} />
                  <select aria-label="Status" className={input} value={a.status} onChange={(e) => setAction(i, { status: e.target.value as ActionPoint['status'] })}>
                    {(Object.keys(ACTION_LABEL) as ActionPoint['status'][]).map((st) => <option key={st} value={st}>{ACTION_LABEL[st]}</option>)}
                  </select>
                  <button type="button" aria-label="Remove action" className="cursor-pointer rounded px-2 text-crimson hover:bg-crimson/5" onClick={() => setF({ ...f, actions: f.actions.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-2 inline-flex cursor-pointer items-center gap-1.5 font-semibold text-navy" onClick={() => setF({ ...f, actions: [...f.actions, { id: '', text: '', owner: '', ownerName: '', due: '', status: 'open' }] })}><Plus className="h-4 w-4" aria-hidden="true" /> Add an action point</button>
          </div>
          <p className="text-[0.8125rem] text-muted">People given an action point are notified.</p>
          {err && <p role="alert" className="text-crimson">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(false)}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save minutes'}</Button></div>
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------- meeting

const MeetingView: React.FC<{ id: string; onNavigate: Props['onNavigate'] }> = ({ id, onNavigate }) => {
  const { data, error, loading, reload } = useMeetingData<MeetingDetail>(`meeting?id=${encodeURIComponent(id)}`);
  const [seat, setSeat] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');

  // While waiting for the start, check every 20 seconds.
  useEffect(() => {
    if (!data || seat || data.meeting.status !== 'scheduled') return undefined;
    const t = window.setInterval(reload, 20000);
    return () => window.clearInterval(t);
  }, [data, seat, reload]);

  const join = async () => {
    setJoining(true);
    setProblem('');
    try {
      const r = await meetingApi<{ seat: string }>('join', { id });
      setSeat(r.seat);
    } catch (e) {
      setProblem((e as Error).message);
      reload();
    } finally {
      setJoining(false);
    }
  };

  const left = (reason?: string) => {
    setSeat(null);
    setNotice(reason === 'ended' ? 'The meeting has ended.' : reason === 'removed' ? 'You were removed from this meeting by its leader.' : reason === 'denied' ? 'The leader did not admit you to this meeting.' : 'You left the meeting. You can rejoin while it is live.');
    reload();
  };

  if (loading && !data) return <Container className="py-10"><Loading /></Container>;
  if (error) return <Container className="py-10"><Problem error={error} onRetry={reload} /></Container>;
  if (!data) return null;
  const m = data.meeting;
  const host = data.me.host;
  const t = meetingTime(m.startAt);
  const canJoin = data.video && joinable(m, data.me.can.start);

  return (
    <>
      <PageHeader title={m.title} kicker={<><a href="/meetings">Online meetings</a> · <a href={`/meetings/room/${data.room.id}`}>{data.room.name}</a></>}>
        <StatusBadge m={m} />
      </PageHeader>
      <Container className="grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {notice && <p className="rounded-lg bg-navy-tint px-4 py-3" role="status">{notice}</p>}
          {problem && <p className="rounded-lg border border-crimson/40 px-4 py-3 text-crimson" role="alert">{problem}</p>}
          {m.status === 'cancelled' && <p className="rounded-lg bg-stone px-4 py-3">This meeting was cancelled.{m.cancelReason ? ` Reason: ${m.cancelReason}` : ''}</p>}
          {m.purpose && <p className="text-[1.125rem] text-ink-soft" dir="auto" data-i18n-skip="">{m.purpose}</p>}
          {m.agenda && (
            <section className={`${card} p-5`}>
              <h2 className="text-[1.125rem] font-semibold">Agenda</h2>
              <p className="mt-2 whitespace-pre-wrap" dir="auto" data-i18n-skip="">{m.agenda}</p>
            </section>
          )}
          {(m.status === 'ended' || m.status === 'live') && <Minutes meetingId={m.id} />}
          {m.status === 'ended' && data.me.can.attendance && (
            <section className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <h2 className="text-[1.125rem] font-semibold">Attendance</h2>
                <p className="text-ink-soft">{m.attendanceStatus === 'approved' ? `${m.attendedCount} of ${m.eligibleCount} attended. Confirmed.` : 'Review and confirm the attendance and absence lists. Points are awarded when you confirm.'}</p>
              </div>
              <Button onClick={() => onNavigate('meeting', `${m.id}/attendance`)}><ClipboardCheck className="h-5 w-5" aria-hidden="true" /> {m.attendanceStatus === 'approved' ? 'View lists' : 'Confirm attendance'}</Button>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <div className={`${card} space-y-3 p-5`}>
            <p className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /><span>{t.official}{t.local && <span className="block text-[0.875rem] text-muted">{t.local}</span>}</span></p>
            <p className="flex items-center gap-2"><Clock className="h-5 w-5 text-navy" aria-hidden="true" />{minutesText(m.durationMin)}</p>
            <p className="flex items-center gap-2"><Users className="h-5 w-5 text-navy" aria-hidden="true" />{m.invite === 'selected' ? 'Selected members' : `Everyone in ${data.room.name}`}</p>
            {data.leader.name && <p className="text-ink-soft">Leader: <span data-i18n-skip="" dir="auto">{data.leader.name}</span></p>}
            {m.locked && <p className="flex items-center gap-2 text-crimson"><Lock className="h-4 w-4" aria-hidden="true" /> Locked by the leader</p>}
            {data.live && <p className="text-ink-soft">{data.live.participants} in the meeting now</p>}
          </div>
          {(m.status === 'scheduled' || m.status === 'live') && (
            <div className={`${card} space-y-3 p-5`}>
              {!data.video ? <p className="text-ink-soft">Video meetings are being set up. Joining will be possible once the video service is connected.</p> : canJoin ? (
                <Button size="lg" className="w-full" disabled={joining} onClick={join}>
                  {joining ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : m.status === 'live' ? <Video className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
                  {m.status === 'live' ? 'Join the meeting' : 'Start the meeting'}
                </Button>
              ) : (
                <p className="text-ink-soft">{data.me.can.start ? 'You can start the meeting from one hour before its start time.' : 'You can join once the leader starts the meeting. You will be notified.'}</p>
              )}
              <p className="flex items-center gap-2 text-[0.9375rem]">{m.media === 'video' ? <Video className="h-4 w-4 text-navy" aria-hidden="true" /> : <Mic className="h-4 w-4 text-navy" aria-hidden="true" />}{m.media === 'video' ? 'Audio and video meeting' : 'Audio meeting (no cameras)'}</p>
              <p className="text-[0.8125rem] text-muted">Your camera and microphone are off when you join. Your browser will ask for permission the first time you turn them on. Meetings are not recorded: recording is not available in this meeting system.</p>
            </div>
          )}
          {host && m.status !== 'cancelled' && <p className="text-[0.875rem] text-muted">You are a host of this meeting ({ROLE_LABEL[data.me.role]}).</p>}
        </aside>
      </Container>
      {seat && (
        <Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#160C09] text-white"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></div>}>
          <MeetingCall meetingId={m.id} seat={seat} title={m.title} canLock={data.me.can.lock} canEnd={data.me.can.start} canRemove={data.me.can.remove} onLeave={left} />
        </Suspense>
      )}
    </>
  );
};

// ---------------------------------------------------------------- attendance

const STATUSES: AttendanceStatus[] = ['attended', 'late', 'absent', 'excused'];
const counts = (s: AttendanceStatus) => s === 'attended' || s === 'late';
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '—');

const AttendanceReview: React.FC<{ id: string }> = ({ id }) => {
  const { data, error, loading, reload } = useMeetingData<AttendanceView>(`attendance?id=${encodeURIComponent(id)}`);
  const [changes, setChanges] = useState<Record<string, { status: AttendanceStatus; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fix, setFix] = useState<{ uid: string; name: string; status: AttendanceStatus; reason: string } | null>(null);

  if (loading && !data) return <Container className="py-10"><Loading /></Container>;
  if (error) return <Container className="py-10"><Problem error={error} onRetry={reload} /></Container>;
  if (!data) return null;
  const approved = data.meeting.attendanceStatus === 'approved';
  const eligible = data.rows.filter((r) => r.eligible);
  const guests = data.rows.filter((r) => !r.eligible && r.minutes > 0);
  const statusOf = (uid: string, measured: AttendanceStatus) => changes[uid]?.status || measured;

  const listRows = approved
    ? data.confirmed.map((c) => ({ uid: c.uid, name: c.name, photoUrl: c.photoUrl, minutes: c.minutes, percent: c.percent, firstJoin: c.firstJoin, status: c.status, note: c.override?.reason || c.corrections?.at(-1)?.reason || '' }))
    : eligible.map((r) => ({ uid: r.uid, name: r.name, photoUrl: r.photoUrl, minutes: r.minutes, percent: r.percent, firstJoin: r.firstJoin, status: statusOf(r.uid, r.measured), note: changes[r.uid]?.reason || '' }));
  const present = listRows.filter((r) => counts(r.status));
  const absent = listRows.filter((r) => !counts(r.status));

  const confirm = async () => {
    const rows = Object.entries(changes).filter(([uid, c]) => c.status !== eligible.find((r) => r.uid === uid)?.measured).map(([uid, c]) => ({ uid, ...c }));
    if (rows.some((r) => r.reason.trim().length < 3)) { setMessage('Give a reason for every change you made.'); return; }
    if (!window.confirm(`Confirm ${present.length} attended and ${absent.length} absent? Points are awarded now.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const r = await meetingApi<{ attended: number; eligible: number }>('attendance', { id, rows });
      setMessage(`Confirmed: ${r.attended} of ${r.eligible} attended. Points have been updated.`);
      setChanges({});
      reload();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };

  const saveFix = async () => {
    if (!fix) return;
    setBusy(true);
    try {
      await meetingApi('correct', { id, uid: fix.uid, status: fix.status, reason: fix.reason });
      setMessage(`${fix.name}'s attendance was corrected and their points updated.`);
      setFix(null);
      reload();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };

  const Person: React.FC<{ r: (typeof listRows)[number] }> = ({ r }) => {
    const measured = eligible.find((x) => x.uid === r.uid)?.measured;
    const changed = !approved && changes[r.uid] && changes[r.uid].status !== measured;
    return (
      <li className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          {r.photoUrl ? <img src={r.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-stone" aria-hidden="true" />}
          <span className="min-w-0">
            <span className="block truncate font-semibold" data-i18n-skip="" dir="auto">{r.name}</span>
            <span className="block text-[0.8125rem] text-muted">{minutesText(r.minutes)} ({r.percent}%) · joined {clock(r.firstJoin)}{r.note ? ` · ${r.note}` : ''}</span>
          </span>
        </span>
        {approved ? (
          <span className="flex items-center gap-3">
            <span className="text-[0.9375rem]">{ATTENDANCE_LABEL[r.status]}</span>
            <button type="button" className="cursor-pointer text-[0.875rem] font-semibold text-navy underline" onClick={() => setFix({ uid: r.uid, name: r.name, status: r.status, reason: '' })}>Correct</button>
          </span>
        ) : (
          <span className="flex flex-col gap-1.5 sm:w-[300px]">
            <select aria-label={`Attendance for ${r.name}`} value={r.status} onChange={(e) => setChanges((c) => ({ ...c, [r.uid]: { status: e.target.value as AttendanceStatus, reason: c[r.uid]?.reason || '' } }))}
              className="rounded-lg border border-line bg-paper px-2 py-1.5">
              {STATUSES.map((s) => <option key={s} value={s}>{ATTENDANCE_LABEL[s]}{s === measured ? ' (measured)' : ''}</option>)}
            </select>
            {changed && <input placeholder="Reason for the change (required)" value={changes[r.uid].reason} onChange={(e) => setChanges((c) => ({ ...c, [r.uid]: { ...c[r.uid], reason: e.target.value } }))} className="rounded-lg border border-amber bg-paper px-2 py-1.5 text-[0.9375rem]" />}
          </span>
        )}
      </li>
    );
  };

  return (
    <>
      <PageHeader title={`Attendance: ${data.meeting.title}`} kicker={<><a href="/meetings">Online meetings</a> · <a href={`/meetings/${id}`}>Meeting</a></>}
        intro={`${data.room.name} · ${meetingTime(data.meeting.startedAt || data.meeting.startAt).official} · ${minutesText(data.length)} long. Present means at least ${data.needed} minutes (${data.settings.thresholdPercent}%); joining more than ${data.settings.lateMinutes} minutes after the start is marked late.`} />
      <Container className="space-y-8 py-10 sm:py-14">
        {message && <p className="rounded-lg bg-navy-tint px-4 py-3" role="status">{message}</p>}
        {!approved && <p className="text-ink-soft">These lists come from the time each person was actually connected to the meeting. Check them, change anyone who should be marked differently (for example an agreed, excused absence) with a reason, then confirm. Members who were not invited are never marked absent.</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`${card} p-5`}>
            <h2 className="text-[1.25rem] font-semibold">A. Participants ({present.length})</h2>
            <ul className="mt-2">{present.map((r) => <Person key={r.uid} r={r} />)}</ul>
          </section>
          <section className={`${card} p-5`}>
            <h2 className="text-[1.25rem] font-semibold">B. Absentees ({absent.length})</h2>
            <ul className="mt-2">{absent.map((r) => <Person key={r.uid} r={r} />)}</ul>
          </section>
        </div>
        {guests.length > 0 && <p className="text-[0.9375rem] text-muted">Also present (not counted for this room): {guests.map((g) => g.name).join(', ')}.</p>}
        {!approved && <Button size="lg" disabled={busy || data.meeting.status !== 'ended'} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm lists and award points'}</Button>}
        {data.meeting.status !== 'ended' && <p className="text-muted">End the meeting before confirming attendance.</p>}
        {fix && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Correct attendance">
            <div className={`${card} w-full max-w-md space-y-4 p-6`}>
              <h2 className="text-[1.25rem] font-semibold">Correct <span data-i18n-skip="" dir="auto">{fix.name}</span></h2>
              <select value={fix.status} onChange={(e) => setFix({ ...fix, status: e.target.value as AttendanceStatus })} className={field}>{STATUSES.map((s) => <option key={s} value={s}>{ATTENDANCE_LABEL[s]}</option>)}</select>
              <label className={label}>Reason (kept in the audit record)<input value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} className={field} /></label>
              <div className="flex gap-3"><Button disabled={busy || fix.reason.trim().length < 3} onClick={saveFix}>Save correction</Button><Button variant="secondary" onClick={() => setFix(null)}>Cancel</Button></div>
            </div>
          </div>
        )}
      </Container>
    </>
  );
};

// ---------------------------------------------------------------- activity participation

interface ParticipationData {
  activity: { id: string; title: string; date: string; location: string; councilId: string };
  people: { uid: string; name: string; photoUrl: string; chapterId: string; registered: string }[];
  entries: { uid: string; status: 'attended' | 'not_attended' | 'excused'; note?: string; review: string; reviewNote?: string }[];
}
const ENTRY_LABEL = { attended: 'Took part', not_attended: 'Did not take part', excused: 'Excused' } as const;
const REVIEW_LABEL: Record<string, string> = { draft: 'Saved, not submitted', pending: 'Submitted, waiting for approval', approved: 'Approved', rejected: 'Rejected', returned: 'Returned for correction' };

const ActivityList: React.FC = () => {
  const { data, error, loading, reload } = useMeetingData<{ activities: { id: string; title: string; date: string }[] }>('my-activities');
  return (
    <>
      <PageHeader title="Activity participation" kicker={<a href="/meetings">Online meetings</a>} intro="After an official activity, record which members of your council actually took part. Approved participants receive a Letter of Appreciation. This is separate from meeting attendance." />
      <Container className="py-10 sm:py-14">
        {loading && !data && <Loading />}
        <Problem error={error} onRetry={reload} />
        {data && (data.activities.length ? (
          <ul className="space-y-3">{data.activities.map((a) => (
            <li key={a.id}><a href={`/meetings/participation/${a.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 no-underline hover:border-navy">
              <span><span className="block font-semibold text-ink" dir="auto">{a.title}</span><span className="text-[0.9375rem] text-ink-soft">{meetingTime(a.date).official}</span></span>
              <ChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
            </a></li>
          ))}</ul>
        ) : <EmptyState title="No activities to record" body="Activities you are responsible for appear here once they have taken place (they are announced under Breaking News banner in Administration)." />)}
      </Container>
    </>
  );
};

const ParticipationForm: React.FC<{ id: string }> = ({ id }) => {
  const { chapters } = useData();
  const { data, error, loading, reload } = useMeetingData<ParticipationData>(`participation?activityId=${encodeURIComponent(id)}`);
  const [marks, setMarks] = useState<Record<string, { status: 'attended' | 'not_attended' | 'excused'; note: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!data) return;
    setMarks(Object.fromEntries(data.people.map((p) => {
      const e = data.entries.find((x) => x.uid === p.uid);
      return [p.uid, { status: e?.status || (p.registered === 'attending' ? 'attended' : 'not_attended'), note: e?.note || '' }];
    })));
  }, [data]);
  if (loading && !data) return <Container className="py-10"><Loading /></Container>;
  if (error) return <Container className="py-10"><Problem error={error} onRetry={reload} /></Container>;
  if (!data) return null;
  const save = async (submit: boolean) => {
    if (submit && !window.confirm('Submit this list to the administrators for approval? Approved participants will receive Letters of Appreciation.')) return;
    setBusy(true);
    setMessage('');
    try {
      const entries = Object.entries(marks).map(([uid, m]) => ({ uid, ...m }));
      await meetingApi('participation', { activityId: id, entries, submit });
      setMessage(submit ? 'Submitted. The administrators have been asked to review it.' : 'Saved. Submit it when you are ready.');
      reload();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const chapterName = (cid: string) => chapters.find((c) => c.id === cid)?.name || '';
  const took = Object.values(marks).filter((m) => m.status === 'attended').length;
  return (
    <>
      <PageHeader title={data.activity.title} kicker={<><a href="/meetings">Online meetings</a> · <a href="/meetings/participation">Activity participation</a></>} intro={`${data.activity.date ? meetingTime(data.activity.date).official : ''}${data.activity.location ? ` · ${data.activity.location}` : ''}`} />
      <Container className="space-y-6 py-10 sm:py-14">
        <p className="text-ink-soft">Mark only the members who actually took part. Their answer to “Will you attend?” is shown as a guide; attending an online preparation meeting does not count. {took} marked as taking part.</p>
        {message && <p className="rounded-lg bg-navy-tint px-4 py-3" role="status">{message}</p>}
        <ul className={`${card} divide-y divide-line px-5`}>
          {data.people.map((p) => {
            const e = data.entries.find((x) => x.uid === p.uid);
            const locked = e?.review === 'approved' || e?.review === 'pending';
            return (
              <li key={p.uid} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-stone" aria-hidden="true" />}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold" data-i18n-skip="" dir="auto">{p.name}</span>
                    <span className="block text-[0.8125rem] text-muted">{chapterName(p.chapterId)}{p.registered ? ` · said ${p.registered === 'attending' ? 'they would attend' : 'they could not attend'}` : ''}{e ? ` · ${REVIEW_LABEL[e.review] || e.review}` : ''}{e?.reviewNote ? `: ${e.reviewNote}` : ''}</span>
                  </span>
                </span>
                <select aria-label={`Participation of ${p.name}`} disabled={locked} value={marks[p.uid]?.status || 'not_attended'} onChange={(ev) => setMarks((m) => ({ ...m, [p.uid]: { ...m[p.uid], status: ev.target.value as 'attended' } }))} className="rounded-lg border border-line bg-paper px-2 py-1.5 sm:w-56">
                  {(Object.keys(ENTRY_LABEL) as (keyof typeof ENTRY_LABEL)[]).map((k) => <option key={k} value={k}>{ENTRY_LABEL[k]}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => save(true)}>Submit for approval</Button>
          <Button variant="secondary" disabled={busy} onClick={() => save(false)}>Save without submitting</Button>
        </div>
      </Container>
    </>
  );
};

// ---------------------------------------------------------------- page

export const MeetingsPage: React.FC<Props> = ({ param, onNavigate, onOpenAuth }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <Container className="py-10"><Loading /></Container>;
  if (!currentUser) {
    return (
      <>
        <PageHeader title="Online meetings" intro="Private meeting rooms for members of Mashkhally Zhyanawa. Please sign in with your member account." />
        <Container className="py-12"><EmptyState title="Members only" body="Online meetings are open only to approved members, in the rooms of their own council or group." action={<Button onClick={onOpenAuth}>Sign in</Button>} /></Container>
      </>
    );
  }
  const parts = (param || '').split('?')[0].split('/').filter(Boolean);
  if (parts[0] === 'participation') return parts[1] ? <ParticipationForm key={parts[1]} id={parts[1]} /> : <ActivityList />;
  if (parts[0] === 'room' && parts[1]) return <RoomView key={parts[1]} id={parts[1]} />;
  if (parts[0] && parts[1] === 'attendance') return <AttendanceReview key={parts[0]} id={parts[0]} />;
  if (parts[0]) return <MeetingView key={parts[0]} id={parts[0]} onNavigate={onNavigate} />;
  return <Hub onNavigate={onNavigate} />;
};

export default MeetingsPage;
