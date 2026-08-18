/**
 * Performance budget gate — runs Lighthouse against key pages and fails CI
 * if any page regresses past its budget.
 *
 * Rationale for a music/events app: perceived speed on the free public pages
 * (marketing, discovery, sign-in) is a conversion lever, not a nice-to-have —
 * these are exactly the pages a new visitor hits before ever creating an
 * account. Thresholds below are deliberately lenient (not a 100/100 chase):
 * tight enough to catch a real regression (a newly-added blocking script, an
 * unbounded synchronous query, a layout-shifting image), loose enough that
 * ordinary variance in a CI runner doesn't flake the build.
 *
 * MUST run against a server that can actually execute Prisma queries — i.e.
 * workerd (via `wrangler dev`/`cf:preview`), not plain `next start`. The
 * production Prisma config imports from '@prisma/client/edge' (see
 * src/lib/db.ts and src/lib/__tests__/prisma-workerd-config.test.ts for why),
 * and that entrypoint only resolves a working query engine inside workerd —
 * under plain Node it hangs retrying for 25s per attempt and then throws
 * "loaded wasm module was unexpectedly undefined", which will time out every
 * DB-backed page's Lighthouse audit. This is exactly why the CI job runs this
 * against the same wrangler dev instance scripts/workerd-smoke.mjs boots,
 * rather than its own `next start` server.
 *
 * AS OF 2026-08-05 THIS REPORTS, IT DOES NOT GATE. Budgets are still checked
 * and every number still lands in the job summary, but a breach no longer
 * fails the build — see the ENFORCE constant below for the evidence behind
 * that, and set LIGHTHOUSE_BUDGET_ENFORCE=1 to restore gating.
 *
 * Two things keep the gate readable and trustworthy rather than merely strict:
 *
 *  - A page that exceeds its budget is RE-SAMPLED, and only fails the build if
 *    the same metric exceeds twice. A median of 5 runs is still noisy enough to
 *    straddle a budget line, and a gate that fails at random gets re-run
 *    instead of read.
 *  - Every run writes a markdown table of measured-vs-budget to
 *    $GITHUB_STEP_SUMMARY. Before that, the only record of why this failed was
 *    a JSON artifact or 300KB of job log, so "it failed, re-run it" was the
 *    cheapest available response.
 *
 * Usage: node scripts/lighthouse-budget.mjs
 * Requires: LHCI_BASE_URL pointing at an already-running workerd server
 * (default http://localhost:3100), backed by a real (if empty) Postgres so
 * data-backed pages don't hang retrying an unreachable DB.
 */
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { appendFileSync, writeFileSync } from 'node:fs';
import {
  checkBudget,
  confirmFailures,
  formatMetric,
  median,
  renderSummaryMarkdown,
} from './lib/lighthouse-report.mjs';

