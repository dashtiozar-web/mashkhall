import React, { useEffect, useMemo, useState } from 'react';
import { doc } from 'firebase/firestore';
import { CheckCircle2, CircleAlert, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { db, safeSetDoc } from '../firebase';
import { Button } from '../components/ui';
import { meetingApi, Meeting, Permission, PERMISSION_LABEL, STATUS_LABEL, useMeetingData } from '../lib/meetings';
import { positionTitle } from '../lib/positions';
import { useData } from '../context/DataContext';
import { MeetingPostsAdmin, MeetingPost } from './MeetingPostsAdmin';
import { SetupStatus } from '../components/SetupStatus';

/**
 * Administration > Online meetings: video service status, meeting rules,
 * every room with its leader, moderators and who may enter, an access
 * check, every meeting, and the audit record.
 */

interface AdminRoom {
  id: string; kind: string; name: string; chapterId?: string; leaderUid: string | null; leaderName: string; leaderChosen: boolean;
  leaderSuspended: boolean; leaderPermissions: Record<Permission, boolean>; eligible: number;
  members: string[]; excluded: string[]; moderators: string[]; managers?: string[];
}
interface AccessReport {
  member: { uid: string; name: string; status: string; positions: string[]; chapterId: string };
  rooms: { id: string; name: string; kind: string; allowed: boolean; host: boolean; role: string | null; why: string[] }[];
}
interface AuditRow { id: string; at: string; uid: string; name: string; action: string; ok: boolean; meetingId?: string; roomId?: string; detail?: string }
interface AdminData {
  rooms: AdminRoom[];
  meetings: Meeting[];
  audit: AuditRow[];
  posts: MeetingPost[];
  candidates: { uid: string; name: string; chapterId: string; positionId: string }[];
  settings: { thresholdPercent: number; lateMinutes: number; reminders: number[]; defaultWaitingRoom: string; defaultSpeaking: string; defaultMedia?: string };
  setup: { database: boolean; video: boolean; turn: boolean };
}

const box = 'rounded-2xl border border-line bg-surface p-5 sm:p-6';
const field = 'mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2';
const PERMS = Object.keys(PERMISSION_LABEL) as Permission[];

const ACTION_LABEL: Record<string, string> = {
  scheduled: 'Scheduled a meeting', rescheduled: 'Moved a meeting', edited: 'Changed a meeting', cancelled: 'Cancelled a meeting', started: 'Started a meeting',
  ended: 'Ended a meeting', joined: 'Joined a meeting', locked: 'Locked a meeting', unlocked: 'Unlocked a meeting', removed_participant: 'Removed a participant',
  access_checked: 'Checked a member’s access', minutes_saved: 'Saved minutes', minutes_refused: 'Refused: minutes', notice_posted: 'Posted a notice', notice_deleted: 'Deleted a notice',
  attendance_confirmed: 'Confirmed attendance', attendance_corrected: 'Corrected attendance', room_settings: 'Changed room settings',
  join_refused: 'Refused entry', view_refused: 'Refused access', room_refused: 'Refused access to a room', schedule_refused: 'Refused: scheduling',
  start_refused: 'Refused: starting', attendance_refused: 'Refused: attendance', remove_refused: 'Refused: removing', lock_refused: 'Refused: locking',
  post_published: 'Published an activity post', post_dismissed: 'Dismissed an activity post',
};

const SetupGuide: React.FC<{ setup: AdminData['setup'] | null; error?: string }> = ({ setup, error }) => {
  const Step: React.FC<{ done: boolean; title: string; children: React.ReactNode }> = ({ done, title, children }) => (
    <li className="flex gap-3">
      {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2FA36B]" aria-label="Done" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-label="To do" />}
      <div><p className="font-semibold">{title}</p><div className="mt-1 space-y-1 text-[0.9375rem] text-ink-soft">{children}</div></div>
    </li>
  );
  return (
    <section className={box}>
      <h2 className="text-[1.375rem] font-semibold">Set-up</h2>
      {error && <p className="mt-2 text-crimson">{error}</p>}
      <ol className="mt-4 space-y-5">
        <Step done={Boolean(setup?.database)} title="1. Firebase service account (lets the server record attendance and points)">
          <p>Firebase console › Project settings › Service accounts › “Generate new private key”. Then Cloudflare dashboard › Workers › mashkhall › Settings › Variables and secrets › Add › type “Secret”, name <code>FIREBASE_SERVICE_ACCOUNT</code>, and paste the whole contents of the downloaded file.</p>
        </Step>
        <Step done={Boolean(setup?.video)} title="2. Cloudflare Realtime video (free up to 1,000 GB a month)">
          <p>Cloudflare dashboard › Realtime › SFU › Create application. Add its App ID and token as secrets <code>SFU_APP_ID</code> and <code>SFU_APP_TOKEN</code>.</p>
        </Step>
        <Step done={Boolean(setup?.turn)} title="3. Recommended: TURN, for members on strict networks">
          <p>Cloudflare dashboard › Realtime › TURN Server › Create. Add its Key ID and API token as secrets <code>TURN_KEY_ID</code> and <code>TURN_KEY_API_TOKEN</code>.</p>
        </Step>
      </ol>
      <div className="mt-5 border-t border-line pt-4"><SetupStatus /></div>
      <p className="mt-4 text-[0.875rem] text-muted">Secrets take effect within a minute. Cloudflare charges $0.05 per GB above the free 1,000 GB each month; typical use by our councils is well below that.</p>
    </section>
  );
};

export const MeetingsAdmin: React.FC = () => {
  const { data, error, loading, reload } = useMeetingData<AdminData>('admin');
  const { chapters } = useData();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [settings, setSettings] = useState<AdminData['settings'] | null>(null);
  const [auditFilter, setAuditFilter] = useState('');
  useEffect(() => { if (data) { setRooms(data.rooms); setSettings(data.settings); } }, [data]);
  const chapterName = (id: string) => chapters.find((c) => c.id === id)?.name || '';
  const roomName = (id?: string) => data?.rooms.find((r) => r.id === id)?.name || id || '';

  const audit = useMemo(() => (data?.audit || []).filter((a) => !auditFilter || a.roomId === auditFilter || (auditFilter === 'refused' && !a.ok)), [data, auditFilter]);

  if (loading && !data) return <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p>;
  if (error && !data) {
    return (
      <div className="space-y-6">
        <SetupGuide setup={error.setup ? { database: false, video: false, turn: false } : null} error={error.message} />
        <Button variant="secondary" onClick={reload}>Check again</Button>
      </div>
    );
  }
  if (!data || !settings) return null;

  const saveRoom = async (r: AdminRoom) => {
    setBusy(r.id);
    setMessage('');
    try {
      await meetingApi('room-settings', { roomId: r.id, leaderUid: r.leaderChosen ? r.leaderUid : null, leaderSuspended: r.leaderSuspended, leaderPermissions: r.leaderPermissions, members: r.members, excluded: r.excluded, moderators: r.moderators });
      setMessage(`${r.name}: saved.`);
      reload();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };
  const editRoom = (id: string, patch: Partial<AdminRoom>) => setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('settings');
    try {
      await safeSetDoc(doc(db, 'site_settings', 'meetings'), { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
      setMessage('Meeting rules saved.');
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.625rem] font-semibold">Online meetings</h2>
          <p className="text-ink-soft">A private room for each council, the Board, the Board and Council Leaders, Research and Investigation, the Production Team and Website Administration.</p>
        </div>
        <div className="flex gap-2">
          <a href="/meetings" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-semibold no-underline">Open meetings <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
          <Button variant="secondary" onClick={reload}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button>
        </div>
      </div>
      {message && <p className="rounded-lg bg-navy-tint px-4 py-3" role="status">{message}</p>}

      {(!data.setup.video || !data.setup.turn) && <SetupGuide setup={data.setup} />}

      <MeetingPostsAdmin posts={data.posts} onChanged={reload} />

      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">Rooms and leaders</h2>
        <p className="mt-1 text-ink-soft">Who may enter is decided by the server from each person’s verified account: council rooms are for that council’s members; the Board room for Board positions; the joint room for the Board and Council Leaders; Production for the production team and the Head of Media; Website Administration for its five positions; Research and Investigation only for the Research Manager and the people you add. The President, Deputy President and administrators can enter every room. Anyone else needs to be added below.</p>
        <p className="mt-2 text-ink-soft">Default leaders: each council’s Head of Online Meeting Management (or Council Leader), the President for the Board, the Representative of Council Leaders for the joint room, and the head of each team. A council’s Council Leader also runs its meetings. Moderators get the same rights as the leader.</p>
        <div className="mt-5 space-y-5">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[1.125rem] font-semibold">{r.name}</h3>
                <span className="text-[0.875rem] text-muted">{r.eligible} eligible members</span>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="space-y-3">
                  <label className="block text-[0.9375rem] font-semibold">Meeting leader
                    <select className={field} value={r.leaderChosen ? r.leaderUid || '' : ''} onChange={(e) => editRoom(r.id, { leaderUid: e.target.value || null, leaderChosen: Boolean(e.target.value) })}>
                      <option value="">Default{!r.leaderChosen && r.leaderName ? ` (${r.leaderName})` : ' (none found)'}</option>
                      {data.candidates.map((c) => <option key={c.uid} value={c.uid}>{c.name} · {positionTitle(c.positionId)}{c.chapterId ? `, ${chapterName(c.chapterId)}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[0.9375rem]"><input type="checkbox" checked={r.leaderSuspended} onChange={(e) => editRoom(r.id, { leaderSuspended: e.target.checked })} /> Suspend the leader’s management rights</label>
                </div>
                <fieldset>
                  <legend className="text-[0.9375rem] font-semibold">The leader may</legend>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {PERMS.map((p) => (
                      <label key={p} className="flex items-start gap-2 text-[0.875rem]">
                        <input type="checkbox" className="mt-1" checked={r.leaderPermissions[p]} disabled={r.leaderSuspended} onChange={(e) => editRoom(r.id, { leaderPermissions: { ...r.leaderPermissions, [p]: e.target.checked } })} />
                        {PERMISSION_LABEL[p]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <PeoplePicker label="Moderators" hint="Run meetings with the leader." people={data.candidates} value={r.moderators} onChange={(v) => editRoom(r.id, { moderators: v })} />
                <PeoplePicker label="Also allowed in" hint="People outside the group given access." people={data.candidates} value={r.members} onChange={(v) => editRoom(r.id, { members: v, excluded: r.excluded.filter((x) => !v.includes(x)) })} />
                <PeoplePicker label="Removed from this room" hint="Refused even if their position allows it." people={data.candidates} value={r.excluded} onChange={(v) => editRoom(r.id, { excluded: v, members: r.members.filter((x) => !v.includes(x)) })} />
              </div>
              <Button className="mt-3" disabled={busy === r.id} onClick={() => saveRoom(r)}>{busy === r.id ? 'Saving…' : 'Save'}</Button>
            </div>
          ))}
        </div>
      </section>

      <AccessCheck people={data.candidates} />

      <form onSubmit={saveSettings} className={box}>
        <h2 className="text-[1.375rem] font-semibold">Meeting rules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block font-semibold">Attendance threshold (% of the meeting)
            <input type="number" min={10} max={100} className={field} value={settings.thresholdPercent} onChange={(e) => setSettings({ ...settings, thresholdPercent: Number(e.target.value) })} />
          </label>
          <label className="block font-semibold">Late after (minutes from the start)
            <input type="number" min={0} max={120} className={field} value={settings.lateMinutes} onChange={(e) => setSettings({ ...settings, lateMinutes: Number(e.target.value) })} />
          </label>
          <label className="block font-semibold sm:col-span-2">Reminders (minutes before, separated by commas)
            <input className={field} value={settings.reminders.join(', ')} onChange={(e) => setSettings({ ...settings, reminders: e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0) })} />
            <span className="text-[0.875rem] font-normal text-muted">1440 = 24 hours. Reminders appear in members’ notifications on the website.</span>
          </label>
          <label className="block font-semibold">Default waiting room
            <select className={field} value={settings.defaultWaitingRoom} onChange={(e) => setSettings({ ...settings, defaultWaitingRoom: e.target.value })}>
              <option value="host">Wait until the leader joins</option><option value="approve">Leader lets each person in</option><option value="off">No waiting room</option>
            </select>
          </label>
          <label className="block font-semibold">Default call type
            <select className={field} value={settings.defaultMedia || 'audio'} onChange={(e) => setSettings({ ...settings, defaultMedia: e.target.value })}>
              <option value="audio">Audio only</option><option value="video">Audio and video</option>
            </select>
          </label>
          <label className="block font-semibold">Default speaking
            <select className={field} value={settings.defaultSpeaking} onChange={(e) => setSettings({ ...settings, defaultSpeaking: e.target.value })}>
              <option value="open">Members can unmute themselves</option><option value="controlled">Leader gives permission</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-[0.875rem] text-muted">Points are fixed by the organisation: 30 per meeting attended, 10 extra for three in a row, minus 15 for two missed in a row (once per run).</p>
        <Button type="submit" className="mt-4" disabled={busy === 'settings'}>Save rules</Button>
      </form>

      <section className={box}>
        <h2 className="text-[1.375rem] font-semibold">All meetings</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[0.9375rem]">
            <thead><tr className="border-b border-line text-start text-muted"><th className="py-2 text-start">Meeting</th><th className="text-start">Room</th><th className="text-start">When (UK)</th><th className="text-start">Status</th><th className="text-start">Attendance</th></tr></thead>
            <tbody>
              {data.meetings.map((m) => (
                <tr key={m.id} className="border-b border-line">
                  <td className="py-2"><a href={`/meetings/${m.id}`} data-i18n-skip="" dir="auto">{m.title}</a></td>
                  <td>{roomName(m.roomId)}</td>
                  <td>{new Date(m.startAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })}</td>
                  <td>{STATUS_LABEL[m.status]}</td>
                  <td>{m.attendanceStatus === 'approved' ? <a href={`/meetings/${m.id}/attendance`}>{m.attendedCount} of {m.eligibleCount}</a> : m.status === 'ended' ? <a href={`/meetings/${m.id}/attendance`}>To confirm</a> : '—'}</td>
                </tr>
              ))}
              {!data.meetings.length && <tr><td colSpan={5} className="py-4 text-muted">No meetings yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.375rem] font-semibold">Audit record</h2>
          <select className="rounded-lg border border-line bg-paper px-3 py-2" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} aria-label="Filter the audit record">
            <option value="">Everything</option><option value="refused">Refused access only</option>
            {data.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <ul className="mt-3 divide-y divide-line text-[0.9375rem]">
          {audit.slice(0, 200).map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
              <span className="shrink-0 text-muted sm:w-40">{new Date(a.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className={a.ok ? '' : 'text-crimson'}><strong data-i18n-skip="" dir="auto">{a.name || a.uid}</strong> · {ACTION_LABEL[a.action] || a.action}{a.roomId ? ` · ${roomName(a.roomId)}` : ''}{a.detail ? ` · ${a.detail}` : ''}</span>
            </li>
          ))}
          {!audit.length && <li className="py-3 text-muted">Nothing recorded yet.</li>}
        </ul>
      </section>
    </div>
  );
};

type Person = { uid: string; name: string; chapterId: string; positionId: string };

/** Choose members for a list (moderators, added, removed). */
const PeoplePicker: React.FC<{ label: string; hint: string; people: Person[]; value: string[]; onChange: (v: string[]) => void }> = ({ label, hint, people, value, onChange }) => {
  const name = (uid: string) => people.find((p) => p.uid === uid)?.name || uid;
  return (
    <div>
      <p className="text-[0.9375rem] font-semibold">{label}</p>
      <p className="text-[0.8125rem] text-muted">{hint}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {value.map((uid) => (
          <li key={uid} className="inline-flex items-center gap-1 rounded-full bg-navy-tint px-2.5 py-1 text-[0.875rem]">
            <span data-i18n-skip="" dir="auto">{name(uid)}</span>
            <button type="button" className="cursor-pointer rounded-full px-1 font-bold text-muted hover:text-crimson" aria-label={`Remove ${name(uid)}`} onClick={() => onChange(value.filter((x) => x !== uid))}>×</button>
          </li>
        ))}
        {!value.length && <li className="text-[0.875rem] text-muted">Nobody</li>}
      </ul>
      <select className={field} value="" aria-label={`Add to ${label}`} onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }}>
        <option value="">Add a member…</option>
        {people.filter((p) => !value.includes(p.uid)).map((p) => <option key={p.uid} value={p.uid}>{p.name} · {positionTitle(p.positionId)}</option>)}
      </select>
    </div>
  );
};

/** Why a member can or cannot enter each room: for investigating access problems. */
const AccessCheck: React.FC<{ people: Person[] }> = ({ people }) => {
  const [uid, setUid] = useState('');
  const [report, setReport] = useState<AccessReport | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async (id: string) => {
    setUid(id); setReport(null); setErr('');
    if (!id) return;
    setBusy(true);
    try { setReport(await meetingApi<AccessReport>(`access-check?uid=${encodeURIComponent(id)}`)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className={box}>
      <h2 className="text-[1.375rem] font-semibold">Check a member’s access</h2>
      <p className="mt-1 text-ink-soft">Choose a member to see which rooms they can enter and why. Use this when someone reports they cannot join.</p>
      <select className={`${field} max-w-md`} value={uid} onChange={(e) => check(e.target.value)} aria-label="Member to check">
        <option value="">Choose a member…</option>
        {people.map((p) => <option key={p.uid} value={p.uid}>{p.name} · {positionTitle(p.positionId)}</option>)}
      </select>
      {busy && <p className="mt-3 flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…</p>}
      {err && <p className="mt-3 text-crimson" role="alert">{err}</p>}
      {report && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[0.9375rem]">
            <thead><tr className="border-b border-line text-muted"><th className="py-2 text-start">Room</th><th className="text-start">Can enter</th><th className="text-start">Why</th></tr></thead>
            <tbody>
              {report.rooms.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="py-2 font-semibold">{r.name}</td>
                  <td className={r.allowed ? 'text-[#1F7A4D]' : 'text-crimson'}>{r.allowed ? (r.host ? 'Yes, can manage' : 'Yes') : 'No'}</td>
                  <td>{r.why.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
