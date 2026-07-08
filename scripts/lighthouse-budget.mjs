/**
 * Performance budget gate — runs Lighthouse against a production build of
 * key pages and fails CI if any page regresses past its budget.
 *
 * Rationale for a music/events app: perceived speed on the free public pages
 * (marketing, discovery, sign-in) is a conversion lever, not a nice-to-have —
 * these are exactly the pages a new visitor hits before ever creating an
 * account. Thresholds below are deliberately lenient (not a 100/100 chase):
 * tight enough to catch a real regression (a newly-added blocking script, an
 * unbounded synchronous query, a layout-shifting image), loose enough that
 * ordinary variance in a CI runner doesn't flake the build.
 *
 * Usage: node scripts/lighthouse-budget.mjs
 * Requires: a server already running at LHCI_BASE_URL (default
 * http://localhost:3100), started against a real (if empty) Postgres so
 * data-backed pages don't hang retrying an unreachable DB.
 */
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'node:fs';

const BASE_URL = process.env.LHCI_BASE_URL || 'http://localhost:3100';
const CHROME_PATH = process.env.CHROME_PATH || process.env.LHCI_CHROME_PATH;

// Budgets, keyed by path. Marketing/auth pages (server-rendered, no heavy
// client bundles) get the tightest budget; data-backed pages get a bit more
// room since they carry the media player, nav shell, and live discovery data.
//
// LCP thresholds were calibrated empirically (median of 3 runs, real Postgres,
// production build) rather than guessed: every page measured lands in a
// ~3200-3450ms band in this test harness regardless of actual page weight,
// which points to a fixed floor from the test methodology itself (this run's
// CPU + `next start`'s cold-request handling), not per-page differentiation.
// Budgets below sit with real headroom above that observed floor — tight
// enough to catch a genuine regression (a newly-added blocking script, an
// N+1 query), loose enough not to encode this one environment's specific
// characteristics as gospel. Revisit after this runs a few times in real CI.
const PAGES = [
  // '/' CLS budget is 0.15 (web-vitals' "needs improvement" boundary, one
  // notch under "good"), not 0.1 like the others: measured CLS on this page
  // is genuinely bimodal across repeated runs (0.000 on most, ~0.134 on
  // some) even with a 5-run median, pointing to a timing-dependent shift
  // somewhere in this long marketing page's early render — not something to
  // guess-fix without the design context for what's actually on it. Tracked
  // as a follow-up; 0.15 catches a real regression without flaking on this
  // known, already-observed variance.
  { path: '/', budget: { performance: 0.75, lcp: 4200, cls: 0.15, tbt: 500 } },
  { path: '/login', budget: { performance: 0.8, lcp: 4200, cls: 0.1, tbt: 400 } },
  { path: '/about', budget: { performance: 0.8, lcp: 4200, cls: 0.1, tbt: 400 } },
  { path: '/discover', budget: { performance: 0.65, lcp: 5000, cls: 0.1, tbt: 700 } },
  { path: '/shows', budget: { performance: 0.65, lcp: 5000, cls: 0.1, tbt: 700 } }
];

const METRICS = [
  { key: 'largest-contentful-paint', label: 'lcp', unit: 'ms' },
  { key: 'cumulative-layout-shift', label: 'cls', unit: '' },
  { key: 'total-blocking-time', label: 'tbt', unit: 'ms' }
];

const RUNS_PER_PAGE = 5;

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function auditPageOnce(chromePort, page) {
  const result = await lighthouse(
    `${BASE_URL}${page.path}`,
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
async function auditPageWithRetry(chromePort, page) {
  try {
    return await auditPageOnce(chromePort, page);
  } catch (error) {
    console.warn(`[lighthouse-budget] run failed for ${page.path}, retrying once: ${error.message}`);
    return auditPageOnce(chromePort, page);
  }
}

async function auditPage(chromePort, page) {
  const runs = [];
  for (let i = 0; i < RUNS_PER_PAGE; i += 1) {
    runs.push(await auditPageWithRetry(chromePort, page));
  }

  return {
    path: page.path,
    performance: median(runs.map((r) => r.performance)),
    metrics: {
      lcp: median(runs.map((r) => r.metrics.lcp)),
      cls: median(runs.map((r) => r.metrics.cls)),
      tbt: median(runs.map((r) => r.metrics.tbt))
    }
  };
}

function checkBudget(page, audit) {
  const failures = [];
  if (audit.performance < page.budget.performance) {
    failures.push(
      `performance score ${audit.performance.toFixed(2)} < budget ${page.budget.performance}`
    );
  }
  if (audit.metrics.lcp !== null && audit.metrics.lcp > page.budget.lcp) {
    failures.push(`LCP ${Math.round(audit.metrics.lcp)}ms > budget ${page.budget.lcp}ms`);
  }
  if (audit.metrics.cls !== null && audit.metrics.cls > page.budget.cls) {
    failures.push(`CLS ${audit.metrics.cls.toFixed(3)} > budget ${page.budget.cls}`);
  }
  if (audit.metrics.tbt !== null && audit.metrics.tbt > page.budget.tbt) {
    failures.push(`TBT ${Math.round(audit.metrics.tbt)}ms > budget ${page.budget.tbt}ms`);
  }
  return failures;
}

async function run() {
  const chrome = await launch({
    chromePath: CHROME_PATH,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const report = [];
  let anyFailed = false;

  try {
    for (const page of PAGES) {
      process.stdout.write(`[lighthouse-budget] auditing ${page.path} ... `);
      const audit = await auditPage(chrome.port, page);
      const failures = checkBudget(page, audit);
      report.push({ ...audit, failures });

      if (failures.length) {
        anyFailed = true;
        console.log('FAIL');
        for (const f of failures) console.log(`  - ${f}`);
      } else {
        console.log(
          `PASS (perf ${audit.performance.toFixed(2)}, LCP ${Math.round(audit.metrics.lcp)}ms, ` +
            `CLS ${audit.metrics.cls.toFixed(3)}, TBT ${Math.round(audit.metrics.tbt)}ms)`
        );
      }
    }
  } finally {
    await chrome.kill();
  }

  writeFileSync('lighthouse-budget-report.json', JSON.stringify(report, null, 2));

  if (anyFailed) {
    console.error('\n[lighthouse-budget] one or more pages exceeded their performance budget');
    process.exit(1);
  }
  console.log('\n[lighthouse-budget] all pages within budget');
}

run().catch((error) => {
  console.error('[lighthouse-budget] fatal:', error);
  process.exit(1);
});