// Budgets, keyed by path. Marketing/auth pages (server-rendered, no heavy
// client bundles) get the tightest budget; data-backed pages get a bit more
// room since they carry the media player, nav shell, and live discovery data.
//
// Calibrated empirically against the ACTUAL target runtime — workerd via
// `wrangler dev` — not guessed, and not carried over from an earlier
// calibration against plain `next start`. That first pass under Node
// measured a ~3200-3450ms LCP floor across every page; workerd dev is
// consistently slower and noisier (dev-mode isolate/module overhead has no
// equivalent in a Node process), observed here at up to ~4400-4770ms LCP and
// 776-911ms TBT even on the lightest pages, across many repeated runs. These
// budgets sit with real headroom above THAT observed floor.
//
// RECALIBRATED 2026-07-27 against real CI, which the note above asked for and
// which had never happened before. Two consecutive runs on the same branch,
// measured on GitHub-hosted runners (LCP, median of the script's own runs):
//
//     page        run 1     run 2     old budget
//     /           4606ms    5296ms    5200
//     /login      4453ms    4354ms    4800
//     /about      4518ms    4279ms    4500
//     /discover   4455ms    4307ms    4800
//     /shows      4414ms    4243ms    4800
//
// A DIFFERENT page failed each run, each by a hair — /about by 18ms, then /
// by 96ms — while the same code moved four of five pages by -99 to -238ms.
// That is run-to-run noise on shared CI runners, not a regression signal, and
// '/' alone swung 690ms between runs. Budgets that fail ~half the time train
// people to ignore them, so '/' and '/about' now sit above the highest value
// actually observed in CI rather than above a local estimate:
//
//   '/'      5200 -> 5800  (~10% over the 5296ms worst case seen)
//   '/about' 4500 -> 4800  (matches its sibling marketing pages)
//
// RECALIBRATED AGAIN 2026-07-29, for two pages that changed under their
// budgets. Both of the day's failures were the same page missing the same
// metric by the same hundredth — '/info' scoring 0.74 against a 0.75 budget,
// twice — which is a budget set exactly at a page's median, not a flake. Two
// consecutive CI runs (median of 5, GitHub-hosted runner):
//
//     page        run 1                     run 2                     run 3
//     /           0.76 4441ms 0.003 378ms   0.71 4573ms 0.000 474ms   0.84 4139ms 0.000 178ms
//     /login      0.75 4474ms 0.000 403ms   0.79 4486ms 0.000 281ms   0.81 4290ms 0.000 242ms
//     /info       0.74 (over budget)        0.74 (over budget)        0.79 4390ms 0.000 263ms
//     /discover   0.74 4282ms 0.000 458ms   0.79 4113ms 0.000 354ms   0.83 4013ms 0.000 226ms
//     /shows      0.78 4264ms 0.000 360ms   0.79 4168ms 0.000 288ms   0.85 4059ms 0.000 180ms
//
// '/info' inherited 0.75 from '/about' when that page was retired into it, and
// that was the mistake: '/about' was thin marketing prose, while '/info' is a
// six-panel hub with a client tab strip and two live Prisma aggregates. Run 3
// is the first time its LCP/CLS/TBT were ever recorded — before the job-summary
// table below, a failing page logged only the metric that broke — and they land
// squarely between '/discover' and '/shows'. Its score range across the three
// runs (0.74-0.79) is theirs too. It belongs in the data-backed tier, so it now
// carries that tier's budget rather than a marketing page's.
//
// Run 3 landed on a much quieter runner: every page scored 0.79-0.85, above the
// best value either earlier run produced. Calibrate against runs 1-2, not this
// one — the floor is what a budget has to clear, and a fast runner does not
// raise it.
//
// '/' went the other way. It was a nine-section marketing page when its
// budget was set; it is now a single non-scrolling screen, and it measures
// like one (CLS collapsed from a bimodal ~0.134 to 0.000-0.003). Every axis
// tightens. Two data points is thin for a recalibration, so each new limit
// keeps real headroom over the worse of the two — and a single crossing no
// longer fails the build anyway, since a page over budget is now re-sampled
// and must exceed the same metric twice.
//
// 2026-08-05 — '/' LCP relaxed 5200 → 6200. The note above says "two data
// points is thin for a recalibration", and it was: five more samples arrived
// in one morning, from four unrelated commits (a Worker-secret refactor, a
// docs-only change, and two dependency bumps — nothing that touches how '/'
// renders), and they put the old limit UNDER the page's median:
//
//     '/' LCP:  4218   5372   5417   5854   8507      budget was 5200
//
// So it failed about half the time on changes that could not have affected
// it, and each failure cost a full 16-minute pipeline re-run. That is the
// exact '/info' mistake one row up — a budget sitting on a page's median —
// and the re-sample rule cannot help, because re-sampling a distribution
// centred above the line just draws two numbers above the line.
//
// What did NOT move is the performance SCORE: 0.67, 0.70, 0.71, 0.71 against
// a 0.62 budget, across every one of those runs. LCP is a weighted input to
// that score, so the page is still guarded on this axis — by the stable
// measure rather than the one that swings 4.3 seconds between samples of the
// same commit. Only the LCP line moves here; every other axis is untouched.
//
// 6200 clears the 5372-5854 cluster with headroom while staying under the
// 8507 outlier, which now has to repeat to fail a build. If '/' starts
// breaching 6200 twice in a run, that is a real regression — investigate the
// LCP element rather than raising this again.
//
// 2026-08-05, later the same day — the cause of that swing was found, and it
// was not the runner. '/' awaited an 18-query `$transaction` (the transparency
// snapshot) before emitting a single byte, to render four counters that sit
// two sections BELOW the LCP element. So every sample paid a full Postgres
// round-trip in front of first paint, and the 4218-8782ms spread was that
// round-trip's variance, not rendering. It was meant to be absorbed by
// `unstable_cache(..., { revalidate: 60 })`, but that cache never stored
// anything: `open-next.config.ts` leaves OpenNext's `incrementalCache` at its
// "dummy" default, whose get/set both throw.
//
// Two fixes landed: the counters now stream behind their own <Suspense>
// boundary (off the critical path entirely), and the 18 round-trips collapsed
// to one query. The budget below is deliberately NOT re-tightened yet — let
// real CI samples accumulate against the new shape first, then calibrate from
// them. The remaining root cause is the unconfigured incremental cache, which
// also silently no-ops `unstable_cache` at 3 other sites and `revalidate` on
// 8 routes; that needs an operator decision about a KV/R2 binding.
//
// These are workerd DEV-server numbers on a shared runner, so this gate is a
// relative regression detector, not a statement about production user
// experience. If a change pushes a page past these, that is worth
// investigating rather than raising again.
const PAGES = [
  // Was performance 0.55 / LCP 5800 / CLS 0.15 / TBT 1200, all calibrated
  // against the long marketing page this route no longer serves. The CLS
  // allowance in particular was 0.15 — web-vitals' "needs improvement"
  // boundary — to tolerate a timing-dependent shift in that page's early
  // render. The shift left with the page, so this is back on 0.1 like
  // everything else.
  { path: '/', budget: { performance: 0.62, lcp: 6200, cls: 0.1, tbt: 800 } },
  { path: '/login', budget: { performance: 0.7, lcp: 4800, cls: 0.1, tbt: 550 } },
  // Was '/about' until that page was retired into /info. Measuring a redirect
  // would score the destination while attributing it to the wrong URL, so this
  // slot moved to the hub that actually renders the marketing prose now — and
  // carries the data-backed tier's budget, because that is what /info is.
  { path: '/info', budget: { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 } },
  // '/discover', '/shows' and '/listen' used to sit here. All three became
  // redirect aliases into '/app/*' when MMM took over the signed-in app, and
  // the rule one entry up then applied to them: what got measured was the
  // destination, filed under the retired URL.
  //
  // It was worse than mislabelling, because none of them measured a
  // destination either. A `redirect()` under a `loading.tsx` boundary — and
  // `src/app/loading.tsx` is one, for every route in the app — cannot answer
  // with a 307: the shell is already streaming, so Next emits a 200 carrying
  // `<meta http-equiv="refresh" content="1;url=…">`. Lighthouse therefore
  // scored an almost-empty shell, and then the refresh replaced the whole
  // document mid-run. That is what the 2026-08-17 figures on PR #716 are:
  //
  //     '/shows'     perf 0.32   LCP 6510ms   CLS 0.753
  //     '/discover'  perf 0.39   LCP 6472ms   CLS 0.371
  //     '/listen'    perf 0.92   LCP 2901ms   CLS 0.000   <- "PASS"
  //
  // The CLS is the document swap, not a page. The '/listen' PASS is the same
  // artefact wearing the opposite face: a blank shell scores 0.92 and proves
  // nothing, which is how an entry that measured nothing at all stayed green
  // and unnoticed. A budget cannot be calibrated from any of these.
  //
  // So the two real MMM surfaces are measured directly and authenticated,
  // which is also the only way to reach them — both are behind the auth gate.
  // The budgets are deliberately conservative first values with no trustworthy
  // baseline behind them yet, exactly as '/listen' carried when it was added:
  // they catch a catastrophic regression and nothing finer. Calibrate them
  // from real CI samples once a few have accumulated, and do not read an early
  // pass as evidence the surface is fast.
  { path: '/app/map', authenticated: true, budget: { performance: 0.35, lcp: 8000, cls: 0.15, tbt: 2500 } },
  { path: '/app/music/discover', authenticated: true, budget: { performance: 0.35, lcp: 8000, cls: 0.15, tbt: 2500 } }
];

