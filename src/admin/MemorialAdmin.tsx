import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { EVENTS, PEOPLE, SOURCES, memorialDate, Bi } from '../data/memorial';
import { S_EVENTS } from '../data/sherwani';
import { compressImage } from '../lib/media';
import { videoEmbed } from '../lib/video';
import {
  MemorialRecord, NoteType, RecordKind, saveMemorialRecord, setMemorialPublished, useMemorialRecords,
} from '../lib/memorial';

/**
 * Administration of the 17 Shubat 2011 memorial. The sourced record (in the
 * website's code) cannot be edited here; instead administrators add:
 * - notes: corrections, further evidence, translations or spellings,
 *   shown next to the entry they concern, with their own source;
 * - further timeline entries and people, each with a source;
 * - sources, or the full text of an existing one (with permission);
 * - photographs and video, with a credit and a record of permission.
 * Nothing is deleted: entries can be hidden, and every save is kept.
 */

const field = 'mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 text-[0.9688rem] text-ink focus:border-navy focus:outline-none';
const lab = 'block text-[0.9063rem] font-semibold';
const emptyBi: Bi = { en: '', ckb: '' };

const BiInput: React.FC<{ label: string; value: Bi; onChange: (v: Bi) => void; rows?: number; required?: boolean }> = ({ label, value, onChange, rows = 1, required }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {(['en', 'ckb'] as const).map((l) => (
      <label key={l} className={lab}>
        {label} <span className="font-normal text-muted">{l === 'en' ? '(English)' : '(کوردی)'}</span>{required && l === 'en' ? ' *' : ''}
        {rows > 1
          ? <textarea dir={l === 'ckb' ? 'rtl' : 'ltr'} lang={l} rows={rows} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} className={`${field} ${l === 'ckb' ? 'font-kurdish' : ''}`} />
          : <input dir={l === 'ckb' ? 'rtl' : 'ltr'} lang={l} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} className={`${field} ${l === 'ckb' ? 'font-kurdish' : ''}`} />}
      </label>
    ))}
  </div>
);

type Form =
  | { kind: 'note'; targetId: string; noteType: NoteType; text: Bi; citationTitle: string; citationUrl: string; verified: boolean }
  | { kind: 'event'; date: string; time: Bi; place: Bi; title: Bi; summary: Bi; people: string; figures: Bi; sources: string[]; citationTitle: string; citationUrl: string; flags: Bi }
  | { kind: 'person'; nameEn: string; nameKu: string; age: string; ageSource: string; incidentDate: string; incidentPlace: Bi; deathDate: string; deathPlace: Bi; circumstances: Bi; source: string; citationTitle: string; citationUrl: string; flags: Bi }
  | { kind: 'source'; supplements: string; title: Bi; publisher: string; date: string; url: string; language: 'ckb' | 'en'; note: Bi; originalText: string; translation: string }
  | { kind: 'media'; mediaType: 'image' | 'video'; dataUrl: string; url: string; caption: Bi; credit: string; permission: string; permitted: boolean; transcript: string; linkedTo: string; role: 'portrait' | 'archive' };

const blank = (k: RecordKind): Form => {
  switch (k) {
    case 'note': return { kind: 'note', targetId: '', noteType: 'correction', text: { ...emptyBi }, citationTitle: '', citationUrl: '', verified: false };
    case 'event': return { kind: 'event', date: '2011-', time: { ...emptyBi }, place: { ...emptyBi }, title: { ...emptyBi }, summary: { ...emptyBi }, people: '', figures: { ...emptyBi }, sources: [], citationTitle: '', citationUrl: '', flags: { ...emptyBi } };
    case 'person': return { kind: 'person', nameEn: '', nameKu: '', age: '', ageSource: '', incidentDate: '', incidentPlace: { ...emptyBi }, deathDate: '', deathPlace: { ...emptyBi }, circumstances: { ...emptyBi }, source: '', citationTitle: '', citationUrl: '', flags: { ...emptyBi } };
    case 'source': return { kind: 'source', supplements: '', title: { ...emptyBi }, publisher: '', date: '', url: '', language: 'ckb', note: { ...emptyBi }, originalText: '', translation: '' };
    case 'media': return { kind: 'media', mediaType: 'image', dataUrl: '', url: '', caption: { ...emptyBi }, credit: '', permission: '', permitted: false, transcript: '', linkedTo: '', role: 'archive' };
  }
};

