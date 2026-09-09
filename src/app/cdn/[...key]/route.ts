import { parseRangeHeader } from '@/lib/http-range';
import { readRuntimeBinding } from '@/lib/runtime-env';

/**
 * Serves an object out of the R2 bucket over the Worker's own origin.
 *
 * `src/lib/r2.ts` has emitted `/cdn/<key>` URLs for track audio since it was
 * written, and `src/lib/object-storage.ts` now emits them for images and ad
 * audio too — but nothing in this repository ever served that path. Either an
 * edge rule maps it to the bucket (configured in the Cloudflare dashboard,
 * where this project's routes live, and invisible from the codebase) or those
 * URLs 404. This route removes the guess: if an edge rule exists it answers
 * first and this is never reached; if it does not, this serves the object.
 *
 * PUBLIC PREFIXES ONLY, AND THAT IS THE IMPORTANT PART. A key is a bearer
 * token here — anyone holding it gets the bytes — so only namespaces whose
 * contents are already public may be served this way. `verification/` is the
 * one that must never appear below: those objects are identity and ownership
 * documents (JPEG/PNG/PDF), and `/api/verify` deliberately keeps them out of
 * R2 entirely for the same reason. Adding a namespace here is a decision about
 * who can read it.
 */
const PUBLIC_PREFIXES = [
  'profile/',       // avatars, heroes, logos, gallery images — drawn on public pages
  'artist-media/',  // uploaded tracks and their cover art
  'ads/',           // advertiser audio spots, played to every listener
];

export const dynamic = 'force-dynamic';

type R2ObjectLike = {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  size?: number;
  httpEtag?: string;
};

type R2GetOptions = { range?: { offset: number; length: number } };
type R2BucketLike = {
  get(key: string, options?: R2GetOptions): Promise<R2ObjectLike | null>;
  /* Metadata only, no body. Optional because the binding is reached through a
     structural type and a test double need not implement it; without it a
     ranged request simply falls back to serving the whole object. */
  head?(key: string): Promise<R2ObjectLike | null>;
};

/* Audio is the reason this route serves ranges, and a media element will not
   ask for one unless the first response says it can. Both headers go on the
   200 as well as the 206. */
function baseHeaders(object: Partial<R2ObjectLike>): Record<string, string> {
  return {
    'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // Keys carry a UUID and objects are replaced rather than mutated, so a
    // long immutable cache is safe and keeps repeat plays off the Worker.
    'Cache-Control': 'public, max-age=31536000, immutable',
    ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  let key: string;
  try {
    key = segments.map((segment) => decodeURIComponent(segment)).join('/');
  } catch {
    // A malformed escape (`%zz`) is a bad key, not a server fault.
    return new Response('Not found', { status: 404 });
  }

  // Traversal cannot escape a bucket the way it escapes a filesystem, but a
  // key containing ".." would still be matched against the prefix list before
  // normalisation, so refuse it rather than reason about it.
  if (!key || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  if (!PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return new Response('Not found', { status: 404 });
  }

  const binding = readRuntimeBinding('R2');
  const bucket = binding && typeof (binding as Partial<R2BucketLike>).get === 'function'
    ? (binding as R2BucketLike)
    : null;
  if (!bucket) return new Response('Not found', { status: 404 });

  const rangeHeader = request.headers.get('range');

  /* No range asked for: one read, whole object, and `Accept-Ranges` on it so
     the player knows it may ask next time. */
  if (!rangeHeader) {
    const object = await bucket.get(key).catch(() => null);
    if (!object?.body) return new Response('Not found', { status: 404 });
    return new Response(object.body as unknown as BodyInit, {
      headers: {
        ...baseHeaders(object),
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
      headers: { ...baseHeaders(meta ?? {}), 'Content-Range': `bytes */${size}` },
    });
  }

  if (wanted.kind === 'full') {
    // Either the header was one this parser does not handle, or the size could
    // not be read. Serving everything is always correct, just less efficient.
    const object = await bucket.get(key).catch(() => null);
    if (!object?.body) return new Response('Not found', { status: 404 });
    return new Response(object.body as unknown as BodyInit, { headers: baseHeaders(object) });
  }

  const length = wanted.end - wanted.start + 1;
  const ranged = await bucket
    .get(key, { range: { offset: wanted.start, length } })
    .catch(() => null);
  if (!ranged?.body) return new Response('Not found', { status: 404 });

  return new Response(ranged.body as unknown as BodyInit, {
    status: 206,
    headers: {
      ...baseHeaders(ranged),
      'Content-Range': `bytes ${wanted.start}-${wanted.end}/${size}`,
      'Content-Length': String(length),
    },
  });
}
