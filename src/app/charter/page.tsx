import { redirect } from 'next/navigation';

/**
 * Folded into the /info hub's charter tab. Kept as a redirect: /charter is
 * cited in signup copy, the community page, journal posts and the charter's
 * own "locked in" language, and it is the URL people are told to check when
 * they want to verify the 70/20/10 claim.
 *
 * The three sections that lived only here — "How iHYPE makes money",
 * "Promoters and the 10%", "What actually makes this real" — moved into the
 * tab along with the split bar, the callout treatment and the contact line,
 * so nothing was dropped. The count-up animation on the split percentages was
 * not carried across (see the comment at that markup for why).
 */
export default function CharterRedirect() {
  redirect('/info?tab=charter');
}
