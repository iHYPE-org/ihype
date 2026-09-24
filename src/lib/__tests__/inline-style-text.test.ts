import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An inline stylesheet may not contain the text of a style tag (2026-09-24,
 * DESIGN_SYNC row 513).
 *
 * React's server renderer rewrites that sequence inside a style element's
 * text so the stylesheet cannot close itself early (react-dom-server's
 * `styleRegex`: the `s` becomes the CSS escape `\73 `). The client renderer
 * does no such rewrite, so the text it hydrates against is three characters
 * shorter than the text the browser parsed, and React throws error 418 and
 * re-renders the whole boundary on the client. `/info` did exactly that from
 * 2026-07-29 — a CSS comment in the info tabs' stylesheet named "the charter
 * page's own style block" with the tag written out — and nothing saw it
 * until the layout started seeding the session: before that, the session
 * fetch updated a context mid-hydration, React discarded the boundary without
 * comparing its text, and the mismatch was never checked.
 *
 * Write "style block" in prose. The tag belongs only at the two ends.
 */

const STYLE_TEMPLATE = /<style[^>]*>\{`([\s\S]*?)`\}<\/style>/g;
const TAG_TEXT = /<\/?style/i;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') sourceFiles(path, out);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

export function styleTagsInsideInlineStylesheets(source: string): number[] {
  const lines: number[] = [];
  for (const match of source.matchAll(STYLE_TEMPLATE)) {
    const body = match[1];
    const hit = body.search(TAG_TEXT);
    if (hit < 0) continue;
    const offset = (match.index ?? 0) + match[0].indexOf(body) + hit;
    lines.push(source.slice(0, offset).split('\n').length);
  }
  return lines;
}

describe('inline stylesheets', () => {
  it('finds a style tag written inside an inline stylesheet (probe)', () => {
    const probe = [
      'export function X() {',
      '  return <style>{`',
      '    /* the old page\'s own <style> block */',
      '    .a { color: red; }',
      '  `}</style>;',
      '}',
    ].join('\n');
    expect(styleTagsInsideInlineStylesheets(probe)).toEqual([3]);
    expect(styleTagsInsideInlineStylesheets(probe.replace('<style> block', 'style block'))).toEqual([]);
  });

  it('never contain the text of a style tag', () => {
    const root = join(process.cwd(), 'src');
    const files = sourceFiles(root);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap((file) =>
      styleTagsInsideInlineStylesheets(readFileSync(file, 'utf8')).map((line) => `${relative(process.cwd(), file)}:${line}`),
    );
    expect(offenders, 'write "style block" in prose; React escapes the tag text on the server and not on the client').toEqual([]);
  });
});
