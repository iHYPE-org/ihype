/**
 * Moves media that is sitting inside Postgres out into R2.
 *
 * Why there is anything to move: `src/lib/object-storage.ts` signed S3
 * requests with four `R2_*` credentials that were never set on the Worker —
 * `wrangler secret list` shows 22 secrets and not one of them is an R2
 * credential — so `isObjectStorageConfigured()` answered false for the whole
 * life of that code and every caller took its inline fallback. Profile images,
 * cover art and ad audio were base64'd into columns; uploaded track audio went
 * into `ArtistMediaAsset.fileDataBase64`. Storage works now (DESIGN_SYNC row
 * 322), but rows written before that are still carrying their bytes.
 *
 * IT ONLY RUNS INSIDE A WORKER. The R2 binding is handed to the Worker by
 * Cloudflare and does not exist in a plain Node process, which is why this is
 * a cron job (`/api/cron?job=media-backfill`) and not a script.
 *
 * Three properties make it safe to run against production:
 *
 *   1. It is a DRY RUN unless `apply` is set. The dry run reads and measures;
 *      it writes nothing, to R2 or to the database.
 *   2. It is IDEMPOTENT. Only a value that is still inline is a candidate, so
 *      a migrated row is invisible to the next pass and re-running is a no-op.
 *   3. It never drops the inline copy until the R2 write has come back as
 *      `storageType: 'r2'`. A failed upload leaves the row exactly as it was.
 *
 * VERIFICATION DOCUMENTS ARE DELIBERATELY EXCLUDED. `Profile.verificationProofUrl`
 * holds identity and ownership proofs, and `/api/verify` keeps them inline on
 * purpose — objects under `/cdn/` are readable by anyone holding the key, and
 * an edge rule for `/cdn/*` may exist in the Cloudflare dashboard where this
 * project's routes live. Moving them here would quietly undo that decision.
 */

import { db } from '@/lib/db';
import { storeMediaFile, isObjectStorageConfigured } from '@/lib/object-storage';
import { log } from '@/lib/logger';

/** Anything still held in the database rather than in the bucket. */
export function isInlineValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

/** Bytes a base64 payload actually occupies once decoded. */
export function decodedByteLength(value: string): number {
  const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** The mime type declared by a data: URL, if it declares one. */
export function dataUrlMimeType(value: string): string {
  return /^data:([^;,]+)/.exec(value)?.[1] ?? 'application/octet-stream';
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'application/pdf': 'pdf',
};

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType.toLowerCase()] ?? mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') ?? 'bin';
}

export type BackfillSummary = {
  dryRun: boolean;
  /** Candidates found, by kind. */
  found: Record<string, number>;
  /** Rows actually rewritten (0 on a dry run). */
  migrated: number;
  /** Decoded bytes that left the database (or would, on a dry run). */
  bytes: number;
  /** Denormalized playlist/favourite rows repointed at a migrated asset. */
  cascaded: number;
  errors: string[];
  /** True when candidates remain — call again. */
  more: boolean;
};

type Candidate = {
  kind: string;
  /** Performs the upload and the row rewrite. Returns bytes moved. */
  run: () => Promise<number>;
  bytes: number;
};

