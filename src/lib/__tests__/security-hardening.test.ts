import { createHmac } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { constantTimeEqual, verifyBearerToken } from '@/lib/secret-compare';
import { readClientAddress } from '@/lib/request-meta';
import { verifyResendSignature } from '@/lib/resend-webhook';

function requestWithHeaders(headers: Record<string, string>) {
  return new Request('https://ihype.test/api', { headers });
}

function signResendPayload(payload: string, svixId: string, svixTimestamp: string, secret: string) {
  const encodedSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const svixDigest = createHmac('sha256', Buffer.from(encodedSecret, 'base64'))
    .update(`${svixId}.${svixTimestamp}.${payload}`)
    .digest('base64');
  return `v1,${svixDigest}`;
}

const RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('ihype-resend-webhook-test-key-32b').toString('base64')}`;

const readSource = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('security-sensitive source policy', () => {
  it('does not use predictable randomness for generated account handles', () => {
    for (const path of [
      'src/app/api/register/route.ts',
      'src/app/api/advertise/register/route.ts',
    ]) {
      const source = readSource(path);
      expect(source).not.toContain('Math.random()');
      expect(source).toContain('crypto.randomUUID()');
    }
  });

  it('does not use predictable randomness in server-generated identifiers or ordering', () => {
    for (const path of [
      'src/app/api/shows/route.ts',
      'src/app/api/discover/seeds/route.ts',
      'src/lib/alpha-diagnostics.ts',
      'scripts/seed-preview-content.mjs',
    ]) {
      expect(readSource(path), path).not.toContain('Math.random()');
    }
  });

  it('scrubs request details and disables default PII in both Sentry runtimes', () => {
    for (const path of ['src/instrumentation-client.ts', 'worker.js']) {
      const source = readSource(path);
      expect(source, path).toContain('sendDefaultPii: false');
      expect(source, path).toContain('delete event.request.cookies');
      expect(source, path).toContain('delete event.request.headers');
      expect(source, path).toContain('delete event.request.data');
    }
  });

  it('gives production maintenance workflows explicit least-privilege permissions', () => {
    const expectations = new Map([
      ['.github/workflows/purge-cache.yml', 'permissions: {}'],
      ['.github/workflows/seed-preview-content.yml', 'permissions:\n  contents: read'],
      ['.github/workflows/resolve-failed-migration.yml', 'permissions:\n  contents: read'],
      ['.github/workflows/cloudflare-edge-guards.yml', 'permissions:\n  contents: read'],
    ]);
    for (const [path, policy] of expectations) {
      expect(readSource(path), path).toContain(policy);
    }
    expect(readSource('.github/workflows/deploy-production.yml')).toContain(
      'npm run audit:mobile -- --base=https://ihype.org --strict',
    );
  });
});

describe('secret comparison helpers', () => {
  it('matches equal strings and rejects unequal strings', () => {
    expect(constantTimeEqual('same-secret', 'same-secret')).toBe(true);
    expect(constantTimeEqual('same-secret', 'other-secret')).toBe(false);
  });

  it('rejects length mismatches, missing values, and empty bearer secrets', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual(null, 'secret')).toBe(false);
    expect(verifyBearerToken('Bearer secret', '')).toBe(false);
    expect(verifyBearerToken('Bearer secret', '   ')).toBe(false);
  });

  it('only accepts exact bearer tokens', () => {
    expect(verifyBearerToken(null, 'secret')).toBe(false);
    expect(verifyBearerToken('Basic secret', 'secret')).toBe(false);
    expect(verifyBearerToken('Bearer wrong', 'secret')).toBe(false);
    expect(verifyBearerToken('Bearer secret', 'secret')).toBe(true);
  });
});

describe('client address parsing', () => {
  it('prefers Cloudflare connecting IP over other proxy headers', () => {
    const request = requestWithHeaders({
      'cf-connecting-ip': '203.0.113.10',
      'x-real-ip': '198.51.100.2',
      'x-forwarded-for': '192.0.2.1, 192.0.2.2'
    });

    expect(readClientAddress(request)).toBe('203.0.113.10');
  });

  it('falls back to x-real-ip then first x-forwarded-for value', () => {
    expect(readClientAddress(requestWithHeaders({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(readClientAddress(requestWithHeaders({ 'x-forwarded-for': '192.0.2.1, 192.0.2.2' }))).toBe('192.0.2.1');
  });

  it('returns unknown when no address headers are present', () => {
    expect(readClientAddress(requestWithHeaders({}))).toBe('unknown');
    expect(readClientAddress(undefined)).toBe('unknown');
  });
});

describe('Resend webhook signature verification', () => {
  it('accepts a valid fresh Svix signature', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-31T02:00:00.000Z'));
    const payload = JSON.stringify({ type: 'email.bounced', data: { to: ['fan@example.com'] } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signResendPayload(payload, 'msg_123', timestamp, RESEND_WEBHOOK_SECRET);

    expect(verifyResendSignature(payload, 'msg_123', timestamp, signature, RESEND_WEBHOOK_SECRET)).toBe(true);
    vi.useRealTimers();
  });

  it('rejects stale signatures and tampered payloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-31T02:00:00.000Z'));
    const payload = JSON.stringify({ type: 'email.bounced', data: { to: ['fan@example.com'] } });
    const staleTimestamp = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000));
    const freshTimestamp = String(Math.floor(Date.now() / 1000));
    const staleSignature = signResendPayload(payload, 'msg_123', staleTimestamp, RESEND_WEBHOOK_SECRET);
    const freshSignature = signResendPayload(payload, 'msg_123', freshTimestamp, RESEND_WEBHOOK_SECRET);

    expect(verifyResendSignature(payload, 'msg_123', staleTimestamp, staleSignature, RESEND_WEBHOOK_SECRET)).toBe(false);
    expect(verifyResendSignature(`${payload} `, 'msg_123', freshTimestamp, freshSignature, RESEND_WEBHOOK_SECRET)).toBe(false);
    vi.useRealTimers();
  });

  it('rejects malformed or undersized webhook secrets', () => {
    const payload = '{}';
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(verifyResendSignature(payload, 'msg_123', timestamp, 'v1,anything', 'whsec_not*base64')).toBe(false);
    expect(verifyResendSignature(payload, 'msg_123', timestamp, 'v1,anything', 'whsec_dGlueQ==')).toBe(false);
  });
});
