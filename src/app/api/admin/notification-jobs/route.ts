import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const jobs = await db.notificationJob.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 100,
    select: {
      id: true,
      type: true,
      entityId: true,
      status: true,
      attempts: true,
      nextAttemptAt: true,
      lastError: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
