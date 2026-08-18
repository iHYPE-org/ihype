import { redirect } from 'next/navigation';

export default async function VenueToolAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/me/venues/${encodeURIComponent(slug)}/calendar`);
}
