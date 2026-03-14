import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function ArtistsIndexPage() {
  const artists = await getDirectoryProfiles('ARTIST');

  return (
    <ProfileDirectoryPage
      badge="ARTISTS"
      currentHref="/artists"
      description="Browse artist pages, search by city or genre, and hype the acts you want to see rise."
      profiles={artists}
      title="Artist directory"
    />
  );
}
