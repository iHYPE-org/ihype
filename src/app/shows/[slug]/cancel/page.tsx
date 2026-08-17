import { redirect } from 'next/navigation';

export default async function CancelShowAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/me/shows/${encodeURIComponent(slug)}/cancel`);
}
