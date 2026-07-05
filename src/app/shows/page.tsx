import type { Metadata } from 'next';
import { EventsHome } from '@/components/EventsHome';
import { RouteShellSlot } from '@/components/RouteShellSlot';

export const metadata: Metadata = {
  title: 'Events · iHYPE',
  description: "Face value, zero fees. Every ticket — 45% artist, 45% venue, 10% promoters.",
  openGraph: { title: 'Events · iHYPE', description: 'Face value, zero fees. Every ticket — 45% artist, 45% venue, 10% promoters.' },
  twitter: { card: 'summary_large_image', title: 'Events · iHYPE', description: 'Face value, zero fees.' },
};

export default async function ShowsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; ticketView?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  return (
    <RouteShellSlot>
      <EventsHome initialTab={resolvedParams.tab} initialTicketView={resolvedParams.ticketView} />
    </RouteShellSlot>
  );
}