const METRICS = [
  { key: 'largest-contentful-paint', label: 'lcp', unit: 'ms' },
  { key: 'cumulative-layout-shift', label: 'cls', unit: '' },
  { key: 'total-blocking-time', label: 'tbt', unit: 'ms' }
];

const RUNS_PER_PAGE = 5;

/**
 * Whether a breached budget FAILS the build, or is merely reported.
 *
 * Reporting is the default as of 2026-08-05, after this gate spent ten days
 * blocking merges without once catching a regression. Its recorded history is
 * three budget recalibrations (2026-07-27, 2026-07-29, 2026-08-05) and zero
 * true positives: every failure was the instrument, not the code.
 *
 * The mechanism is not mysterious, and it is why "just widen the budget" kept
 * not working:
 *
 *  - `throttlingMethod: 'simulate'` uses Lighthouse's mobileSlow4G preset,
 *    which carries `cpuSlowdownMultiplier: 4`. Lighthouse measures real CPU
 *    task durations on the runner and MULTIPLIES them to model a slow phone.
 *    A shared GitHub runner having a bad moment does not produce a 2x swing in
 *    modelled LCP; it produces an 8x one.
 *  - The median of RUNS_PER_PAGE does not fix that, and neither does the
 *    re-sample. Medians suppress INDEPENDENT noise. Runner contention is
 *    correlated across every run in a job — they share a machine and a minute
 *    — so all of them move together. On 2026-08-05 '/' measured 8802ms
 *    "confirmed on re-sample" in one run and 5000ms in the next, on the same
 *    code.
 *  - It measures `wrangler dev`, a DEV server, on shared hardware. The header
 *    above has always said this is "a relative regression detector, not a
 *    statement about production UX". A relative detector should report; only
 *    an absolute measure earns the right to block.
 *
 * So the numbers are still taken, still logged, and still written to the job
 * summary on every run — that is the part that had value. What is removed is
 * their ability to hold a merge hostage over a 4x-amplified CPU hiccup.
 *
 * One consequence lives in the audit loop below: when this is off, a page
 * over budget is NOT re-sampled. Confirming a breach only matters if the
 * breach can fail something, and the confirmation pass is a second full
 * RUNS_PER_PAGE audit of whichever pages are slowest — which is what pushed
 * the CI step past its 20-minute cap on 2026-08-17.
 *
 * Set LIGHTHOUSE_BUDGET_ENFORCE=1 to restore gating. Worth doing once the
 * measurement is trustworthy — running against a production-mode server, or
 * with `throttlingMethod: 'provided'` so runner noise is not multiplied, or
 * comparing a PR against a baseline measured in the same job. Any of those
 * would make this an absolute measure rather than a relative one.
 */
