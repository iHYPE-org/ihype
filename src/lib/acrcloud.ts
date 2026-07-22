/**
 * ACRCloud audio identification client — Layer 1 (acoustic fingerprinting)
 * of the track-upload copyright scan. See src/lib/audio-fingerprint.ts and
 * runTrackScanPipeline in src/lib/media-vetting.ts.
 *
 * ACRCloud was selected (2026-07-22) as the licensed reference-audio catalog
 * service the stub always pointed at. This uses ACRCloud's SYNCHRONOUS
 * Identification API (`POST /v1/identify`): we send a sample of the uploaded
 * audio, ACRCloud fingerprints it against its commercial-recording database,
 * and returns any matches. A match means the upload is (all or part of) a
 * known commercial recording — a copyright red flag. Sync is deliberate: the
 * upload scan runs inline (this codebase has no background-job infra), and
 * ACRCloud's File Scanning API is async-callback-based.
 *
 * Credentials (server-side only). If the ACRCloud host isn't reachable from
 * the Cloudflare Worker by default, add it to the Worker's network egress:
 *   ACRCLOUD_HOST           region host from your project's Access tab,
 *                           e.g. identify-eu-west-1.acrcloud.com
 *   ACRCLOUD_ACCESS_KEY
 *   ACRCLOUD_ACCESS_SECRET
 * When any is missing the client reports 'not-configured' so the scan layer
 * shows "not configured" rather than a false pass — the same honest posture
 * the original stub had.
 *
 * NOT YET LIVE-VERIFIED: written to ACRCloud's documented v1 identify
 * contract (HMAC-SHA1-signed multipart request), but no ACRCloud project was
 * available to exercise it against here — confirm the exact host and
 * response shape on the first real upload.
 */

// ACRCloud's identify endpoint fingerprints a short sample, not a whole
// track. Cap what we send so a large upload doesn't exceed the API's sample
// size limit — the first ~1 MB of a compressed track is well over the
// ~10-20s ACRCloud needs to fingerprint. Slicing mid-frame is fine; the
// server-side decoder tolerates a partial stream.
const MAX_SAMPLE_BYTES = 1_000_000;

export type AcrOutcome =
  | { status: 'not-configured' }
  | { status: 'no-match' }
  | { status: 'match'; matchedSource: string; score: number | null }
  | { status: 'error'; detail: string };

interface AcrIdentifyResponse {
  status?: { code?: number; msg?: string };
  metadata?: {
    music?: Array<{
      title?: string;
      score?: number;
      artists?: Array<{ name?: string }>;
    }>;
  };
}

function readCreds() {
  const host = process.env.ACRCLOUD_HOST?.trim();
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY?.trim();
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET?.trim();
  if (!host || !accessKey || !accessSecret) return null;
  return { host, accessKey, accessSecret };
}

// ACRCloud signs with HMAC-SHA1 over a fixed field order, base64-encoded.
// Web Crypto is available in both workerd and Node (vitest), matching the
// hand-rolled crypto approach already used in src/lib/native-push.ts.
async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function identifyAudio(audioBytes: Uint8Array): Promise<AcrOutcome> {
  const creds = readCreds();
  if (!creds) return { status: 'not-configured' };

  const { host, accessKey, accessSecret } = creds;
  const capped =
    audioBytes.byteLength > MAX_SAMPLE_BYTES ? audioBytes.subarray(0, MAX_SAMPLE_BYTES) : audioBytes;
  // Copy into a standalone ArrayBuffer-backed array — a subarray view is
  // typed as possibly SharedArrayBuffer-backed, which isn't a valid BlobPart.
  const sample = new Uint8Array(capped.byteLength);
  sample.set(capped);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // string-to-sign field order is fixed by ACRCloud: method, uri, access_key,
  // data_type, signature_version, timestamp — newline-separated.
  const stringToSign = ['POST', '/v1/identify', accessKey, 'audio', '1', timestamp].join('\n');

  try {
    const signature = await hmacSha1Base64(accessSecret, stringToSign);
    const form = new FormData();
    form.append('access_key', accessKey);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('timestamp', timestamp);
    form.append('sample_bytes', String(sample.byteLength));
    form.append('sample', new Blob([sample]), 'sample');

    const res = await fetch(`https://${host}/v1/identify`, { method: 'POST', body: form });
    if (!res.ok) return { status: 'error', detail: `ACRCloud HTTP ${res.status}` };

    const json = (await res.json()) as AcrIdentifyResponse;
    const code = json?.status?.code;
    // 1001 = "no result": the sample matched nothing in the catalog — the
    // good case for an original upload.
    if (code === 1001) return { status: 'no-match' };
    if (code !== 0) {
      return { status: 'error', detail: `ACRCloud status ${code ?? 'unknown'}: ${json?.status?.msg ?? ''}`.trim() };
    }

    const top = json?.metadata?.music?.[0];
    if (!top) return { status: 'no-match' };
    const artists = Array.isArray(top.artists)
      ? top.artists.map((a) => a?.name).filter(Boolean).join(', ')
      : '';
    const matchedSource = [artists, top.title].filter(Boolean).join(' — ') || 'a known commercial recording';
    return { status: 'match', matchedSource, score: typeof top.score === 'number' ? top.score : null };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}