const has = (b: Bi) => Boolean(b.en.trim() || b.ckb.trim());
const opt = (b: Bi) => (has(b) ? b : undefined);

/** Turn a stored record back into a form for editing. */
const toForm = (r: MemorialRecord): Form => {
  const d = r.data as never as Record<string, unknown>;
  switch (r.kind) {
    case 'note': { const n = r.data; return { kind: 'note', targetId: n.targetId, noteType: n.noteType, text: n.text, citationTitle: n.citation?.title || '', citationUrl: n.citation?.url || '', verified: n.verified }; }
    case 'event': { const x = r.data; return { kind: 'event', date: x.date, time: x.time || { ...emptyBi }, place: x.place, title: x.title, summary: x.summary, people: (x.people || []).join(', '), figures: x.figures || { ...emptyBi }, sources: x.sources.filter((s) => s !== 'citation'), citationTitle: x.citations?.[0]?.title || '', citationUrl: x.citations?.[0]?.url || '', flags: x.flags?.[0] || { ...emptyBi } }; }
    case 'person': { const x = r.data; return { kind: 'person', nameEn: x.nameEn, nameKu: x.nameKu?.value.ckb || '', age: x.ages[0]?.value.en || '', ageSource: x.ages[0]?.source || '', incidentDate: x.incident?.date || '', incidentPlace: x.incident?.place || { ...emptyBi }, deathDate: x.death?.date || '', deathPlace: x.death?.place || { ...emptyBi }, circumstances: x.circumstances?.[0]?.value || { ...emptyBi }, source: x.circumstances?.[0]?.source || '', citationTitle: x.citations?.[0]?.title || '', citationUrl: x.citations?.[0]?.url || '', flags: x.flags?.[0] || { ...emptyBi } }; }
    case 'source': { const x = r.data; return { kind: 'source', supplements: x.supplements || '', title: x.title, publisher: x.publisher, date: x.date || '', url: x.url || '', language: x.language, note: x.note || { ...emptyBi }, originalText: x.originalText || '', translation: x.translation || '' }; }
    case 'media': { const x = r.data; return { kind: 'media', mediaType: x.mediaType, dataUrl: x.dataUrl || '', url: x.url || '', caption: x.caption, credit: x.credit, permission: x.permission, permitted: true, transcript: x.transcript || '', linkedTo: x.linkedTo || '', role: x.role || 'archive' }; }
  }
  return blank(String(d.kind) as RecordKind);
};

const KIND_LABEL: Record<RecordKind, string> = {
  note: 'Correction or evidence', event: 'Timeline entry', person: 'Person', source: 'Source', media: 'Photograph or video',
};

