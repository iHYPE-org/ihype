import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';
import { getDirectoryProfiles } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

export default async function ListenersIndexPage() {
  const listeners = await getDirectoryProfiles('LISTENER');

  return (
    <ProfileDirectoryPage
      badge="FANS"
      currentHref="/fans"
      description="Fan discover is where fans browse pages, follow hype, and jump into the tools that shape identity and event discovery."
      modules={['Sign Up Wizard', 'Character Lab', 'Globe Search', 'Recommendation Engine', 'Ticket Hub']}
      profiles={listeners}
      title="Fan discover"
    />
  );
}
