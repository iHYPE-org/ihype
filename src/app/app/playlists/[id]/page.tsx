import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { MmmMissing } from '@/components/mmm/MmmMissing';

export const dynamic = 'force-dynamic';

/**
 * A playlist, inside the shell.
 *
 * MUSIC's Playlists tab listed playlists and then sent each one to
 * `/playlist/<id>` in the legacy shell — the same leak as tracks, on the tab
 * whose entire purpose is playlists.
 *
 * Note the route is `/app/playlists/[id]` (plural), matching the MUSIC tab it
 * belongs to, while the legacy route is `/playlist/[slug]` (singular) and takes
 * a `FanPlaylist.id` despite the parameter's name. The legacy naming is left
 * alone: it is linked from elsewhere and renaming it buys nothing.
 */
export default async function MmmPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/playlists/${id}`);

  const playlist = await db.fanPlaylist.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      user: { select: { username: true } },
      items: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, artistName: true, mediaId: true },
      },
    },
  });

  // Returned, not thrown — see `MmmMissing`.
  if (!playlist) return <MmmMissing title="No such playlist" body="It may have been deleted, or the link may be older than it is." />;

  return (
    <div className="mmm-show">
      <Link className="mmm-show-back" href="/app/music/playlists">← Playlists</Link>

      <div className="mmm-show-eyebrow">Playlist</div>
      <h1 className="mmm-show-title">{playlist.name}</h1>
      <div className="mmm-show-where">
        by @{playlist.user.username} · {playlist.items.length} {playlist.items.length === 1 ? 'track' : 'tracks'}
      </div>

      <section className="mmm-profile-section">
        {playlist.items.length === 0 ? (
          <p className="mmm-me-note">This playlist is empty.</p>
        ) : (
          <ol className="mmm-playlist-items">
            {/* `mediaId`, `title` and `artistName` are all non-nullable on
                FanPlaylistItem, so every row links and none of them needs a
                fallback. */}
            {playlist.items.map((item, index) => (
              <li key={item.id}>
                <Link className="mmm-profile-show" href={`/app/tracks/${item.mediaId}`}>
                  <span className="mmm-playlist-index">{index + 1}</span>
                  <span className="mmm-profile-show-main">
                    <span className="mmm-profile-show-title">{item.title}</span>
                    <span className="mmm-profile-show-where">{item.artistName}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
