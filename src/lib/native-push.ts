import { db } from '@/lib/db';
import { readRuntimeEnv } from '@/lib/runtime-env';

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
type FcmServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

/**
 * The ONE place the three FCM secrets are read.
 *
 * Read through readRuntimeEnv, NOT process.env: these are Worker *secrets*,
 * and on workerd a secret never appears on process.env — it is only reachable
 * via the Cloudflare env binding (see src/lib/runtime-env.ts). Read the old
 * way, all three are undefined in production and native push no-ops
 * permanently no matter how correctly the secrets are set. Same latent fault
 * that had transactional email dead for 36 days and that reportToSentry() was
 * migrated off.
 *
 * `FCM_PRIVATE_KEY` is a multi-line PEM. `wrangler secret put` accepts a paste
 * with real newlines; the unescape below also accepts the single-line form
 * with literal `\n`. Setting it with BOTH — escaping a value that already
 * carries real newlines — yields a key that parses as neither, which is why
 * the readiness check below reports the key as present and sending still
 * fails at the JWT signature rather than here.
 */
function readFcmServiceAccount(): FcmServiceAccount | null {
  const projectId = readRuntimeEnv('FCM_PROJECT_ID');
  const clientEmail = readRuntimeEnv('FCM_CLIENT_EMAIL');
  const privateKey = readRuntimeEnv('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/**
 * Whether native push can reach a device at all, and what is missing if not.
 *
 * This exists because the absence of these secrets is the QUIETEST failure in
 * the whole notification stack: the app registers real device tokens, rows
 * land in `NativeDeviceToken`, every console reads healthy, and not one
 * notification is ever delivered — `sendNativePushNotification` logs and
 * returns. Before this, nothing outside a Worker log could answer "is push
 * configured", so the only way to find out was a physical device.
 *
 * It reports CONFIGURATION only. A green reading does not mean a push
 * arrives: FCM proxies to APNs for iOS solely once the APNs auth key is
 * uploaded in the Firebase console, and that is Apple-side state this
 * codebase cannot see. Do not let a caller present it as "push works".
 */
export function getNativePushReadiness(): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!readRuntimeEnv('FCM_PROJECT_ID')) blockers.push('Set FCM_PROJECT_ID (the service account JSON\'s project_id).');
  if (!readRuntimeEnv('FCM_CLIENT_EMAIL')) blockers.push('Set FCM_CLIENT_EMAIL (its client_email).');
  if (!readRuntimeEnv('FCM_PRIVATE_KEY')) blockers.push('Set FCM_PRIVATE_KEY (its private_key).');
  return { ready: blockers.length === 0, blockers };
}

export function isNativePushConfigured() {
  return getNativePushReadiness().ready;
}

export async function sendNativePushNotification(userId: string, payload: NativePushPayload): Promise<void> {
  const account = readFcmServiceAccount();

  if (!account) {
    console.warn('[native-push] FCM service account not configured — skipping native push for user', userId);
    return;
  }

  const { projectId, clientEmail, privateKey } = account;

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
