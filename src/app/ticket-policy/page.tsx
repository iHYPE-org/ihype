import { TrustPolicyPage } from '@/components/TrustPolicyPage';
import { TICKET_REFUND_TERMS } from '@/lib/legal-document';
import { getServerT } from '@/lib/i18n/server';

export const metadata = { title: 'Ticket Policy' };

export default async function TicketPolicyPage() {
  const t = await getServerT();
  return (
    <TrustPolicyPage
      badge={t('ticketPolicyPage.badge', 'Ticket policy')}
      title={t('ticketPolicyPage.title', 'Verified tickets, clear event rules')}
      intro={t('ticketPolicyPage.intro', 'The ticket hub should prioritize transparent pricing, serialized tickets, venue verification, and fraud prevention.')}
      sections={[
        { title: t('ticketPolicyPage.serializedTicketsTitle', 'Serialized tickets'), body: t('ticketPolicyPage.serializedTicketsBody', 'Each ticket should carry a unique ID and QR verification path so venues can validate entry once.') },
        { title: t('ticketPolicyPage.pricingPayoutsTitle', 'Pricing and payouts'), body: t('ticketPolicyPage.pricingPayoutsBodyNet', 'Ticket creation should show ticket cost, capacity, tax estimates, and the artist and venue payouts after Stripe’s card fee before opening sales.') },
        { title: t('ticketPolicyPage.refundsChangesTitle', 'All sales are final'), body: TICKET_REFUND_TERMS },
        { title: t('ticketPolicyPage.resaleTitle', 'Resale'), body: t('ticketPolicyPage.resaleBody', 'Ticket resale should be limited to face value and require venue-assisted reassignment so the valid token owner is clear.') }
      ]}
    />
  );
}
