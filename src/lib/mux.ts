import Mux from '@mux/mux-node';
import crypto from 'crypto';

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

export function getMuxClient() {
  if (!tokenId || !tokenSecret) {
    throw new Error('Missing Mux credentials');
  }

  return new Mux({ tokenId, tokenSecret });
}

export function verifyMuxWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Signs a short-lived Mux playback JWT for a ticketed show using Node crypto.
 * Requires MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY (base64 PEM) env vars.
 * Returns null if signing keys are absent (dev/staging — caller uses raw playbackId).
 */
export function getMuxPlaybackToken(playbackId: string, expirySeconds = 3600): string | null {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const privateKeyB64 = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!keyId || !privateKeyB64) return null;

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: playbackId,
    aud: 'v',
    exp: Math.floor(Date.now() / 1000) + expirySeconds
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');
  const sig = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey, 'base64url');

  return `${signingInput}.${sig}`;
}
