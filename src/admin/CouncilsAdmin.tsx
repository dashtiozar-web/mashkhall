import React, { useState } from 'react';
import { ImagePlus, Plus, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CityChapter } from '../types';
import { LandmarkImage } from '../components/LandmarkImage';
import { councilPosition, LANDMARKS, landmarkName } from '../lib/landmarks';
import { uploadImage } from '../lib/media';
import { isVideoFile } from './councilMedia';

const field = 'mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 text-[0.9688rem] font-normal text-ink focus:border-navy focus:outline-none';
const label = 'block text-[0.875rem] font-semibold text-ink';

/**
 * Councils: details, landmark photo, cover video and map position. Changes
 * show at once on the homepage cover, council cards, council pages and the
 * UK map.
 */
export const CouncilsAdmin: React.FC = () => {
  const { chapters, publicProfiles, saveChapter } = useData();
  const { currentUser, userProfile } = useAuth();
  const [edit, setEdit] = useState<Partial<CityChapter> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (patch: Partial<CityChapter>) => setEdit((e) => ({ ...e, ...patch }));

  const upload = async (file?: File) => {
    if (!file || !currentUser) return;
    setBusy(true);
    setMsg(null);
    try {
      const { ref } = await uploadImage(file, { uid: currentUser.uid, name: userProfile?.displayName }, `${edit?.name || 'Council'} landmark`, 1920);
      set({ landmarkImage: ref });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The photo could not be uploaded.' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!edit) return;
    setMsg(null);
    if (!edit.name?.trim()) { setMsg({ ok: false, text: 'Please give the council a name.' }); return; }
    if (edit.coverVideoUrl && !isVideoFile(edit.coverVideoUrl)) {
      setMsg({ ok: false, text: 'The cover video must be a direct link to an .mp4 or .webm file (YouTube and Facebook pages cannot play as a background).' });
      return;
    }
    const lat = edit.lat === undefined || edit.lat === null || Number.isNaN(edit.lat) ? undefined : Number(edit.lat);
    const lng = edit.lng === undefined || edit.lng === null || Number.isNaN(edit.lng) ? undefined : Number(edit.lng);
    if ((lat !== undefined && (lat < 49.8 || lat > 60.9)) || (lng !== undefined && (lng < -8.7 || lng > 1.8))) {
      setMsg({ ok: false, text: 'The map position must be inside the United Kingdom.' });
      return;
    }
    setBusy(true);
    try {
      await saveChapter({ ...edit, name: edit.name.trim(), lat, lng });
      setMsg({ ok: true, text: `${edit.name} saved. The homepage, council page and map now show the changes.` });
      setEdit(null);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The council could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[1.5rem] font-semibold">Councils</h2>
          <p className="mt-1 max-w-[70ch] text-ink-soft">Each council’s details, its landmark photo (shown on the homepage, council cards and council page), an optional cover video, and its place on the UK map.</p>
        </div>
        <button type="button" onClick={() => setEdit({ name: '', country: 'United Kingdom', description: '', displayOrder: chapters.length + 1 })} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-4 py-2 font-semibold text-white">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add a council
        </button>
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {chapters.map((c) => (
          <li key={c.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <LandmarkImage council={c} className="aspect-[16/9] w-full" />
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[1.25rem] font-semibold">{c.name}</h3>
                <span className="text-[0.875rem] text-muted">{publicProfiles.filter((p) => p.chapterId === c.id).length} members</span>
              </div>
              <p className="mt-1 text-[0.875rem] text-muted">{landmarkName(c)}{c.coverVideoUrl ? ' · cover video set' : ''}{councilPosition(c) ? '' : ' · no map position'}</p>
              <button type="button" onClick={() => { setMsg(null); setEdit({ ...c }); }} className="mt-3 cursor-pointer rounded-lg border border-line px-4 py-1.5 text-[0.9375rem] font-semibold hover:border-navy">Edit</button>
            </div>
          </li>
        ))}
      </ul>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="council-edit">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 id="council-edit" className="text-[1.375rem] font-semibold">{edit.id ? `Edit ${edit.name}` : 'Add a council'}</h3>
              <button type="button" onClick={() => setEdit(null)} className="cursor-pointer rounded-full p-1.5 hover:bg-stone" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={label}>Name<input value={edit.name || ''} onChange={(e) => set({ name: e.target.value })} className={field} /></label>
              <label className={label}>Order on the website<input type="number" min={1} value={edit.displayOrder || ''} onChange={(e) => set({ displayOrder: Number(e.target.value) })} className={field} /></label>
              <label className={`${label} sm:col-span-2`}>Description<textarea rows={3} value={edit.description || ''} onChange={(e) => set({ description: e.target.value })} className={field} /></label>
              <label className={label}>Meetings <span className="font-normal text-muted">(optional)</span><input value={edit.meetingCadence || ''} onChange={(e) => set({ meetingCadence: e.target.value })} placeholder="e.g. First Sunday of each month" className={field} /></label>
              <label className={label}>Contact email <span className="font-normal text-muted">(optional)</span><input type="email" value={edit.contactEmail || ''} onChange={(e) => set({ contactEmail: e.target.value })} className={field} /></label>
            </div>

            <fieldset className="mt-6 space-y-3 border-t border-line pt-5">
              <legend className="text-[1.0625rem] font-semibold">Landmark photo</legend>
              {edit.id && <LandmarkImage council={edit as CityChapter} className="aspect-[16/9] w-full rounded-xl" credit />}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2 font-semibold hover:border-navy">
                  <ImagePlus className="h-4 w-4" aria-hidden="true" /> {busy ? 'Uploading…' : 'Upload a photo'}
                  <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
                </label>
                {edit.landmarkImage && <button type="button" onClick={() => set({ landmarkImage: '', landmarkCredit: '' })} className="cursor-pointer font-semibold text-ink-soft underline">Use the built-in photo{edit.id && LANDMARKS[edit.id] ? '' : ' (none)'}</button>}
              </div>
              <p className="text-[0.8125rem] text-muted">A wide photo of a well-known landmark works best. It is compressed automatically for fast loading. Only use photos you took or are free to use.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>What the photo shows<input value={edit.landmarkName || ''} onChange={(e) => set({ landmarkName: e.target.value })} placeholder={edit.id ? LANDMARKS[edit.id]?.name : 'e.g. Cardiff Castle'} className={field} /></label>
                <label className={label}>Photo credit <span className="font-normal text-muted">(optional)</span><input value={edit.landmarkCredit || ''} onChange={(e) => set({ landmarkCredit: e.target.value })} placeholder="e.g. Photo: Karwan Aziz" className={field} /></label>
              </div>
            </fieldset>

            <fieldset className="mt-6 space-y-2 border-t border-line pt-5">
              <legend className="text-[1.0625rem] font-semibold">Homepage cover video <span className="font-normal text-muted">(optional)</span></legend>
              <input value={edit.coverVideoUrl || ''} onChange={(e) => set({ coverVideoUrl: e.target.value.trim() })} placeholder="https://…/london-landmarks.mp4" className={field} aria-label="Cover video link" />
              <p className="text-[0.8125rem] text-muted">A direct link to a short, silent .mp4 or .webm clip (ideally under 10 MB, 1280 pixels wide) of this city’s landmarks. Without a video, the cover shows the landmark photo with a slow camera movement.</p>
            </fieldset>

            <fieldset className="mt-6 space-y-2 border-t border-line pt-5">
              <legend className="text-[1.0625rem] font-semibold">Position on the UK map</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>Latitude<input type="number" step="0.0001" value={edit.lat ?? ''} placeholder={edit.id && LANDMARKS[edit.id] ? String(LANDMARKS[edit.id].lat) : 'e.g. 51.4816'} onChange={(e) => set({ lat: e.target.value === '' ? undefined : Number(e.target.value) })} className={field} /></label>
                <label className={label}>Longitude<input type="number" step="0.0001" value={edit.lng ?? ''} placeholder={edit.id && LANDMARKS[edit.id] ? String(LANDMARKS[edit.id].lng) : 'e.g. -3.1791'} onChange={(e) => set({ lng: e.target.value === '' ? undefined : Number(e.target.value) })} className={field} /></label>
              </div>
              <p className="text-[0.8125rem] text-muted">The six original councils already have positions. For a new council, find the city on a map and copy its latitude and longitude.</p>
            </fieldset>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
              <button type="button" disabled={busy} onClick={save} className="cursor-pointer rounded-lg bg-navy px-5 py-2.5 font-semibold text-white disabled:opacity-50">Save council</button>
              <button type="button" onClick={() => setEdit(null)} className="cursor-pointer px-3 font-semibold underline">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
