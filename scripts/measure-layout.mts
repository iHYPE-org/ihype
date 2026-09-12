#!/usr/bin/env tsx
/**
 * Records what the app's layout MEASURES, so a deletion can be proved inert.
 *
 * WHY THIS EXISTS. Removing retired designs is mostly deleting CSS, and CSS
 * deletion is the one edit whose effect cannot be read off the diff: the
 * cascade means a rule you never touched can start winning, and a rule that
 * looks obsolete may be the only thing holding a layout together. This repo
 * has been caught by that twice — `.mmm-music-controls > .mmm-search-wrap`
 * never applied because a comment sat inside its own selector (273px of empty
 * cream, invisible in the source), and the canonical `.authcard-*` block sat
 * dead above a later one for months. Both were found by measuring, not reading.
 *
 * WHAT IT IS, AND IS NOT. This is a developer instrument, not a CI gate, and
 * the baseline is deliberately NOT committed. A checked-in geometry fixture
 * would churn on every legitimate design change, and a fixture that churns is
 * one people regenerate without reading — which is exactly the failure mode
 * `audit:css`'s ratchet comment warns about. The workflow is local and
 * short-lived:
 *
 *   npm run measure:layout -- --write=/tmp/before.json
 *   …delete the CSS…
 *   npm run measure:layout -- --compare=/tmp/before.json --strict
 *
 * Anything that moved is a regression with an address. Nothing that moved is
 * proof, not confidence.
 *
 * IT MEASURES BOXES, NOT COPY. Text content is never compared: live rows,
 * dates and counts change between two runs for reasons that have nothing to do
 * with the edit. Both captures must run against the SAME database and the same
 * build, back to back — a route whose content genuinely churns shows up as
 * noise in the report, and `--only=` narrows to the surfaces you are editing.
 *
 * VERIFIED IN BOTH DIRECTIONS, which is the only way an instrument like this
 * is worth anything. A tool that reports nothing is indistinguishable from a
 * broken one until you make it report something.
 *   - Null run (identical code, captured twice): 2,272 boxes over 20
 *     route/width pairs, zero differences. Getting there took four fixes, each
 *     a false positive this script would otherwise have taught people to
 *     ignore — see the comments at the consent script, the box-count floor,
 *     the probe string, and the network-idle wait.
 *   - Positive control (three changes injected into a baseline — a 3px shift,
 *     a repaint, a 2px type change): all three reported, at the right
 *     addresses, exit 1 under --strict.
 *
 * WHY IT DRIVES THE SIGNED-IN APP. `audit:mobile` says in its own header that
 * it measures signed-out pages only. That is where the least retired CSS
 * lives: the shells are what accumulated it (`shell-surfaces.css` aliases 607
 * class names onto nine primitives, `mmm.css` carries the console). So this
 * signs itself in with the same fixture the e2e suite uses.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext } from 'playwright';

// The fixture reads this when it builds the cookie NAME, and the built worker
// always runs with production semantics, so the secure name is the right one.
// Set before the fixture is imported for its own sake; it is read at call time.
process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE ??= 'true';

const { seedSessionCookie, canSeedSession, sessionCookieName } = await import('../e2e/fixtures/session');

const arg = (name: string, dflt?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const BASE = arg('base', 'http://localhost:8787')!;
const WRITE = arg('write');
const COMPARE = arg('compare');
const ONLY = arg('only');
const STRICT = process.argv.includes('--strict');
/* The CENSUS mode. `--compare` answers "did this edit move anything"; this
   answers "how many controls are smaller than a thumb", which is a different
   question and the one CLAUDE.md's visual-audit row records as the instrument
   this repository still lacks: `audit:mobile` measures the SIGNED-OUT pages,
   and the 44px floors this app added (rows 338 and 375) live almost entirely
   inside the shell, where nothing had ever counted them. It reuses this
   harness because everything expensive here — the seeded session, the built
   worker, the consent script, the sign-in guard, the four widths — is what
   such a census needs and what `audit:mobile` cannot do. */
const TAPS = process.argv.includes('--taps');
const MAX = arg('max');
/* Subpixel jitter is not a layout change. Half a pixel is below anything a
   person can see and above the noise a different font-hinting pass produces. */
