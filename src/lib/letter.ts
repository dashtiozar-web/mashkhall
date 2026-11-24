import QRCode from 'qrcode';
import { resolveImage } from './media';

/**
 * Appreciation Letters: drawn in the browser (so Kurdish and Arabic names
 * are shaped correctly) and saved as a one-page A4 PDF. The letter is
 * always made from the official award record, so it cannot say anything
 * the organisation did not approve.
 */

export interface Award {
  id: string;
  number: string;
  uid: string;
  name: string;
  photoUrl?: string;
  activityId: string;
  activityTitle: string;
  activityDate: string;
  councilId?: string;
  councilName?: string;
  statement: string;
  issuedAt: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureImage?: string;
  verifyUrl: string;
  status: 'published' | 'revoked' | 'superseded' | 'draft' | 'pending';
  revokedReason?: string;
  revokedAt?: string;
  /** 'direct': issued by an administrator for an achievement; otherwise for taking part in an activity. */
  source?: 'direct' | 'activity';
  kind?: 'letter' | 'certificate';
  category?: string;
  categoryLabel?: string;
  achievement?: string;
  reason?: string;
  /** Date printed on the letter (YYYY-MM-DD). */
  issueDate?: string;
  memberNumber?: string;
  positionTitle?: string;
  /** Replaced by a corrected letter. */
  supersededBy?: string;
  supersededByNumber?: string;
  supersededAt?: string;
  correction?: string;
  replaces?: string;
  replacesNumber?: string;
  createdAt?: string;
  createdByName?: string;
  submittedByName?: string;
  approvedByName?: string;
  history?: { at: string; byName?: string; action: string; note?: string }[];
}

export const documentTitle = (a: Pick<Award, 'kind' | 'source'>) =>
  a.kind === 'certificate' ? 'Certificate of Appreciation' : 'Letter of Appreciation';

const W = 2480; // A4 at 300 dots per inch
const H = 3508;
const NAVY = '#0C1B36';
const CRIMSON = '#A3172C';
const INK = '#1F2622';
const SOFT = '#55606B';

const longDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : '');

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
};

/** Draws text, shrinking it until it fits the width. */
const fitText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, font: string) => {
  let s = size;
  ctx.font = `${font.replace('{s}', String(s))}`;
  while (ctx.measureText(text).width > maxWidth && s > 40) { s -= 4; ctx.font = font.replace('{s}', String(s)); }
  ctx.fillText(text, x, y);
};

const SERIF = '"Source Serif 4 Variable", "Source Serif 4", Georgia, "Noto Naskh Arabic Variable", serif';
const SANS = '"Source Sans 3 Variable", "Source Sans 3", "Noto Sans Arabic Variable", Arial, sans-serif';

