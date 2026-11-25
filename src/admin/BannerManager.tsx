import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { NewsBanner } from '../types';
import { useData } from '../context/DataContext';
import { BreakingNewsStrip } from '../components/BreakingNewsBanner';
import { ActivityAttendees } from './ActivityAttendees';
import { VideoPlayer } from '../components/VideoEmbed';
import { VIDEO_HELP, videoEmbed } from '../lib/video';
import {
  bannerPhase, BannerPhase, currentBanners, DEFAULT_BANNER_MESSAGE, deleteNewsBanner, formatEventDate,
  saveNewsBanner, setNewsBannerStatus, useNewsBanners,
} from '../lib/newsBanner';

const MODES: { value: NewsBanner['mode']; label: string; hint: string }[] = [
  { value: 'announcement', label: 'Activity announcement', hint: 'An upcoming event, workshop or campaign. Ends on its own and the banner goes back to normal.' },
  { value: 'breaking', label: 'Breaking news', hint: 'Urgent news. Shown ahead of any activity announcement while it is live.' },
  { value: 'default', label: 'Everyday message', hint: `What the banner says normally. Leave unset to show “${DEFAULT_BANNER_MESSAGE}”.` },
];

const PHASE: Record<BannerPhase, { label: string; cls: string }> = {
  live: { label: 'Live now', cls: 'bg-[#B3261E] text-white' },
  scheduled: { label: 'Scheduled', cls: 'bg-amber-tint text-ink' },
  ended: { label: 'Ended', cls: 'bg-stone text-muted' },
  draft: { label: 'Draft', cls: 'bg-stone text-ink-soft' },
  archived: { label: 'Switched off', cls: 'bg-stone text-muted' },
};

const toInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (v: string) => (v ? new Date(v).toISOString() : '');
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

type Draft = Partial<NewsBanner> & { mode: NewsBanner['mode'] };

const newDraft = (): Draft => ({ mode: 'announcement', message: '', linkUrl: '', eventAt: '', location: '', details: '', registrationOpen: true, startAt: '', endAt: '' });

