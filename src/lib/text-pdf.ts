/**
 * A minimal plain-text PDF (PDF 1.4, Helvetica, US Letter), written by hand so
 * a signed agreement can be emailed and downloaded without a PDF library in a
 * budgeted Worker bundle. It lays out wrapped lines of text across as many
 * pages as it takes and does nothing else — no images, no fonts to embed.
 *
 * Helvetica is one of the PDF standard fonts every reader carries, in the
 * WinAnsi encoding: characters outside it are mapped to the nearest ASCII
 * (a dash for a minus, straight quotes) rather than dropped, so a signed
 * agreement never loses a word to the encoding.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const LEADING = 13.5;
/** Helvetica averages ~0.5em per character; conservative so lines never overrun. */
const CHARS_PER_LINE = Math.floor((PAGE_W - MARGIN * 2) / (FONT_SIZE * 0.52));
const LINES_PER_PAGE = Math.floor((PAGE_H - MARGIN * 2) / LEADING);

const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, '·': 0xb7, '×': 0xd7, '°': 0xb0, '§': 0xa7,
};
const ASCII_FALLBACK: Record<string, string> = { '−': '-', '≥': '>=', '≤': '<=', '→': '->', '✓': 'v' };

/** One byte per character, escaped for a PDF string literal. */
function encodeLine(line: string): string {
  let out = '';
  for (const ch of line) {
    let code = ch.charCodeAt(0);
    if (ch in ASCII_FALLBACK) { out += encodeLine(ASCII_FALLBACK[ch]); continue; }
    if (ch in WIN_ANSI) code = WIN_ANSI[ch];
    else if (code > 0xff || (code >= 0x80 && code < 0xa0)) code = 0x3f; // '?'
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return out;
}

export function wrapText(text: string, width = CHARS_PER_LINE): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    if (raw.length <= width) { lines.push(raw); continue; }
    const indent = raw.match(/^\s*(- )?/)?.[0].replace('-', ' ') ?? '';
    let rest = raw;
    let first = true;
    while (rest.length > 0) {
      const room = first ? width : width - indent.length;
      if (rest.length <= room) { lines.push((first ? '' : indent) + rest); break; }
      let cut = rest.lastIndexOf(' ', room);
      if (cut <= 0) cut = room;
      lines.push((first ? '' : indent) + rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
      first = false;
    }
  }
  return lines;
}

/** Returns the PDF as bytes. */
export function renderTextPdf(text: string, title: string): Uint8Array {
  const lines = wrapText(text);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  if (pages.length === 0) pages.push(['']);

  const objects: string[] = [];
  // 1 catalog, 2 pages, 3 font, then (page, content) pairs.
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  pages.forEach((pageLines, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const body = [
      'BT',
      `/F1 ${FONT_SIZE} Tf`,
      `${LEADING} TL`,
      `${MARGIN} ${PAGE_H - MARGIN} Td`,
      ...pageLines.map((l) => `(${encodeLine(l)}) '`),
      'ET',
      'BT',
      `/F1 8 Tf ${MARGIN} ${MARGIN / 2} Td (${encodeLine(`${title} · page ${i + 1} of ${pages.length}`)}) Tj`,
      'ET',
    ].join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });

  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // Every character above is a single byte (encodeLine guarantees it), so a
  // latin-1 byte copy is exact and the xref offsets stay true.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
