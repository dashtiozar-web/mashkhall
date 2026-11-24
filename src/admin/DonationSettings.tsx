import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, EyeOff } from 'lucide-react';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { DonationConfig } from '../types';

type Form = Required<Pick<DonationConfig, 'accountHolder' | 'bankName' | 'accountNumber' | 'sortCode' | 'iban' | 'swiftBic' | 'referenceInstructions' | 'guidance'>>;

const EMPTY: Form = {
  accountHolder: '', bankName: '', accountNumber: '', sortCode: '', iban: '', swiftBic: '',
  referenceInstructions: 'Please use your full name as the payment reference.',
  guidance: 'UK bank transfers usually arrive within two hours.',
};

/** 12-34-56 */
const formatSortCode = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 6);
  return d.replace(/(\d{2})(?=\d)/g, '$1-');
};

/** Standard IBAN check (mod 97). */
const ibanValid = (raw: string) => {
  const v = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  const moved = v.slice(4) + v.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
};

const validate = (f: Form) => {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.accountHolder.trim()) e.accountHolder = 'Enter the name on the account.';
  if (!f.bankName.trim()) e.bankName = 'Enter the bank’s name.';
  const hasUk = f.accountNumber.trim() || f.sortCode.trim();
  if (!hasUk && !f.iban.trim()) e.accountNumber = 'Enter a UK account number and sort code, or an IBAN.';
  if (hasUk) {
    if (!/^\d{8}$/.test(f.accountNumber.replace(/\s+/g, ''))) e.accountNumber = 'UK account numbers have 8 digits.';
    if (!/^\d{2}-\d{2}-\d{2}$/.test(f.sortCode.trim())) e.sortCode = 'Sort codes have 6 digits, like 12-34-56.';
  }
  if (f.iban.trim() && !ibanValid(f.iban)) e.iban = 'This IBAN doesn’t look right. Check it against your bank statement.';
  if (f.swiftBic.trim() && !/^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(f.swiftBic.replace(/\s+/g, ''))) e.swiftBic = 'SWIFT/BIC codes have 8 or 11 letters and numbers.';
  return e;
};

const describe = (e: unknown) => {
  const text = e instanceof Error ? e.message : String(e);
  if (/permission|insufficient/i.test(text)) return 'The database refused the change. Make sure you are signed in as an administrator and that the latest database rules are published.';
  if (/offline|network|unavailable/i.test(text)) return 'Could not reach the database. Check your internet connection and try again.';
  return 'The details could not be saved. Please try again.';
};

