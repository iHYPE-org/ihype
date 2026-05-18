import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { username: true } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';
  const referralLink = `${baseUrl}/register?ref=${user.username}`;

  // Count referrals (users who signed up with this ref code — stored in AuditLog)
  const referralCount = await db.auditLog.count({
    where: {
      action: 'REFERRAL_SIGNUP',
      metadata: { path: ['referrer'], equals: user.username }
    }
  });

  return NextResponse.json({ referralLink, referralCount });
}
