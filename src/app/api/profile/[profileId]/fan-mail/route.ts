import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { profileId } = await params;

  // Verify profile ownership
  const profile = await db.profile.findUnique({
    where: { id: profileId, ownerId: session.user.id },
    select: { id: true, name: true, fanMailLastSentAt: true },
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found or not yours.' }, { status: 403 });

  // Rate limit: 1 per 7 days
  if (profile.fanMailLastSentAt) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (profile.fanMailLastSentAt > sevenDaysAgo) {
      const nextAllowed = new Date(profile.fanMailLastSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      return NextResponse.json({ error: `You can send fan mail again after ${nextAllowed.toLocaleDateString()}.` }, { status: 429 });
    }
  }

  let body: { subject?: unknown; content?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const subject = typeof body.subject === 'string' ? body.subject.slice(0, 100).trim() : '';
  const content = typeof body.content === 'string' ? body.content.slice(0, 2000).trim() : '';
  if (!subject || !content) {
    return NextResponse.json({ error: 'subject and content are required.' }, { status: 400 });
  }

  // Get followers
  const follows = await db.follow.findMany({
    where: { followeeProfileId: profileId },
    include: { follower: { select: { email: true, emailBounced: true } } },
  });

  const recipients = follows
    .map(f => f.follower)
    .filter(u => u.email && !u.emailBounced);

  let sent = 0;
  for (const user of recipients) {
    if (!user.email) continue;
    try {
      await sendGenericEmail({
        to: user.email,
        subject: `${profile.name}: ${subject}`,
        text: content,
        html: `<p style="white-space:pre-wrap">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><hr><p><small>You received this because you follow ${profile.name} on iHYPE. <a href="https://ihype.org">ihype.org</a></small></p>`,
      });
      sent++;
    } catch { /* continue */ }
  }

  await db.profile.update({
    where: { id: profileId },
    data: { fanMailLastSentAt: new Date() },
  });

  return NextResponse.json({ ok: true, sent });
}
