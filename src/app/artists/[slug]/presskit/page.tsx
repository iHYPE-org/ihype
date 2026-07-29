import { redirect } from 'next/navigation';

/**
 * There were two press-kit routes rendering the same `parsePressKit` data:
 * this one and /artists/[slug]/epk. Only /epk was ever linked (from the
 * PageEditor "Press kit" section), so /presskit had no way in — but it is a
 * guessable public URL an artist may have pasted into an email, so it
 * redirects rather than 404s.
 *
 * Note /epk sets `robots: { index: false }` while this route did not, so the
 * canonical press kit is now noindex. That is the linked route's existing
 * choice, not a new one; flip it there if press kits should be indexable.
 */
export default async function PressKitRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/artists/${slug}/epk`);
}
