import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Palette } from 'lucide-react';
import { auth, db, safeSetDoc } from '../firebase';
import { Button } from '../components/ui';
import { applyAppearance, Appearance, cleanAppearance, DEFAULT_APPEARANCE, FontOption, LATIN_FONTS, RTL_FONTS, TEXT_SCALES } from '../lib/appearance';

/**
 * Administration › Appearance: the approved fonts for English, Kurdish and
 * Arabic, text size and line spacing for the whole website. Changes preview
 * at once on this page and apply for every visitor when saved.
 */
export const AppearanceAdmin: React.FC = () => {
  const [saved, setSaved] = useState<Appearance | null>(null);
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'site_settings', 'appearance'))
      .then((d) => { const v = cleanAppearance(d.exists() ? (d.data() as Partial<Appearance>) : null); setSaved(v); setA(v); })
      .catch(() => { setSaved(DEFAULT_APPEARANCE); });
  }, []);
  // Preview while choosing; leaving without saving puts the saved settings back.
  useEffect(() => { if (saved) applyAppearance(a); }, [a, saved]);
  useEffect(() => () => { if (saved) applyAppearance(saved); }, [saved]);

  if (!saved) return <p className="flex items-center gap-2 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…</p>;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await safeSetDoc(doc(db, 'site_settings', 'appearance'), { ...a, updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid || '' });
      setSaved(a);
      setMsg({ ok: true, text: 'Saved. Every visitor sees these settings from their next page load.' });
    } catch (e) {
      setMsg({ ok: false, text: `Not saved: ${e instanceof Error ? e.message : 'please try again.'}` });
    } finally { setBusy(false); }
  };

  const FontChoice: React.FC<{ label: string; list: FontOption[]; value: string; onChange: (v: string) => void; rtl?: boolean; heading?: boolean }> = ({ label, list, value, onChange, rtl, heading }) => (
    <fieldset className="rounded-xl border border-line bg-paper p-4">
      <legend className="px-1 font-semibold">{label}</legend>
      <div className="space-y-2">
        {list.map((f) => (
          <label key={f.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${value === f.id ? 'border-navy bg-navy-tint' : 'border-line bg-surface hover:border-ink/40'}`}>
            <input type="radio" className="mt-1.5" checked={value === f.id} onChange={() => onChange(f.id)} />
            <span className="min-w-0">
              <span className="block text-[0.9375rem] font-semibold">{f.label}</span>
              <span dir={rtl ? 'rtl' : 'ltr'} data-i18n-skip="" className={`mt-1 block ${heading ? 'text-[1.375rem] font-semibold' : 'text-[1.0625rem]'}`} style={{ fontFamily: f.stack }}>{f.sample}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const changed = JSON.stringify(a) !== JSON.stringify(saved);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-[1.625rem] font-semibold"><Palette className="h-6 w-6 text-navy" aria-hidden="true" /> Appearance</h2>
        <p className="mt-1 max-w-[75ch] text-ink-soft">Fonts, text size and line spacing for the whole website. Only fonts that are hosted on our own website and draw every Kurdish (Sorani) and Arabic letter can be chosen. Changes show on this page straight away; save to apply them for everyone.</p>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <FontChoice label="English: text and forms" list={LATIN_FONTS} value={a.latinBody} onChange={(v) => setA({ ...a, latinBody: v })} />
        <FontChoice label="English: headings and titles" list={LATIN_FONTS} value={a.latinHeading} onChange={(v) => setA({ ...a, latinHeading: v })} heading />
        <FontChoice label="Kurdish and Arabic: text and forms" list={RTL_FONTS} value={a.rtlBody} onChange={(v) => setA({ ...a, rtlBody: v })} rtl />
        <FontChoice label="Kurdish and Arabic: headings and titles" list={RTL_FONTS} value={a.rtlHeading} onChange={(v) => setA({ ...a, rtlHeading: v })} rtl heading />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="rounded-xl border border-line bg-paper p-4">
          <legend className="px-1 font-semibold">Text size</legend>
          <div className="flex flex-wrap gap-2">
            {TEXT_SCALES.map((s) => (
              <label key={s} className={`cursor-pointer rounded-lg border px-4 py-2 ${a.textScale === s ? 'border-navy bg-navy text-white' : 'border-line bg-surface'}`}>
                <input type="radio" className="sr-only" checked={a.textScale === s} onChange={() => setA({ ...a, textScale: s })} />
                {s === 100 ? 'Standard' : <span className="tabular-nums">{s}%</span>}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[0.875rem] text-muted">Relative to each visitor’s own browser setting, so people who have made their text larger keep that.</p>
        </fieldset>
        <fieldset className="rounded-xl border border-line bg-paper p-4">
          <legend className="px-1 font-semibold">Line spacing</legend>
          <div className="flex flex-wrap gap-2">
            {(['standard', 'relaxed'] as const).map((s) => (
              <label key={s} className={`cursor-pointer rounded-lg border px-4 py-2 ${a.lineSpacing === s ? 'border-navy bg-navy text-white' : 'border-line bg-surface'}`}>
                <input type="radio" className="sr-only" checked={a.lineSpacing === s} onChange={() => setA({ ...a, lineSpacing: s })} />
                {s === 'standard' ? 'Standard' : 'More space'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !changed} onClick={save}>{busy ? 'Saving…' : 'Save for everyone'}</Button>
        <Button variant="secondary" disabled={!changed} onClick={() => setA(saved)}>Undo changes</Button>
        <Button variant="secondary" onClick={() => setA(DEFAULT_APPEARANCE)}>Recommended settings</Button>
      </div>
    </div>
  );
};
