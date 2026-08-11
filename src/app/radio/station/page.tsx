import { redirect } from 'next/navigation';

/**
 * The station moved up to `/radio` — the URL every link in the product already
 * used, once the DJ show listing that occupied it was retired. This stays as a
 * redirect because it is a real URL that may be bookmarked or shared.
 */
export default function StationRedirect() {
  redirect('/radio');
}