export const DonationSettings: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { donationConfig, updateDonationSettings } = useData();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState<'draft' | 'publish' | 'hide' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Start from the draft (or the published details).
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'donation_config', 'draft'))
      .then((snap) => {
        if (cancelled) return;
        const src = (snap.exists() ? snap.data() : donationConfig) as Partial<DonationConfig> | null;
        if (src) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(src).filter(([k, v]) => k in EMPTY && typeof v === 'string' && v)) } as Form);
      })
      .catch(() => { if (donationConfig) setForm({ ...EMPTY, ...(donationConfig as Partial<Form>) } as Form); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const act = async (kind: 'draft' | 'publish' | 'hide') => {
    setMsg(null);
    if (kind === 'publish') {
      const e = validate(form);
      setErrors(e);
      if (Object.values(e).some(Boolean)) {
        setMsg({ ok: false, text: 'Please correct the highlighted details before publishing.' });
        return;
      }
    }
    if (kind === 'hide' && !window.confirm('Hide the bank details from the Donate page?')) return;
    setBusy(kind);
    try {
      await updateDonationSettings(form, kind === 'publish', kind === 'hide');
      setMsg({
        ok: true,
        text: kind === 'publish' ? 'Published. The bank details now show on the Donate page.'
          : kind === 'hide' ? 'Hidden. The Donate page now asks people to contact you for the details.'
          : 'Draft saved. It is not shown publicly until you publish it.',
      });
    } catch (e) {
      console.error('Donation settings save failed:', e);
      setMsg({ ok: false, text: describe(e) });
    } finally {
      setBusy(null);
    }
  };

  const live = Boolean(donationConfig?.isPublished && (donationConfig.accountNumber || donationConfig.iban));
  const input = (k: keyof Form, label: string, opts: { hint?: string; mono?: boolean; wide?: boolean; placeholder?: string; onChange?: (v: string) => void; inputMode?: 'numeric' | 'text' } = {}) => (
    <label className={`block text-[0.9375rem] font-semibold ${opts.wide ? 'sm:col-span-2' : ''}`}>
      {label}
      <input
        value={form[k]}
        onChange={(e) => (opts.onChange ? opts.onChange(e.target.value) : set(k, e.target.value))}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        aria-invalid={Boolean(errors[k])}
        className={`mt-1 block w-full rounded-lg border bg-paper px-3 py-2.5 font-normal text-ink focus:border-navy focus:outline-none ${opts.mono ? 'tabular-nums tracking-wide' : ''} ${errors[k] ? 'border-crimson' : 'border-line'}`}
      />
      {errors[k] ? <span role="alert" className="mt-1 block text-[0.875rem] font-medium text-crimson">{errors[k]}</span>
        : opts.hint && <span className="mt-1 block text-[0.8438rem] font-normal text-muted">{opts.hint}</span>}
    </label>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-semibold">Donation bank details</h2>
        <p className="mt-1 text-ink-soft">These appear on the <button type="button" onClick={() => onNavigate('donate')} className="cursor-pointer font-semibold text-navy underline">Donate page</button> once published.</p>
      </div>

      <p className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[0.9375rem] ${live ? 'bg-navy-tint' : 'bg-stone text-ink-soft'}`}>
        {live ? <CheckCircle2 className="h-5 w-5 text-navy" aria-hidden="true" /> : <EyeOff className="h-5 w-5" aria-hidden="true" />}
        {live ? 'Bank details are live on the Donate page.' : 'Bank details are not published. The Donate page asks people to contact you.'}
      </p>

      <div className="rounded-2xl border border-line bg-surface p-6">
        {!loaded ? <p className="text-muted">Loading…</p> : (
          <div className="grid gap-5 sm:grid-cols-2">
            {input('accountHolder', 'Name on the account', { placeholder: 'Mashkhally Zhyanawa Organisation' })}
            {input('bankName', 'Bank', { placeholder: 'For example: Barclays' })}
            {input('accountNumber', 'Account number', { mono: true, inputMode: 'numeric', placeholder: '12345678', hint: '8 digits', onChange: (v) => set('accountNumber', v.replace(/[^\d\s]/g, '').slice(0, 9)) })}
            {input('sortCode', 'Sort code', { mono: true, inputMode: 'numeric', placeholder: '12-34-56', onChange: (v) => set('sortCode', formatSortCode(v)) })}
            {input('iban', 'IBAN', { mono: true, wide: true, placeholder: 'GB00 XXXX 0000 0000 0000 00', hint: 'Optional. For donations from outside the UK.' })}
            {input('swiftBic', 'SWIFT / BIC', { mono: true, placeholder: 'XXXXGB2L', hint: 'Optional.' })}
            <div className="hidden sm:block" />
            {input('referenceInstructions', 'Payment reference instructions', { wide: true })}
            {input('guidance', 'Note for donors', { wide: true })}
          </div>
        )}
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={Boolean(busy) || !loaded} onClick={() => act('publish')} className="cursor-pointer rounded-lg bg-navy px-5 py-2.5 font-semibold text-white hover:bg-navy-deep disabled:opacity-50">
          {busy === 'publish' ? 'Publishing…' : 'Publish to the Donate page'}
        </button>
        <button type="button" disabled={Boolean(busy) || !loaded} onClick={() => act('draft')} className="cursor-pointer rounded-lg border border-line px-5 py-2.5 font-semibold hover:border-ink/40 disabled:opacity-50">
          {busy === 'draft' ? 'Saving…' : 'Save as draft'}
        </button>
        {live && (
          <button type="button" disabled={Boolean(busy)} onClick={() => act('hide')} className="cursor-pointer rounded-lg px-4 py-2.5 font-semibold text-crimson hover:bg-crimson/5 disabled:opacity-50">
            {busy === 'hide' ? 'Hiding…' : 'Hide from the Donate page'}
          </button>
        )}
      </div>
      <p className="text-[0.875rem] text-muted">Every change is recorded in the audit log.</p>
    </div>
  );
};