export const MemorialAdmin: React.FC = () => {
  const { rows, error } = useMemorialRecords(true);
  const [form, setForm] = useState<Form>(blank('note'));
  const [editing, setEditing] = useState<MemorialRecord | null>(null);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const added = rows.filter((r) => r.kind === 'event' || r.kind === 'person');
  const targets = useMemo(() => [
    ...EVENTS.map((e) => ({ id: e.id, label: `${memorialDate(e.date, 'en')}: ${e.title.en}` })),
    ...PEOPLE.map((p) => ({ id: p.id, label: `Martyr: ${p.nameEn}` })),
    { id: 'sherwani', label: 'Sherwan Sherwani (portrait and photographs)' },
    { id: 'sherwani-status', label: 'Sherwan Sherwani: current status (add a dated, verified update)' },
    ...S_EVENTS.map((e) => ({ id: e.id, label: `Sherwan Sherwani, ${e.date.slice(0, 7)}: ${e.title.en}` })),
    ...added.map((r) => ({ id: r.id, label: `${r.kind === 'event' ? 'Added entry' : 'Added person'}: ${r.kind === 'event' ? r.data.title.en : (r.data as { nameEn: string }).nameEn}` })),
  ], [added]);
  const sourceOpts = [...SOURCES.map((s) => ({ id: s.id, label: `${s.publisher}: ${s.title.en}` })), ...rows.filter((r) => r.kind === 'source' && !(r.data as { supplements?: string }).supplements).map((r) => ({ id: r.id, label: (r.data as { publisher: string }).publisher }))];

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v } as Form));

  const start = (k: RecordKind) => { setEditing(null); setForm(blank(k)); setPublish(true); setMsg(null); };

  const validate = (): string => {
    const f = form;
    if (f.kind === 'note') {
      if (!f.targetId) return 'Choose the entry this note belongs to.';
      if (!has(f.text)) return 'Write the note.';
      if (!f.citationTitle.trim()) return 'Give the source of this correction or evidence.';
    }
    if (f.kind === 'event') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'Enter the date as YYYY-MM-DD.';
      if (!f.title.en.trim() || !has(f.summary) || !has(f.place)) return 'Give the place, a title and what happened.';
      if (!f.sources.length && !f.citationTitle.trim()) return 'Name the source of this entry.';
    }
    if (f.kind === 'person') {
      if (!f.nameEn.trim()) return 'Enter the name.';
      if (!f.source && !f.citationTitle.trim()) return 'Name the source.';
    }
    if (f.kind === 'source' && !f.publisher.trim() && !f.supplements) return 'Give the publisher, or choose the source you are completing.';
    if (f.kind === 'media') {
      if (f.mediaType === 'image' && !f.dataUrl) return 'Choose a photograph.';
      if (f.mediaType === 'video' && !videoEmbed(f.url)) return 'Enter a YouTube, Vimeo or Facebook video link.';
      if (!has(f.caption)) return 'Write a caption.';
      if (!f.credit.trim() || !f.permission.trim() || !f.permitted) return 'Give the credit, record the permission, and confirm you have permission to publish it.';
      if (f.mediaType === 'video' && !f.transcript.trim()) return 'Add a transcript or a full description of the video, for people who cannot watch or hear it.';
      if (f.role === 'portrait' && !f.linkedTo) return 'Choose whose portrait this is.';
    }
    return '';
  };

  const build = () => {
    const f = form;
    const cite = 'citationTitle' in f && f.citationTitle.trim() ? [{ title: f.citationTitle.trim(), ...(f.citationUrl.trim() ? { url: f.citationUrl.trim() } : {}) }] : undefined;
    switch (f.kind) {
      case 'note': return { kind: 'note' as const, data: { targetId: f.targetId, noteType: f.noteType, text: f.text, citation: cite?.[0], verified: f.verified } };
      case 'event': return { kind: 'event' as const, data: {
        id: editing?.id || '', date: f.date, time: opt(f.time), place: f.place, title: f.title, summary: f.summary,
        people: f.people.split(',').map((x) => x.trim()).filter(Boolean), figures: opt(f.figures),
        sources: [...f.sources, ...(cite ? ['citation'] : [])], citations: cite, flags: has(f.flags) ? [f.flags] : undefined,
      } };
      case 'person': {
        const src = f.source || 'citation';
        return { kind: 'person' as const, data: {
          id: editing?.id || '', nameEn: f.nameEn.trim(), nameKu: f.nameKu.trim() ? { value: { en: f.nameKu.trim(), ckb: f.nameKu.trim() }, source: src } : undefined,
          variants: [{ name: f.nameEn.trim(), source: src }, ...(f.nameKu.trim() ? [{ name: f.nameKu.trim(), source: src }] : [])],
          ages: f.age.trim() ? [{ value: { en: f.age.trim(), ckb: f.age.trim() }, source: f.ageSource || src }] : [],
          incident: f.incidentDate ? { date: f.incidentDate, place: opt(f.incidentPlace), source: src } : undefined,
          death: f.deathDate ? { date: f.deathDate, place: opt(f.deathPlace), source: src } : undefined,
          circumstances: has(f.circumstances) ? [{ value: f.circumstances, source: src }] : undefined,
          flags: has(f.flags) ? [f.flags] : [], status: 'documented' as const, citations: cite,
        } };
      }
      case 'source': return { kind: 'source' as const, data: {
        id: editing?.id || '', supplements: f.supplements || undefined, title: f.title, publisher: f.publisher.trim(), date: f.date || undefined, url: f.url.trim() || undefined,
        language: f.language, note: opt(f.note), originalText: f.originalText.trim() || undefined, translation: f.translation.trim() || undefined,
      } };
      case 'media': return { kind: 'media' as const, data: {
        mediaType: f.mediaType, dataUrl: f.mediaType === 'image' ? f.dataUrl : undefined, url: f.mediaType === 'video' ? f.url.trim() : undefined,
        caption: f.caption, credit: f.credit.trim(), permission: f.permission.trim(), transcript: f.transcript.trim() || undefined,
        linkedTo: f.linkedTo || undefined, role: f.role,
      } };
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    setBusy(true); setMsg(null);
    try {
      const rec = build();
      await saveMemorialRecord({ ...rec, id: editing?.id, published: publish, createdAt: editing?.createdAt, createdBy: editing?.createdBy } as never);
      setMsg({ ok: true, text: editing ? 'Saved. The previous version is kept in the history.' : publish ? 'Added to the memorial.' : 'Saved, hidden from the public.' });
      setEditing(null); setForm(blank(form.kind));
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: /permission|insufficient/i.test(String((err as Error).message)) ? 'The database refused this. You need administrator rights or the site-text permission, and the latest database rules must be published.' : 'That did not work. Please try again.' });
    } finally { setBusy(false); }
  };

  const pickImage = async (file?: File) => {
    if (!file) return;
    try { const img = await compressImage(file, 1400); set('dataUrl', img.dataUrl); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const summary = (r: MemorialRecord) => {
    const d = r.data as unknown as Record<string, unknown>;
    if (r.kind === 'note') return `${(d.noteType as string)} on ${targets.find((t) => t.id === d.targetId)?.label || d.targetId}: ${(d.text as Bi).en || (d.text as Bi).ckb}`;
    if (r.kind === 'event') return `${d.date}: ${(d.title as Bi).en}`;
    if (r.kind === 'person') return String(d.nameEn);
    if (r.kind === 'source') return `${d.publisher || ''} ${d.supplements ? `(completes “${d.supplements}”)` : ''}`;
    return `${d.mediaType}: ${(d.caption as Bi).en || (d.caption as Bi).ckb} (${d.credit})`;
  };

  const f = form;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-semibold">17 Shubat 2011 Memorial</h2>
        <p className="mt-1 max-w-[85ch] text-ink-soft">The sourced record is kept in the website itself and cannot be changed here. Add corrections and evidence next to an entry, further entries and people with their sources, the full text of a source (only with the publisher’s permission), and photographs or video you have permission to publish. Nothing is deleted: you can hide an addition, and every version is kept. Do not add graphic images.</p>
        <a href="/memorial" className="mt-2 inline-block font-semibold text-navy underline">View the memorial</a>
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        {(Object.keys(KIND_LABEL) as RecordKind[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={f.kind === k} onClick={() => start(k)}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-[0.875rem] font-semibold ${f.kind === k ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'}`}>{KIND_LABEL[k]}</button>
        ))}
      </div>

      <form onSubmit={save} className="space-y-4 rounded-xl border border-line bg-surface p-5" noValidate>
        <h3 className="font-sans text-[1.125rem] font-semibold">{editing ? `Edit: ${KIND_LABEL[f.kind]}` : `Add: ${KIND_LABEL[f.kind]}`}</h3>

        {f.kind === 'note' && <>
          <label className={lab}>Entry it concerns *
            <select value={f.targetId} onChange={(e) => set('targetId', e.target.value)} className={field}><option value="">Choose…</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className={lab}>Kind of note
            <select value={f.noteType} onChange={(e) => set('noteType', e.target.value)} className={field}>
              <option value="correction">Correction</option><option value="evidence">Further evidence</option><option value="translation">Translation</option><option value="spelling">Spelling of a name</option>
            </select></label>
          <BiInput label="Note" value={f.text} onChange={(v) => set('text', v)} rows={3} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Source (title, publisher, date) *<input value={f.citationTitle} onChange={(e) => set('citationTitle', e.target.value)} className={field} /></label>
            <label className={lab}>Link to the source<input type="url" dir="ltr" value={f.citationUrl} onChange={(e) => set('citationUrl', e.target.value)} className={field} /></label>
          </div>
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={f.verified} onChange={(e) => set('verified', e.target.checked)} /> Verified against an independent record</label>
        </>}

        {f.kind === 'event' && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Date (YYYY-MM-DD) *<input dir="ltr" value={f.date} onChange={(e) => set('date', e.target.value)} className={field} /></label>
          </div>
          <BiInput label="Time of day" value={f.time} onChange={(v) => set('time', v)} />
          <BiInput label="Place" value={f.place} onChange={(v) => set('place', v)} required />
          <BiInput label="Title" value={f.title} onChange={(v) => set('title', v)} required />
          <BiInput label="What happened" value={f.summary} onChange={(v) => set('summary', v)} rows={5} required />
          <BiInput label="Casualties or arrests, as reported" value={f.figures} onChange={(v) => set('figures', v)} />
          <label className={lab}>People named (separate with commas; use a martyr’s id, e.g. “rezhwan”, to link their card)<input value={f.people} onChange={(e) => set('people', e.target.value)} className={field} /></label>
          <fieldset><legend className={lab}>Sources</legend>
            <div className="mt-1 flex flex-wrap gap-3">{sourceOpts.map((s) => <label key={s.id} className="flex items-center gap-1.5 text-[0.9063rem]"><input type="checkbox" checked={f.sources.includes(s.id)} onChange={(e) => set('sources', e.target.checked ? [...f.sources, s.id] : f.sources.filter((x) => x !== s.id))} /> {s.label}</label>)}</div></fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Or another source (title, publisher, date)<input value={f.citationTitle} onChange={(e) => set('citationTitle', e.target.value)} className={field} /></label>
            <label className={lab}>Link<input type="url" dir="ltr" value={f.citationUrl} onChange={(e) => set('citationUrl', e.target.value)} className={field} /></label>
          </div>
          <BiInput label="Anything still to be verified" value={f.flags} onChange={(v) => set('flags', v)} rows={2} />
        </>}

        {f.kind === 'person' && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Name (English transliteration) *<input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} className={field} /></label>
            <label className={lab}>Name in Kurdish, exactly as in the source<input dir="rtl" value={f.nameKu} onChange={(e) => set('nameKu', e.target.value)} className={`${field} font-kurdish`} /></label>
            <label className={lab}>Age, as reported<input value={f.age} onChange={(e) => set('age', e.target.value)} className={field} /></label>
            <label className={lab}>Date shot or injured (YYYY-MM-DD)<input dir="ltr" value={f.incidentDate} onChange={(e) => set('incidentDate', e.target.value)} className={field} /></label>
            <label className={lab}>Date of death (YYYY-MM-DD)<input dir="ltr" value={f.deathDate} onChange={(e) => set('deathDate', e.target.value)} className={field} /></label>
          </div>
          <BiInput label="Place shot or injured" value={f.incidentPlace} onChange={(v) => set('incidentPlace', v)} />
          <BiInput label="Place of death" value={f.deathPlace} onChange={(v) => set('deathPlace', v)} />
          <BiInput label="What the source records" value={f.circumstances} onChange={(v) => set('circumstances', v)} rows={3} />
          <label className={lab}>Source<select value={f.source} onChange={(e) => set('source', e.target.value)} className={field}><option value="">Another source (below)</option>{sourceOpts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Other source (title, publisher, date)<input value={f.citationTitle} onChange={(e) => set('citationTitle', e.target.value)} className={field} /></label>
            <label className={lab}>Link<input type="url" dir="ltr" value={f.citationUrl} onChange={(e) => set('citationUrl', e.target.value)} className={field} /></label>
          </div>
          <BiInput label="Anything still to be verified" value={f.flags} onChange={(v) => set('flags', v)} rows={2} />
        </>}

        {f.kind === 'source' && <>
          <label className={lab}>Completes an existing source
            <select value={f.supplements} onChange={(e) => set('supplements', e.target.value)} className={field}><option value="">No, this is a new source</option>{SOURCES.map((s) => <option key={s.id} value={s.id}>{s.publisher}: {s.title.en}</option>)}</select></label>
          <BiInput label="Title" value={f.title} onChange={(v) => set('title', v)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Publisher / author<input value={f.publisher} onChange={(e) => set('publisher', e.target.value)} className={field} /></label>
            <label className={lab}>Publication date (YYYY-MM-DD)<input dir="ltr" value={f.date} onChange={(e) => set('date', e.target.value)} className={field} /></label>
            <label className={lab}>Link<input type="url" dir="ltr" value={f.url} onChange={(e) => set('url', e.target.value)} className={field} /></label>
          </div>
          <BiInput label="Note about the source" value={f.note} onChange={(v) => set('note', v)} rows={2} />
          <p className="rounded-lg border border-amber/60 bg-amber-tint p-3 text-[0.9063rem]">Add the full text of a published article only if its publisher has given permission. Otherwise, link to it.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className={lab}>Original text (Kurdish)<textarea dir="rtl" rows={10} value={f.originalText} onChange={(e) => set('originalText', e.target.value)} className={`${field} font-kurdish`} /></label>
            <label className={lab}>English translation<textarea rows={10} value={f.translation} onChange={(e) => set('translation', e.target.value)} className={field} /></label>
          </div>
        </>}

        {f.kind === 'media' && <>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="radio" checked={f.mediaType === 'image'} onChange={() => set('mediaType', 'image')} /> Photograph or document</label>
            <label className="flex items-center gap-2"><input type="radio" checked={f.mediaType === 'video'} onChange={() => set('mediaType', 'video')} /> Video link</label>
          </div>
          {f.mediaType === 'image' ? (
            <div>
              <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
              {f.dataUrl && <img src={f.dataUrl} alt="" className="mt-2 h-32 rounded-md border border-line object-cover" />}
            </div>
          ) : (
            <label className={lab}>Video link (YouTube, Vimeo or Facebook)<input type="url" dir="ltr" value={f.url} onChange={(e) => set('url', e.target.value)} className={field} /></label>
          )}
          <BiInput label="Caption" value={f.caption} onChange={(v) => set('caption', v)} rows={2} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Credit (photographer or owner) *<input value={f.credit} onChange={(e) => set('credit', e.target.value)} className={field} /></label>
            <label className={lab}>Permission: who allowed it, and when *<input value={f.permission} onChange={(e) => set('permission', e.target.value)} className={field} /></label>
            <label className={lab}>Belongs to
              <select value={f.linkedTo} onChange={(e) => set('linkedTo', e.target.value)} className={field}><option value="">The archive in general</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label className={lab}>Use
              <select value={f.role} onChange={(e) => set('role', e.target.value)} className={field}><option value="archive">Archive</option><option value="portrait">Portrait of a martyr</option></select></label>
          </div>
          <label className={lab}>Transcript or full description {f.mediaType === 'video' ? '*' : '(optional)'}<textarea rows={4} value={f.transcript} onChange={(e) => set('transcript', e.target.value)} className={field} /></label>
          <label className="flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-1" checked={f.permitted} onChange={(e) => set('permitted', e.target.checked)} /> We have permission to publish this, it is not graphic, and the family has not objected to it being shown.</label>
        </>}

        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Show on the memorial</label>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="cursor-pointer rounded-lg bg-navy px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}</button>
          {editing && <button type="button" onClick={() => start(f.kind)} className="cursor-pointer rounded-lg border border-line px-5 py-2.5 font-semibold">Cancel</button>}
        </div>
      </form>

      <section className="rounded-xl border border-line bg-surface">
        <h3 className="border-b border-line p-4 font-sans text-[1.125rem] font-semibold">Additions ({rows.length})</h3>
        {error && <p className="p-4 text-crimson">The additions could not be loaded. Check that the latest database rules are published.</p>}
        {rows.length === 0 && !error ? <p className="p-4 text-muted">Nothing added yet.</p> : (
          <ul className="divide-y divide-line">
            {[...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-semibold text-muted uppercase">{KIND_LABEL[r.kind]} · {r.published ? 'shown' : 'hidden'} · updated {r.updatedAt.slice(0, 10)}</p>
                  <p className="truncate" dir="auto" data-i18n-skip="">{summary(r)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => { setEditing(r); setForm(toForm(r)); setPublish(r.published); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[0.875rem] font-semibold"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit</button>
                  <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await setMemorialPublished(r, !r.published); } catch { setMsg({ ok: false, text: 'That did not work. Please try again.' }); } finally { setBusy(false); } }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[0.875rem] font-semibold">
                    {r.published ? <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide</> : <><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Show</>}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
