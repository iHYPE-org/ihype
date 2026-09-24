import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

function walkSource(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walkSource(path, out); }
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

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
    // A SCAN, not a list (row 513): a list of two files passes a third writer
    // that forgets the memo, which is exactly the writer this exists to catch.
    // A write is an atomic operator or a literal number; `userSecurityVersion: true`
    // is a select and `userSecurityVersion: user.userSecurityVersion` a copy.
    const writesVersion = /userSecurityVersion:\s*(\{\s*(increment|decrement|set|multiply)\b|\d)/;
    const bumpers = walkSource(join(root, 'src'))
      .filter((file) => writesVersion.test(maskComments(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(root.length + 1));
    expect(bumpers.sort()).toEqual(['src/app/admin/users/actions.ts', 'src/lib/privacy-actions.ts']);
    for (const bumper of bumpers) {
      const source = readFileSync(join(root, bumper), 'utf8');
      expect(source, `${bumper} must forget the memo it just invalidated`).toMatch(/forgetSessionUser\(/);
    }
  });

  it('the wallet is the one surface that pays for ticket QR codes, and it pays for nothing else', () => {
    const tickets = readFileSync(join(root, 'src/app/app/tickets/page.tsx'), 'utf8');
    const me = readFileSync(join(root, 'src/app/app/me/page.tsx'), 'utf8');
    const lib = readFileSync(join(root, 'src/lib/mmm-me.ts'), 'utf8');
    // Row 513: the wallet reads its tickets alone, not the whole ME board.
    expect(tickets).toMatch(/loadWalletTickets\(/);
    expect(tickets).not.toMatch(/loadMmmMe\(/);
    expect(me).not.toMatch(/loadWalletTickets|buildTicketQrCodeDataUrl/);
    // The QR encode lives in the wallet loader and nowhere else in the ME lib.
    const wallet = lib.slice(lib.indexOf('export async function loadWalletTickets'), lib.indexOf('export async function loadMmmMe'));
    expect(wallet).toMatch(/buildTicketQrCodeDataUrl/);
    expect(lib.slice(lib.indexOf('export async function loadMmmMe'))).not.toMatch(/buildTicketQrCodeDataUrl|loadWalletTickets/);
  });
});

/**
 * The cold-load half (DESIGN_SYNC row 511): the bytes every shell screen
 * downloaded for surfaces it was not showing. Each is again one line whose
 * absence nothing else sees — the map still draws, Sentry still reports, the
 * tabs still fill — only later.
 */
describe('Listen rows are in the document (row 512)', () => {
  it('the MUSIC page bootstraps the active tab\'s first reads and preloads only what the bootstrap did not answer', () => {
    const page = readFileSync(join(root, 'src/app/app/music/[tab]/page.tsx'), 'utf8');
    expect(page).toMatch(/import \{ bootstrapMusicPayloads \} from '@\/lib\/mmm-music-bootstrap'/);
    expect(page).toMatch(/const initialPayloads = await bootstrapMusicPayloads\(firstReads\)/);
    // One list feeds both: the bootstrap and the preload fallback.
    expect(page).toMatch(/const firstReads = musicTabFirstReads\(/);
    expect(page).toMatch(/if \(!\(url in initialPayloads\.payloads\)\) preload\(url, \{ as: 'fetch', crossOrigin: 'anonymous' \}\)/);
    expect(page).toMatch(/initialPayloads=\{initialPayloads\}/);
  });

  it('useJson renders the server\'s payload in its FIRST render and never fetches a URL it was handed', () => {
    const music = readFileSync(join(root, 'src/components/mmm/MmmMusic.tsx'), 'utf8');
    const hook = music.slice(music.indexOf('function useJson<T>'), music.indexOf('return state;', music.indexOf('function useJson<T>')));
    // Read through context, so the tabs need no prop threading.
    expect(hook).toMatch(/const initial = useContext\(InitialPayloadsContext\)/);
    // The initializer prefers it — that is the hydration match.
    const initializer = hook.slice(hook.indexOf('useState<'), hook.indexOf('useEffect('));
    expect(initializer.indexOf('initialPayload !== undefined')).toBeGreaterThan(-1);
    expect(initializer.indexOf('initialPayload !== undefined')).toBeLessThan(initializer.indexOf('cached'));
    // The effect seeds the client cache from it, stamped with the SERVER's read
    // time, and fetches only when that moment is already outside the TTL.
    const effect = hook.slice(hook.indexOf('useEffect('));
    const seedAt = effect.indexOf('tabPayloadCache.set(url, { payload: initialPayload, at: initialAt })');
    expect(seedAt).toBeGreaterThan(-1);
    expect(seedAt).toBeLessThan(effect.indexOf('fetchTabPayload(url)'));
    expect(effect.slice(seedAt, effect.indexOf('fetchTabPayload(url)'))).toMatch(/Date\.now\(\) - shownAt < tabPayloadTtl\(url\)/);
    // A reading the browser took after the server's wins (Back replays the
    // server payload), and the member's own library is never fresh for a
    // minute — a write anywhere changes it (row 513).
    expect(effect).toMatch(/existing\.at > initialAt \? existing : null/);
    expect(music).toMatch(/const OWN_LIBRARY_READS = \['\/api\/fan-favorites', '\/api\/likes', '\/api\/fan-playlists', '\/api\/media-listens'\]/);
    // Row 509's sibling warmer is gone: the server's answer wins, so a warmed
    // payload would never be read.
    expect(music).not.toMatch(/useWarmSiblingTabs|prefetchTabPayloads/);
    // The provider is the ONLY writer of the context, and the default is frozen.
    expect(music).toMatch(/const EMPTY_PAYLOADS: InitialPayloads = Object\.freeze\(\{ at: 0, payloads: Object\.freeze\(\{\}\) \}\)/);
    expect(music.match(/<InitialPayloadsContext\.Provider /g)?.length).toBe(1);
  });
});

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
    expect(entry).not.toMatch(/^import \* as Sentry from '@sentry\//m);
    expect(entry).toMatch(/loadBrowserSentry\(\)\.then\(init\)/);
    // Not before the page is up: the shared loader's load listener and idle callback.
    const loader = readFileSync(join(root, 'src/lib/browser-sentry.ts'), 'utf8');
    expect(loader).toContain("import('@sentry/browser')");
    expect(loader).toMatch(/addEventListener\('load'/);
    expect(loader).toMatch(/requestIdleCallback/);
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
    expect(music).toMatch(/import \{ discoverSeedsUrl \} from '@\/lib\/mmm-music-reads'/);
    // No second copy of either: one table, one seeds URL builder.
    expect(music).not.toMatch(/const TAB_WARM_URLS|const TAB_FIRST_READS/);
    expect(music).not.toMatch(/\/api\/discover\/seeds\?/);
    // The fetch the preload must match: same URL, default credentials.
    expect(music).toMatch(/fetch\(url, \{ cache: 'no-store' \}\)/);
  });
});
