import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function PromotersIndexPage() {
  const promoters = await getDirectoryProfiles('DJ');

  return (
    <ProfileDirectoryPage
      badge="PROMOTERS"
      currentHref="/promoters"
      description="Promoter discover is where promoters browse the network and open the tools connected to booking, routing, and audience growth."
      modules={['Sign Up Wizard', 'Show Creator', 'Globe Search', 'Ticket Hub', 'Recommendation Engine']}
      profiles={promoters}
      title="Promoter discover"
    />
  );
}
