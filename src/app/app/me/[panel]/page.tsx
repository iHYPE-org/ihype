import { redirect } from 'next/navigation';
import { canonicalMePanelId } from '@/lib/mmm-me-panels';

export const dynamic = 'force-dynamic';

/**
 * The ME panels used to be pages here. The current shell revision makes
 * ME one column whose Account rows open **in place**, so the panel is a drawer
 * on `/app/me` and this route is the way the old URLs keep working.
 *
 * A redirect rather than a deletion, because these paths are real: they were
 * linked from the shell for months, and `/app/me/settings` in particular is the
 * kind of URL people bookmark. Redirecting lands them on the same content with
 * the right drawer already open.
 *
 * An unknown panel goes to `/app/me` rather than 404ing — the surface it was
 * asking for still exists, only the panel name is wrong, and dropping someone
 * on a not-found page for a stale query is worse than showing them ME.
 */
export default async function MmmMePanelPage({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  const canonical = canonicalMePanelId(panel);
  redirect(canonical ? `/app/me?panel=${canonical}` : '/app/me');
}
