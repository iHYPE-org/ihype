/**
 * Pure reporting/decision helpers for the Lighthouse performance budget.
 *
 * Kept separate from scripts/lighthouse-budget.mjs (which imports lighthouse
 * and chrome-launcher at module load) so these can be unit-tested without
 * booting a browser — see src/lib/__tests__/lighthouse-report.test.ts.
 *
 * Nothing here does I/O, and nothing here knows the budgets. The caller owns
 * both.
 */

/** Metric ordering used by the summary table and the per-metric formatters. */
export const METRIC_ORDER = ['performance', 'lcp', 'cls', 'tbt'];

export function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Human formatting for one metric value. `null` means "not measured". */
export function formatMetric(metric, value) {
  if (value === null || value === undefined) return '—';
  if (metric === 'performance') return value.toFixed(2);
  if (metric === 'cls') return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

/**
 * Compares one sample against a budget.
 *
 * Returns structured entries rather than pre-baked strings: the confirmation
 * step below has to intersect two samples BY METRIC, which a string cannot be
 * asked to do.
 */
export function checkBudget(budget, sample) {
  const failures = [];

  const push = (metric, measured, limit, exceeded) => {
    if (measured === null || measured === undefined) return;
    if (!exceeded) return;
    failures.push({
      metric,
      measured,
      budget: limit,
      message:
        metric === 'performance'
          ? `performance score ${formatMetric(metric, measured)} < budget ${limit}`
          : `${metric.toUpperCase()} ${formatMetric(metric, measured)} > budget ${formatMetric(metric, limit)}`,
    });
  };

  push('performance', sample.performance, budget.performance, sample.performance < budget.performance);
  push('lcp', sample.metrics.lcp, budget.lcp, sample.metrics.lcp > budget.lcp);
  push('cls', sample.metrics.cls, budget.cls, sample.metrics.cls > budget.cls);
  push('tbt', sample.metrics.tbt, budget.tbt, sample.metrics.tbt > budget.tbt);

  return failures;
}

/**
 * Decides which of a first sample's budget breaches are real.
 *
 * A metric only counts as failing if it exceeds its budget in BOTH samples.
 * The intersection is by metric name, not by "did anything fail again": a run
 * that trips LCP and then trips TBT has produced two separate noise events,
 * and treating that as confirmation is how this gate got its reputation. The
 * numbers reported are the SECOND sample's, because that is the measurement
 * the decision was actually made on.
 *
 * Anything that exceeded once and not twice comes back as `unconfirmed` —
 * visible in the summary, not fatal. Those are worth watching: a metric that
 * shows up there run after run is a page sitting on its budget line, which is
 * a calibration problem rather than a regression.
 */
export function confirmFailures(firstFailures, secondFailures) {
  const secondByMetric = new Map(secondFailures.map((f) => [f.metric, f]));
  const confirmed = [];
  const unconfirmed = [];

  for (const first of firstFailures) {
    const again = secondByMetric.get(first.metric);
    if (again) confirmed.push(again);
    else unconfirmed.push(first);
  }

  return { confirmed, unconfirmed };
}

function statusIcon(entry, metric) {
  if (entry.failures.some((f) => f.metric === metric)) return '❌';
  if (entry.unconfirmed.some((f) => f.metric === metric)) return '⚠️';
  return '';
}

function cell(entry, metric, measured) {
  const icon = statusIcon(entry, metric);
  const limit = formatMetric(metric, entry.budget[metric]);
  return `${icon}${icon ? ' ' : ''}${formatMetric(metric, measured)} / ${limit}`;
}

/**
 * Renders the whole sweep as GitHub-flavoured markdown for the job summary.
 *
 * This exists because both of this gate's failures on 2026-07-29 were one
 * page missing one budget by one hundredth, and finding that out meant
 * downloading a JSON artifact or grepping 300KB of job log. A gate whose
 * verdict is expensive to read gets re-run rather than understood.
 */
export function renderSummaryMarkdown(report) {
  const failing = report.filter((entry) => entry.failures.length > 0);
  const warned = report.filter((entry) => entry.failures.length === 0 && entry.unconfirmed.length > 0);

  const lines = [
    '## Lighthouse performance budget',
    '',
    failing.length
      ? `**${failing.length} page(s) over budget.** Each cell reads \`measured / budget\`.`
      : '**All pages within budget.** Each cell reads `measured / budget`.',
    '',
    '| Page | Performance | LCP | CLS | TBT |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const entry of report) {
    lines.push(
      `| \`${entry.path}\` | ${cell(entry, 'performance', entry.performance)} | ` +
        `${cell(entry, 'lcp', entry.metrics.lcp)} | ${cell(entry, 'cls', entry.metrics.cls)} | ` +
        `${cell(entry, 'tbt', entry.metrics.tbt)} |`,
    );
  }

  lines.push('');

  if (failing.length) {
    lines.push('### Over budget');
    lines.push('');
    for (const entry of failing) {
      // Only claim two samples when two were actually taken. A page over
      // budget is re-sampled solely to avoid failing a build on a flake, so
      // when nothing is gating there is no second sample to appeal to — and
      // saying otherwise overstates the evidence behind the number.
      const provenance = entry.resample ? 'exceeded in both samples' : 'single sample, not confirmed';
      for (const failure of entry.failures) {
        lines.push(`- \`${entry.path}\` — ${failure.message} *(${provenance})*`);
      }
    }
    lines.push('');
  }

  if (warned.length) {
    lines.push('### Exceeded once, not confirmed');
    lines.push('');
    lines.push(
      'These did not fail the build. A metric that keeps appearing here is a page ' +
        'sitting on its budget line — recalibrate it against the numbers in this table ' +
        'rather than waiting for it to fail at random.',
    );
    lines.push('');
    for (const entry of warned) {
      for (const failure of entry.unconfirmed) {
        lines.push(`- \`${entry.path}\` — ${failure.message} on the first sample, within budget on the second`);
      }
    }
    lines.push('');
  }

  const resampled = report.filter((entry) => entry.resample);
  if (resampled.length) {
    lines.push('### Re-sampled pages');
    lines.push('');
    lines.push('| Page | Sample | Performance | LCP | CLS | TBT |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const entry of resampled) {
      for (const [label, sample] of [
        ['first', { performance: entry.performance, metrics: entry.metrics }],
        ['second', entry.resample],
      ]) {
        lines.push(
          `| \`${entry.path}\` | ${label} | ${formatMetric('performance', sample.performance)} | ` +
            `${formatMetric('lcp', sample.metrics.lcp)} | ${formatMetric('cls', sample.metrics.cls)} | ` +
            `${formatMetric('tbt', sample.metrics.tbt)} |`,
        );
      }
    }
    lines.push('');
  }

  // Which element LCP actually timed, for any page that failed on LCP. The
  // measured-vs-budget table says how slow a page was; this says what was
  // slow. Only rendered on an LCP failure, so a green run stays terse.
  const lcpFailures = report.filter((entry) =>
    (entry.failures ?? []).some((f) => f.metric === 'lcp'),
  );
  if (lcpFailures.length) {
    lines.push('### LCP element');
    lines.push('');
    lines.push('| Page | Element Lighthouse timed as LCP |');
    lines.push('| --- | --- |');
    for (const entry of lcpFailures) {
      const el = entry.lcpElement;
      const text = el
        ? `\`${((el.snippet ?? el.selector ?? '').replace(/\s+/g, ' ').trim() || 'unknown').replace(/\|/g, '\\|')}\``
        : '_not reported_';
      lines.push(`| \`${entry.path}\` | ${text} |`);
    }
    lines.push('');
    lines.push(
      'Fix the element named here, not the budget. If it is an image, check its ' +
        'served bytes at the emulated viewport (390px wide, DPR 2) rather than the ' +
        'source asset size.',
    );
    lines.push('');
  }

  lines.push(
    'Median of 5 Lighthouse runs per page, mobile emulation, against the `wrangler dev` ' +
      '(workerd) server this job boots — not production. These are relative regression ' +
      'numbers on a shared runner; a page that exceeds its budget is re-sampled and only ' +
      'fails the build if the same metric exceeds twice.',
  );

  return `${lines.join('\n')}\n`;
}
