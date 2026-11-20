import { describe, expect, it } from 'vitest';
import { isVideoUploadEnabled, isWithinPilotVideoDuration, MAX_VIDEO_DURATION_SECS, verifyMuxWebhookSignature } from '@/lib/mux-video';
import { isAllowedMuxDirectUploadUrl } from '@/lib/mux-upload-url';

describe('Mux video security', () => {
  it('accepts only the documented HTTPS Mux direct upload hosts', () => {
    for (const url of [
      'https://storage.googleapis.com/video-uploads/signed',
      'https://uploads.mux.com/direct/signed',
      'https://regional-upload.mux.com/upload?signature=fixture',
    ]) {
      expect(isAllowedMuxDirectUploadUrl(url)).toBe(true);
    }
  });
  it('rejects deceptive hosts, credentials in URLs, and non-HTTPS schemes', () => {
    for (const url of [
      'https://storage.googleapis.com.attacker.example/file',
      'https://uploads.mux.com.attacker.example/file',
      'https://attacker.example/redirect/https://uploads.mux.com',
      'https://uploads.mux.com@attacker.example/file',
      'https://attacker.example@uploads.mux.com/file',
      'https://mux.com/file',
      'http://uploads.mux.com/file',
      'javascript:alert(1)',
      'not-a-url',
      '',
      null,
    ]) {
      expect(isAllowedMuxDirectUploadUrl(url)).toBe(false);
    }
  });
  it('is off unless explicitly configured', () => {
    expect(isVideoUploadEnabled()).toBe(false);
  });
  it('rejects overlong and unknown video durations to protect Mux spending', () => {
    expect(MAX_VIDEO_DURATION_SECS).toBe(900);
    expect(isWithinPilotVideoDuration(900)).toBe(true);
    expect(isWithinPilotVideoDuration(901)).toBe(false);
    expect(isWithinPilotVideoDuration(0)).toBe(false);
    expect(isWithinPilotVideoDuration(Number.NaN)).toBe(false);
    expect(isWithinPilotVideoDuration(undefined)).toBe(false);
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
