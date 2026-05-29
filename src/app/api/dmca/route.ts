import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`dmca:${ip}`, { limit: 3, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });

  let body: { name?: string; email?: string; url?: string; description?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { name, email, url, description } = body;
  if (!name || !email || !url || !description) {
    return NextResponse.json({ error: 'name, email, url, and description are required.' }, { status: 400 });
  }

  const session = await auth();

  await recordAuditEvent({
    action: 'dmca_request',
    entityType: 'dmca',
    actorUserId: session?.user?.id ?? undefined,
    ipAddress: ip,
    metadata: {
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      url: String(url).slice(0, 500),
      description: String(description).slice(0, 5000)
    }
  });

  // Try to match URL to a show or profile slug and flag it
  try {
    const urlStr = String(url);
    const dmcaDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    // Check for show slug pattern: /shows/<slug> or /s/<slug>
    const showSlugMatch = urlStr.match(/\/(?:shows?|s)\/([a-z0-9-]+)/i);
    if (showSlugMatch) {
      const slug = showSlugMatch[1];
      const show = await db.show.findUnique({ where: { slug }, select: { id: true, creatorId: true } });
      if (show) {
        await db.show.update({
          where: { id: show.id },
          data: { dmcaDeadline, dmcaStatus: 'PENDING' },
        });
        // Notify content owner
        await db.notification.create({
          data: {
            userId: show.creatorId,
            type: 'DMCA_NOTICE',
            body: 'A DMCA notice has been filed against your show. You have 10 days to respond.',
            link: `/home`,
          },
        });
      }
    }

    // Check for profile slug pattern: /<slug> or /p/<slug>
    const profileSlugMatch = urlStr.match(/\/(?:p\/)?([a-z0-9-]+)(?:\/|$)/i);
    if (!showSlugMatch && profileSlugMatch) {
      const slug = profileSlugMatch[1];
      const profile = await db.profile.findUnique({ where: { slug }, select: { id: true, ownerId: true } });
      if (profile) {
        await db.notification.create({
          data: {
            userId: profile.ownerId,
            type: 'DMCA_NOTICE',
            body: 'A DMCA notice has been filed referencing your profile. Please review.',
            link: `/home`,
          },
        });
      }
    }
  } catch (err) {
    console.error('[dmca] post-audit notification failed', err);
  }

  return NextResponse.json({ ok: true });
}
