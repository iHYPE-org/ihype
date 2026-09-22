import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ownsWholeScreen } from '@/lib/chrome-visibility';

/**
 * The operator console must never carry member chrome, and the reason this
 * is a unit test rather than a stylesheet is the whole point of the module:
 * the CSS that used to do it keys on `.ops-shell`, which does not exist
 * while /admin's async layout awaits auth, cookies and a device lookup.
 */
describe('ownsWholeScreen', () => {
  it('claims the admin console and everything under it', () => {
    for (const p of ['/admin', '/admin/users', '/admin/device-register', '/admin/review?tab=verifications']) {
      expect(ownsWholeScreen(p), p).toBe(true);
    }
  });

  it('claims nothing a member reaches', () => {
    for (const p of ['/', '/app/map', '/app/me', '/shows/x', '/info', '/login', '/administrators']) {
      expect(ownsWholeScreen(p), p).toBe(false);
    }
  });

  it('is false rather than throwing when middleware set no header', () => {
    /* `x-pathname` is absent wherever middleware did not run. Falling to
       false renders the normal site chrome, which is the safe direction —
       the opposite would strip navigation off every page on one bad deploy. */
    expect(ownsWholeScreen(null)).toBe(false);
    expect(ownsWholeScreen(undefined)).toBe(false);
    expect(ownsWholeScreen('')).toBe(false);
  });

  it('is what the root layout actually consults', () => {
    /* A predicate nothing calls is the defect `audit:mounts` exists for. */
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain('ownsWholeScreen');
    for (const chrome of ['<AdaptiveSiteHeader', '<SitePlayerDock />']) {
      expect(layout, chrome).toMatch(/wholeScreen/);
    }
  });

  it('leaves no header destination pointing at a route that was deleted', () => {
    /* The deleted tab bar's "Dashboard" pointed at `/pages` for ten days after
       that route was removed — it only worked because next.config.mjs
       redirects it. The header's four links are MMM_NAV, so the manifest is
       what is read. */
    const nav = readFileSync('src/lib/mmm-nav.ts', 'utf8');
    for (const dead of ["href: '/pages'", "href: '/listen'", "href: '/discover'", "href: '/radio'"]) {
      expect(nav, dead).not.toContain(dead);
    }
    /* And the header is where they are drawn — a manifest nothing renders is
       the `audit:mounts` defect. */
    const header = readFileSync('src/components/AdaptiveSiteHeader.tsx', 'utf8');
    expect(header).toContain('MMM_NAV.map(');
    expect(header).toContain("aria-current={on ? 'page' : undefined}");
  });
});
