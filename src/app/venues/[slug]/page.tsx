import { redirect } from 'next/navigation';

export default async function VenueAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/venues/${encodeURIComponent(slug)}`);
}
