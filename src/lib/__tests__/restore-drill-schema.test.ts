import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { MAX_BEHIND, assessRestoreSchema, migrationDirectories } from '../../../scripts/assert-restore-schema.mjs';

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

  /*
    This test used to restate the /^\d{14}_/ rule the script was using, so it
    agreed with the script and neither of them agreed with Prisma. It reads
    through `migrationDirectories` now: a check and its test asserting the same
    invented shape prove only that the invention is consistent.
  */
  it('counts a migration the way Prisma does — every directory holding a migration.sql', () => {
    const counted = migrationDirectories();
    const directories = readdirSync('prisma/migrations', { withFileTypes: true }).filter((d) => d.isDirectory());
    expect(counted.length).toBeGreaterThan(100);
    expect(counted.length).toBe(directories.filter((d) => existsSync(`prisma/migrations/${d.name}/migration.sql`)).length);
  });

  /*
    The four that a 14-digit rule discards. Naming them is the point: the drill
    read 127 against a restore of 131 and called a current dump AHEAD of the
    code, which is the one verdict it treats as fatal.
  */
  it('counts the migrations whose directory name is not a 14-digit timestamp', () => {
    const counted = migrationDirectories();
    for (const name of ['0001_init', '20260612_add_weekly_digest_sent_at', '20260612_push_subscription_segments', '20260613_admin_device_token']) {
      expect(counted).toContain(name);
    }
  });
});
