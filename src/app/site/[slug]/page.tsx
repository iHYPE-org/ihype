import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { readProfileSiteConfig, isSafeSiteUrl } from '@/lib/profile-site';
import './site.css';

export const dynamic = 'force-dynamic';

async function getPublishedSite(slug: string) {
  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, type: true, headline: true, bio: true,
      aboutContent: true, city: true, stateRegion: true, heroImage: true,
      avatarImage: true, contactInfo: true, merchUrl: true, merchContent: true,
      siteConfig: true, verificationStatus: true,
    },
  });
  if (!profile || !['ARTIST', 'VENUE'].includes(profile.type)) return null;
  const site = readProfileSiteConfig(profile.siteConfig);
  if (!site.published || profile.verificationStatus !== 'VERIFIED') return null;
  return { profile, site };
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedSite(slug);
  if (!page) return { title: 'Page not found', robots: { index: false } };
  return {
    title: `${page.profile.name} | Official ${page.profile.type === 'VENUE' ? 'Venue' : 'Artist'} Website`,
    description: (page.site.tagline || page.profile.headline || page.profile.bio || `Find ${page.profile.name} on iHYPE.`).slice(0, 160),
    alternates: { canonical: `/site/${page.profile.slug}` },
    openGraph: {
      title: page.profile.name,
      description: (page.site.tagline || page.profile.headline || '').slice(0, 160),
      images: page.profile.heroImage ? [{ url: page.profile.heroImage }] : undefined,
    },
  };
}

export default async function ProfileSite({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublishedSite(slug);
  if (!result) notFound();
  const { profile, site } = result;
  const now = new Date();

  const [shows, tracks, videos] = await Promise.all([
    site.sections.shows ? db.show.findMany({
      where: {
        OR: profile.type === 'VENUE'
          ? [{ venueProfileId: profile.id }]
          : [{ headlinerProfileId: profile.id }, { lineupSlots: { some: { profileId: profile.id, status: 'ACCEPTED' } } }],
        status: { in: ['SCHEDULED', 'LIVE'] },
        moderationStatus: 'APPROVED',
        startsAt: { gte: now },
        canceledAt: null,
      },
      orderBy: { startsAt: 'asc' },
      take: 8,
      select: { id: true, slug: true, title: true, startsAt: true, posterImage: true },
    }) : Promise.resolve([]),
    site.sections.music && profile.type === 'ARTIST' ? db.artistMediaAsset.findMany({
      where: { profileId: profile.id, isPublished: true, OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { hexId: true, title: true, artworkUrl: true },
    }) : Promise.resolve([]),
    site.sections.videos ? db.profileVideo.findMany({
      where: { profileId: profile.id, status: 'READY', isPublished: true, muxPlaybackId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, muxPlaybackId: true },
    }) : Promise.resolve([]),
  ]);

  const tagline = site.tagline || profile.headline;
  const location = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const merchUrl = isSafeSiteUrl(profile.merchUrl) ? profile.merchUrl : null;

  return (
    <main className={`ih-site ih-site--${site.theme}`}>
      <div className="ih-site-inner">
        <nav className="ih-site-nav" aria-label="Website navigation">
          <Link href="/" className="ih-site-brand">iHYPE<span> / Sites</span></Link>
          <div className="ih-site-nav-links">
            {site.sections.about && <a href="#about">About</a>}
            {site.sections.shows && shows.length > 0 && <a href="#shows">Shows</a>}
            {site.sections.music && tracks.length > 0 && <a href="#music">Music</a>}
            {site.sections.videos && videos.length > 0 && <a href="#videos">Videos</a>}
            {site.sections.contact && profile.contactInfo && <a href="#contact">Contact</a>}
          </div>
        </nav>

        <header className="ih-site-hero">
          {profile.heroImage && <img className="ih-site-hero-image" src={profile.heroImage} alt="" />}
          <div className="ih-site-hero-shade" />
          <div className="ih-site-hero-text">
            <span className="ih-site-eyebrow">{profile.type === 'VENUE' ? 'Live music venue' : 'Independent artist'}{location ? ` · ${location}` : ''}</span>
            <h1>{profile.name}</h1>
            {tagline && <p>{tagline}</p>}
            <div className="ih-site-hero-actions">
              {shows.length > 0 && <a className="ih-site-button" href="#shows">See upcoming shows</a>}
              {tracks.length > 0 && <a className="ih-site-button" href="#music">Listen to music</a>}
              {merchUrl && site.sections.merch && <a className="ih-site-button ih-site-button--outline" href={merchUrl} target="_blank" rel="noopener noreferrer">Shop merch</a>}
            </div>
          </div>
        </header>

        {site.sections.about && (profile.aboutContent || profile.bio) && (
          <section id="about" className="ih-site-section">
            <span className="ih-site-eyebrow">The story</span>
            <h2>About {profile.name}</h2>
            <p className="ih-site-copy">{profile.aboutContent || profile.bio}</p>
          </section>
        )}

        {site.sections.shows && shows.length > 0 && (
          <section id="shows" className="ih-site-section">
            <span className="ih-site-eyebrow">Catch it live</span>
            <h2>Upcoming shows</h2>
            <div className="ih-site-show-list">
              {shows.map(show => (
                <Link href={`/shows/${show.slug}`} className="ih-site-show" key={show.id}>
                  <span className="ih-site-show-date">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(show.startsAt)}</span>
                  <span>{show.title}</span>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {site.sections.music && tracks.length > 0 && (
          <section id="music" className="ih-site-section">
            <span className="ih-site-eyebrow">From the artist</span>
            <h2>Music</h2>
            <div className="ih-site-track-list">
              {tracks.map(track => (
                <div key={track.hexId} className="ih-site-track">
                  <strong>{track.title}</strong>
                  <audio controls preload="none" src={`/api/public-media/${track.hexId}`} aria-label={`Play ${track.title}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {site.sections.videos && videos.length > 0 && (
          <section id="videos" className="ih-site-section">
            <span className="ih-site-eyebrow">Behind the sound</span>
            <h2>Videos</h2>
            <div className="ih-site-video-grid">
              {videos.map(video => (
                <figure className="ih-site-video" key={video.id}>
                  <iframe
                    title={video.title}
                    src={`https://player.mux.com/${video.muxPlaybackId}`}
                    loading="lazy"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  <figcaption>{video.title}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {site.sections.merch && merchUrl && (
          <section id="merch" className="ih-site-section ih-site-contact">
            <h2>Merchandise</h2>
            {profile.merchContent && <p className="ih-site-copy">{profile.merchContent}</p>}
            <a className="ih-site-button" href={merchUrl} rel="noopener noreferrer" target="_blank">Visit merch store ↗</a>
          </section>
        )}

        {site.sections.contact && profile.contactInfo && (
          <section id="contact" className="ih-site-section ih-site-contact">
            <h2>Contact & booking</h2>
            <p className="ih-site-copy">{profile.contactInfo}</p>
          </section>
        )}
        <footer className="ih-site-footer">
          <span>Made with iHYPE · Independent music, together.</span>
          <Link href="/">Discover iHYPE</Link>
        </footer>
      </div>
    </main>
  );
}
