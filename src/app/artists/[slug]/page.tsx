import { redirect } from 'next/navigation';

export default async function ArtistAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/artists/${encodeURIComponent(slug)}`);
}
