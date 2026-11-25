import { readRuntimeEnv } from '@/lib/runtime-env';

// Initial nonprofit-cost guard. Mux bills by video minutes, not by file size;
// a 2 GiB file can contain many hours of low-bitrate footage.
export const MAX_VIDEO_DURATION_SECS = 15 * 60;

export function isWithinPilotVideoDuration(seconds: unknown): seconds is number {
  return typeof seconds === 'number'
    && Number.isFinite(seconds) && seconds > 0
    && seconds <= MAX_VIDEO_DURATION_SECS;
}

export function isMuxVideoConfigured(): boolean {
  return Boolean(readRuntimeEnv('MUX_TOKEN_ID') && readRuntimeEnv('MUX_TOKEN_SECRET') && readRuntimeEnv('MUX_WEBHOOK_SECRET'));
}

export function isVideoUploadEnabled(): boolean {
  return readRuntimeEnv('FEATURE_ENABLE_VIDEO_UPLOADS') === 'true' && isMuxVideoConfigured();
}

export class MuxApiError extends Error {
  constructor(readonly status: number) { super(`Video provider returned status ${status}.`); }
}

/** Server-side only. Never return bearer credentials to the browser. */
export async function muxRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const id = readRuntimeEnv('MUX_TOKEN_ID');
  const secret = readRuntimeEnv('MUX_TOKEN_SECRET');
  if (!id || !secret) throw new MuxApiError(503);
  if (!/^\/(uploads(\/[-_a-zA-Z0-9]+(\/cancel)?)?|assets(\/[-_a-zA-Z0-9]+(\/playback-ids(\/[-_a-zA-Z0-9]+)?)?)?)$/.test(path)) {
    throw new Error('Invalid Mux API path.');
  }
  const response = await fetch(`https://api.mux.com/video/v1${path}`, {
    method,
    headers: {
      authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new MuxApiError(response.status);
  if (method === 'DELETE') return {} as T;
  return (await response.json() as { data: T }).data;
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/../g)!.map(part => Number.parseInt(part, 16)));
}

/** Mux HMAC-SHA256: signature covers raw body, exact timestamp, and a dot. */
export async function verifyMuxWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const fields = new Map(signatureHeader.split(',').map(kv => kv.trim().split('=', 2) as [string, string]));
  const timestamp = fields.get('t');
  const signature = fields.get('v1');
  if (!timestamp || !/^\d{10,12}$/.test(timestamp) || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(nowSeconds - seconds) > 300) return false;
  const bytes = decodeHex(signature);
  if (!bytes) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, bytes as BufferSource, encoder.encode(`${timestamp}.${body}`));
}
