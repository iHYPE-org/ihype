import { redirect } from 'next/navigation';

/** Consolidated into the tabbed /payouts hub — DESIGN_SYNC row 245. */
export default function PayoutSettingsRedirect() {
  redirect('/payouts?tab=settings');
}
