import type { AdvertisingScope } from '@/lib/show-composer';

/**
 * How an ad break is split across reach scopes.
 *
 * The product rule: a break is a MIXTURE, weighted local-most to global-least.
 * A listener should mostly hear the venue down the road, occasionally a
 * national brand, and rarely a global one — that ordering is what makes the
 * inventory worth buying at the local end, which is the end this platform is
 * for.
 *
 * Before this, the always-on station asked for `'national'` and nothing else,
 * so a local advertiser's spot — the cheapest tier and the one a Portland
 * venue would actually buy — could never air anywhere. The scope was being
 * used as a filter when it is a weighting.
 *
 * Pure and dependency-free so the allocation is unit-tested rather than
 * eyeballed against a live catalogue; the DB half lives in
 * `ad-clip-selection.ts`.
 */

/** Relative share of a break's slots, before availability is considered. */
export const SCOPE_WEIGHTS: Record<AdvertisingScope, number> = {
  local: 8,
  regional: 4,
  national: 2,
  global: 1,
};

/** Most-local first. The order ties are broken by, and the order unfilled
 *  slots cascade along. */
export const SCOPE_ORDER: readonly AdvertisingScope[] = ['local', 'regional', 'national', 'global'];

/**
 * Allocates `slots` across the scopes in proportion to `SCOPE_WEIGHTS`,
 * limited by how many spots each scope actually has (`available`).
 *
 * Two rules, both of which exist to stop a thin catalogue from costing the
 * station revenue:
 *
 *  - **A scope can never be allocated more than it has.** Handing `local` four
 *    slots when one local spot is booked would either repeat that spot four
 *    times or leave dead air.
 *  - **Unfilled slots cascade, most-local first.** If local has one spot and
 *    the weights wanted three, the surplus goes to regional, then national,
 *    then global — so the break is always full whenever any inventory exists
 *    at all, and it stays as local as the catalogue allows.
 *
 * Largest-remainder rather than rounding each share independently: rounding
 * gives you a total that is not `slots`, and the error lands on whichever
 * scope happens to sit on a .5 boundary.
 */
export function allocateScopeSlots(
  slots: number,
  available: Record<AdvertisingScope, number>,
): Record<AdvertisingScope, number> {
  const empty = { local: 0, regional: 0, national: 0, global: 0 };
  if (!Number.isFinite(slots) || slots <= 0) return empty;

  const eligible = SCOPE_ORDER.filter((scope) => (available[scope] ?? 0) > 0);
  if (!eligible.length) return empty;

  const totalWeight = eligible.reduce((sum, scope) => sum + SCOPE_WEIGHTS[scope], 0);
  const exact = new Map<AdvertisingScope, number>(
    eligible.map((scope) => [scope, (slots * SCOPE_WEIGHTS[scope]) / totalWeight]),
  );

  const result = { ...empty };
  for (const scope of eligible) {
    result[scope] = Math.min(Math.floor(exact.get(scope) ?? 0), available[scope]);
  }

  // Hand out what rounding left over, then whatever a capped scope could not
  // take. Both passes walk SCOPE_ORDER, so every spare slot goes to the most
  // local scope that still has inventory.
  const byRemainder = [...eligible].sort((a, b) => {
    const remainderDelta = ((exact.get(b) ?? 0) % 1) - ((exact.get(a) ?? 0) % 1);
    if (remainderDelta !== 0) return remainderDelta;
    return SCOPE_ORDER.indexOf(a) - SCOPE_ORDER.indexOf(b);
  });

  const placed = () => SCOPE_ORDER.reduce((sum, scope) => sum + result[scope], 0);
  for (const scope of byRemainder) {
    if (placed() >= slots) break;
    if (result[scope] < available[scope]) result[scope] += 1;
  }
  while (placed() < slots) {
    const next = SCOPE_ORDER.find((scope) => result[scope] < (available[scope] ?? 0));
    if (!next) break;
    result[next] += 1;
  }

  return result;
}
