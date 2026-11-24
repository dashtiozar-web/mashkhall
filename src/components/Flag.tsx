import React from 'react';
import { flag } from '../lib/visits';

/** The flag of Kurdistan: red, white and green, with a golden sun of 21 rays. */
const KurdistanFlag: React.FC = () => {
  const rays = Array.from({ length: 21 }, (_, i) => {
    const a = (i / 21) * Math.PI * 2 - Math.PI / 2;
    const b = a + Math.PI / 21;
    const c = a - Math.PI / 21;
    const r1 = 5.2; const r0 = 3.4;
    return `M${15 + r1 * Math.cos(a)},${10 + r1 * Math.sin(a)}L${15 + r0 * Math.cos(b)},${10 + r0 * Math.sin(b)}L${15 + r0 * Math.cos(c)},${10 + r0 * Math.sin(c)}Z`;
  }).join('');
  return (
    <svg viewBox="0 0 30 20" className="inline-block h-[0.8em] w-[1.2em] rounded-[1px] align-[-0.05em] shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)]" aria-hidden="true">
      <rect width="30" height="6.67" fill="#ED2024" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#278E43" />
      <circle cx="15" cy="10" r="3.6" fill="#FEBD11" />
      <path d={rays} fill="#FEBD11" />
    </svg>
  );
};

/** A country's flag; the Kurdistan Region has its own. */
export const Flag: React.FC<{ code: string }> = ({ code }) =>
  code === 'IQ-KR' ? <KurdistanFlag /> : <>{flag(code)}</>;
