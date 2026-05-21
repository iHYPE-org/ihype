import Link from 'next/link';
import { PublicFeaturePage } from '@/components/PublicFeaturePage';

export const metadata = {
  title: 'Tickets | iHYPE.org',
  description: 'Verified iHYPE ticketing with serialized IDs, QR verification, and transparent event economics.'
};

export default function TicketsPage() {
  return (
    <PublicFeaturePage
      actions={[
        { href: '/shows', label: 'Browse shows' },
        { href: '/venues', label: 'Venue tools', variant: 'ghost' }
      ]}
      cards={[
        {
          label: 'Verify',
          title: 'One ticket, one serialized ID.',
          copy:
            'Every ticket is designed to carry a unique identifier and QR verification path so venues can validate entry.'
        },
        {
          label: 'Open',
          title: 'Charge when events open.',
          copy:
            'Ticket purchase flow is built around stored fan intent, then payment capture when an event is officially opened.'
        },
        {
          label: 'Transfer',
          title: 'Resale without markup.',
          copy:
            'Transfers are designed around reassignment at face value, protecting fans and venues from fraudulent resale loops.'
        }
      ]}
      eyebrow="Ticketing without chaos"
      gradient="verified access for shows that deserve a room."
      lede="iHYPE ticketing connects venue calendars, artist availability, promoter referrals, and fan demand without turning tickets into a speculative marketplace."
      note="Serialized. Scannable. Fair-value transfer."
      sectionCopy="This route now lives inside the Next.js app, so public ticketing copy, show browsing, and individual ticket verification all share the same visual system."
      sectionEyebrow="Ticket hub"
      sectionTitle="Built for trust at the door."
      signals={[
        {
          kicker: 'QR verify',
          title: 'Scan at entry',
          copy: 'Tickets are designed for single-use verification at the venue.',
          metric: 'serialized ID - QR check'
        },
        {
          kicker: 'Event economics',
          title: 'Clear splits',
          copy: 'Venue, artist, and promoter economics can be represented before an event opens.',
          metric: 'artist - venue - referral'
        },
        {
          kicker: 'Fan protection',
          title: 'No inflated resale',
          copy: 'Transfers should protect access instead of rewarding scalping behavior.',
          metric: 'face value - reassignment'
        }
      ]}
      title="Tickets become"
    >
      <div className="public-promise-trust-links">
        <Link href="/ticket-policy">Ticket policy</Link>
        <Link href="/transparency">Transparency ledger</Link>
        <Link href="/support">Support</Link>
      </div>
    </PublicFeaturePage>
  );
}
