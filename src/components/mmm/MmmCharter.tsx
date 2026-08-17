import Link from 'next/link';

const SECTIONS = [
  {
    title: 'The problem we built this to fix',
    body: 'We built iHYPE after living this problem as a band that went to New York City to try to make it. We had to pay to play, accept exposure-only gigs, find fans ourselves, find venues ourselves, and watch everyone take a piece. That system asks musicians to do every job except make music, while fans still struggle to discover them. iHYPE connects local discovery, genuine fan demand, booking, and ticket income so artists, venues, and DJs can spend less time fighting the system and more time building the scene.',
  },
  {
    title: 'The founding constraint',
    body: "iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales. This commitment is embedded in the company's founding documents and cannot be amended by management, board resolution, investor pressure, or acquisition.",
  },
  {
    title: 'Promoters and the 10%',
    body: 'The 10% promoter pool is distributed among everyone whose HYPE Links contributed to ticket sales for an event. There is no promoter role and no promoter account: promoting is something every account can do.',
  },
  {
    title: 'Open by design',
    body: 'Our code and our moderation heuristics are published for public audit. Nothing about how the split is calculated, how uploads are screened, or how the platform ranks anything is a secret — anyone can check that it does exactly what we say.',
  },
  {
    title: 'Your data is never for sale',
    body: 'iHYPE does not aggregate user data for resale and never sells it to advertisers or anyone else — not now, not after an acquisition. This is a charter commitment, not a policy that can be quietly reversed.',
  },
  {
    title: 'You get a vote',
    body: 'Fan users are treated as stakeholders, not just customers. Every proposed product feature change is put through a vote on the Community page, where every fan account gets a voice. The result becomes part of the public product record so platform direction cannot be quietly rewritten behind closed doors.',
  },
  {
    title: 'Independent annual oversight',
    body: 'A three-person corporate board, whose members are unrelated to the two founders, performs annual checks and balances over the organization. The board reviews governance, finances, compensation, compliance, and mission alignment. It retains the fiduciary responsibilities required of a nonprofit board; community feature votes govern product direction without replacing those legal duties.',
  },
  {
    title: 'Funded like radio, not like Big Tech',
    body: 'iHYPE is funded entirely by advertising, the same way terrestrial radio has always worked — and those ads are restricted to music-related sources only, forever. No user-data resale funds this platform, and no other category of advertiser will ever be let in to change that.',
  },
  {
    title: 'A scene-run 501(c)(3)',
    body: 'iHYPE is a certified 501(c)(3) philanthropic platform. It has no outside owners waiting for a return and no investor distribution hiding behind the mission. Revenue exists to keep the infrastructure working, compensate the small team fairly, and advance the local-music mission.',
  },
  {
    title: 'Why so few people run this',
    body: "iHYPE is run by two people, leaning on AI automation to keep operating costs at the absolute minimum. That's deliberate: a lean operation is a sustainable operation, and there's no boardroom of investors around to talk us into breaking any of the above.",
  },
  {
    title: 'Why lock it in?',
    body: 'Because every platform that started with good intentions eventually faced a board meeting where fees made sense. We wanted to make that conversation impossible. The charter is the answer to “what if the company needs revenue?” — the answer is: find another way. Not this.',
  },
  {
    title: 'What “locked in” means',
    body: 'The 70/20/10 split is a condition of incorporation. Changing it would require dissolving the company and re-incorporating under a different structure. No board vote, no shareholder approval, no acquisition clause overrides it.',
  },
  {
    title: 'What actually makes this real',
    body: 'A charter is just a promise on paper until a fan buys a ticket. Every dollar that hits this split exists because someone hyped an artist, showed up, and paid face value instead of going through a scalper. Artists write the songs, venues open the doors — but fans are the ones who make the 70/20/10 mean anything at all.',
  },
] as const;

export function MmmCharter() {
  return (
    <article className="mmm-charter">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ Info</Link>
      <header className="mmm-charter-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">Me · Info</p>
        <h1>The Charter</h1>
        <p className="mmm-charter-lead">The promises iHYPE cannot quietly rewrite.</p>
        <p className="mmm-charter-updated">Last updated June 20, 2026 · Portland, Maine</p>
      </header>

      <section aria-labelledby="charter-split" className="mmm-charter-split">
        <p className="mmm-eyebrow" id="charter-split">Every ticket. Every time.</p>
        <div aria-hidden="true" className="mmm-charter-split-bar">
          <span data-share="artist" /><span data-share="venue" /><span data-share="promoter" />
        </div>
        <div className="mmm-charter-shares">
          <div><strong>70%</strong><span>Artist</span></div>
          <div><strong>20%</strong><span>Venue</span></div>
          <div><strong>10%</strong><span>Promoters</span></div>
          <div><strong>0%</strong><span>iHYPE</span></div>
        </div>
        <p className="mmm-charter-callout">This is not a pricing strategy. It is a constraint. We built the business model around it, not the other way around.</p>
      </section>

      <div className="mmm-charter-grid">
        {SECTIONS.map((section, index) => (
          <section className="mmm-charter-card" key={section.title}>
            <span className="mmm-charter-index">{String(index + 1).padStart(2, '0')}</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <section className="mmm-charter-card mmm-charter-revenue">
        <span className="mmm-charter-index">14</span>
        <h2>Where advertising revenue goes</h2>
        <ol>
          <li>First: infrastructure and necessary operating vendors — hosting, storage, email, payments, security, monitoring, and the tools required to keep iHYPE reliable.</li>
          <li>Second, only when sustainably affordable: fair, fully disclosed compensation for the two employees who operate the platform. The intended all-in ceiling is $100,000 per employee per year, including benefits, and actual compensation must remain reasonable for the work and the organization’s circumstances.</li>
          <li>Then: remaining resources stay with the mission — improving the platform and strengthening local scenes. They are not distributed to founders, investors, or private owners.</li>
        </ol>
        <p>Founder compensation is not self-approved. It must be approved in advance by conflict-free members of the independent board using comparable compensation data, documented, reviewed annually, and published through transparency reporting.</p>
        <p>None of it touches the ticket split. Stripe’s card-processing fee is the only charge above face value, passed through at cost.</p>
      </section>

      <footer className="mmm-charter-footer">
        <p>Questions about the charter: <a href="mailto:admin@ihype.org">admin@ihype.org</a></p>
        <p>iHYPE Inc. · Founded Portland, ME · 2026</p>
      </footer>
    </article>
  );
}
