import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { RevokeDeviceButton } from '@/components/admin/RevokeDeviceButton';

export const metadata = {
  title: 'Authorizations · Devices | Admin | iHYPE',
  robots: { index: false, follow: false },
};

function stamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Devices bound to the admin console.
 *
 * `AdminDevice` replaced `User.adminDeviceTokenHash`, a single column that held
 * exactly one device — registering a phone silently signed the laptop out. The
 * table has had room for several since, and a `label` column whose own schema
 * comment says it exists "so a list of devices can be revoked meaningfully" —
 * but there was no list and no way to revoke one. The only device surface was
 * /admin/device-register, reached by an emailed one-time token.
 */
export default async function AdminAuthorizationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const devices = await db.adminDevice
    .findMany({
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        label: true,
        createdAt: true,
        lastSeenAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })
    .catch(() => null);

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Device authorizations</h1>
        <p className="meta">
          Devices allowed to open this console. Revoking one signs that device out; it can
          re-register through the emailed one-time link at <code>/admin/device-register</code>.
          Payment authorizations are on the{' '}
          <Link href="/admin/authorizations/holds">Payment holds</Link> tab.
        </p>

        {devices === null ? (
          <div className="empty">
            Devices could not be read. That is a failed query — it does not mean no devices are
            authorized.
          </div>
        ) : devices.length === 0 ? (
          <div className="empty">
            No devices are registered. The console is reachable only by completing a device
            registration.
          </div>
        ) : (
          <div className="admin-list">
            {devices.map((d) => (
              <div className="admin-list-row" key={d.id}>
                <span>{d.label ?? 'Unlabelled device'}</span>
                {/* The device you are reading this on is revocable too, on
                    purpose: an operator holding a compromised laptop has to be
                    able to cut it off from that laptop. */}
                <RevokeDeviceButton deviceId={d.id} label={d.label ?? 'this device'} />
                <small>
                  {d.user?.name ?? 'unknown operator'} · {d.user?.email ?? 'no address'}
                </small>
                <small>
                  registered {stamp(d.createdAt)} · last seen {stamp(d.lastSeenAt)}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
