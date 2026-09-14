import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { readRuntimeBinding } from '@/lib/runtime-env';

/**
 * Removes advertiser audio nobody ever bought a campaign for.
 *
 * `POST /api/advertise/audio-upload` stores a spot under `ads/audio/` the
 * moment a signed-in member uploads it — it has to, because the campaign
 * route vets the audio by fetching that URL and the checkout that follows
 * needs it in place. The CDN route serves the whole `ads/` prefix publicly,
 * because a spot is played to every listener. Put together, any member could
 * park ten public audio files an hour, 10 MB each, on iHYPE's CDN with an
 * immutable cache header and never open a campaign — the security sweep of
 * 2026-09-02 recorded it as the open item "a member can park public audio
 * under ads/audio/ with no campaign row". This is the sweep it asked for.
 *
 * An object is kept if ANY campaign points at it (matched by key suffix, so a
 * row holding a legacy host form still counts) or if it was uploaded inside
 * the grace window — an advertiser who uploads and pays five minutes later
 * must never have the spot deleted from under the checkout. Everything else
 * under the prefix is deleted. The decision is `planAdAudioSweep`, pure and
 * tested; the bucket and the database are touched only in `runAdAudioSweep`.
 *
 * It fails towards KEEPING: an unreadable campaign table returns before any
 * delete, because "no rows" and "the read failed" look identical to a planner
 * and the second would delete every paid spot on the platform.
 */

export const AD_AUDIO_PREFIX = 'ads/audio/';
export const AD_AUDIO_GRACE_MS = 24 * 60 * 60 * 1000;
/** A bound on one run, so a bucket full of junk is drained over days rather than in one 30-second invocation. */
export const AD_AUDIO_SWEEP_MAX_DELETES = 500;

export type StoredAudioObject = { key: string; uploaded: Date };

export type AdAudioSweepPlan = {
  delete: string[];
  keptReferenced: number;
  keptFresh: number;
};

export function isReferencedBy(key: string, referenced: Iterable<string>): boolean {
  for (const url of referenced) {
    if (!url) continue;
    if (url === key || url.endsWith(`/${key}`)) return true;
  }
  return false;
}

export function planAdAudioSweep(
  objects: readonly StoredAudioObject[],
  referenced: readonly string[],
  now: Date,
  graceMs = AD_AUDIO_GRACE_MS,
): AdAudioSweepPlan {
  const plan: AdAudioSweepPlan = { delete: [], keptReferenced: 0, keptFresh: 0 };
  for (const object of objects) {
    if (!object.key.startsWith(AD_AUDIO_PREFIX)) continue;
    if (isReferencedBy(object.key, referenced)) {
      plan.keptReferenced += 1;
      continue;
    }
    if (now.getTime() - object.uploaded.getTime() < graceMs) {
      plan.keptFresh += 1;
      continue;
    }
    if (plan.delete.length < AD_AUDIO_SWEEP_MAX_DELETES) plan.delete.push(object.key);
  }
  return plan;
}

type R2ListedObject = { key: string; uploaded: Date };
type R2ListResult = { objects: R2ListedObject[]; truncated: boolean; cursor?: string };
type R2SweepBucket = {
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<R2ListResult>;
  delete(key: string): Promise<unknown>;
};

function sweepBucket(): R2SweepBucket | null {
  const binding = readRuntimeBinding('R2');
  if (!binding || typeof binding !== 'object') return null;
  const candidate = binding as Partial<R2SweepBucket>;
  return typeof candidate.list === 'function' && typeof candidate.delete === 'function'
    ? (binding as R2SweepBucket)
    : null;
}

export type AdAudioSweepSummary = AdAudioSweepPlan & {
  ok: boolean;
  apply: boolean;
  listed: number;
  deleted: number;
  reason?: string;
};

export async function runAdAudioSweep({ apply, now = new Date() }: { apply: boolean; now?: Date }): Promise<AdAudioSweepSummary> {
  const empty: AdAudioSweepSummary = { ok: false, apply, listed: 0, deleted: 0, delete: [], keptReferenced: 0, keptFresh: 0 };
  const bucket = sweepBucket();
  if (!bucket) return { ...empty, reason: 'R2 binding unavailable' };

  let referenced: string[];
  try {
    const rows = await db.ad.findMany({ where: { audioUrl: { not: null } }, select: { audioUrl: true } });
    referenced = rows.map((row) => row.audioUrl).filter((url): url is string => typeof url === 'string');
  } catch (error) {
    log.error('[ad-audio-sweep]', error instanceof Error ? error : null, 'Campaign table unreadable — deleting nothing');
    return { ...empty, reason: 'campaign table unreadable' };
  }

  const objects: StoredAudioObject[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: AD_AUDIO_PREFIX, cursor, limit: 1000 });
    for (const object of page.objects) objects.push({ key: object.key, uploaded: new Date(object.uploaded) });
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const plan = planAdAudioSweep(objects, referenced, now);
  let deleted = 0;
  if (apply) {
    for (const key of plan.delete) {
      try {
        await bucket.delete(key);
        deleted += 1;
      } catch (error) {
        log.error('[ad-audio-sweep]', error instanceof Error ? error : null, `Could not delete ${key}`);
      }
    }
  }
  return { ok: true, apply, listed: objects.length, deleted, ...plan };
}
