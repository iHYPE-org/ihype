import { redirect } from 'next/navigation';

/**
 * Merged into the /info hub. This URL is cited in the privacy policy itself,
 * in signup consent copy and in app-store listings, so it must keep working.
 */
export default function PrivacyRedirect() {
  redirect('/info?tab=privacy');
}
