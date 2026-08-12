import Link from 'next/link';

/**
 * Not-found, inside the shell.
 *
 * `/app/shows/<slug>` calls `notFound()` for a show that has been deleted,
 * cancelled into a draft, or simply mistyped — and a shared link to a show that
 * has since gone is the ordinary case, not an exotic one. Without a boundary
 * here that bubbles to the ROOT not-found, which renders the marketing 404
 * outside MMM: the map is gone, the player is gone, and the way back is a
 * marketing header the member was not using. That is the same "no route back"
 * trap the LISTEN destinations had, arrived at by a different door.
 *
 * This keeps them in the shell, and the way out is the map they came from.
 */
export default function MmmNotFound() {
  return (
    <div className="mmm-show">
      <div className="mmm-show-eyebrow">Not found</div>
      <h1 className="mmm-show-title">That one is gone</h1>
      <p className="mmm-me-note">
        The show may have been cancelled, or the link may be older than it is. The map
        still knows what is on.
      </p>
      <Link className="mmm-btn-primary" href="/app/map" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
        Back to the map
      </Link>
    </div>
  );
}
