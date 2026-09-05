import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The mail sink is honoured on LOOPBACK ONLY. That rule is the whole safety
 * of having it: a production Worker cannot usefully reach its own loopback,
 * so a leaked, mistaken or malicious `EMAIL_SINK_URL` there sends nothing
 * anywhere rather than diverting members' mail to a third party.
 */
async function loadWith(sinkUrl: string | undefined, resend = false) {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    env: { EMAIL_SINK_URL: sinkUrl, EMAIL_FROM: 'admin@ihype.org', RESEND_API_KEY: resend ? 're_test' : undefined },
  }));
  vi.doMock('@/lib/db', () => ({ db: {} }));
  vi.doMock('@/lib/runtime-flags', () => ({ isOutboundEmailEnabledRuntime: async () => true }));
  vi.doMock('@/lib/email-queue', () => ({ enqueueEmail: async () => {} }));
  vi.doMock('@/lib/audit', () => ({ recordEmailDelivery: async () => {} }));
  return import('@/lib/mailer');
}

afterEach(() => {
  vi.doUnmock('@/lib/env');
  vi.restoreAllMocks();
});

describe('the mail sink', () => {
  it('is honoured for loopback URLs', async () => {
    for (const url of ['http://127.0.0.1:8791/emails', 'http://localhost:9/x', 'http://[::1]:8791/emails']) {
      const mailer = await loadWith(url);
      expect(mailer.emailSinkUrl(), url).toBeTruthy();
      expect(mailer.isEmailDeliveryConfigured(), url).toBe(true);
    }
  });

  it('ignores anything that is not loopback, and delivery stays unconfigured', async () => {
    for (const url of ['https://evil.example/collect', 'http://10.0.0.5/emails', 'http://api.resend.com/', 'not a url', 'http://127.0.0.1.evil.example/']) {
      const mailer = await loadWith(url);
      expect(mailer.emailSinkUrl(), url).toBeNull();
      expect(mailer.isEmailDeliveryConfigured(), url).toBe(false);
    }
  });

  it('posts the message to the sink instead of Resend when set', async () => {
    const mailer = await loadWith('http://127.0.0.1:8791/emails', true);
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 202 });
    });
    const result = await mailer.sendGenericEmail({ to: 'fan@example.com', subject: 'Hello', text: 'hi', html: '<p>hi</p>' });
    expect(result).toEqual({ mode: 'sink' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:8791/emails');
    expect(calls[0].body).toMatchObject({ from: 'admin@ihype.org', to: 'fan@example.com', subject: 'Hello', text: 'hi' });
    vi.unstubAllGlobals();
  });
});
