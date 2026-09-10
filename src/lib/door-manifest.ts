/**
 * The door, when the door has no signal.
 *
 * A venue's basement is exactly where a phone loses the network, and it is
 * also where every ticket has to be checked. So the scanner can carry the
 * guest list down with it: a MANIFEST of the show's tickets, downloaded while
 * there is still signal, checked against locally, and reconciled with the
 * server once the network comes back.
 *
 * Two rules shape everything in this file.
 *
 * 1. THE MANIFEST NEVER HOLDS A REDEEMABLE TICKET. A ticket's `serializedId`
 *    is the whole credential — the QR encodes a URL ending in it, and the scan
 *    route admits whoever presents it — so a list of them on a door phone is
 *    a list of every ticket to the show, ready to be copied. The manifest
 *    carries a SHA-256 of each code instead, domain-separated by the show, so
 *    the phone can recognise a code it is shown and cannot produce one. A
 *    stolen phone gives up the holder names on the list and nothing that
 *    opens a door.
 *
 * 2. THE SERVER'S ANSWER WINS. An offline admission is provisional: the phone
 *    records it, admits the fan, and posts it when it can. If the server then
 *    answers 409 the same ticket was also scanned somewhere else — a copy, or a
 *    second door — and the operator is told, rather than the phone quietly
 *    agreeing with itself. Nothing here decides a dispute; it only makes sure
 *    one is visible.
 *
 * Pure and isomorphic: no `@/lib/db`, no DOM. The route builds the manifest
 * with it, the scanner reads it, and the unit suite runs both halves.
 */

/**
 * A ticket code is a TOKEN, not a format. `createSerializedTicketId()` mints
 * `0x` + 24 hex; the e2e fixture writes `IHY-` + 8 upper-case hex; the column
 * is a free string. So the door accepts anything token-shaped — one run of
 * letters, digits, `_` and `-`, 6 to 64 long — and lets the SERVER say whether
 * it names a ticket for this show. What is refused here is only what cannot be
 * a code at all: a wifi card, a URL of ours that is not a ticket, whitespace
 * inside. Case is preserved: the hash lower-cases, and the route matches the
 * code as typed or lower-cased, so a typed `0X…` still finds its ticket.
 */
const TICKET_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/;

/** The manifest format. Bump when an entry's shape changes so a stale copy on
 *  a phone is discarded rather than misread. */
export const DOOR_MANIFEST_VERSION = 1;

export type DoorManifestEntry = {
  /** `hashTicketCode(showId, serializedId)`. Never the code itself. */
  h: string;
  /** Who the ticket was issued to, so the door can greet them and so a
   *  refused code can be told apart from a wrong name. */
  name: string;
};

export type DoorManifest = {
  v: typeof DOOR_MANIFEST_VERSION;
  showId: string;
  showSlug: string;
  title: string;
  startsAt: string;
  /** When the server built it. An old manifest is missing every ticket sold
   *  since, and the scanner says so beside the count. */
  fetchedAt: string;
  /** Tickets that can still be admitted. */
  valid: DoorManifestEntry[];
  /** Hashes of tickets ALREADY scanned when the manifest was built, so a
   *  re-presented code is refused offline too. Names withheld — the door does
   *  not need to know who a refused code belonged to. */
  scanned: string[];
};

/** A scan recorded on this phone, admitted or refused, synced or waiting. */
export type LocalDoorScan = {
  code: string;
  hash: string;
  name: string | null;
  /** ISO instant the door admitted the fan — the time that matters, not the
   *  moment the network came back. */
  at: string;
  /** How this scan stands with the server. */
  sync: 'pending' | 'synced' | 'duplicate' | 'refused' | 'local-only';
  note?: string;
};

export type OfflineVerdict =
  | { kind: 'admit'; name: string }
  | { kind: 'duplicate'; name: string | null; at: string | null }
  | { kind: 'already-scanned' }
  | { kind: 'unknown' };

/**
 * Pulls a ticket code out of whatever the camera read.
 *
 * The QR encodes `${baseUrl}/tickets/<code>` (see `buildTicketVerificationUrl`);
 * an older ticket or a typed code may be the bare `0x…`; the shell's own URL
 * is `/app/me/tickets/<code>`. All three resolve to the code as written.
 * Anything else — a different site's QR, a wifi card, a URL of ours that is
 * not a ticket — is null, and the door says "not an iHYPE ticket" rather than
 * sending a stranger's payload to the scan route.
 */
export function extractTicketCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (TICKET_CODE.test(text)) return text;

  let pathname: string;
  try {
    pathname = new URL(text).pathname;
  } catch {
    // Not a URL. A code with the 0x prefix missing is not accepted either:
    // guessing at what a stranger meant is how a wrong ticket gets admitted.
    return null;
  }
  const match = /^(?:\/app\/me)?\/tickets\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const code = decodeURIComponent(match[1]);
  return TICKET_CODE.test(code) ? code : null;
}

/**
 * SHA-256 of `ihype-door:<showId>:<code>`, hex.
 *
 * The show id in the preimage is the domain separation: the same ticket code
 * hashes differently under every show, so a manifest for one night cannot be
 * used to recognise codes at another, and a table built from one leaked list
 * says nothing about the next. `crypto.subtle` is the one digest available in
 * a Worker, a browser and Node alike, which is why this is async.
 */
export async function hashTicketCode(showId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`ihype-door:${showId}:${code.toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * What the door should do with a code when the server cannot be asked.
 *
 * Order matters and each step is a different sentence at the door:
 *   - scanned on THIS phone already → duplicate, with when;
 *   - scanned before the list was downloaded → already scanned;
 *   - on the list → admit, by name;
 *   - not on the list → unknown. Not "invalid": a ticket bought after the
 *     download is unknown to the phone and perfectly good, which is why the
 *     scanner shows the download time beside the verdict.
 */
export function judgeOffline(
  manifest: DoorManifest | null,
  localScans: readonly LocalDoorScan[],
  hash: string,
): OfflineVerdict {
  const mine = localScans.find((scan) => scan.hash === hash && scan.sync !== 'refused');
  if (mine) return { kind: 'duplicate', name: mine.name, at: mine.at };
  if (!manifest) return { kind: 'unknown' };
  if (manifest.scanned.includes(hash)) return { kind: 'already-scanned' };
  const entry = manifest.valid.find((row) => row.h === hash);
  if (entry) return { kind: 'admit', name: entry.name };
  return { kind: 'unknown' };
}

/** How long an offline scan may sit on a phone and still be recorded at the
 *  time the door says it happened. A show runs one night; a week covers a
 *  phone that never came back online until the operator got home. */
export const MAX_OFFLINE_SCAN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The moment a synced scan is recorded as. The phone's claim is honoured when
 * it is plausible — in the past, and within the window — and otherwise the
 * server's own clock stands. A future timestamp is a wrong clock, not a
 * fraud, but the record should still not say a fan arrived tomorrow.
 */
export function resolveScanTimestamp(claimed: unknown, now: Date = new Date()): Date {
  if (typeof claimed !== 'string') return now;
  const at = new Date(claimed);
  if (Number.isNaN(at.getTime())) return now;
  if (at.getTime() > now.getTime()) return now;
  if (now.getTime() - at.getTime() > MAX_OFFLINE_SCAN_AGE_MS) return now;
  return at;
}

/** True when a stored manifest is one this code can read. */
export function isUsableManifest(value: unknown, showId: string): value is DoorManifest {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<DoorManifest>;
  return m.v === DOOR_MANIFEST_VERSION && m.showId === showId && Array.isArray(m.valid) && Array.isArray(m.scanned);
}
