import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function VenuesIndexPage() {
  const venues = await getDirectoryProfiles('VENUE');

  return (
    <ProfileDirectoryPage
      badge="VENUES"
      currentHref="/venues"
      description="Venue discover is where venues browse the wider network and move between the tools connected to visibility, discovery, and ticketing."
      modules={['Sign Up Wizard', 'Globe Search', 'Ticket Hub', 'Recommendation Engine']}
      profiles={venues}
      title="Venue discover"
    />
  );
}
