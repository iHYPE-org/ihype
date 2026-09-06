import { randomBytes } from 'crypto';

/**
 * Alpha/beta access requests — the shared rules, kept pure and out of the
 * page so the parts most likely to be wrong are the parts under test.
 *
 * A request arrives at `POST /api/beta-access-request` from the landing
 * page's form, which on a closed alpha is the only way in. It is recorded
 * twice on purpose: an `AuditLog` row (append-only, the historical fact that
 * somebody asked) and an `AccessRequest` row (the work item an operator can
 * approve or clear). Deleting the second never erases the first.
 */

export type AccessRequestStatusValue = 'PENDING' | 'APPROVED' | 'DECLINED';

/**
 * What the operator is actually looking at, which is NOT the same as the
 * stored status.
 *
 * `signed-up` is the one that earns its place: a PENDING request whose
 * address now has an account got in by some other door — an invite from a
 * member, a code handed over in person — and sending them a fresh invite
 * would be noise at best and a second account at worst. The row clears itself
 * with nothing to mark off by hand, which is the property the workbench queue
 * has always had and which a bare status column would have quietly lost.
 */
export type AccessRequestState = 'waiting' | 'signed-up' | 'approved' | 'declined';

export function describeAccessRequestState(
  status: AccessRequestStatusValue,
  hasAccount: boolean,
): AccessRequestState {
  if (status === 'DECLINED') return 'declined';
  if (status === 'APPROVED') return hasAccount ? 'signed-up' : 'approved';
  return hasAccount ? 'signed-up' : 'waiting';
}

/**
 * Only a request that is still waiting can be approved.
 *
 * Someone who already has an account is excluded deliberately: minting a
 * single-use code for an address that is already inside spends a code on
 * nobody and tells the operator a story that is not true.
 */
export function canApproveAccessRequest(state: AccessRequestState) {
  return state === 'waiting';
}

/**
 * The queue is ordered by how long the longest wait has been, so it lists
 * what is actionable first and, within that, oldest first. Decided rows stay
 * visible underneath — a request that vanishes the moment it is handled gives
 * the operator no way to confirm what they just did, or to find the code they
 * issued five minutes ago.
 */
const STATE_ORDER: Record<AccessRequestState, number> = {
  waiting: 0,
  approved: 1,
  'signed-up': 2,
  declined: 3,
};

export function orderAccessRequests<T extends { state: AccessRequestState; createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (byState !== 0) return byState;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * One address, one row. Stored lower-cased so a second ask updates the same
 * request rather than opening a second queue entry for the same person, and
 * so the `hasAccount` join against `User.email` cannot miss on case alone.
 *
 * Returns null for anything that is not usably an address — the caller stores
 * nothing rather than creating a row nobody could act on.
 */
export function normaliseRequestEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 200) return null;
  const at = trimmed.indexOf('@');
  if (at < 1 || at === trimmed.length - 1) return null;
  if (trimmed.includes(' ')) return null;
  return trimmed;
}

/**
 * The single-use admin invite code.
 *
 * Shared by `POST /api/admin/invite-codes` (mint a batch by hand) and the
 * approve action (mint one for a named requester) so the two cannot drift
 * into different alphabets or lengths. Upper-case hex; `POST /api/register`
 * upper-cases what the member types before looking it up, so a code is
 * case-insensitive at the door.
 */
export function generateInviteCode() {
  return randomBytes(6).toString('hex').toUpperCase();
}
