import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveNotificationPreferences } from './actions';

export const metadata = { title: 'Notification preferences · iHYPE' };
export const dynamic = 'force-dynamic';

export default async function NotificationPreferencesPage() {
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
      <h1>Notification preferences</h1>
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
    </main>
  );
}
