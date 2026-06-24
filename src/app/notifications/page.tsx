import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notifications · iHYPE',
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/notifications');

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 32 }}>
        <Link href="/home" style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
          ← HOME
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span style={{
              padding: '3px 10px', background: 'var(--accent, #ff5029)',
              borderRadius: 9999, fontSize: 11, fontFamily: 'var(--font-mono)',
              letterSpacing: '.06em', color: '#fff',
            }}>
              {unreadCount} new
            </span>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="ihype-empty-state">
          <div className="icon">🔔</div>
          <h3>All clear</h3>
          <p>You&apos;ll get notified about new shows, milestones, and journal posts.</p>
          <Link href="/discover" className="ihype-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Discover artists →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => {
            const date = new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            const inner = (
              <div
                className={n.link ? 'ihype-card' : undefined}
                style={{
                  padding: '16px 18px',
                  background: n.read ? 'var(--bg-2, #100d09)' : 'rgba(255,80,41,.06)',
                  borderLeft: `3px solid ${n.read ? 'transparent' : 'var(--accent, #ff5029)'}`,
                  borderRadius: 8,
                  border: n.link ? undefined : '1px solid rgba(255,255,255,.06)',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{n.body}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(240,235,229,.35)', fontFamily: 'var(--font-mono)' }}>{date}</p>
                </div>
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            );

            return n.link ? (
              <Link key={n.id} href={n.link} style={{ textDecoration: 'none' }}>{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <Link href="/settings" className="ihype-btn-ghost">Notification settings →</Link>
      </div>
    </div>
  );
}
