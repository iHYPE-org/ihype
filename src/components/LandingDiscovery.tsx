import Link from 'next/link';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';
import { releasedMediaWhere } from '@/lib/media-release';
import { isPublicSiteEligible, readProfileSiteConfig } from '@/lib/profile-site';
import { getDemoProfileRelationExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';

export async function LandingDiscovery() {
  const [t, tracks] = await Promise.all([
    getServerT(),
    db.artistMediaAsset.findMany({
      where: {
        ...releasedMediaWhere(),
        mimeType: { startsWith: 'audio/' },
        profile: {
          ...getDemoProfileRelationExclusion().profile,
          type: 'ARTIST', discoverable: true, verificationStatus: 'VERIFIED',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 12,
      select: {
        hexId: true, title: true,
        profile: {
          select: {
            id: true, name: true, slug: true, discoverable: true, verificationStatus: true,
            siteConfig: true, owner: { select: { email: true, username: true } },
          },
        },
      },
    }).catch(() => []),
  ]);
  const featured = tracks.filter(({ profile }, index) =>
    !(shouldHideDemoContent() && isDemoUser(profile.owner))
      && tracks.findIndex(track => track.profile.id === profile.id) === index,
  ).slice(0, 3);
  if (!featured.length) return null;

  return (
    <div className="fan-entry-steps">
      {featured.map(({ hexId, title, profile }) => (
        <article key={hexId}>
          <div>
            <strong>{title}</strong>
            <p>{isPublicSiteEligible(profile) && readProfileSiteConfig(profile.siteConfig).published
              ? <Link prefetch={false} href={`/site/${profile.slug}`}>{profile.name}</Link>
              : profile.name}</p>
            <audio controls preload="none" src={`/api/public-media/${hexId}`}
              style={{ width: '100%' }} aria-label={`${t('fanFirstLanding.playTrack', 'Play track')}: ${title}`} />
          </div>
        </article>
      ))}
    </div>
  );
}