/** The letter as a canvas. */
export const drawLetter = async (a: Award): Promise<HTMLCanvasElement> => {
  try {
    await Promise.all([
      document.fonts.load(`600 80px "Source Serif 4 Variable"`),
      document.fonts.load(`400 40px "Source Sans 3 Variable"`),
      document.fonts.load(`600 80px "Noto Naskh Arabic Variable"`, 'ڕێکخراو'),
    ]);
  } catch { /* fallback fonts */ }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot draw the letter.');
  ctx.direction = 'ltr';

  // Paper and frame
  ctx.fillStyle = '#FBF8F2';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 14;
  ctx.strokeRect(110, 110, W - 220, H - 220);
  ctx.strokeStyle = CRIMSON;
  ctx.lineWidth = 4;
  ctx.strokeRect(140, 140, W - 280, H - 280);

  // Logo and organisation
  const logo = await loadImage('/api/logo');
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 430, 190, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, W / 2 - 190, 240, 380, 380);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = NAVY;
  ctx.font = `600 78px ${SERIF}`;
  ctx.fillText('17 Shubat Organisation for Human Rights', W / 2, 740);
  ctx.font = `500 62px "Noto Naskh Arabic Variable", ${SERIF}`;
  ctx.direction = 'rtl';
  ctx.fillText('ڕێکخراوی 17ی شوبات بۆ مافەکانی مرۆڤ', W / 2, 840);
  ctx.direction = 'ltr';
  ctx.fillStyle = CRIMSON;
  ctx.fillRect(W / 2 - 160, 900, 320, 8);

  // Title
  const direct = a.source === 'direct';
  const noun = a.kind === 'certificate' ? 'certificate' : 'letter';
  ctx.fillStyle = INK;
  fitText(ctx, documentTitle(a), W / 2, 1110, W - 500, 150, `600 {s}px ${SERIF}`);
  ctx.fillStyle = SOFT;
  ctx.font = `400 50px ${SANS}`;
  ctx.fillText(a.number ? `No. ${a.number}` : 'Number given when issued', W / 2, 1200);

  // Recipient
  ctx.fillStyle = SOFT;
  ctx.font = `400 60px ${SANS}`;
  ctx.fillText(`This ${noun} is presented to`, W / 2, 1420);
  ctx.fillStyle = NAVY;
  fitText(ctx, a.name, W / 2, 1580, W - 600, 130, `600 {s}px ${SERIF}`);
  let y: number;
  if (direct) {
    ctx.fillStyle = SOFT;
    ctx.font = `400 56px ${SANS}`;
    ctx.fillText([a.memberNumber ? `Member ${a.memberNumber}` : '', a.positionTitle && a.positionTitle !== 'Member' ? a.positionTitle : '', a.councilName ? `${a.councilName} Council` : ''].filter(Boolean).join(' · '), W / 2, 1690);
    ctx.fillStyle = CRIMSON;
    ctx.font = `600 58px ${SANS}`;
    ctx.fillText(`in recognition of ${(a.categoryLabel || 'Special Recognition')}`.toUpperCase(), W / 2, 1830);
    ctx.fillStyle = INK;
    ctx.font = `600 84px ${SERIF}`;
    const lines = wrap(ctx, a.achievement || a.activityTitle, W - 640).slice(0, 3);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 1970 + i * 100));
    y = 1970 + (lines.length - 1) * 100;
  } else {
    ctx.fillStyle = SOFT;
    ctx.font = `400 60px ${SANS}`;
    ctx.fillText('for taking part in', W / 2, 1730);
    ctx.fillStyle = INK;
    ctx.font = `600 84px ${SERIF}`;
    const titleLines = wrap(ctx, a.activityTitle, W - 640).slice(0, 3);
    titleLines.forEach((l, i) => ctx.fillText(l, W / 2, 1870 + i * 100));
    y = 1870 + titleLines.length * 100;
    ctx.fillStyle = SOFT;
    ctx.font = `400 60px ${SANS}`;
    ctx.fillText([longDate(a.activityDate), a.councilName ? `${a.councilName} Council` : ''].filter(Boolean).join(' · '), W / 2, y + 10);
  }

  // Statement
  ctx.fillStyle = INK;
  ctx.font = `400 64px ${SERIF}`;
  y += 170;
  for (const l of wrap(ctx, a.reason || a.statement, W - 700).slice(0, 7)) { ctx.fillText(l, W / 2, y); y += 92; }

  // Signature
  const sigY = 2860;
  ctx.textAlign = 'left';
  if (a.signatureImage) {
    const src = (await resolveImage(a.signatureImage)) || a.signatureImage;
    const sig = await loadImage(src);
    if (sig) {
      const h = 200;
      const w = Math.min(700, (sig.naturalWidth / sig.naturalHeight) * h);
      ctx.drawImage(sig, 300, sigY - h - 30, w, h);
    }
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(300, sigY);
  ctx.lineTo(1150, sigY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 64px ${SERIF}`;
  ctx.fillText(a.signatoryName, 300, sigY + 90);
  ctx.fillStyle = SOFT;
  ctx.font = `400 52px ${SANS}`;
  ctx.fillText(a.signatoryTitle, 300, sigY + 160);
  ctx.fillText(`Issued ${longDate(a.issueDate || a.issuedAt || new Date().toISOString())}`, 300, sigY + 230);

  // Verification
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, a.verifyUrl, { width: 380, margin: 1, color: { dark: NAVY, light: '#FBF8F2' } });
  ctx.drawImage(qr, W - 300 - 380, sigY - 260, 380, 380);
  ctx.textAlign = 'center';
  ctx.font = `400 38px ${SANS}`;
  ctx.fillStyle = SOFT;
  ctx.fillText(`Check this ${noun} at`, W - 300 - 190, sigY + 170);
  // The address on two lines so long codes stay inside the frame.
  const address = a.verifyUrl.replace(/^https:\/\//, '');
  const cut = address.lastIndexOf('/') + 1;
  ctx.fillText(address.slice(0, cut), W - 300 - 190, sigY + 220);
  ctx.font = `600 38px ${SANS}`;
  ctx.fillText(address.slice(cut), W - 300 - 190, sigY + 270);

  const stamp = a.status === 'revoked' ? 'REVOKED' : a.status === 'superseded' ? 'REPLACED' : a.status === 'draft' || a.status === 'pending' ? 'DRAFT' : '';
  if (stamp) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = stamp === 'DRAFT' ? 'rgba(12, 27, 54, 0.14)' : 'rgba(163, 23, 44, 0.28)';
    ctx.font = `700 300px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(stamp, 0, 0);
    ctx.restore();
  }
  return canvas;
};

/** A one-page A4 PDF containing one JPEG picture. */
const pdfFromJpeg = (jpeg: Uint8Array, title: string) => {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const add = (chunk: string | Uint8Array) => {
    const b = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(b);
    length += b.length;
  };
  const obj = (n: number, body: () => void) => { offsets[n] = length; add(`${n} 0 obj\n`); body(); add('\nendobj\n'); };
  const pw = 595.28;
  const ph = 841.89;
  const safe = title.replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { add(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); add(jpeg); add('\nendstream'); });
  obj(5, () => add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  obj(6, () => add(`<< /Title (${safe}) /Producer (17 Shubat Organisation) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`));
  const xref = length;
  add(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
};

export const letterPdf = async (a: Award) => {
  const canvas = await drawLetter(a);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('The letter could not be made.');
  return pdfFromJpeg(new Uint8Array(await blob.arrayBuffer()), `${documentTitle(a)} ${a.number}`);
};

/** Opens the PDF in a new tab, where it can be printed. */
export const printLetter = async (a: Award) => {
  const win = window.open('', '_blank');
  const pdf = await letterPdf(a);
  const url = URL.createObjectURL(pdf);
  if (win) win.location.href = url; else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const downloadLetter = async (a: Award) => {
  const pdf = await letterPdf(a);
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = `17-Shubat-Appreciation-${a.number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
