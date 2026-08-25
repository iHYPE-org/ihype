import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { MmmAdvertiserSignup } from '@/components/mmm/MmmAdvertiserSignup';

export const dynamic = 'force-dynamic';

/**
 * Becoming an advertiser, from inside the console.
 *
 * Sits beside `/app/me/advertising` (the dashboard) rather than inside
 * `/new` (the campaign builder) because they are different acts: this creates
 * the ACCOUNT, that one spends money against it. ME's add-profile button used
 * to point at the builder, which is why the role was unaddable.
 *
 * An account that already has the profile is sent to its dashboard — this page
 * has nothing to offer it, and the endpoint behind it answers 409.
 */
export default async function AdvertiserStartPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/me/advertising/start');

  const existing = await db.advertiserAccount.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (existing) redirect('/app/me/advertising');

  return (
    <div className="mmm-advertiser">
      <Link className="mmm-charter-back" href="/app/me?section=profiles">‹ Profiles</Link>
      <div className="mmm-advertiser-head">
        <div>
          <p className="mmm-eyebrow mmm-eyebrow-accent">Advertiser profile</p>
          <h1>Advertise on iHYPE</h1>
          <p className="meta" style={{ marginTop: 4, maxWidth: '58ch' }}>
            Radio-style audio spots between tracks on the station. Adding this keeps everything
            else about your account exactly as it is — it is a profile alongside the ones you
            already have, not a different login.
          </p>
        </div>
      </div>
      <MmmAdvertiserSignup />
    </div>
  );
}
