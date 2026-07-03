import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { AdminNav } from '@/components/AdminNav';
import { PlaylistCreateForm } from '@/components/admin/PlaylistCreateForm';
import { PlaylistActions } from '@/components/admin/PlaylistActions';

export const metadata: Metadata = { title: 'Curated Playlists · Admin · iHYPE' };
export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  const session = await auth();
  if (!isAdminSession(session)) redirect('/login');

  const playlists = await db.curatedPlaylist.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <main className="container section">
      <AdminNav active="playlists" />
      <h1 className="title">Curated Playlists</h1>
      <p className="meta" style={{ marginBottom: 16 }}>
        Manage staff-curated playlists. Track lists are edited via <code>PATCH /api/admin/playlists/:id</code> with a <code>tracks</code> array — no in-page track editor yet.
      </p>

      <PlaylistCreateForm />

      {playlists.length === 0 ? (
        <p className="meta">No playlists yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Tracks</th>
              <th>Published</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((pl) => {
              const tracks = Array.isArray(pl.tracks) ? pl.tracks : [];
              return (
                <tr key={pl.id}>
                  <td>{pl.title}</td>
                  <td>{tracks.length}</td>
                  <td>{pl.published ? '✓' : '—'}</td>
                  <td>{new Date(pl.createdAt).toLocaleDateString()}</td>
                  <td><PlaylistActions id={pl.id} published={pl.published} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
