import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AuthLandingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.role === 'ADMIN') {
    redirect('/dashboard');
  }

  redirect('/home');
}
