/**
 * THE PALETTE EVERY SATORI IMAGE PAINTS WITH.
 *
 * `next/og`'s ImageResponse renders on a canvas with no stylesheet, so the
 * nine image routes (five `opengraph-image.tsx`, `/api/og`, the show poster
 * and QR sheet, the milestone card) cannot read `var(--accent)`; one of them
 * tried — the milestone card wrote `var(--role-venue)` into a gradient and
 * Satori painted nothing. They wrote their own hex instead, and every one of
 * them was still DS8: navy `#0b1220`, orange `#ff5029`, teal, purple, with
 * the mark as a white `i` and an orange `HYPE` — the product's colours the
 * other way round, two grounds after the product left them (2026-09-22).
 *
 * So the values live here ONCE, each labelled with the token it copies, and
 * `brand-assets.test.ts` holds every labelled value to `:root` in globals.css
 * — the same contract `public/sw.js`'s offline page is held to, for the same
 * reason: a literal that has to be a literal is kept honest by a test, not by
 * a comment. Change the token, and the test names the value that lags.
 *
 * `bg2`/`ink3` are the grouped-cell ground and the tertiary ink; `line` is the
 * hairline. The two role hues are here because a venue card names itself in
 * the venue colour and a fan card in the fan colour, as the panes do.
 */
export const OG = {
  bg: '#ffffff', /* --bg */
  bg2: '#f2f2f7', /* --bg-2 */
  ink: '#0a0a0a', /* --ink */
  ink2: '#3a3a3c', /* --ink-2 */
  ink3: '#545458', /* --ink-3 */
  accent: '#e0263e', /* --accent */
  inkOnAccent: '#ffffff', /* --ink-on-accent */
  venue: '#0f6b62', /* --role-venue */
  fan: '#5b3d8f', /* --role-fan */
  line: 'rgba(60,60,67,.29)', /* --line */
} as const;

/** The card's shared frame: white ground, the system sans Satori bundles, the 72/80 margins. */
export const OG_FRAME = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: OG.bg,
  color: OG.ink,
  padding: '72px 80px',
  fontFamily: 'sans-serif',
} as const;

/** A tracked, uppercase kicker — the one eyebrow a card gets. */
export const OG_KICKER = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
} as const;
