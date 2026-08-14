import './admin.css';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { SESSION_EXEMPT_PATHS, WORKBENCH_PATH } from '@/lib/auth-redirects';
import { AdminShell } from '@/components/admin/AdminShell';
import { OpsLoginGate } from '@/components/admin/OpsLoginGate';
import { AdminLiveRefresh } from '@/components/admin/AdminLive';
import { getDeviceCookieName } from '@/lib/admin-device';
import { isRegisteredAdminDevice } from '@/lib/admin-device-store';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';

  // The account-recovery pages render before any of the checks below, because
  // every one of them presumes the session those pages exist to establish.
  // Middleware exempts the same two paths; this is the second, independent gate
  // and both had to be opened — fixing only the redirect in middleware still
  // landed on `redirect('/login')` three lines down.
  //
  // They render WITHOUT AdminShell on purpose: the shell takes the signed-in
  // admin's name and email, which is exactly what does not exist yet. Both
  // pages are full-screen and self-contained.
  //
  // Their own protection is unaffected — see SESSION_EXEMPT_PATHS. An empty
  // x-pathname (no middleware, so no header) matches nothing here and falls
  // through to the full gate, which is the safe direction.
  if ((SESSION_EXEMPT_PATHS as readonly string[]).includes(pathname)) {
    return <>{children}</>;
  }

  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (!isAdminSession(session)) {
    redirect(WORKBENCH_PATH);
  }

  // Device cookie check. It no longer needs to exempt /admin/device-register
  // itself — that path returns above — so the redirect below cannot loop.
  const cookieStore = await cookies();
  const deviceCookie = cookieStore.get(getDeviceCookieName())?.value;
  // One shared answer — `admin-api.ts` asks the same question, and this used
  // to be a hand-copied duplicate of the check. Devices are rows now, so more
  // than one can be registered; see `admin-device-store.ts`.
  const isDeviceValid = await isRegisteredAdminDevice(session.user.id, deviceCookie);
  if (!isDeviceValid) {
    redirect('/admin/device-register');
  }

  const { name, email } = session.user;

  return (
    <OpsLoginGate name={name} email={email}>
      {/* Mounted here rather than in each page so every admin surface — and
          any added later — refreshes itself. Renders nothing. */}
      <AdminLiveRefresh />
      <AdminShell name={name} email={email}>{children}</AdminShell>
    </OpsLoginGate>
  );
}
