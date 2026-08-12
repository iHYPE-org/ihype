import type { Metadata } from 'next';
import { EventsHome } from '@/components/EventsHome';

// "Zero fees" was accurate when iHYPE absorbed card processing. It no longer
// is: processing is buyer-paid (`src/lib/stripe-fees.ts`), disclosed line by
// line before payment. iHYPE's own take is still zero, and that is the claim
// worth making — the old wording promised something the checkout contradicts.
const DESCRIPTION = 'Face value tickets — 70% artist, 20% venue, 10% promoters, 0% iHYPE.';

export const metadata: Metadata = {
  title: 'Events · iHYPE',
  description: DESCRIPTION,
  openGraph: { title: 'Events · iHYPE', description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: 'Events · iHYPE', description: DESCRIPTION },
};

export default async function ShowsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; ticketView?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  return (
    <EventsHome initialTab={resolvedParams.tab} initialTicketView={resolvedParams.ticketView} />
  );
}