const TOLERANCE = Number(arg('tolerance', '0.5'));

const EMAIL = 'layout-baseline@example.com';
/* Below this, what was measured is an error page rather than a surface. The
   thinnest real route in the set measures 91. */
const MIN_BOXES = 20;

/* A signed-in route that renders the SIGN-IN CARD is not a measurement of that
   route, and the box floor cannot tell the two apart: the auth card measures
   28 boxes, comfortably above 20. Measured on 2026-09-11, when
   `PLAYWRIGHT_AUTH_COOKIE_SECURE` was set to `1` rather than the `'true'` the
   fixture compares against — so the cookie was written without its
   `__Secure-` prefix, the production build refused it, and every route in this
   list would have captured the same auth card. Two such captures diff to ZERO
   DIFFERENCES over a few hundred boxes, which is a perfect pass that proves
   nothing, and is exactly the shape of failure this script exists to catch in
   the CSS it measures.

   This is the third time that one variable has done this (the nightly was
   missing it entirely; the walk reported 22 failures that were all one
   variable) — so the guard is on the OUTPUT rather than on the environment:
   whatever the cause, a capture wearing the auth card is refused. Both probes
   interpolate this constant rather than restating it, because a guard the
   census silently lost would make the census the thing that reads a perfect
   score off a wall of sign-in cards. */
const SIGNIN_MARKER = 'authcard-page-signin';

/* The widths that decide something in this codebase, not a sweep. 375 is
   MOBILE.md's design width (327px of content after the pane padding); 393 is
   the iPhone 15 class the dock is measured at; 860 is `--mmm-frame-max`, the
   desktop frame; 1280 is a laptop, where the frame is centred and the legacy
   shell is widest. A breakpoint bug hides between two of these, so a change
   that moves nothing at all four has nowhere left to hide. */
const WIDTHS = [375, 393, 860, 1280];

/* The member-facing surfaces that carry the CSS being cleaned up. Signed-in
   routes are the point — `audit:mobile` already covers the public set. The map
   is included and is the noisiest entry by far (async tiles, a geolocation ask
   that is deliberately never answered here), so expect it to report movement
   and use `--only=` to exclude it when that is not what you are editing. */
const ROUTES = [
  '/app/map',
  '/app/music/discover',
  '/app/music/radio',
  '/app/music/charts',
  '/app/music/playlists',
  '/app/music/library',
  '/app/me',
  '/app/me/settings',
  '/app/me/accessibility',
  /* The sponsorship builder: the file with the most inline spacing in the app
     (`audit:spacing` report 3), so it is the surface this list exists to
     protect while that debt is converted. */
  '/app/me/advertising/new',
  '/pages',
  '/tickets',
  '/settings',
  '/payouts',
  '/search',
  /* `/info` is the one public surface kept, because it renders the same signed
     in or out and carries six panels of the legacy shell's styling. `/` and
     `/login` are deliberately NOT here: both resolve to WORKBENCH_PATH under a
     session, so measuring them authenticated measures a redirect — `/` came
     back as "Execution context was destroyed, most likely because of a
     navigation". The public set belongs to `audit:mobile`, which measures it
     signed out. */
  '/info',
];

type Box = {
  /** Structural path. Stable across two renders of the same code, and the only
      identity available: most of these elements carry no id, and a class list
      is not unique when a page renders forty of the same card. */
  path: string;
  tag: string;
  cls: string;
  x: number; y: number; w: number; h: number;
  display: string;
  position: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  background: string;
};

type Capture = Record<string, Box[]>;   // "route@width" -> boxes

/* Runs in the PAGE, and is deliberately a string rather than a function.
   esbuild transpiles this file with `keepNames`, which wraps every function in
   a `__name()` helper that exists in the bundle and not in the browser — so
   handing `page.evaluate` a compiled local function fails with a bare
   "ReferenceError: __name is not defined" for every route, and the harness
   reports the whole app as unmeasurable. Source text is never transpiled. */
