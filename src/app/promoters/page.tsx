import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function PromotersIndexPage() {
  const promoters = await getDirectoryProfiles('DJ');

  return (
    <ProfileDirectoryPage
      badge="PROMOTERS"
      currentHref="/promoters"
      description="Find the promoters building scenes, opening rooms, and moving real hype around artists and venues."
      profiles={promoters}
      title="Promoter directory"
    />
  );
}
