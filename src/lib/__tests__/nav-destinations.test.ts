import { readFileSync } from 'fs';
import { relative } from 'path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';
import { buildShellNav, type ShellAccount } from '@/lib/app-nav';

/**
 * One nav registry, and nothing else allowed to invent its own destinations.
 *
 * The bug this exists for: `NavDrawer` was a second drawer with its own
 * hand-written list, and it still sent LISTEN to `/listen?tab=…` months after
 * DESIGN_SYNC row 273 moved those four to `/app/music/*`. Row 273 closed the
 * one-way door in the shell's drawer and left this one open — and it was the
 * drawer a phone actually saw, because the shell's chrome only renders on
 * shell routes. Nothing failed; the two lists simply disagreed.
 *
 * A grep is the right shape of check here. The destinations are string
 * literals in components, so no type can relate them, and the only thing that
 * would have caught the drift is asking whether anyone outside the registry is
 * naming a route the registry owns.
 */

const REGISTRY = 'src/lib/app-nav.ts';

// Where a `/listen?tab=` literal is legitimate. `/listen` still exists as the
// six-module deck, so this is about NAVIGATION pointing at it, not about the
// deck's own internals.
const ALLOWED = new Set<string>([
  REGISTRY,
  // The deck itself: its tabs are its own state, addressed by that query.
  'src/components/ListenHome.tsx',
  // Redirect shims that exist to forward these exact legacy URLs.
  'src/app/home/page.tsx',
  'src/app/studio/page.tsx',
]);

describe('navigation destinations', () => {
  it('routes LISTEN into the Music · Map · Me shell, not the legacy deck', () => {
    // A plain fan: no owned profiles, which is the narrowest nav the registry
    // builds and therefore the strictest version of this assertion.
    const account: ShellAccount = { name: 'Test', isAdvertiser: false, canPromote: true };

    const listen = buildShellNav(account).filter((item) => item.section === 'LISTEN');
    expect(listen.length).toBeGreaterThan(0);
    for (const item of listen) {
      expect(item.href.startsWith('/app/')).toBe(true);
      expect(item.href.startsWith('/listen')).toBe(false);
    }
  });

  // The check that would have caught NavDrawer.
  it('has no component inventing its own /listen?tab= destinations', () => {
    const files = globSync('src/{components,app}/**/*.{ts,tsx}', { nodir: true }).sort();
    const offenders = files.filter((file) => {
      const normalized = relative(process.cwd(), file).replace(/\\/g, '/');
      if (ALLOWED.has(normalized)) return false;
      if (normalized.endsWith('.test.ts') || normalized.endsWith('.test.tsx')) return false;
      if (normalized.includes('/ui-preview/')) return false;
      return /href[=:]\s*['"`]\/listen\?tab=/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders).toEqual([]);
  });

  // Two drawers is how the lists drifted. There is one now, and it is the
  // shell's; the marketing header renders the same component.
  it('ships exactly one drawer component', () => {
    const drawers = globSync('src/components/**/*Drawer*.tsx', { nodir: true })
      .map((file) => relative(process.cwd(), file).replace(/\\/g, '/'))
      .sort();
    expect(drawers).toEqual(['src/components/shell/AppShellDrawer.tsx']);
  });
});
