import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';

/**
 * Every link inside the MMM shell that leaves it, counted — so closing a door
 * is measurable and opening a new one is deliberate.
 *
 * The trap this guards is documented and has already been sprung once: MMM has
 * no Events or Pages module, so it links out to surfaces that render in the
 * LEGACY shell. A member who taps one gets a different header, a different
 * player, and a way back only through a drawer row they have no reason to look
 * for. Row 273 fixed the direction that mattered most and left the rest; the
 * shell was live, was the landing surface, and was still reported as "I keep
 * seeing the old pages".
 *
 * This is a ratchet, not a ban. Some of these destinations have no MMM
 * equivalent yet and linking out honestly beats pretending the feature is gone.
 * What must not happen is the number quietly growing. **Lower it as panes are
 * built; never raise it** — the same discipline `audit:css --max` uses.
 */

const MMM_SOURCES = [
  ...globSync('src/components/mmm/**/*.tsx'),
  ...globSync('src/app/app/**/*.tsx'),
];

/**
 * Route literals in MMM source that point outside `/app`.
 *
 * **This reads ROUTE-SHAPED STRING LITERALS, not `href=` attributes**, and the
 * difference is the whole reason it works. The first version matched `href=`
 * and therefore could not see `MmmSearch`'s `hrefFor()`, a switch returning
 * template strings — so the most central control in MUSIC was sending every
 * single result into the legacy shell, invisibly, while this audit reported the
 * shell as nearly closed. An audit that cannot see the biggest hole is worse
 * than no audit, because it is trusted.
 *
 * The known first segments are listed explicitly rather than matched as "any
 * leading slash": prose, class names and API paths are full of slashes, and a
 * looser pattern produced more noise than signal.
 */
const LEGACY_FIRST_SEGMENTS = [
  'shows', 'artists', 'venues', 'fans', 'promoters', 'djs', 'tracks', 'playlist',
  'playlists', 'tickets', 'pages', 'discover', 'search', 'settings', 'payouts',
  'advertise', 'listen', 'me', 'radio', 'events', 'this-weekend', 'for-you',
];

/**
 * Comments are stripped first. Every file here documents its own routes in
 * prose, so scanning raw source reports each doc comment as an escape — noise
 * that would get the whole audit ignored.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function legacyHrefs(rawSource: string): string[] {
  const source = stripComments(rawSource);
  const found: string[] = [];
  const pattern = new RegExp(`['\`"](/(?:${LEGACY_FIRST_SEGMENTS.join('|')})(?:/[^'\`"\s]*)?)`, 'g');
  for (const match of source.matchAll(pattern)) {
    const route = match[1].split('?')[0];
    // `/me` inside `/app/me` is not an escape; the pattern anchors on the
    // opening quote so `/app/...` never matches in the first place.
    found.push(route);
  }
  return found;
}

describe('MMM escapes into the legacy shell', () => {
  const escapes = MMM_SOURCES.flatMap((file) =>
    legacyHrefs(readFileSync(file, 'utf8')).map((href) => `${file} -> ${href}`),
  );

  it('finds MMM sources at all, so a moved directory cannot empty this into a pass', () => {
    expect(MMM_SOURCES.length).toBeGreaterThan(5);
  });

  it('has no more outbound links than the last time this was counted', () => {
    // 11. Three are the panes' own labelled hand-offs (artist, venue and show
    // each link once to their full legacy page for the tooling they do not
    // carry). The other eight are surfaces MMM has no equivalent for yet:
    // `/pages` x3, `/advertise/register`, `/radio?station=`, `/discover` x2
    // for city and genre filters, and the ticket transfer page.
    //
    // Lower this as panes are built; never raise it.
    expect(escapes.length, `outbound links:\n${escapes.sort().join('\n')}`).toBeLessThanOrEqual(11);
  });

  /**
   * Where an in-shell pane exists, nothing may navigate around it.
   *
   * Each pane's own single hand-off to its full legacy page is exempt and is
   * still counted by the ratchet above, so it cannot multiply quietly.
   */
  it.each([
    ['artists', 'src/app/app/artists/'],
    ['venues', 'src/app/app/venues/'],
    ['tracks', 'src/app/app/tracks/'],
    ['playlists', 'src/app/app/playlists/'],
  ])('never NAVIGATES to a legacy %s destination', (segment, ownPane) => {
    const offenders = escapes.filter(
      (entry) => new RegExp(` -> /${segment}/`).test(entry) && !entry.startsWith(ownPane),
    );
    expect(offenders, `link at /app/${segment}/... instead`).toEqual([]);
  });

  it('never NAVIGATES to the singular legacy playlist route', () => {
    // `/playlist/[slug]` (singular) is the legacy route; the MMM tab is
    // `/app/playlists/[id]` (plural). Easy to typo back into.
    expect(escapes.filter((entry) => / -> \/playlist\//.test(entry))).toEqual([]);
  });
});
