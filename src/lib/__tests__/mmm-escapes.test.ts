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

/** An href literal that points somewhere outside `/app`. */
function legacyHrefs(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/href=[{"'`]+([^"'`}\s,)]+)/g)) {
    const href = match[1];
    if (!href.startsWith('/')) continue;
    if (href.startsWith('/app')) continue;
    // `/login` is not an escape: it is the auth boundary, and it returns the
    // member to the `/app` route they asked for via callbackUrl.
    if (href.startsWith('/login')) continue;
    found.push(href.split('?')[0]);
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
    // 11 as of the artist pane landing, down from 13. Closing `/artists/[slug]`
    // removed two NAVIGATION links (a chart row, a show's headliner) and added
    // one labelled hand-off from the pane itself. Every remaining escape is a
    // surface MMM does not implement yet: pages, tickets, tracks, playlists,
    // search, advertise.
    expect(escapes.length, `outbound links:\n${escapes.sort().join('\n')}`).toBeLessThanOrEqual(11);
  });

  it('never NAVIGATES to an artist profile outside the shell', () => {
    // The most-trafficked door, and the one that now has an in-shell
    // replacement: a chart row and a show's headliner must resolve to
    // `/app/artists/<slug>`.
    //
    // The artist pane's own "full profile" link is exempt and is the one
    // deliberate exception. It is not navigation into legacy by surprise — it
    // is a labelled hand-off to the tracks, insights and owner tooling this
    // pane does not carry, and it is still counted by the ratchet above, so it
    // cannot multiply quietly.
    const artistEscapes = escapes.filter(
      (entry) => / -> \/artists\//.test(entry) && !entry.startsWith('src/app/app/artists/'),
    );
    expect(artistEscapes, 'link at /app/artists/<slug> instead').toEqual([]);
  });
});
