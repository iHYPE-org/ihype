import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { runAI } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ reason: null });

  const profile = await db.profile.findFirst({
    where: { ownerId: session.user.id },
    select: { genres: true, genre: true, type: true },
  });

  const genres = [...(profile?.genres as string[] ?? []), profile?.genre]
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  const role = (profile?.type ?? 'FAN').toLowerCase();

  const reason = await runAI([{
    role: 'user',
    content: `Write one punchy sentence (under 18 words) for a ${role} on a music discovery app explaining why today is a great day to discover new${genres ? ` ${genres}` : ''} music. Friendly, specific, no hashtags.`,
  }], 60) ?? `Your next favourite track is one swipe away.`;

  return NextResponse.json({ reason: reason.trim() });
}
