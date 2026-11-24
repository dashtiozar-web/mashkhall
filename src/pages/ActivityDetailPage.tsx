import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { CalendarDays, CheckCircle2, MapPin, Users, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button, Container, TextLink } from '../components/ui';
import { ActivityRegistration, AttendanceResponse, NewsBanner } from '../types';
import { formatEventDate } from '../lib/newsBanner';
import { canRegister, cancelRegistration, councilSummary, recordActivityView, respondToActivity, responseOf, useMyRegistration, useRegistrations } from '../lib/activities';
import { useData } from '../context/DataContext';
import { MediaImage } from '../components/MediaImage';
import { SharePanel } from '../components/SharePanel';
import { Comments } from '../components/Comments';
import { Initials } from '../components/PersonCard';
import { toPath } from '../lib/router';
import { VideoPlayer } from '../components/VideoEmbed';

interface ActivityDetailPageProps {
  id: string;
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

/** One announced activity: details, members' answers (attending / cannot attend) and totals by council. */
export const ActivityDetailPage: React.FC<ActivityDetailPageProps> = ({ id, onNavigate, onOpenAuth }) => {
  const { currentUser, isMember } = useAuth();
  const [banner, setBanner] = useState<NewsBanner | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const mine = useMyRegistration(banner?.id, currentUser?.uid);
  const rows = useRegistrations(banner?.id);
  const { chapters } = useData();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (mine?.note) setNote(mine.note); }, [mine?.note]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setState('loading');
    return onSnapshot(
      doc(db, 'news_banners', id),
      (snap) => {
        if (!snap.exists()) { setState('missing'); return; }
        const b = { ...(snap.data() as NewsBanner), id: snap.id };
        if (b.status !== 'published' || b.mode !== 'announcement') { setState('missing'); return; }
        setBanner(b);
        setState('ready');
      },
      () => setState('missing'),
    );
  }, [id]);

  useEffect(() => {
    if (state === 'ready') recordActivityView(id);
  }, [state, id, currentUser?.uid]);

  if (state === 'loading') return <Container narrow className="py-24 text-center text-muted">Loading…</Container>;
  if (state === 'missing' || !banner) {
    return (
      <Container narrow className="py-24">
        <h1 className="text-[2.25rem] font-semibold">This activity isn’t available</h1>
        <p className="mt-4 text-ink-soft">It may have finished or been removed.</p>
        <Button className="mt-8" onClick={() => onNavigate('activities')}>See our activities</Button>
      </Container>
    );
  }

  const open = canRegister(banner);
  const past = Boolean(banner.eventAt && banner.eventAt <= new Date().toISOString());
  const count = banner.attendeeCount || 0;

  const myResponse = responseOf(mine);
  const respond = async (status: AttendanceResponse) => {
    setBusy(true);
    setMsg(null);
    try {
      await respondToActivity(banner, status, note);
      setMsg({ ok: true, text: status === 'attending' ? 'Thank you. You’re on the attending list.' : 'Thank you for letting us know. You’re on the “cannot attend” list.' });
    } catch (e) {
      const text = e instanceof Error ? e.message : '';
      setMsg({ ok: false, text: /permission/i.test(text) ? 'Your answer could not be saved. Responses may have closed; please refresh the page.' : text || 'Your answer could not be saved. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!window.confirm('Remove your answer for this activity?')) return;
    setBusy(true);
    setMsg(null);
    try {
      await cancelRegistration(banner.id);
      setMsg({ ok: true, text: 'Your answer has been removed.' });
    } catch {
      setMsg({ ok: false, text: 'Could not remove your answer. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const councilName = (cid?: string) => (cid ? chapters.find((c) => c.id === cid)?.name || cid : 'No council');
  const attending = (rows || []).filter((r) => responseOf(r) === 'attending').sort((a, b) => a.name.localeCompare(b.name));
  const notAttending = (rows || []).filter((r) => responseOf(r) === 'not_attending').sort((a, b) => a.name.localeCompare(b.name));
  const summary = councilSummary(rows || []);
  const maxAttending = Math.max(1, ...summary.map((c) => c.attending));

  const PersonRow: React.FC<{ r: ActivityRegistration }> = ({ r }) => (
    <li className="flex items-center gap-3 py-2.5">
      {r.photoUrl ? (
        <MediaImage src={r.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" loading="lazy" />
      ) : (
        <span className="shrink-0 overflow-hidden rounded-full"><Initials name={r.name} size={40} /></span>
      )}
      <span className="min-w-0">
        <a href={`/people/${encodeURIComponent(r.userId)}`} className="block truncate font-semibold text-ink hover:underline">{r.name}</a>
        <span className="block truncate text-[0.875rem] text-muted">{r.chapterId ? `${councilName(r.chapterId)} Council` : 'No council'}{r.attended ? ' · attended ✓' : ''}</span>
      </span>
    </li>
  );

  return (
    <Container narrow className="py-12 sm:py-16">
      <TextLink onClick={() => onNavigate('activities')} className="text-[0.9375rem]">Our activities</TextLink>
      <p className="mt-8 text-[0.9375rem] font-semibold text-navy">{past ? 'Past activity' : 'Upcoming activity'}</p>
      <h1 dir="auto" className="mt-2 text-[2.25rem] leading-tight font-semibold sm:text-[2.75rem]">{banner.message}</h1>

      <dl className="mt-6 grid gap-3 text-[1.0625rem] sm:grid-cols-3">
        {banner.eventAt && (
          <div className="flex items-start gap-2"><CalendarDays className="mt-1 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /><div><dt className="sr-only">When</dt><dd>{formatEventDate(banner.eventAt)}</dd></div></div>
        )}
        {banner.location && (
          <div className="flex items-start gap-2"><MapPin className="mt-1 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /><div><dt className="sr-only">Where</dt><dd dir="auto">{banner.location}</dd></div></div>
        )}
        <div className="flex items-start gap-2"><Users className="mt-1 h-5 w-5 shrink-0 text-navy" aria-hidden="true" /><div><dt className="sr-only">Attending</dt><dd>{rows ? attending.length : count} attending · {rows ? notAttending.length : 0} can’t attend</dd></div></div>
      </dl>

      {banner.videoUrl && <VideoPlayer url={banner.videoUrl} title={`Video: ${banner.message}`} className="mt-10" />}

      {banner.details && (
        <div className="prose-article mt-10 border-t border-line pt-8" dir="auto" data-i18n-skip="">
          {banner.details.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
      )}
      {banner.linkUrl && (
        <p className="mt-6"><a href={toPath(banner.linkUrl)} {...(/^https?:/.test(banner.linkUrl) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="font-semibold text-navy underline underline-offset-4">More information</a></p>
      )}

      <section aria-labelledby="register-heading" className="mt-10 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 id="register-heading" className="text-[1.5rem] font-semibold">Will you attend?</h2>
        {!open && !myResponse ? (
          <p className="mt-2 text-ink-soft">{past ? 'This activity has taken place.' : 'Responses are closed for this activity.'}</p>
        ) : !currentUser ? (
          <>
            <p className="mt-2 text-ink-soft">Members tell the organisers whether they can come, so we know how many people to expect.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={onOpenAuth}>Sign in to answer</Button>
              <Button variant="secondary" onClick={() => onNavigate('apply')}>Become a member</Button>
            </div>
          </>
        ) : !isMember ? (
          <p className="mt-2 text-ink-soft">Responses are for approved members. <TextLink onClick={() => onNavigate('apply')}>Apply to become a member</TextLink>.</p>
        ) : mine === undefined ? (
          <p className="mt-2 text-muted">Checking…</p>
        ) : (
          <>
            {myResponse && (
              <p className={`mt-3 flex items-center gap-2 text-[1.0625rem] font-semibold ${myResponse === 'attending' ? 'text-navy' : 'text-ink-soft'}`}>
                {myResponse === 'attending' ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <XCircle className="h-6 w-6" aria-hidden="true" />}
                Your answer: {myResponse === 'attending' ? 'Attending' : 'Cannot attend'}
              </p>
            )}
            {open && (
              <>
                <label className="mt-4 block text-[0.9375rem] font-semibold">
                  Note for the organisers <span className="font-normal text-muted">(optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="For example: I’m bringing one guest" className="mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-normal focus:border-navy focus:outline-none" />
                </label>
                <div className="mt-5 flex flex-wrap gap-3" role="group" aria-label="Your answer">
                  <button type="button" disabled={busy} aria-pressed={myResponse === 'attending'} onClick={() => respond('attending')}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-6 py-3 font-semibold disabled:opacity-50 ${myResponse === 'attending' ? 'bg-navy text-white' : 'border-2 border-navy text-navy hover:bg-navy-tint'}`}>
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Attending
                  </button>
                  <button type="button" disabled={busy} aria-pressed={myResponse === 'not_attending'} onClick={() => respond('not_attending')}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-6 py-3 font-semibold disabled:opacity-50 ${myResponse === 'not_attending' ? 'bg-ink text-paper' : 'border-2 border-line text-ink-soft hover:border-ink/40'}`}>
                    <XCircle className="h-5 w-5" aria-hidden="true" /> Cannot attend
                  </button>
                  {myResponse && <button type="button" disabled={busy} onClick={withdraw} className="cursor-pointer px-3 text-[0.9375rem] font-semibold text-ink-soft underline underline-offset-4">Remove my answer</button>}
                </div>
                <p className="mt-3 text-[0.875rem] text-muted">Your name, photo and council are shown in the lists below. Members who attend earn 10 points once an organiser confirms their attendance.</p>
              </>
            )}
          </>
        )}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg px-4 py-3 ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
      </section>

      <div className="mt-10"><SharePanel targetType="activity" targetId={banner.id} title={banner.message} /></div>

      <section aria-labelledby="who-heading" className="mt-10">
        <h2 id="who-heading" className="text-[1.5rem] font-semibold">Who’s coming</h2>
        {rows === null ? (
          <p className="mt-3 text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-center text-muted">No responses yet. Be the first to answer.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="rounded-2xl bg-navy-tint p-4"><span className="block font-serif text-[2rem] leading-none font-semibold tabular-nums text-navy">{attending.length}</span><span className="text-ink-soft">attending</span></p>
              <p className="rounded-2xl bg-stone p-4"><span className="block font-serif text-[2rem] leading-none font-semibold tabular-nums">{notAttending.length}</span><span className="text-ink-soft">cannot attend</span></p>
            </div>

            <h3 className="mt-8 text-[1.125rem] font-semibold">By council</h3>
            <ul className="mt-3 space-y-2">
              {summary.map((c) => (
                <li key={c.chapterId || 'none'} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[0.9375rem]">
                  <span className="truncate font-semibold">{councilName(c.chapterId)}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-stone" aria-hidden="true">
                    <span className="block h-full rounded-full bg-navy" style={{ width: `${(c.attending / maxAttending) * 100}%` }} />
                  </span>
                  <span className="whitespace-nowrap tabular-nums text-ink-soft">{c.attending} attending{c.notAttending ? ` · ${c.notAttending} can’t` : ''}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-[1.125rem] font-semibold"><CheckCircle2 className="h-5 w-5 text-navy" aria-hidden="true" /> Attending ({attending.length})</h3>
                {attending.length ? <ul className="mt-2 divide-y divide-line">{attending.map((r) => <PersonRow key={r.userId} r={r} />)}</ul> : <p className="mt-2 text-muted">Nobody yet.</p>}
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-[1.125rem] font-semibold"><XCircle className="h-5 w-5 text-muted" aria-hidden="true" /> Cannot attend ({notAttending.length})</h3>
                {notAttending.length ? <ul className="mt-2 divide-y divide-line">{notAttending.map((r) => <PersonRow key={r.userId} r={r} />)}</ul> : <p className="mt-2 text-muted">Nobody yet.</p>}
              </div>
            </div>
          </>
        )}
      </section>

      {banner.status === 'published' && <Comments parent={{ type: 'activity', id: banner.id, title: banner.message }} />}
    </Container>
  );
};
