import { redirect } from 'next/navigation';

export default async function PlaylistAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/playlists/${encodeURIComponent(slug)}`);
}
