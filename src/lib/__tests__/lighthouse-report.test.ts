import { describe, expect, it } from 'vitest';
// The build scripts are plain .mjs and ship no type declarations — deliberate,
// they run under node directly and are not part of the app bundle.
// @ts-expect-error -- untyped .mjs module
import { checkBudget, confirmFailures, formatMetric, median, renderSummaryMarkdown } from '../../../scripts/lib/lighthouse-report.mjs';

/**
 * The decision logic for the CI performance gate.
 *
 * Worth testing precisely because the gate's failures have twice been about
 * this logic rather than about a real regression: a budget sitting on a page's
 * median, and a verdict that was expensive to read.
 */

const BUDGET = { performance: 0.65, lcp: 4800, cls: 0.1, tbt: 550 };

function sample(performance: number, lcp: number, cls: number, tbt: number) {
  return { performance, metrics: { lcp, cls, tbt } };
}

describe('median', () => {
  it('takes the middle value of an odd-length sample', () => {
    expect(median([0.7, 0.74, 0.71, 0.79, 0.75])).toBe(0.74);
  });

  it('does not mutate the caller’s array', () => {
    const runs = [3, 1, 2];
    median(runs);
    expect(runs).toEqual([3, 1, 2]);
  });
});

describe('formatMetric', () => {
  it('formats each metric in its own unit', () => {
    expect(formatMetric('performance', 0.7412)).toBe('0.74');
    expect(formatMetric('cls', 0.0034)).toBe('0.003');
    expect(formatMetric('lcp', 4441.6)).toBe('4442ms');
    expect(formatMetric('tbt', 378)).toBe('378ms');
  });

  it('renders an unmeasured metric rather than throwing', () => {
    // A Lighthouse run can compute no LCP at all. The old inline formatting
    // threw on that while logging the very run that would have explained it.
    expect(formatMetric('lcp', null)).toBe('—');
    expect(formatMetric('cls', undefined)).toBe('—');
  });
});

describe('checkBudget', () => {
  it('returns nothing when every metric is inside its budget', () => {
    expect(checkBudget(BUDGET, sample(0.79, 4113, 0, 354))).toEqual([]);
  });

  it('reports the metric, the measurement and the limit', () => {
    const failures = checkBudget(BUDGET, sample(0.61, 4113, 0, 354));
    expect(failures).toHaveLength(1);
    expect(failures[0].metric).toBe('performance');
    expect(failures[0].measured).toBe(0.61);
    expect(failures[0].budget).toBe(0.65);
    expect(failures[0].message).toBe('performance score 0.61 < budget 0.65');
  });

  it('treats a budget hit exactly on the line as passing', () => {
    // The real failure this gate produced twice was 0.74 against a 0.75
    // budget, i.e. strictly under. Equality must not fail, or every budget
    // becomes effectively one unit tighter than it reads.
    expect(checkBudget(BUDGET, sample(0.65, 4800, 0.1, 550))).toEqual([]);
  });

  it('reports every breached metric, not just the first', () => {
    const failures = checkBudget(BUDGET, sample(0.4, 6000, 0.3, 900));
    expect(failures.map((f: { metric: string }) => f.metric)).toEqual([
      'performance',
      'lcp',
      'cls',
      'tbt',
    ]);
  });

  it('ignores a metric Lighthouse could not measure', () => {
    const failures = checkBudget(BUDGET, { performance: 0.79, metrics: { lcp: null, cls: 0, tbt: 354 } });
    expect(failures).toEqual([]);
  });
});

