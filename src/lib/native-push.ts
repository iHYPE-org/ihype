import { db } from '@/lib/db';

type NativePushPayload = {
  title: string;
  body: string;
  link?: string | null;
};

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importServiceAccountKey(privateKeyPem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// Google service-account OAuth2 exchange (RS256 JWT-bearer grant), hand-rolled
// with Web Crypto rather than a new npm dependency — same approach push-notify.ts
// already takes for Web Push VAPID, and keeps this portable to the Cloudflare
// Workers runtime (no Node-only crypto APIs).
async function getFcmAccessToken(clientEmail: string, privateKeyPem: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;

  const key = await importServiceAccountKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/**
 * Sends a native push notification to every device the user has registered
 * (src/components/NativePushRegistration.tsx → POST /api/push/register-device),
 * via Firebase Cloud Messaging's HTTP v1 API — the same transport serves both
 * iOS and Android tokens; FCM proxies to APNs for iOS once an APNs auth key is
 * uploaded to the Firebase project's Cloud Messaging settings, so there's no
 * separate raw-APNs implementation to maintain.
 *
 * Safely no-ops (matching sendPushNotification's existing VAPID pattern) when
 * the FCM service account isn't configured yet, or the user has no registered
 * devices — this is always a side effect of notifyUser(), never load-bearing.
 */
export async function sendNativePushNotification(userId: string, payload: NativePushPayload): Promise<void> {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[native-push] FCM service account not configured — skipping native push for user', userId);
    return;
  }

  const devices = await db.nativeDeviceToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });
  if (devices.length === 0) return;

  const accessToken = await getFcmAccessToken(clientEmail, privateKey).catch(() => null);
  if (!accessToken) {
    console.warn('[native-push] failed to obtain an FCM access token');
    return;
  }

  const staleIds: string[] = [];

  await Promise.allSettled(
    devices.map(async (device) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title: payload.title, body: payload.body },
              ...(payload.link ? { data: { link: payload.link } } : {}),
            },
          }),
        });

        // FCM v1 returns 404 for a token that's no longer registered.
        if (res.status === 404) {
          staleIds.push(device.id);
        } else if (!res.ok) {
          console.warn('[native-push] send failed:', res.status, await res.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('[native-push] send error:', err);
      }
    })
  );

  if (staleIds.length > 0) {
    await db.nativeDeviceToken.deleteMany({ where: { id: { in: staleIds } } }).catch(() => null);
  }
}
