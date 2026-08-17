import { redirect } from 'next/navigation';

export default async function SupportTicketAlias({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/me/support/tickets/${encodeURIComponent(id)}`);
}
