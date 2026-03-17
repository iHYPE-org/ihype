import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function ArtistsIndexPage() {
  const artists = await getDirectoryProfiles('ARTIST');

  return (
    <ProfileDirectoryPage
      badge="ARTISTS"
      currentHref="/artists"
      description="Artist discover is where artists browse the scene, track opportunities, and move between the tools tied to artist growth."
      modules={['Sign Up Wizard', 'Globe Search', 'Ticket Hub', 'Recommendation Engine']}
      profiles={artists}
      title="Artist discover"
    />
  );
}
