import { redirect } from 'next/navigation';

/**
 * Merged into the /info hub. Kept as a redirect rather than deleted: this
 * URL is referenced from the homepage, charter and footer copy
 * and breaking it would strand people on a 404.
 */
export default function TransparencyRedirect() {
  redirect('/info?tab=transparency');
}