const ENFORCE = process.env.LIGHTHOUSE_BUDGET_ENFORCE === '1';
const CHROME_FLAGS = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];

function launchAuditChrome(chromePath) {
  return launch({ chromePath, chromeFlags: CHROME_FLAGS });
}

async function auditPageOnce(baseUrl, chromePort, page, authenticatedHeaders) {
  const result = await lighthouse(
    `${baseUrl}${page.path}`,
    {
      port: chromePort,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
      throttlingMethod: 'simulate',
      ...(page.authenticated && authenticatedHeaders ? { extraHeaders: authenticatedHeaders } : {})
    }
  );

  const lhr = result.lhr;
  const performance = lhr.categories.performance.score;
  if (performance === null) {
    // Lighthouse can return a successful result with a null performance
    // score (a partial-computation failure adjacent to the known NO_LCP
    // trace-engine flake) rather than throwing. Treat it as a failed run —
    // the caller's retry logic already handles thrown errors, and a null
    // silently entering the median() array would corrupt the whole result.
    throw new Error('Lighthouse returned a null performance score');
  }
  const metrics = {};
  for (const m of METRICS) {
    metrics[m.label] = lhr.audits[m.key]?.numericValue ?? null;
  }

  return { performance, metrics, lcpElement: readLcpElement(lhr) };
}

