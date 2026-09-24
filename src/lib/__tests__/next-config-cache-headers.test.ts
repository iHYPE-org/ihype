import { describe, expect, it } from 'vitest';
// @ts-expect-error - next.config.mjs is untyped JS at the repo root.
import nextConfig from '../../../next.config.mjs';

/**
 * No path is served with a `public` Cache-Control from next.config.mjs
 * (2026-09-24, DESIGN_SYNC row 513).
 *
 * `/shows/:slug` was `public, s-maxage=30` while the page rendered the
 * viewer's RSVP and hype, the organiser's own order figures and ad play tokens
 * bound to the listener, and the service worker trusts a response's own
 * Cache-Control, so it served a member their previous render stale-first. The
 * root layout also seeds the member's session into every document it renders,
 * so a `public` header on any page is one account's HTML offered to a shared
 * cache. A public asset belongs in `public/` or a route handler that sets its
 * own header, never in this list.
 */
describe('next.config.mjs headers', () => {
  it('marks no path public', async () => {
    const rules = await nextConfig.headers();
    const offenders: string[] = [];
    for (const rule of rules as Array<{ source: string; headers: Array<{ key: string; value: string }> }>) {
      for (const header of rule.headers) {
        if (header.key.toLowerCase() === 'cache-control' && /\bpublic\b/i.test(header.value)) {
          offenders.push(`${rule.source}: ${header.value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
