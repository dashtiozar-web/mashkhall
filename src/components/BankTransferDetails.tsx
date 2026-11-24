import React from 'react';
import { useData } from '../context/DataContext';

/** The organisation's published bank details (from Administration → Donations). */
export const BankTransferDetails: React.FC<{ amount?: string; reference?: string; compact?: boolean }> = ({ amount, reference, compact }) => {
  const { donationConfig: c } = useData();
  if (!c || !c.isPublished || c.hideInstructions || !(c.accountNumber || c.iban)) {
    return (
      <p className="rounded-xl bg-stone p-4 text-[0.9375rem] text-ink-soft">
        Bank details are not published yet. Please <a href="/contact" className="font-semibold text-navy underline">contact us</a> and we will send them to you.
      </p>
    );
  }
  const rows: [string, string | undefined][] = [
    ['Amount', amount],
    ['Payment reference', reference],
    ['Account name', c.accountHolder],
    ['Bank', c.bankName],
    ['Sort code', c.sortCode],
    ['Account number', c.accountNumber],
    ['IBAN', c.iban],
    ['SWIFT / BIC', c.swiftBic],
  ];
  return (
    <div className={`rounded-xl border border-line bg-paper ${compact ? 'p-3' : 'p-4'}`}>
      <dl className="grid gap-x-6 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[0.8125rem] text-muted">{k}</dt>
            <dd className={`font-semibold tabular-nums ${k === 'Payment reference' || k === 'Amount' ? 'text-[1.0625rem] text-navy' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {reference && <p className="mt-3 text-[0.8125rem] text-muted">Please use the payment reference exactly as shown, so we can match your payment.</p>}
      {!reference && c.referenceInstructions && <p className="mt-3 text-[0.8125rem] text-muted">{c.referenceInstructions}</p>}
    </div>
  );
};

/**
 * "Would you like to make a voluntary contribution?" shown before members
 * (and contributors who publish free) send their work. The answer never
 * affects editorial review and is not recorded with the work.
 */
export const VoluntaryContribution: React.FC<{ value: 'yes' | 'no' | ''; onChange: (v: 'yes' | 'no') => void }> = ({ value, onChange }) => (
  <fieldset className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
    <legend className="px-1 text-[1rem] font-semibold">Would you like to make a voluntary contribution to support the work of 17 Shubat Organization?</legend>
    <div className="mt-2 space-y-2">
      <label className="flex cursor-pointer items-center gap-3"><input type="radio" name="voluntary" checked={value === 'yes'} onChange={() => onChange('yes')} className="h-4 w-4" /> Yes, I would like to contribute.</label>
      <label className="flex cursor-pointer items-center gap-3"><input type="radio" name="voluntary" checked={value === 'no'} onChange={() => onChange('no')} className="h-4 w-4" /> No, I do not wish to contribute.</label>
    </div>
    {value === 'yes' && (
      <div className="mt-4 space-y-2">
        <p className="text-[0.9375rem] text-ink-soft">Thank you. You can give any amount by bank transfer, now or later:</p>
        <BankTransferDetails />
      </div>
    )}
    <p className="mt-3 text-[0.8125rem] text-muted">Your answer does not affect editorial review in any way, and contributing is never required.</p>
  </fieldset>
);
