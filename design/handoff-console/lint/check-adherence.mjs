#!/usr/bin/env node
// check-adherence.mjs — dependency-free console-skin adherence check.
// Usage: node check-adherence.mjs <dir...> [--max=0]
// Replaces lint/_adherence.oxlintrc.json (needed eslint-only rules; does not run under oxlint).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const args = process.argv.slice(2);
const max = Number((args.find(a => a.startsWith('--max=')) ?? '--max=0').split('=')[1]);
const roots = args.filter(a => !a.startsWith('--'));
const EXT = new Set(['.tsx', '.ts', '.jsx', '.css']);
const TOKEN_FILES = /mmm-console\.css$|ihype-console\.css$|tokens[\/\\]/;
let cssSrc = ''; try { cssSrc = readFileSync(new URL('../production/mmm-console.css', import.meta.url), 'utf8'); } catch {}
const TOKEN_HEX = new Set((cssSrc.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(h => h.toLowerCase()));
const FONTS = ['bricolage grotesque', 'work sans', 'jetbrains mono', 'instrument serif', 'sans-serif', 'serif', 'monospace', 'system-ui', 'var('];
const RADII = new Set(['3px', '8px', '16px', '9999px', '50%', '2px', '0']);
const findings = [];
function scan(file) {
  if (TOKEN_FILES.test(file)) return;
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const hex of line.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
      if (!TOKEN_HEX.has(hex.toLowerCase())) findings.push(file + ":" + (i + 1) + " raw hex " + hex + " — not a token in mmm-console.css");
    }
    const ff = line.match(/font-family:\s*([^;"\'}]+)/i);
    if (ff && !FONTS.some(f => ff[1].toLowerCase().includes(f))) findings.push(file + ":" + (i + 1) + " font " + ff[1].trim() + " outside allowlist");
    const br = line.match(/border-radius:\s*([\d.]+px|[\d.]+%)/i);
    if (br && !RADII.has(br[1])) findings.push(file + ":" + (i + 1) + " radius " + br[1] + " off-scale (3|8|16|9999px)");
  });
}
function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p); else if (EXT.has(extname(p))) scan(p);
  }
}
roots.forEach(r => statSync(r).isDirectory() ? walk(r) : scan(r));
findings.forEach(f => console.log(f));
console.log(findings.length + " finding(s), max allowed " + max);
process.exit(findings.length > max ? 1 : 0);
