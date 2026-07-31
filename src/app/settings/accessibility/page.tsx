import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AccessibilitySettingsPanel } from '@/components/shell/AccessibilitySettingsPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Accessibility · iHYPE',
  robots: { index: false, follow: false },
};

/**
 * The app shell's SETTINGS → Accessibility route. Auth-gated like the rest of
 * /settings — the preferences it writes are device-level, but the route sits
 * inside the signed-in shell and its siblings all require a session.
 */
export default async function AccessibilitySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/settings/accessibility');
  return <AccessibilitySettingsPanel />;
}
