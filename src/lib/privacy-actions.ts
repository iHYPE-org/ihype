import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { deleteMediaFile } from '@/lib/object-storage';
import { deauthorizeStripeConnectAccount, isStripeConfigured } from '@/lib/stripe';
import { log } from '@/lib/logger';

// Implements the privacy promises published on /legal and in the Support →
// Privacy panel. Three levels, in increasing severity:
//
//   1. Identity detachment — remove IP/location metadata linking a person to
//      their activity log. Runs automatically for everyone after
//      IDENTITY_DETACH_DEFAULT_DAYS (cron job `identity-detach`), or
//      immediately on request (executeIdentityDetach).
//   2. Hype-history wipe — delete a user's hype votes AND decrement the
//      shared show/profile aggregate counters by exactly the deleted amount,
//      so public counts stay consistent.
//   3. Account erasure — anonymization-based deletion. Personal rows are
//      deleted, embedded PII in retained records is scrubbed, and the User
//      row is kept as an empty shell. We never `db.user.delete()`: the
//      Show.creator relation cascades, so hard-deleting a creator would
//      destroy other people's ticket and payout records (which GDPR Art.
//      17(3)(b) lets us retain as legal-obligation records anyway).
//
// Every step is idempotent — re-running after a partial failure is safe.

export const IDENTITY_DETACH_DEFAULT_DAYS = 30;

const ANON_NAME = 'Deleted user';
// .invalid is an IETF-reserved TLD (RFC 2606): this address can never
// resolve or receive mail, so scrubbed rows can't leak into real sends.
const ANON_EMAIL = 'deleted@ihype.invalid';

/**
 * Cron body for the published default: strip IP addresses from audit-log
 * entries older than the detach window, sitewide. Actor linkage is kept for
 * security auditing (rows are fully deleted at 90 days by audit-log-rotate);
 * the IP is the strongest identifier and ages out here.
 */
export async function scrubAgedAuditLogIps(days = IDENTITY_DETACH_DEFAULT_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.auditLog.updateMany({
    where: { createdAt: { lt: cutoff }, ipAddress: { not: null } },
    data: { ipAddress: null },
  });
  return result.count;
}

export type IdentityDetachSummary = {
  auditIpsScrubbed: number;
  magicLinkTokensDeleted: number;
  expiredSessionsDeleted: number;
};

/**
 * User-initiated "detach now": immediately remove IP/location metadata tying
 * this account to its activity log, ahead of the automatic 30-day window.
 */
export async function executeIdentityDetach(
  userId: string,
  actorUserId: string = userId,
): Promise<IdentityDetachSummary> {
  const [auditIps, magicTokens, sessions] = await Promise.all([
    db.auditLog.updateMany({
      where: { actorUserId: userId, ipAddress: { not: null } },
      data: { ipAddress: null },
    }),
    db.magicLinkToken.deleteMany({
      where: { userId, OR: [{ used: true }, { expiresAt: { lt: new Date() } }] },
    }),
    db.session.deleteMany({ where: { userId, expires: { lt: new Date() } } }),
  ]);

  await db.user.update({ where: { id: userId }, data: { lastLoginCountry: null } });

  await recordAuditEvent({
    actorUserId,
    action: 'privacy_detach_executed',
    entityType: 'user',
    entityId: userId,
    metadata: { auditIpsScrubbed: auditIps.count },
  });

  return {
    auditIpsScrubbed: auditIps.count,
    magicLinkTokensDeleted: magicTokens.count,
    expiredSessionsDeleted: sessions.count,
  };
}

export type HypeWipeSummary = {
  showHypesDeleted: number;
  profileHypesDeleted: number;
};

/**
 * Delete a user's hype votes and decrement each show/profile aggregate by
 * exactly the number of that user's deleted events, keeping the public
 * counters other users see consistent.
 */
export async function executeHypeWipe(
  userId: string,
  actorUserId: string = userId,
): Promise<HypeWipeSummary> {
  const showGroups = await db.hypeEvent.groupBy({
    by: ['showId'],
    where: { userId },
    _count: { _all: true },
  });
  let showHypesDeleted = 0;
  for (const group of showGroups) {
    const [deleted] = await db.$transaction([
      db.hypeEvent.deleteMany({ where: { userId, showId: group.showId } }),
      db.show.update({
        where: { id: group.showId },
        data: { hypeCount: { decrement: group._count._all } },
      }),
    ]);
    showHypesDeleted += deleted.count;
  }
  // decrement can undershoot zero if counters ever drifted; clamp.
  await db.show.updateMany({ where: { hypeCount: { lt: 0 } }, data: { hypeCount: 0 } });

  const profileGroups = await db.profileHypeEvent.groupBy({
    by: ['profileId'],
    where: { userId },
    _count: { _all: true },
  });
  let profileHypesDeleted = 0;
  for (const group of profileGroups) {
    const [deleted] = await db.$transaction([
      db.profileHypeEvent.deleteMany({ where: { userId, profileId: group.profileId } }),
      db.profile.update({
        where: { id: group.profileId },
        data: { hypeCount: { decrement: group._count._all } },
      }),
    ]);
    profileHypesDeleted += deleted.count;
  }
  await db.profile.updateMany({ where: { hypeCount: { lt: 0 } }, data: { hypeCount: 0 } });

  await recordAuditEvent({
    actorUserId,
    action: 'privacy_hype_wipe_executed',
    entityType: 'user',
    entityId: userId,
    metadata: { showHypesDeleted, profileHypesDeleted },
  });

  return { showHypesDeleted, profileHypesDeleted };
}

