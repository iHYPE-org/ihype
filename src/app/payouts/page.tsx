import { redirect } from 'next/navigation';

export default async function PayoutsAlias({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab } = searchParams ? await searchParams : {};
  redirect(`/app/me/payouts${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`);
}
