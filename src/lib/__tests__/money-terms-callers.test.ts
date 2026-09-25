import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONEY_TERMS_VERSION, moneyTermsExample, MONEY_TERMS_EXAMPLE_CENTS } from '@/lib/money-terms';

/* Row 521: the Connect route refuses an artist or venue that did not
   acknowledge the money terms, so a control that calls it without showing the
   terms and sending the version is a button that can only fail. This finds
   every caller rather than trusting a list. */
function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mts)$/.test(name) && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('money terms', () => {
  it('every client caller of the Connect route shows the terms and sends the version', () => {
    const callers = walk(join(process.cwd(), 'src/components')).filter((file) =>
      readFileSync(file, 'utf8').includes("fetch('/api/stripe/connect/onboard'"),
    );
    expect(callers.length).toBeGreaterThanOrEqual(3);
    for (const file of callers) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('MoneyTermsDisclosure');
      expect(source, file).toContain('acceptedMoneyTermsVersion: MONEY_TERMS_VERSION');
    }
  });

  it('the worked example adds back up to the face value and pays iHYPE nothing', () => {
    const example = moneyTermsExample();
    expect(example.faceValueCents).toBe(MONEY_TERMS_EXAMPLE_CENTS);
    expect(example.fee + example.artist + example.venue).toBe(MONEY_TERMS_EXAMPLE_CENTS);
    expect(example.fee).toBeGreaterThan(0);
    expect(MONEY_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
