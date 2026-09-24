/**
 * A document with no stylesheet cannot read a CSS variable (2026-09-24,
 * DESIGN_SYNC row 513). Three email-landing pages, the health-alert email and
 * the newsletter confirmation email all wrote `var(--bg)`/`var(--accent)` into
 * HTML that loads no stylesheet, so the heading painted DS8 off-white on the
 * browser's white — measured on production at about 1.1:1.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { standaloneHtmlPage } from '@/lib/standalone-html-page';
import { OG } from '@/app/api/og/palette';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__') walk(path, out); }
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe('standaloneHtmlPage', () => {
  it('paints from literals, never a variable nothing defines', async () => {
    const html = await standaloneHtmlPage('Done', 'You are unsubscribed.', 200).text();
    expect(html).not.toMatch(/var\(--/);
    expect(html).toContain(`background:${OG.bg}`);
    expect(html).toContain(`color:${OG.ink}`);
  });

  it('escapes what it is handed', async () => {
    const html = await standaloneHtmlPage('<script>x</script>', 'a & b', 200).text();
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('HTML built as a string on the server', () => {
  it('never writes a CSS variable into an inline style', () => {
    const offenders: string[] = [];
    for (const file of [...walk('src/app/api'), ...walk('src/lib'), ...walk('workers')]) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // An HTML attribute string (`style="…"`) carrying a var() — the shape
        // that renders in no email client and in no stylesheet-less document.
        if (/style="[^"]*var\(--/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
