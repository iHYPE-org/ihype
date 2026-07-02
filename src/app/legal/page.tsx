'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type TabId = 'privacy' | 'terms' | 'charter';

const TABS: { id: TabId; label: string }[] = [
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'charter', label: 'The Charter' },
];

const PRIVACY_SECTIONS = [
  {
    title: 'What we collect',
    body: 'iHYPE collects the minimum data necessary to operate: your email address, display name, role (fan/artist/venue/DJ), city, genre preferences, and ticket purchase history. We do not sell this data. We do not share it with advertisers. We do not use it to train AI models.',
  },
  {
    title: 'Payment data',
    body: 'Payments are processed by Apple Pay and Stripe. iHYPE never stores card numbers or bank account details. Payout routing information for artists and venues is encrypted at rest and visible only to you and our payments processor.',
  },
  {
    title: 'Analytics',
    body: 'We collect anonymous, aggregated usage data to understand how the app is used and improve it. This data cannot be used to identify you.',
  },
  {
    title: 'Referral links',
    body: 'When you share a referral link, we track click-throughs and purchases associated with that link to calculate your promoter pool share. This data is visible to you in your Pages dashboard.',
  },
  {
    title: 'Data rights (GDPR & CCPA)',
    body: 'If you’re in the EU/EEA/UK, you have rights under GDPR: access, rectification, erasure, portability, restriction, and objection to processing. California residents have equivalent rights under CCPA, including opting out of data sales (we don’t sell data, but the right still applies). Our lawful basis for processing is contract performance (running your account, tickets, and payouts) and legitimate interest (product analytics, fraud prevention). Exercise any of these rights in Support → Privacy (report a concern, request deletion, detach identity early, download your data) or email admin@ihype.org. We respond within 30 days.',
  },
  {
    title: 'Cookies',
    body: 'Essential cookies keep you signed in and remember your preferences — these can’t be turned off without breaking the app. Optional analytics cookies help us understand usage in aggregate; you can decline these from the consent banner. We do not use third-party advertising or tracking cookies.',
  },
  {
    title: 'Security',
    body: 'Data in transit is encrypted (TLS). Data at rest, including payout routing details, is encrypted. Access to user data is limited to the systems and staff that need it to operate the platform. We do not use your data to train AI models.',
  },
  {
    title: 'Contact',
    body: 'Privacy questions: admin@ihype.org',
  },
];

const TERMS_SECTIONS = [
  {
    title: 'Who can use iHYPE',
    body: 'You must be 13 or older to use iHYPE. To purchase tickets, you must be 18 or the age of majority in your jurisdiction. By creating an account you agree to these terms.',
  },
  {
    title: 'Tickets',
    body: 'All tickets are sold at face value. iHYPE charges $0 in platform fees — this is locked in our charter and cannot be changed. Ticket purchases are final. Refunds are issued only if an event is cancelled by the organizer.',
  },
  {
    title: 'The 45/45/10 split',
    body: 'Every ticket sold through iHYPE splits as follows: 45% to the artist, 45% to the venue, 10% to the promoter pool (distributed proportionally among referrers). iHYPE receives 0%. This is a founding constraint, not a policy — it cannot be altered by management, the board, or investors.',
  },
  {
    title: 'Promoter referrals',
    body: 'Any user may share a referral link to any event. If a ticket is purchased through your link, you receive your proportional share of the 10% promoter pool. Manipulating referral tracking (e.g. purchasing through your own link) is prohibited and will result in account termination.',
  },
  {
    title: 'Content',
    body: 'You are responsible for content you post (artist pages, radio shows, event listings). You grant iHYPE a non-exclusive license to display this content within the platform. iHYPE does not claim ownership of your music, images, or likeness.',
  },
  {
    title: 'Refunds',
    body: 'Ticket prices are final. Refunds are issued only if a show is cancelled by the organizer; refund requests for cancelled shows must be made within 14 days. There are no refunds for personal reasons.',
  },
  {
    title: 'Limitation of liability',
    body: 'iHYPE provides the platform "as is." We are not liable for lost data, service interruptions, or shows cancelled or altered by venues or artists.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these terms. Material changes will be announced at least 30 days in advance. Continued use after a change means you accept it.',
  },
  {
    title: 'Termination',
    body: 'We may suspend or delete your account if you violate these terms. You can delete your account at any time from Settings.',
  },
  {
    title: 'Contact',
    body: 'Legal questions: admin@ihype.org',
  },
];

const CHARTER_SECTIONS = [
  {
    title: 'The founding constraint',
    body: 'iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales. This commitment is embedded in the company’s founding documents and cannot be amended by management, board resolution, investor pressure, or acquisition.',
  },
  {
    title: 'The split',
    body: '45% artist · 45% venue · 10% promoters · 0% iHYPE. This is not a pricing strategy. It is a constraint. We built the business model around it, not the other way around.',
  },
  {
    title: 'Why lock it in?',
    body: 'Because every platform that started with good intentions eventually faced a moment where fees made sense. We wanted to make that conversation impossible. The charter is the answer to "what if the company needs revenue?" — the answer is: find another way. Not this.',
  },
  {
    title: 'What "locked in" means',
    body: 'The 45/45/10 split is a condition of incorporation. Changing it would require dissolving the company and re-incorporating under a different structure. No board vote, no shareholder approval, no acquisition clause overrides it. See the full Charter at /charter.',
  },
];

const SECTIONS: Record<TabId, { title: string; body: string }[]> = {
  privacy: PRIVACY_SECTIONS,
  terms: TERMS_SECTIONS,
  charter: CHARTER_SECTIONS,
};

function LegalTabs() {
  const searchParams = useSearchParams();
  const initialTab = TABS.some((t) => t.id === searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'privacy';
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <main className="container section trust-policy-page">
      <section className="panel trust-policy-hero">
        <div className="badge">Legal</div>
        <h1>Policies &amp; terms.</h1>
        <p className="subtitle">Last updated: June 20, 2026 · iHYPE · Portland, ME</p>

        <div style={{ display: 'flex', gap: 0, borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden', width: 'fit-content', marginTop: '1.25rem' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '9px 20px', border: 'none', cursor: 'pointer',
                fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 800, fontSize: '0.82rem',
                background: tab === t.id ? 'rgba(255,80,41,0.1)' : 'transparent',
                color: tab === t.id ? 'var(--accent, #ff5029)' : 'var(--ink-2, #9e9080)',
                transition: 'all 150ms',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="trust-policy-links">
          <Link className="text-link" href="/copyright">Copyright</Link>
          <Link className="text-link" href="/ticket-policy">Ticket policy</Link>
          <Link className="text-link" href="/community-rules">Community rules</Link>
          <Link className="text-link" href="/about">About iHYPE</Link>
          <Link className="text-link" href="/support">Support</Link>
        </div>
      </section>

      <section className="grid trust-policy-grid">
        {SECTIONS[tab].map((section) => (
          <article className="card trust-policy-card" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function LegalPage() {
  return (
    <Suspense fallback={null}>
      <LegalTabs />
    </Suspense>
  );
}
