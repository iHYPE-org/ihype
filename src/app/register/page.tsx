import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { JoinFlow } from '@/components/JoinFlow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join iHYPE — free forever',
  description: 'Join iHYPE. 0% ticket fees. 45% artist / 45% venue / 10% promoters.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ role?: string | string[]; auth?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  // ?auth=full falls back to the legacy RegisterScreen with passkey + OTP support
  if (params?.auth === 'full') {
    const { RegisterScreen } = await import('@/components/AuthScreens');
    type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';
    const role = Array.isArray(params.role) ? params.role[0] : params.role;
    const normalized = role?.toUpperCase();
    const initialRole: RegisterRole =
      normalized === 'ARTIST' || normalized === 'ARTISTS' ? 'ARTIST' :
      normalized === 'DJ' || normalized === 'PROMOTER' ? 'DJ' :
      normalized === 'VENUE' || normalized === 'VENUES' ? 'VENUE' : 'FAN';
    return <RegisterScreen initialRole={initialRole} inviteOnly={await isInviteCodeRequiredRuntime()} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px 60px',
      background: 'var(--bg, #0a0805)',
    }}>
      <JoinFlow inviteOnly={await isInviteCodeRequiredRuntime()} />
    </div>
  );
}
