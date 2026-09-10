import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { MAX_BEHIND, assessRestoreSchema } from '../../../scripts/assert-restore-schema.mjs';

/**
 * The nightly restore drill's schema window. A dump can trail `main` by a
 * merge or two (it ran before the merge); it can never lead it, and it cannot
 * trail by a week without the backup workflow having stopped.
 */
describe('assessRestoreSchema', () => {
  const expected = Array.from({ length: 10 }, (_, i) => `2026090100000${i}_m${i}`);

  it('passes a current restore and one inside the window', () => {
    expect(assessRestoreSchema({ restored: 10, latestRestored: expected[9], expected })).toMatchObject({ ok: true, behind: 0 });
    expect(assessRestoreSchema({ restored: 10 - MAX_BEHIND, latestRestored: expected[9 - MAX_BEHIND], expected })).toMatchObject({ ok: true, behind: MAX_BEHIND });
  });

  it('fails a stale restore, a restore ahead of the code, an empty one, and a foreign history', () => {
    expect(assessRestoreSchema({ restored: 10 - MAX_BEHIND - 1, latestRestored: null, expected }).ok).toBe(false);
    expect(assessRestoreSchema({ restored: 11, latestRestored: null, expected }).ok).toBe(false);
    expect(assessRestoreSchema({ restored: 0, latestRestored: null, expected }).ok).toBe(false);
    expect(assessRestoreSchema({ restored: 10, latestRestored: '20260901000099_elsewhere', expected }).ok).toBe(false);
  });

  it('the real migrations directory is what the drill compares against, and it is not empty', () => {
    const dirs = readdirSync('prisma/migrations', { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name));
    expect(dirs.length).toBeGreaterThan(100);
  });
});
