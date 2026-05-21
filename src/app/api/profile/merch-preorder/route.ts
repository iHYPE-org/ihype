import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { recordAuditEvent } from '@/lib/audit';
import { sendGenericEmail } from '@/lib/mailer';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`merch-preorder:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit.' }, { status: 429 });
  let parsed: { profileId?: string; name?: string; email?: string; item?: string; size?: string };
  try { parsed = await request.json() as typeof parsed; } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const { profileId, name, email, item, size } = parsed;
  if (!profileId || !name?.trim() || !email?.trim() || !item?.trim()) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  const profile = await db.profile.findUnique({ where: { id: profileId }, select: { name: true, owner: { select: { email: true } } } });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  await recordAuditEvent({ action: 'merch_preorder', entityType: 'profile', entityId: profileId, metadata: { name, email, item, size } });
  await sendGenericEmail({ to: email, subject: 'Merch pre-order received', text: `Thanks ${name}! We've recorded your interest in "${item}"${size ? ` (size: ${size})` : ''}. The artist will be in touch.`, html: `<p>Thanks <strong>${name}</strong>! Your interest in <em>${item}</em>${size ? ` (size: ${size})` : ''} has been noted. The artist will contact you.</p>` }).catch(() => {});
  if (profile.owner.email) {
    await sendGenericEmail({ to: profile.owner.email, subject: 'New merch pre-order', text: `${name} (${email}) pre-ordered: ${item}${size ? ` / ${size}` : ''}`, html: `<p><strong>${name}</strong> (${email}) pre-ordered: ${item}${size ? ` / ${size}` : ''}</p>` }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
