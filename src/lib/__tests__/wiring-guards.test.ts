import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';

/* Source with comments removed. Every guard in this file matches on CODE, and
   three separate versions of these checks passed while reading an explanatory
   comment that merely mentioned the thing they were meant to prove. A comment
   is not coverage — strip first, then match. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    /* Newlines, not a space: collapsing a block comment to one character
       shifts every line after it, so any guard that reports a line number
       points at the wrong one. That is the same defect `audit:css` carried,
       where it also silently deleted the exemption markers written above the
       lines they excused. */
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * `.tsx` TOO — it collected only `.ts` until 2026-09-04, and every React
 * component in this repository is `.tsx`. A guard added that day scanned
 * `src/components` for a banned call and passed over ZERO files; it was caught
 * only by deliberately introducing the regression and watching the suite stay
 * green, which is the whole reason this repo verifies a guard in both
 * directions. Widening it can only ever find more, never less — the Show-writer
 * guard below now covers a `.tsx` writer as well, which it silently did not.
 */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listFiles(`${dir}/${e.name}`)
      : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
  );
}

/**
 * Every scheduled job is actually scheduled, and every job it names exists.
 *
 * Cloudflare invokes the cron Worker only on the expressions listed in
 * `wrangler.cron.toml`, and `workers/cron.ts` then matches
 * `job.schedule === event.cron` — an EXACT string comparison. A job whose
 * schedule is not in the toml is therefore not "late" or "misconfigured": it
 * has never run, and nothing anywhere says so. The dispatcher logs
 * "No job matched schedule" for the opposite case and nothing at all for this
 * one.
 *
 * That is not hypothetical. `/api/cron/nearby-show-notify` sat at
 * `0 9 * * *` under a comment reading "already covered by daily 9am slot".
 * There was no daily 9am slot — the two nine-o'clock entries are
 * `0 9 * * 1` (Monday) and `0 9 1 * *` (the 1st of the month) — so the job
 * that tells a fan about a show near them never fired once. Three sibling
 * comments in the same block made the same claim and were correct, which is
 * exactly why the wrong one read as safe.
 *
 * A comment cannot be a coverage guarantee. This is.
 */

const dispatcher = readFileSync('workers/cron.ts', 'utf8');
const toml = readFileSync('wrangler.cron.toml', 'utf8');
const cronRoute = readFileSync('src/app/api/cron/route.ts', 'utf8');

type Job = { path: string; schedule: string };

const jobs: Job[] = [...dispatcher.matchAll(/path:\s*'([^']+)'\s*,\s*schedule:\s*'([^']+)'/g)]
  .map((match) => ({ path: match[1], schedule: match[2] }));