const PROBE = `(() => {
  const pathOf = (el) => {
    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 24) {
      const parent = node.parentElement;
      if (!parent) break;
      // nth-of-type over nth-child: a conditionally rendered sibling of a
      // DIFFERENT tag then does not renumber everything after it, which would
      // otherwise report a whole subtree as moved because one node appeared.
      const sameTag = [...parent.children].filter((c) => c.tagName === node.tagName);
      parts.unshift(node.tagName.toLowerCase() + (sameTag.length > 1 ? ':' + (sameTag.indexOf(node) + 1) : ''));
      node = parent;
    }
    return parts.join('>');
  };

  const round = (n) => Math.round(n * 10) / 10;
  const out = [];
  let signin = false;
  for (const el of document.querySelectorAll('body *')) {
    if (/^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;                 // nothing that can move
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    if (String(el.className || '').includes('${SIGNIN_MARKER}')) signin = true;
    out.push({
      path: pathOf(el),
      tag: el.tagName.toLowerCase(),
      cls: ((el.className && el.className.toString && el.className.toString()) || '').slice(0, 80),
      // A tenth of a pixel: fine enough to catch a real 1px shift, coarse
      // enough that a different subpixel rounding pass is not a "change".
      x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height),
      display: cs.display,
      position: cs.position,
      fontSize: round(parseFloat(cs.fontSize)),
      fontWeight: cs.fontWeight,
      color: cs.color,
      background: cs.backgroundColor,
    });
  }
  return { boxCount: out.length, signin, items: out };
})()`;

type Tap = {
  path: string;
  sel: string;
  w: number; h: number;
  text: string;
  /** A link inside a sentence. Counted, never listed as a defect — see below. */
  prose: boolean;
  /** Set when the measured box is a <label>'s rather than the control's own. */
  via: string;
};

/* THE CENSUS PROBE. Same string-not-function rule as PROBE above, same reason.
   MOBILE.md: "44x44 minimum on every control, desktop included". What counts
   as a control is the whole of the judgement here, and getting it wrong in
   either direction makes the number worthless:

   (1) A LINK INSIDE A SENTENCE IS NOT A CONTROL. `audit:mobile` matches every
       `a`, so a paragraph with three inline links reports three defects that
       cannot be fixed without breaking the paragraph — an inline anchor is as
       tall as its line box by definition. A list dominated by unfixable
       entries is one nobody reads, which is the failure mode this codebase
       keeps recording. Identified structurally rather than by class: an
       anchor whose computed display is inline AND whose parent holds text of
       its own is in running copy. They are COUNTED and reported as a separate
       figure, so the exclusion is visible rather than silent.

   (2) A CHECKBOX'S TAP TARGET IS ITS LABEL. A native checkbox paints about
       13px and cannot be made bigger without `appearance: none`; what a
       finger actually hits is the <label>, and clicking the label really does
       toggle the control. So when a checkbox or radio has a label — wrapping
       it, or pointing at its id — the LABEL's box is measured and the entry
       says so. Row 338's remaining four included a checkbox for this reason.

   (3) VISUALLY HIDDEN IS NOT SMALL. The sr-only pattern (1x1, clipped) is a
       control for a screen reader, which has no thumb. An offscreen honeypot
       input is not offered to anyone at all. Both read as tiny boxes and both
       are excluded — the visual audit recorded each as a false positive of
       the probe that found the real defects.

   Everything else that matches the interactive set is measured as itself.

   NO BACKSLASHES IN HERE. This is a TEMPLATE LITERAL, so JavaScript resolves
   every escape before the browser ever sees the source: `/inset\(\s*50%/`
   written naturally arrives as `/inset(s*50%/`, which is a syntax error, and
   `/\s+/` arrives as `/s+/`, which is NOT — it silently splits class names on
   the letter s. The first shape fails loudly and was caught in one run; the
   second would have produced a plausible census forever. PROBE above happens
   to contain no escapes at all, which is why this trap was unmarked. Written
   without regular expressions rather than with doubled backslashes, because a
   doubled backslash is one careless edit away from being halved again. */
