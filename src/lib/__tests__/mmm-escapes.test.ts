import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
    // 8. Three are the panes' own labelled hand-offs — artist, venue and show
    // each link once to their full legacy page for the tooling they do not
    // carry. The remaining five are surfaces MMM has no equivalent for yet:
    // `/pages` x3, `/advertise/register`, and the ticket transfer page.
    //
    // Was 13 when this audit could first see properly. Radio stations now play
    // in-shell, and Discover reads `?genre=` and `?city=`. Lower it as panes
    // are built; never raise it.
    expect(escapes.length, `outbound links:\n${escapes.sort().join('\n')}`).toBeLessThanOrEqual(8);
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

  /**
   * Genre results must land on a surface that actually applies the filter.
   *
   * The bug being avoided is specific and live in legacy: search sends genre
   * results to `/listen?genre=`, `/listen` is a redirect, and the query is
   * dropped — so those results have always landed on an unfiltered page. The
   * MMM equivalent is only an improvement if the destination reads the value,
   * so this asserts BOTH halves: search points at the tab, and the tab's route
   * still accepts a `genre` search param.
   */
  it('sends genre and city results to a tab that reads the filter', () => {
    // Comments stripped: this file's own comment explains the legacy bug by
    // naming the route, and a raw scan would match that prose.
    const search = stripComments(readFileSync('src/components/mmm/MmmSearch.tsx', 'utf8'));
    expect(search).toContain('/app/music/discover?genre=');
    expect(search).toContain('/app/music/discover?city=');
    expect(search).not.toContain('/listen?genre=');

    const tabRoute = readFileSync('src/app/app/music/[tab]/page.tsx', 'utf8');
    expect(tabRoute).toContain('genre');
    expect(tabRoute).toContain('city');
    expect(tabRoute).toContain('searchParams');

    // And the endpoint must actually accept both, or the tab is decoration.
    const seeds = stripComments(readFileSync('src/app/api/discover/seeds/route.ts', 'utf8'));
    expect(seeds).toContain("searchParams.get('city')");
    expect(seeds).toContain("searchParams.get('genres')");
  });

  /**
   * Stations must play, not navigate.
   *
   * The bug: every station row pushed `/radio?station=<slug>`, and `/radio`
   * accepts no `searchParams` whatsoever — it is the always-on station and
   * calls `getStationState()` with no argument. Eight real stations, one
   * destination, and the choice did nothing. `GET /api/stations/[slug]/tracks`
   * had existed the whole time with nothing calling it.
   *
   * Asserted from both ends so neither half can regress alone.
   */
  it('plays a station in-shell instead of navigating to /radio', () => {
    const music = stripComments(readFileSync('src/components/mmm/MmmMusic.tsx', 'utf8'));
    expect(music).not.toContain('/radio?station=');
    expect(music).toContain('/api/stations/');
    expect(music).toContain('playTrack');
  });

  it('still has no station selection on the legacy radio route', () => {
    // Stronger than the file check this replaces. `/radio` is no longer a page
    // at all — it is a redirect in next.config.mjs — so it cannot read a
    // station even in principle, and there is no file left to grow the
    // ability. If someone reinstates the page, `guard:design`'s assertMissing
    // fails first; if someone points the redirect at a station-aware URL, the
    // destination assertion below fails.
    expect(existsSync('src/app/radio/page.tsx')).toBe(false);
    const config = stripComments(readFileSync('next.config.mjs', 'utf8'));
    expect(config).toContain("source: '/radio', destination: '/app/music/radio'");
    expect(config).not.toContain('/app/music/radio?station=');
  });

  /**
   * A route whose FIRST segment is a variable — `/${kind}/${slug}`.
   *
   * `LEGACY_FIRST_SEGMENTS` cannot see these, and one was live: ME's "Preview"
   * button built its href from `page.kind` ('artists' | 'venues'), so a member
   * previewing their own page left the shell to look at it, and every audit
   * here reported the shell as unchanged. Any route literal that opens with an
   * interpolation is either `/app/...` or a bug.
   */
  it('builds no route from a variable first segment', () => {
    const offenders: string[] = [];
    for (const file of MMM_SOURCES) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(/href=\{`(\/\$\{[^`]*)`\}/g)) {
        offenders.push(`${file} -> ${match[1]}`);
      }
    }
    expect(offenders, 'anchor the route under /app/ instead').toEqual([]);
  });

  /**
   * Every `/app/...` link must resolve to a route that exists.
   *
   * The bug: MAP's "Search all of iHYPE" pointed at `/app/search`, a pane that
   * was started and then deleted once MUSIC turned out to already carry a
   * universal search field. The link survived the deletion and shipped, so the
   * map's only escape hatch led to the in-shell not-found — which renders
   * cleanly, so nothing looked broken from the outside.
   *
   * A route directory is the cheapest possible source of truth for this, and
   * the only one that cannot drift from what Next will actually serve.
   */
  it('links only to /app routes that exist', () => {
    const existing = new Set(
      readdirSync('src/app/app', { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );
    const offenders: string[] = [];
    for (const file of MMM_SOURCES) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(/["'`](\/app\/([a-z-]+))/g)) {
        if (!existing.has(match[2])) offenders.push(`${file} -> ${match[1]}`);
      }
    }
    expect(offenders, 'no such route directory under src/app/app/').toEqual([]);
  });

  it('never NAVIGATES to the singular legacy playlist route', () => {
    // `/playlist/[slug]` (singular) is the legacy route; the MMM tab is
    // `/app/playlists/[id]` (plural). Easy to typo back into.
    expect(escapes.filter((entry) => / -> \/playlist\//.test(entry))).toEqual([]);
  });
});
