import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notify';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// Workers queue outbound connections beyond 6, so this only bounds memory and
// keeps a single bad batch from consuming the whole wall-clock budget.
const SEND_CHUNK_SIZE = 25;
const DEDUP_QUERY_CHUNK_SIZE = 500;

type RecapTask = {
  userId: string;
  dedupKey: string;
  notificationBody: string;
  link: string;
  push: { title: string; body: string; url: string };
  email?: { to: string; subject: string; text: string; html: string };
};

// The dedup key embeds show + user, so matching on `type` alone is exact.
async function filterAlreadyNotified(tasks: RecapTask[]): Promise<RecapTask[]> {
  const pending: RecapTask[] = [];
  for (let i = 0; i < tasks.length; i += DEDUP_QUERY_CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + DEDUP_QUERY_CHUNK_SIZE);
    const existing = await db.notification.findMany({
      where: { type: { in: chunk.map((t) => t.dedupKey) } },
      select: { type: true },
    });
    const seen = new Set(existing.map((n) => n.type));
    pending.push(...chunk.filter((t) => !seen.has(t.dedupKey)));
  }
  return pending;
}

async function deliver(tasks: RecapTask[]): Promise<number> {
  let sent = 0;
  for (let i = 0; i < tasks.length; i += SEND_CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + SEND_CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map(async (task) => {
        await sendPushNotification(task.userId, task.push).catch(() => {});
        if (task.email) {
          await sendGenericEmail(task.email).catch(() => {});
        }
      })
    );
    await db.notification.createMany({
      data: chunk.map((t) => ({ userId: t.userId, type: t.dedupKey, body: t.notificationBody, link: t.link })),
    });
    sent += chunk.length;
  }
  return sent;
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Shows that ended between 30h ago and 6h ago
    const endedAfter  = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    const endedBefore = new Date(now.getTime() -  6 * 60 * 60 * 1000);

    const shows = await db.show.findMany({
      where: {
        status: 'ENDED',
        startsAt: { gte: endedAfter, lte: endedBefore },
      },
      include: {
        rsvps: { include: { user: { select: { id: true, email: true, emailBounced: true } } } },
        venueProfile: { select: { name: true } },
      },
    });

    const tasks: RecapTask[] = shows.flatMap((show) => {
      const venueName = show.venueProfile?.name ?? 'Unknown venue';

      return show.rsvps.map((rsvp): RecapTask => ({
        userId: rsvp.userId,
        dedupKey: `post-show:${show.id}:${rsvp.userId}`,
        notificationBody: `How was ${show.title}? Leave a hype, check the setlist, or tip the artist.`,
        link: `/shows/${show.slug}`,
        push: {
          title: `How was ${show.title}?`,
          body: 'Leave a hype, check the setlist, or tip the artist',
          url: `/shows/${show.slug}`,
        },
        email: rsvp.user.email && !rsvp.user.emailBounced
          ? {
              to: rsvp.user.email,
              subject: `How was ${show.title}?`,
              text: `Hope you had a great time at ${show.title} @ ${venueName}! Leave a hype, check the setlist, or tip the artist.\n\nhttps://ihype.org/shows/${show.slug}`,
              html: `<p>Hope you had a great time at <strong>${show.title}</strong> @ ${venueName}!</p><p>Leave a hype, check the setlist, or tip the artist.</p><p><a href="https://ihype.org/shows/${show.slug}">View on iHYPE →</a></p>`,
            }
          : undefined,
      }));
    });

    const pending = await filterAlreadyNotified(tasks);
    const sent = await deliver(pending);

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error('[cron/post-show-recap] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
