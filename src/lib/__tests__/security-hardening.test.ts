import { createHmac } from 'crypto';
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
