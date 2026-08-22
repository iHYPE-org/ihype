import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmTrackPlayIntent } from '@/components/mmm/MmmTrackPlayIntent';
import { copyrightTone, resolveCopyrightState, type CopyrightState } from '@/lib/track-detail';

export const dynamic = 'force-dynamic';

const COPYRIGHT_LABEL: Record<CopyrightState, string> = {
  flagged: 'Flagged · pending manual review',
  'cleared-reviewed': 'Cleared · reviewed by moderator',
  'cleared-unflagged': 'Cleared · no flags at upload',
};

function fmtDuration(secs: number | null): string | null {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * A track, inside the shell.
 *
 * MUSIC's own content was leaking out of MUSIC: a track row linked at
 * `/tracks/<hexId>`, which renders in the legacy shell. Tapping a track in the
 * music module and landing outside the music module is the least defensible of
 * the doors this shell had open.
 *
 * The copyright line is carried across deliberately rather than dropped as
 * detail. It reflects the track's real `ContentReport` trail from
 * `runTrackScanPipeline()` at upload — a platform that asks artists to trust a
 * 4-layer scan should show them what it concluded, and showing it on the legacy
 * page only would mean the new shell quietly said less.
 */
export default async function MmmTrackPage({ params }: { params: Promise<{ hexId: string }> }) {
  const { hexId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/tracks/${hexId}`);

  const asset = await db.artistMediaAsset.findFirst({
    where: { hexId, isPublished: true },
    select: {
      hexId: true,
      title: true,
      notes: true,
      durationSecs: true,
      createdAt: true,
      profileId: true,
      freeUseEnabled: true,
      /* Selected so the dock's joystick can play this track. The page rendered
         without them and had no play control at all — a track's own page in a
         music app with no way to hear it. Both are nullable in the row: a track
         can be published before its audio is stored. */
      storageUrl: true,
      artworkUrl: true,
      profile: { select: { id: true, slug: true, name: true, genre: true, genres: true, hypeCount: true } },
    },
  });

  // Returned, not thrown — see `MmmMissing`.
  if (!asset) return <MmmMissing title="No such track" body="It may have been unpublished, or the link may be older than it is. The music module still knows what is playing." />;

  const [playCount, latestReport, hypedByMe] = await Promise.all([
    db.mediaListen.count({ where: { mediaId: hexId } }).catch(() => null),
    db.contentReport
      .findFirst({
        where: { targetType: 'track', targetId: hexId },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      })
      .catch(() => null),
    db.profileHypeEvent
      .findUnique({
        where: { userId_profileId: { userId: session.user.id, profileId: asset.profile.id } },
        select: { createdAt: true },
      })
      .catch(() => null),
  ]);

  /* The STATE is `@/lib/track-detail`'s, shared with the public copy of this
     page; only the copy is this file's. A track reaching either page is always
     published — an ACTIONED report unpublishes it — which is why there are
     three states and no "removed" one.

     Known gap, stated rather than hidden: these labels are hardcoded English
     while the public page runs the same three through `getServerT()`. Sharing
     the state is what stops the two disagreeing about whether a track is
     flagged; translating this pane is separate work. */
  const copyrightState = resolveCopyrightState(latestReport?.status);
  const copyright = {
    label: COPYRIGHT_LABEL[copyrightState],
    tone: copyrightTone(copyrightState),
  };

  const duration = fmtDuration(asset.durationSecs);
  const genre = asset.profile.genre || asset.profile.genres[0] || null;

  return (
    <div className="mmm-show">
      <Link className="mmm-show-back" href="/app/music/discover">← Music</Link>

      <div className="mmm-show-eyebrow">Track</div>
      {/* Renders nothing; hands this track to the dock's transport. */}
      <MmmTrackPlayIntent
        artistName={asset.profile.name}
        artistSlug={asset.profile.slug}
        artworkUrl={asset.artworkUrl}
        hexId={asset.hexId}
        title={asset.title}
        url={asset.storageUrl}
      />
      <h1 className="mmm-show-title">{asset.title}</h1>
      <div className="mmm-show-by">
        <Link href={`/app/artists/${asset.profile.slug}`}>{asset.profile.name}</Link>
      </div>

      <div className="mmm-profile-badges">
        {duration && <span className="mmm-profile-badge">{duration}</span>}
        {genre && <span className="mmm-profile-badge">{genre}</span>}
        {/* `null` is not zero: a count that could not be read renders nothing
            rather than claiming the track has never been played. */}
        {playCount !== null && (
          <span className="mmm-profile-badge">{playCount.toLocaleString()} plays</span>
        )}
        {asset.freeUseEnabled && (
          <span className="mmm-profile-badge" data-kind="verified">Free-use</span>
        )}
      </div>

      {asset.notes && <p className="mmm-me-note">{asset.notes}</p>}

      <div className="mmm-profile-actions">
        {/* Hype is profile-level in the schema — there is no per-track hype
            anywhere — so this hypes the artist, and the label says artist. The
            legacy page reached the same conclusion; inventing a track-level
            count here would be inventing a number. */}
        <HypeButton
          entityLabel="artist"
          initialCount={asset.profile.hypeCount}
          lastHypedAt={hypedByMe?.createdAt?.toISOString() ?? null}
          targetId={asset.profile.id}
          targetType="profile"
        />
      </div>

      <section className="mmm-profile-section">
        <h2 className="mmm-profile-section-title">Copyright</h2>
        <p className="mmm-track-copyright" data-tone={copyright.tone}>{copyright.label}</p>
      </section>
    </div>
  );
}
