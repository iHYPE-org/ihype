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
