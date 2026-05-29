import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PlaylistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const playlist = await db.fanPlaylist.findUnique({
    where: { id: slug },
    include: {
      items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      user: { select: { username: true } },
    },
  });

  if (!playlist) notFound();

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="meta" style={{ marginBottom: 4 }}>
          Playlist by <strong>@{playlist.user.username}</strong>
        </div>
        <h1 style={{ marginBottom: 4 }}>{playlist.name}</h1>
        <p className="meta">{playlist.items.length} tracks</p>
      </div>

      {playlist.items.length === 0 && (
        <p className="meta">This playlist is empty.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {playlist.items.map((item, i) => (
          <div key={item.id} className="panel" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#888', minWidth: 24 }}>{i + 1}</span>
            {item.artworkUrl && (
              <img src={item.artworkUrl} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
              <div className="meta">
                {item.artistProfileSlug
                  ? <Link href={`/${item.artistProfileSlug}`}>{item.artistName}</Link>
                  : item.artistName}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Link href="/" className="button">Explore iHYPE</Link>
      </div>
    </div>
  );
}
