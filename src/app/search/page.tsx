import { redirect } from 'next/navigation';

export default async function SearchAlias({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const { q } = searchParams ? await searchParams : {};
  const target = new URLSearchParams({ focus: 'search' });
  if (q) target.set('q', q);
  redirect(`/app/music/discover?${target}`);
}