/** Admin tool for the red Breaking News banner at the top of every page. */
export const BannerManager: React.FC = () => {
  const { banners, error: loadError, clock } = useNewsBanners(true);
  const { chapters } = useData();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<NewsBanner | null>(null);

  const showing = currentBanners(banners, clock);
  const showingIds = new Set(showing.map((b) => b.id));
  const sorted = [...banners].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      return true;
    } catch (e) {
      console.error('Banner change failed:', e);
      const text = e instanceof Error ? e.message : String(e);
      setError(/permission/i.test(text)
        ? 'The database refused this change. Make sure the latest database rules are published and that your account can publish content.'
        : 'The banner could not be saved. Check your connection and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (status: NewsBanner['status']) => {
    if (!draft) return;
    setError(null);
    if (!draft.message?.trim()) { setError('Write the message that will scroll across the banner.'); return; }
    if (draft.videoUrl?.trim() && !videoEmbed(draft.videoUrl)) { setError('The video link isn’t a YouTube, Vimeo or Facebook video link.'); return; }
    if (draft.startAt && draft.endAt && draft.endAt <= draft.startAt) { setError('“Stop showing” must be after “Start showing”.'); return; }
    let endAt = draft.endAt;
    // An activity announcement with a date but no end time comes down a day
    // after the activity, so people still see it on the day.
    if (draft.mode === 'announcement' && !endAt && draft.eventAt) {
      endAt = new Date(new Date(draft.eventAt).getTime() + 24 * 3_600_000).toISOString();
    }
    const ok = await act(
      () => saveNewsBanner({ ...draft, endAt, message: draft.message || '', status } as NewsBanner),
      status === 'published' ? 'Banner published.' : 'Draft saved.',
    );
    if (ok) setDraft(null);
  };

  const field = 'mt-1.5 block w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 font-normal text-ink focus:border-navy focus:outline-none';
  const label = 'block text-[0.9688rem] font-semibold text-ink';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[1.5rem] font-semibold">Breaking News banner</h2>
          <p className="mt-1 max-w-[70ch] text-ink-soft">
            The red banner at the top of every page. Normally it shows “{DEFAULT_BANNER_MESSAGE}”. When you plan an activity,
            announce it here with its date; the banner switches back by itself when the announcement ends.
          </p>
        </div>
        {!draft && (
          <button type="button" onClick={() => { setDraft(newDraft()); setError(null); setNotice(null); }} className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-navy px-5 py-2.5 font-semibold text-white hover:bg-navy-deep">
            <Plus className="h-4 w-4" aria-hidden="true" /> Create banner
          </button>
        )}
      </div>

      <section aria-labelledby="now-heading" className="rounded-2xl border border-line bg-surface p-5">
        <h3 id="now-heading" className="mb-3 text-[0.9375rem] font-semibold text-ink-soft">Showing on the website now</h3>
        <div className="overflow-hidden rounded-lg"><BreakingNewsStrip banners={showing} preview /></div>
        <p className="mt-2 text-[0.875rem] text-muted">
          {showing[0]?.id === 'default' ? 'The everyday message.' : `${showing.length} ${showing.length === 1 ? 'item, shown' : 'items, shown one after another'} until each is switched off or reaches its end time.`}
        </p>
      </section>

      {notice && <p role="status" className="rounded-lg bg-navy-tint px-4 py-3">{notice}</p>}
      {(error || loadError) && !draft && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{error || 'Banners could not be loaded. Check that the latest database rules are published.'}</p>}

      {draft && (
        <section aria-labelledby="draft-heading" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h3 id="draft-heading" className="text-[1.375rem] font-semibold">{draft.id ? 'Edit banner' : 'New banner'}</h3>
            <button type="button" onClick={() => setDraft(null)} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
          </div>

          <div className="mt-6 space-y-6">
            <fieldset>
              <legend className={label}>Type</legend>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {MODES.map((m) => (
                  <label key={m.value} className={`cursor-pointer rounded-xl border p-3.5 ${draft.mode === m.value ? 'border-navy bg-navy-tint' : 'border-line hover:border-ink/30'}`}>
                    <input type="radio" name="banner-mode" className="sr-only" checked={draft.mode === m.value} onChange={() => set({ mode: m.value })} />
                    <span className="block font-semibold">{m.label}</span>
                    <span className="mt-0.5 block text-[0.875rem] text-muted">{m.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className={label}>
              Message
              <input value={draft.message || ''} onChange={(e) => set({ message: e.target.value })} maxLength={300} className={field}
                placeholder={draft.mode === 'announcement' ? 'Human rights workshop in Manchester — all members welcome' : draft.mode === 'breaking' ? 'Statement on today’s events' : DEFAULT_BANNER_MESSAGE} />
              <span className="mt-1 block text-[0.8438rem] font-normal text-muted">{(draft.message || '').length}/300</span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              {draft.mode === 'announcement' && (
                <label className={label}>
                  Date and time of the activity
                  <input type="datetime-local" value={toInput(draft.eventAt)} onChange={(e) => set({ eventAt: fromInput(e.target.value) })} className={field} />
                  <span className="mt-1 block text-[0.8438rem] font-normal text-muted">Shown in the banner, for example “{formatEventDate(new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10) + 'T14:00')}”.</span>
                </label>
              )}
              <label className={label}>
                Link <span className="font-normal text-muted">(optional)</span>
                <input value={draft.linkUrl || ''} onChange={(e) => set({ linkUrl: e.target.value })} maxLength={500} className={field} placeholder="https://… or a page such as events or news" />
              </label>
            </div>

            {draft.mode === 'announcement' && (
              <>
                <label className={label}>
                  Council <span className="font-normal text-muted">(optional)</span>
                  <select value={draft.councilId || ''} onChange={(e) => set({ councilId: e.target.value })} className={field}>
                    <option value="">Whole organisation</option>
                    {chapters.map((c) => <option key={c.id} value={c.id}>{c.name} Council</option>)}
                  </select>
                  <span className="mt-1 block text-[0.8125rem] font-normal text-muted">Council activities appear on the council’s page. Online ones (“Online” or “Zoom” in Where) appear under its Head of Online Meeting Management.</span>
                </label>
                <label className={label}>
                  Where <span className="font-normal text-muted">(optional)</span>
                  <input value={draft.location || ''} onChange={(e) => set({ location: e.target.value })} maxLength={200} className={field} placeholder="For example: Manchester Central Library, or Online (Zoom)" />
                </label>
                <label className={label}>
                  Details for members <span className="font-normal text-muted">(optional)</span>
                  <textarea value={draft.details || ''} onChange={(e) => set({ details: e.target.value })} maxLength={3000} rows={4} className={field} placeholder="What will happen, what to bring, who to contact…" />
                </label>
                <label className={label}>
                  Video <span className="font-normal text-muted">(optional)</span>
                  <input value={draft.videoUrl || ''} onChange={(e) => set({ videoUrl: e.target.value })} maxLength={500} inputMode="url" className={field} placeholder="https://www.youtube.com/watch?v=…" />
                  <span className="mt-1 block text-[0.8438rem] font-normal text-muted">{VIDEO_HELP}</span>
                  {draft.videoUrl?.trim() && !videoEmbed(draft.videoUrl) && (
                    <span role="alert" className="mt-1 block text-[0.875rem] font-medium text-crimson">{/facebook\.com\/share\//i.test(draft.videoUrl) ? 'Facebook share links can’t be played on other websites. Open the video on Facebook and copy its address from the browser bar instead.' : 'This link isn’t a YouTube, Vimeo or Facebook video. Copy the link from the video’s Share button.'}</span>
                  )}
                </label>
                {videoEmbed(draft.videoUrl) && <VideoPlayer url={draft.videoUrl} title="Video preview" />}
                <label className="flex items-start gap-2 text-[0.9688rem]">
                  <input type="checkbox" checked={draft.registrationOpen !== false} onChange={(e) => set({ registrationOpen: e.target.checked })} className="mt-1" />
                  <span><strong>Members can register to attend.</strong> <span className="text-muted">The banner links to the activity’s page, where signed-in members click “I will attend”. You see the numbers and the list under All banners.</span></span>
                </label>
              </>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className={label}>
                Start showing <span className="font-normal text-muted">(empty = now)</span>
                <input type="datetime-local" value={toInput(draft.startAt)} onChange={(e) => set({ startAt: fromInput(e.target.value) })} className={field} />
              </label>
              <label className={label}>
                Stop showing <span className="font-normal text-muted">{draft.mode === 'announcement' ? '(empty = the day after the activity)' : '(empty = until switched off)'}</span>
                <input type="datetime-local" value={toInput(draft.endAt)} onChange={(e) => set({ endAt: fromInput(e.target.value) })} className={field} />
              </label>
            </div>

            <div>
              <p className={label}>Preview</p>
              <div className="mt-2 overflow-hidden rounded-lg">
                <BreakingNewsStrip banner={{ mode: draft.mode, message: draft.message || (draft.mode === 'default' ? DEFAULT_BANNER_MESSAGE : 'Your message will appear here'), eventAt: draft.mode === 'announcement' ? draft.eventAt : undefined, linkUrl: draft.linkUrl }} preview />
              </div>
            </div>

            {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-crimson">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={busy} onClick={() => submit('published')} className="cursor-pointer rounded-lg bg-navy px-5 py-2.5 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">{busy ? 'Saving…' : draft.startAt && draft.startAt > new Date().toISOString() ? 'Schedule' : 'Publish now'}</button>
              <button type="button" disabled={busy} onClick={() => submit('draft')} className="cursor-pointer rounded-lg border border-line px-5 py-2.5 font-semibold hover:border-ink/40 disabled:opacity-50">Save as draft</button>
              <button type="button" disabled={busy} onClick={() => setDraft(null)} className="cursor-pointer rounded-lg px-4 py-2.5 font-semibold text-ink-soft hover:bg-stone">Cancel</button>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="all-heading">
        <h3 id="all-heading" className="text-[1.125rem] font-semibold">All banners</h3>
        {sorted.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-8 text-center text-muted">No banners yet. The website shows the everyday message, “{DEFAULT_BANNER_MESSAGE}”.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {sorted.map((b) => {
              const phase = bannerPhase(b, clock);
              return (
                <li key={b.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                      <span className={`rounded-full px-2.5 py-0.5 font-semibold ${PHASE[phase].cls}`}>{PHASE[phase].label}</span>
                      <span className="text-muted">{MODES.find((m) => m.value === b.mode)?.label}</span>
                      {showingIds.has(b.id) && <span className="font-semibold text-[#C2361A]">On the website now</span>}
                    </p>
                    <p className="mt-1.5 font-semibold">{b.message}</p>
                    <p className="text-[0.875rem] text-muted">
                      {[b.eventAt && `Activity: ${formatEventDate(b.eventAt)}`, b.startAt && `from ${when(b.startAt)}`, b.endAt && `until ${when(b.endAt)}`].filter(Boolean).join(' · ') || 'No end date'}
                    </p>
                    {b.mode === 'announcement' && (
                      <p className="mt-1 text-[0.9375rem] font-semibold text-navy">
                        {b.attendeeCount || 0} {(b.attendeeCount || 0) === 1 ? 'member' : 'members'} attending
                        {b.registrationOpen === false && <span className="font-normal text-muted"> · registration closed</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {b.mode === 'announcement' && (
                      <button type="button" onClick={() => setAttendees(b)} className="cursor-pointer rounded-lg bg-navy-tint px-4 py-2 text-[0.9375rem] font-semibold text-navy hover:bg-navy hover:text-white">Attendees and views</button>
                    )}
                    <button type="button" disabled={busy} onClick={() => { setDraft({ ...b }); setError(null); setNotice(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="cursor-pointer rounded-lg border border-line px-4 py-2 text-[0.9375rem] font-semibold hover:border-ink/40">Edit</button>
                    {b.status === 'published' ? (
                      <button type="button" disabled={busy} onClick={() => act(() => setNewsBannerStatus(b.id, 'archived'), 'Banner switched off.')} className="cursor-pointer rounded-lg border border-line px-4 py-2 text-[0.9375rem] font-semibold hover:border-ink/40">Switch off</button>
                    ) : (
                      <button type="button" disabled={busy || phase === 'ended'} title={phase === 'ended' ? 'Its end time has passed. Edit it to set new dates.' : undefined} onClick={() => act(() => setNewsBannerStatus(b.id, 'published'), 'Banner published.')} className="cursor-pointer rounded-lg bg-navy px-4 py-2 text-[0.9375rem] font-semibold text-white disabled:opacity-50">Publish</button>
                    )}
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete this banner? This cannot be undone.')) act(() => deleteNewsBanner(b.id), 'Banner deleted.'); }} className="cursor-pointer rounded-lg px-4 py-2 text-[0.9375rem] font-semibold text-crimson hover:bg-crimson/5">Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {attendees && <ActivityAttendees banner={attendees} onClose={() => setAttendees(null)} />}
    </div>
  );
};
