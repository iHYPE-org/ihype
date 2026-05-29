import { NextResponse } from 'next/server';

// Informational only — no sensitive data, no auth required.
const JOBS = [
  { path: '/api/cron/show-lifecycle',               schedule: '*/5 * * * *',  description: 'Show lifecycle transitions' },
  { path: '/api/cron/expire-reservations',          schedule: '*/5 * * * *',  description: 'Expire stale ticket reservations' },
  { path: '/api/cron?job=health-check',             schedule: '0 */6 * * *',  description: 'Platform health snapshot' },
  { path: '/api/cron?job=db-health',                schedule: '0 */6 * * *',  description: 'Database health check' },
  { path: '/api/cron?job=digest',                   schedule: '0 8 * * *',    description: 'Daily fan digest emails' },
  { path: '/api/cron?job=new-to-scene',             schedule: '0 10 * * *',   description: 'New-to-scene artist highlights' },
  { path: '/api/cron?job=show-reminders',           schedule: '0 12 * * *',   description: 'Upcoming show reminders' },
  { path: '/api/cron?job=onboarding',               schedule: '0 14 * * *',   description: 'Onboarding nudge emails' },
  { path: '/api/cron?job=expire-ads',               schedule: '0 2 * * *',    description: 'Expire finished ad campaigns' },
  { path: '/api/cron?job=session-cleanup',          schedule: '0 3 * * *',    description: 'Clean up expired sessions' },
  { path: '/api/cron?job=feature-shows',            schedule: '0 6 * * *',    description: 'Feature upcoming shows' },
  { path: '/api/cron?job=weekly-picks',             schedule: '0 9 * * 1',    description: 'Weekly picks email (Monday)' },
  { path: '/api/cron?job=artist-digest',            schedule: '0 9 * * 1',    description: 'Weekly artist digest (Monday)' },
  { path: '/api/cron?job=admin-report',             schedule: '0 9 * * 1',    description: 'Weekly admin report (Monday)' },
  { path: '/api/cron?job=follow-digest',            schedule: '0 9 * * 1',    description: 'Weekly follow digest (Monday)' },
  { path: '/api/cron?job=audit-log-rotate',         schedule: '0 4 * * 1',    description: 'Rotate old audit logs (Monday)' },
  { path: '/api/cron/backup-verify',                schedule: '0 5 * * *',    description: 'Daily backup sanity check email' },
  { path: '/api/cron?job=close-stale-bookings',     schedule: '0 1 * * *',    description: 'Close stale booking requests' },
  { path: '/api/cron?job=artist-onboarding',        schedule: '0 11 * * *',   description: 'Artist onboarding follow-up' },
  { path: '/api/cron?job=show-payouts',             schedule: '0 13 * * *',   description: 'Trigger show payout transfers' },
  { path: '/api/cron?job=stripe-connect-health',    schedule: '0 */6 * * *',  description: 'Stripe Connect account health' },
];

export async function GET() {
  return NextResponse.json({
    jobs: JOBS,
    serverTime: new Date().toISOString(),
  });
}
