import { redirect } from 'next/navigation';

const TABS = ['trust', 'transparency', 'privacy', 'terms', 'charter', 'dmca'];

/**
 * Merged into the /info hub. Kept as a redirect rather than deleted: this
 * URL is referenced from the cookie banner, signup terms consent and emails
 * and breaking it would strand people on a 404.
 *
 * The `?tab=` has to be forwarded. Callers were already passing one — the
 * cookie banner asked for `/legal?tab=privacy` and the homepage's "Read the
 * full charter" asked for `/legal?tab=charter` — and this redirect dropped
 * it, so both landed on Terms of Service. A privacy link that shows the terms
 * is worse than a dead one: it looks like it worked.
 */
export default async function LegalRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(`/info?tab=${tab && TABS.includes(tab) ? tab : 'terms'}`);
}
