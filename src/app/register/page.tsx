import { RegisterScreen } from '@/components/AuthScreens';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join iHYPE — your local music scene, completely free',
  description: 'Completely free. Join iHYPE — 0% ticket fees, 70% artist / 20% venue / 10% promoters.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ role?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  type RegisterRole = 'FAN' | 'ARTIST' | 'VENUE';
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const normalized = role?.toUpperCase();
  const initialRole: RegisterRole =
    normalized === 'ARTIST' || normalized === 'ARTISTS' ? 'ARTIST' :
    // ?role=dj lands on ARTIST, matching the /for-djs -> /for-artists
    // redirect: the role is gone and a DJ is a music act. PROMOTER is
    // deliberately NOT folded in with it -- promoting is something any fan
    // does with a HYPE link, and it was never a page type of its own.
    normalized === 'DJ' ? 'ARTIST' :
    normalized === 'VENUE' || normalized === 'VENUES' ? 'VENUE' : 'FAN';

  return <RegisterScreen initialRole={initialRole} inviteOnly={await isInviteCodeRequiredRuntime()} />;
}
