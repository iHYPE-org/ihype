import { describe, expect, it } from 'vitest';
// @ts-expect-error - next.config.mjs is untyped JS at the repo root.
import nextConfig from '../../../next.config.mjs';

/**
 * Guards the one config-redirect defect that only ever appears in production.
 *
 * A `has` condition whose value regex matches the EMPTY STRING is accepted by
 * OpenNext for a request that does not carry the key at all — its matcher runs
 * `new RegExp(value).test(query[key] ?? '')`, where Next's own router bails on
 * the absent value first. When the destination re-emits that capture, OpenNext
 * then hands `''` to path-to-regexp's `compile`, which throws on an empty
 * required param. The throw becomes a 500.
 *
 * That is exactly what bare `/legal` did on ihype.org while `next start`
 * answered a clean 307 locally: the rule was written `(?<tab>.*)`. So neither
 * a build, a local smoke run, nor reading the rule could have caught it — only
 * curling production, or this test.
 */
describe('next.config.mjs redirects', () => {
  it('has no `has`/`missing` regex that matches the empty string', async () => {
    const redirects = await nextConfig.redirects();
    const offenders: string[] = [];

    for (const rule of redirects) {
      for (const condition of [...(rule.has ?? []), ...(rule.missing ?? [])]) {
        const value = condition.value;
        if (typeof value !== 'string') continue;
        if (new RegExp(`^${value}$`).test('')) {
          offenders.push(`${rule.source} (${condition.type} ${condition.key ?? ''}: ${value})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('carries the /legal tab across and defaults the bare URL', async () => {
    const redirects = await nextConfig.redirects();
    const legal = redirects.filter((r: { source: string }) => r.source === '/legal');

    // Order is load-bearing: OpenNext takes the FIRST rule whose regex and
    // `has` both match, so the capturing rule has to precede the fallback.
    expect(legal).toHaveLength(2);
    expect(legal[0].has).toBeDefined();
    expect(legal[0].destination).toBe('/info?tab=:tab');
    expect(legal[1].has).toBeUndefined();
    expect(legal[1].destination).toBe('/info?tab=terms');
  });
});
