import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { LOGO_URL } from './ui';
import { cardDate, verificationState } from '../lib/membership';
import { MemberRecord } from '../types';

/**
 * Digital membership card, reproduced from the printed plastic card:
 * crimson and dark waves, 35 coloured flames behind everything (35 years),
 * the large colour torch, the photo, name, member ID, a navy role badge and red validity dates on the
 * front; organisation details and the QR code on the back.
 *
 * The card keeps the printed proportions (54 × 85.6 mm) and scales with its
 * container, so it stays sharp on phones, tablets and when printed.
 */

const RED = '#B3261E';
const RED_DARK = '#8E1730';
const NAVY = '#5A1A0E';
const INK = '#26160F';
const DATE_RED = '#B3261E';
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
          border: `${faded ? '0.1em' : '0.25em'} solid ${faded ? '#DCCFBE' : RED}`,
          color: faded ? '#DCCFBE' : RED,
          fontSize: `calc(${size} * 0.32)`,
          fontFamily: CARD_FONT,
        }}
        aria-hidden="true"
      >
        MZ
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
    <Flames id={id} />
    {children}
  </div>
);

/**
 * 35 flames, one for each year of anger at the failures of the Kurdish
 * authorities, set in a 5 × 7 grid behind everything on the card.
 */
const FLAME_COLS = [10, 30, 50, 70, 90];
const FLAME_ROWS = [6.5, 20.3, 34.1, 47.9, 61.7, 75.5, 89.3];
export const FLAME_COUNT = FLAME_COLS.length * FLAME_ROWS.length; // 35

const FlameMark: React.FC<{ id: string; size: string; tilt: number }> = ({ id, size, tilt }) => (
  <svg viewBox="0 0 40 60" style={{ width: size, height: `calc(${size} * 1.5)`, transform: `rotate(${tilt}deg)` }} aria-hidden="true">
    <path
      d="M20 1 C25 13 37 21 37 38 C37 51 29.5 59 20 59 C10.5 59 3 51 3 38 C3 27 11 21 13.5 10 C17 19 18.5 23 20 25.5 C21.5 17 23 9 20 1 Z"
      fill={`url(#${id})`}
    />
    <path
      d="M20 29 C24 35 29 40 29 47.5 C29 54 25 58 20 58 C15 58 11 54 11 47.5 C11 42 15 38 16.5 32.5 C18 37 19 38.5 20 39.5 C20.6 36 21 33 20 29 Z"
      fill="#FFE07A"
    />
  </svg>
);

const Flames: React.FC<{ id: string }> = ({ id }) => (
  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
    <svg width="0" height="0" className="absolute">
      <defs>
        <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4161C" />
          <stop offset="0.55" stopColor="#F2631C" />
          <stop offset="1" stopColor="#FFB21F" />
        </linearGradient>
      </defs>
    </svg>
    {FLAME_ROWS.map((y, r) => FLAME_COLS.map((x, c) => (
      <span
        key={`${r}-${c}`}
        className="absolute"
        style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', opacity: 0.62 }}
      >
        <FlameMark id={`${id}-flame`} size="8.5cqw" tilt={(r + c) % 2 ? 7 : -7} />
      </span>
    )))}
  </div>
);

/** Soft light plate so text stays readable over the flames. */
const plate: React.CSSProperties = { background: 'radial-gradient(closest-side, rgba(255,255,255,0.92), rgba(255,255,255,0.75) 70%, rgba(255,255,255,0))' };

const TopLogo: React.FC = () => (
  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-[0.7cqw] shadow-sm" style={{ top: '10.6%' }}>
    <Logo size="20.5cqw" />
  </span>
);

/** The full-colour logo, large and clear on the front of the card. */
const BigLogo: React.FC = () => (
  <span
    className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white p-[1cqw]"
    style={{ top: '2.2%', boxShadow: '0 0 0 0.6cqw #F2A93B, 0 0 3.5cqw rgba(255,170,40,0.75), 0 1cqw 2cqw rgba(0,0,0,0.35)' }}
  >
    <Logo size="33cqw" />
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
      <BigLogo />

      {/* photo */}
      <div className="absolute left-1/2 -translate-x-1/2 overflow-hidden border-[0.8cqw] border-white bg-[#E9EAF0] shadow-[0_1cqw_2.5cqw_rgba(0,0,0,0.25)]" style={{ top: '26.6%', width: '28%', aspectRatio: '1 / 1.27' }}>
        {member.photoUrl ? (
          <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-bold" style={{ fontSize: '11cqw', color: '#9EA3B8' }}>
            {member.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </span>
        )}
      </div>

      <div className="absolute inset-x-[4%] py-[1.5cqw] text-center" style={{ ...plate, top: unit ? '49.8%' : '50.5%' }}>
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

      <div className="absolute" style={{ ...plate, top: unit ? '74%' : '72.5%', left: '28%', padding: '1.5cqw 4cqw', fontSize: '4.1cqw' }}>
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

/** QR code for the member's fixed verification link, with the torch mark in
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
      <img
        src="/logo-512.png"
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-[0.6cqw] border-white bg-white"
        style={{ width: '24%', height: '24%' }}
      />
    </div>
  );
};

export const MemberCardBack: React.FC<CardProps> = ({ member }) => (
  <CardFrame id="back" label={`Back of membership card ${member.memberNumber}, with verification QR code`}>
    <TopLogo />
    <div className="absolute inset-x-[8%] py-[2cqw] text-center" style={{ ...plate, top: '29%', fontSize: '3.7cqw', lineHeight: 1.25 }}>
      <p className="font-bold" style={{ fontSize: '4.7cqw' }}>Mashkhally Zhyanawa Organisation</p>
      <p className="font-kurdish" style={{ fontSize: '4.4cqw' }} lang="ckb" dir="rtl" translate="no">مەشخەڵی ژیانەوە</p>
      <p className="mt-[2.6cqw]">The Torch of Revival</p>
      <p className="mt-[2.2cqw]"><span className="font-bold">Email:</span> info@mashkhall.com</p>
      <p className="mt-[2.6cqw] italic" style={{ fontSize: '3.1cqw', color: NAVY }}>35 flames for 35 years</p>
    </div>
    {member.joinedAt && (
      <p className="absolute inset-x-[20%] text-center" style={{ ...plate, top: '66.3%', fontSize: '3.4cqw', padding: '0.6cqw 0' }}>
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