export type AccountErasureSummary = {
  profilesAnonymized: number;
  mediaAssetsDeleted: number;
  ticketOrdersScrubbed: number;
  ticketsScrubbed: number;
  stripeConnectDeauthorized: number;
  // hexIds of profiles whose Connect account Stripe refused to delete
  // (typically a pending balance) — needs a human to resolve in Stripe,
  // then either retry deletion or leave it, since the profile is already
  // otherwise anonymized.
  stripeConnectNeedsManualReview: string[];
};

/**
 * Anonymization-based account erasure. Deletes personal rows, scrubs PII
 * embedded in retained financial/moderation records, anonymizes owned
 * profiles in place, and reduces the User row to an inert shell whose email
 * slot is freed for re-registration. Sessions are killed via
 * userSecurityVersion. Retained: ticket-order/payout skeletons (legal
 * obligation), moderation reports (reporter unlinked), payout/DMCA audit
 * entries (IP stripped).
 */
export async function executeAccountErasure(
  userId: string,
  actorUserId: string,
): Promise<AccountErasureSummary> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new Error('User not found.');
  if (user.role === 'ADMIN') {
    throw new Error('Refusing to erase an ADMIN account — demote it first.');
  }

  // 1. Hype votes first (needs the userId link that later steps sever).
  await executeHypeWipe(userId, actorUserId);

  // 2. Credentials, sessions, devices, and purely-personal rows.
  await Promise.all([
    db.session.deleteMany({ where: { userId } }),
    db.account.deleteMany({ where: { userId } }),
    db.passkey.deleteMany({ where: { userId } }),
    db.passkeyBootstrapToken.deleteMany({ where: { userId } }),
    db.magicLinkToken.deleteMany({ where: { userId } }),
    db.passwordResetCode.deleteMany({ where: { userId } }),
    db.pushSubscription.deleteMany({ where: { userId } }),
    db.nativeDeviceToken.deleteMany({ where: { userId } }),
  ]);
  await Promise.all([
    db.notification.deleteMany({ where: { userId } }),
    db.notificationPreference.deleteMany({ where: { userId } }),
    db.seed.deleteMany({ where: { userId } }),
    db.fanFavoriteMedia.deleteMany({ where: { userId } }),
    db.fanPlaylist.deleteMany({ where: { userId } }),
    db.follow.deleteMany({ where: { followerId: userId } }),
    db.showRsvp.deleteMany({ where: { userId } }),
    db.showAttendee.deleteMany({ where: { userId } }),
    db.setlistVote.deleteMany({ where: { userId } }),
    db.premiumInterest.deleteMany({ where: { userId } }),
    db.showComment.deleteMany({ where: { userId } }),
    db.mediaListen.deleteMany({ where: { userId } }),
    db.showListen.deleteMany({ where: { userId } }),
    db.badge.deleteMany({ where: { userId } }),
    db.bookingRequest.deleteMany({ where: { fromUserId: userId } }),
    db.venueConnectionRequest.deleteMany({ where: { requesterId: userId } }),
  ]);

  // 3. Unlink from retained records without deleting them.
  await db.contentReport.updateMany({
    where: { reporterUserId: userId },
    data: { reporterUserId: null },
  });
  await db.auditLog.updateMany({
    where: { actorUserId: userId, ipAddress: { not: null } },
    data: { ipAddress: null },
  });
  await db.supportRequest.updateMany({
    where: { requesterUserId: userId },
    data: { name: null, email: null },
  });

  // 4. Scrub PII embedded in retained financial records.
  const orders = await db.ticketOrder.updateMany({
    where: { buyerUserId: userId },
    data: {
      buyerName: ANON_NAME,
      buyerEmail: ANON_EMAIL,
      transferredToEmail: null,
      locationCity: null,
      locationStateRegion: null,
      locationCountry: null,
      locationPostalCode: null,
      buyerUserId: null,
    },
  });
  let ticketsScrubbed = 0;
  if (user.email) {
    const tickets = await db.ticket.updateMany({
      where: { holderEmail: { equals: user.email, mode: 'insensitive' } },
      data: { holderName: ANON_NAME, holderEmail: ANON_EMAIL },
    });
    ticketsScrubbed = tickets.count;
    await db.emailDeliveryLog.updateMany({
      where: { recipient: { equals: user.email, mode: 'insensitive' } },
      data: { recipient: 'redacted' },
    });
    await db.newsletterSubscription.deleteMany({
      where: { email: { equals: user.email, mode: 'insensitive' } },
    });
  }

  // 5. Anonymize owned profiles in place. Shows they hosted/headlined keep
  // running (profile refs are optional); AccountsPayableEntry rows stay for
  // financial audit; the public page becomes an empty husk. The Stripe
  // Connect account itself is deauthorized below so an erased identity can't
  // keep collecting future payouts.
  const profiles = await db.profile.findMany({
    where: { ownerId: userId },
    select: { id: true, hexId: true, stripeConnectAccountId: true },
  });
  let mediaAssetsDeleted = 0;
  let stripeConnectDeauthorized = 0;
  const stripeConnectNeedsManualReview: string[] = [];
  for (const profile of profiles) {
    let connectAccountCleared = false;
    if (profile.stripeConnectAccountId && isStripeConfigured()) {
      try {
        await deauthorizeStripeConnectAccount(profile.stripeConnectAccountId);
        stripeConnectDeauthorized += 1;
        connectAccountCleared = true;
      } catch (err) {
        // Stripe refuses deletion with an outstanding balance/pending payout
        // — surface for manual review rather than silently retrying forever.
        log.error('[privacy-actions]', err instanceof Error ? err : { err: String(err) }, 'Stripe Connect deauthorization failed');
        stripeConnectNeedsManualReview.push(profile.hexId);
      }
    }
    const assets = await db.artistMediaAsset.findMany({
      where: { profileId: profile.id },
      select: { id: true, storageKey: true },
    });
    for (const asset of assets) {
      if (asset.storageKey) {
        await deleteMediaFile(asset.storageKey).catch((err: unknown) => {
          log.error('[privacy-actions]', err instanceof Error ? err : { err: String(err) }, 'R2 delete failed');
        });
      }
    }
    const deletedAssets = await db.artistMediaAsset.deleteMany({ where: { profileId: profile.id } });
    mediaAssetsDeleted += deletedAssets.count;

    await Promise.all([
      db.artistJournalPost.deleteMany({ where: { profileId: profile.id } }),
      db.setlistTemplate.deleteMany({ where: { profileId: profile.id } }),
      db.availabilityDate.deleteMany({ where: { profileId: profile.id } }),
    ]);

    await db.profile.update({
      where: { id: profile.id },
      data: {
        name: 'Deleted account',
        slug: `deleted-${profile.hexId.toLowerCase()}`,
        headline: null,
        bio: null,
        aboutContent: null,
        journalContent: null,
        mediaContent: null,
        tourContent: null,
        merchContent: null,
        requestContent: null,
        recommendContent: null,
        pressKitContent: null,
        topFiveContent: null,
        widgetConfig: null,
        pageDraft: null,
        pagePublished: null,
        addressLine1: null,
        contactInfo: null,
        hoursText: null,
        hometown: null,
        city: null,
        stateRegion: null,
        country: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        heroImage: null,
        avatarImage: null,
        logoImage: null,
        galleryImage: null,
        featureVideoUrl: null,
        companionSpriteSheet: null,
        links: null,
        merchUrl: null,
        genres: [],
        genre: null,
        parkingDetails: null,
        stayRecommendations: null,
        upcomingContent: null,
        previousShowHighlights: null,
        fanShareEnabled: false,
        ...(connectAccountCleared
          ? { stripeConnectAccountId: null, stripeConnectOnboarded: false }
          : {}),
      },
    });
  }

  // 6. Reduce the User row to a shell and kill every live session.
  await db.user.update({
    where: { id: userId },
    data: {
      name: null,
      email: null,
      phone: null,
      image: null,
      username: `deleted-${userId.slice(-12)}`,
      passwordHash: null,
      emailVerified: null,
      mfaSecret: null,
      mfaBackupCodes: null,
      mfaEnabledAt: null,
      storedPaymentTokenRef: null,
      storedPaymentTokenBrand: null,
      storedPaymentTokenLast4: null,
      stripeCustomerId: null,
      lastLoginCountry: null,
      lastLoginAt: null,
      adminDeviceTokenHash: null,
      adminDeviceSetAt: null,
      pageLayout: [],
      emailBounced: true,
      userSecurityVersion: { increment: 1 },
    },
  });

  await recordAuditEvent({
    actorUserId,
    action: 'privacy_deletion_executed',
    entityType: 'user',
    entityId: userId,
    metadata: {
      profilesAnonymized: profiles.length,
      mediaAssetsDeleted,
      ticketOrdersScrubbed: orders.count,
      ticketsScrubbed,
      stripeConnectDeauthorized,
      stripeConnectNeedsManualReview,
    },
  });

  return {
    profilesAnonymized: profiles.length,
    mediaAssetsDeleted,
    ticketOrdersScrubbed: orders.count,
    ticketsScrubbed,
    stripeConnectDeauthorized,
    stripeConnectNeedsManualReview,
  };
}
