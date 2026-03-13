import Link from 'next/link';

const productGates = [
  'App Store and Play Store approvals completed, or the pre-approval checklist cleared with resubmission buffer built in.',
  'Streaming start time p95 below 2.0 seconds on LTE in Chicago, with a 30-day soak test at 99.9% uptime.',
  'Crash-free sessions at or above 99.0% on both iOS and Android.',
  'Anti-fraud controls live: rate limiting, playback verification, device fingerprinting, and basic bot scoring.',
  'DMCA takedown workflow and content-policy enforcement fully operational before public launch.'
];

const legalGates = [
  'Delaware PBC decision made, IP assigned to the company, and contributor agreements executed.',
  'Terms of Service, Privacy Policy, DMCA Policy, Acceptable Use Policy, and Community Guidelines published.',
  'Artist Upload License Agreement deployed as a click-through flow in product.',
  'Payments structured through Stripe Connect or similar to avoid money-transmission exposure.',
  'KYC, AML, and US tax reporting plans defined before any payout program goes live.'
];

const gtmGates = [
  'Chicago pilot roster secured: at least 100 artists, 10 DJs for a later DJ-set wave, and 5 venue LOIs or advisory commitments.',
  'Launch event booked, 30-day marketing calendar committed, and on-site onboarding plan staffed.',
  'Support and moderation coverage mapped for launch week with business-hours coverage plus on-call escalation.'
];

const corePillars = [
  {
    title: 'Hype Engine System of Record',
    body:
      'Store raw playback milestones and hype events in append-only tables, then compute derived hype values with a versioned algorithm so the platform can recompute history without losing trust.'
  },
  {
    title: 'Launch-Safe Fraud Defense',
    body:
      'Gate hype behind verified completion, device and IP consistency checks, rate limits, and manual anomaly review queues before considering heavier ML enforcement.'
  },
  {
    title: 'Rights and Safety First',
    body:
      'Keep launch focused on artist-uploaded content with explicit licensing, prohibit covers and remixes without proof of rights, and run a clear DMCA plus repeat-infringer workflow.'
  },
  {
    title: 'Payments Without Regulatory Drift',
    body:
      'When ticketing or payouts expand, use connected accounts, minimum payout thresholds, reserves, and immutable payout ledgers instead of holding funds in ad hoc flows.'
  }
];

const roadmap = [
  {
    phase: '90 Days Out',
    items: [
      'Drive 5,000 Chicago-area waitlist signups.',
      'Recruit 100 artists with at least three tracks each.',
      'Stand up a 10-person ambassador and street-team program.'
    ]
  },
  {
    phase: '60 Days Out',
    items: [
      'Run weekly HYPE Sessions listening parties.',
      'Ship a Chicago Underhype spotlight series for artists and neighborhoods.',
      'Pressure-test onboarding, analytics, and moderation response times.'
    ]
  },
  {
    phase: '30 Days Out',
    items: [
      'Start press outreach, launch trailer distribution, and embargoed previews.',
      'Lock the launch lineup, venue operations plan, and QR-based download flow.',
      'Finalize support macros, incident runbooks, and launch-week staffing.'
    ]
  },
  {
    phase: 'Launch Targets',
    items: [
      '5,000 downloads in the first 7 days.',
      '1,500 DAU by the end of month 1.',
      '1,000 uploaded tracks by the end of month 1.'
    ]
  }
];

const operatingSystem = [
  {
    title: 'Legal and Policy Stack',
    items: [
      'Terms of Service, Privacy Policy, DMCA Policy, Acceptable Use Policy, Community Guidelines',
      'Artist Upload License Agreement, promoter payout terms, venue terms where applicable',
      'Founder IP assignment, contractor invention assignment, advisor and vendor agreements'
    ]
  },
  {
    title: 'Technical Hardening',
    items: [
      'Playback milestone validation and short-lived hype eligibility tokens',
      'Rate limits, signed media URLs, WAF coverage, audit logs, and restore-tested backups',
      'Sentry and analytics dashboards for stream latency, crash rates, 5xx spikes, and fraud anomalies'
    ]
  },
  {
    title: 'Community and Support',
    items: [
      'Hype-only culture with comments off by default and artist-controlled approval queues',
      'Support channels for upload issues, takedowns, account recovery, and payout questions',
      'Moderation SLAs: harassment in 24 hours, copyright in 48 hours, fraud in 24 to 72 hours'
    ]
  }
];

const transparencyLessons = [
  {
    title: 'Public Heuristics Ledger',
    body:
      'Ranking logic, visibility gates, and trust-facing rules should be documented in a versioned ledger rather than left as tribal knowledge.'
  },
  {
    title: 'Why Am I Seeing This?',
    body:
      'Important surfaces should expose plain-language explanations so growth mechanics are inspectable by users, artists, and partners.'
  },
  {
    title: 'Daily or Delayed Transparency Reports',
    body:
      'Aggregate platform snapshots should be published on a predictable cadence so trust metrics are not trapped inside operator dashboards.'
  },
  {
    title: 'Governance Over Silent Drift',
    body:
      'High-impact rule changes should be versioned, disclosed, and reviewable instead of quietly reshaping user outcomes in the background.'
  }
];