/**
 * Which element Lighthouse actually timed as the LCP.
 *
 * The job summary added in July answered "what broke" but not "what is slow",
 * and that gap cost real time: '/' was diagnosed as blocked on its database
 * (true, and worth fixing on its own) but removing that from the critical path
 * did not move LCP at all, because nobody had checked which element LCP was
 * measuring. Two rounds of plausible-sounding inference, no measurement.
 *
 * Lighthouse already computes this. Surfacing it turns the next such failure
 * into a lookup instead of an argument.
 */
function readLcpElement(lhr) {
  const node = lhr.audits['largest-contentful-paint-element']
    ?.details?.items?.[0]?.items?.[0]?.node;
  if (!node) return null;
  // `snippet` is the element's opening tag, `selector` its CSS path. The tag
  // alone is usually enough to recognise it; the selector disambiguates when
  // several elements share a tag.
  return { snippet: node.snippet ?? null, selector: node.selector ?? null };
}

export function formatLcpElement(lcpElement) {
  if (!lcpElement) return 'unknown (no LCP element reported)';
  const snippet = (lcpElement.snippet ?? '').replace(/\s+/g, ' ').trim();
  const selector = (lcpElement.selector ?? '').trim();
  if (snippet && selector) return `${snippet}  [${selector}]`;
  return snippet || selector || 'unknown';
}

// A single Lighthouse run is noisy — CI runners (and this sandbox) share CPU
// with other work, and one slow tick can blow an LCP/TBT budget that's fine
// on every other run. Taking the median of runs per page is Lighthouse's own
// recommended mitigation and matches what Lighthouse CI does by default.
//
// A single run can also fail outright (e.g. a transient `NO_LCP` trace-engine
// race under headless Chrome) rather than just score poorly. This retries
// with a fresh Chrome, which absorbs that without masking a page that is
// genuinely broken.
//
// Two attempts was not enough. A page runs 5 times per sample and there are 6
// pages, so a job makes 30+ attempts at a failure mode this script itself
// documents as transient — and on 2026-08-05 `/discover` drew it twice in a
// row, which under the old code threw and killed a 16-minute pipeline that
// had already passed every other stage.
const RUN_ATTEMPTS = 3;

async function auditPageWithRetry(baseUrl, getChromePort, restartChrome, page, authenticatedHeaders) {
  let lastError = null;
  for (let attempt = 1; attempt <= RUN_ATTEMPTS; attempt += 1) {
    try {
      const port = attempt === 1 ? getChromePort() : await restartChrome();
      return await auditPageOnce(baseUrl, port, page, authenticatedHeaders);
    } catch (error) {
      lastError = error;
      if (attempt < RUN_ATTEMPTS) {
        console.warn(
          `[lighthouse-budget] run failed for ${page.path} (attempt ${attempt}/${RUN_ATTEMPTS}), ` +
            `restarting Chrome before retry: ${error.message}`,
        );
      }
    }
  }
  throw lastError;
}

async function auditPage(baseUrl, getChromePort, restartChrome, page, authenticatedHeaders) {
  const runs = [];
  for (let i = 0; i < RUNS_PER_PAGE; i += 1) {
    runs.push(await auditPageWithRetry(baseUrl, getChromePort, restartChrome, page, authenticatedHeaders));
  }

  return {
    performance: median(runs.map((r) => r.performance)),
    metrics: {
      lcp: median(runs.map((r) => r.metrics.lcp)),
      cls: median(runs.map((r) => r.metrics.cls)),
      tbt: median(runs.map((r) => r.metrics.tbt))
    }
  };
}

function describeSample(sample) {
  // Via formatMetric rather than .toFixed()/Math.round() directly: an audit
  // that computes no LCP yields null, and the old inline formatting threw on
  // it while logging the very run that would have explained why.
  return (
    `perf ${formatMetric('performance', sample.performance)}, ` +
    `LCP ${formatMetric('lcp', sample.metrics.lcp)}, ` +
    `CLS ${formatMetric('cls', sample.metrics.cls)}, ` +
    `TBT ${formatMetric('tbt', sample.metrics.tbt)}`
  );
}

