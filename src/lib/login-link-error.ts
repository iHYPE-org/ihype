/**
 * The `?error=` codes `/api/auth/magic` and `/auth/confirm` redirect to
 * `/login` with. Until 2026-09-24 nothing read them, so a member whose link
 * had expired landed on a plain sign-in form with no word about why
 * (DESIGN_SYNC row 513). A plain module rather than an export of the client
 * login screen, because the server page is the one that reads the query.
 */
export type LoginLinkError = 'invalid' | 'expired' | 'failed';

export function loginLinkErrorFromCode(code: string | string[] | undefined): LoginLinkError | undefined {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return undefined;
  if (value === 'expired_magic_link') return 'expired';
  if (value === 'invalid_magic_link') return 'invalid';
  if (value.startsWith('ml_')) return 'failed';
  return undefined;
}
