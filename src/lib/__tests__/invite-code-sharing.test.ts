import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kvDel, kvPut } from '@/lib/kv';
import { isInviteCodeSharingEnabledRuntime } from '@/lib/runtime-flags';

afterEach(async () => {
  await kvDel('flags:invite_code_sharing');
});

/**
 * `invite_code_sharing` decides which KEYS fit the door `invite_only_signup`
 * shut. While it is off, the landing page's request form is the only way in:
 * an admin issues each approved requester a single-use `InviteCode`, and
 * neither a shared `BETA_INVITE_CODES` string nor a member's endlessly
 * re-usable HYPE link will admit anyone.
 */
describe('invite code sharing flag', () => {
  it('is closed by default', async () => {
    expect(await isInviteCodeSharingEnabledRuntime()).toBe(false);
  });

  it('defaults closed rather than open when KV cannot be read', async () => {
    // The direction is the whole point. `getRuntimeFlag` falls back when the
    // override is absent or unreadable, so a fallback of `true` would mean an
    // unreachable KV silently re-opens signup to anyone holding a shared code.
    await kvDel('flags:invite_code_sharing');
    expect(await isInviteCodeSharingEnabledRuntime()).toBe(false);
  });

  it('opens without a deploy when an admin flips it', async () => {
    await kvPut('flags:invite_code_sharing', '1');
    expect(await isInviteCodeSharingEnabledRuntime()).toBe(true);
    await kvPut('flags:invite_code_sharing', '0');
    expect(await isInviteCodeSharingEnabledRuntime()).toBe(false);
  });

  it('is settable from the admin console', async () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/admin/flags/route.ts'), 'utf8');
    expect(route).toContain("'invite_code_sharing'");
  });
});

/**
 * `/admin`'s feature-flag block reads a positional `Promise.all`, so a new flag
 * has to be added in BOTH the destructuring and the await list or every flag
 * after it silently shifts by one — the "Invite-only signup" pill would then be
 * reporting some other switch's state, which is the worst possible failure for
 * a board whose entire job is telling an operator which doors are open. Adding
 * this flag nearly did exactly that.
 */
describe('admin feature flag wiring', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/admin/page.tsx'), 'utf8');

  // Anchored on the destructuring, which appears once — `] = await
  // Promise.all([` alone does not, and matching the first one reads a
  // different block entirely.
  const start = source.indexOf('  const [\n    demoLoginsEnabled');
  const flagAwait = source.slice(start, source.indexOf('\n  ]);', start));
  const [namesBlock, callsBlock] = flagAwait.split('] = await Promise.all([');

  it('destructures exactly as many names as it awaits', () => {
    expect(start).toBeGreaterThan(-1);
    const names = namesBlock.split('\n').filter((line) => /^\s{4}\w+,$/.test(line));
    const calls = callsBlock.split('\n').filter((line) => /^\s{4}\S.*\(.*\),$/.test(line));
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBe(calls.length);
  });

  it('renders a toggle for every flag the API will accept', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/admin/flags/route.ts'), 'utf8');
    const allowedBlock = route.slice(
      route.indexOf('const ALLOWED_FLAGS'),
      route.indexOf(']);', route.indexOf('const ALLOWED_FLAGS')),
    );
    const allowed = [...allowedBlock.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(allowed).toContain('invite_code_sharing');
    const listStart = source.indexOf('  const featureFlags = [');
    const flagList = source.slice(listStart, source.indexOf('\n  ];', listStart));
    for (const flag of allowed) {
      expect(flagList, `no /admin toggle for ${flag}`).toContain(`key: '${flag}'`);
    }
  });
});
