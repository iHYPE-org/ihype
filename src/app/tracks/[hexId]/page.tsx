import { redirect } from 'next/navigation';

export default async function TrackAlias({ params }: { params: Promise<{ hexId: string }> }) {
  const { hexId } = await params;
  redirect(`/app/tracks/${encodeURIComponent(hexId)}`);
}
