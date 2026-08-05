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
    // ?role=dj and ?role=promoter still arrive from links already in the wild
    // (the /for-djs kit, old emails). They land on ARTIST rather than 404ing or
    // silently becoming a fan: an artist account is what a DJ's uploads and
    // shows now live under, and promoting needs no role at all.
    normalized === 'DJ' || normalized === 'PROMOTER' ? 'ARTIST' :
    normalized === 'VENUE' || normalized === 'VENUES' ? 'VENUE' : 'FAN';

  return <RegisterScreen initialRole={initialRole} inviteOnly={await isInviteCodeRequiredRuntime()} />;
}