const risks = [
  {
    name: 'Pirated uploads',
    mitigation: 'DMCA intake, repeat-infringer policy, fast takedown logging, and later fingerprinting.'
  },
  {
    name: 'Bot-driven hype',
    mitigation: 'Completion verification, token gating, device and IP limits, and manual anomaly review.'
  },
  {
    name: 'App store rejection',
    mitigation: 'Pre-review checklist, policy clarity, and avoiding cash-for-engagement claims in the MVP.'
  },
  {
    name: 'Low retention after launch',
    mitigation: 'Chicago-local relevance, weekly drops, shareable profiles, and fast onboarding fixes.'
  },
  {
    name: 'Scaling outages',
    mitigation: 'Load tests, alerts, clear SEV1 runbooks, and a 15-minute triage rule during launch week.'
  },
  {
    name: 'Brand trust erosion',
    mitigation: 'Transparent policies, quick moderation, and a product stance that values integrity over vanity metrics.'
  }
];

export const metadata = {
  title: 'Launch Readiness | iHYPE.org',
  description: 'Curated launch-readiness plan for the HYPE Network Chicago pilot and September 6, 2026 launch target.'
};

export default function LaunchReadinessPage() {
  return (
    <main className="container section">
      <section className="panel launch-hero">
        <div className="launch-hero-copy">
          <div className="badge">Launch Readiness Package</div>
          <h1 className="title" style={{ fontSize: '3rem' }}>HYPE Network launch plan, distilled for execution.</h1>
          <p className="subtitle">
            This page pulls the strongest pieces from the long-form launch package into one operating view for the
            Chicago electronic and house pilot, with a target public launch date of September 6, 2026.
          </p>
          <div className="cta-row">
            <Link className="button" href="/artists">Open artist pages</Link>
            <Link className="button secondary" href="/dashboard">Open dashboard</Link>
          </div>
        </div>
        <div className="launch-hero-meta">
          <div className="stat"><strong>Pre-launch</strong>Status</div>
          <div className="stat"><strong>Chicago, IL</strong>Launch market</div>
          <div className="stat"><strong>September 6, 2026</strong>Target date</div>
          <div className="stat"><strong>House + electronic</strong>Pilot focus</div>
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Executive Gate</div>
          <h2>Launch-ready means product, legal, and GTM all clear together.</h2>
          <p className="kicker">
            A public launch is only real when the app, the policies, and the city-specific go-to-market motion are all
            operational at the same time.
          </p>
        </div>

        <div className="launch-grid launch-grid-3">
          <article className="panel launch-card">
            <h3>Product Gates</h3>
            <ul className="launch-list">
              {productGates.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>

          <article className="panel launch-card">
            <h3>Legal and Compliance</h3>
            <ul className="launch-list">
              {legalGates.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>

          <article className="panel launch-card">
            <h3>Go-to-Market</h3>
            <ul className="launch-list">
              {gtmGates.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Core Pillars</div>
          <h2>The strongest operational ideas to keep from the full manual.</h2>
        </div>

        <div className="launch-grid launch-grid-2">
          {corePillars.map((pillar) => (
            <article className="panel launch-card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p className="artist-copy">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">90 / 60 / 30</div>
          <h2>Chicago pilot rollout and launch calendar.</h2>
        </div>

        <div className="launch-grid launch-grid-4">
          {roadmap.map((step) => (
            <article className="panel launch-card" key={step.phase}>
              <h3>{step.phase}</h3>
              <ul className="launch-list">
                {step.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Operating System</div>
          <h2>What needs to exist behind the product before a real launch.</h2>
        </div>

        <div className="launch-grid launch-grid-3">
          {operatingSystem.map((group) => (
            <article className="panel launch-card" key={group.title}>
              <h3>{group.title}</h3>
              <ul className="launch-list">
                {group.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Rift-Inspired Lessons</div>
          <h2>Best practices worth carrying into HYPE from transparency-first platform design.</h2>
        </div>

        <div className="launch-grid launch-grid-2">
          {transparencyLessons.map((lesson) => (
            <article className="panel launch-card" key={lesson.title}>
              <h3>{lesson.title}</h3>
              <p className="artist-copy">{lesson.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="launch-section-heading">
          <div className="badge">Risk Register</div>
          <h2>The risks worth tracking first, with concrete mitigations.</h2>
        </div>

        <div className="panel launch-card">
          <div className="launch-risk-table">
            <div className="launch-risk-head">Risk</div>
            <div className="launch-risk-head">Mitigation</div>
            {risks.map((risk) => (
              <div className="launch-risk-row" key={risk.name}>
                <strong>{risk.name}</strong>
                <span className="meta">{risk.mitigation}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="panel launch-card">
          <div className="badge">Guiding Principle</div>
          <h2>Integrity of hype matters more than artificial growth.</h2>
          <p className="subtitle">
            The strongest through-line in the package is that artist safety, rights, moderation quality, and credible
            demand signals are core product features. That principle is worth carrying into every launch decision.
          </p>
          <p className="meta">
            Operational and informational only, not legal or tax advice. Use counsel for final licensing, payment, and
            regulatory decisions.
          </p>
        </div>
      </section>
    </main>
  );
}
