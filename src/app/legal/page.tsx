import { redirect } from 'next/navigation';

/**
 * Merged into the /info hub. Kept as a redirect rather than deleted: this
 * URL is referenced from the cookie banner, signup terms consent and emails
 * and breaking it would strand people on a 404.
 */
export default function LegalRedirect() {
  redirect('/info?tab=terms');
}
