import { redirect } from 'next/navigation';

/**
 * Merged into the /info hub. Kept as a redirect rather than deleted: this
 * URL is referenced from the charter, support pages and external write-ups
 * and breaking it would strand people on a 404.
 */
export default function AuditRedirect() {
  redirect('/info?tab=trust');
}
