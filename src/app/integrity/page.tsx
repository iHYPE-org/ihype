import Link from 'next/link';
import { db } from '@/lib/db';
import { getShowVisibilitySignals } from '@/lib/integrity';
import { getTransparencySnapshot } from '@/lib/transparency';
import { sortShowsForFeed } from '@/lib/integrity';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Integrity & Transparency | iHYPE.org',
  description: 'Public heuristics ledger, transparency snapshot, and explainability notes for the iHYPE.org feed.'
};

export default async function IntegrityPage() {
  const snapshot = await getTransparencySnapshot();
  const candidateShows = await db.show.findMany({
    where: { status: { not: 'CANCELED' } },
    select: {
      title: true,
      status: true,
      startsAt: true,
      hypeCount: true,
      tags: true,
      isRadioShow: true,
      venueProfile: {
        select: {
          name: true,
          city: true
        }
      },
      headlinerProfile: {
        select: {
          name: true
        }
      }
    }
  });
  const featuredShow = sortShowsForFeed(candidateShows)[0] ?? null;
  const featuredSignals = featuredShow ? getShowVisibilitySignals(featuredShow) : null;

  return (
    <main className="container section">
      <section className="panel launch-hero">
        <div className="launch-hero-copy">
          <div className="badge">Integrity Model</div>
          <h1 className="title" style={{ fontSize: '3rem' }}>Transparent feed logic, adapted for HYPE.</h1>
          <p className="subtitle">
            This page brings the strongest Rift-style best practices into the music product: visible heuristics, public
            aggregate reporting, versioned feed logic, and clear trust commitments without pretending hidden ranking is
            a feature.
          </p>
          <div className="cta-row">
            <Link className="button" href="/api/transparency">Open JSON snapshot</Link>
            <Link className="button secondary" href="/launch-readiness">Launch readiness</Link>
          </div>
        </div>
        <div className="launch-hero-meta">
          <div className="stat"><strong>{snapshot.heuristicsVersion}</strong>Feed heuristics version</div>
            <div className="stat"><strong>{snapshot.counters.liveShows}</strong>Live shows in database</div>
            <div className="stat"><strong>{snapshot.counters.listenersLiveNow}</strong>Fans tied to live shows</div>
          <div className="stat"><strong>{snapshot.counters.showHypes}</strong>Show hype events</div>
          <div className="stat"><strong>{snapshot.counters.profileHypes}</strong>Profile hype events</div>
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Best Practices Applied</div>
          <h2>What transferred well from the civic-platform playbook.</h2>
        </div>

        <div className="launch-grid launch-grid-3">
          <article className="panel launch-card">
            <h3>Explainability by default</h3>
            <p className="artist-copy">
              Feed logic is now described in plain language on show surfaces rather than staying hidden in sort order
              or operator intuition.
            </p>
          </article>
          <article className="panel launch-card">
            <h3>Versioned heuristics</h3>
            <p className="artist-copy">
              The current feed model is labeled with a public heuristics version so ranking changes can be documented
              instead of quietly drifting.
            </p>
          </article>
          <article className="panel launch-card">
            <h3>Public aggregate reporting</h3>
            <p className="artist-copy">
              The app now exposes an auditable aggregate snapshot route so growth and trust metrics are inspectable in a
              machine-readable form.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Heuristics Ledger</div>
          <h2>Public rules that currently affect show visibility.</h2>
        </div>

        <div className="launch-grid launch-grid-2">
          {snapshot.heuristicsLedger.map((entry) => (
            <article className="panel launch-card" key={entry.id}>
              <div className="meta">{entry.id}</div>
              <h3>{entry.title}</h3>
              <p className="artist-copy">{entry.summary}</p>
              <p className="meta">{entry.userImpact}</p>
            </article>
          ))}
        </div>
      </section>

      {featuredShow && featuredSignals ? (
        <section className="section">
          <div className="launch-section-heading">
            <div className="badge">Why This Is Surfaced</div>
            <h2>Example explanation for the current top-ranked show.</h2>
          </div>

          <article className="panel launch-card">
            <h3>{featuredShow.title}</h3>
            <p className="meta">Heuristics version {featuredSignals.version}</p>
            <div className="signal-grid">
              {featuredSignals.signals.map((signal) => (
                <div className="signal-card" key={signal.label}>
                  <strong>{signal.label}</strong>
                  <span>{signal.value}</span>
                </div>
              ))}
            </div>
            <div className="explanation-block">
              <h4>Plain-language breakdown</h4>
              <ul className="launch-list">
                {featuredSignals.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          </article>
        </section>
      ) : null}

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Transparency Snapshot</div>
          <h2>Current aggregate platform view.</h2>
          <p className="kicker">
            This beta page exposes the current aggregate snapshot. A production-grade version should publish delayed, thresholded reports
            with retention and anonymity rules layered in.
          </p>
        </div>

        <div className="launch-grid launch-grid-4">
          <div className="stat"><strong>{snapshot.counters.totalShows}</strong>Total shows</div>
          <div className="stat"><strong>{snapshot.counters.upcomingShows}</strong>Upcoming shows</div>
          <div className="stat"><strong>{snapshot.counters.archivedShows}</strong>Archived shows</div>
          <div className="stat"><strong>{snapshot.counters.totalEventsHeld}</strong>Events held</div>
          <div className="stat"><strong>{snapshot.counters.totalProfiles}</strong>Total profiles</div>
          <div className="stat"><strong>{snapshot.counters.totalArtists}</strong>Artists</div>
          <div className="stat"><strong>{snapshot.counters.totalPromoters}</strong>Promoters</div>
          <div className="stat"><strong>{snapshot.counters.totalVenues}</strong>Venues</div>
          <div className="stat"><strong>{snapshot.counters.totalListeners}</strong>Fans</div>
              <div className="stat"><strong>{snapshot.counters.listenersLiveNow}</strong>Fans tied to live shows</div>
          <div className="stat"><strong>{snapshot.counters.totalTicketsSold}</strong>Tickets sold</div>
          <div className="stat"><strong>{snapshot.counters.totalSongsUploaded}</strong>Songs uploaded</div>
          <div className="stat"><strong>{snapshot.counters.totalRequests}</strong>Venue requests</div>
          <div className="stat"><strong>{snapshot.counters.pendingRequests}</strong>Pending requests</div>
          <div className="stat"><strong>{snapshot.counters.bookedRequests}</strong>Booked requests</div>
          <div className="stat"><strong>{new Date(snapshot.generatedAt).toLocaleString('en-US')}</strong>Snapshot generated</div>
        </div>
      </section>

      <section className="section">
        <div className="panel launch-card">
          <div className="badge">Operating Commitments</div>
          <ul className="launch-list">
            {snapshot.commitments.map((commitment) => <li key={commitment}>{commitment}</li>)}
          </ul>
        </div>
      </section>
    </main>
  );
}
