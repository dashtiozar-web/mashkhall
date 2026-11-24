import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { LOGO_URL } from './ui';
import { cardDate, verificationState } from '../lib/membership';
import { MemberRecord } from '../types';

/**
 * Digital membership card, reproduced from the printed plastic card:
 * crimson and navy waves, the round logo, a ring of faint logo watermarks,
 * the photo, name, member ID, a navy role badge and red validity dates on the
 * front; organisation details and the QR code on the back.
 *
 * The card keeps the printed proportions (54 × 85.6 mm) and scales with its
 * container, so it stays sharp on phones, tablets and when printed.
 */

const RED = '#B3203C';
const RED_DARK = '#8E1730';
const NAVY = '#232A6E';
const INK = '#1C2140';
const DATE_RED = '#B92A3F';
const CARD_FONT = 'Arial, Helvetica, "Liberation Sans", sans-serif';

/** Background waves, drawn to match the printed card (viewBox = card in 0.1 mm). */
const Waves: React.FC<{ id: string }> = ({ id }) => (
  <svg viewBox="0 0 540 856" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#ECEDF2" />
      </linearGradient>
      <pattern id={`${id}-lines`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
        <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="3" />
      </pattern>
    </defs>
    <rect width="540" height="856" fill={`url(#${id}-sheen)`} />
    {/* soft grey diagonal band behind the watermarks */}
    <path d="M0 250 L540 95 L540 175 L0 360 Z" fill="#DADCE4" opacity="0.45" />
    {/* top right navy */}
    <path d="M210 0 H540 V215 C495 175 430 140 360 112 C300 88 248 52 210 0 Z" fill={NAVY} />
    {/* top left crimson, with a darker inner wave and fine lines */}
    <path d="M0 0 H330 C300 40 250 66 190 84 C120 104 58 122 0 150 Z" fill={RED} />
    <path d="M170 0 H330 C300 40 250 66 190 84 C176 88 162 92 148 96 C188 70 196 32 170 0 Z" fill={RED_DARK} opacity="0.45" />
    <path d="M0 0 H330 C300 40 250 66 190 84 C120 104 58 122 0 150 Z" fill={`url(#${id}-lines)`} opacity="0.6" />
    {/* bottom left navy with red and white stripes */}
    <path d="M0 540 C50 640 110 760 175 856 H0 Z" fill={NAVY} />
    <path d="M0 515 C58 625 122 752 196 856" fill="none" stroke="#FFFFFF" strokeWidth="10" />
    <path d="M0 500 C62 614 128 746 210 856" fill="none" stroke={RED} strokeWidth="6" />
    <path d="M0 488 C66 604 134 740 222 856" fill="none" stroke="#C9CCD6" strokeWidth="3" />
    {/* bottom right crimson wave */}
    <path d="M170 856 C260 800 360 772 455 760 C490 756 518 752 540 746 V856 Z" fill={RED} />
    <path d="M300 856 C360 830 430 815 540 806 V856 Z" fill={NAVY} opacity="0.9" />
    <path d="M300 856 C360 830 430 815 540 806 V856 Z" fill={`url(#${id}-lines)`} />
  </svg>
);

const Logo: React.FC<{ size: string; faded?: boolean }> = ({ size, faded }) => {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = { width: size, height: size };
  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-full font-bold"
        style={{
          ...style,
          background: faded ? 'transparent' : '#fff',
          border: `${faded ? '0.1em' : '0.25em'} solid ${faded ? '#D3D6DE' : RED}`,
          color: faded ? '#D3D6DE' : RED,
          fontSize: `calc(${size} * 0.32)`,
          fontFamily: CARD_FONT,
        }}
        aria-hidden="true"
      >
        17
      </span>
    );
  }
  return (
    <img
      src={LOGO_URL}
      alt=""
      onError={() => setFailed(true)}
      className="rounded-full object-cover"
      style={{ ...style, opacity: faded ? 0.16 : 1, filter: faded ? 'grayscale(1)' : undefined, background: faded ? 'transparent' : '#fff' }}
    />
  );
};

