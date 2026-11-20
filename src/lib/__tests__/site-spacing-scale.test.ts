import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Keep the newly introduced public site and fan landing surfaces on the
// published spacing scale. The global audit:spacing baseline also gates CI,
// but this identifies a regression by surface instead of only a repo total.
const SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const STYLESHEETS = [
  'src/app/site/[slug]/site.css',
  'src/components/fan-first-landing.css',
] as const;

function nearMisses(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const misses: string[] = [];
  for (const rule of source.matchAll(/\b(?:padding|margin|gap)(?:-(?:inline|block|top|bottom|left|right|inline-start|inline-end|block-start|block-end))?\s*:\s*([^;}]+)/g)) {
    if (/calc\(|var\(/.test(rule[1])) continue;
    for (const value of rule[1].matchAll(/-?(\d+(?:\.\d+)?)px/g)) {
      const px = Number(value[1]);
      if (px >= 4 && !SCALE.includes(px) && SCALE.some(rung => Math.abs(rung - px) <= 2)) {
        misses.push(`${rule[0].trim()} (${px}px)`);
      }
    }
  }
  return misses;
}

describe('new site and landing surface spacing', () => {
  for (const stylesheet of STYLESHEETS) {
    it(`${stylesheet} has no near-miss rhythm values`, () => {
      const css = readFileSync(stylesheet, 'utf8');
      expect(nearMisses(css)).toEqual([]);
    });
  }
});