/** The `crons = [...]` array with its comments stripped — a `#` note is not a trigger. */
const armed: string[] = (() => {
  const block = /^crons\s*=\s*\[([\s\S]*?)^\]/m.exec(toml);
  if (!block) throw new Error('wrangler.cron.toml has no crons array');
  return [...block[1].replace(/#.*/g, '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
})();

/**
 * The service worker's precache list holds only pages that really are pages.
 *
 * `cache.addAll()` rejects the WHOLE batch on any non-2xx, so one dead entry
 * does not degrade the precache — it means `/offline` is never stored and the
 * offline fallback is missing exactly when it is needed. (`/shows` did this
 * once; CLAUDE.md records it.) A REDIRECT is the quieter version of the same
 * mistake: it installs fine, but the stored response carries
 * `redirected: true`, and `FetchEvent.respondWith()` refuses a redirected
 * response for a navigation — so the cached copy can only ever fail. `/hype`
 * was such an entry, a 307 to the `/` sitting directly above it.
 */
describe('the service worker precache list', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  const corePages: string[] = (() => {
    const block = /const CORE_PAGES = \[([\s\S]*?)\];/.exec(sw);
    if (!block) throw new Error('sw.js has no CORE_PAGES array');
    // Strip both comment styles first — a path named inside prose is not an entry.
    const body = block[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  })();

  const redirectSources = new Set(
    [...readFileSync('next.config.mjs', 'utf8').matchAll(/source:\s*'([^']+)'[\s\S]{0,200}?destination:/g)].map((m) => m[1]),
  );

  it('parses a non-empty list, so a format change fails here rather than passing vacuously', () => {
    expect(corePages.length).toBeGreaterThan(0);
  });

  it('precaches no redirect', () => {
    expect(corePages.filter((page) => redirectSources.has(page))).toEqual([]);
  });

  it('precaches only paths that resolve to a real page', () => {
    const missing = corePages.filter((page) => {
      if (page === '/') return !existsSync('src/app/page.tsx');
      return !existsSync(`src/app${page}/page.tsx`) && !existsSync(`src/app${page}/route.ts`);
    });
    expect(missing, 'cache.addAll rejects the whole batch on one bad entry').toEqual([]);
  });
});

describe('cron wiring', () => {
  it('parses a dispatcher table and a trigger list, so a format change fails here', () => {
    // Both halves silently becoming empty would make every assertion below
    // vacuous — the same failure mode `audit:routes` guards against.
    expect(jobs.length).toBeGreaterThan(20);
    expect(armed.length).toBeGreaterThan(10);
  });

  it('arms every schedule the dispatcher dispatches on', () => {
    const unarmed = [...new Set(jobs.filter((j) => !armed.includes(j.schedule)).map((j) => `${j.path} @ ${j.schedule}`))];
    expect(unarmed, 'these jobs can never fire — add the expression to wrangler.cron.toml').toEqual([]);
  });

  it('dispatches something on every schedule it arms', () => {
    // The reverse leak: an armed expression nothing matches wakes the Worker
    // to log "No job matched schedule" and do nothing.
    const used = new Set(jobs.map((j) => j.schedule));
    expect(armed.filter((a) => !used.has(a))).toEqual([]);
  });

  it('points every job at a route that exists', () => {
    const missing: string[] = [];
    for (const { path } of jobs) {
      const [pathname, query] = path.split('?');
      if (query) {
        // The multiplexed route branches on the job name.
        const name = query.replace('job=', '');
        if (!cronRoute.includes(`'${name}'`)) missing.push(`${path} — /api/cron has no branch for '${name}'`);
      } else if (!existsSync(`src/app${pathname}/route.ts`)) {
        missing.push(`${path} — no route file`);
      }
    }
    expect(missing).toEqual([]);
  });
});

/* ── The two copies of the show page must agree about selling ──────────────
   A show renders twice: `/shows/[slug]` (public, the URL people share) and
   `/app/shows/[slug]` (the same show in the signed-in shell). `show-detail.ts`
   exists because they had drifted before; this is the half a shared module
   cannot cover, because the gate reads runtime env and that module is pure.

   The drift found on 2026-09-03: the public copy checked
   `isPaymentProcessingConfigured()` and rendered an honest "Paid tickets ·
   Coming soon" notice, while the shell copy rendered the whole purchase form
   unconditionally. `POST /api/shows/[showId]/tickets` refuses that state with
   503 TICKET_PAYMENTS_DISABLED, so a member picked a quantity, pressed Buy and
   got an error — on the SIGNED-IN surface, which is the one real members use,
   while only logged-out visitors saw the honest half. */
describe('the show page sells the same way on both copies', () => {
  const pages = [
    'src/app/shows/[slug]/page.tsx',
    'src/app/app/shows/[slug]/page.tsx',
  ];

  it('derives the money from one place in both copies', () => {
    /* The public copy painted its 70/20/10 bar with `price * (pct/100)` and
       `toFixed(2)` — three independent roundings of a float, disagreeing with
       the integer-cent helper (and so with the payout entries) by a cent at
       ordinary prices. Both copies read `splitFaceValueCents` now. */
    const handRolled = pages.filter((f) => !/\bsplitFaceValueCents\b/.test(code(f)));
    expect(
      handRolled,
      'this copy computes the split itself — use splitFaceValueCents, which the payout entries follow',
    ).toEqual([]);
  });

  it('gates the sale on payment readiness in both copies', () => {
    const ungated = pages.filter((f) => !/\bisPaymentProcessingConfigured\b/.test(code(f)));
    expect(
      ungated,
      'this copy offers a purchase form the ticket route answers 503 to — see the public copy for the notice to render instead',
    ).toEqual([]);
  });
});

/* ── One release rule, not fourteen ────────────────────────────────────────
   Whether a track may be shown publicly is `releasedMediaWhere()`: published
   AND its publish moment unset or past. A listing that writes its own version
   serves the states the release pipeline exists to hide — a HELD upload the
   copyright scan flagged, or an unannounced release.

   The free-use crate had `{ isPublished: true }` inline, dropping the
   `publishAt` half, and was the only public listing of the fourteen not
   reading the helper.

   WHAT THIS CHECKS, AND WHAT IT DOES NOT. It pins an explicit list: each of
   these surfaces must read the helper. Two heuristic versions came first and
   both were wrong in ways worth recording — one flagged `data:` writes and
   `select:` projections that merely share the syntax (a guard that cries wolf
   is a guard someone switches off), and the next could not see through the
   real bug's own shape, a filter assigned to a variable and spread into
   `where`, so it passed while the defect was reinstated. A list cannot be
   fooled by either. Its cost is that a NEW public listing is not covered until
   it is added here, which is the honest trade. */
describe('public media listings share one release rule', () => {
  const publicListings = [
    'src/app/api/artist-media/free-use/route.ts',
    'src/app/api/charts/route.ts',
    'src/app/api/discover/seeds/route.ts',
    'src/app/api/media-listens/route.ts',
    'src/app/api/profile/[slug]/route.ts',
    'src/app/api/public-media/[hexId]/route.ts',
    'src/app/api/radio/route.ts',
    'src/app/api/recommend/route.ts',
    'src/app/api/search/route.ts',
    'src/app/api/shows/[showId]/media/[hexId]/route.ts',
    'src/lib/radioStation.ts',
    /* Delegates: its where-clause is `stationWhere()`, which composes
       `releasedMediaWhere` in src/lib/stations.ts. Listing the route rather
       than the builder keeps this list to surfaces that actually serve rows. */
    'src/app/api/stations/[slug]/tracks/route.ts',
  ];

  const readsTheRule = (f: string) => /\b(releasedMediaWhere|stationWhere)\b/.test(code(f));

  it('reads releasedMediaWhere on every public listing', () => {
    const handRolled = publicListings.filter((f) => !readsTheRule(f));
    expect(
      handRolled,
      'use releasedMediaWhere() — an inline isPublished check omits the publishAt half',
    ).toEqual([]);
  });

  it('names only files that really list media', () => {
    // A stale entry would pass forever while guarding nothing.
    const notListings = publicListings.filter((f) => !/artistMediaAsset\.(findMany|findFirst)/.test(code(f)));
    expect(notListings).toEqual([]);
  });
});

/* ── The basemap must be keyed, and nothing will tell you if it is not ─────
   CARTO requires a key, and on RASTER an unkeyed request does not fail: it
   answers 200 with a valid PNG carrying an "API KEY REQUIRED" watermark — no
   error, no 4xx, no log line, the map just looks slightly wrong. Measured
   2026-09-03: 33,863 bytes unkeyed against 35,505 keyed for the same tile.

   The map is VECTOR now, where the key is not yet enforced — style and tiles
   measured byte-identical either way — so this guard is about attribution
   rather than a broken map today: CARTO counts the free tier per key. It stays
   because enforcement clearly arrives, and because the failure it guards
   against is one nothing else would report. The parameter is `key`; `api_key`
   is accepted and ignored, which fails the same silent way. */
describe('the basemap is keyed', () => {
  const mapFile = 'src/components/mmm/MmmMap.tsx';

  it('never builds a cartocdn URL without a key', () => {
    const src = code(mapFile);
    const urls = [...src.matchAll(/https:\/\/[^'"`\s]*basemaps\.cartocdn\.com[^'"`\s]*/g)].map((m) => m[0]);
    expect(urls.length, 'no CARTO URL found — has the basemap moved?').toBeGreaterThan(0);
    const unkeyed = urls.filter((u) => !/[?&]key=/.test(u));
    expect(unkeyed, 'CARTO counts the free tier per key; an unkeyed raster tile is also served watermarked').toEqual([]);
  });

  it('uses `key`, not the `api_key` CARTO silently ignores', () => {
    expect(code(mapFile)).not.toMatch(/basemaps\.cartocdn\.com[^'"`\s]*[?&]api_key=/);
  });
});

/*
 * The native shell's ground must be the app's ground.
 *
 * `capacitor.config.ts`'s `backgroundColor` is the one colour in the product
 * NO STYLESHEET CAN REACH: it paints behind the WebView, so it is what a member
 * sees as the launch flash and behind every overscroll bounce. It is also the
 * only colour outside the fast loop — every other surface follows `--bg` on the
 * next Cloudflare deploy, while this one waits for a native build.
 *
 * So it goes stale silently, and it has done so TWICE. It was still the retired
 * warm near-black #0a0805 after DS8 moved the ground to ink navy; it was then
 * corrected to #0b1220, which the console conversion retired on 2026-08-19/20
 * in favour of warm cream — leaving both phone apps flashing dark navy at
 * launch on a cream app until 2026-09-03.
 *
 * Nothing could catch it: it is valid TypeScript, a real hex, and no page
 * renders it. This test is the only thing standing between that and a third.
 */
describe('the native shell paints the app\'s ground', () => {
  const bgOf = (css: string) => /^\s*--bg:\s*(#[0-9a-fA-F]{3,8})\s*;/m.exec(css)?.[1]?.toLowerCase();

  it('capacitor backgroundColor matches --bg, on both platforms', () => {
    const ground = bgOf(readFileSync('src/app/globals.css', 'utf8'));
    expect(ground, '--bg is not the first declaration in :root any more — this guard is reading the wrong token').toBeTruthy();

    const config = code('capacitor.config.ts');
    const colours = [...config.matchAll(/backgroundColor:\s*'(#[0-9a-fA-F]{3,8})'/g)].map((m) => m[1].toLowerCase());
    expect(colours.length, 'expected an iOS and an Android backgroundColor').toBe(2);
    for (const colour of colours) {
      expect(colour, `the native shell paints ${colour} behind a ${ground} app — a launch flash and an overscroll bounce in a retired ground`).toBe(ground);
    }
  });

  /**
   * The Android adaptive-icon background is the THIRD copy of the ground, and
   * it was still the retired warm near-black `#0A0805` — two conversions
   * behind — on 2026-09-04, while capacitor.config.ts had already been
   * corrected twice. It shows as the plate behind the launcher icon on every
   * Android home screen, so it is the first thing anyone sees of the app.
   *
   * Same structural reason as the other two: outside the fast loop, changed
   * only by a native build, and no page renders it, so nothing here could see
   * it. Guarded rather than merely fixed, for exactly that reason.
   */
  it('the Android launcher background matches --bg', () => {
    const ground = bgOf(readFileSync('src/app/globals.css', 'utf8'));
    const launcher = /<color name="ic_launcher_background">\s*(#[0-9a-fA-F]{3,8})\s*<\/color>/
      .exec(readFileSync('android/app/src/main/res/values/ic_launcher_background.xml', 'utf8'))?.[1]
      ?.toLowerCase();
    expect(launcher, 'ic_launcher_background.xml no longer declares a colour in the shape this guard reads').toBeTruthy();
    expect(launcher, `the launcher icon sits on ${launcher} behind a ${ground} app`).toBe(ground);
  });

  /**
   * Money never leaves through `window.location` on native.
   *
   * Capacitor ejects a top-level navigation off `server.url` into the system
   * browser, and Stripe's `success_url` is a server redirect, which does not
   * open an app — so a fan who tapped Buy landed in Safari and never came
   * back. Measured across seven call sites on 2026-09-04.
   *
   * The fix is `openExternalUrl` (`src/lib/open-external.ts`): an in-app
   * browser tab on native, a plain navigation on the web. This guard is what
   * stops the eighth call site being written the old way — the failure is
   * invisible in a browser, where `window.location` is exactly right, and only
   * appears on a device.
   *
   * `allowNavigation` in `capacitor.config.ts` is the OTHER way to fix it and
   * was shipped for six hours. It must stay absent: on Android those hosts
   * reach the native bridge, and no allowlist can cover a 3-D Secure redirect
   * to an issuing bank.
   */
  it('sends checkout and onboarding through the in-app browser, never window.location', () => {
    const scanned = listFiles('src/components').concat(listFiles('src/app'));
    /* A floor, because the first version of this guard passed over an empty
       set: `listFiles` collected only `.ts` and every component is `.tsx`. An
       assertion that runs over nothing is worse than no assertion, because it
       reads as coverage. */
    expect(scanned.length, 'the component scan collected no files — this guard is measuring nothing').toBeGreaterThan(200);

    const offenders: string[] = [];
    for (const file of scanned) {
      const source = code(file);
      for (const match of source.matchAll(/window\.location\.(?:assign\s*\(|href\s*=)\s*([^;\n]+)/g)) {
        /* Only the money trips. A `window.location` to an internal path is
           normal and is not what ejects a payment. */
        if (!/checkoutUrl|onboardingUrl|stripe/i.test(match[1])) continue;
        offenders.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
      }
    }
    expect(
      offenders,
      `these navigate to Stripe with window.location, which ejects the native app into Safari — use openExternalUrl: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('capacitor.config.ts does not re-add allowNavigation', () => {
    expect(
      /allowNavigation\s*:/.test(code('capacitor.config.ts')),
      'allowNavigation is back — it grants native bridge access on Android and cannot cover a 3DS redirect; route the flow through openExternalUrl instead',
    ).toBe(false);
  });

  /**
   * The dock's tab count is decided by MMM_NAV, and a spec restated it as a
   * literal.
   *
   * `e2e/mmm-shell.spec.ts` asserts the bar is one row with no target under
   * 44px, and counts `.mmm-tab` to prove it measured a real bar rather than an
   * empty selector. That count was `5` — four destinations plus the cold-start
   * radio key — and it SURVIVED the owner removing that key on 2026-09-04,
   * while three sibling assertions in the same file were updated. So CI failed
   * the app for obeying the instruction, and the only thing that caught it was
   * a full browser run on a self-hosted runner: `tsc`, lint and 1091 unit
   * tests were all green.
   *
   * The fix is the number; this guard is what stops the next nav change
   * leaving it stale again. It is deliberately NOT an import of MMM_NAV into
   * the spec — no e2e file imports from `@/` today, and introducing that for
   * one integer is a larger change than the failure needs. A stray play key
   * appearing in the tab row is a different claim and `measure:dock` already
   * makes it.
   */
  it('the e2e tab-count assertion matches MMM_NAV', () => {
    const spec = code('e2e/mmm-shell.spec.ts');
    const asserted = /wrong number of controls at \$\{width\}px`\)\.toBe\((\d+)\)/.exec(spec)?.[1];
    expect(
      asserted,
      'the tab-count assertion is gone or reworded — this guard is now measuring nothing, which is how the stale 5 survived',
    ).toBeTruthy();

    /* Counted from the manifest's own source rather than imported, so this
       stays a text guard like every other check in this file. `tabLabel` is
       the thing counted rather than a brace, because a module's `items` are
       object literals too and only a MODULE carries a tab label — which is
       also the exact property the bar renders. */
    const nav = code('src/lib/mmm-nav.ts');
    const list = /export const MMM_NAV[^=]*=\s*\[([\s\S]*?)\n\];/.exec(nav)?.[1];
    expect(list, 'MMM_NAV is not an array literal any more — re-derive this guard').toBeTruthy();
    const entries = (list as string).match(/\btabLabel\s*:/g)?.length ?? 0;
    expect(entries, 'parsed zero MMM_NAV entries').toBeGreaterThan(0);

    expect(
      Number(asserted),
      `e2e/mmm-shell.spec.ts expects ${asserted} dock tabs and MMM_NAV has ${entries}`,
    ).toBe(entries);
  });

  /* themeColor is the browser/PWA half of the same value and drifts the same way. */
  it('themeColor matches it too', () => {
    const ground = bgOf(readFileSync('src/app/globals.css', 'utf8'));
    const theme = /themeColor:\s*'(#[0-9a-fA-F]{3,8})'/.exec(code('src/app/layout.tsx'))?.[1]?.toLowerCase();
    expect(theme, 'no themeColor found in layout.tsx').toBeTruthy();
    expect(theme).toBe(ground);
  });
});

/**
 * NO ARITHMETIC INSIDE `${{ }}`.
 *
 * The GitHub Actions expression language has logical and comparison operators
 * and nothing else — no `*`, `+`, `-` or `/`. An arithmetic expression is a
 * PARSE ERROR, and a parse error anywhere in a workflow file is a startup
 * failure: the run completes in under a second with **zero jobs**, a red tick
 * and no log to read.
 *
 * `native-build.yml` shipped `${{ github.run_number * 100 + github.run_attempt }}`
 * on 2026-09-04 and took the whole workflow — including the debug builds that
 * run on every push — down with it. Two things made it hard to see: the run
 * looks nothing like a failing build step, and it failed identically on
 * branches whose diff never touched the file, which reads as somebody else's
 * problem. Do the arithmetic in the shell, where arithmetic exists.
 *
 * This is a repository whose current priority is shipping two store binaries,
 * and the workflow that builds them was silently dead. That is why it is a
 * guard and not a comment.
 */
describe('workflow expressions', () => {
  it('no workflow does arithmetic inside an expression', () => {
    const dir = '.github/workflows';
    const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
    expect(files.length, 'no workflow files found — this guard is measuring nothing').toBeGreaterThan(3);

    const offenders: string[] = [];
    for (const name of files) {
      readFileSync(`${dir}/${name}`, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const [, body] of line.matchAll(/\$\{\{([^}]*)\}\}/g)) {
            /* Quoted text first: a default like `|| 'ihype-backups'` and any
               literal containing a hyphen are not operators, and flagging them
               would get this switched off within a day. */
            const bare = body.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
            /* Space-delimited so `||`/`&&` and an identifier's own characters
               cannot match. Arithmetic in a real expression always looks like
               `a * b`, because there is no other way to write it. */
            if (/\s[*+/-]\s/.test(bare)) offenders.push(`${dir}/${name}:${index + 1}`);
          }
        });
    }

    expect(
      offenders,
      `GitHub expressions have no arithmetic — this is a STARTUP FAILURE, zero jobs, no log. Compute it in the shell: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

/**
 * NOBODY GETS A PASSWORD.
 *
 * Owner instruction, 2026-09-04: *"I don't want users to have a password. I
 * want magic key via email or passkey only. It's WAY safer."*
 *
 * This is a guard rather than a comment because the pressure to add one is
 * real and recurring, and it arrives disguised as something narrow. It was
 * built and reverted the same day the instruction was given: a reviewer cannot
 * receive our email or hold our passkey, so "one account, one secret, for the
 * App Store only" reads as obviously safe right up to the moment there is a
 * password field on the platform's only sign-in page. The password-free answer
 * is `src/lib/review-access.ts` — the same magic link, minted rather than
 * emailed.
 *
 * A password reintroduces things the current design does not have at all:
 * something guessable, something reusable, something worth phishing, a login
 * form worth attacking, and a reset flow that becomes the real attack surface.
 * None of that is bought back by narrowing who may use it.
 */
describe('the product has no password', () => {
  it('NextAuth has no credentials provider', () => {
    /* `providers: []` is what makes every sign-in out-of-band. A credentials
       provider here is the one-line version of the whole mistake. */
    for (const file of ['src/lib/auth.config.ts', 'src/lib/auth.ts']) {
      const source = code(file);
      expect(/providers\s*:\s*\[\s*\]/.test(source), `${file} no longer declares an empty providers array`).toBe(true);
      expect(/Credentials\s*\(|CredentialsProvider/.test(source), `${file} added a credentials provider`).toBe(false);
    }
  });

  it('no page collects a password, except the one bootstrap secret', () => {
    /**
     * `AdminSetupClient` is the single exemption and it is a real one: the
     * field holds `ADMIN_SETUP_SECRET`, an operator-held environment value
     * used once to bootstrap the first admin before any passkey exists. It is
     * not a member credential, nothing is stored, and `type="password"` there
     * is masking rather than authentication. Named explicitly so the exemption
     * is a record rather than a silence — and so a SECOND one has to be
     * argued for here rather than slipped in.
     */
    const allowed = new Set(['src/components/AdminSetupClient.tsx']);

    const offenders = listFiles('src')
      .filter((file) => /\.tsx$/.test(file) && !allowed.has(file))
      .filter((file) => /type=\{?['"]password['"]\}?/.test(code(file)));

    expect(
      offenders,
      `these collect a password — iHYPE is passkey and magic-link only; for store review use src/lib/review-access.ts: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  /* The floor that proves the check above scanned anything. Without it, a
     rename of `src/` reports a triumphant zero — the failure mode this file
     has already been bitten by once today, when the money-navigation guard
     collected only `.ts` and every component is `.tsx`. */
  it('scanned a real number of components', () => {
    const scanned = listFiles('src').filter((file) => /\.tsx$/.test(file));
    expect(scanned.length, 'the component collector found almost nothing — it is measuring nothing').toBeGreaterThan(100);
  });
});

/**
 * Every writer that creates a TICKETED show also opens its ticketing.
 *
 * `isTicketingOpen()` reads `Show.ticketingOpensAt`, and a null means NOT on
 * sale. That default is deliberate — the column is venue-controlled — but it
 * makes "ticketed" and "buyable" two separate facts, and a writer that sets the
 * first and forgets the second builds a show whose ticket form never renders
 * and whose purchase route answers 409 `TICKETING_NOT_OPEN`.
 *
 * That is not hypothetical twice over. `POST /api/shows` shipped it until
 * 2026-09-03, so no event created through the product was ever buyable; the fix
 * went to that one route, and on 2026-09-04 production still held **eight
 * ticketed shows and not one ticket that could be bought**, because the preview
 * seeder is the OTHER thing that writes a Show and nobody had looked at it. The
 * dev seed, the launch seed and the e2e fixture all had it too — and the e2e
 * fixture is why no test could see any of this: the suite's own show was closed
 * for sales, so the specs built on it never exercised a purchase.
 *
 * A rule that lives in a column rather than in a schema default has to be known
 * by every writer. This is the only thing that knows how many writers there are.
 */
describe('a ticketed show is a buyable show', () => {
  /* The argument of one `.show.create(` / `.show.upsert(` call, by brace
     matching from its opening paren — a line window would spill into the
     neighbouring show in the seeds, where the calls sit back to back. */
  function callArguments(source: string, open: number): string {
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) return source.slice(open, i);
      }
    }
    return source.slice(open);
  }

  /* One hop through `...dated`. A seeder that shares its dated fields between
     the create and the update clause writes them once as an object and spreads
     it twice, which is the right shape and which a literal-text guard cannot
     see — so follow the spread rather than pushing the call site into
     duplicating three fields to keep this check simple. One hop only: a spread
     of a spread is rare enough to be worth failing loudly over. */
  function withSpreads(source: string, args: string): string {
    let expanded = args;
    for (const spread of args.matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g)) {
      const declaration = new RegExp(`\\b(?:const|let|var)\\s+${spread[1]}\\s*=\\s*\\{`).exec(source);
      if (!declaration) continue;
      const open = declaration.index + declaration[0].length - 1;
      let depth = 0;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) { expanded += source.slice(open, i); break; }
        }
      }
    }
    return expanded;
  }

  const roots = ['src', 'scripts', 'prisma', 'e2e'];
  const files = roots
    .filter((root) => existsSync(root))
    .flatMap((root) => listFiles(root))
    .concat(['scripts/seed-preview-content.mjs'].filter(existsSync))
    .filter((file) => !file.includes('__tests__'));

  it('finds the writers at all', () => {
    /* A rename of the Prisma model or the seeds would otherwise leave this
       guard reporting a serene pass over nothing at all. */
    const found = files.filter((file) => /\.show\.(create|upsert)\(/.test(code(file)));
    expect(found.length, 'no Show writers found — this guard is measuring nothing').toBeGreaterThanOrEqual(4);
  });

  /**
   * The SPLIT, for the same reason and found the same way one day later.
   *
   * Fixing `ticketingOpensAt` exposed the next nullable column behind it:
   * `/shows/[slug]/page.tsx` gates the whole ticket aside on
   * `venuePayoutPercent !== null && artistPayoutPercent !== null`, both `Int?`
   * with no default. A seeded show with sales open and null percents rendered
   * NEITHER a purchase form NOR the "not on sale" sentence — the sidebar was
   * absent and the page said nothing about tickets at all. Measured on
   * production, after the previous fix had been declared a success.
   *
   * That is the argument for checking the SET rather than the one field that
   * bit: a ticketed show is only buyable when every column the page reads is
   * populated, and each fix that stops at one field just moves the silence.
   */
  it('never sets isTicketed: true without the payout split', () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = code(file);
      for (const match of source.matchAll(/\.show\.(?:create|upsert)\s*\(/g)) {
        const args = withSpreads(source, callArguments(source, match.index + match[0].length - 1));
        if (!/isTicketed:\s*true/.test(args)) continue;
        const absent = ['artistPayoutPercent', 'venuePayoutPercent'].filter((f) => !args.includes(f));
        if (!absent.length) continue;
        missing.push(`${file}:${source.slice(0, match.index).split('\n').length} (${absent.join(', ')})`);
      }
    }
    expect(
      missing,
      `these writers create a ticketed show whose ticket box cannot render: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('never sets isTicketed: true without ticketingOpensAt', () => {
    const closed: string[] = [];
    for (const file of files) {
      const source = code(file);
      for (const match of source.matchAll(/\.show\.(?:create|upsert)\s*\(/g)) {
        const args = withSpreads(source, callArguments(source, match.index + match[0].length - 1));
        if (!/isTicketed:\s*true/.test(args)) continue;
        if (/ticketingOpensAt/.test(args)) continue;
        closed.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
      }
    }
    expect(
      closed,
      `these writers create a ticketed show that can never be bought: ${closed.join(', ')}`,
    ).toEqual([]);
  });
});
