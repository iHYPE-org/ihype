import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * There are no passwords and no MFA codes in this product, and nothing may
 * quietly assume there are.
 *
 * Sign-in is a passkey or a magic link; the login card says "No passwords.
 * Ever." Yet until 2026-09-14 the schema carried `User.passwordHash`,
 * `mfaSecret`, `mfaEnabledAt` and `mfaBackupCodes`; `POST /api/register`
 * accepted an optional `password` and stored its hash for no login path to
 * read; both seeds hashed one; and `.github/workflows/reset-test-logins.yml`
 * — a one-click `workflow_dispatch` on the Production environment — ran a
 * script that DELETED EVERY ROW of `Passkey`, `Session`, `MagicLinkToken` and
 * `PasswordResetCode` and set one shared password hash on EVERY user, with no
 * WHERE clause anywhere, in order to reset five demo logins. For an account
 * whose only credential is a passkey and which has no email (the passkey
 * signup asks for neither), that is permanent lockout — and the MFA columns
 * the script nulled existed, so the transaction would have committed.
 *
 * A comment saying "no passwords" is not coverage, so this test reads the
 * artefacts: the schema, the register route, and every workflow.
 *
 * `PasswordResetCode` is deliberately NOT refused. The model is misnamed —
 * it is the store for the six-digit EMAIL VERIFICATION code
 * (`email-verification.ts` says so) — and renaming a table is a migration for
 * a naming complaint. The column-level names are the ones this guard holds.
 */

const ROOT = process.cwd();

function walk(dir: string, keep: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === 'node_modules' || entry.name.startsWith('.') && dir === ROOT
        ? []
        : walk(join(dir, entry.name), keep)
      : keep(entry.name) ? [join(dir, entry.name)] : [],
  );
}

describe('no passwords, no MFA', () => {
  const schema = maskComments(readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8'));

  it('the User model carries no password or MFA column', () => {
    const start = schema.indexOf('model User {');
    const user = schema.slice(start, schema.indexOf('\n}', start));
    expect(start).toBeGreaterThan(-1);
    expect(user).not.toMatch(/passwordHash|mfaSecret|mfaEnabledAt|mfaBackupCodes/);
    /* No model at all may grow a password-shaped column; the one allowed name
       is the misnamed email-code table, matched as a MODEL, not a column. */
    const columnNames = [...schema.matchAll(/^\s{2}(\w+)\s+\S+/gm)].map((match) => match[1]);
    /* `passwordResetCodes` is the User side of that misnamed relation. */
    expect(columnNames.filter((name) => /password|mfa/i.test(name) && name !== 'passwordResetCodes')).toEqual([]);
  });

  it('registration accepts no password', () => {
    const route = maskComments(readFileSync(join(ROOT, 'src/app/api/register/route.ts'), 'utf8'));
    expect(route).not.toMatch(/\bpassword\s*:/);
    expect(route).not.toMatch(/bcrypt/);
  });

  it('no application, seed or script code hashes or stores a password', () => {
    const files = [
      ...walk(join(ROOT, 'src'), (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)),
      ...walk(join(ROOT, 'prisma'), (name) => /\.ts$/.test(name)),
      ...walk(join(ROOT, 'scripts'), (name) => /\.(mjs|mts|ts)$/.test(name)),
      ...walk(join(ROOT, 'workers'), (name) => /\.ts$/.test(name)),
    ];
    expect(files.length).toBeGreaterThan(200);
    const offenders = files
      .filter((file) => /passwordHash|mfaSecret|mfaBackupCodes|mfaEnabledAt/.test(maskComments(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
    /* bcrypt hashes exactly one thing here: the email verification code. */
    const bcryptUsers = files
      .filter((file) => /from 'bcryptjs'/.test(maskComments(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(ROOT.length + 1).replaceAll('\\', '/'));
    expect(bcryptUsers).toEqual(['src/lib/email-verification.ts']);
  });

  it('no workflow or script deletes every credential row', () => {
    const files = [
      ...walk(join(ROOT, '.github'), (name) => /\.ya?ml$/.test(name)),
      ...walk(join(ROOT, 'scripts'), (name) => /\.(mjs|mts|ts|sh)$/.test(name)),
    ];
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((file) => {
      const text = readFileSync(file, 'utf8');
      /* An unconditional DELETE from a credential table — no WHERE on the same
         statement — is the shape that locks every member out. `clear-all-users`
         deletes USERS behind a confirmation phrase and a dry run, which is a
         different (documented) destruction and cascades rather than naming
         these tables. */
      return /DELETE\s+FROM\s+"?(Passkey|Session|MagicLinkToken)"?\s*(;|$)/m.test(text);
    }).map((file) => file.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
    expect(existsSync(join(ROOT, '.github/workflows/reset-test-logins.yml'))).toBe(false);
    expect(existsSync(join(ROOT, 'scripts/reset-test-logins.mjs'))).toBe(false);
  });
});
