import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { getBaseUrl } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientAddress = readClientAddress(request);
  const rl = await consumeRateLimit(`verify-req:${session.user.id}`, { limit: 2, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Please wait 24h between verification requests.' }, { status: 429 });

  let parsed: { profileId?: string; socialLinks?: string; notes?: string };
  try { parsed = await request.json() as typeof parsed; } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const { profileId, socialLinks, notes } = parsed;

  const profile = await db.profile.findFirst({
    where: { id: profileId, ownerId: session.user.id },
    select: { id: true, name: true, verificationStatus: true }
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  if (profile.verificationStatus === 'VERIFIED') return NextResponse.json({ error: 'Already verified.' }, { status: 400 });

  await db.profile.update({
    where: { id: profileId },
    data: { verificationStatus: 'PENDING', verificationRequested: true, verificationSubmittedAt: new Date(), verificationNotes: notes ?? null }
  });

  const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? 'admin@ihype.org';
  await sendGenericEmail({ to: ADMIN_EMAIL, subject: `[iHYPE] Verification request: ${profile.name}`, html: `<p><strong>${profile.name}</strong> requested verification.</p><p>Social links: ${socialLinks}</p><p>Notes: ${notes ?? 'none'}</p><p><a href="${getBaseUrl()}/admin/review">Review in admin</a></p>`, text: `${profile.name} requested verification.\nSocial: ${socialLinks}` });

  return NextResponse.json({ ok: true, message: 'Verification request submitted. We review within 3 business days.' });
}
