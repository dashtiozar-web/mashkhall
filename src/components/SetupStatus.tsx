import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';

/**
 * What the running website can see of the meeting set-up (names only).
 * Helps find a setting saved in the wrong place, as the wrong type, or
 * under a slightly different name.
 */
interface Status {
  database: boolean;
  databaseError?: string;
  video: boolean;
  present?: Record<string, boolean>;
  similar?: string[];
}

const ITEMS: { key: string; label: string; optional?: boolean }[] = [
  { key: 'FIREBASE_SERVICE_ACCOUNT', label: 'Firebase service account' },
  { key: 'SFU_APP_ID', label: 'Cloudflare Realtime SFU: App ID' },
  { key: 'SFU_APP_TOKEN', label: 'Cloudflare Realtime SFU: App token' },
  { key: 'TURN_KEY_ID', label: 'TURN key ID (recommended)', optional: true },
  { key: 'TURN_KEY_API_TOKEN', label: 'TURN API token (recommended)', optional: true },
];

export const SetupStatus: React.FC = () => {
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => {
    setS(null);
    fetch('/api/meetings/status', { cache: 'no-store' }).then((r) => r.json()).then(setS).catch(() => setFailed(true));
  };
  useEffect(load, []);
  if (failed) return <p className="text-muted">The set-up check could not be loaded.</p>;
  if (!s) return <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking the set-up…</p>;
  return (
    <div className="space-y-3">
      <p className="font-semibold">What the website server can see right now</p>
      <ul className="space-y-1.5 text-[0.9375rem]">
        {ITEMS.map((i) => {
          const ok = Boolean(s.present?.[i.key]);
          return (
            <li key={i.key} className="flex items-start gap-2">
              {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2FA36B]" aria-label="Found" /> : <CircleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${i.optional ? 'text-muted' : 'text-crimson'}`} aria-label="Missing" />}
              <span><code translate="no">{i.key}</code> · {i.label}: {ok ? 'found' : 'not found'}</span>
            </li>
          );
        })}
      </ul>
      {s.present?.FIREBASE_SERVICE_ACCOUNT && !s.database && <p className="rounded-lg bg-[#FBEDEF] px-3 py-2 text-[0.9375rem] text-crimson">The Firebase key is there but does not work: {s.databaseError}</p>}
      {s.database && <p className="text-[0.9375rem] text-[#1E6B47]">The database connection works.</p>}
      {Boolean(s.similar?.length) && <p className="rounded-lg bg-amber-tint px-3 py-2 text-[0.9375rem]">Settings with similar names were found: <code translate="no">{s.similar!.join(', ')}</code>. The names must match exactly (capital letters, underscores, no spaces).</p>}
      {!s.present?.FIREBASE_SERVICE_ACCOUNT && (
        <div className="rounded-lg border border-line bg-paper p-3 text-[0.9375rem] text-ink-soft">
          <p className="font-semibold text-ink">If you have already added it</p>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            <li>It must be under <strong>Workers &amp; Pages › mashkhall › Settings › Variables and Secrets</strong>, not under <strong>Settings › Build</strong> (build variables are not used by the running website).</li>
            <li>Choose the type <strong>Secret</strong>, then press <strong>Deploy</strong> to save.</li>
            <li>Check it was added to the <strong>mashkhall</strong> Worker (the one serving mashkhall.com), not another one.</li>
          </ul>
        </div>
      )}
      <button type="button" onClick={load} className="cursor-pointer text-[0.9375rem] font-semibold text-navy underline">Check again</button>
    </div>
  );
};
