#!/usr/bin/env node
/**
 * Turns the Tax Foundation's "State and Local Sales Tax Rates" workbook into
 * the JSON table ticket tax reads (`src/lib/tax/us-sales-tax-rates.json`).
 *
 *   npm run tax:import                 re-derive the JSON from the committed xlsx
 *   npm run tax:import -- --check      exit 1 if the JSON disagrees with the xlsx
 *
 * THE REFERENCE IS COMMITTED, NOT FETCHED. `data/tax/` holds the exact workbook
 * the table was derived from, so a rate on a receipt can always be traced to a
 * published figure and a date. To take a new year's rates: download the new
 * workbook from https://taxfoundation.org/data/all/state/sales-tax-rates/,
 * replace the file, update SOURCE below, run this, and read the diff.
 *
 * No dependency and no system tool: an .xlsx is a zip of XML, so the zip's
 * central directory is read here and each entry inflated with node:zlib, and
 * this workbook is one sheet of numbers, so two regular expressions read it. Rates are stored
 * as integer PARTS PER MILLION (6.875% = 68750) so no float ever meets a cent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const XLSX = resolve(ROOT, 'data/tax/tax-foundation-2026-sales-tax-rates.xlsx');
const OUT = resolve(ROOT, 'src/lib/tax/us-sales-tax-rates.json');
const SOURCE = {
  publisher: 'Tax Foundation',
  title: 'State and Local Sales Tax Rates, 2026',
  asOf: '2026-01-01',
  url: 'https://taxfoundation.org/data/all/state/sales-tax-rates/',
  workbook: 'https://taxfoundation.org/wp-content/uploads/2026/01/2026-Sales-Tax-Data.xlsx',
};

const STATE_CODES = {
  Alabama: 'al', Alaska: 'ak', Arizona: 'az', Arkansas: 'ar', California: 'ca', Colorado: 'co',
  Connecticut: 'ct', Delaware: 'de', Florida: 'fl', Georgia: 'ga', Hawaii: 'hi', Idaho: 'id',
  Illinois: 'il', Indiana: 'in', Iowa: 'ia', Kansas: 'ks', Kentucky: 'ky', Louisiana: 'la',
  Maine: 'me', Maryland: 'md', Massachusetts: 'ma', Michigan: 'mi', Minnesota: 'mn',
  Mississippi: 'ms', Missouri: 'mo', Montana: 'mt', Nebraska: 'ne', Nevada: 'nv',
  'New Hampshire': 'nh', 'New Jersey': 'nj', 'New Mexico': 'nm', 'New York': 'ny',
  'North Carolina': 'nc', 'North Dakota': 'nd', Ohio: 'oh', Oklahoma: 'ok', Oregon: 'or',
  Pennsylvania: 'pa', 'Rhode Island': 'ri', 'South Carolina': 'sc', 'South Dakota': 'sd',
  Tennessee: 'tn', Texas: 'tx', Utah: 'ut', Vermont: 'vt', Virginia: 'va', Washington: 'wa',
  'West Virginia': 'wv', Wisconsin: 'wi', Wyoming: 'wy', 'District of Columbia': 'dc', 'D.C.': 'dc',
};

const ZIP = readFileSync(XLSX);

function unzip(entry) {
  // End of central directory: the last record whose signature is 0x06054b50.
  let eocd = ZIP.length - 22;
  while (eocd >= 0 && ZIP.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('Not a zip archive.');
  let at = ZIP.readUInt32LE(eocd + 16);
  const entries = ZIP.readUInt16LE(eocd + 10);
  for (let i = 0; i < entries; i += 1) {
    const method = ZIP.readUInt16LE(at + 10);
    const size = ZIP.readUInt32LE(at + 20);
    const nameLength = ZIP.readUInt16LE(at + 28);
    const extraLength = ZIP.readUInt16LE(at + 30);
    const commentLength = ZIP.readUInt16LE(at + 32);
    const local = ZIP.readUInt32LE(at + 42);
    const name = ZIP.toString('utf8', at + 46, at + 46 + nameLength);
    if (name === entry) {
      const start = local + 30 + ZIP.readUInt16LE(local + 26) + ZIP.readUInt16LE(local + 28);
      const data = ZIP.subarray(start, start + size);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return inflateRawSync(data).toString('utf8');
      throw new Error(`Unsupported zip compression method ${method} for ${entry}.`);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${entry} is not in the workbook.`);
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const shared = [...unzip('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
  .map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));

function cell(rowXml, column) {
  const m = new RegExp(`<c r="${column}\\d+"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(rowXml);
  if (!m || !m[2]) return null;
  const v = /<v>([\s\S]*?)<\/v>/.exec(m[2]);
  if (!v) return null;
  return /t="s"/.test(m[1]) ? shared[Number(v[1])] : Number(v[1]);
}

const toPpm = (rate) => Math.max(0, Math.round(rate * 1_000_000));

const rates = {};
for (const row of unzip('xl/worksheets/sheet1.xml').matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
  const name = cell(row[1], 'A');
  const stateRate = cell(row[1], 'B');
  const avgLocal = cell(row[1], 'D');
  if (typeof name !== 'string' || typeof stateRate !== 'number' || typeof avgLocal !== 'number') continue;
  const key = name.replace(/\s*\(.*?\)\s*/g, '').trim();
  const code = STATE_CODES[key];
  if (!code) continue;
  // A negative average local rate (New Jersey's Salem County half-rate zone)
  // is a discount relative to the state rate; the ticket estimate never adds
  // a negative line, so it is clamped to zero.
  rates[code] = { stateRatePpm: toPpm(stateRate), avgLocalRatePpm: toPpm(avgLocal) };
}

const count = Object.keys(rates).length;
if (count !== 51) {
  console.error(`Expected 50 states and DC, read ${count}. The workbook's layout may have changed.`);
  process.exit(2);
}

const sorted = Object.fromEntries(Object.entries(rates).sort(([a], [b]) => a.localeCompare(b)));
const json = `${JSON.stringify({ source: SOURCE, rates: sorted }, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== json) {
    console.error('src/lib/tax/us-sales-tax-rates.json does not match the committed workbook. Run npm run tax:import.');
    process.exit(1);
  }
  console.log(`Sales tax table matches the workbook (${count} jurisdictions, as of ${SOURCE.asOf}).`);
} else {
  writeFileSync(OUT, json);
  console.log(`Wrote ${count} jurisdictions to src/lib/tax/us-sales-tax-rates.json (as of ${SOURCE.asOf}).`);
}
