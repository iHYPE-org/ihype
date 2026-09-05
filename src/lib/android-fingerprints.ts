/**
 * Parse and VALIDATE the Android app-signing fingerprints before they reach
 * the association file.
 *
 * ## Why validation, and not just a split on commas
 *
 * `assetlinks.json` has an asymmetric failure mode that its own docstring
 * records: with no file, Android App Links simply do not verify and every link
 * opens in the browser — the pre-App-Links behaviour, which costs nothing. With
 * a file Google can fetch but cannot match, Google caches a verification
 * FAILURE, and holds it for days. A wrong fingerprint is therefore strictly
 * worse than no fingerprint.
 *
 * The route already knew this. It said "Take the SHA-256, never the SHA-1 shown
 * directly above it on the same screen" — and then accepted any non-empty
 * string, so pasting the SHA-1 from that same Play Console row produced a
 * served, well-formed, permanently-failing association file. An instruction in
 * a comment is not a check; `scripts/app-links:write` already refuses a SHA-1
 * by length, and this is the same protection for the runtime path that actually
 * serves the file.
 *
 * ## The shape
 *
 * A SHA-256 certificate digest is 32 bytes. Play Console renders it as 32
 * uppercase hex pairs joined by colons; some tooling emits the same 64 hex
 * characters unseparated. Both are accepted and normalised to the colon form,
 * which is what Google's documentation shows and what every example uses.
 *
 * A SHA-1 is 20 bytes — 40 hex characters — so it is rejected by length alone,
 * which is the single most likely mistake at this step.
 */

const SHA256_HEX_CHARS = 64;

/** A single fingerprint, normalised, or null if it is not a SHA-256 digest. */
export function normalizeFingerprint(raw: string): string | null {
  const compact = raw.trim().replace(/:/g, '').toUpperCase();
  if (compact.length !== SHA256_HEX_CHARS) return null;
  if (!/^[0-9A-F]+$/.test(compact)) return null;
  return (compact.match(/.{2}/g) ?? []).join(':');
}

export type FingerprintParse = {
  /** Valid, normalised, de-duplicated, in the order given. */
  valid: string[];
  /** The raw entries that were refused, for an operator-facing log line. */
  rejected: string[];
};

/**
 * Split the comma-separated secret and sort the entries into usable and not.
 *
 * Rejected entries are REPORTED rather than silently dropped: an operator who
 * pastes one good and one malformed fingerprint would otherwise get a served
 * file that verifies store installs and fails their own test installs, which
 * reads as flakiness rather than as a typo. The caller decides what to do with
 * them — the route logs them and serves only the valid ones, or 404s when
 * none survive.
 */
export function parseAndroidFingerprints(value: string | null | undefined): FingerprintParse {
  const entries = (value ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  const valid: string[] = [];
  const rejected: string[] = [];

  for (const entry of entries) {
    const normalized = normalizeFingerprint(entry);
    if (!normalized) {
      rejected.push(entry);
    } else if (!valid.includes(normalized)) {
      /* De-duplicated because the two fingerprints an operator is told to set
         — the Play app-signing cert and their own upload cert — are the same
         value on a project where Play App Signing was not used, and a repeated
         entry in the file is untidy rather than wrong. */
      valid.push(normalized);
    }
  }

  return { valid, rejected };
}
