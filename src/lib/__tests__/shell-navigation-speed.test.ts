import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The three configuration halves of the 2026-09-23 speed pass (DESIGN_SYNC
 * row 509), pinned because each is one line whose absence nothing else can
 * see: the shell still renders, every test still passes, and a member simply
 * waits again between tapping a destination and seeing it.
 */
const root = process.cwd();

describe('shell navigation speed (row 509)', () => {
  it('the /app shell has a loading boundary, so a Link prefetch has something to prefetch and a tap answers on the same frame', () => {
    const file = join(root, 'src/app/app/loading.tsx');
    expect(existsSync(file), 'src/app/app/loading.tsx is the boundary; without it every /app/* prefetch is 0 bytes').toBe(true);
    const source = readFileSync(file, 'utf8');
    // The plate every MUSIC tab wears while it waits — one shape for "filling".
    expect(source).toMatch(/mmm-loading/);
    expect(source).toMatch(/aria-busy/);
  });

  it('the client router keeps a dynamic payload it already holds', () => {
    const config = readFileSync(join(root, 'next.config.mjs'), 'utf8');
    expect(config).toMatch(/staleTimes:\s*\{\s*dynamic:\s*\d+/);
  });

  it('the Worker is placed beside the database, and Hyperdrive query caching is not enabled in its stead', () => {
    // Comments stripped first: the block's own comment explains why it is not
    // `mode = "smart"`, and a scanner that reads its own prose acts on it
    // (scripts/lib/mask-comments.mjs exists for exactly this).
    const toml = readFileSync(join(root, 'wrangler.toml'), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    expect(toml).toMatch(/^\[placement\]\s*\n\s*region\s*=\s*"aws:us-east-1"/m);
    // The database is the Supabase origin Hyperdrive fronts; the hint names its region.
    expect(toml).not.toMatch(/mode\s*=\s*"smart"/);
  });

  it('the /app layout awaits the session and no database read', () => {
    const layout = readFileSync(join(root, 'src/app/app/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/from '@\/lib\/db'/);
    expect(layout).toMatch(/await auth\(\)/);
  });

  it("auth()'s security-version read goes through the per-isolate memo, and every version bump forgets it", () => {
    const auth = readFileSync(join(root, 'src/lib/auth.ts'), 'utf8');
    expect(auth).toMatch(/readSessionUser\(token\.sub/);
    for (const bumper of ['src/app/admin/users/actions.ts', 'src/lib/privacy-actions.ts']) {
      const source = readFileSync(join(root, bumper), 'utf8');
      expect(source, `${bumper} bumps userSecurityVersion`).toMatch(/userSecurityVersion:\s*\{\s*increment:\s*1\s*\}/);
      expect(source, `${bumper} must forget the memo it just invalidated`).toMatch(/forgetSessionUser\(/);
    }
  });

  it('the wallet is the one surface that pays for ticket QR codes', () => {
    const tickets = readFileSync(join(root, 'src/app/app/tickets/page.tsx'), 'utf8');
    const me = readFileSync(join(root, 'src/app/app/me/page.tsx'), 'utf8');
    expect(tickets).toMatch(/includeTickets:\s*true/);
    expect(me).not.toMatch(/includeTickets/);
  });
});

/**
 * The cold-load half (DESIGN_SYNC row 511): the bytes every shell screen
 * downloaded for surfaces it was not showing. Each is again one line whose
 * absence nothing else sees — the map still draws, Sentry still reports, the
 * tabs still fill — only later.
 */
describe('shell cold-load weight (row 511)', () => {
  it('MmmMap imports MapLibre only once the map has been the active surface', () => {
    const map = readFileSync(join(root, 'src/components/mmm/MmmMap.tsx'), 'utf8');
    // The latch: set from `active`, never reset, and the ONLY gate on the import.
    expect(map).toMatch(/const \[armed, setArmed\] = useState\(active\)/);
    expect(map).toMatch(/if \(active\) setArmed\(true\)/);
    const importAt = map.indexOf("import('maplibre-gl')");
    const gateAt = map.lastIndexOf('if (!armed || !containerRef.current) return;', importAt);
    expect(importAt, 'the dynamic import is what makes the latch worth anything').toBeGreaterThan(-1);
    expect(gateAt, 'the import runs only under the armed gate').toBeGreaterThan(-1);
    // And the effect re-runs when the latch flips, or arming does nothing.
    expect(map.slice(importAt)).toMatch(/mapRef\.current = null;\s*\};\s*\}, \[armed\]\);/);
  });

  it('the browser Sentry SDK is a dynamic import, loaded after the document, with the pre-load window covered', () => {
    const entry = readFileSync(join(root, 'src/instrumentation-client.ts'), 'utf8');
    expect(entry).not.toMatch(/^import \* as Sentry from '@sentry\/nextjs'/m);
    expect(entry).toContain("import('@sentry/nextjs')");
    // Not before the page is up: a load listener and an idle callback.
    expect(entry).toMatch(/addEventListener\('load'/);
    expect(entry).toMatch(/requestIdleCallback/);
    // The window before the SDK is up is held and replayed, never dropped.
    expect(entry).toMatch(/addEventListener\('error', onError\)/);
    expect(entry).toMatch(/addEventListener\('unhandledrejection', onRejection\)/);
    expect(entry).toMatch(/for \(const error of heldErrors\.splice\(0\)\) mod\.captureException\(error\)/);
  });

  it('Work Sans is not preloaded: the default theme never paints it', () => {
    const layout = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');
    const block = layout.slice(layout.indexOf('const workSans = localFont({'), layout.indexOf('const jetbrainsMono'));
    expect(block).toMatch(/preload:\s*false/);
    // And the claim behind it holds: the default body face is the system stack.
    const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
    const rootBlock = globals.slice(globals.indexOf(':root {'), globals.indexOf('[data-theme="dark"]'));
    expect(rootBlock).not.toMatch(/var\(--font-work/);
  });

  it('the MUSIC page preloads the active tab\'s first reads from the same table the client fetches from', () => {
    const page = readFileSync(join(root, 'src/app/app/music/[tab]/page.tsx'), 'utf8');
    expect(page).toMatch(/import \{ preload \} from 'react-dom'/);
    expect(page).toMatch(/musicTabFirstReads\(tab as MusicTabId, \{ genre, city \}\)/);
    // A bare fetch() sends same-origin credentials; only an anonymous preload matches it.
    expect(page).toMatch(/preload\(url, \{ as: 'fetch', crossOrigin: 'anonymous' \}\)/);
    const music = readFileSync(join(root, 'src/components/mmm/MmmMusic.tsx'), 'utf8');
    expect(music).toMatch(/import \{ TAB_WARM_URLS, discoverSeedsUrl \} from '@\/lib\/mmm-music-reads'/);
    // No second copy of either: one table, one seeds URL builder.
    expect(music).not.toMatch(/const TAB_WARM_URLS/);
    expect(music).not.toMatch(/\/api\/discover\/seeds\?/);
    // The fetch the preload must match: same URL, default credentials.
    expect(music).toMatch(/fetch\(url, \{ cache: 'no-store' \}\)/);
  });
});
