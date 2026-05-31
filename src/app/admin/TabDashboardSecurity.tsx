interface SpamFlag {
  id: string;
  body: string | null;
  userId: string;
  createdAt: Date;
  user: { email: string | null; username: string | null } | null;
}

interface Props {
  recentSpamFlags: SpamFlag[];
  recentLoginsCount: number;
}

export function TabDashboardSecurity({ recentSpamFlags, recentLoginsCount }: Props) {
  return (
    <section className="panel admin-console-panel">
      <div className="admin-console-panel-head">
        <div>
          <h2>Security</h2>
          <p className="meta">Spam flags and login activity in the last 24 hours.</p>
        </div>
      </div>
      <div className="admin-metric-grid" style={{ marginBottom: '1rem' }}>
        <article className="card admin-metric-card">
          <span>Spam flags (24h)</span>
          <strong>{recentSpamFlags.length}</strong>
        </article>
        <article className="card admin-metric-card">
          <span>Logins (24h)</span>
          <strong>{recentLoginsCount}</strong>
        </article>
      </div>
      {recentSpamFlags.length > 0 && (
        <div className="admin-list">
          {recentSpamFlags.map((flag) => (
            <div className="admin-list-row" key={flag.id}>
              <span>{flag.body}</span>
              <small>{flag.user?.username ?? flag.user?.email ?? flag.userId} | {flag.createdAt.toISOString()}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
