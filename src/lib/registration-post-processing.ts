import { recordAuditEvent } from '@/lib/audit';
import { checkAndAwardBadges } from '@/lib/badges';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendGenericEmail } from '@/lib/mailer';
import { sendDay1Email } from '@/lib/onboarding-emails';
import { checkForSpam } from '@/lib/spam-detection';
import { awardHype } from '@/lib/hype-ledger';

type RegistrationUser = {
  id: string;
  username: string;
};

async function checkRegistrationSpam({
  user,
  clientAddress,
  text,
}: {
  user: RegistrationUser;
  clientAddress: string | null;
  text: string;
}) {
  if (text.length <= 20) return;
  const spamResult = await checkForSpam(text, 'registration profile content');
  if (spamResult.isSpam && spamResult.confidence > 0.85) {
    await recordAuditEvent({
      actorUserId: user.id,
      action: 'account_flagged_spam',
      entityType: 'user',
      entityId: user.id,
      ipAddress: clientAddress,
      metadata: { confidence: spamResult.confidence },
    });
  }
}

/**
 * Resolves a `ref` value (a username, or a Profile.hexId from a personal
 * /invite/[code] link) to the real user behind it. Shared by the referral
 * crediting below and by /api/register's invite-only-signup gate — a
 * personal invite link only ever identifies a real existing account, so
 * unlike an admin-minted InviteCode it's inherently reusable and never
 * "claimed"/consumed.
 */
export async function resolveReferrer(refValue: string) {
  const refUser = await db.user.findUnique({
    where: { username: refValue },
    select: {
      id: true,
      username: true,
      isEighteenOrOlder: true,
      profiles: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });

  if (refUser) {
    return {
      resolvedUsername: refUser.username,
      referrerId: refUser.id,
      referrerIsAdult: refUser.isEighteenOrOlder,
      referrerProfileId: refUser.profiles[0]?.id ?? null,
    };
  }

  const refProfile = await db.profile.findUnique({
    where: { hexId: refValue },
    select: { id: true, owner: { select: { id: true, username: true, isEighteenOrOlder: true } } },
  });
  if (refProfile?.owner) {
    return {
      resolvedUsername: refProfile.owner.username,
      referrerId: refProfile.owner.id,
      referrerIsAdult: refProfile.owner.isEighteenOrOlder,
      referrerProfileId: refProfile.id,
    };
  }

  return null;
}

async function processReferral(user: RegistrationUser, refValue: string) {
  const resolved = await resolveReferrer(refValue);
  const resolvedUsername = resolved?.resolvedUsername ?? null;
  const referrerId = resolved?.referrerId ?? null;
  const referrerProfileId = resolved?.referrerProfileId ?? null;
  const referrerIsAdult = resolved?.referrerIsAdult ?? false;

  if (!resolvedUsername || !referrerId || referrerId === user.id) return;

  // Referring is 18+. The API won't hand out a HYPE link without the
  // attestation, but a link learned earlier still resolves — the new signup
  // proceeds, the un-attested referrer just earns no credit for it.
  if (!referrerIsAdult) return;

  await recordAuditEvent({
    actorUserId: null,
    action: 'REFERRAL_SIGNUP',
    entityType: 'User',
    entityId: user.id,
    metadata: { referrer: resolvedUsername, referrerHexId: refValue },
  });

  await awardHype({
    userId: referrerId,
    amount: 10,
    source: 'FAN_REFERRED',
    idempotencyKey: `fan-referred:${user.id}`,
    targetType: 'user',
    targetId: user.id,
    dailyLimit: 50,
    metadata: { referredUsername: user.username },
  });

  if (referrerProfileId) {
    await db.$transaction([
      db.profileHypeEvent.create({ data: { userId: user.id, profileId: referrerProfileId } }),
      db.profile.update({
        where: { id: referrerProfileId },
        data: { hypeCount: { increment: 1 } },
      }),
    ]);
  }

  await checkAndAwardBadges(referrerId, { referrerUsername: resolvedUsername });

  const totalReferrals = await db.auditLog.count({
    where: {
      action: 'REFERRAL_SIGNUP',
      metadata: { path: ['referrer'], equals: resolvedUsername },
    },
  });
  if (![1, 5, 10, 25].includes(totalReferrals)) return;

  const referrerUser = await db.user.findUnique({
    where: { id: referrerId },
    select: { email: true, name: true },
  });
  if (!referrerUser?.email) return;

  await sendGenericEmail({
    to: referrerUser.email,
    subject: `You've referred ${totalReferrals} ${totalReferrals === 1 ? 'person' : 'people'} to iHYPE!`,
    text: `Congrats! You've now referred ${totalReferrals} ${totalReferrals === 1 ? 'person' : 'people'} to iHYPE. Keep sharing your link to earn more rewards!`,
    html: `<p>Congrats${referrerUser.name ? `, ${referrerUser.name}` : ''}!</p><p>You've now brought <strong>${totalReferrals} ${totalReferrals === 1 ? 'person' : 'people'}</strong> to iHYPE. Keep sharing to earn more XP and unlock badges!</p>`,
  });
}

export async function runRegistrationPostProcessing({
  user,
  clientAddress,
  spamText,
  referral,
}: {
  user: RegistrationUser;
  clientAddress: string | null;
  spamText: string;
  referral?: string;
}) {
  const tasks: Array<Promise<unknown>> = [
    sendDay1Email(user.id),
    awardHype({
      userId: user.id,
      amount: 3,
      source: 'WELCOME',
      idempotencyKey: `welcome:${user.id}`,
      targetType: 'user',
      targetId: user.id,
    }),
  ];
  if (spamText.length > 20) tasks.push(checkRegistrationSpam({ user, clientAddress, text: spamText }));
  if (referral) tasks.push(processReferral(user, referral));

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      log.error(
        '[register/post-processing]',
        result.reason instanceof Error ? result.reason : null,
        'Registration follow-up failed',
      );
    }
  }
}
