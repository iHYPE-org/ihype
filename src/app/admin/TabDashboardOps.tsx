interface InviteCode {
  id: string;
  code: string;
  usedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface SpamFlag {
  id: string;
  body: string | null;
  userId: string;
  createdAt: Date;
  user: { email: string | null; username: string | null } | null;
}

interface AbTest {
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
}

interface PendingAd {
  id: string;
  title: string;
  createdAt: Date;
  advertiser: { email: string | null; username: string | null } | null;
  slot: { name: string } | null;
}

interface Props {
  recentInviteCodes: InviteCode[];
  revenueCents: number;
  platformFeeTotal: number;
  payoutPaid: number;
  payoutPending: number;
  monthlyRows: [string, number][];
  topEarners: Array<{ profileId: string | null; _sum: { amountCents: number | null } }>;
  recentSpamFlags: SpamFlag[];
  abTests: AbTest[];
  pendingAds: PendingAd[];
}

export function TabDashboardOps({
  recentInviteCodes,
  revenueCents,
  platformFeeTotal,
  payoutPaid,
  payoutPending,
  monthlyRows,
  topEarners,
  recentSpamFlags,
  abTests,
  pendingAds,
}: Props) {
  return (
    <>
      <section className="section">
        <h2>Invite Codes</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="button" href="/api/admin/invite-codes" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            View all via API
          </a>
          <a className="button" href="/api/admin/test-email" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            Send test email
          </a>
        </div>
        {recentInviteCodes.length === 0 ? (
          <p className="meta">No invite codes yet. POST to /api/admin/invite-codes to generate some.</p>
        ) : (
          <div className="admin-list">
            {recentInviteCodes.map((code) => (
              <div className="admin-list-row" key={code.id}>
                <code style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{code.code}</code>
                <small>
                  {code.usedAt ? `Used ${code.usedAt.toISOString()}` : code.expiresAt && code.expiresAt < new Date() ? 'Expired' : 'Available'}
                  {' | '}created {code.createdAt.toISOString()}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Backups</h2>
        <article className="panel" style={{ padding: '1rem 1.25rem' }}>
          <p className="meta" style={{ marginTop: 0 }}>
            iHYPE does not currently run an automated database backup job. Postgres backups should be
            taken from the managed provider dashboard on a regular cadence (daily for production).
          </p>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0', lineHeight: 1.6 }}>
            <li>
              <strong>Neon:</strong>{' '}
              <a href="https://console.neon.tech/" rel="noopener noreferrer" target="_blank">
                console.neon.tech
              </a>{' '}
              — branch the production database for point-in-time snapshots.
            </li>
            <li>
              <strong>Cloudflare:</strong>{' '}
              <a href="https://dash.cloudflare.com/" rel="noopener noreferrer" target="_blank">
                dash.cloudflare.com
              </a>{' '}
              — review Workers logs, R2 storage, and analytics.
            </li>
            <li>
              For ad-hoc exports run <code>pg_dump &quot;$DATABASE_URL&quot; &gt; ihype-backup.sql</code>{' '}
              from a trusted workstation.
            </li>
          </ul>
          <p className="meta" style={{ marginBottom: 0 }}>
            Note: an R2/S3-backed automated rotation job is planned but intentionally not wired up yet —
            this section is informational so admins know where to look.
          </p>
        </article>
      </section>

      {/* ── Revenue Dashboard ──────────────────────────────────── */}
      <section className="section">
        <h2>Revenue</h2>
        <div className="admin-list" style={{ marginBottom: 16 }}>
          <div className="admin-list-row"><strong>Total ticket revenue (CAPTURED)</strong><span>{`$${(revenueCents / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>Platform fee est. (10%)</strong><span>{`$${(platformFeeTotal / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>Payouts paid</strong><span>{`$${(payoutPaid / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>Payouts pending</strong><span>{`$${(payoutPending / 100).toFixed(2)}`}</span></div>
        </div>
        {monthlyRows.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Monthly revenue (last 12 months)</h3>
            <div className="admin-list">
              {monthlyRows.map(([month, cents]) => (
                <div className="admin-list-row" key={month}>
                  <span>{month}</span>
                  <strong>{`$${(cents / 100).toFixed(2)}`}</strong>
                </div>
              ))}
            </div>
          </>
        )}
        {topEarners.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8, marginTop: 16 }}>Top earners (by profile)</h3>
            <div className="admin-list">
              {topEarners.map((e) => (
                <div className="admin-list-row" key={e.profileId}>
                  <span>{e.profileId ?? 'unknown'}</span>
                  <strong>{`$${((e._sum.amountCents ?? 0) / 100).toFixed(2)}`}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Rate Limits ───────────────────────────────────────── */}
      <section className="section">
        <h2>Rate Limits (last 24h)</h2>
        {recentSpamFlags.length === 0 ? (
          <p className="meta">No SPAM_FLAG notifications in the last 24 hours.</p>
        ) : (
          <div className="admin-list">
            {recentSpamFlags.map((n) => (
              <div className="admin-list-row" key={n.id}>
                <span>{n.user?.username ?? n.user?.email ?? n.userId}</span>
                <small>{n.body}</small>
                <small>{n.createdAt.toISOString().slice(0, 16)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── A/B Tests ─────────────────────────────────────────── */}
      <section className="section">
        <h2>A/B Tests</h2>
        {abTests.length === 0 ? (
          <p className="meta">No A/B tests configured. POST to /api/admin/ab-tests to create one.</p>
        ) : (
          <div className="admin-list">
            {abTests.map((t) => (
              <div className="admin-list-row" key={t.key}>
                <code>{t.key}</code>
                <span>{t.description ?? '—'}</span>
                <strong style={{ color: t.enabled ? 'var(--teal, #22e5d4)' : 'var(--ink3, #666)' }}>{t.enabled ? 'ENABLED' : 'DISABLED'}</strong>
                <small>{t.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          Manage via <code>POST /api/admin/ab-tests</code> with <code>{`{key, description, enabled}`}</code>.
        </p>
      </section>

      {/* ── Ads ───────────────────────────────────────────────── */}
      <section className="section">
        <h2>Ads — Pending Review</h2>
        {pendingAds.length === 0 ? (
          <p className="meta">No pending ads.</p>
        ) : (
          <div className="admin-list">
            {pendingAds.map((ad) => (
              <div className="admin-list-row" key={ad.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                <strong>{ad.title}</strong>
                <span>{ad.slot?.name}</span>
                <small>{ad.advertiser?.username ?? ad.advertiser?.email}</small>
                <small>{ad.createdAt.toISOString().slice(0, 10)}</small>
                <div style={{ display: 'flex', gap: 6 }}>
                  <form method="POST" action={`/api/admin/ads/${ad.id}`} style={{ display: 'inline' }}>
                    <input type="hidden" name="status" value="APPROVED" />
                    <button type="submit" className="button small" style={{ fontSize: 12 }}>Approve</button>
                  </form>
                  <form method="POST" action={`/api/admin/ads/${ad.id}`} style={{ display: 'inline' }}>
                    <input type="hidden" name="status" value="REJECTED" />
                    <button type="submit" className="button small secondary" style={{ fontSize: 12 }}>Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          Manage via <code>PATCH /api/admin/ads/[adId]</code> with <code>{`{status: "APPROVED"|"REJECTED"}`}</code>.
        </p>
      </section>
    </>
  );
}
