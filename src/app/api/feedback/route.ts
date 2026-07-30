import { Prisma } from '@prisma/client/edge';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const voteSchema = z.object({
  action: z.literal('vote'),
  id: z.string().cuid(),
});

const proposalSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(12).max(2000),
});

async function getFan(userId: string | undefined) {
  if (!userId) return null;
  return db.user.findFirst({
    where: { id: userId, role: 'FAN' },
    select: { id: true },
  });
}

export async function GET() {
  const session = await auth();
  const fan = await getFan(session?.user?.id);
  const requests = await db.featureRequest.findMany({
    where: { status: { not: 'declined' } },
    orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      featureVotes: {
        where: { userId: fan?.id ?? '__anonymous__' },
        select: { id: true },
        take: 1,
      },
    },
  });
  const now = Date.now();
  return NextResponse.json({
    eligible: Boolean(fan),
    requests: requests.map((request) => ({
      id: request.id,
      title: request.title,
      description: request.description,
      votes: request.votes,
      status: request.status,
      createdAt: request.createdAt,
      votingOpensAt: request.votingOpensAt,
      votingClosesAt: request.votingClosesAt,
      quorumRequired: request.quorumRequired,
      quorumMet: request.votes >= request.quorumRequired,
      resultPublishedAt: request.resultPublishedAt,
      securityException: request.securityException,
      securityExceptionNote: request.securityExceptionNote,
      hasVoted: fan ? request.featureVotes.length > 0 : false,
      votingOpen:
        request.status === 'open'
        && request.votingOpensAt.getTime() <= now
        && (!request.votingClosesAt || request.votingClosesAt.getTime() > now),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const fan = await getFan(session?.user?.id);
  if (!fan) {
    return NextResponse.json(
      { error: 'A fan account is required to propose or vote on product changes.' },
      { status: 403 },
    );
  }

  const ip = readClientAddress(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const vote = voteSchema.safeParse(body);
  if (vote.success) {
    const rateLimit = await consumeRateLimit(
      rateLimitKey('community-vote', fan.id, ip),
      { limit: 30, windowMs: 60 * 60 * 1000 },
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many vote attempts.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const proposal = await db.featureRequest.findUnique({
      where: { id: vote.data.id },
      select: { id: true, status: true, votingOpensAt: true, votingClosesAt: true },
    });
    const now = new Date();
    if (
      !proposal
      || proposal.status !== 'open'
      || proposal.votingOpensAt > now
      || (proposal.votingClosesAt && proposal.votingClosesAt <= now)
    ) {
      return NextResponse.json({ error: 'Voting is closed for this proposal.' }, { status: 409 });
    }

    try {
      const updated = await db.$transaction(async (tx) => {
        await tx.featureVote.create({
          data: { featureRequestId: proposal.id, userId: fan.id },
        });
        return tx.featureRequest.update({
          where: { id: proposal.id },
          data: { votes: { increment: 1 } },
          select: { votes: true, quorumRequired: true },
        });
      });
      await recordAuditEvent({
        actorUserId: fan.id,
        action: 'community_vote_cast',
        entityType: 'FeatureRequest',
        entityId: proposal.id,
        ipAddress: ip,
      });
      return NextResponse.json({
        ok: true,
        votes: updated.votes,
        quorumMet: updated.votes >= updated.quorumRequired,
        hasVoted: true,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'You already voted on this proposal.' }, { status: 409 });
      }
      throw error;
    }
  }

  const proposal = proposalSchema.safeParse(body);
  if (!proposal.success) {
    return NextResponse.json(
      { error: proposal.error.issues[0]?.message ?? 'Invalid proposal.' },
      { status: 400 },
    );
  }

  const rateLimit = await consumeRateLimit(
    rateLimitKey('community-proposal', fan.id, ip),
    { limit: 2, windowMs: 24 * 60 * 60 * 1000 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'You can submit two proposals per day.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const created = await db.featureRequest.create({
    data: {
      userId: fan.id,
      title: proposal.data.title,
      description: proposal.data.description,
      votingClosesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      quorumRequired: 1,
    },
  });
  await recordAuditEvent({
    actorUserId: fan.id,
    action: 'community_proposal_created',
    entityType: 'FeatureRequest',
    entityId: created.id,
    ipAddress: ip,
  });
  return NextResponse.json({ ok: true, request: created }, { status: 201 });
}