const TAP_PROBE = `(() => {
  const round = (n) => Math.round(n * 10) / 10;
  const vw = document.documentElement.clientWidth;
  const FLOOR = 44;
  const out = [];
  let boxCount = 0;
  let controlCount = 0;
  let tightest = null;
  let signin = false;

  /* Regex-free AND escape-free, for the reason in the comment above this
     probe: an escape here is resolved by the template literal, so even a
     newline written as an escape inside a string arrives as a real newline
     and terminates it. The whitespace characters are built from char codes. */
  const WS = [10, 13, 9].map((code) => String.fromCharCode(code)).concat(' ');
  const words = (text) => {
    let out = [String(text || '')];
    for (const ch of WS) out = out.flatMap((part) => part.split(ch));
    return out.filter(Boolean);
  };
  const squeeze = (text) => words(text).join(' ').slice(0, 34);
  const classSuffix = (el) => {
    const raw = el.className && el.className.toString ? el.className.toString() : '';
    const parts = words(raw).slice(0, 2);
    return parts.length ? '.' + parts.join('.') : '';
  };

  const labelFor = (el) => {
    if (el.type !== 'checkbox' && el.type !== 'radio') return null;
    const wrapping = el.closest('label');
    if (wrapping) return wrapping;
    if (el.id) {
      const escaped = (window.CSS && CSS.escape) ? CSS.escape(el.id) : el.id;
      try { return document.querySelector('label[for="' + escaped + '"]'); } catch (e) { return null; }
    }
    return null;
  };

  const hidden = (el, cs, r) => {
    // sr-only: clipped to nothing, or a 1px box with its overflow cut away.
    const clipped = (cs.clipPath || '').replace(' ', '');
    if (clipped.indexOf('inset(50%') === 0 || cs.clip === 'rect(0px, 0px, 0px, 0px)') return true;
    if (r.width <= 1 && r.height <= 1) return true;
    /* A honeypot, or anything PARKED far off-screen — the left: -9999px
       trick. Deliberately not "outside the viewport": the section strip and
       the shelves scroll sideways, so their later items sit beyond the right
       edge and are perfectly reachable, and excluding those would hide real
       defects on exactly the rows that carry the most controls. */
    if (r.right <= -1000 || r.left >= vw + 1000) return true;
    return el.getAttribute('aria-hidden') === 'true';
  };

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    boxCount += 1;
    if (String(el.className || '').includes('${SIGNIN_MARKER}')) signin = true;

    if (!el.matches('a,button,[role="button"],input,select,summary,[role="tab"],[role="switch"]')) continue;
    if (el.matches('input[type="hidden"]')) continue;
    if (hidden(el, cs, r)) continue;
    controlCount += 1;

    let box = r;
    let via = '';
    const label = labelFor(el);
    if (label) {
      const lr = label.getBoundingClientRect();
      if (lr.width && lr.height) { box = lr; via = 'label'; }
    }
    /* The tightest control that CLEARS the floor. Reported, because a census
       that finds nothing must still show it was looking: if the smallest
       control on the whole shell measures 44, the probe is reading real
       geometry right at the boundary, and a zero means zero. */
    const side = Math.min(box.width, box.height);
    if (box.height >= FLOOR && box.width >= FLOOR) {
      if (!tightest || side < tightest.side) {
        tightest = { side: round(side), sel: el.tagName.toLowerCase() + classSuffix(el) };
      }
      continue;
    }

    const prose = el.tagName === 'A'
      && cs.display === 'inline'
      && !!el.parentElement
      && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

    out.push({
      path: '',
      sel: el.tagName.toLowerCase() + classSuffix(el),
      w: round(box.width), h: round(box.height),
      text: squeeze(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.value || ''),
      prose,
      via,
    });
  }
  return { boxCount, controlCount, tightest, signin, items: out };
})()`;

