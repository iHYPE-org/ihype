import { redirect } from 'next/navigation';

export default async function TicketAlias({ params }: { params: Promise<{ serializedId: string }> }) {
  const { serializedId } = await params;
  redirect(`/app/me/tickets/${encodeURIComponent(serializedId)}`);
}
