import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client/edge';

const WEBHOOK_KEY = Buffer.from('ihype-resend-webhook-route-key-32b');
const WEBHOOK_SECRET = `whsec_${WEBHOOK_KEY.toString('base64')}`;

vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

let processedEvents: Set<string>;
const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
let forceInsertRace = false;

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
      processedWebhookEvent: {
        findUnique: vi.fn(async ({ where }: { where: { source_eventId: { source: string; eventId: string } } }) => {
          const key = `${where.source_eventId.source}:${where.source_eventId.eventId}`;
          return processedEvents.has(key) ? { id: key } : null;
        }),
        create: vi.fn(async ({ data }: { data: { source: string; eventId: string } }) => {
          const key = `${data.source}:${data.eventId}`;
          if (forceInsertRace || processedEvents.has(key)) {
            throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
          processedEvents.add(key);
          return { id: key };
        }),
      },
      user: { updateMany: (...args: unknown[]) => userUpdateMany(...args) },
    })),
  },
}));

import { POST } from './route';

function signedRequest(body: string, id = 'msg_resend_1', timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = createHmac('sha256', WEBHOOK_KEY)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return new Request('https://ihype.org/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
    body,
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RESEND_WEBHOOK_SECRET', WEBHOOK_SECRET);
  processedEvents = new Set();
  forceInsertRace = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/webhooks/resend', () => {
  it('rejects requests when the webhook secret is absent', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    const response = await POST(signedRequest('{}'));
    expect(response.status).toBe(500);
  });

  it('rejects missing, stale, and invalid signatures', async () => {
    const missing = new Request('https://ihype.org/api/webhooks/resend', {
      method: 'POST',
      body: '{}',
    }) as unknown as import('next/server').NextRequest;
    expect((await POST(missing)).status).toBe(401);

    const stale = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000));
    expect((await POST(signedRequest('{}', 'msg_stale', stale))).status).toBe(401);

    const tampered = signedRequest('{"type":"email.sent","data":{}}');
    const invalid = new Request(tampered, { body: '{"type":"email.bounced","data":{}}' }) as unknown as import('next/server').NextRequest;
    expect((await POST(invalid)).status).toBe(401);
  });

  it('returns 400 for signed malformed JSON', async () => {
    const response = await POST(signedRequest('{not-json'));
    expect(response.status).toBe(400);
  });

  it('marks bounced recipients and deduplicates a replay', async () => {
    const body = JSON.stringify({
      type: 'email.bounced',
      data: { to: [' Fan@Example.com ', 'fan@example.com'] },
    });

    const first = await POST(signedRequest(body, 'msg_bounce'));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, duplicate: false });
    expect(userUpdateMany).toHaveBeenCalledTimes(1);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { email: 'fan@example.com' },
      data: { emailBounced: true },
    });

    const replay = await POST(signedRequest(body, 'msg_bounce'));
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ok: true, duplicate: true });
    expect(userUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('treats a raced duplicate insert as a successful duplicate', async () => {
    forceInsertRace = true;
    const body = JSON.stringify({ type: 'email.delivered', data: { to: ['fan@example.com'] } });
    const response = await POST(signedRequest(body, 'msg_race'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
  });
});
