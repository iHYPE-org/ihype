import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notify';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // 24h window: shows starting in 24h ± 30min
    const h24Low  = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const h24High = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    // 1h window: shows starting in 1h ± 15min
    const h1Low  = new Date(now.getTime() + 45 * 60 * 1000);
    const h1High = new Date(now.getTime() + 75 * 60 * 1000);

    const [shows24h, shows1h] = await Promise.all([
      db.show.findMany({
        where: { startsAt: { gte: h24Low, lte: h24High }, status: 'SCHEDULED' },
        include: {
          rsvps: { include: { user: { select: { id: true, email: true, emailBounced: true } } } },
          venueProfile: { select: { name: true } },
        },
      }),
      db.show.findMany({
        where: { startsAt: { gte: h1Low, lte: h1High }, status: 'SCHEDULED' },
        include: {
          rsvps: { include: { user: { select: { id: true } } } },
          venueProfile: { select: { name: true } },
        },
      }),
    ]);

    let sent24 = 0;
    let sent1 = 0;

    // 24h reminders: push + email
    for (const show of shows24h) {
      const venueName = show.venueProfile?.name ?? 'Unknown venue';
      const dateStr = new Date(show.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

      for (const rsvp of show.rsvps) {
        const userId = rsvp.userId;
        const dedupKey = `rsvp-24h:${show.id}:${userId}`;

        // Deduplicate using Notification table
        const existing = await db.notification.findFirst({
          where: { userId, type: dedupKey },
        });
        if (existing) continue;

        await sendPushNotification(userId, {
          title: `Tomorrow: ${show.title}`,
          body: `${show.title} @ ${venueName} on ${dateStr}`,
          url: `/shows/${show.slug}`,
        });

        if (rsvp.user.email && !rsvp.user.emailBounced) {
          await sendGenericEmail({
            to: rsvp.user.email,
            subject: `Reminder: ${show.title} is tomorrow`,
            text: `Your show "${show.title}" at ${venueName} is tomorrow (${dateStr}). See you there!\n\nhttps://ihype.org/shows/${show.slug}`,
            html: `<p>Your show <strong>${show.title}</strong> at ${venueName} is <strong>tomorrow (${dateStr})</strong>.</p><p><a href="https://ihype.org/shows/${show.slug}">View on iHYPE →</a></p>`,
          }).catch(() => {});
        }

        await db.notification.create({
          data: { userId, type: dedupKey, body: `Tomorrow: ${show.title} @ ${venueName}`, link: `/shows/${show.slug}` },
        });

        sent24++;
      }
    }

    // 1h reminders: push only
    for (const show of shows1h) {
      const venueName = show.venueProfile?.name ?? 'Unknown venue';

      for (const rsvp of show.rsvps) {
        const userId = rsvp.userId;
        const dedupKey = `rsvp-1h:${show.id}:${userId}`;

        const existing = await db.notification.findFirst({
          where: { userId, type: dedupKey },
        });
        if (existing) continue;

        await sendPushNotification(userId, {
          title: `Starting soon: ${show.title}`,
          body: `${show.title} @ ${venueName} is in 1 hour!`,
          url: `/shows/${show.slug}`,
        });

        await db.notification.create({
          data: { userId, type: dedupKey, body: `Starting soon: ${show.title} is in 1 hour!`, link: `/shows/${show.slug}` },
        });

        sent1++;
      }
    }

    return NextResponse.json({ ok: true, sent24h: sent24, sent1h: sent1 });
  } catch (err) {
    console.error('[cron/rsvp-reminders] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
