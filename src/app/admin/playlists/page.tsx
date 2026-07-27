import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { PlaylistCreateForm } from '@/components/admin/PlaylistCreateForm';
import { PlaylistActions } from '@/components/admin/PlaylistActions';
import { getLocale, getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Curated Playlists · Admin · iHYPE' };
export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  const session = await auth();
  if (!isAdminSession(session)) redirect('/login');

  const t = getT(await getLocale());
  const playlists = await db.curatedPlaylist.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="container section">
      <h1 className="title">{t('adminPlaylistsPage.title', 'Curated Playlists')}</h1>
      <p className="meta" style={{ marginBottom: 16 }}>
        {t('adminPlaylistsPage.description', 'Manage staff-curated playlists. Track lists are edited via')} <code>PATCH /api/admin/playlists/:id</code> {t('adminPlaylistsPage.descriptionSuffix', 'with a')} <code>tracks</code> {t('adminPlaylistsPage.descriptionSuffix2', 'array — no in-page track editor yet.')}
      </p>

      <PlaylistCreateForm />

      {playlists.length === 0 ? (
        <p className="meta">{t('adminPlaylistsPage.noPlaylists', 'No playlists yet.')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('adminPlaylistsPage.colTitle', 'Title')}</th>
              <th>{t('adminPlaylistsPage.colTracks', 'Tracks')}</th>
              <th>{t('adminPlaylistsPage.colPublished', 'Published')}</th>
              <th>{t('adminPlaylistsPage.colCreated', 'Created')}</th>
              <th>{t('adminPlaylistsPage.colActions', 'Actions')}</th>
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
    </div>
  );
}
