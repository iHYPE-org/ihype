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
 * Usage: node scripts/lighthouse-budget.mjs
 * Requires: LHCI_BASE_URL pointing at an already-running workerd server
 * (default http://localhost:3100), backed by a real (if empty) Postgres so
 * data-backed pages don't hang retrying an unreachable DB.
 */
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'node:fs';

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
// budgets sit with real headroom above THAT observed floor. Revisit after
// this runs a few times in real CI — that's the first environment this has
// never actually been measured against.
const PAGES = [
  // '/' CLS budget is 0.15 (web-vitals' "needs improvement" boundary, one
  // notch under "good"), not 0.1 like the others: measured CLS on this page
  // is genuinely bimodal across repeated runs (0.000 on most, ~0.134 on
  // some) even with a 5-run median, pointing to a timing-dependent shift
  // somewhere in this long marketing page's early render — not something to
  // guess-fix without the design context for what's actually on it. Tracked
  // as a follow-up; 0.15 catches a real regression without flaking on this
  // known, already-observed variance.
  { path: '/', budget: { performance: 0.55, lcp: 5200, cls: 0.15, tbt: 1200 } },
  { path: '/login', budget: { performance: 0.7, lcp: 4800, cls: 0.1, tbt: 550 } },
  { path: '/about', budget: { performance: 0.75, lcp: 4500, cls: 0.1, tbt: 450 } },
  { path: '/discover', budget: { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 } },
  { path: '/shows', budget: { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 } }
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
      const audit = await auditPage(resolvedBaseUrl, chrome.port, page);
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
