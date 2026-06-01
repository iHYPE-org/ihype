import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Magic-link sign-in is handled by the /api/auth/magic Route Handler which
// can set cookies in its response. This page exists only to forward any
// old-format links that still point here.
export default async function MagicLinkPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; callbackUrl?: string }>;
}) {
  const { token, callbackUrl } = await searchParams;
  const qs = new URLSearchParams();
  if (token) qs.set('token', token);
  if (callbackUrl) qs.set('callbackUrl', callbackUrl);
  redirect(`/api/auth/magic${qs.size ? `?${qs}` : ''}`);
}
