import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/*
 * MEMBER-TYPED TEXT IN HAND-BUILT HTML IS ESCAPED (2026-09-24, row 513).
 *
 * The 2026-09-02 sweep wrote the rule down — `escapeHtml()` on every
 * member-derived value in every hand-built HTML response and email — and
 * tested the FUNCTION, never its callers. Six senders went on interpolating
 * raw profile names, show titles, bios and a model's blurb into mail sent
 * from iHYPE's own verified address; one of them (newsletter subscribe) is
 * unauthenticated and lets the caller pick the recipient. A profile name is
 * 120 characters of free text, which is room for a fake "claim your refund"
 * link.
 *
 * The scan judges one TEMPLATE LITERAL at a time: only a template whose own
 * static text contains an HTML tag is an HTML template, so a plain-text part
 * written on the same line is not flagged (a line-based first draft did
 * exactly that). An interpolation is refused when its expression reads a
 * member-typed field and is not wrapped in an escaper. `.tsx` is out of
 * scope: JSX escapes text by construction.
 */

const ROOT = join(__dirname, '..', '..', '..');
const TAG = /<(?:p|strong|a|div|h[1-6]|li|pre|small|span|td|b|em|table|tr)\b/i;
const MEMBER_FIELD = /(?:\.(?:name|title|bio|genres|description|companyName|contactName|note|city|lastLoginCountry)|\b(?:venueName|profileName|userName|artistName|headlinerName|showTitle|aiBlurb))\s*(?:\?\?\s*(?:'[^']*'|"[^"]*"))?$/;
const WRAPPED = /^(?:escapeHtml|escHtml|encodeURIComponent)\(/;

type Template = { quasi: string; exprs: Array<{ text: string; at: number }> };

function skipQuoted(src: string, i: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
  return j;
}

/** Every template literal in `src`, nested ones included, with its static text. */
export function templatesIn(src: string): Template[] {
  const found: Template[] = [];
  function scan(start: number): number {
    const template: Template = { quasi: '', exprs: [] };
    found.push(template);
    let j = start + 1;
    while (j < src.length) {
      const ch = src[j];
      if (ch === '\\') { template.quasi += src.slice(j, j + 2); j += 2; continue; }
      if (ch === '`') return j;
      if (ch === '$' && src[j + 1] === '{') {
        let k = j + 2;
        let depth = 1;
        const exprStart = k;
        while (k < src.length && depth > 0) {
          const c = src[k];
          if (c === '{') depth += 1;
          else if (c === '}') depth -= 1;
          else if (c === '`') k = scan(k);
          else if (c === '\'' || c === '"') k = skipQuoted(src, k);
          if (depth > 0) k += 1;
        }
        template.exprs.push({ text: src.slice(exprStart, k).trim(), at: exprStart });
        j = k + 1;
        continue;
      }
      template.quasi += ch;
      j += 1;
    }
    return j;
  }
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\'' || ch === '"') i = skipQuoted(src, i);
    else if (ch === '`') i = scan(i);
  }
  return found;
}

export function unescapedMemberText(files: Array<{ path: string; source: string }>): string[] {
  const hits: string[] = [];
  for (const file of files) {
    const masked = maskComments(file.source);
    for (const template of templatesIn(masked)) {
      if (!TAG.test(template.quasi)) continue;
      for (const expr of template.exprs) {
        if (WRAPPED.test(expr.text) || !MEMBER_FIELD.test(expr.text)) continue;
        hits.push(`${file.path}:${masked.slice(0, expr.at).split('\n').length}  \${${expr.text}}`);
      }
    }
  }
  return hits;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(?:ts|mts|mjs|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('hand-built HTML escapes member-typed text', () => {
  const files = [
    ...walk(join(ROOT, 'src', 'lib')),
    ...walk(join(ROOT, 'src', 'app')),
    ...walk(join(ROOT, 'workers')),
  ].map((path) => ({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') }));

  it('scans a plausible number of files', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it('no HTML template interpolates a name, title, bio or blurb raw', () => {
    expect(unescapedMemberText(files)).toEqual([]);
  });

  it('refuses the shapes it exists for, and ignores a plain-text sibling and a comment', () => {
    const dir = mkdtempSync(join(tmpdir(), 'email-escape-probe-'));
    const path = join(dir, 'probe.ts');
    writeFileSync(path, [
      "// `<p>${profile.name}</p>` is quoted in a comment and must not count",
      'export const a = (profile: { name: string }) => ({',
      '  text: `Hi ${profile.name}`,',
      '  html: `<p>Hi <strong>${profile.name}</strong></p>`,',
      '});',
      'export const b = (rows: Array<{ title: string }>) => rows.map((r) => `<li>${r.title ?? \'\'}</li>`).join("");',
      'export const c = (aiBlurb: string) => `<p>${escapeHtml(aiBlurb)}</p>`;',
      'declare function escapeHtml(s: string): string;',
    ].join('\n'));
    const hits = unescapedMemberText([{ path: 'probe.ts', source: readFileSync(path, 'utf8') }]);
    expect(hits).toEqual(["probe.ts:4  ${profile.name}", "probe.ts:6  ${r.title ?? ''}"]);
  });
});
