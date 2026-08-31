const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;
const reservedUsernames = new Set([
  'admin',
  'administrator',
  'billing',
  'contact',
  'help',
  'ihype',
  'ihype.org',
  'moderator',
  'official',
  'owner',
  'root',
  'security',
  'support',
  'system',
  'team'
]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  const normalized = normalizeUsername(value);
  return usernamePattern.test(normalized) && !reservedUsernames.has(normalized);
}

export function getUsernameValidationMessage() {
  return 'Username must be 3-30 characters, use letters, numbers, dots, dashes, or underscores, and cannot use reserved names like admin or support.';
}

/**
 * A legal username derived from a display name, or null when nothing legal
 * can be salvaged from it.
 *
 * Signup never asks for a username — a fan account "asks for nothing" — so
 * when a name is given the handle is derived from it. That derivation used to
 * be `normalizeUsername(name.replace(/\s+/g, ''))`, which only lowercases and
 * trims: it strips no illegal character, enforces no length, and dodges no
 * reserved word. The derived value was then run through `isValidUsername()`
 * and a failure answered 400 with "Username must be 3-30 characters, use
 * letters, numbers, dots, dashes, or underscores" — about a field the member
 * had never seen and could not correct. Measured 2026-08-31, all refused at
 * signup: "Sarah O'Brien" (apostrophe), "Renée" (combining acute), "Bo" (the
 * pattern's floor is 3), "Support" (reserved), and every name written in a
 * non-Latin script, which normalises to an empty string — so "李明" could not
 * create an account at all.
 *
 * Returning null is the honest answer for "nothing legal survives"; the caller
 * then mints a random handle rather than refusing the signup, because the
 * member is not asking for this name and cannot fix it.
 */
export function deriveUsernameCandidate(displayName: string): string | null {
  const candidate = displayName
    // NFKD splits "é" into "e" + U+0301 so the accent can be dropped rather
    // than taking the whole character with it.
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
    // The pattern demands an alphanumeric at both ends.
    .replace(/^[._-]+/, '')
    .slice(0, 30)
    .replace(/[._-]+$/, '');

  // Length 2 is illegal under usernamePattern (1, or 3-30), and a 1-character
  // handle is legal but not something to hand someone unasked.
  if (candidate.length < 3) return null;
  if (reservedUsernames.has(candidate)) return null;
  return candidate;
}
