import Link from 'next/link';
import { getHomePageData } from '@/lib/public-data';

export const revalidate = 60;

export default async function HomePage() {
  const { transparencySnapshot } = await getHomePageData();
  const counters = transparencySnapshot.counters;

  return (
    <main className="container section home-shell">
      <section className="home-mission-grid" aria-label="About iHYPE">
        <div className="home-mission-panel">
          <div className="badge">ABOUT IHYPE</div>
          <h1 className="home-mission-title">
            iHYPE helps fans find the artists, promoters, and venues shaping the next scene.
          </h1>
          <p className="home-mission-copy">
            The platform is built around live music discovery. Fans can move through artists, promoters,
            venues, and shows in one cleaner network, while each signed-in role gets its own focused workspace.
          </p>
          <div className="cta-row">
            <Link className="button" href="/register">
              Join iHYPE
            </Link>
            <Link className="button secondary" href="/login">
              Sign in
            </Link>
          </div>
          <div className="home-mission-points" aria-label="Core strengths">
            <div className="home-mission-point">
              <span>Near me</span>
              <strong>Discovery by place and momentum</strong>
            </div>
            <div className="home-mission-point">
              <span>Clean pages</span>
              <strong>Role-based tools without the clutter</strong>
            </div>
            <div className="home-mission-point">
              <span>Visible signal</span>
              <strong>Hype, shows, and fan activity stay legible</strong>
            </div>
          </div>
          <div className="home-signal-strip home-signal-strip-dark" aria-label="Network overview">
            <div className="home-signal-item home-signal-item-dark">
              <span>Fans</span>
              <strong>{counters.totalListeners}</strong>
            </div>
            <div className="home-signal-item home-signal-item-dark">
              <span>Artists</span>
              <strong>{counters.totalArtists}</strong>
            </div>
            <div className="home-signal-item home-signal-item-dark">
              <span>Promoters</span>
              <strong>{counters.totalPromoters}</strong>
            </div>
            <div className="home-signal-item home-signal-item-dark">
              <span>Venues</span>
              <strong>{counters.totalVenues}</strong>
            </div>
          </div>
        </div>

        <aside className="home-featured-panel" aria-label="What iHYPE does">
          <div className="home-featured-head">
            <div>
              <div className="badge">CORE LOOP</div>
              <h2>What happens here</h2>
            </div>
          </div>
          <div className="home-featured-list">
            <div className="home-featured-card">
              <strong>Fans find the next room</strong>
              <p className="meta">
                Move from nearby discovery to saved music, shows, and real attendance.
              </p>
            </div>
            <div className="home-featured-card">
              <strong>Hype turns attention into signal</strong>
              <p className="meta">
                Pages and shows earn visible momentum through fan activity instead of hidden ranking.
              </p>
            </div>
            <div className="home-featured-card">
              <strong>Creators get the right lane</strong>
              <p className="meta">
                Artists, promoters, and venues land in discover spaces with tools matched to their role.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
