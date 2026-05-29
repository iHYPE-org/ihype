import { db } from '@/lib/db';

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

async function importECDSAPrivateKey(privateKeyB64u: string, publicKeyB64u: string): Promise<CryptoKey> {
  const privateBytes = base64UrlDecode(privateKeyB64u);
  const publicBytes = base64UrlDecode(publicKeyB64u);

  // Build PKCS8 DER for P-256 private key
  const privD = privateBytes.length === 32 ? privateBytes : privateBytes.slice(0, 32);
  const pubXY = publicBytes.length === 65 ? publicBytes.slice(1) : publicBytes;

  // PKCS8 structure for EC private key (P-256)
  const seq1 = new Uint8Array([0x02, 0x01, 0x01, 0x04, 0x20, ...privD, 0xa1, 0x44, 0x03, 0x42, 0x00, 0x04, ...pubXY]);
  const ecPrivKey = new Uint8Array([0x30, seq1.length, ...seq1]);
  const algId = new Uint8Array([0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
  const privKeyInfo = new Uint8Array([0x30, 0x81, 0x87, 0x02, 0x01, 0x00, ...algId, 0x04, 0x6d, ...ecPrivKey]);

  return crypto.subtle.importKey('pkcs8', toBuffer(privKeyInfo), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function buildVapidAuthHeader(endpoint: string, subject: string, publicKeyB64u: string, privateKeyB64u: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const signingInput = `${header}.${claims}`;

  const cryptoKey = await importECDSAPrivateKey(privateKeyB64u, publicKeyB64u);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    toBuffer(new TextEncoder().encode(signingInput))
  );

  return `vapid t=${signingInput}.${base64UrlEncode(sig)}, k=${publicKeyB64u}`;
}

async function hkdfDerive(secret: ArrayBuffer, salt: ArrayBuffer, info: ArrayBuffer, bits: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HKDF' }, false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits);
}

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@ihype.org';

  if (!publicKey || !privateKey) {
    console.warn('[push-notify] VAPID keys not configured — skipping push for user', userId);
    return;
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, auth: true, p256dh: true },
  });

  if (subscriptions.length === 0) return;

  const messageBytes = new TextEncoder().encode(JSON.stringify(payload));
  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const authHeader = await buildVapidAuthHeader(sub.endpoint, subject, publicKey, privateKey);

        // Encrypt payload with aesgcm Web Push encryption
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
        const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

        const clientPubBytes = base64UrlDecode(sub.p256dh);
        const clientPublicKey = await crypto.subtle.importKey(
          'raw', toBuffer(clientPubBytes), { name: 'ECDH', namedCurve: 'P-256' }, false, []
        );
        const sharedSecret = await crypto.subtle.deriveBits(
          { name: 'ECDH', public: clientPublicKey },
          serverKeyPair.privateKey,
          256
        );

        const authBytes = base64UrlDecode(sub.auth);
        const authInfo = toBuffer(new TextEncoder().encode('Content-Encoding: auth\0'));
        const prkCombined = await hkdfDerive(sharedSecret, toBuffer(authBytes), authInfo, 256);

        const buildInfo = (label: string): ArrayBuffer => {
          const labelBytes = new TextEncoder().encode(`Content-Encoding: ${label}\0`);
          const out = new Uint8Array(labelBytes.length + 2 + clientPubBytes.length + 2 + serverPublicKeyRaw.length);
          let off = 0;
          out.set(labelBytes, off); off += labelBytes.length;
          out.set([0, clientPubBytes.length], off); off += 2;
          out.set(clientPubBytes, off); off += clientPubBytes.length;
          out.set([0, serverPublicKeyRaw.length], off); off += 2;
          out.set(serverPublicKeyRaw, off);
          return toBuffer(out);
        };

        const saltBuf = toBuffer(salt);
        const contentEncKey = await hkdfDerive(prkCombined, saltBuf, buildInfo('aesgcm'), 128);
        const nonce = await hkdfDerive(prkCombined, saltBuf, buildInfo('nonce'), 96);

        const aesKey = await crypto.subtle.importKey('raw', contentEncKey, { name: 'AES-GCM' }, false, ['encrypt']);
        const paddedPayload = new Uint8Array(messageBytes.length + 2);
        paddedPayload.set([0, 0]);
        paddedPayload.set(messageBytes, 2);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, toBuffer(paddedPayload));

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aesgcm',
            Encryption: `salt=${base64UrlEncode(salt)}`,
            'Crypto-Key': `dh=${base64UrlEncode(serverPublicKeyRaw)}`,
            TTL: '86400',
          },
          body: encrypted,
        });

        if (res.status === 410 || res.status === 404) {
          staleIds.push(sub.id);
        } else if (!res.ok) {
          console.warn('[push-notify] send failed:', res.status, await res.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('[push-notify] send error:', err);
      }
    }),
  );

  if (staleIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: staleIds } } }).catch(() => null);
  }
}