export async function runMediaBackfill(
  { limit = 10, apply = false }: { limit?: number; apply?: boolean } = {},
): Promise<BackfillSummary> {
  const summary: BackfillSummary = {
    dryRun: !apply,
    found: {},
    migrated: 0,
    bytes: 0,
    cascaded: 0,
    errors: [],
    more: false,
  };

  if (apply && !isObjectStorageConfigured()) {
    // Refuse rather than no-op: storeMediaFile would hand back the same inline
    // value and the row would be "migrated" to itself.
    summary.errors.push('R2 binding is not available, so nothing can be moved out of the database.');
    return summary;
  }

  const candidates: Candidate[] = [];
  const note = (kind: string) => {
    summary.found[kind] = (summary.found[kind] ?? 0) + 1;
  };

  // ── Track audio: the largest single class, up to 10 MB a row ───────────────
  const assets = await db.artistMediaAsset.findMany({
    where: { fileDataBase64: { not: null } },
    select: { id: true, hexId: true, profileId: true, mimeType: true, originalFileName: true, fileDataBase64: true },
    take: limit + 1,
  });
  for (const asset of assets.slice(0, limit)) {
    if (!asset.fileDataBase64) continue;
    note('trackAudio');
    const mime = asset.mimeType || 'audio/mpeg';
    const bytes = decodedByteLength(asset.fileDataBase64);
    candidates.push({
      kind: 'trackAudio',
      bytes,
      run: async () => {
        const key = `artist-media/${asset.profileId}/${asset.hexId}/audio.${extensionFor(mime)}`;
        const stored = await storeMediaFile(key, `data:${mime};base64,${asset.fileDataBase64}`, mime);
        if (stored.storageType !== 'r2') throw new Error(`upload did not reach R2 for asset ${asset.id}`);
        await db.artistMediaAsset.update({
          where: { id: asset.id },
          data: {
            fileDataBase64: null,
            storageProvider: 'r2',
            storageKey: stored.key,
            storageUrl: stored.url,
          },
        });
        // Playlist and favourite rows carry their own copy of the audio URL.
        const repointed = await db.fanPlaylistItem.updateMany({
          where: { mediaId: asset.id, url: { startsWith: 'data:' } },
          data: { url: stored.url },
        });
        const favourited = await db.fanFavoriteMedia.updateMany({
          where: { mediaId: asset.id, url: { startsWith: 'data:' } },
          data: { url: stored.url },
        });
        summary.cascaded += repointed.count + favourited.count;
        return bytes;
      },
    });
  }
  if (assets.length > limit) summary.more = true;

  // ── Cover art on a track ───────────────────────────────────────────────────
  const artworks = await db.artistMediaAsset.findMany({
    where: { artworkUrl: { startsWith: 'data:' } },
    select: { id: true, hexId: true, profileId: true, artworkUrl: true },
    take: limit + 1,
  });
  for (const asset of artworks.slice(0, limit)) {
    if (!isInlineValue(asset.artworkUrl)) continue;
    note('trackArtwork');
    const value = asset.artworkUrl;
    const mime = dataUrlMimeType(value);
    const bytes = decodedByteLength(value);
    candidates.push({
      kind: 'trackArtwork',
      bytes,
      run: async () => {
        const key = `artist-media/${asset.profileId}/artwork/${asset.hexId}.${extensionFor(mime)}`;
        const stored = await storeMediaFile(key, value, mime);
        if (stored.storageType !== 'r2') throw new Error(`upload did not reach R2 for artwork ${asset.id}`);
        await db.artistMediaAsset.update({ where: { id: asset.id }, data: { artworkUrl: stored.url } });
        const repointed = await db.fanPlaylistItem.updateMany({
          where: { mediaId: asset.id, artworkUrl: { startsWith: 'data:' } },
          data: { artworkUrl: stored.url },
        });
        const favourited = await db.fanFavoriteMedia.updateMany({
          where: { mediaId: asset.id, artworkUrl: { startsWith: 'data:' } },
          data: { artworkUrl: stored.url },
        });
        summary.cascaded += repointed.count + favourited.count;
        return bytes;
      },
    });
  }
  if (artworks.length > limit) summary.more = true;

  // ── Profile graphics. verificationProofUrl is NOT in this list. ────────────
  const IMAGE_FIELDS = ['heroImage', 'avatarImage', 'logoImage', 'galleryImage'] as const;
  const profiles = await db.profile.findMany({
    where: { OR: IMAGE_FIELDS.map((field) => ({ [field]: { startsWith: 'data:' } })) },
    select: { id: true, heroImage: true, avatarImage: true, logoImage: true, galleryImage: true },
    take: limit + 1,
  });
  for (const profile of profiles.slice(0, limit)) {
    for (const field of IMAGE_FIELDS) {
      const value = profile[field];
      if (!isInlineValue(value)) continue;
      note('profileImage');
      const mime = dataUrlMimeType(value);
      const bytes = decodedByteLength(value);
      candidates.push({
        kind: 'profileImage',
        bytes,
        run: async () => {
          const key = `profile/${profile.id}/graphics/${field}-${crypto.randomUUID()}.${extensionFor(mime)}`;
          const stored = await storeMediaFile(key, value, mime);
          if (stored.storageType !== 'r2') throw new Error(`upload did not reach R2 for ${field} on ${profile.id}`);
          await db.profile.update({ where: { id: profile.id }, data: { [field]: stored.url } });
          return bytes;
        },
      });
    }
  }
  if (profiles.length > limit) summary.more = true;

  // ── Advertiser audio spots ────────────────────────────────────────────────
  const ads = await db.ad.findMany({
    where: { audioUrl: { startsWith: 'data:' } },
    select: { id: true, audioUrl: true },
    take: limit + 1,
  });
  for (const ad of ads.slice(0, limit)) {
    if (!isInlineValue(ad.audioUrl)) continue;
    note('adAudio');
    const value = ad.audioUrl;
    const mime = dataUrlMimeType(value);
    const bytes = decodedByteLength(value);
    candidates.push({
      kind: 'adAudio',
      bytes,
      run: async () => {
        const key = `ads/audio/${crypto.randomUUID()}.${extensionFor(mime)}`;
        const stored = await storeMediaFile(key, value, mime);
        if (stored.storageType !== 'r2') throw new Error(`upload did not reach R2 for ad ${ad.id}`);
        await db.ad.update({ where: { id: ad.id }, data: { audioUrl: stored.url } });
        return bytes;
      },
    });
  }
  if (ads.length > limit) summary.more = true;

  /* Computed for BOTH branches. A dry run that found more candidates than it
     can report has to say so, or the operator reads a partial byte total as
     the whole job and stops early. */
  if (candidates.length > limit) summary.more = true;

  if (!apply) {
    summary.bytes = candidates
      .slice(0, limit)
      .reduce((total, candidate) => total + candidate.bytes, 0);
    return summary;
  }

  for (const candidate of candidates.slice(0, limit)) {
    try {
      summary.bytes += await candidate.run();
      summary.migrated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(`${candidate.kind}: ${message}`);
      log.error('[media-backfill]', error instanceof Error ? error : null, `failed to move ${candidate.kind}`);
    }
  }

  return summary;
}
