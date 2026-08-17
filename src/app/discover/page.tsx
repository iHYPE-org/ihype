import { redirect } from 'next/navigation';

export default async function DiscoverAlias({ searchParams }: { searchParams?: Promise<{ city?: string; genre?: string; q?: string }> }) {
  const source = searchParams ? await searchParams : {};
  const target = new URLSearchParams();
  if (source.city) target.set('city', source.city);
  if (source.genre) target.set('genre', source.genre);
  if (source.q) target.set('q', source.q);
  const query = target.toString();
  redirect(`/app/music/discover${query ? `?${query}` : ''}`);
}
