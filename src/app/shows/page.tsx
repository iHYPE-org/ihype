import { redirect } from 'next/navigation';

export default async function ShowsAlias({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab } = searchParams ? await searchParams : {};
  if (tab === 'tickets') redirect('/app/me?section=tickets');
  if (tab === 'foryou') redirect('/app/music/recommended');
  redirect('/app/map?layer=events');
}
