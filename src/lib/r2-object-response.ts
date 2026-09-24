import { parseRangeHeader } from '@/lib/http-range';
import { readRuntimeBinding } from '@/lib/runtime-env';

/**
 * Serving one object out of the R2 bucket, with byte ranges. Shared by the
 * public `/cdn/<key>` route and the authenticated media proxy (2026-09-24,
 * DESIGN_SYNC row 513), which used to fetch its own `/cdn` URL over the public
 * internet, so every play and seek on the deck cost two Worker invocations
 * and a round trip the binding already made unnecessary.
 */

/**
 * PUBLIC PREFIXES ONLY, AND THAT IS THE IMPORTANT PART. A key is a bearer
 * token on `/cdn` — anyone holding it gets the bytes — so only namespaces whose
 * contents are already public may be served that way. `verification/` is the
 * one that must never appear below: those objects are identity and ownership
 * documents (JPEG/PNG/PDF), and `/api/verify` deliberately keeps them out of
 * R2 entirely for the same reason. Adding a namespace here is a decision about
 * who can read it.
 */
export const PUBLIC_CDN_PREFIXES = [
  'profile/',       // avatars, heroes, logos, gallery images — drawn on public pages
  'artist-media/',  // uploaded tracks and their cover art
  'ads/',           // advertiser audio spots, played to every listener
];

export type R2ObjectLike = {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  size?: number;
  httpEtag?: string;
};

type R2GetOptions = { range?: { offset: number; length: number } };
export type R2BucketLike = {
  get(key: string, options?: R2GetOptions): Promise<R2ObjectLike | null>;
  /* Metadata only, no body. Optional because the binding is reached through a
     structural type and a test double need not implement it; without it a
     ranged request simply falls back to serving the whole object. */
  head?(key: string): Promise<R2ObjectLike | null>;
};

export function isPublicCdnKey(key: string): boolean {
  // Traversal cannot escape a bucket the way it escapes a filesystem, but a
  // key containing ".." would still be matched against the prefix list before
  // normalisation, so refuse it rather than reason about it.
  if (!key || key.includes('..')) return false;
  return PUBLIC_CDN_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function readMediaBucket(): R2BucketLike | null {
  const binding = readRuntimeBinding('R2');
  return binding && typeof (binding as Partial<R2BucketLike>).get === 'function'
    ? (binding as R2BucketLike)
    : null;
}

/**
 * The object at `key` as a Response: 200 with no range, 206 for a satisfiable
 * one, 416 for one that is not, 404 when the object is absent. `headersFor`
 * supplies the caller's own headers (content type, cache policy, disposition)
 * for whichever object the read returned.
 */
export async function serveR2Object(
  bucket: R2BucketLike,
  key: string,
  rangeHeader: string | null,
  headersFor: (object: Partial<R2ObjectLike>) => Record<string, string>,
): Promise<Response> {
  /* No range asked for: one read, whole object, and `Accept-Ranges` on it so
     the player knows it may ask next time. */
  if (!rangeHeader) {
    const object = await bucket.get(key).catch(() => null);
    if (!object?.body) return new Response('Not found', { status: 404 });
    return new Response(object.body as unknown as BodyInit, {
      headers: {
        ...headersFor(object),
        ...(typeof object.size === 'number' ? { 'Content-Length': String(object.size) } : {}),
      },
    });
  }

  /* A range was asked for, so the object's LENGTH has to be known before the
     read: satisfiability, the 416's `Content-Range`, and the clamp on an
     overshooting end all need it. `head` answers that without a body — asking
     for the object and cancelling its stream would work and is a worse shape,
     since a leaked stream on a Worker is a request that never settles. */
  const meta = typeof bucket.head === 'function' ? await bucket.head(key).catch(() => null) : null;
  const size = typeof meta?.size === 'number' ? meta.size : null;
  const wanted = size === null ? ({ kind: 'full' } as const) : parseRangeHeader(rangeHeader, size);

  if (wanted.kind === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { ...headersFor(meta ?? {}), 'Content-Range': `bytes */${size}` },
    });
  }

  if (wanted.kind === 'full') {
    // Either the header was one this parser does not handle, or the size could
    // not be read. Serving everything is always correct, just less efficient.
    const object = await bucket.get(key).catch(() => null);
    if (!object?.body) return new Response('Not found', { status: 404 });
    return new Response(object.body as unknown as BodyInit, { headers: headersFor(object) });
  }

  const length = wanted.end - wanted.start + 1;
  const ranged = await bucket
    .get(key, { range: { offset: wanted.start, length } })
    .catch(() => null);
  if (!ranged?.body) return new Response('Not found', { status: 404 });

  return new Response(ranged.body as unknown as BodyInit, {
    status: 206,
    headers: {
      ...headersFor(ranged),
      'Content-Range': `bytes ${wanted.start}-${wanted.end}/${size}`,
      'Content-Length': String(length),
    },
  });
}
