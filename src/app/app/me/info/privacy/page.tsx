import { redirect } from 'next/navigation';

/**
 * The privacy policy is the second part of the one legal document, not a
 * second document. This URL stays because it is in signup consent copy, the
 * cookie banner and installed service-worker caches — it forwards to the
 * part's own anchor rather than the top of the page, so a member who asked
 * for the privacy policy lands on it.
 */
export default function MmmPrivacyPage() {
  redirect('/app/me/info/terms#privacy');
}
