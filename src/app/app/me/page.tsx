import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { MmmMe } from '@/components/mmm/MmmMe';
import { loadMmmMe } from '@/lib/mmm-me';

export const dynamic = 'force-dynamic';

export default async function MmmMePage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string; panel?: string; section?: string }>;
}) {
  const session = await auth();
  // The layout already gated this, but every destination keeps its own
  // server-side check — the same rule the legacy shell's role gates follow.
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/me');
  const role = (await searchParams)?.role;
  const data = await loadMmmMe(session.user.id, role, isAdminSession(session));
  return (
    <>
      <h1 className="sr-only">Me</h1>
      <MmmMe data={data} />
    </>
  );
}
