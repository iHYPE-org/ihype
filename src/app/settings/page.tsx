import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveNotificationPreferences } from './actions';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { PasskeyManager } from '@/components/PasskeyManager';

export const metadata: Metadata = { title: 'Settings · iHYPE' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const prefs = await db.notificationPreference.findUnique({
    where: { userId: session.user.id }
  }).catch(() => null);

  const current = prefs ?? {
    newShows: true,
    journalPosts: true,
    milestones: true,
    weeklyDigest: true
  };

  return (
    <main className="container section" style={{ maxWidth: 640 }}>
      <h1>Settings</h1>

      <section className="section">
        <h2>Notification preferences</h2>
        <p className="meta">Choose which emails you want from iHYPE.</p>
        <form action={saveNotificationPreferences} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {[
            ['newShows', 'New shows from artists I hype'],
            ['journalPosts', 'Journal posts from artists I follow'],
            ['milestones', 'Hype milestone notifications'],
            ['weeklyDigest', 'Weekly digest email']
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                name={key}
                defaultChecked={Boolean((current as Record<string, boolean>)[key])}
              />
              <span>{label}</span>
            </label>
          ))}
          <div>
            <button className="button" type="submit">Save preferences</button>
          </div>
        </form>
        <PushNotificationToggle />
      </section>

      <section className="section">
        <h2>Passkeys</h2>
        <p className="meta">Sign in instantly with Face ID, Touch ID, or your device PIN — no password needed.</p>
        <PasskeyManager />
      </section>

      <section className="section">
        <h2>Data export</h2>
        <p className="meta" style={{ marginBottom: 16 }}>
          Download a copy of your iHYPE data. The export includes your profile, hype events, follows, notifications, and seeds.
        </p>
        <form action="/api/settings/data-export" method="POST">
          <button className="button" type="submit">
            Request data export
          </button>
        </form>
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 12 }}>
          The file will download as JSON. No account changes are made.
        </p>
      </section>
    </main>
  );
}
