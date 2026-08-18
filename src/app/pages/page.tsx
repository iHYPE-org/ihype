import { redirect } from 'next/navigation';

export default async function PagesAlias({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const source = searchParams ? await searchParams : {};
  const query = new URLSearchParams(source).toString();
  redirect(`/app/me/profiles${query ? `?${query}` : ''}`);
}
