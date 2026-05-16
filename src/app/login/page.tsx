import { LoginScreen } from '@/components/AuthScreens';

export const metadata = {
  title: 'Sign in | iHYPE.org',
  robots: { index: false, follow: false }
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ identifier?: string; registered?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <LoginScreen
      initialIdentifier={resolvedSearchParams.identifier}
      justRegistered={resolvedSearchParams.registered === '1'}
    />
  );
}