describe('confirmFailures', () => {
  const first = checkBudget(BUDGET, sample(0.6, 4113, 0, 354));

  it('confirms a metric that exceeds in both samples, reporting the second sample’s number', () => {
    const second = checkBudget(BUDGET, sample(0.55, 4113, 0, 354));
    const { confirmed, unconfirmed } = confirmFailures(first, second);
    expect(unconfirmed).toEqual([]);
    expect(confirmed).toHaveLength(1);
    // The verdict was made on the re-sample, so that is the number to report.
    expect(confirmed[0].measured).toBe(0.55);
  });

  it('does not confirm a metric that came back inside budget on the re-sample', () => {
    const { confirmed, unconfirmed } = confirmFailures(first, []);
    expect(confirmed).toEqual([]);
    expect(unconfirmed.map((f: { metric: string }) => f.metric)).toEqual(['performance']);
  });

  it('does not let a different metric count as confirmation', () => {
    // Two samples each tripping a different metric are two noise events, not
    // a confirmed regression. Intersecting by metric name is the whole point.
    const second = checkBudget(BUDGET, sample(0.79, 6000, 0, 354));
    const { confirmed, unconfirmed } = confirmFailures(first, second);
    expect(confirmed).toEqual([]);
    expect(unconfirmed.map((f: { metric: string }) => f.metric)).toEqual(['performance']);
  });
});

describe('renderSummaryMarkdown', () => {
  const passing = {
    path: '/shows',
    budget: BUDGET,
    performance: 0.78,
    metrics: { lcp: 4264, cls: 0, tbt: 360 },
    resample: null,
    failures: [],
    unconfirmed: [],
  };

  it('renders measured-against-budget for every page', () => {
    const md = renderSummaryMarkdown([passing]);
    expect(md).toContain('**All pages within budget.**');
    expect(md).toContain('| `/shows` | 0.78 / 0.65 | 4264ms / 4800ms | 0.000 / 0.100 | 360ms / 550ms |');
    expect(md).not.toContain('Over budget');
  });

  it('lists a confirmed failure and marks its cell', () => {
    const failed = {
      ...passing,
      path: '/info',
      performance: 0.74,
      resample: { performance: 0.73, metrics: { lcp: 4264, cls: 0, tbt: 360 } },
      failures: checkBudget({ ...BUDGET, performance: 0.75 }, sample(0.73, 4264, 0, 360)),
    };
    const md = renderSummaryMarkdown([failed]);
    expect(md).toContain('**1 page(s) over budget.**');
    expect(md).toContain('### Over budget');
    expect(md).toContain('`/info` — performance score 0.73 < budget 0.75 *(exceeded in both samples)*');
    expect(md).toContain('| `/info` | ❌ 0.74 / 0.65 |');
    // Both samples are shown, so a reader can tell a straddling budget from a
    // real regression without downloading anything.
    expect(md).toContain('### Re-sampled pages');
    expect(md).toContain('| `/info` | first | 0.74 |');
    expect(md).toContain('| `/info` | second | 0.73 |');
  });

  it('does not claim two samples for a breach that was only measured once', () => {
    // The shape produced in reporting-only mode, where a page over budget is
    // no longer re-sampled: confirming a breach costs a second full audit of
    // the slowest pages in the set and cannot change an outcome when nothing
    // is gating. That is what took the CI step past its 20-minute cap on
    // 2026-08-17. The finding still has to be reported — but as what it is.
    const single = {
      ...passing,
      path: '/shows',
      metrics: { lcp: 6510, cls: 0.753, tbt: 572 },
      performance: 0.32,
      resample: null,
      failures: checkBudget(BUDGET, sample(0.32, 6510, 0.753, 572)),
    };
    const md = renderSummaryMarkdown([single]);
    expect(md).toContain('### Over budget');
    expect(md).toContain('`/shows` — CLS 0.753 > budget 0.100 *(single sample, not confirmed)*');
    expect(md).not.toContain('exceeded in both samples');
    // Nothing to put in a two-sample comparison table, so it stays out.
    expect(md).not.toContain('### Re-sampled pages');
  });

  it('surfaces an unconfirmed breach as a warning without claiming a failure', () => {
    const warned = {
      ...passing,
      path: '/',
      performance: 0.6,
      resample: { performance: 0.7, metrics: { lcp: 4264, cls: 0, tbt: 360 } },
      unconfirmed: checkBudget(BUDGET, sample(0.6, 4264, 0, 360)),
    };
    const md = renderSummaryMarkdown([warned]);
    expect(md).toContain('**All pages within budget.**');
    expect(md).toContain('### Exceeded once, not confirmed');
    expect(md).toContain('sitting on its budget line');
    expect(md).toContain('| `/` | ⚠️ 0.60 / 0.65 |');
  });
});
