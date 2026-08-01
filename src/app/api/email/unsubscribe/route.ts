import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';

export const dynamic = 'force-dynamic';

// One-click unsubscribe turns every email toggle off.
const OPT_OUT = {
  newShows: false,
  journalPosts: false,
  milestones: false,
  weeklyDigest: false
} as const;

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
  <body style="margin:0;background:var(--bg);color:#f0ebe5;font-family:Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
      <h1 style="font-size:28px;margin:0 0 12px;">${heading}</h1>
      <p style="margin:0 0 24px;color:#9a948c;line-height:1.5;">${body}</p>
      <a href="https://ihype.org/home" style="color:var(--accent);">Back to iHYPE →</a>
    </div>
  </body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

// Must work logged-out: the token alone authorizes the change.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return htmlPage('Invalid link', 'This unsubscribe link is invalid. You can manage email preferences from Settings inside iHYPE.', 400);
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return htmlPage('Invalid link', 'This unsubscribe link is no longer valid.', 400);
  }

  await db.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...OPT_OUT },
    update: OPT_OUT
  });

  return htmlPage(
    "You're unsubscribed.",
    'You will no longer receive digests, announcements, or marketing email from iHYPE. You can turn individual emails back on anytime from Settings.',
    200
  );
}

// RFC 8058 one-click unsubscribe: mail clients POST to the List-Unsubscribe URL.
export async function POST(request: NextRequest) {
  return GET(request);
}
