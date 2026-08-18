'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mmmMeBackTarget, mmmMeRouteTrail } from '@/lib/mmm-me-back';

/**
 * Backstop for ME subpages.
 *
 * A few document-like routes own a more specific return link (Info, Settings,
 * Support, a venue calendar/inbox and a show lineup). Everything else gets the
 * same predictable route back to ME here. Keeping the fallback at the route
 * boundary means a newly added creator tool cannot silently ship as a dead end.
 */
export function MmmMeRouteBack() {
  const pathname = usePathname();
  const target = mmmMeBackTarget(pathname);
  if (!target) return null;
  const trail = mmmMeRouteTrail(pathname);
  return (
    <nav aria-label="Me workspace" className="mmm-me-route-context">
      <Link className="mmm-charter-back mmm-me-route-back" href={target}>‹ Me</Link>
      {trail.length > 0 && (
        <span className="mmm-me-route-trail">
          {trail.map((part, index) => <span key={part}>{index > 0 && <i aria-hidden="true">/</i>}{part}</span>)}
        </span>
      )}
    </nav>
  );
}
