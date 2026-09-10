import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyNewsletterUnsubscribeToken } from '@/lib/newsletter-unsubscribe';
import { escapeHtml } from '@/lib/html-escape';

export const dynamic = 'force-dynamic';

/* The way out for someone with no account. `/api/email/unsubscribe` turns a
   member's toggles off; this deletes the subscription row, because a
   subscription IS the consent and there is no preferences page behind it for
   a person who never signed up. Deliberately idempotent: a second click, or
   a mail client that fetches the link, must read as success rather than
   "invalid", or the reader believes they are still subscribed. */
function htmlPage(rawHeading: string, rawBody: string, status: number) {
  const heading = escapeHtml(rawHeading);
  const body = escapeHtml(rawBody);
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${heading} — iHYPE</title>
  </head>
  <body style="margin:0;background:var(--bg);color:#eef1f6;font-family:Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
      <h1 style="font-size:28px;margin:0 0 12px;">${heading}</h1>
      <p style="margin:0 0 24px;color:#9a948c;line-height:1.5;">${body}</p>
      <a href="https://ihype.org" style="color:var(--accent);">Back to iHYPE →</a>
    </div>
  </body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

// Must work logged-out: the token alone authorizes the change.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const subscriptionId = verifyNewsletterUnsubscribeToken(token);
  if (!subscriptionId) {
    return htmlPage('Invalid link', 'This unsubscribe link is invalid or incomplete.', 400);
  }

  await db.newsletterSubscription.deleteMany({ where: { id: subscriptionId } });

  return htmlPage(
    "You're unsubscribed.",
    'You will not receive any more updates from this profile. Nothing else about your address is kept for this list.',
    200
  );
}

// RFC 8058 one-click unsubscribe: mail clients POST to the List-Unsubscribe URL.
export async function POST(request: NextRequest) {
  return GET(request);
}
