import { Prisma } from '@prisma/client/edge';
import { db } from '@/lib/db';

type LedgerTarget = {
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

type AwardOptions = LedgerTarget & {
  userId: string;
  amount: number;
  source: string;
  idempotencyKey: string;
  dailyLimit?: number;
};

type HypeLedgerTx = Pick<typeof db, 'user' | 'hypeLedgerEntry'>;

export class InsufficientHypeError extends Error {
  constructor() {
    super('Not enough HYPE. Listen, attend, or refer a fan to earn more.');
    this.name = 'InsufficientHypeError';
  }
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function applyHypeEntry(
  tx: HypeLedgerTx,
  options: AwardOptions,
) {
  if (!Number.isInteger(options.amount) || options.amount === 0) {
    throw new Error('HYPE ledger amount must be a non-zero integer.');
  }

  const existing = await tx.hypeLedgerEntry.findUnique({
    where: { idempotencyKey: options.idempotencyKey },
  });
  if (existing) return { entry: existing, applied: false };

  let amount = options.amount;
  if (amount > 0 && options.dailyLimit) {
    const awarded = await tx.hypeLedgerEntry.aggregate({
      where: {
        userId: options.userId,
        source: options.source,
        amount: { gt: 0 },
        createdAt: { gte: startOfUtcDay() },
      },
      _sum: { amount: true },
    });
    amount = Math.min(amount, Math.max(0, options.dailyLimit - (awarded._sum.amount ?? 0)));
    if (amount === 0) return { entry: null, applied: false };
  }

  if (amount < 0) {
    const charged = await tx.user.updateMany({
      where: { id: options.userId, hypeBalance: { gte: Math.abs(amount) } },
      data: { hypeBalance: { increment: amount } },
    });
    if (charged.count !== 1) throw new InsufficientHypeError();
  } else {
    await tx.user.update({
      where: { id: options.userId },
      data: { hypeBalance: { increment: amount } },
    });
  }

  const user = await tx.user.findUniqueOrThrow({
    where: { id: options.userId },
    select: { hypeBalance: true },
  });
  const entry = await tx.hypeLedgerEntry.create({
    data: {
      userId: options.userId,
      amount,
      balanceAfter: user.hypeBalance,
      source: options.source,
      targetType: options.targetType,
      targetId: options.targetId,
      idempotencyKey: options.idempotencyKey,
      metadata: options.metadata,
    },
  });
  return { entry, applied: true };
}

export async function awardHype(options: AwardOptions) {
  try {
    return await db.$transaction(
      (tx) => applyHypeEntry(tx, options),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const entry = await db.hypeLedgerEntry.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      return { entry, applied: false };
    }
    throw error;
  }
}
