import { describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('@/lib/db', () => ({ db: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }));

import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/hype/chart', () => {

  it('answers 503 READ_UNAVAILABLE when the query fails, not thirty days of zeros', async () => {
    queryRaw.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await GET(new NextRequest('http://ihype.test/api/hype/chart?profileId=p1'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    await expect(res.json()).resolves.toMatchObject({ code: 'READ_UNAVAILABLE' });
  });

  it('answers the thirty-day series when the query succeeds', async () => {
    queryRaw.mockResolvedValue([]);
    const res = await GET(new NextRequest('http://ihype.test/api/hype/chart?profileId=p1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toHaveLength(30);
  });
});
