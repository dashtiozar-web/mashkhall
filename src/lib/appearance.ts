import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Typography and reading settings chosen by administrators (Administration ›
 * Appearance), stored in site_settings/appearance and applied for every
 * visitor. Only the approved fonts below can be chosen; they are all hosted
 * on our own website and every Kurdish and Arabic one draws all the Sorani
 * letters (ڕ ڵ ێ ۆ ە).
 */

export interface FontOption { id: string; label: string; stack: string; sample: string }

export const LATIN_FONTS: FontOption[] = [
  { id: 'source-sans', label: 'Source Sans 3 (clear sans-serif)', stack: "'Source Sans 3 Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", sample: 'Human rights, freedom of expression and accountability.' },
  { id: 'source-serif', label: 'Source Serif 4 (book serif)', stack: "'Source Serif 4 Variable', 'Iowan Old Style', Georgia, serif", sample: 'Human rights, freedom of expression and accountability.' },
];

export const RTL_FONTS: FontOption[] = [
  { id: 'noto-sans-arabic', label: 'Noto Sans Arabic (clear, modern)', stack: "'Noto Sans Arabic Variable', 'Noto Sans Arabic', sans-serif", sample: 'مافی مرۆڤ، ئازادیی ڕادەربڕین و لێپرسینەوە' },
  { id: 'vazirmatn', label: 'Vazirmatn (rounded, very legible on phones)', stack: "'Vazirmatn Variable', 'Noto Sans Arabic Variable', sans-serif", sample: 'مافی مرۆڤ، ئازادیی ڕادەربڕین و لێپرسینەوە' },
  { id: 'noto-naskh', label: 'Noto Naskh Arabic (traditional book style)', stack: "'Noto Naskh Arabic Variable', 'Noto Naskh Arabic', serif", sample: 'مافی مرۆڤ، ئازادیی ڕادەربڕین و لێپرسینەوە' },
  { id: 'noto-kufi', label: 'Noto Kufi Arabic (strong, for headings)', stack: "'Noto Kufi Arabic Variable', 'Noto Sans Arabic Variable', sans-serif", sample: 'مافی مرۆڤ، ئازادیی ڕادەربڕین و لێپرسینەوە' },
];

export interface Appearance {
  /** Body and interface text in English. */
  latinBody: string;
  /** Headings and article titles in English. */
  latinHeading: string;
  /** Body and interface text in Kurdish and Arabic. */
  rtlBody: string;
  /** Headings and article titles in Kurdish and Arabic. */
  rtlHeading: string;
  /** Text size for everyone, as a percentage of the visitor's own browser setting. */
  textScale: number;
  /** Line spacing for reading. */
  lineSpacing: 'standard' | 'relaxed';
}

export const DEFAULT_APPEARANCE: Appearance = {
  latinBody: 'source-sans', latinHeading: 'source-serif', rtlBody: 'noto-sans-arabic', rtlHeading: 'noto-naskh', textScale: 100, lineSpacing: 'standard',
};
export const TEXT_SCALES = [100, 106, 112, 120];

const pick = (list: FontOption[], id: string, fallback: string) => (list.find((f) => f.id === id) || list.find((f) => f.id === fallback)!).stack;

export const cleanAppearance = (raw: Partial<Appearance> | null | undefined): Appearance => {
  const a = { ...DEFAULT_APPEARANCE, ...(raw || {}) };
  return {
    latinBody: LATIN_FONTS.some((f) => f.id === a.latinBody) ? a.latinBody : DEFAULT_APPEARANCE.latinBody,
    latinHeading: LATIN_FONTS.some((f) => f.id === a.latinHeading) ? a.latinHeading : DEFAULT_APPEARANCE.latinHeading,
    rtlBody: RTL_FONTS.some((f) => f.id === a.rtlBody) ? a.rtlBody : DEFAULT_APPEARANCE.rtlBody,
    rtlHeading: RTL_FONTS.some((f) => f.id === a.rtlHeading) ? a.rtlHeading : DEFAULT_APPEARANCE.rtlHeading,
    textScale: TEXT_SCALES.includes(Number(a.textScale)) ? Number(a.textScale) : 100,
    lineSpacing: a.lineSpacing === 'relaxed' ? 'relaxed' : 'standard',
  };
};

/** Set the CSS variables the stylesheet reads (src/index.css). */
export const applyAppearance = (raw: Partial<Appearance> | null | undefined) => {
  if (typeof document === 'undefined') return;
  const a = cleanAppearance(raw);
  const s = document.documentElement.style;
  s.setProperty('--f-sans', pick(LATIN_FONTS, a.latinBody, 'source-sans'));
  s.setProperty('--f-serif', pick(LATIN_FONTS, a.latinHeading, 'source-serif'));
  s.setProperty('--f-arabic-ui', pick(RTL_FONTS, a.rtlBody, 'noto-sans-arabic'));
  s.setProperty('--f-kurdish', pick(RTL_FONTS, a.rtlHeading, 'noto-naskh'));
  s.setProperty('--text-scale', String(a.textScale / 100));
  s.setProperty('--reading-leading', a.lineSpacing === 'relaxed' ? '1.85' : '1.65');
  s.setProperty('--reading-leading-rtl', a.lineSpacing === 'relaxed' ? '2' : '1.8');
  try { localStorage.setItem('17shubat_appearance', JSON.stringify(a)); } catch { /* storage blocked */ }
};

/** Apply the last known settings at once (no flash), then the current ones from the database. */
export const loadAppearance = () => {
  try { const saved = localStorage.getItem('17shubat_appearance'); if (saved) applyAppearance(JSON.parse(saved)); } catch { /* storage blocked */ }
  getDoc(doc(db, 'site_settings', 'appearance'))
    .then((d) => applyAppearance(d.exists() ? (d.data() as Partial<Appearance>) : null))
    .catch(() => undefined);
};
