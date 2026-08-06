import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import { db } from '@/lib/db';
import { ModuleDeckMockup, type DeckViewer } from '@/app/ui-preview/ModuleDeckMockup';
import { areMapsEnabledRuntime, isRadioEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Listen · iHYPE',
  description: 'Discovery, radio, and charts — personalized for your taste.',
  robots: { index: false, follow: false },
};

export default async function ListenPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/listen');
  }

  await searchParams;
  const userId = session.user.id;
  const [user, discoveryAdds, showsAttended, songsHeard, showHypes, profileHypes, playlistCount, campaigns] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        username: true,
        image: true,
        role: true,
        hypeBalance: true,
        profiles: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            name: true,
            slug: true,
            hypeCount: true,
            _count: { select: { mediaUploads: true, followers: true, hostedShows: true, headlinerShows: true } },
          },
        },
      },
    }),
    db.seed.count({ where: { userId, action: 'save' } }),
    db.showAttendee.count({ where: { userId } }),
    db.mediaListen.count({ where: { userId } }),
    db.hypeEvent.count({ where: { userId } }),
    db.profileHypeEvent.count({ where: { userId } }),
    db.fanPlaylist.count({ where: { userId } }),
    db.ad.findMany({ where: { advertiserId: userId }, select: { impressions: true, spentCents: true, status: true } }),
  ]);

  if (!user) redirect('/login?callbackUrl=/listen');
  const format = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const roles = new Set<DeckViewer['roles'][number]>();
  const accountRole = user.role.toLowerCase();
  if (accountRole === 'fan' || accountRole === 'artist' || accountRole === 'dj' || accountRole === 'venue' || accountRole === 'advertiser') roles.add(accountRole);
  for (const profile of user.profiles) {
    const profileRole = profile.type.toLowerCase();
    if (profileRole === 'artist' || profileRole === 'dj' || profileRole === 'venue') roles.add(profileRole);
  }
  if (roles.size === 0) roles.add('fan');

  const creatorMetrics = (type: 'ARTIST' | 'VENUE'): Array<[string, string]> => {
    const owned = user.profiles.filter((profile) => profile.type === type);
    const total = (pick: (profile: typeof owned[number]) => number) => owned.reduce((sum, profile) => sum + pick(profile), 0);
    return [
      ['HYPES received', format.format(total((profile) => profile.hypeCount))],
      ['Published tracks', format.format(total((profile) => profile._count.mediaUploads))],
      ['Followers', format.format(total((profile) => profile._count.followers))],
      [type === 'VENUE' ? 'Hosted shows' : 'Headliner shows', format.format(total((profile) => type === 'VENUE' ? profile._count.hostedShows : profile._count.headlinerShows))],
      ['Active pages', String(owned.length)],
      ['Signal status', owned.length > 0 ? 'LIVE' : 'SET UP'],
    ];
  };
  const metrics: DeckViewer['metrics'] = {
    fan: [
      ['HYPE balance', format.format(user.hypeBalance)],
      ['Discovery adds', format.format(discoveryAdds)],
      ['Shows attended', format.format(showsAttended)],
      ['Songs heard', format.format(songsHeard)],
      ['HYPES sent', format.format(showHypes + profileHypes)],
      ['Playlists', format.format(playlistCount)],
    ],
    artist: creatorMetrics('ARTIST'),
    venue: creatorMetrics('VENUE'),
    advertiser: [
      ['Campaigns', String(campaigns.length)],
      ['Active campaigns', String(campaigns.filter((campaign) => campaign.status === 'ACTIVE').length)],
      ['Qualified listens', format.format(campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0))],
      ['Spend', `$${(campaigns.reduce((sum, campaign) => sum + campaign.spentCents, 0) / 100).toFixed(2)}`],
      ['Data sold', 'NEVER'],
      ['Targeting', 'AGGREGATE'],
    ],
  };
  const viewer: DeckViewer = {
    name: user.name || user.username || user.email?.split('@')[0] || 'iHYPE fan',
    role: user.role === 'ADVERTISER' ? 'Advertiser account' : `${user.role.charAt(0)}${user.role.slice(1).toLowerCase()} account`,
    avatarUrl: user.image,
    roles: Array.from(roles),
    metrics,
    activation: {
      played: songsHeard > 0,
      hyped: showHypes + profileHypes > 0,
      saved: discoveryAdds > 0,
      foundEvent: showsAttended > 0,
    },
  };

  const [maps, radio] = await Promise.all([areMapsEnabledRuntime(), isRadioEnabledRuntime()]);

  return <ModuleDeckMockup production features={{ maps, radio }} viewer={viewer} />;
}
