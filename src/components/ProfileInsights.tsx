'use client';

import { useEffect, useState, type ReactNode } from 'react';

type InsightsData = {
  hypeTotal: number;
  followerCount: number;
  bookingRequests: { pending: number; accepted: number; declined: number };
  listeners?: { distinctListeners: number; totalPlays: number };
  topTracks?: { title: string; plays: number }[];
  trackCompletionRate?: number;
  showCompletionRate?: number;
  hypeTimeline?: { buckets: number[]; untracked: number };
  topCities?: { city: string; count: number }[];
  ticketRevenueCents?: number;
  ticketsSold?: number;
};

type ChartDay = { date: string; count: number };

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 0', borderBottom: '1px solid var(--line)',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: 'var(--ink-a45)', margin: 0 }}>{text}</p>;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>{value.toLocaleString()}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a55)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function PercentStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>{Math.round(value * 100)}%</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a55)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/**
 * Owner-only Insights section for Artist/Venue/DJ pages — real aggregates
 * only (listens, hype counts, hype-during-playback timing, ticket/booking
 * data where relevant), never mock numbers. Rendered from each profile
 * page's own section-tab mechanism, gated behind that page's isOwner check.
 */
export function ProfileInsights({ profileId, profileType }: { profileId: string; profileType: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [chart, setChart] = useState<ChartDay[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/profile-insights?profileId=${profileId}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/hype/chart?profileId=${profileId}`).then((r) => (r.ok ? r.json() : { days: [] })),
    ])
      .then(([insights, chartRes]) => {
        if (cancelled) return;
        setData(insights);
        setChart(chartRes.days ?? []);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [profileId]);

  if (error) return <EmptyNote text="Couldn't load insights right now." />;
  if (!data) return <EmptyNote text="Loading insights…" />;

  const maxDay = Math.max(1, ...chart.map((d) => d.count));
  const hasChartActivity = chart.some((d) => d.count > 0);
  const timeline = data.hypeTimeline;
  const timelineTotal = timeline ? timeline.buckets.reduce((sum, n) => sum + n, 0) : 0;
  const maxTimelineBucket = timeline ? Math.max(1, ...timeline.buckets) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <Stat label="Hypes" value={data.hypeTotal} color="var(--accent, #ff5029)" />
        <Stat label="Followers" value={data.followerCount} color="#b983ff" />
        {data.listeners && <Stat label="Listeners" value={data.listeners.distinctListeners} color="#22e5d4" />}
        {typeof data.ticketsSold === 'number' && <Stat label="Tickets sold" value={data.ticketsSold} color="#22e5d4" />}
        {typeof data.trackCompletionRate === 'number' && <PercentStat label="Track completion" value={data.trackCompletionRate} color="#ff3e9a" />}
        {typeof data.showCompletionRate === 'number' && <PercentStat label="Show completion" value={data.showCompletionRate} color="#ff3e9a" />}
      </div>

      {typeof data.ticketRevenueCents === 'number' && (
        <Section title="Ticket revenue">
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            ${(data.ticketRevenueCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </Section>
      )}

      <Section title="Hype activity — last 30 days">
        {hasChartActivity ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70 }}>
            {chart.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                style={{
                  flex: 1, minWidth: 2, height: `${Math.max(4, (d.count / maxDay) * 100)}%`,
                  background: 'var(--accent, #ff5029)', borderRadius: 2, opacity: d.count > 0 ? 0.85 : 0.15,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyNote text="No hype activity yet in the last 30 days." />
        )}
      </Section>

      {data.topTracks && (
        <Section title="Top tracks">
          {data.topTracks.length ? (
            <div>
              {data.topTracks.map((t) => (
                <div key={t.title} style={rowStyle}>
                  <span style={{ fontSize: 14, color: 'var(--ink)' }}>{t.title}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-a55)' }}>
                    {t.plays} listener{t.plays === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote text="No listens yet." />
          )}
        </Section>
      )}

      {timeline && (
        <Section title="Hype timeline — where in a show people HYPE">
          {timelineTotal > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                {timeline.buckets.map((count, i) => (
                  <div
                    key={i}
                    title={`${Math.round((i / timeline.buckets.length) * 100)}–${Math.round(((i + 1) / timeline.buckets.length) * 100)}% into the show: ${count}`}
                    style={{
                      flex: 1, height: `${Math.max(6, (count / maxTimelineBucket) * 100)}%`,
                      background: '#ff3e9a', borderRadius: 2, opacity: count > 0 ? 0.85 : 0.15,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-a40)', marginTop: 6 }}>
                <span>Show start</span>
                <span>Show end</span>
              </div>
              {timeline.untracked > 0 && (
                <p style={{ fontSize: 11, color: 'var(--ink-a40)', marginTop: 12 }}>
                  +{timeline.untracked} more hype{timeline.untracked === 1 ? '' : 's'} fired without an active player open (position unknown).
                </p>
              )}
            </div>
          ) : (
            <EmptyNote text="No timestamped hype data yet — this fills in as people hype your shows while listening live." />
          )}
        </Section>
      )}

      {data.topCities && (
        <Section title={profileType === 'VENUE' ? 'Where ticket buyers travel from' : 'Where your fans are'}>
          {data.topCities.length ? (
            <div>
              {data.topCities.map((c) => (
                <div key={c.city} style={rowStyle}>
                  <span style={{ fontSize: 14, color: 'var(--ink)' }}>{c.city}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-a55)' }}>{c.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote text="No ticket sales with a known location yet." />
          )}
        </Section>
      )}

      <Section title="Booking requests">
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <Stat label="Pending" value={data.bookingRequests.pending} color="#ff5029" />
          <Stat label="Accepted" value={data.bookingRequests.accepted} color="#22e5d4" />
          <Stat label="Declined" value={data.bookingRequests.declined} color="var(--ink-a50)" />
        </div>
      </Section>
    </div>
  );
}
