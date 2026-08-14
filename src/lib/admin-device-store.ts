import { db } from '@/lib/db';
import { extractDeviceToken, hashDeviceToken } from '@/lib/admin-device';

/**
 * IS THIS DEVICE ALLOWED TO OPEN THE CONSOLE (2026-08-14).
 *
 * One answer, used by every gate — the admin layout and `admin-api.ts` had a
 * hand-copied pair of identical checks, which is two places to update and one
 * to forget.
 *
 * ## Why this exists at all
 *
 * `User.adminDeviceTokenHash` is a single column, so the console supported
 * exactly ONE device: registering a phone overwrote the laptop's hash and
 * silently signed the laptop out. Nobody chose that — the column had no room
 * for a second row — and it is the whole reason the console looked broken on a
 * phone while working on a laptop. Devices are now rows in `AdminDevice`.
 *
 * ## The legacy column is still read, on purpose
 *
 * The migration backfills the existing hash into `AdminDevice`, but a backfill
 * and a deploy are not atomic, and the operator is very likely READING the
 * console on the device in question while it ships. Accepting the old column
 * as a fallback means the worst case is a device that keeps working, rather
 * than an administrator locked out of the tool they would use to fix it.
 * Removing this fallback is separate work, after the table has been live long
 * enough to trust — and it is the only reason `adminDeviceTokenHash` is still
 * in the schema.
 *
 * ## Timing-safe by construction
 *
 * The lookup is a `findUnique` on a UNIQUE index over the SHA-256 hash, so the
 * comparison happens in the database on a fixed-width digest rather than in JS
 * on a secret. There is nothing to leak by early exit: an attacker submitting
 * a guess learns only whether a row exists, which is the answer either way.
 */
export async function isRegisteredAdminDevice(
  userId: string,
  cookieValue: string | undefined | null,
): Promise<boolean> {
  if (!cookieValue) return false;

  // The cookie is `<token>.<hmac>`; only the token is hashed into the table.
  const tokenHash = hashDeviceToken(extractDeviceToken(cookieValue));

  const device = await db.adminDevice
    .findUnique({ where: { tokenHash }, select: { id: true, userId: true } })
    .catch(() => null);

  if (device && device.userId === userId) {
    // Best-effort: this is a "which of my devices is stale" affordance, not a
    // security control, so a failed write must never cost the operator entry.
    void db.adminDevice
      .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
    return true;
  }

  // Fallback to the pre-`AdminDevice` column. See the note above.
  const legacy = await db.user
    .findUnique({ where: { id: userId }, select: { adminDeviceTokenHash: true } })
    .catch(() => null);

  return Boolean(legacy?.adminDeviceTokenHash && legacy.adminDeviceTokenHash === tokenHash);
}

/**
 * Registers the device holding this token.
 *
 * An INSERT, not an overwrite — that difference is the entire point. The
 * legacy column is written too, so a rollback of the application code (which
 * would go back to reading only that column) still finds the newest device
 * rather than one that no longer exists anywhere it can see.
 */
export async function registerAdminDevice(
  userId: string,
  deviceToken: string,
  label?: string | null,
): Promise<void> {
  const tokenHash = hashDeviceToken(deviceToken);
  const now = new Date();

  await db.adminDevice.upsert({
    where: { tokenHash },
    update: { userId, lastSeenAt: now },
    create: { userId, tokenHash, label: label ?? null, createdAt: now, lastSeenAt: now },
  });

  await db.user.update({
    where: { id: userId },
    data: { adminDeviceTokenHash: tokenHash, adminDeviceSetAt: now },
  });
}

export type AdminDeviceSummary = {
  id: string;
  label: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  /** True for the device making this request, which must not offer to revoke itself blindly. */
  current: boolean;
};

/** Every device that can open the console, newest use first. */
export async function listAdminDevices(
  userId: string,
  cookieValue: string | undefined | null,
): Promise<AdminDeviceSummary[]> {
  const currentHash = cookieValue ? hashDeviceToken(extractDeviceToken(cookieValue)) : null;
  const devices = await db.adminDevice
    .findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, label: true, createdAt: true, lastSeenAt: true, tokenHash: true },
    })
    .catch(() => []);

  return devices.map((device) => ({
    id: device.id,
    label: device.label,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
    current: currentHash !== null && device.tokenHash === currentHash,
  }));
}

/**
 * Revokes one device.
 *
 * Scoped to the caller's own userId so a device id from anywhere else cannot
 * revoke someone's session. Also clears the legacy column when it happens to
 * be the hash being revoked, otherwise the fallback above would keep letting
 * the revoked device straight back in — which would make revocation look like
 * it worked while changing nothing.
 */
export async function revokeAdminDevice(userId: string, deviceId: string): Promise<boolean> {
  const device = await db.adminDevice
    .findUnique({ where: { id: deviceId }, select: { id: true, userId: true, tokenHash: true } })
    .catch(() => null);

  if (!device || device.userId !== userId) return false;

  await db.adminDevice.delete({ where: { id: device.id } });

  await db.user
    .updateMany({
      where: { id: userId, adminDeviceTokenHash: device.tokenHash },
      data: { adminDeviceTokenHash: null, adminDeviceSetAt: null },
    })
    .catch(() => {});

  return true;
}
