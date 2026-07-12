import { RegisterScreen } from '@/components/AuthScreens';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join iHYPE — your local music scene, completely free',
  description: 'Completely free. Join iHYPE — 0% ticket fees, 45% artist / 45% venue / 10% promoters.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ role?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const normalized = role?.toUpperCase();
  const initialRole: RegisterRole =
    normalized === 'ARTIST' || normalized === 'ARTISTS' ? 'ARTIST' :
    normalized === 'DJ' || normalized === 'PROMOTER' ? 'DJ' :
    normalized === 'VENUE' || normalized === 'VENUES' ? 'VENUE' : 'FAN';

  return <RegisterScreen initialRole={initialRole} inviteOnly={await isInviteCodeRequiredRuntime()} />;
}
