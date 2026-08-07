import type { Metadata } from 'next';
import { EventsHome } from '@/components/EventsHome';

export const metadata: Metadata = {
  title: 'Events · iHYPE',
  description: 'Face value, zero fees. Every ticket — 70% artist, 20% venue, 10% promoters.',
  robots: { index: false, follow: false },
};

/**
 * Events, inside the Music · Map · Me shell.
 *
 * ## Why this is a re-parenting and not a new module
 *
 * MMM's design draws exactly three modules — MAP, MUSIC, ME — in both sources
 * (`SimplifiedApp.dc.html` and `SimpleApp.dc.html`), and its arc nav is a
 * per-viewport COORDINATE TABLE built for three items (`ARC` in `mmm-nav.ts`).
 * There is no `.dc.html` anywhere for an EVENTS module, so building one would
 * mean inventing both a nav entry and a module's worth of layout — the single
 * thing CLAUDE.md is strictest about.
 *
 * What it does instead: renders the EXISTING, already-designed Events surface
 * inside MMM's frame. Same component, same data, same backend wiring — only
 * the chrome around it changes. That is what actually fixes the reported
 * problem, which was never "Events looks wrong", it was "tapping Events throws
 * me into the other shell and I cannot get back".
 *
 * `EventsHome` is safe outside the legacy shell: `useMobileShell()` and
 * `useAppShellActive()` are plain `useContext` reads with defaults, so with no
 * provider above them the component renders its own in-page tab strip instead
 * of delegating to a context strip that is not there. That is exactly the
 * behaviour wanted here, and it is why this route is four lines rather than a
 * fork of a 443-line component.
 *
 * `.mmm-pane` is the same scroll container MUSIC and ME use, which keeps the
 * one-scroll-container rule intact: the pane scrolls, never the document.
 *
 * KNOWN AND DELIBERATE: the content inside still paints from the legacy card
 * language rather than MMM's `mmm-card` primitives, so it does not yet *look*
 * like MUSIC or ME. Restyling it is a design question (there is nothing drawn
 * to copy), and doing it by eye would be the guess this comment exists to
 * avoid. Structure first, paint when there is a source.
 */
export default async function MmmEventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; ticketView?: string }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  return (
    <div className="mmm-pane">
      <EventsHome initialTab={resolved.tab} initialTicketView={resolved.ticketView} />
    </div>
  );
}
