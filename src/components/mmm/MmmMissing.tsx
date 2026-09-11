import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import type { Translate } from '@/lib/mmm-shell-labels';

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
/**
 * What is missing, as a KIND rather than as a sentence.
 *
 * Seven call sites each passed their own `title` and `body`, so the copy for
 * "this is gone" was duplicated English scattered across the routes that
 * discover it — untranslatable without touching all seven, and free to drift
 * apart in tone. The pages now name the kind and the wording lives here, once,
 * as literal `t('key', 'English')` calls the extractor can see.
 */
const MISSING_KINDS = [
  'show', 'artist', 'venue', 'track', 'playlist', 'ticket', 'ticket-other', 'tab',
] as const;

export type MmmMissingKind = typeof MISSING_KINDS[number];

function copyFor(t: Translate, kind: MmmMissingKind): { title: string; body: string } {
  switch (kind) {
    case 'artist':
      return {
        title: t('mmmMissing.artistTitle', 'No such artist'),
        body: t('mmmMissing.artistBody', 'That profile may have been removed, or the link may be older than it is. The map still knows who is playing.'),
      };
    case 'venue':
      return {
        title: t('mmmMissing.venueTitle', 'No such venue'),
        body: t('mmmMissing.venueBody', 'It may have been removed, or the link may be older than it is. The map still knows what is open tonight.'),
      };
    case 'track':
      return {
        title: t('mmmMissing.trackTitle', 'No such track'),
        body: t('mmmMissing.trackBody', 'It may have been unpublished, or the link may be older than it is. The music module still knows what is playing.'),
      };
    case 'playlist':
      return {
        title: t('mmmMissing.playlistTitle', 'No such playlist'),
        body: t('mmmMissing.playlistBody', 'It may have been deleted, or the link may be older than it is.'),
      };
    case 'ticket':
      return {
        title: t('mmmMissing.ticketTitle', 'No such ticket'),
        body: t('mmmMissing.ticketBody', 'That ticket may have been transferred or refunded — a passed-on ticket is reissued under a new code and the old one stops existing on purpose.'),
      };
    case 'ticket-other':
      return {
        title: t('mmmMissing.ticketOtherTitle', 'Not your ticket'),
        body: t('mmmMissing.ticketOtherBody', 'This ticket belongs to another account.'),
      };
    case 'tab':
      return {
        title: t('mmmMissing.tabTitle', 'No such tab'),
        body: t('mmmMissing.tabBody', 'That is not one of the MUSIC tabs.'),
      };
    case 'show':
    default:
      return {
        title: t('mmmMissing.showTitle', 'That one is gone'),
        body: t('mmmMissing.showBody', 'The show may have been cancelled, or the link may be older than it is. The map still knows what is on.'),
      };
  }
}

export async function MmmMissing({ kind = 'show' }: { kind?: MmmMissingKind } = {}) {
  const t = await getServerT();
  const { title, body } = copyFor(t, kind);
  return (
    <div className="mmm-show">
      <div className="mmm-show-eyebrow">{t('mmmMissing.eyebrow', 'Not found')}</div>
      <h1 className="mmm-show-title">{title}</h1>
      <p className="mmm-me-note">{body}</p>
      <Link
        className="mmm-btn-primary"
        href="/app/map"
        style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}
      >
        {t('mmmMissing.backToMap', 'Back to the map')}
      </Link>
    </div>
  );
}
