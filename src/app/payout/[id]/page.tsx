import { redirect } from 'next/navigation';

export default async function PayoutAlias({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/me/payouts/${encodeURIComponent(id)}`);
}
