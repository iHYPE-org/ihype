import './admin.css';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { AdminShell } from '@/components/admin/AdminShell';
import { OpsLoginGate } from '@/components/admin/OpsLoginGate';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (!isAdminSession(session)) {
    redirect(WORKBENCH_PATH);
  }

  const { name, email } = session.user;

  return (
    <OpsLoginGate name={name} email={email}>
      <AdminShell name={name} email={email}>{children}</AdminShell>
    </OpsLoginGate>
  );
}
