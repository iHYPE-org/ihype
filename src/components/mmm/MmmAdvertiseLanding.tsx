import Link from 'next/link';

const ELIGIBLE = ['Artists and labels', 'Venues and promoters', 'Gear and instruments', 'Ticketing and merch', 'Tour and production services'];

export function MmmAdvertiseLanding() {
  return (
    <main className="mmm-ad-landing">
      <section className="mmm-ad-hero">
        <p className="mmm-eyebrow mmm-eyebrow-accent">Advertise on iHYPE</p>
        <h1>Reach music people.<br />Skip the noise.</h1>
        <p className="mmm-ad-lead">Self-serve audio campaigns for the music industry. Choose your reach, schedule your spots and see the full price before checkout.</p>
        <div className="mmm-ad-actions">
          <Link className="mmm-btn-primary" href="/advertise/register">Create advertiser account</Link>
          <Link className="mmm-btn-ghost" href="/login?callbackUrl=/app/me/advertising">Sign in</Link>
        </div>
      </section>

      <section aria-labelledby="ad-how" className="mmm-ad-section">
        <p className="mmm-eyebrow">How it works</p>
        <h2 id="ad-how">Build, screen, run.</h2>
        <div className="mmm-ad-steps">
          <article><span>01</span><h3>Choose the audience</h3><p>Target local, regional, national or worldwide listeners and set spots per day.</p></article>
          <article><span>02</span><h3>Upload the audio</h3><p>Add a radio-style audio spot and destination link. iHYPE does not host video.</p></article>
          <article><span>03</span><h3>Clear screening</h3><p>Eligibility, relevance, safety, copyright and claims are checked before payment.</p></article>
        </div>
      </section>

      <section aria-labelledby="ad-who" className="mmm-ad-section mmm-ad-eligibility">
        <div>
          <p className="mmm-eyebrow">Music industry only</p>
          <h2 id="ad-who">Who can advertise</h2>
          <p>Campaigns must directly serve artists, venues, shows or music listeners. General retail, financial products and unrelated services are rejected.</p>
        </div>
        <ul>{ELIGIBLE.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className="mmm-ad-final">
        <h2>Ready to build your first campaign?</h2>
        <p>No sales call and no contract. Create an account, verify the business and review pricing in the builder.</p>
        <Link className="mmm-btn-primary" href="/advertise/register">Get started</Link>
      </section>
    </main>
  );
}
