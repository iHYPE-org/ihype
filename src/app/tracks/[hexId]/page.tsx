import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { TrackPlayMainButton, MoreFromArtistList } from './TrackPlayer';
import type { MediaTrack } from '@/components/GlobalMediaPlayer';

export const dynamic = 'force-dynamic';

const RELATED_TRACK_LIMIT = 4;

function fmtDuration(secs: number | null) {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function getTrack(hexId: string) {
  return db.artistMediaAsset.findFirst({
    where: { hexId, isPublished: true },
    select: {
      hexId: true,
      title: true,
      notes: true,
      durationSecs: true,
      artworkUrl: true,
      createdAt: true,
      profileId: true,
      profile: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          genre: true,
          genres: true,
          hypeCount: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ hexId: string }> }): Promise<Metadata> {
  const { hexId } = await params;
  const asset = await getTrack(hexId);
  if (!asset) return { title: 'Track · iHYPE' };
  return {
    title: `${asset.title} · ${asset.profile.name} · iHYPE`,
    description: `Listen to ${asset.title} by ${asset.profile.name} on iHYPE.`,
  };
}

export default async function TrackDetailPage({ params }: { params: Promise<{ hexId: string }> }) {
  const { hexId } = await params;
  const session = await auth();

  const asset = await getTrack(hexId);
  if (!asset) return notFound();

  const artistHref = asset.profile.type === 'DJ' ? `/promoters/${asset.profile.slug}` : `/artists/${asset.profile.slug}`;
  const genre = asset.profile.genre || asset.profile.genres[0] || null;

  const [playCount, latestReport, hypedByMe, moreAssets] = await Promise.all([
    db.mediaListen.count({ where: { mediaId: hexId } }),
    db.contentReport.findFirst({
      where: { targetType: 'track', targetId: hexId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    }),
    session?.user?.id
      ? db.profileHypeEvent.findUnique({
          where: { userId_profileId: { userId: session.user.id, profileId: asset.profile.id } },
          select: { userId: true },
        })
      : null,
    db.artistMediaAsset.findMany({
      where: { profileId: asset.profileId, isPublished: true, hexId: { not: hexId } },
      orderBy: { createdAt: 'desc' },
      take: RELATED_TRACK_LIMIT,
      select: { hexId: true, title: true, durationSecs: true, artworkUrl: true },
    }),
  ]);

  // Real copyright status: reflects this track's actual ContentReport trail
  // (raised by runTrackScanPipeline at upload — see src/lib/media-vetting.ts),
  // not a hardcoded "Cleared" label. A track that reaches this public page is
  // always isPublished — an ACTIONED (removed) report would have unpublished
  // it — so only OPEN/DISMISSED/no-report states are reachable here.
  let copyrightStatus: { label: string; tone: 'ok' | 'pending' } = { label: 'Cleared · no flags at upload', tone: 'ok' };
  if (latestReport?.status === 'OPEN') {
    copyrightStatus = { label: 'Flagged · pending manual review', tone: 'pending' };
  } else if (latestReport?.status === 'DISMISSED') {
    copyrightStatus = { label: 'Cleared · reviewed by moderator', tone: 'ok' };
  }

  const duration = fmtDuration(asset.durationSecs);

  const mainTrack: MediaTrack = {
    id: `${asset.profile.slug}-${asset.hexId}`,
    title: asset.title,
    artistName: asset.profile.name,
    url: `/api/public-media/${asset.hexId}`,
    mediaId: asset.hexId,
    artistProfileSlug: asset.profile.slug,
    notes: asset.notes,
    artworkUrl: asset.artworkUrl,
  };

  return (
    <div className="track-page">
      <div className="track-card">
        <div className="track-hero">
          <div
            className="track-art"
            style={asset.artworkUrl ? { backgroundImage: `url(${asset.artworkUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          />
          <div className="track-hero-info">
            <div className="track-eyebrow">Track</div>
            <h1 className="track-title">{asset.title}</h1>
            <div className="track-meta-line">
              <Link href={artistHref}>{asset.profile.name}</Link>
              {genre ? ` · ${genre}` : ''}
              {duration ? ` · ${duration}` : ''}
            </div>
            <div className="track-actions">
              <TrackPlayMainButton track={mainTrack} />
              {/* No per-track hype mechanism exists in this schema (only
                  ProfileHypeEvent, which is profile-level). Reusing the real
                  artist-hype action here rather than inventing a track
                  counter — this hypes the artist, and shows their real
                  Profile.hypeCount, not a fabricated per-track number. */}
              <HypeButton
                targetType="profile"
                targetId={asset.profile.id}
                initialCount={asset.profile.hypeCount}
                initiallyHyped={Boolean(hypedByMe)}
                entityLabel={asset.profile.name}
              />
              <Link className="button secondary" href={artistHref}>View artist</Link>
            </div>
            <div className="track-hype-hint">Hype {asset.profile.name} — not a per-track counter (none exists yet).</div>
          </div>
        </div>

        <div className="track-stats-row">
          <div>
            <div className="track-stat-val">{playCount.toLocaleString()}</div>
            <div className="track-stat-label">Plays</div>
          </div>
          <div>
            <div className="track-stat-val">{asset.profile.hypeCount.toLocaleString()}</div>
            <div className="track-stat-label">Artist Hypes</div>
          </div>
          <div>
            <div className="track-stat-val">{asset.createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
            <div className="track-stat-label">Uploaded</div>
          </div>
        </div>

        <div className="track-eyebrow-sm">Credits</div>
        <div className="track-credits">
          <div className="track-credit-row">
            <span>Artist</span>
            <span><Link href={artistHref}>{asset.profile.name}</Link></span>
          </div>
          <div className="track-credit-row">
            <span>Genre</span>
            <span>{genre || '—'}</span>
          </div>
          <div className="track-credit-row">
            <span>Copyright status</span>
            <span className={copyrightStatus.tone === 'ok' ? 'track-status-ok' : 'track-status-pending'}>{copyrightStatus.label}</span>
          </div>
        </div>

        <div className="track-section-head">
          <span className="track-eyebrow-sm">More from {asset.profile.name}</span>
        </div>
        <MoreFromArtistList
          track={mainTrack}
          related={moreAssets.map((a) => ({
            hexId: a.hexId,
            title: a.title,
            durationSecs: a.durationSecs,
            artworkUrl: a.artworkUrl,
            href: `/tracks/${a.hexId}`,
          }))}
          artistName={asset.profile.name}
          artistSlug={asset.profile.slug}
          artworkUrl={asset.artworkUrl}
        />
      </div>

      <style>{`
        .track-page { max-width: 680px; margin: 0 auto; padding: 40px 24px 100px; }
        .track-card { border: 1px solid var(--line); border-radius: var(--radius-xl); background: var(--bg2); padding: 22px 18px 18px; }
        .track-hero { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 28px; }
        .track-art { width: 160px; height: 160px; border-radius: var(--radius-lg); flex-shrink: 0; background: linear-gradient(135deg, var(--accent), #b983ff); }
        .track-hero-info { flex: 1; min-width: 200px; }
        .track-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
        .track-title { font-family: var(--font-display); font-size: 30px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 4px; color: var(--ink); }
        .track-meta-line { font-size: 14px; color: var(--ink-a55); margin-bottom: 16px; }
        .track-meta-line a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
        .track-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .track-hype-hint { font-size: 11px; color: var(--ink-a50); margin-top: 8px; }
        .track-stats-row { display: flex; gap: 28px; margin-bottom: 28px; flex-wrap: wrap; }
        .track-stat-val { font-size: 20px; font-weight: 700; color: var(--accent); font-family: var(--font-display); }
        .track-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); margin-top: 2px; }
        .track-eyebrow-sm { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); }
        .track-credits { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg3, var(--bg2)); margin-top: 12px; margin-bottom: 28px; }
        .track-credit-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--line); font-size: 13px; }
        .track-credit-row:last-child { border-bottom: none; }
        .track-credit-row span:first-child { color: var(--ink-a55); }
        .track-credit-row span:last-child { font-weight: 600; color: var(--ink); }
        .track-credit-row a { color: inherit; }
        .track-status-ok { color: var(--role-venue, #22e5d4) !important; }
        .track-status-pending { color: var(--accent) !important; }
        .track-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; }
        .track-empty { text-align: center; padding: 30px 24px; color: var(--ink-a50); }
        .track-more-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .track-more-row { display: flex; gap: 14px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg3, var(--bg2)); }
        .track-more-art { width: 44px; height: 44px; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--accent); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .track-more-info { flex: 1; min-width: 0; text-decoration: none; color: inherit; }
        .track-more-title { font-family: var(--font-display); font-weight: 800; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .track-more-duration { font-size: 11.5px; color: var(--ink-a55); }

        @media (max-width: 600px) {
          .track-page { padding: 28px 16px 100px; }
        }
      `}</style>
    </div>
  );
}
