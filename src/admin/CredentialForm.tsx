import React from 'react';
import { addYears, MEMBER_NUMBER_PATTERN, todayIso } from '../lib/membership';
import { positionOf, positionTitle } from '../lib/positions';

export interface CredentialValues {
  /** The member's main position (from their appointments). */
  positionId: string;
  /** Title shown on the card (the position's title). */
  designation: string;
  joinedAt: string;
  validFrom: string;
  expiresAt: string;
  memberNumber: string;
  replaceQr: boolean;
}

export const defaultCredentialValues = (existing?: Partial<CredentialValues & { memberNumber: string }>): CredentialValues => {
  const today = todayIso();
  const validFrom = existing?.validFrom?.slice(0, 10) || today;
  const positionId = positionOf({ positionId: existing?.positionId, designation: existing?.designation });
  return {
    positionId,
    designation: positionTitle(positionId),
    joinedAt: existing?.joinedAt?.slice(0, 10) || today,
    validFrom,
    expiresAt: existing?.expiresAt?.slice(0, 10) || addYears(validFrom, 1),
    memberNumber: existing?.memberNumber && MEMBER_NUMBER_PATTERN.test(existing.memberNumber) ? existing.memberNumber : '',
    replaceQr: false,
  };
};

const field = 'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-[0.9688rem] font-normal text-ink focus:border-navy focus:outline-none';
const label = 'block text-[0.875rem] font-semibold text-ink';

/** Official membership details: role, joining date, card validity and number. */
export const CredentialForm: React.FC<{
  values: CredentialValues;
  onChange: (v: CredentialValues) => void;
  mode: 'approve' | 'renew' | 'edit';
  hasExistingCard?: boolean;
}> = ({ values, onChange, mode, hasExistingCard }) => {
  const set = <K extends keyof CredentialValues>(k: K, v: CredentialValues[K]) => onChange({ ...values, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={label}>
          Position on the card
          <p className="mt-1 rounded-lg border border-line bg-stone px-3 py-2 text-[0.9688rem] font-normal text-ink">{positionTitle(values.positionId)}</p>
          <span className="mt-1 block text-[0.8125rem] font-normal text-muted">The most senior position the member holds. Appoint people to positions in the Organisation structure tab.</span>
        </div>
        <label className={label}>
          Official joining date
          <input
            type="date"
            value={values.joinedAt}
            max={todayIso()}
            onChange={(e) => {
              const j = e.target.value;
              // "Valid from" follows the joining date unless it was changed separately.
              if (values.validFrom === values.joinedAt && j) {
                onChange({ ...values, joinedAt: j, validFrom: j, expiresAt: values.expiresAt <= j ? addYears(j, 1) : values.expiresAt });
              } else set('joinedAt', j);
            }}
            className={field}
          />
          <span className="mt-1 block text-[0.8125rem] font-normal text-muted">The date they became a member, as given on their application.</span>
        </label>
        <label className={label}>
          Card valid from
          <input
            type="date"
            value={values.validFrom}
            onChange={(e) => onChange({ ...values, validFrom: e.target.value, expiresAt: values.expiresAt <= e.target.value ? addYears(e.target.value, 1) : values.expiresAt })}
            className={field}
          />
          <span className="mt-1 block text-[0.8125rem] font-normal text-muted">Starts as the joining date.</span>
        </label>
        <label className={label}>
          Card expires on
          <input type="date" value={values.expiresAt} min={values.validFrom} onChange={(e) => set('expiresAt', e.target.value)} className={field} />
          <span className="mt-1 block text-[0.8125rem] font-normal text-muted">Starts as one year after they applied.</span>
          <span className="mt-1 flex flex-wrap gap-3 text-[0.8125rem] font-normal">
            {[1, 2].map((y) => (
              <button key={y} type="button" onClick={() => set('expiresAt', addYears(values.validFrom > todayIso() ? values.validFrom : todayIso(), y))} className="cursor-pointer text-navy underline">
                {y} year{y > 1 ? 's' : ''} from today
              </button>
            ))}
          </span>
        </label>
      </div>
      <label className={label}>
        Membership number <span className="font-normal text-muted">(optional)</span>
        <input
          value={values.memberNumber}
          onChange={(e) => set('memberNumber', e.target.value.toUpperCase().trim())}
          className={`${field} uppercase tabular-nums`}
          placeholder={mode === 'approve' ? 'Leave empty to assign the next number' : 'M0000000'}
        />
        <span className="mt-1 block text-[0.8125rem] font-normal text-muted">
          Enter the number from an existing printed card (for example M0097206), or leave empty to assign the next free number.
        </span>
        {values.memberNumber && !MEMBER_NUMBER_PATTERN.test(values.memberNumber) && (
          <span className="mt-1 block text-[0.8125rem] font-semibold text-crimson">Use the letter M followed by seven digits.</span>
        )}
      </label>
      {hasExistingCard && mode !== 'approve' && (
        <label className="flex items-start gap-2 text-[0.875rem]">
          <input type="checkbox" checked={values.replaceQr} onChange={(e) => set('replaceQr', e.target.checked)} className="mt-0.5" />
          <span>
            <strong>Replace the QR code</strong> (only if a card was lost or stolen). The old QR code will show as replaced.
          </span>
        </label>
      )}
    </div>
  );
};

export const credentialValid = (v: CredentialValues) =>
  Boolean(v.positionId && v.designation.trim() && v.joinedAt && v.validFrom && v.expiresAt && v.expiresAt > v.validFrom && (!v.memberNumber || MEMBER_NUMBER_PATTERN.test(v.memberNumber)));
