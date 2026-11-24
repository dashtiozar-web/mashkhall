import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Button, Container, PageHeader } from '../components/ui';

interface DonatePageProps {
  onNavigate: (tab: string, param?: string) => void;
}

const USES = [
  {
    title: 'Documentation',
    body: 'Recording and verifying human-rights abuses so that they are on the record and can be raised with the right authorities.',
  },
  {
    title: 'Community support',
    body: 'Translation, signposting and information sessions for people in the Kurdish community who need help understanding their rights.',
  },
  {
    title: 'Public events and research',
    body: 'Lectures, commemorations and published research that keep public attention on accountability and freedom of expression.',
  },
];

export const DonatePage: React.FC<DonatePageProps> = ({ onNavigate }) => {
  const { donationConfig } = useData();
  const [copied, setCopied] = useState<string | null>(null);

  const hasBankDetails = Boolean(
    donationConfig &&
      donationConfig.isPublished &&
      !donationConfig.hideInstructions &&
      (donationConfig.accountNumber || donationConfig.iban),
  );

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const rows: { key: string; label: string; value?: string }[] = donationConfig
    ? [
        { key: 'holder', label: 'Account name', value: donationConfig.accountHolder },
        { key: 'bank', label: 'Bank', value: donationConfig.bankName },
        { key: 'sort', label: 'Sort code', value: donationConfig.sortCode },
        { key: 'account', label: 'Account number', value: donationConfig.accountNumber },
        { key: 'iban', label: 'IBAN', value: donationConfig.iban },
        { key: 'swift', label: 'SWIFT / BIC', value: donationConfig.swiftBic },
      ].filter((r) => Boolean(r.value))
    : [];

  return (
    <>
      <PageHeader
        title="Support our work"
        intro="17 Shubat is funded by its members and supporters. We do not take money from governments or political parties, so every donation helps keep our work independent."
      />

      <Container className="grid gap-14 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div>
          <h2 className="text-[2rem] font-semibold">What your donation pays for</h2>
          <dl className="mt-8 space-y-8">
            {USES.map((u) => (
              <div key={u.title} className="border-t border-line pt-6">
                <dt className="font-serif text-[1.375rem] font-semibold">{u.title}</dt>
                <dd className="mt-2 max-w-[56ch] text-ink-soft">{u.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="self-start border-t-4 border-navy bg-stone p-7 sm:p-9">
          {hasBankDetails && donationConfig ? (
            <>
              <h2 className="text-[1.625rem] font-semibold">Donate by bank transfer</h2>
              {donationConfig.guidance && <p className="mt-3 text-ink-soft">{donationConfig.guidance}</p>}
              <dl className="mt-6 divide-y divide-line border-y border-line bg-surface">
                {rows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <dt className="text-[0.875rem] text-muted">{r.label}</dt>
                      <dd className="mt-0.5 font-semibold break-all text-ink tabular-nums">{r.value}</dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(r.value!, r.key)}
                      className="shrink-0 cursor-pointer p-1.5 text-muted hover:text-ink"
                      aria-label={`Copy ${r.label.toLowerCase()}`}
                    >
                      {copied === r.key ? <Check className="h-4 w-4 text-navy" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </dl>
              {donationConfig.referenceInstructions && (
                <p className="mt-5 text-[0.9688rem] text-ink-soft">
                  <strong className="text-ink">Payment reference: </strong>
                  {donationConfig.referenceInstructions}
                </p>
              )}
              <p className="mt-6 text-[0.875rem] text-muted">
                We will never ask for your card details, PIN or banking password. If anyone does so in our name,
                please contact us.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-[1.625rem] font-semibold">How to donate</h2>
              <p className="mt-3 text-ink-soft">
                Our bank details for donations will be published here shortly. In the meantime, contact us and we
                will send you the details directly.
              </p>
              <Button className="mt-7" onClick={() => onNavigate('contact')}>Ask for donation details</Button>
            </>
          )}
        </aside>
      </Container>

      <section className="border-t border-line">
        <Container className="flex flex-col gap-6 py-14 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[46ch] font-serif text-[1.5rem] leading-snug">
            You can also support us by giving your time: translating, organising events or helping with research.
          </p>
          <Button size="lg" variant="secondary" onClick={() => onNavigate('apply')}>Become a member</Button>
        </Container>
      </section>
    </>
  );
};
