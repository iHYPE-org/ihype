import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_AUDIENCES,
  METRIC_CATALOGUE,
  deltaPercent,
  findMetric,
  formatDelta,
  formatMetricValue,
  isAnalyticsRange,
  metricsForAudience,
  resolveRange,
} from '@/lib/analytics-engine';

const DAY = 24 * 60 * 60 * 1000;

describe('resolveRange', () => {
  it('gives the prior window the same length, ending where the current one starts', () => {
    const now = new Date('2026-08-05T12:00:00Z');
    const r = resolveRange('30d', now);
    expect(r.end).toEqual(now);
    expect(r.priorEnd).toEqual(r.start);
    expect(r.end.getTime() - r.start.getTime()).toBe(r.priorEnd.getTime() - r.priorStart.getTime());
    expect(r.days).toBe(30);
  });

  it('handles each fixed range', () => {
    const now = new Date('2026-08-05T12:00:00Z');
    expect(resolveRange('7d', now).days).toBe(7);
    expect(resolveRange('30d', now).days).toBe(30);
    expect(resolveRange('90d', now).days).toBe(90);
  });

  it('starts ytd at January 1 UTC', () => {
    const now = new Date('2026-08-05T12:00:00Z');
    const r = resolveRange('ytd', now);
    expect(r.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('compares ytd against the same number of days before it, not last year', () => {
    // "Last year to date" would compare two differently-sized partial years and
    // drift a day every leap year. Same-length is the only honest comparison.
    const now = new Date('2026-08-05T12:00:00Z');
    const r = resolveRange('ytd', now);
    expect(r.priorEnd).toEqual(r.start);
    expect(r.start.getTime() - r.priorStart.getTime()).toBe(r.end.getTime() - r.start.getTime());
  });

  it('never produces a zero-length window on Jan 1', () => {
    // A ytd span of 0 would make the prior window collapse onto the start and
    // every comparison meaningless.
    const janFirst = new Date('2026-01-01T00:00:30Z');
    const r = resolveRange('ytd', janFirst);
    expect(r.priorStart.getTime()).toBeLessThan(r.priorEnd.getTime());
    expect(r.end.getTime() - r.start.getTime()).toBeGreaterThan(0);
    expect(r.days).toBeGreaterThanOrEqual(1);
  });

  it('is stable to the millisecond it is given', () => {
    const now = new Date('2026-03-03T03:03:03.003Z');
    expect(resolveRange('7d', now).start.getTime()).toBe(now.getTime() - 7 * DAY);
  });
});

describe('deltaPercent', () => {
  it('computes ordinary growth and decline', () => {
    expect(deltaPercent(150, 100)).toBeCloseTo(50);
    expect(deltaPercent(50, 100)).toBeCloseTo(-50);
    expect(deltaPercent(100, 100)).toBe(0);
  });

  it('refuses to invent a percentage for growth from zero', () => {
    // Not Infinity, not 100 — there is no percentage, and putting one on a
    // dashboard makes a claim that cannot be defended.
    expect(deltaPercent(10, 0)).toBeNull();
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it('propagates unknown rather than treating it as zero', () => {
    expect(deltaPercent(null, 100)).toBeNull();
    expect(deltaPercent(100, null)).toBeNull();
    expect(deltaPercent(null, null)).toBeNull();
  });
});

describe('audience selection', () => {
  it('gives every audience at least one metric', () => {
    for (const audience of ANALYTICS_AUDIENCES) {
      expect(metricsForAudience(audience).length).toBeGreaterThan(0);
    }
  });

  it('does not show a fan metrics that are meaningless to them', () => {
    const ids = metricsForAudience('fan').map((m) => m.id);
    expect(ids).toContain('hypes_given');
    expect(ids).not.toContain('hypes_received');
    expect(ids).not.toContain('tickets_sold');
  });

  it('gives an artist the receiving side', () => {
    const ids = metricsForAudience('artist').map((m) => m.id);
    expect(ids).toContain('hypes_received');
    expect(ids).toContain('uploads');
    expect(ids).not.toContain('hypes_given');
  });

  it('scopes the advertiser to their own campaigns', () => {
    const ids = metricsForAudience('advertiser').map((m) => m.id);
    expect(ids).toEqual(['ad_impressions', 'ad_spend']);
  });

  it('preserves catalogue order so a surface never reorders on its own', () => {
    const platform = metricsForAudience('platform').map((m) => m.id);
    const catalogueOrder = METRIC_CATALOGUE.filter((m) => m.audiences.includes('platform')).map((m) => m.id);
    expect(platform).toEqual(catalogueOrder);
  });

  it('has no duplicate metric ids', () => {
    const ids = METRIC_CATALOGUE.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every metric a label, help text and at least one audience', () => {
    for (const m of METRIC_CATALOGUE) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.help.length).toBeGreaterThan(0);
      expect(m.audiences.length).toBeGreaterThan(0);
    }
  });

  it('finds a metric by id, and returns null rather than throwing', () => {
    expect(findMetric('hypes_given')?.label).toBe('Hypes sent');
    expect(findMetric('nope')).toBeNull();
  });
});

describe('formatting', () => {
  it('renders unknown as an em dash, never as zero', () => {
    expect(formatMetricValue(null, 'count')).toBe('—');
    expect(formatMetricValue(null, 'cents')).toBe('—');
    expect(formatDelta(null)).toBe('—');
  });

  it('distinguishes a real zero from unknown', () => {
    expect(formatMetricValue(0, 'count')).toBe('0');
  });

  it('renders cents as currency', () => {
    expect(formatMetricValue(123456, 'cents')).toBe('$1,234.56');
    expect(formatMetricValue(0, 'cents')).toBe('$0.00');
  });

  it('signs a positive delta', () => {
    expect(formatDelta(12.4)).toBe('+12%');
    expect(formatDelta(-8.9)).toBe('-9%');
  });
});

describe('isAnalyticsRange', () => {
  it('accepts the supported ranges and rejects anything else', () => {
    expect(isAnalyticsRange('30d')).toBe(true);
    expect(isAnalyticsRange('ytd')).toBe(true);
    // 'all' became a real range when lifetime totals moved onto the catalogue.
    // It used to be asserted false here, which is why that line is now a true:
    // the product rule is that a member sees a lifetime total while 30-day
    // rolling is the scale the platform reasons on, and honouring the first
    // half without this meant keeping a second private implementation of every
    // lifetime metric.
    expect(isAnalyticsRange('all')).toBe(true);
    expect(isAnalyticsRange(30)).toBe(false);
    expect(isAnalyticsRange(undefined)).toBe(false);
  });

  it('marks only the all-time range as lifetime, and gives it no prior window', () => {
    const now = new Date('2026-08-07T12:00:00.000Z');

    const lifetime = resolveRange('all', now);
    expect(lifetime.lifetime).toBe(true);
    expect(lifetime.start.getTime()).toBe(0);
    expect(lifetime.end).toEqual(now);

    // Every windowed range keeps a real prior period to compare against.
    for (const range of ['7d', '30d', '90d', 'ytd'] as const) {
      const resolved = resolveRange(range, now);
      expect(resolved.lifetime).toBe(false);
      expect(resolved.priorEnd).toEqual(resolved.start);
      expect(resolved.priorStart.getTime()).toBeLessThan(resolved.start.getTime());
    }
  });

  it('renders a lifetime tile with no delta rather than a permanent +100%', () => {
    // A lifetime total has nothing to compare against, so resolvers report
    // previous: null. Comparing against an empty prior window instead would
    // return 0 and read as "+100% this period" forever.
    expect(deltaPercent(42, null)).toBeNull();
    expect(formatDelta(deltaPercent(42, null))).toBe('—');
  });
});
