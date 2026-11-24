import QRCode from 'qrcode';

const save = (href: string, filename: string) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/**
 * Download a print-ready QR code (PNG, 1200 px, high error correction) with
 * the "17 SHUBAT" mark in the middle, matching the printed card.
 */
export const downloadQrPng = async (url: string, filename: string, size = 1200) => {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'H', margin: 2, width: size, color: { dark: '#111111', light: '#ffffff' } });
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const w = canvas.width;
    const box = Math.round(w * 0.2);
    const x = (w - box) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, x, box, box);
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(box * 0.5)}px Georgia, serif`;
    ctx.fillText('17', w / 2, w / 2 - box * 0.1);
    ctx.font = `bold ${Math.round(box * 0.14)}px Arial, sans-serif`;
    ctx.fillText('SHUBAT', w / 2, w / 2 + box * 0.3);
  }
  save(canvas.toDataURL('image/png'), filename.endsWith('.png') ? filename : `${filename}.png`);
};

/** Download the QR code as an SVG (scales to any size for print shops). */
export const downloadQrSvg = async (url: string, filename: string) => {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: '#111111', light: '#ffffff' } });
  const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  save(href, filename.endsWith('.svg') ? filename : `${filename}.svg`);
  setTimeout(() => URL.revokeObjectURL(href), 2000);
};
