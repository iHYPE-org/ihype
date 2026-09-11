import { describe, it, expect } from 'vitest';
// @ts-expect-error - next.config.mjs is untyped JS at the repo root, the same
// way `next-config-redirects.test.ts` reaches it.
import nextConfig from '../../../next.config.mjs';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ORG_IDENTITY,
  EIN_PATTERN,
  formatAddress,
  isPublicIdentityComplete,
  type OrgIdentity,
} from '../org-identity';

const root = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('organisation identity', () => {
  it('holds the brand constants this product is allowed to name', () => {
    // CLAUDE.md: admin@ihype.org is the only contact address and ihype.org the
    // only domain. A transparency page naming another is the loudest possible
    // place to break that.
    expect(ORG_IDENTITY.contactEmail).toBe('admin@ihype.org');
    expect(ORG_IDENTITY.website).toBe('https://ihype.org');
    expect(ORG_IDENTITY.foundedIn).toBe('Portland, Maine');
    expect(ORG_IDENTITY.foundedYear).toBe(2026);
  });

  it('refuses an EIN that is not shaped like one', () => {
    // The value is null until the determination letter is read. When it is
    // set, this is what stops a transposed, truncated or placeholder value
    // being published as a federal identifier — the failure mode that makes an
    // absent EIN preferable to a wrong one.
    if (ORG_IDENTITY.ein !== null) {
      expect(ORG_IDENTITY.ein).toMatch(EIN_PATTERN);
    }
    expect('12-3456789').toMatch(EIN_PATTERN);
    expect('XX-XXXXXXX').not.toMatch(EIN_PATTERN);
    expect('123456789').not.toMatch(EIN_PATTERN);
  });

  it('formats an address on one line, and says nothing when there is none', () => {
    expect(formatAddress(null)).toBeNull();
    expect(
      formatAddress({
        line1: '1 Example St',
        line2: 'Suite 2',
        city: 'Portland',
        region: 'ME',
        postalCode: '04101',
        country: 'US',
      }),
    ).toBe('1 Example St, Suite 2, Portland, ME 04101, US');
  });

  it('reports completeness from the three fields a reviewer checks', () => {
    const complete: OrgIdentity = {
      ...ORG_IDENTITY,
      legalName: 'Example Org',
      ein: '12-3456789',
      address: { line1: '1 Example St', city: 'Portland', region: 'ME', postalCode: '04101', country: 'US' },
    };
    expect(isPublicIdentityComplete(complete)).toBe(true);
    expect(isPublicIdentityComplete({ ...complete, ein: null })).toBe(false);
    expect(isPublicIdentityComplete({ ...complete, legalName: null })).toBe(false);
    expect(isPublicIdentityComplete({ ...complete, address: null })).toBe(false);
  });
});

describe('where the organisation identity is published', () => {
  it('renders inside the panel both surfaces share', () => {
    // ONE component, so the public hub and the signed-in shell cannot drift
    // about who runs iHYPE. Asserted on the panel rather than on either page,
    // because the panel is what both of them mount.
    const panel = read('src/components/info/TransparencyPanel.tsx');
    expect(panel).toContain('OrganizationFacts');

    expect(read('src/app/info/page.tsx')).toContain('TransparencyPanel');
    expect(read('src/app/app/me/info/transparency/page.tsx')).toContain('TransparencyPanel');
  });

  it('is reachable from the logged-out landing page', () => {
    // The reviewer's path. `/app/me/info/transparency` is behind auth and can
    // never serve this purpose, so the landing footer must carry a public link.
    const landing = read('src/components/FanFirstLanding.tsx');
    expect(landing).toContain('/info?tab=transparency');
  });

  it('answers the short public URL with a real redirect, not a meta refresh', async () => {
    // `redirect()` in a page cannot answer 307 under src/app/loading.tsx — it
    // renders a 200 carrying <meta http-equiv="refresh">, measured against
    // production. A config redirect resolves in the router before any
    // rendering. Every public legal alias lives here for that reason.
    const rules: { source: string; destination: string }[] = await nextConfig.redirects();
    const bySource = (source: string) => rules.filter((r) => r.source === source);

    for (const [source, destination] of [
      ['/transparency', '/info?tab=transparency'],
      ['/privacy', '/info?tab=privacy'],
      ['/terms', '/info?tab=terms'],
      ['/audit', '/info?tab=trust'],
      ['/charter', '/info?tab=charter'],
      ['/about', '/info?tab=charter'],
    ] as const) {
      const matches = bySource(source);
      expect(matches, `${source} must be a config redirect`).not.toHaveLength(0);
      expect(matches[0].destination).toBe(destination);
    }
  });

  it('keeps no page-level redirect behind those URLs', () => {
    // A config redirect resolves first, so a page left here could never run.
    // Dead code that cannot execute is the thing this repository's audits
    // exist to remove, and a reader finding one would reasonably believe the
    // page is what serves the URL.
    for (const dir of ['transparency', 'privacy', 'terms', 'audit', 'charter', 'about']) {
      expect(existsSync(join(root, 'src/app', dir, 'page.tsx')), `src/app/${dir} should be gone`).toBe(false);
    }
  });
});
