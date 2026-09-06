import { redirect } from 'next/navigation';
import { MagicLinkConfirm } from '@/components/MagicLinkConfirm';

export const dynamic = 'force-dynamic';

/* The URL carries a live sign-in token. Never let it into an index. */
export const metadata = { robots: { index: false, follow: false } };

/**
 * Where `GET /api/auth/magic` sends a magic link, so that following the link
 * spends nothing. The token is spent by the POST this page's form makes — see
 * that route's header for why the two were split.
 *
 * Nothing here touches the database. Rendering must stay free of side effects,
 * because the fetch that renders it is as likely to be a mail scanner's as a
 * member's.
 */
export default async function MagicLinkConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; callbackUrl?: string }>;
}) {
  const { token, callbackUrl } = await searchParams;
  if (!token) redirect('/login?error=invalid_magic_link');

  return <MagicLinkConfirm token={token} callbackUrl={callbackUrl} />;
}