/** Waits for the server to answer, so a retry rides out a restart. */
async function waitForHealth() {
  for (let i = 0; i < 20; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

type ProbeResult<T> = {
  boxCount: number;
  signin: boolean;
  items: T[];
  controlCount?: number;
  tightest?: { side: number; sel: string } | null;
};

/* A POSITIVE CONTROL for the census, and the reason this file exists twice
   over: "a tool that reports nothing is indistinguishable from a broken one
   until you make it report something". A census whose selector stopped
   matching reports ZERO controls under the floor, which reads as a perfect
   score. So the probe counts every control it CONSIDERED, and a run that
   considered almost none is refused rather than celebrated. */
let controlsConsidered = 0;
let tightestClearing: { side: number; sel: string } | null = null;

// Same rationale, verbatim, as audit-mobile.mjs: Chromium does not read
// HTTPS_PROXY from the environment, and `bypass` is required rather than
// belt-and-braces, because Chromium does NOT bypass loopback for a proxy
// handed to it explicitly — without it every localhost navigation is routed to
// the proxy, which answers 405.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const launchBrowser = () => chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1,::1' } } : {}),
});

/* ONE BROWSER PER WIDTH, not one for the run. A census drives 72 route/width
   pairs and takes the best part of an hour beside a workerd instance and a
   Postgres; the first full run lost its Chromium two thirds of the way in
   ("Target page, context or browser has been closed"), and every remaining
   route then failed with the same message before the script died on an
   uncaught exception. A dead browser is not a measurement of anything, and
   the run before it was thrown away. Bounding the browser's life to one width
   costs a few seconds of relaunch and turns "the run is lost" into "one width
   is retried". */
async function capture<T>(cookie: string, probe = PROBE): Promise<Record<string, T[]>> {
  const result: Record<string, T[]> = {};
  const routes = ONLY ? ROUTES.filter((r) => r.includes(ONLY)) : ROUTES;
  if (!routes.length) throw new Error(`--only=${ONLY} matched no route`);

  for (const width of WIDTHS) {
    let browser: Browser;
    try {
      browser = await launchBrowser();
    } catch (error) {
      process.stdout.write(`  @${width} → UNMEASURED (browser would not launch: ${(error as Error).message.split('\n')[0]})\n`);
      continue;
    }
    const ctx: BrowserContext = await browser.newContext({
      viewport: { width, height: 900 },
      // A real, supported user state that zeroes the token-level duration and
      // easing set, so a capture is never taken mid-transition. Cheaper and
      // more honest than injecting `animation: none` the app never ships.
      reducedMotion: 'reduce',
      // Deliberately no geolocation permission: the map's ask goes unanswered
      // and the seeded county camera stays up, which is the state e2e asserts.
      permissions: [],
    });
    await ctx.addCookies([{
      name: sessionCookieName(),
      value: cookie,
      domain: new URL(BASE).hostname,
      path: '/',
      secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
    }]);
    /* Pre-accept cookie consent, for the same reason e2e/mmm-shell.spec.ts
       does: it is not cosmetic. The banner is bottom-pinned and its measured
       height feeds `--mmm-dock-lift`, so a run that renders it and a run that
       does not disagree about the dock's position — and because it appears from
       an effect after hydration, whether it is up when the probe runs is a
       race. The null run of this script (identical code, twice) reported the
       banner and five of its children as "gone" on 12 of 12 pairs, which is
       exactly the false positive that makes a tool like this ignorable. The
       consent surface has its own coverage in the e2e suite; here it is noise. */
    await ctx.addInitScript(() => {
      try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
    });
    const page = await ctx.newPage();

    let browserGone = false;
    for (const route of routes) {
      if (browserGone) break;
      const key = `${route}@${width}`;
      /* Two attempts, because the server can die under us and a lost route is
         not a neutral outcome — it silently shrinks the set being compared. The
         retry waits for /api/health rather than a fixed sleep, so it rides out
         a supervised restart instead of racing it. */
      for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 30_000 });
        /* Webfonts are load-bearing here and this is not belt-and-braces: the
           drum-label fit was measured against a wider fallback face and came
           back 15px where 24px fits, because the geometry was read before
           Bricolage arrived. A capture taken pre-swap compares two different
           typefaces and reports the whole page as moved. */
        await page.evaluate(() => document.fonts.ready);
        /* Wait for the fetches to settle, not a flat delay. The tabs that load
           rows client-side (charts, playlists, discover) were the whole of this
           harness's remaining noise: a fixed 400ms caught a skeleton in one run
           and the loaded state in the next, so 153 "changes" on 7 of 60 pairs
           were one surface measured at two different moments. Guarded, because
           a page that never goes idle — a poll, an open socket — must be
           measured late rather than dropped. */
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(300);
        const measured = await page.evaluate<ProbeResult<T>>(probe);
        /* An error page is a SUCCESSFUL response that measures almost nothing:
           when the worker lost its database mid-run, five routes answered 200
           with a single <pre> and were recorded as five perfectly good
           captures. Comparing against those would have reported the entire app
           as deleted — or, with the baseline taken in that state, would have
           passed any edit at all. Every real surface here measures 90+ boxes. */
        if (measured.boxCount < MIN_BOXES) {
          if (attempt === 1) { await waitForHealth(); continue; }
          process.stdout.write(`  ${key} → UNMEASURED (only ${measured.boxCount} boxes; an error page, not a surface)\n`);
          break;
        }
        if (measured.signin) {
          /* Not retried and not recorded: a session that did not take will not
             take on a second attempt, and carrying on would write a baseline
             of sign-in cards. Fail the whole run, loudly, naming the cause. */
          console.error(`\n  ${key} rendered the SIGN-IN CARD, so the session did not take.`);
          console.error('  Nothing measured here is this route. Check that PLAYWRIGHT_AUTH_COOKIE_SECURE is');
          console.error("  exactly 'true' (the fixture compares the string, so '1' silently drops the");
          console.error('  __Secure- cookie prefix a production build requires), that AUTH_SECRET matches the');
          console.error('  served worker, and that PLAYWRIGHT_BASE_URL names the host the cookie is set on.');
          process.exit(2);
        }
        controlsConsidered += measured.controlCount ?? 0;
        if (measured.tightest && (!tightestClearing || measured.tightest.side < tightestClearing.side)) {
          tightestClearing = measured.tightest;
        }
        result[key] = measured.items;
        process.stdout.write(`  ${key} → ${measured.boxCount} boxes${probe === PROBE ? '' : `, ${measured.items.length} under the floor`}\n`);
        break;
      } catch (error) {
        const message = (error as Error).message.split('\n')[0];
        /* A closed browser or context will not recover on a second attempt,
           and grinding the remaining routes through it prints a wall of
           identical failures that reads as the app being broken. Stop this
           width, keep what it measured, and let the next width get a fresh
           browser. */
        if (message.includes('has been closed')) {
          process.stdout.write(`  ${key} → UNMEASURED (${message}) — abandoning ${width}px\n`);
          browserGone = true;
          break;
        }
        if (attempt === 1) { await waitForHealth(); continue; }
        // A route that cannot be measured must not silently become "nothing
        // moved here". Recorded as absent, and the diff calls it out.
        process.stdout.write(`  ${key} → UNMEASURED (${message})\n`);
      }
      }
    }
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  return result;
}

