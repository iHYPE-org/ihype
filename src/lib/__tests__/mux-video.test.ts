import { describe, expect, it } from 'vitest';
import { isVideoUploadEnabled, verifyMuxWebhookSignature } from '@/lib/mux-video';

describe('Mux video security', () => {
  it('is off unless explicitly configured', () => {
    expect(isVideoUploadEnabled()).toBe(false);
  });
  it('rejects missing, stale, and malformed signatures', async () => {
    expect(await verifyMuxWebhookSignature('{}', null, 'secret', 1700000000)).toBe(false);
    expect(await verifyMuxWebhookSignature('{}', 't=1700000000,v1=bad', 'secret', 1700000000)).toBe(false);
    expect(await verifyMuxWebhookSignature('{}', 't=1700000000,v1='+'0'.repeat(64), 'secret', 1700000301)).toBe(false);
  });
  it('accepts the raw signed payload but rejects a modified payload', async () => {
    const text = new TextEncoder();
    const signed = '{"type":"video.asset.ready"}';
    const time = 1700000000;
    const key = await crypto.subtle.importKey('raw', text.encode('webhook-test-secret'), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    const signatureBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, text.encode(`${time}.${signed}`)));
    const hex = [...signatureBytes].map(v=>v.toString(16).padStart(2,'0')).join('');
    expect(await verifyMuxWebhookSignature(signed, `t=${time},v1=${hex}`, 'webhook-test-secret', time)).toBe(true);
    expect(await verifyMuxWebhookSignature(signed+' ', `t=${time},v1=${hex}`, 'webhook-test-secret', time)).toBe(false);
  });
});
