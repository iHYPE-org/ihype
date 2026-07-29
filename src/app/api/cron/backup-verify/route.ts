import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { getAdminAlertRecipients } from '@/lib/env';
import { sendGenericEmail } from '@/lib/mailer';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily backup sanity check. This verifies the live database is intact and
// fresh — it is NOT a restore test. The monthly restore drill (see
// docs/runbooks/backup-restore-drill.md) is what proves backups actually
// restore; this job reminds the operator on the 1st of each month.
export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [userCount, showCount, profileCount, latestUser, latestAudit, migrations] = await Promise.all([
      db.user.count(),
      db.show.count(),
      db.profile.count(),
      db.user.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      db.auditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      db.$queryRaw<Array<{ count: bigint; latest: string | null }>>`
        SELECT COUNT(*)::bigint AS count, MAX(migration_name) AS latest
        FROM _prisma_migrations WHERE finished_at IS NOT NULL
      `.catch(() => [] as Array<{ count: bigint; latest: string | null }>),
    ]);

    const migrationCount = migrations[0] ? Number(migrations[0].count) : null;
    const latestMigration = migrations[0]?.latest ?? null;

    // Freshness: audit events are written on every sign-in and privacy/admin
    // action — more than 7 quiet days on a live site means writes are broken
    // (or we're looking at a stale restore target).
    const staleDays = 7;
    const auditAgeMs = latestAudit ? Date.now() - latestAudit.createdAt.getTime() : null;
    const isStale = auditAgeMs !== null && auditAgeMs > staleDays * 24 * 60 * 60 * 1000;

    const isWarning = userCount === 0 || profileCount === 0 || migrationCount === null || isStale;

    const now = new Date();
    const restoreDrillDue = now.getUTCDate() === 1;

    const subject = isWarning
      ? `⚠️ iHYPE backup check WARNING`
      : restoreDrillDue
        ? `✓ iHYPE daily backup check — monthly RESTORE DRILL due today`
        : `✓ iHYPE daily backup check — ${userCount} users, ${showCount} shows, ${profileCount} profiles`;

    const warningLines: string[] = [];
    if (userCount === 0 || profileCount === 0) warningLines.push('WARNING: One or more counts are zero — verify database backup integrity.');
    if (migrationCount === null) warningLines.push('WARNING: Could not read _prisma_migrations — schema/migration state unverifiable.');
    if (isStale) warningLines.push(`WARNING: Newest audit event is older than ${staleDays} days — writes may be failing.`);

    const text = [
      subject,
      '',
      `Users:             ${userCount}`,
      `Shows:             ${showCount}`,
      `Profiles:          ${profileCount}`,
      `Applied migrations: ${migrationCount ?? 'UNKNOWN'}${latestMigration ? ` (latest: ${latestMigration})` : ''}`,
      `Newest user:       ${latestUser?.createdAt.toISOString() ?? 'none'}`,
      `Newest audit event: ${latestAudit?.createdAt.toISOString() ?? 'none'}`,
      '',
      ...(warningLines.length ? warningLines : ['All counts look healthy.']),
      ...(restoreDrillDue
        ? [
            '',
            'MONTHLY RESTORE DRILL DUE: this check only proves the live DB is up.',
            'Run the restore drill in docs/runbooks/backup-restore-drill.md (Supabase',
            'PITR restore to a branch, compare these counts) and note the result.',
          ]
        : []),
      '',
      `Checked at: ${now.toISOString()}`,
    ].join('\n');

    const warningHtml = warningLines
      .map((line) => `<p style="color:#c0392b;font-weight:bold;margin-top:16px;">${line}</p>`)
      .join('');
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#10182a;">
      <h2 style="margin:0 0 12px;">${isWarning ? '⚠️ Backup Check WARNING' : '✓ Daily Backup Check'}</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:4px 8px;font-weight:bold;">Users</td><td style="padding:4px 8px;">${userCount}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Shows</td><td style="padding:4px 8px;">${showCount}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Profiles</td><td style="padding:4px 8px;">${profileCount}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Applied migrations</td><td style="padding:4px 8px;">${migrationCount ?? 'UNKNOWN'}${latestMigration ? ` (latest: ${latestMigration})` : ''}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Newest user</td><td style="padding:4px 8px;">${latestUser?.createdAt.toISOString() ?? 'none'}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Newest audit event</td><td style="padding:4px 8px;">${latestAudit?.createdAt.toISOString() ?? 'none'}</td></tr>
      </table>
      ${warningHtml || '<p style="color:#27ae60;margin-top:16px;">All counts look healthy.</p>'}
      ${restoreDrillDue ? '<p style="color:#b26a00;font-weight:bold;margin-top:16px;">Monthly restore drill due today — see docs/runbooks/backup-restore-drill.md. This check only proves the live DB is up; the drill proves backups restore.</p>' : ''}
      <p style="color:#5b657a;font-size:12px;margin-top:16px;">Checked at: ${now.toISOString()}</p>
    </div>
  `;

    await sendGenericEmail({ to: getAdminAlertRecipients(), subject, text, html }).catch((err) => {
      log.error('[cron/backup-verify]', err instanceof Error ? err : { error: String(err) }, 'Failed to send email');
    });

    return NextResponse.json({
      ok: true,
      userCount,
      showCount,
      profileCount,
      migrationCount,
      latestMigration,
      restoreDrillDue,
      warnings: warningLines,
    });
  } catch (err) {
    log.error('[cron/backup-verify]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
