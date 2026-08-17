import { redirect } from 'next/navigation';

export default async function ShowAlias({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ ref?: string; affiliate?: string }>;
}) {
  const { slug } = await params;
  const source = searchParams ? await searchParams : {};
  const target = new URLSearchParams();
  if (source.ref) target.set('ref', source.ref);
  if (source.affiliate) target.set('affiliate', source.affiliate);
  const query = target.toString();
  redirect(`/app/shows/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`);
}
