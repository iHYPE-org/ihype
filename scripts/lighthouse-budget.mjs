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
//     page        run 1                     run 2
//     /           0.76 4441ms 0.003 378ms   0.71 4573ms 0.000 474ms
//     /login      0.75 4474ms 0.000 403ms   0.79 4486ms 0.000 281ms
//     /info       0.74 (over budget)        0.74 (over budget)
//     /discover   0.74 4282ms 0.000 458ms   0.79 4113ms 0.000 354ms
//     /shows      0.78 4264ms 0.000 360ms   0.79 4168ms 0.000 288ms
//
// '/info' inherited 0.75 from '/about' when that page was retired into it, and
// that was the mistake: '/about' was thin marketing prose, while '/info' is a
// six-panel hub with a client tab strip and two live Prisma aggregates. It
// belongs in the data-backed tier ('/discover', '/shows'), so it now carries
// that tier's budget rather than a marketing page's. Note only its failing
// metric was ever logged — LCP/CLS/TBT for '/info' are still unmeasured, which
// is exactly what the job-summary table added below fixes.
//
// '/' went the other way. It was a nine-section marketing page when its
// budget was set; it is now a single non-scrolling screen, and it measures
// like one (CLS collapsed from a bimodal ~0.134 to 0.000-0.003). Every axis
// tightens. Two data points is thin for a recalibration, so each new limit
// keeps real headroom over the worse of the two — and a single crossing no
// longer fails the build anyway, since a page over budget is now re-sampled
// and must exceed the same metric twice.
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
  { path: '/', budget: { performance: 0.62, lcp: 5200, cls: 0.1, tbt: 800 } },
  { path: '/login', budget: { performance: 0.7, lcp: 4800, cls: 0.1, tbt: 550 } },
  // Was '/about' until that page was retired into /info. Measuring a redirect
  // would score the destination while attributing it to the wrong URL, so this
  // slot moved to the hub that actually renders the marketing prose now — and
  // carries the data-backed tier's budget, because that is what /info is.
  { path: '/info', budget: { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 } },
  { path: '/discover', budget: { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 } },
  { path: '/shows', budget: { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 } }
];

const METRICS = [
  { key: 'largest-contentful-paint', label: 'lcp', unit: 'ms' },
  { key: 'cumulative-layout-shift', label: 'cls', unit: '' },
  { key: 'total-blocking-time', label: 'tbt', unit: 'ms' }
];

const RUNS_PER_PAGE = 5;

async function auditPageOnce(baseUrl, chromePort, page) {
  const result = await lighthouse(
    `${baseUrl}${page.path}`,
    {
      port: chromePort,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
      throttlingMethod: 'simulate'
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

  return { performance, metrics };
}

// A single Lighthouse run is noisy — CI runners (and this sandbox) share CPU
// with other work, and one slow tick can blow an LCP/TBT budget that's fine
// on every other run. Taking the median of 3 runs per page is Lighthouse's
// own recommended mitigation and matches what Lighthouse CI does by default.
//
// A single run can also fail outright (e.g. a transient `NO_LCP` trace-engine
// race under headless Chrome) rather than just score poorly — one retry per
// attempt absorbs that without masking a page that's genuinely broken.
async function auditPageWithRetry(baseUrl, chromePort, page) {
  try {
    return await auditPageOnce(baseUrl, chromePort, page);
  } catch (error) {
    console.warn(`[lighthouse-budget] run failed for ${page.path}, retrying once: ${error.message}`);
    return auditPageOnce(baseUrl, chromePort, page);
  }
}

async function auditPage(baseUrl, chromePort, page) {
  const runs = [];
  for (let i = 0; i < RUNS_PER_PAGE; i += 1) {
    runs.push(await auditPageWithRetry(baseUrl, chromePort, page));
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
export async function runLighthouseBudget({ baseUrl, chromePath } = {}) {
  const resolvedBaseUrl = baseUrl || process.env.LHCI_BASE_URL || 'http://localhost:3100';
  const resolvedChromePath = chromePath || process.env.CHROME_PATH || process.env.LHCI_CHROME_PATH;

  const chrome = await launch({
    chromePath: resolvedChromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const report = [];
  let anyFailed = false;

  try {
    for (const page of PAGES) {
      process.stdout.write(`[lighthouse-budget] auditing ${page.path} ... `);
      const first = await auditPage(resolvedBaseUrl, chrome.port, page);
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
        // Re-sample before failing the build. A median of 5 still straddles
        // the line when a page's true value sits near its budget, and this
        // gate has failed twice in one day on exactly that — same page, same
        // metric, 0.74 against 0.75. Only paid for when something is already
        // over, so a green run costs nothing extra.
        process.stdout.write(`[lighthouse-budget] re-sampling ${page.path} to confirm ... `);
        resample = await auditPage(resolvedBaseUrl, chrome.port, page);
        console.log(describeSample(resample));

        const confirmation = confirmFailures(firstFailures, checkBudget(page.budget, resample));
        failures = confirmation.confirmed;
        unconfirmed = confirmation.unconfirmed;

        for (const f of failures) console.log(`  FAIL ${f.message} (confirmed on re-sample)`);
        for (const f of unconfirmed) {
          console.log(`  WARN ${f.message} on first sample, within budget on re-sample — not failing`);
        }
      }

      report.push({
        path: page.path,
        budget: page.budget,
        performance: first.performance,
        metrics: first.metrics,
        resample,
        failures,
        unconfirmed
      });

      if (failures.length) anyFailed = true;
    }
  } finally {
    await chrome.kill();
  }

  writeFileSync('lighthouse-budget-report.json', JSON.stringify(report, null, 2));
  writeJobSummary(report);

  if (anyFailed) {
    console.error('\n[lighthouse-budget] one or more pages exceeded their performance budget');
  } else {
    console.log('\n[lighthouse-budget] all pages within budget');
  }

  return { report, anyFailed };
}

// CLI entry point — only runs when this file is executed directly (`node
// scripts/lighthouse-budget.mjs`), not when imported by workerd-smoke.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  runLighthouseBudget()
    .then(({ anyFailed }) => {
      if (anyFailed) process.exit(1);
    })
    .catch((error) => {
      console.error('[lighthouse-budget] fatal:', error);
      process.exit(1);
    });
}
