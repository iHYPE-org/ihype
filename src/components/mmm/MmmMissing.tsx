import Link from 'next/link';

/**
 * "This is gone", rendered INSIDE the MMM shell.
 *
 * A shared show link that has since gone is the ordinary case, not an exotic
 * one, and the marketing 404 is the wrong answer to it: the map is gone, the
 * player is gone, and the way back is a header the member was not using. That
 * is the same "no route back" trap the LISTEN destinations had, arrived at
 * through a different door.
 *
 * ## Why this is a component and not just `notFound()`
 *
 * `/app`'s layout is async — it awaits auth and a DB read — so by the time a
 * page calls `notFound()` the layout has already flushed to the browser. Next
 * then streams the not-found boundary wrapped in its own render of the layout
 * chain, and BOTH end up in the document: two `.mmm-frame`s, two maps, two
 * players, two sets of tiles fetched. It is not a hypothetical; e2e caught it
 * as a strict-mode violation resolving `.mmm-frame` to two elements.
 *
 * A page that RETURNS this instead of throwing renders exactly one shell.
 * `app/not-found.tsx` still exists for genuinely unmatched URLs, where nothing
 * has streamed yet and the boundary is the only renderer.
 */
export function MmmMissing({
  eyebrow = 'Not found',
  title = 'That one is gone',
  body = 'The show may have been cancelled, or the link may be older than it is. The map still knows what is on.',
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
} = {}) {
  return (
    <div className="mmm-show">
      <div className="mmm-show-eyebrow">{eyebrow}</div>
      <h1 className="mmm-show-title">{title}</h1>
      <p className="mmm-me-note">{body}</p>
      <Link
        className="mmm-btn-primary"
        href="/app/map"
        style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}
      >
        Back to the map
      </Link>
    </div>
  );
}
