import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function VenuesIndexPage() {
  const venues = await getDirectoryProfiles('VENUE');

  return (
    <ProfileDirectoryPage
      badge="VENUES"
      currentHref="/venues"
      description="Search venue pages by city and signal, then hype the rooms you want fans and artists to rally around."
      profiles={venues}
      title="Venue directory"
    />
  );
}