/** Shared card frame: printed proportions, rounded corners, waves. */
const CardFrame: React.FC<{ id: string; children: React.ReactNode; label: string }> = ({ id, children, label }) => (
  <div
    role="img"
    aria-label={label}
    className="relative w-full overflow-hidden rounded-[4.5cqw] bg-white shadow-[0_18px_40px_-20px_rgba(20,24,60,0.55)] print:shadow-none"
    style={{ aspectRatio: '54 / 85.6', containerType: 'inline-size', fontFamily: CARD_FONT, color: INK }}
  >
    <Waves id={id} />
    {children}
  </div>
);

const Watermarks: React.FC<{ positions: [number, number][]; size?: string }> = ({ positions, size = '10.5cqw' }) => (
  <>
    {positions.map(([x, y], i) => (
      <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }} aria-hidden="true">
        <Logo size={size} faded />
      </span>
    ))}
  </>
);

const TopLogo: React.FC = () => (
  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-[0.7cqw] shadow-sm" style={{ top: '10.6%' }}>
    <Logo size="20.5cqw" />
  </span>
);

const StateRibbon: React.FC<{ state: ReturnType<typeof verificationState> }> = ({ state }) => {
  if (state === 'active') return null;
  const text = { expired: 'EXPIRED', suspended: 'SUSPENDED', revoked: 'REVOKED' }[state];
  return (
    <span
      className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] border-[0.8cqw] px-[4cqw] py-[1cqw] font-bold tracking-[0.15em]"
      style={{ color: DATE_RED, borderColor: DATE_RED, background: 'rgba(255,255,255,0.85)', fontSize: '9cqw' }}
    >
      {text}
    </span>
  );
};

const CalendarIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" style={{ width: '8cqw', height: '8cqw' }} aria-hidden="true">
    <rect x="2.5" y="4" width="19" height="17.5" rx="2" fill="none" stroke={NAVY} strokeWidth="1.8" />
    <rect x="2.5" y="4" width="19" height="4.5" fill={NAVY} />
    <line x1="7" y1="2" x2="7" y2="6" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="17" y1="2" x2="17" y2="6" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" />
    {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
      <rect key={`${r}-${c}`} x={5 + c * 3.8} y={11 + r * 3.3} width="2.4" height="2.1" fill={NAVY} />
    )))}
  </svg>
);

interface CardProps {
  member: Pick<MemberRecord, 'fullName' | 'memberNumber' | 'designation' | 'photoUrl' | 'validFrom' | 'expiresAt' | 'joinedAt' | 'status' | 'verifyUrl'>;
  /** Council or department shown under the position, e.g. "London Council". */
  unit?: string;
}

