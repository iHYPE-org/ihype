import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Re-encodes the 512 Play icon as a 32-bit PNG.
 *
 * `public/icons/icon-512.png` is colour type 2 — 24-bit RGB, no alpha. Play
 * asks for a 32-bit PNG, and while an opaque 24-bit file is usually accepted,
 * "usually" is a bad thing to discover in a rejection email. A canvas export
 * from Chromium is always RGBA, so drawing the icon onto an OPAQUE white
 * canvas and exporting gives colour type 6 with every alpha byte at 255 — the
 * 32-bit shape Play documents, with no transparency, which is the other half
 * of the rule (Play applies its own shape mask and refuses a transparent icon).
 */
const src = readFileSync('public/icons/icon-512.png').toString('base64');

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage();
const dataUrl = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  // Paint the ground first: any transparent pixel in the source becomes white
  // rather than being carried through as alpha.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  ctx.drawImage(img, 0, 0, 512, 512);
  return c.toDataURL('image/png');
}, src);
await browser.close();

const out = process.argv[2] ?? 'play-icon-512-32bit.png';
writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));

/* Assert the shape rather than trusting the encoder. */
const d = readFileSync(out);
const width = d.readUInt32BE(16), height = d.readUInt32BE(20);
const depth = d[24], colourType = d[25];
if (width !== 512 || height !== 512) throw new Error(`expected 512x512, got ${width}x${height}`);
if (depth !== 8 || colourType !== 6) throw new Error(`expected 8-bit RGBA (type 6), got depth ${depth} type ${colourType}`);
console.log(`wrote ${out} — ${width}x${height}, 8-bit, colour type ${colourType} (RGBA = 32-bit)`);