/**
 * Writes the summary table to the GitHub job summary when running in Actions.
 *
 * Deliberately swallows its own failure. This is the reporting path for a
 * gate; it must not be able to fail the build it is describing.
 */
function writeJobSummary(report) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  try {
    appendFileSync(target, renderSummaryMarkdown(report));
  } catch (error) {
    console.warn(`[lighthouse-budget] could not write job summary: ${error.message}`);
  }
}

/**
 * Runs the full budget sweep against an already-running server and returns
 * { report, anyFailed } — does not touch process.exit, so callers (e.g.
 * scripts/workerd-smoke.mjs, which boots the workerd server this needs) can
 * fold the result into their own pass/fail accounting.
 */
export async function runLighthouseBudget({ baseUrl, chromePath, authenticatedHeaders } = {}) {
  const resolvedBaseUrl = baseUrl || process.env.LHCI_BASE_URL || 'http://localhost:3100';
  const resolvedChromePath = chromePath || process.env.CHROME_PATH || process.env.LHCI_CHROME_PATH;
  const report = [];
  let anyFailed = false;
  let chrome = null;
  let infrastructureError = null;

  const restartChrome = async () => {
    if (chrome) {
      try {
        await chrome.kill();
      } catch (error) {
        console.warn(`[lighthouse-budget] could not stop unhealthy Chrome cleanly: ${error.message}`);
      }
    }
    chrome = await launchAuditChrome(resolvedChromePath);
    return chrome.port;
  };

  try {
    await restartChrome();
    for (const page of PAGES) {
      process.stdout.write(`[lighthouse-budget] auditing ${page.path} ... `);
      if (page.authenticated && !authenticatedHeaders) {
        console.log(`[lighthouse-budget] skipping ${page.path}: no authenticated headers supplied`);
        continue;
      }
      const first = await auditPage(resolvedBaseUrl, () => chrome.port, restartChrome, page, authenticatedHeaders);
      const firstFailures = checkBudget(page.budget, first);

      // The measured value is always logged, pass or fail. Previously a
      // failing page printed only the metric that broke, so a page over
      // budget was the one case where its numbers went unrecorded — the
      // opposite of what you need to decide whether the budget or the page is
      // wrong.
      console.log(firstFailures.length ? `OVER BUDGET (${describeSample(first)})` : `PASS (${describeSample(first)})`);

      let resample = null;
      let failures = [];
      let unconfirmed = [];

      if (firstFailures.length) {
        for (const f of firstFailures) console.log(`  - ${f.message}`);
      }

      if (firstFailures.length && !ENFORCE) {
        // The re-sample exists to stop a flake FAILING A BUILD. When nothing
        // is gating, it cannot change a single outcome — the breach is
        // reported either way — so it buys nothing and costs a second full
        // RUNS_PER_PAGE audit of the slowest pages in the set.
        //
        // That is not a small cost. On 2026-08-17 (PR #716) four of six pages
        // were over budget, and the step hit its 20-minute cap five seconds
        // after finishing: '/discover' took 7.5 minutes and '/shows' 8.75,
        // against ~35s for a page that passed. Roughly half of each was the
        // re-sample nobody could act on. The audits still run, the numbers are
        // still logged and annotated; only the confirmation pass is skipped,
        // and it comes straight back when LIGHTHOUSE_BUDGET_ENFORCE=1.
        failures = firstFailures;
        for (const f of failures) console.log(`  OVER ${f.message} (single sample — reporting only, not re-sampled)`);
        if (failures.some((f) => f.metric === 'lcp')) {
          console.log(`  LCP element: ${formatLcpElement(first.lcpElement)}`);
        }
      } else if (firstFailures.length) {
        // Re-sample before failing the build. A median of 5 still straddles
        // the line when a page's true value sits near its budget, and this
        // gate has failed twice in one day on exactly that — same page, same
        // metric, 0.74 against 0.75. Only paid for when something is already
        // over, so a green run costs nothing extra.
        process.stdout.write(`[lighthouse-budget] re-sampling ${page.path} to confirm ... `);
        resample = await auditPage(resolvedBaseUrl, () => chrome.port, restartChrome, page, authenticatedHeaders);
        console.log(describeSample(resample));

        const confirmation = confirmFailures(firstFailures, checkBudget(page.budget, resample));
        failures = confirmation.confirmed;
        unconfirmed = confirmation.unconfirmed;

        for (const f of failures) console.log(`  FAIL ${f.message} (confirmed on re-sample)`);
        // Name the LCP element on any confirmed LCP failure. Without this the
        // log says how slow the page was but not what was slow, which is the
        // question the next person actually has.
        if (failures.some((f) => f.metric === 'lcp')) {
          console.log(`  LCP element (first sample):  ${formatLcpElement(first.lcpElement)}`);
          console.log(`  LCP element (re-sample):     ${formatLcpElement(resample.lcpElement)}`);
        }
        for (const f of unconfirmed) {
          console.log(`  WARN ${f.message} on first sample, within budget on re-sample — not failing`);
        }
      }

      report.push({
        path: page.path,
        budget: page.budget,
        performance: first.performance,
        metrics: first.metrics,
        lcpElement: first.lcpElement,
        resample,
        failures,
        unconfirmed
      });

      if (failures.length) anyFailed = true;
    }
  } catch (error) {
    infrastructureError = error;
    console.error(`[lighthouse-budget] measurement infrastructure failed: ${error.message}`);
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch (error) {
        console.warn(`[lighthouse-budget] could not stop Chrome cleanly: ${error.message}`);
      }
    }
  }

  // Always leave an artifact. Previously the most important failure mode—a
  // null Lighthouse score—threw before this file was written, so CI uploaded
  // no diagnostic report at all.
  writeFileSync('lighthouse-budget-report.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    infrastructureError: infrastructureError
      ? { message: infrastructureError.message, stack: infrastructureError.stack ?? null }
      : null,
    pages: report,
  }, null, 2));
  writeJobSummary(report);

  // A measurement failure is not a product failure. This used to rethrow,
  // which aborted the whole workerd smoke run — so a flaky Chrome trace took
  // down stages that had already passed and said nothing about the app. It is
  // now reported loudly and returned, never fatal on its own.
  if (infrastructureError) {
    console.error(
      `\n[lighthouse-budget] measurement did not complete: ${infrastructureError.message}`,
    );
    annotate('warning', 'Lighthouse budget not measured', infrastructureError.message);
  }

  if (anyFailed) {
    console.error('\n[lighthouse-budget] one or more pages exceeded their performance budget');
    if (!ENFORCE) {
      // Non-blocking must not mean invisible. Without an annotation a breach
      // is a line in a 300KB log nobody opens on a green build.
      const over = report
        .flatMap((entry) => entry.failures.map((f) => `${entry.path}: ${f.message}`))
        .join('; ');
      annotate('warning', 'Lighthouse budget exceeded (reporting only)', over);
      console.log('[lighthouse-budget] reporting only — not failing the build (LIGHTHOUSE_BUDGET_ENFORCE=1 to gate)');
    }
  } else if (!infrastructureError) {
    console.log('\n[lighthouse-budget] all pages within budget');
  }

  return { report, anyFailed, infrastructureError, enforced: ENFORCE };
}

/** Emit a GitHub Actions annotation so a non-blocking finding is still visible in the UI. */
function annotate(level, title, message) {
  if (!process.env.GITHUB_ACTIONS) return;
  const clean = (s) => String(s).replace(/\r?\n/g, ' ').replace(/::/g, ':');
  console.log(`::${level} title=${clean(title)}::${clean(message)}`);
}

// CLI entry point — only runs when this file is executed directly (`node
// scripts/lighthouse-budget.mjs`), not when imported by workerd-smoke.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  runLighthouseBudget()
    .then(({ anyFailed, infrastructureError }) => {
      // Only ENFORCE turns a breach into a non-zero exit. An infrastructure
      // error still exits non-zero when enforcing, because in that mode a
      // budget that could not be measured is a gate that did not run.
      if (!ENFORCE) return;
      if (anyFailed || infrastructureError) process.exit(1);
    })
    .catch((error) => {
      console.error('[lighthouse-budget] fatal:', error);
      process.exit(1);
    });
}