export const MemberCardFront: React.FC<CardProps> = ({ member, unit }) => {
  const state = verificationState(member.status, member.expiresAt);
  return (
    <CardFrame id="front" label={`Membership card for ${member.fullName}, ${member.memberNumber}`}>
      <TopLogo />
      <Watermarks positions={[
        [12.5, 21.5], [25, 21.5], [12.5, 29], [25, 29], [12.5, 36.5], [25, 36.5], [12.5, 44], [25, 44],
        [75, 21.5], [87.5, 21.5], [75, 29], [87.5, 29], [75, 36.5], [87.5, 36.5], [75, 44], [87.5, 44],
      ]} />

      {/* photo */}
      <div className="absolute left-1/2 -translate-x-1/2 overflow-hidden bg-[#E9EAF0]" style={{ top: '19.8%', width: '33%', aspectRatio: '1 / 1.27' }}>
        {member.photoUrl ? (
          <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-bold" style={{ fontSize: '11cqw', color: '#9EA3B8' }}>
            {member.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 text-center" style={{ top: unit ? '48.6%' : '49.5%' }}>
        <p className="font-bold leading-tight" style={{ fontSize: '5.9cqw', padding: '0 7cqw' }}>{member.fullName}</p>
        <p style={{ fontSize: '4.3cqw', marginTop: '1.4cqw' }}>Member ID: {member.memberNumber}</p>
        <span
          className="mx-auto mt-[3.4cqw] inline-flex items-center justify-center rounded-[1.6cqw] text-center font-bold leading-[1.1] text-white"
          style={{ background: NAVY, fontSize: pillSize(member.designation || 'Member'), minWidth: '43cqw', maxWidth: '86cqw', padding: '2cqw 4cqw', letterSpacing: '0.03em' }}
        >
          {(member.designation || 'Member').toUpperCase()}
        </span>
        {unit && <p className="font-bold" style={{ fontSize: '3.5cqw', marginTop: '1.1cqw', color: NAVY }}>{unit}</p>}
      </div>

      <div className="absolute" style={{ top: unit ? '73%' : '71.2%', left: '33%', fontSize: '4.1cqw' }}>
        <div className="flex items-center gap-[3cqw]">
          <CalendarIcon />
          <div className="leading-[1.15]">
            <p>Valid from:</p>
            <p style={{ color: DATE_RED, fontSize: '4.7cqw' }}>{cardDate(member.validFrom) || '—'}</p>
          </div>
        </div>
        <div className="mt-[2.4cqw] flex items-center gap-[3cqw]">
          <CalendarIcon />
          <div className="leading-[1.15]">
            <p>Expires on:</p>
            <p style={{ color: DATE_RED, fontSize: '4.7cqw' }}>{cardDate(member.expiresAt) || '—'}</p>
          </div>
        </div>
      </div>
      <StateRibbon state={state} />
    </CardFrame>
  );
};

/** Long position titles get smaller type so they fit the pill on one or two lines. */
const pillSize = (t: string) => (t.length <= 14 ? '5.8cqw' : t.length <= 20 ? '4.8cqw' : t.length <= 26 ? '4cqw' : '3.5cqw');

/** QR code for the member's fixed verification link, with the "17" mark in
 *  the middle like the printed card (high error correction keeps it readable). */
export const MemberQr: React.FC<{ url: string; size?: string }> = ({ url, size = '42cqw' }) => {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 0, color: { dark: '#111111', light: '#ffffff' } })
      .then((s) => { if (!cancelled) setSvg(s); })
      .catch(() => setSvg(''));
    return () => { cancelled = true; };
  }, [url]);
  return (
    <div className="relative bg-white" style={{ width: size, height: size }}>
      <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <span
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center bg-white font-bold leading-none"
        style={{ width: '24%', height: '24%', fontFamily: 'Georgia, serif', color: '#111' }}
        aria-hidden="true"
      >
        <span style={{ fontSize: '3.4cqw' }}>17</span>
        <span style={{ fontSize: '0.95cqw', letterSpacing: '0.08em', fontFamily: CARD_FONT }}>SHUBAT</span>
      </span>
    </div>
  );
};

export const MemberCardBack: React.FC<CardProps> = ({ member }) => (
  <CardFrame id="back" label={`Back of membership card ${member.memberNumber}, with verification QR code`}>
    <TopLogo />
    <Watermarks positions={[
      [26, 23], [42, 23], [58, 23], [74, 23],
      [9.5, 31], [9.5, 40], [9.5, 49], [9.5, 58],
      [90.5, 31], [90.5, 40], [90.5, 49], [90.5, 58],
      [26, 65], [42, 65], [58, 65], [74, 65],
    ]} />
    <div className="absolute inset-x-[16%] text-center" style={{ top: '30.5%', fontSize: '3.7cqw', lineHeight: 1.25 }}>
      <p className="font-bold" style={{ fontSize: '4.7cqw' }}>17 Shubat for Human Rights</p>
      <p>Registered in England and Wales</p>
      <p className="mt-[2.6cqw] font-bold">Nature of business:</p>
      <p>Research and experimental development on social sciences and humanities</p>
      <p className="mt-[2.6cqw]"><span className="font-bold">Company Registration Number:</span> 16809857</p>
      <p className="mt-[2.2cqw]"><span className="font-bold">Email:</span> info@17shubat.org.uk</p>
    </div>
    {member.joinedAt && (
      <p className="absolute inset-x-0 text-center" style={{ top: '66.6%', fontSize: '3.4cqw' }}>
        <span className="font-bold">Member since:</span> {cardDate(member.joinedAt)}
      </p>
    )}
    <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '72%' }}>
      {member.verifyUrl ? (
        <MemberQr url={member.verifyUrl} size="25cqw" />
      ) : (
        <div className="flex items-center justify-center bg-white text-center" style={{ width: '25cqw', height: '25cqw', fontSize: '3cqw', color: '#6B7085' }}>
          QR code appears once the card is issued
        </div>
      )}
    </div>
  </CardFrame>
);
