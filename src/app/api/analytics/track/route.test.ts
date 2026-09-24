/**
 * The product-event ingest takes one event or a batch of up to ten
 * (2026-09-24, DESIGN_SYNC row 513): Web Vitals flush as one beacon per page
 * instead of one request per metric.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...a: unknown[]) => trackEvent(...a) }));
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: () => '203.0.113.9' }));

function post(body: unknown) {
  return new Request('https://ihype.org/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analytics/track', () => {
  beforeEach(() => trackEvent.mockReset());

  it('records a single event', async () => {
    const { POST } = await import('./route');
    const res = await POST(post({ event: 'web_vital', props: { name: 'LCP', value: 1200, rating: 'good' } }));
    expect(res.status).toBe(200);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('records every event in a batch', async () => {
    const { POST } = await import('./route');
    const events = ['TTFB', 'FCP', 'LCP', 'CLS', 'INP'].map((name) => ({ event: 'web_vital', props: { name, value: 1, rating: 'good' } }));
    const res = await POST(post({ events }));
    expect(res.status).toBe(200);
    expect(trackEvent).toHaveBeenCalledTimes(5);
  });

  it('records nothing from a batch over ten', async () => {
    const { POST } = await import('./route');
    const events = Array.from({ length: 11 }, () => ({ event: 'web_vital', props: { name: 'LCP', value: 1, rating: 'good' } }));
    await POST(post({ events }));
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