type Change = { key: string; path: string; cls: string; what: string; before: string; after: string };

function diff(before: Capture, after: Capture) {
  const changes: Change[] = [];
  const missing: string[] = [];
  const added: string[] = [];

  for (const key of Object.keys(before)) {
    if (!(key in after)) { missing.push(key); continue; }
    const prev = new Map(before[key].map((b) => [b.path, b]));
    const next = new Map(after[key].map((b) => [b.path, b]));

    for (const [path, b] of prev) {
      const a = next.get(path);
      if (!a) {
        changes.push({ key, path, cls: b.cls, what: 'gone', before: `${b.tag} ${b.w}x${b.h}`, after: '—' });
        continue;
      }
      for (const prop of ['x', 'y', 'w', 'h'] as const) {
        if (Math.abs(a[prop] - b[prop]) > TOLERANCE) {
          changes.push({ key, path, cls: b.cls, what: prop, before: String(b[prop]), after: String(a[prop]) });
        }
      }
      for (const prop of ['display', 'position', 'fontWeight', 'color', 'background'] as const) {
        if (a[prop] !== b[prop]) {
          changes.push({ key, path, cls: b.cls, what: prop, before: b[prop], after: a[prop] });
        }
      }
      if (Math.abs(a.fontSize - b.fontSize) > 0.1) {
        changes.push({ key, path, cls: b.cls, what: 'fontSize', before: String(b.fontSize), after: String(a.fontSize) });
      }
    }
    for (const path of next.keys()) if (!prev.has(path)) added.push(`${key} ${path}`);
  }
  for (const key of Object.keys(after)) if (!(key in before)) added.push(`${key} (whole route)`);

  return { changes, missing, added };
}

