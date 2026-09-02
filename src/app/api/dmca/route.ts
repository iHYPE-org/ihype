import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { getAdminAlertRecipients } from '@/lib/env';
import { sendOperationalEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

export const dynamic = 'force-dynamic';

/**
 * A DMCA notice FILES A REPORT FOR A HUMAN. It does not arm anything.
 *
 * Until 2026-09-02 this route — unauthenticated, three posts a day per IP —
 * set `dmcaStatus: 'PENDING'` and a ten-day `dmcaDeadline` on any show whose
 * slug appeared in the URL, and the `dmca-enforce` cron then flipped every
 * show past its deadline to CANCELED with no refund, no counter-notice and no
 * admin step anywhere in between: nothing else in the codebase ever wrote
 * `dmcaStatus`. Anyone could cancel a competitor's ticketed show by filling in
 * a form and waiting. Found by the security sweep.
 *
 * Now the notice becomes a `ContentReport` (`reason: 'dmca_notice'`) in the
 * moderation queue the admin already works, the rights holder's details go
 * into the audit log as before, the content owner is told, and the admin is
 * emailed — a takedown has a legal clock, so it must not wait for the daily
 * digest. Approving the report in `/admin` is what removes the content, through
 * `enforceRemoval()`. The cron still exists for a show an admin has marked
 * `dmcaStatus: 'CONFIRMED'` by hand and given a deadline; nothing here sets it.
 */
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
  const claimant = {
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    url: String(url).slice(0, 500),
    description: String(description).slice(0, 5000),
  };

  await recordAuditEvent({
    action: 'dmca_request',
    entityType: 'dmca',
    actorUserId: session?.user?.id ?? undefined,
    ipAddress: ip,
    metadata: claimant,
  });

  // Match the URL to a show or profile so the report points at something the
  // queue can act on. An unmatched URL still files a report ('url' target) —
  // the notice was received either way and the admin has to answer it.
  let target: { type: string; id: string; ownerUserId: string | null; label: string } = {
    type: 'url',
    id: claimant.url,
    ownerUserId: null,
    label: claimant.url,
  };
  try {
    const showSlugMatch = claimant.url.match(/\/(?:shows?|s)\/([a-z0-9-]+)/i);
    if (showSlugMatch) {
      const show = await db.show.findUnique({
        where: { slug: showSlugMatch[1] },
        select: { id: true, creatorId: true, title: true },
      });
      if (show) target = { type: 'show', id: show.id, ownerUserId: show.creatorId, label: show.title };
    } else {
      const profileSlugMatch = claimant.url.match(/\/(?:p\/)?([a-z0-9-]+)(?:\/|$)/i);
      if (profileSlugMatch) {
        const profile = await db.profile.findUnique({
          where: { slug: profileSlugMatch[1] },
          select: { id: true, ownerId: true, name: true },
        });
        if (profile) target = { type: 'profile', id: profile.id, ownerUserId: profile.ownerId, label: profile.name };
      }
    }

  } catch (err) {
    log.error('[dmca]', err instanceof Error ? err : { error: String(err) }, 'resolving the DMCA target failed');
  }

  // The report IS the receipt. If it cannot be filed the claimant must not be
  // told it was received — a notice that reached nobody has a legal clock too.
  try {
    await db.contentReport.create({
      data: {
        targetType: target.type,
        targetId: target.id,
        reason: 'dmca_notice',
        details: `DMCA notice from ${claimant.name} <${claimant.email}> about ${claimant.url}\n\n${claimant.description}`,
        reporterUserId: session?.user?.id ?? null,
      },
    });
  } catch (err) {
    log.error('[dmca]', err instanceof Error ? err : { error: String(err) }, 'filing the DMCA report failed');
    return NextResponse.json({ error: 'We could not record your notice. Please email admin@ihype.org.' }, { status: 500 });
  }

  try {

    if (target.ownerUserId) {
      await db.notification.create({
        data: {
          userId: target.ownerUserId,
          type: 'DMCA_NOTICE',
          body: target.type === 'show'
            ? 'A DMCA notice has been filed against your show. iHYPE is reviewing it and will contact you.'
            : 'A DMCA notice has been filed referencing your profile. iHYPE is reviewing it and will contact you.',
          link: '/app/me',
        },
      });
    }

    await sendOperationalEmail(
      {
        to: getAdminAlertRecipients(),
        subject: `[iHYPE] DMCA notice received — ${target.type} ${target.label}`.slice(0, 200),
        text: [
          `A DMCA notice was filed and is waiting in the moderation queue (/admin/moderation).`,
          '',
          `Target: ${target.type} — ${target.label}`,
          `URL named: ${claimant.url}`,
          `Claimant: ${claimant.name} <${claimant.email}>`,
          '',
          claimant.description,
        ].join('\n'),
        html: `<p>A DMCA notice was filed and is waiting in the <a href="https://ihype.org/admin/moderation">moderation queue</a>.</p>
<p><strong>Target:</strong> ${escapeHtml(target.type)} — ${escapeHtml(target.label)}<br/>
<strong>URL named:</strong> ${escapeHtml(claimant.url)}<br/>
<strong>Claimant:</strong> ${escapeHtml(claimant.name)} &lt;${escapeHtml(claimant.email)}&gt;</p>
<pre style="white-space:pre-wrap">${escapeHtml(claimant.description)}</pre>`,
      },
      'dmca-notice',
    );
  } catch (err) {
    log.error('[dmca]', err instanceof Error ? err : { error: String(err) }, 'notifying about the DMCA report failed');
  }

  return NextResponse.json({ ok: true });
}
