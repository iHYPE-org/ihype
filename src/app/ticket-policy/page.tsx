import { TrustPolicyPage } from '@/components/TrustPolicyPage';
import { getLocale, getT } from '@/lib/i18n/server';

export const metadata = { title: 'Ticket Policy | iHYPE.org' };

export default async function TicketPolicyPage() {
  const t = getT(await getLocale());
  return (
    <TrustPolicyPage
      badge={t('ticketPolicyPage.badge', 'Ticket policy')}
      title={t('ticketPolicyPage.title', 'Verified tickets, clear event rules')}
      intro={t('ticketPolicyPage.intro', 'The ticket hub should prioritize transparent pricing, serialized tickets, venue verification, and fraud prevention.')}
      sections={[
        { title: t('ticketPolicyPage.serializedTicketsTitle', 'Serialized tickets'), body: t('ticketPolicyPage.serializedTicketsBody', 'Each ticket should carry a unique ID and QR verification path so venues can validate entry once.') },
        { title: t('ticketPolicyPage.pricingPayoutsTitle', 'Pricing and payouts'), body: t('ticketPolicyPage.pricingPayoutsBody', 'Ticket creation should show ticket cost, capacity, tax estimates, and artist/venue/promoter payout assumptions before opening sales.') },
        { title: t('ticketPolicyPage.refundsChangesTitle', 'Refunds and changes'), body: t('ticketPolicyPage.refundsChangesBody', 'Venues and event organizers are responsible for clear event-change, cancellation, refund, and reissue instructions.') },
        { title: t('ticketPolicyPage.resaleTitle', 'Resale'), body: t('ticketPolicyPage.resaleBody', 'Ticket resale should be limited to face value and require venue-assisted reassignment so the valid token owner is clear.') }
      ]}
    />
  );
}
