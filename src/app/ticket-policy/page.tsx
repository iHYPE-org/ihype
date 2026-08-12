import { TrustPolicyPage } from '@/components/TrustPolicyPage';
import { getServerT } from '@/lib/i18n/server';

export const metadata = { title: 'Ticket Policy | iHYPE.org' };

export default async function TicketPolicyPage() {
  const t = await getServerT();
  return (
    <TrustPolicyPage
      badge={t('ticketPolicyPage.badge', 'Ticket policy')}
      title={t('ticketPolicyPage.title', 'Verified tickets, clear event rules')}
      intro={t('ticketPolicyPage.intro', 'The ticket hub should prioritize transparent pricing, serialized tickets, venue verification, and fraud prevention.')}
      sections={[
        { title: t('ticketPolicyPage.serializedTicketsTitle', 'Serialized tickets'), body: t('ticketPolicyPage.serializedTicketsBody', 'Each ticket should carry a unique ID and QR verification path so venues can validate entry once.') },
        { title: t('ticketPolicyPage.pricingPayoutsTitle', 'Pricing and payouts'), body: t('ticketPolicyPage.pricingPayoutsBody', 'Ticket creation should show ticket cost, capacity, tax estimates, and artist/venue/promoter payout assumptions before opening sales.') },
        { title: t('ticketPolicyPage.refundsChangesTitle', 'All sales are final'), body: t('ticketPolicyPage.refundsChangesBody', 'Ticket sales are final. iHYPE does not issue refunds — only the venue or event organizer can choose to, directly with the buyer and their own payment processor. You can transfer a ticket to someone else at any time; any processing fee on a transfer is the responsibility of whoever receives it. iHYPE is a nonprofit, takes $0 from a ticket, and absorbs no fees of any kind. If an organizer cancels an event, the money iHYPE is holding for that show is returned automatically.') },
        { title: t('ticketPolicyPage.resaleTitle', 'Resale'), body: t('ticketPolicyPage.resaleBody', 'Ticket resale should be limited to face value and require venue-assisted reassignment so the valid token owner is clear.') }
      ]}
    />
  );
}
