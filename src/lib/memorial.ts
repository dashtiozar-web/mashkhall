import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  Bi, Claim, EVENTS, MemorialEvent, MemorialPerson, MemorialSource, PEOPLE, SOURCES,
} from '../data/memorial';

/**
 * Additions to the 17 Shubat 2011 memorial made from the website by
 * authorised administrators: corrections and evidence (notes), further
 * timeline entries and people, completed sources (such as the original
 * Kurdish text with its English translation), and authorised photographs
 * and video.
 *
 * The sourced record in src/data/memorial.ts is never changed from here:
 * a correction is shown next to the entry it corrects. Records are never
 * deleted (only hidden), and every save keeps a copy in
 * memorial_revisions, so the history of the record is preserved.
 */

export type NoteType = 'correction' | 'evidence' | 'translation' | 'spelling';
export type RecordKind = 'note' | 'event' | 'person' | 'source' | 'media';

export interface Citation { title: string; url?: string }

export interface NoteData {
  targetId: string;
  noteType: NoteType;
  text: Bi;
  citation?: Citation;
  verified: boolean;
}

export interface MediaData {
  mediaType: 'image' | 'video';
  /** Image, compressed in the browser (data URL). */
  dataUrl?: string;
  /** Video link (YouTube, Vimeo or Facebook). */
  url?: string;
  caption: Bi;
  credit: string;
  permission: string;
  transcript?: string;
  /** A person or timeline entry this belongs to. */
  linkedTo?: string;
  role?: 'portrait' | 'archive';
}

export interface SourceData extends Omit<MemorialSource, 'pending'> {
  /** Completes a source already in the record (e.g. 'tevda'). */
  supplements?: string;
  originalText?: string;
  translation?: string;
}

export type RecordData =
  | { kind: 'note'; data: NoteData }
  | { kind: 'event'; data: MemorialEvent & { citations?: Citation[] } }
  | { kind: 'person'; data: MemorialPerson & { citations?: Citation[] } }
  | { kind: 'source'; data: SourceData }
  | { kind: 'media'; data: MediaData };

export type MemorialRecord = RecordData & {
  id: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastRevision: string;
};

const code = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
export const newRecordId = () => `mr_${Date.now().toString(36)}${code(10)}`;

/** Strip undefined values, which Firestore does not store. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Save a record (new or changed), keeping a copy of this version. */
export const saveMemorialRecord = async (rec: RecordData & { id?: string; published: boolean; createdAt?: string; createdBy?: string }) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in first.');
  const id = rec.id || newRecordId();
  const now = new Date().toISOString();
  const revisionId = `rv_${Date.now().toString(36)}${code(10)}`;
  const record = clean({
    id,
    kind: rec.kind,
    data: rec.data,
    published: rec.published,
    createdAt: rec.createdAt || now,
    createdBy: rec.createdBy || uid,
    updatedAt: now,
    lastRevision: revisionId,
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'memorial_revisions', revisionId), { id: revisionId, recordId: id, snapshot: record, at: now, by: uid });
  batch.set(doc(db, 'memorial_records', id), record);
  await batch.commit();
  return record as MemorialRecord;
};

/** Hide or show a record. It is never deleted. */
export const setMemorialPublished = (r: MemorialRecord, published: boolean) =>
  saveMemorialRecord({ ...r, published } as MemorialRecord);

/** Live additions: published ones for everyone; all of them for administrators. */
export const useMemorialRecords = (all = false) => {
  const [rows, setRows] = useState<MemorialRecord[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const q = all ? collection(db, 'memorial_records') : query(collection(db, 'memorial_records'), where('published', '==', true));
    return onSnapshot(q, (s) => { setRows(s.docs.map((d) => d.data() as MemorialRecord)); setError(false); }, () => setError(true));
  }, [all]);
  return { rows, error };
};

export interface MergedMemorial {
  events: (MemorialEvent & { added?: boolean; citations?: Citation[] })[];
  people: (MemorialPerson & { added?: boolean; citations?: Citation[] })[];
  sources: (MemorialSource & { originalText?: string; translation?: string })[];
  notes: Record<string, (NoteData & { at: string })[]>;
  media: (MediaData & { id: string })[];
  portraits: Record<string, MediaData & { id: string }>;
}

/** The record as shown: the sourced record, with authorised additions alongside it. */
export const mergeMemorial = (rows: MemorialRecord[]): MergedMemorial => {
  const pub = rows.filter((r) => r.published);
  const added = <K extends RecordKind>(k: K) => pub.filter((r) => r.kind === k) as Extract<MemorialRecord, { kind: K }>[];

  const events = [...EVENTS, ...added('event').map((r) => ({ ...r.data, id: r.id, added: true }))]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const people = [...PEOPLE, ...added('person').map((r) => ({ ...r.data, id: r.id, added: true }))];

  const supplements = added('source');
  const sources = [
    ...SOURCES.map((s) => {
      const extra = supplements.find((r) => r.data.supplements === s.id)?.data;
      if (!extra) return s;
      // Fill in what the record lacks; the original entry is kept.
      return {
        ...s,
        date: s.date || extra.date,
        url: s.url || extra.url,
        title: { en: extra.title?.en || s.title.en, ckb: extra.title?.ckb || s.title.ckb },
        originalText: extra.originalText,
        translation: extra.translation,
        pending: !(extra.originalText || extra.url),
      };
    }),
    ...supplements.filter((r) => !r.data.supplements).map((r) => ({ ...r.data, id: r.id })),
  ];

  const notes: MergedMemorial['notes'] = {};
  for (const r of added('note')) (notes[r.data.targetId] ||= []).push({ ...r.data, at: r.createdAt });
  for (const k of Object.keys(notes)) notes[k].sort((a, b) => a.at.localeCompare(b.at));

  const media = added('media').map((r) => ({ ...r.data, id: r.id }));
  const portraits: MergedMemorial['portraits'] = {};
  for (const m of media) if (m.role === 'portrait' && m.linkedTo && m.mediaType === 'image') portraits[m.linkedTo] = m;

  return { events, people, sources, notes, media, portraits };
};

export const useMemorial = () => {
  const { rows, error } = useMemorialRecords(false);
  const merged = useMemo(() => mergeMemorial(rows), [rows]);
  return { ...merged, error };
};

/** Everything a visitor can search, in either language. */
export const searchText = (e: MemorialEvent, people: MemorialPerson[]) => {
  const names = (e.people || []).map((p) => {
    const m = people.find((x) => x.id === p);
    return m ? [m.nameEn, m.nameKu?.value.ckb, ...m.variants.map((v) => v.name)].join(' ') : p;
  });
  return [e.date, e.title.en, e.title.ckb, e.summary.en, e.summary.ckb, e.place.en, e.place.ckb, ...names].join(' ').toLowerCase();
};

export const claimText = (c: Claim, lang: 'en' | 'ckb') => c.value[lang] || c.value.en;
