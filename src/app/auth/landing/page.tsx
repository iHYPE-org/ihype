import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultLandingPathForUser } from '@/lib/account-routing';

export default async function AuthLandingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const landingPath = await getDefaultLandingPathForUser({
    userId: session.user.id,
    role: session.user.role
  });

  redirect(landingPath);
}