function report(before: Capture, after: Capture) {
  const { changes, missing, added } = diff(before, after);

  if (missing.length) {
    console.log(`\n${missing.length} route/width pair(s) measured before but NOT now — treat as a failure, not a pass:`);
    for (const key of missing) console.log(`  ${key}`);
  }
  if (added.length) {
    console.log(`\n${added.length} element(s) present now and not before (first 15):`);
    for (const entry of added.slice(0, 15)) console.log(`  ${entry}`);
  }

  if (!changes.length) {
    console.log('\nNo element moved, resized, or repainted beyond tolerance. The edit is inert.');
    return missing.length ? 1 : 0;
  }

  // Grouped by route so a noisy surface (live rows, async tiles) is obvious at
  // a glance rather than buried among real regressions.
  const byKey = new Map<string, Change[]>();
  for (const change of changes) {
    if (!byKey.has(change.key)) byKey.set(change.key, []);
    byKey.get(change.key)!.push(change);
  }
  console.log(`\n${changes.length} change(s) across ${byKey.size} route/width pair(s):\n`);
  for (const [key, list] of [...byKey.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${key} — ${list.length}`);
    for (const change of list.slice(0, 6)) {
      console.log(`     ${change.what}: ${change.before} → ${change.after}   ${change.cls ? `.${change.cls.split(/\s+/)[0]}` : change.path.split('>').pop()}`);
    }
    if (list.length > 6) console.log(`     … ${list.length - 6} more`);
  }
  return 1;
}

function census(found: Record<string, Tap[]>) {
  const controls: { key: string; tap: Tap }[] = [];
  let prose = 0;
  for (const [key, taps] of Object.entries(found)) {
    for (const tap of taps) {
      if (tap.prose) { prose += 1; continue; }
      controls.push({ key, tap });
    }
  }

  /* One control counted once per width is one defect, not four. The figure
     people will quote is the number of CONTROLS, so that is the headline; the
     widths it fails at are detail, and a control that is only small at 375 is
     a different fix from one small everywhere. */
  const byControl = new Map<string, { tap: Tap; widths: Set<string>; routes: Set<string> }>();
  for (const { key, tap } of controls) {
    const id = `${tap.sel}|${tap.text}`;
    if (!byControl.has(id)) byControl.set(id, { tap, widths: new Set(), routes: new Set() });
    const entry = byControl.get(id)!;
    const [route, width] = key.split('@');
    entry.widths.add(width);
    entry.routes.add(route);
  }

  console.log(`\n${byControl.size} distinct control(s) under 44x44, ${controls.length} sighting(s) across route/width pairs.`);
  console.log(`${prose} inline link(s) in running copy were counted and excluded — an anchor inside a sentence is as tall as its line box and is not a control.`);

  if (byControl.size) {
    console.log('\nWorst first, by how many surfaces carry it:\n');
    const rows = [...byControl.values()].sort((a, b) => (b.routes.size - a.routes.size) || (a.tap.h - b.tap.h));
    for (const row of rows) {
      const where = [...row.routes].sort();
      console.log(`  ${row.tap.w}x${row.tap.h}${row.tap.via ? ` (its ${row.tap.via})` : ''}  ${row.tap.sel}`);
      if (row.tap.text) console.log(`     "${row.tap.text}"`);
      console.log(`     ${where.length} route(s) at ${[...row.widths].sort((a, b) => Number(a) - Number(b)).join('/')}px: ${where.slice(0, 4).join(' ')}${where.length > 4 ? ` … +${where.length - 4}` : ''}`);
    }
  }

  if (MAX === undefined) return 0;
  const budget = Number(MAX);
  if (byControl.size > budget) {
    console.error(`\nFAIL — ${byControl.size} controls under the floor, budget ${budget}.`);
    console.error('MOBILE.md: 44x44 on every control, desktop included. Grow vertical padding, never font size.');
    return 1;
  }
  console.log(`\nPASS — ${byControl.size} against a budget of ${budget}.`);
  return 0;
}

if (!TAPS && !WRITE && !COMPARE) {
  console.error('Nothing to do: pass --write=<file> to record a baseline, --compare=<file> to check');
  console.error('against one, or --taps to census every control smaller than a thumb.');
  process.exit(2);
}
if (!canSeedSession()) {
  console.error('Cannot seed a session. Set E2E_WORKERD_DATABASE_URL (or DATABASE_URL) and AUTH_SECRET,');
  console.error('then serve the built worker with: node scripts/e2e-workerd.mjs --serve');
  process.exit(2);
}

// An ARTIST profile so the role-gated surfaces render their fullest state:
// a profile-less account hides the page card and the HYPE link card, and an
// element that never rendered cannot be proved unmoved.
const { cookie, profiles } = await seedSessionCookie(EMAIL, {
  profiles: [
    { type: 'ARTIST', name: 'Layout Baseline' },
    { type: 'VENUE', name: 'Layout Baseline Room' },
  ],
});
/* The two public profile panes, at the seeded slugs. They were the two
   surfaces nothing measured — `audit:mobile` covers signed-out pages only and
   this list had no dynamic route — and the venue pane went on carrying a
   retired hero for a fortnight because of it. Pushed rather than listed, since
   the slug is only known once the fixture has run. */
for (const profile of profiles) {
  ROUTES.push(profile.type === 'VENUE' ? `/app/venues/${profile.slug}` : `/app/artists/${profile.slug}`);
}

// Same rationale, verbatim, as audit-mobile.mjs: Chromium does not read
// HTTPS_PROXY from the environment, and `bypass` is required rather than
// belt-and-braces, because Chromium does NOT bypass loopback for a proxy
// handed to it explicitly — without it every localhost navigation is routed to
// the proxy, which answers 405.
console.log(`Measuring ${ONLY ? `routes matching "${ONLY}"` : `${ROUTES.length} routes`} at ${WIDTHS.join('/')}px against ${BASE}\n`);

if (TAPS) {
  const found = await capture<Tap>(cookie, TAP_PROBE);
  if (!Object.keys(found).length) {
    console.error('\nMeasured no route at all. A census of nothing is not a clean bill of health.');
    process.exit(2);
  }
  /* The shell carries hundreds of controls across four widths. A figure this
     low means the matcher stopped matching, not that the app grew quiet. */
  if (controlsConsidered < 100) {
    console.error(`\nOnly ${controlsConsidered} control(s) were considered across every route and width.`);
    console.error('That is the probe failing to match, not a clean app. Refusing to report a score.');
    process.exit(2);
  }
  console.log(`\n${controlsConsidered} control sighting(s) considered.`);
  if (tightestClearing) {
    console.log(`Tightest control that CLEARS the floor: ${tightestClearing.side}px on ${tightestClearing.sel} — the probe is reading geometry at the boundary.`);
  }
  process.exit(census(found));
}

const now = await capture<Box>(cookie);

const total = Object.values(now).reduce((sum, boxes) => sum + boxes.length, 0);
console.log(`\n${total} boxes across ${Object.keys(now).length} route/width pairs.`);

/* A baseline of nothing would "prove" every later deletion inert, which is
   worse than no baseline at all — so refuse to write one. This is not
   hypothetical: the first run of this script measured 0 boxes on all 12 pairs
   (the __name error above) and cheerfully saved the result. */
if (!total) {
  console.error('\nMeasured nothing. Refusing to write a baseline that would pass any edit.');
  console.error('Check that the server is up and authenticated: curl ' + BASE + '/api/health');
  process.exit(2);
}

let exitCode = 0;
if (WRITE) {
  writeFileSync(WRITE, JSON.stringify(now));
  console.log(`Baseline written to ${WRITE}. Delete, then re-run with --compare=${WRITE}.`);
}
if (COMPARE) {
  exitCode = report(JSON.parse(readFileSync(COMPARE, 'utf8')) as Capture, now);
}

process.exit(STRICT ? exitCode : 0);
