import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function htmlPage(heading: string, body: string, status: number) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${heading} — iHYPE</title>
  </head>
  <body style="margin:0;background:#0a0805;color:#f0ebe5;font-family:Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
      <h1 style="font-size:28px;margin:0 0 12px;">${heading}</h1>
      <p style="margin:0 0 24px;color:#9a948c;line-height:1.5;">${body}</p>
      <a href="https://ihype.org/home" style="color:#ff5029;">Back to iHYPE →</a>
    </div>
  </body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

// Double opt-in confirm link. Token alone authorizes — must work logged-out.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return htmlPage('Invalid link', 'This confirmation link is missing its token.', 400);

  const subscription = await db.newsletterSubscription.findUnique({
    where: { confirmToken: token },
    select: { id: true, confirmedAt: true, confirmTokenExpiresAt: true, profile: { select: { name: true } } },
  });

  if (!subscription) return htmlPage('Link not found', 'This confirmation link is invalid or has already been used.', 404);

  if (subscription.confirmedAt) {
    return htmlPage('Already confirmed', `You're already subscribed to updates from ${subscription.profile.name}.`, 200);
  }

  if (!subscription.confirmTokenExpiresAt || subscription.confirmTokenExpiresAt < new Date()) {
    return htmlPage('Link expired', 'This confirmation link has expired. Subscribe again to get a fresh one.', 410);
  }

  await db.newsletterSubscription.update({
    where: { id: subscription.id },
    data: { confirmedAt: new Date(), confirmToken: null, confirmTokenExpiresAt: null },
  });

  return htmlPage('Subscribed!', `You're confirmed for updates from ${subscription.profile.name}.`, 200);
}
