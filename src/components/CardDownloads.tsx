import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2 } from 'lucide-react';
import { MemberCardBack, MemberCardFront } from './MemberCard';

/*
 * Downloads of the whole membership card, front and back, exactly as it
 * looks on screen: one image with both sides, each side on its own (for card
 * printers), and a PDF with both sides at real card size (54 × 85.6 mm) for
 * printing on paper.
 */

type CardMember = React.ComponentProps<typeof MemberCardFront>['member'];

/** Width the card is drawn at for capture; the image is scaled up from it. */
const DRAW_WIDTH = 340;
/** Pixels across one side of the card in the images (about 600 dpi). */
const SIDE_PX = 1276;
const GAP_PX = 80;

const capture = async (node: HTMLElement) => {
  const { toCanvas } = await import('html-to-image');
  if ('fonts' in document) await document.fonts.ready;
  return toCanvas(node, {
    pixelRatio: SIDE_PX / node.offsetWidth,
    cacheBust: true,
    // A picture that cannot be read is left blank rather than stopping the download.
    imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  });
};

const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be made.'))), type, quality));

const sideBySide = (front: HTMLCanvasElement, back: HTMLCanvasElement, background?: string) => {
  const c = document.createElement('canvas');
  c.width = front.width + GAP_PX + back.width;
  c.height = Math.max(front.height, back.height);
  const ctx = c.getContext('2d')!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(front, 0, 0);
  ctx.drawImage(back, front.width + GAP_PX, 0);
  return c;
};

/** A one-page A4 PDF with both sides at real card size, side by side, with light cut marks. */
const cardPdf = (front: Uint8Array, back: Uint8Array, fw: number, fh: number, title: string) => {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const add = (chunk: string | Uint8Array) => { const b = typeof chunk === 'string' ? enc.encode(chunk) : chunk; parts.push(b); length += b.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = length; add(`${n} 0 obj\n`); body(); add('\nendobj\n'); };
  const mm = 72 / 25.4;
  const pw = 595.28, ph = 841.89;
  const cw = 54 * mm, ch = 85.6 * mm, gap = 10 * mm;
  const x1 = (pw - (2 * cw + gap)) / 2, x2 = x1 + cw + gap, y = ph - 40 * mm - ch;
  const mark = (x: number, yy: number, w: number, h: number) => {
    const m = 3 * mm, o = 1.5 * mm;
    return [
      [x - o - m, yy, x - o, yy], [x, yy - o - m, x, yy - o], [x + w + o, yy, x + w + o + m, yy], [x + w, yy - o - m, x + w, yy - o],
      [x - o - m, yy + h, x - o, yy + h], [x, yy + h + o, x, yy + h + o + m], [x + w + o, yy + h, x + w + o + m, yy + h], [x + w, yy + h + o, x + w, yy + h + o + m],
    ].map(([a, b, c, d]) => `${a.toFixed(2)} ${b.toFixed(2)} m ${c.toFixed(2)} ${d.toFixed(2)} l S`).join('\n');
  };
  const content = [
    `q ${cw.toFixed(2)} 0 0 ${ch.toFixed(2)} ${x1.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`,
    `q ${cw.toFixed(2)} 0 0 ${ch.toFixed(2)} ${x2.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`,
    `q 0.6 G 0.3 w ${mark(x1, y, cw, ch)}\n${mark(x2, y, cw, ch)} Q`,
  ].join('\n');
  const safe = title.replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R /Im1 5 0 R >> >> /Contents 6 0 R >>`));
  const img = (n: number, jpeg: Uint8Array) => obj(n, () => { add(`<< /Type /XObject /Subtype /Image /Width ${fw} /Height ${fh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); add(jpeg); add('\nendstream'); });
  img(4, front);
  img(5, back);
  obj(6, () => add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`));
  obj(7, () => add(`<< /Title (${safe}) /Producer (Mashkhally Zhyanawa Organisation) >>`));
  const xref = length;
  add(`xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 8 /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
};

/** White behind the rounded corners, for JPEG inside the PDF. */
const onWhite = (c: HTMLCanvasElement) => {
  const out = document.createElement('canvas');
  out.width = c.width; out.height = c.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0);
  return out;
};

type Kind = 'both' | 'front' | 'back' | 'pdf';

export const CardDownloads: React.FC<{ member: CardMember; unit?: string; className?: string }> = ({ member, unit, className = '' }) => {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState('');
  const base = `Mashkhally-Zhyanawa-card-${member.memberNumber || 'member'}`;

  const run = async (kind: Kind) => {
    if (!frontRef.current || !backRef.current || busy) return;
    setBusy(kind);
    setError('');
    try {
      const front = kind === 'back' ? null : await capture(frontRef.current);
      const back = kind === 'front' ? null : await capture(backRef.current);
      if (kind === 'front' && front) save(await toBlob(front, 'image/png'), `${base}-front.png`);
      if (kind === 'back' && back) save(await toBlob(back, 'image/png'), `${base}-back.png`);
      if (kind === 'both' && front && back) save(await toBlob(sideBySide(front, back), 'image/png'), `${base}.png`);
      if (kind === 'pdf' && front && back) {
        const f = new Uint8Array(await (await toBlob(onWhite(front), 'image/jpeg', 0.92)).arrayBuffer());
        const b = new Uint8Array(await (await toBlob(onWhite(back), 'image/jpeg', 0.92)).arrayBuffer());
        save(cardPdf(f, b, front.width, front.height, `Membership card ${member.memberNumber || ''}`), `${base}.pdf`);
      }
    } catch {
      setError('The card could not be downloaded. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const btn = (kind: Kind, label: string, strong = false) => (
    <button type="button" onClick={() => run(kind)} disabled={Boolean(busy)}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold disabled:opacity-60 ${strong ? 'bg-navy text-white hover:bg-navy-deep' : 'border border-line hover:border-ink/40'}`}>
      {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
        <span className="text-ink-soft">Download the whole card:</span>
        {btn('both', 'Front and back (PNG)', true)}
        {btn('front', 'Front')}
        {btn('back', 'Back')}
        {btn('pdf', 'PDF for printing')}
      </div>
      {error && <p className="mt-2 text-[0.875rem] text-crimson" role="alert">{error}</p>}
      {/* Copies of both sides drawn out of sight at a fixed size, for the downloads. */}
      {createPortal(
        <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, display: 'flex', gap: 20, pointerEvents: 'none' }}>
          <div ref={frontRef} style={{ width: DRAW_WIDTH }}><MemberCardFront member={member} unit={unit} /></div>
          <div ref={backRef} style={{ width: DRAW_WIDTH }}><MemberCardBack member={member} /></div>
        </div>,
        document.body,
      )}
    </div>
  );
};
