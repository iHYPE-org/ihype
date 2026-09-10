import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/*
  WHAT THIS GUARDS. `executeAccountErasure` and the privacy export are two
  hand-enumerated lists of "everything we hold about a person", and the schema
  moves independently of both. `AdvertiserAccount` was in neither — it cascades
  from `User`, and that path deliberately never calls `db.user.delete()`, so
  the cascade could not fire and an advertiser's company, contact name and
  pitch survived their own account deletion. `AccessRequest` was in neither
  either, keyed by address rather than userId and therefore invisible to every
  clause in the file.

  A list cannot notice what it is missing, so this reads `schema.prisma` for
  every model that references a `User` and requires each one to be classified.
  A new model is a failing test until somebody decides what erasure owes it.

  It does NOT assert that the classification is correct — that is a judgement,
  and for several rows below it is a judgement with money or a public count
  attached. What it asserts is that the judgement was MADE.
*/

/** Rows deleted outright by `executeAccountErasure`. */
const ERASED = new Set([
  'Session', 'Account', 'Passkey', 'PasskeyBootstrapToken', 'MagicLinkToken', 'PasswordResetCode',
  'PushSubscription', 'NativeDeviceToken', 'Notification', 'NotificationPreference', 'Seed',
  'FanFavoriteMedia', 'FanPlaylist', 'ShowRsvp', 'ShowAttendee', 'SetlistVote', 'PremiumInterest',
  'ShowComment', 'MediaListen', 'ShowListen', 'Badge', 'BookingRequest',
  'AdvertiserAccount',
]);

/** Rows kept, with the person's identity removed or the link to them cut. */
const SCRUBBED = new Set([
  'ContentReport',   // reporterUserId nulled; the report itself is moderation history
  'AuditLog',        // actorUserId kept, ipAddress nulled — an append-only record of what happened
  'SupportRequest',  // name and email nulled; the thread stays for the operator
  'TicketOrder',     // buyer identity replaced, buyerUserId nulled — a financial record
  'Ticket',          // holder name and email replaced by the anonymous pair
]);

/*
  UNCLASSIFIED, and each is a real question rather than an oversight. Recorded
  here so the next erasure change starts from a list instead of a grep, and so
  the gap is visible to anyone reading the privacy path. None is fixed here,
  because deleting any of the first five changes a number somebody else can
  see, and that is the owner's call, not a test's.
*/
const RECORDED_GAPS = new Map<string, string>([
  ['HypeEvent', 'a hype is public and counted on a show; deleting it moves that count'],
  ['ProfileHypeEvent', 'the same, on a profile'],
  ['HypeLedgerEntry', 'the ledger behind those counts; deleting entries changes an artist total'],
  ['Like', 'a like is a personal act and probably should be erased — nothing counts on it publicly'],
  ['CommentReaction', 'the comments themselves ARE deleted, so these are already orphans'],
  ['FeatureVote', 'the roadmap board counts votes; erasing one changes a public tally'],
  ['FeatureRequest', 'the request text may be the only record of an idea others voted on'],
  ['AuxQueue', 'a crowd queue entry, personal and short-lived — probably erase'],
  ['AdImpression', 'the once-per-listener-per-day dedup key; deleting it lets an advertiser be charged twice for the same person'],
  ['InviteCode', 'usedByUserId records who claimed an invite; unlink rather than delete, or the code reads unused'],
  ['AdminDevice', 'a registered admin device; only ever exists for an administrator'],
]);

function userLinkedModels(schema: string): string[] {
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
  return models
    .filter(([, , body]) => /\buser\w*\s+User\b/.test(body) || /^\s*\w*[Uu]serId\s/m.test(body))
    .map(([, name]) => name);
}

describe('every model tied to a person is classified for erasure', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('leaves nothing unclassified — a new user-linked model must be decided on', () => {
    const unclassified = userLinkedModels(schema).filter(
      (model) => !ERASED.has(model) && !SCRUBBED.has(model) && !RECORDED_GAPS.has(model),
    );
    expect(
      unclassified,
      'add each to ERASED, SCRUBBED, or RECORDED_GAPS in this file once you have decided what erasure owes it',
    ).toEqual([]);
  });

  it('erasure really deletes what this file claims it deletes', () => {
    const source = readFileSync('src/lib/privacy-actions.ts', 'utf8');
    const called = new Set([...source.matchAll(/db\.([a-zA-Z]+)\./g)].map((m) => m[1]));
    const claimed = [...ERASED].filter((model) => !called.has(model[0].toLowerCase() + model.slice(1)));
    expect(claimed, 'ERASED names these, and privacy-actions.ts does not touch them').toEqual([]);
  });

  it('the export carries the advertiser identity record, not only the campaigns', () => {
    /* `advertisedAds` was already exported, which is what made the omission
       easy to miss: the subject received everything they had bought and
       nothing about who we hold them to be. */
    const route = readFileSync('src/app/api/privacy/export/route.ts', 'utf8');
    expect(route).toContain('advertiserAccount: true');
  });
});
