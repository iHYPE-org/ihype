import { LoginScreen } from '@/components/AuthScreens';
import { loginLinkErrorFromCode } from '@/lib/login-link-error';

export const metadata = {
  title: 'Sign in | iHYPE.org',
  robots: { index: false, follow: false }
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ identifier?: string; registered?: string; error?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <LoginScreen
      initialIdentifier={resolvedSearchParams.identifier}
      justRegistered={resolvedSearchParams.registered === '1'}
      linkError={loginLinkErrorFromCode(resolvedSearchParams.error)}
    />
  );
}
