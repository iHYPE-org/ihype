import { RegisterScreen } from '@/components/AuthScreens';
import { isInviteCodeRequired } from '@/lib/runtime-flags';

export const metadata = {
  title: 'Join free | iHYPE.org',
  robots: { index: false, follow: false }
};

type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

function getInitialRole(value: string | string[] | undefined): RegisterRole {
  const role = Array.isArray(value) ? value[0] : value;
  const normalized = role?.toUpperCase();

  if (normalized === 'ARTIST' || normalized === 'ARTISTS') return 'ARTIST';
  if (normalized === 'DJ' || normalized === 'PROMOTER' || normalized === 'PROMOTERS') return 'DJ';
  if (normalized === 'VENUE' || normalized === 'VENUES') return 'VENUE';
  return 'FAN';
}

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ role?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return <RegisterScreen initialRole={getInitialRole(params?.role)} inviteOnly={isInviteCodeRequired()} />;
}
