import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction } from 'firebase/firestore';
import { Languages, Loader2, RotateCcw, Save, Search } from 'lucide-react';
import { auth, db } from '../firebase';
import { Button } from '../components/ui';
import { applyOverrides } from '../i18n/translator';
import { getLang } from '../i18n/lang';
import structure from '../config/structure.json';
import { useData } from '../context/DataContext';

/**
 * Administration › Translations: review and correct the Kurdish (Sorani) and
 * Arabic text of the website. Corrections are stored in translations/{lang}
 * and override the built-in dictionaries for every visitor at once; each
 * change is recorded with who made it. Names, numbers, certificate numbers
 * and verification codes are never translated (they are marked in the pages
 * and skipped).
 */

type Lang = 'ckb' | 'ar';
type Dict = Record<string, string>;
interface Change { id: string; key: string; before: string; after: string; byName: string; at: string }

const LANGS: { id: Lang; label: string }[] = [{ id: 'ckb', label: 'Kurdish (Sorani)' }, { id: 'ar', label: 'Arabic' }];
const PAGE = 40;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Code, addresses and font names that the extraction also lists: not text people read. */
const CODE = /^(['"<%?]|\{0\}|q \{0\}|trailer|xref|rgba?\(|cursor-pointer|flex |bold |\d{3} |[a-z0-9]+[-_?/=]|[A-Z][a-z]+[A-Z]\w*$|en-|GB|IQ-|Europe\/|Full Name,|CSV|use[A-Z]|noopener|timeline,|council__|Arial)/;

export const TranslationsAdmin: React.FC = () => {
  const { chapters } = useData();
  const [lang, setLang] = useState<Lang>('ckb');
  const [strings, setStrings] = useState<string[]>([]);
  const [builtIn, setBuiltIn] = useState<Dict>({});
  const [overrides, setOverrides] = useState<Dict>({});
  const [changes, setChanges] = useState<Change[]>([]);
  const [drafts, setDrafts] = useState<Dict>({});
  const [filter, setFilter] = useState<'all' | 'missing' | 'corrected' | 'terms'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async (l: Lang) => {
    setLoading(true);
    setMsg(null);
    try {
      const [s, d, o, c] = await Promise.all([
        import('../i18n/strings.json').then((m) => m.default as string[]),
        (l === 'ckb' ? import('../i18n/dict/ckb.json') : import('../i18n/dict/ar.json')).then((m) => m.default as Dict),
        getDoc(doc(db, 'translations', l)).then((x) => (x.exists() ? (x.data().entries || {}) as Dict : {})).catch(() => ({} as Dict)),
        getDocs(query(collection(db, 'translations', l, 'changes'), orderBy('at', 'desc'), limit(25))).then((x) => x.docs.map((y) => y.data() as Change)).catch(() => []),
      ]);
      const n: Dict = {};
      for (const [k, v] of Object.entries(d)) if (v) n[norm(k)] = v;
      setStrings(s);
      setBuiltIn(n);
      setOverrides(o);
      setChanges(c);
      setDrafts({});
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load the translations.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(lang); }, [lang]);

  // Organisation terms: positions, departments, councils and meeting rooms.
  const terms = useMemo(() => new Set([
    ...structure.positions.map((p) => p.title),
    ...structure.units.map((u) => u.name),
    ...chapters.map((c) => `${c.name} Council`), ...chapters.map((c) => c.name),
    'Board of Directors', 'Board and Council Leaders', 'Research and Investigation', 'Production Team', 'Website Administration',
  ].map(norm)), [chapters]);

  const current = (k: string) => overrides[k] ?? builtIn[norm(k)] ?? '';
  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = [...new Set([...strings, ...Object.keys(overrides), ...terms])];
    return all.filter((k) => {
      if (CODE.test(k)) return false;
      if (filter === 'missing' && current(k)) return false;
      if (filter === 'corrected' && !(k in overrides)) return false;
      if (filter === 'terms' && !terms.has(norm(k))) return false;
      return !q || k.toLowerCase().includes(q) || current(k).toLowerCase().includes(q);
    }).sort((a, b) => a.localeCompare(b));
  }, [strings, overrides, builtIn, filter, q, terms]);
  const missingCount = useMemo(() => strings.filter((k) => !CODE.test(k) && !current(k)).length, [strings, overrides, builtIn]);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => setPage(0), [filter, q, lang]);

  /** Save (or with `reset`, remove) one correction, and record the change. */
  const save = async (key: string, reset = false) => {
    const after = reset ? '' : (drafts[key] ?? current(key)).trim();
    if (!reset && !after) { setMsg({ ok: false, text: 'Write the translation before saving, or use “Back to built-in”.' }); return; }
    const user = auth.currentUser;
    if (!user) return;
    setBusy(key);
    setMsg(null);
    try {
      const ref = doc(db, 'translations', lang);
      const at = new Date().toISOString();
      const byName = user.displayName || user.email || '';
      const next = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const entries: Dict = { ...(snap.exists() ? snap.data().entries || {} : {}) };
        const before = entries[key] ?? builtIn[norm(key)] ?? '';
        if (reset) delete entries[key]; else entries[key] = after.slice(0, 4000);
        tx.set(ref, { entries, updatedAt: at, updatedBy: user.uid, updatedByName: byName.slice(0, 120) });
        const id = `${at.replace(/\D/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
        tx.set(doc(db, 'translations', lang, 'changes', id), { id, lang, key: key.slice(0, 2000), before: before.slice(0, 4000), after: reset ? (builtIn[norm(key)] || '').slice(0, 4000) : after.slice(0, 4000), by: user.uid, byName: byName.slice(0, 120), at });
        return entries;
      });
      setOverrides(next);
      setDrafts((d) => { const x = { ...d }; delete x[key]; return x; });
      setChanges((c) => [{ id: at, key, before: current(key), after: reset ? builtIn[norm(key)] || '' : after, byName, at }, ...c].slice(0, 25));
      if (getLang() === lang) applyOverrides(lang, reset ? { [key]: builtIn[norm(key)] || key } : { [key]: after });
      setMsg({ ok: true, text: reset ? 'Back to the built-in translation.' : 'Saved. Visitors see the new text the next time a page loads.' });
    } catch (e) {
      const text = e instanceof Error ? e.message : '';
      setMsg({ ok: false, text: /permission|insufficient/i.test(text) ? 'Not saved: your account is not allowed to edit translations, or the database rules (version 2026-10-30b) have not been published yet.' : text || 'Not saved. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  const field = 'w-full rounded-lg border border-line bg-paper px-3 py-2';
  const chip = (on: boolean) => `cursor-pointer rounded-lg border px-3 py-1.5 text-[0.9375rem] ${on ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink-soft hover:border-ink/40'}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-[1.625rem] font-semibold"><Languages className="h-6 w-6 text-navy" aria-hidden="true" /> Translations</h2>
        <p className="mt-1 max-w-[75ch] text-ink-soft">Review and correct the website’s Kurdish (Sorani) and Arabic text. A correction replaces the built-in translation for every visitor and is recorded with your name. Keep the organisation’s terms consistent: use the “Organisation terms” filter for positions, councils and teams. People’s names, membership and certificate numbers and verification codes are never translated.</p>
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 font-semibold">Language
            <select className="rounded-lg border border-line bg-paper px-3 py-2 font-normal" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Everything</button>
            <button type="button" className={chip(filter === 'missing')} aria-pressed={filter === 'missing'} onClick={() => setFilter('missing')}>Not translated (<span className="tabular-nums">{missingCount}</span>)</button>
            <button type="button" className={chip(filter === 'corrected')} aria-pressed={filter === 'corrected'} onClick={() => setFilter('corrected')}>Corrected here (<span className="tabular-nums">{Object.keys(overrides).length}</span>)</button>
            <button type="button" className={chip(filter === 'terms')} aria-pressed={filter === 'terms'} onClick={() => setFilter('terms')}>Organisation terms</button>
          </div>
        </div>
        <label className="relative block w-full lg:w-80">
          <span className="sr-only">Search English or translated text</span>
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search English or translation" className={`${field} ps-9`} />
        </label>
      </div>

      {loading ? <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p> : (
        <>
          <p className="text-[0.9375rem] text-muted"><span className="tabular-nums">{rows.length}</span> texts</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {shown.map((k) => {
              const value = drafts[k] ?? current(k);
              const corrected = k in overrides;
              const changed = drafts[k] !== undefined && drafts[k] !== current(k);
              return (
                <li key={k} className="grid gap-3 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-[0.8125rem] font-semibold text-muted">English{terms.has(norm(k)) ? ' · organisation term' : ''}</p>
                    <p dir="ltr" lang="en" translate="no" data-i18n-skip="" className="mt-1 text-start">{k}</p>
                    {corrected && builtIn[norm(k)] && <p className="mt-2 text-[0.8125rem] text-muted">Built-in: <span dir="rtl" data-i18n-skip="">{builtIn[norm(k)]}</span></p>}
                  </div>
                  <div>
                    <label className="text-[0.8125rem] font-semibold text-muted">{LANGS.find((l) => l.id === lang)?.label}{corrected ? ' · corrected here' : !current(k) ? ' · not translated yet' : ''}
                      <textarea dir="rtl" lang={lang} data-i18n-skip="" rows={Math.min(5, Math.max(1, Math.ceil(k.length / 60)))} className={`mt-1 ${field} font-[family-name:var(--f-arabic-ui)]`} value={value} onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))} />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button disabled={busy === k || !changed} onClick={() => save(k)}>{busy === k ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} Save</Button>
                      {corrected && <Button variant="secondary" disabled={busy === k} onClick={() => save(k, true)}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Back to built-in</Button>}
                    </div>
                  </div>
                </li>
              );
            })}
            {!shown.length && <li className="p-6 text-muted">Nothing matches.</li>}
          </ul>
          {rows.length > PAGE && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-muted">Page <span className="tabular-nums">{page + 1}</span> of <span className="tabular-nums">{Math.ceil(rows.length / PAGE)}</span></span>
              <Button variant="secondary" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-[1.125rem] font-semibold">Recent changes</h3>
            {changes.length ? (
              <ul className="mt-3 divide-y divide-line text-[0.9375rem]">
                {changes.map((c) => (
                  <li key={c.id} className="py-2">
                    <span className="text-muted">{new Date(c.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span> · <strong data-i18n-skip="" dir="auto">{c.byName}</strong> · <span dir="ltr" data-i18n-skip="">{c.key}</span>: <span dir="rtl" data-i18n-skip="" className="text-muted line-through">{c.before || '—'}</span> → <span dir="rtl" data-i18n-skip="">{c.after || '—'}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-muted">No corrections yet.</p>}
          </section>
        </>
      )}
    </div>
  );
};
