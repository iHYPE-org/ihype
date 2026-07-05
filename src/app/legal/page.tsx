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

function LegalTabs() {
  const searchParams = useSearchParams();
  const initialTab = TABS.some((t) => t.id === searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'privacy';
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <div className="legal-wrap">
      <div className="legal-label">Legal</div>
      <h1 className="legal-h1">Policies &amp; terms.</h1>
      <p className="legal-updated">Last updated: June 20, 2026 · iHYPE · Portland, ME</p>

      <div className="legal-seg">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`legal-seg-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={`legal-doc${tab === 'privacy' ? ' active' : ''}`}>
        <h2>What we collect</h2>
        <p>iHYPE collects the minimum data necessary to operate: your email address, display name, role (fan/artist/venue/DJ), city, genre preferences, and ticket purchase history. We do not sell this data. We do not share it with advertisers. We do not use it to train AI models.</p>
        <h2>Payment data</h2>
        <p>Payments are processed by Apple Pay and Stripe. iHYPE never stores card numbers or bank account details. Payout routing information for artists and venues is encrypted at rest and visible only to you and our payments processor.</p>
        <h2>Analytics</h2>
        <p>We collect anonymous, aggregated usage data to understand how the app is used and improve it. This data cannot be used to identify you. You can opt out in Settings → Privacy.</p>
        <h2>Referral links</h2>
        <p>When you share a referral link, we track click-throughs and purchases associated with that link to calculate your promoter pool share. This data is visible to you in your Pages dashboard.</p>
        <h2>Data rights (GDPR &amp; CCPA)</h2>
        <p>
          If you&apos;re in the EU/EEA/UK, you have rights under GDPR: access, rectification, erasure, portability, restriction, and objection to processing. California residents have equivalent rights under CCPA, including opting out of data sales (we don&apos;t sell data, but the right still applies). Our lawful basis for processing is contract performance (running your account, tickets, and payouts) and legitimate interest (product analytics, fraud prevention). Exercise any of these rights instantly in <Link href="/support">Support → Privacy</Link> (report a concern, request deletion, detach identity early, download your data) or email <a href="mailto:admin@ihype.org">admin@ihype.org</a>. We respond within 30 days.
        </p>
        <h2>Cookies</h2>
        <p>Essential cookies keep you signed in and remember your preferences — these can&apos;t be turned off without breaking the app. Optional analytics cookies help us understand usage in aggregate; you can decline these from the consent banner or reset your choice by clearing site data. We do not use third-party advertising or tracking cookies.</p>
        <h2>Security</h2>
        <p>Data in transit is encrypted (TLS). Data at rest, including payout routing details, is encrypted. Access to user data is limited to the systems and staff that need it to operate the platform. We do not use your data to train AI models.</p>
        <h2>Contact</h2>
        <p>Privacy questions: <a href="mailto:admin@ihype.org">admin@ihype.org</a></p>
      </div>

      <div className={`legal-doc${tab === 'terms' ? ' active' : ''}`}>
        <h2>Who can use iHYPE</h2>
        <p>You must be 13 or older to use iHYPE. To purchase tickets, you must be 18 or the age of majority in your jurisdiction. By creating an account you agree to these terms.</p>
        <h2>Tickets</h2>
        <p>All tickets are sold at face value. iHYPE charges $0 in platform fees — this is locked in our charter and cannot be changed. Ticket purchases are final. Refunds are issued only if an event is cancelled by the organizer.</p>
        <h2>The 45/45/10 split</h2>
        <p>Every ticket sold through iHYPE splits as follows: 45% to the artist, 45% to the venue, 10% to the promoter pool (distributed proportionally among referrers). iHYPE receives 0%. This is a founding constraint, not a policy — it cannot be altered by management, the board, or investors.</p>
        <h2>Promoter referrals</h2>
        <p>Any user may share a referral link to any event. If a ticket is purchased through your link, you receive your proportional share of the 10% promoter pool. Manipulating referral tracking (e.g. purchasing through your own link) is prohibited and will result in account termination.</p>
        <h2>Content</h2>
        <p>You are responsible for content you post (artist pages, radio shows, event listings). You grant iHYPE a non-exclusive license to display this content within the platform. iHYPE does not claim ownership of your music, images, or likeness.</p>
        <h2>Refunds</h2>
        <p>Ticket prices are final. Refunds are issued only if a show is cancelled by the organizer; refund requests for cancelled shows must be made within 14 days. There are no refunds for personal reasons.</p>
        <h2>Limitation of liability</h2>
        <p>iHYPE provides the platform &quot;as is.&quot; We are not liable for lost data, service interruptions, or shows cancelled or altered by venues or artists.</p>
        <h2>Changes to these terms</h2>
        <p>We may update these terms. Material changes will be announced at least 30 days in advance. Continued use after a change means you accept it.</p>
        <h2>Termination</h2>
        <p>We may suspend or delete your account if you violate these terms. You can delete your account at any time from Settings.</p>
        <h2>Contact</h2>
        <p>Legal questions: <a href="mailto:admin@ihype.org">admin@ihype.org</a></p>
      </div>

      <div className={`legal-doc${tab === 'charter' ? ' active' : ''}`}>
        <h2>The problem we built this to fix</h2>
        <p>Pay-to-play has quietly broken live music. Venues need to book artists people will actually pay to see — but have no way to know that themselves, so they lean on promoters chasing their own cut, and ticket platforms tack fees on top of that. What&apos;s left barely covers the room, or loses money outright. Fans never hear about new artists. Artists can&apos;t afford to keep making music. Venues stop booking altogether. iHYPE exists to break that cycle.</p>
        <h2>The founding constraint</h2>
        <p>iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales. This commitment is embedded in the company&apos;s founding documents and cannot be amended by management, board resolution, investor pressure, or acquisition.</p>
        <h2>The split</h2>
        <p className="legal-split-display">45% artist · 45% venue · 10% promoters · 0% iHYPE.</p>
        <p>This is not a pricing strategy. It is a constraint. We built the business model around it, not the other way around. Anyone can get paid to promote a show through their own referral link — real word-of-mouth income, not payola.</p>
        <h2>Open by design</h2>
        <p>Our code and our moderation heuristics are published for public audit. Nothing about how the split is calculated, how uploads are screened, or how the platform ranks anything is a secret — anyone can check that it does exactly what we say.</p>
        <h2>Your data is never for sale</h2>
        <p>iHYPE does not aggregate user data for resale and never sells it to advertisers or anyone else — not now, not after an acquisition. This is a charter commitment, not a policy that can be quietly reversed. See our <Link href="/legal?tab=privacy">Privacy Policy</Link> for exactly what we collect and why.</p>
        <h2>You get a vote</h2>
        <p>Users of iHYPE are treated as stakeholders, not just customers. Meaningful changes to the platform — the split, moderation rules, new fees of any kind — are put to the people who use it, with feedback built into every release.</p>
        <h2>Funded like radio, not like Big Tech</h2>
        <p>iHYPE is funded entirely by advertising, the same way terrestrial radio has always worked — and those ads are restricted to music-related sources only, forever. No user-data resale funds this platform, and no other category of advertiser will ever be let in to change that.</p>
        <h2>Why so few people run this</h2>
        <p>iHYPE is run by two people, leaning on AI automation to keep operating costs at the absolute minimum. That&apos;s deliberate: a lean operation is a sustainable operation, and there&apos;s no boardroom of investors around to talk us into breaking any of the above.</p>
        <h2>Why lock it in?</h2>
        <p>Because every platform that started with good intentions eventually faced a board meeting where fees made sense. We wanted to make that conversation impossible. The charter is the answer to &quot;what if the company needs revenue?&quot; — the answer is: find another way. Not this.</p>
        <h2>What &quot;locked in&quot; means</h2>
        <p>The 45/45/10 split is a condition of incorporation. Changing it would require dissolving the company and re-incorporating under a different structure. No board vote, no shareholder approval, no acquisition clause overrides it.</p>
      </div>

      <style>{`
        .legal-wrap { max-width: 760px; margin: 0 auto; padding: 3rem 2rem 6rem; }
        .legal-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: .65rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px; }
        .legal-h1 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: clamp(1.75rem, 6vw, 2.4rem); letter-spacing: -.04em; line-height: .95; margin-bottom: .75rem; color: var(--ink); }
        @media (max-width: 480px) {
          .legal-wrap { padding: 2rem 1.1rem 4rem; }
        }
        .legal-updated { font-size: .9rem; color: var(--ink-2); line-height: 1.75; margin-bottom: .85rem; }
        .legal-seg { display: flex; gap: 0; border-radius: 12px; border: 1px solid var(--line); max-width: 100%; overflow-x: auto; margin-bottom: 2.5rem; width: fit-content; }
        .legal-seg-btn { padding: 9px 20px; border: none; background: transparent; color: var(--ink-2); font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: .82rem; cursor: pointer; transition: all .15s; white-space: nowrap; flex-shrink: 0; }
        @media (max-width: 480px) {
          .legal-seg { width: 100%; border-radius: 10px; }
          .legal-seg-btn { flex: 1; padding: 8px 6px; font-size: .68rem; line-height: 1.25; text-align: center; white-space: normal; min-height: 44px; display: flex; align-items: center; justify-content: center; }
        }
        .legal-seg-btn.active { background: rgba(255,80,41,.1); color: var(--accent); }
        .legal-doc { display: none; }
        .legal-doc.active { display: block; }
        .legal-doc h2 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 1.15rem; letter-spacing: -.02em; margin: 2.5rem 0 .6rem; color: var(--ink); }
        .legal-doc p { font-size: .9rem; color: var(--ink-2); line-height: 1.75; margin-bottom: .85rem; }
        .legal-doc a { color: var(--accent); }
        .legal-split-display { font-family: var(--f-d, 'Syne', sans-serif) !important; font-weight: 800; font-size: 1.5rem; letter-spacing: -.03em; color: var(--ink) !important; line-height: 1.3; margin: 1rem 0 !important; }
        @media print {
          .legal-seg { display: none !important; }
          html, body { background: #fff !important; color: #111 !important; }
          .legal-wrap { max-width: 100% !important; padding: 1.5rem !important; }
          .legal-h1, .legal-doc h2 { color: #111 !important; }
          .legal-doc p { color: #333 !important; }
          .legal-doc a { color: #111 !important; text-decoration: underline; }
        }
      `}</style>
    </div>
  );
}

export default function LegalPage() {
  return (
    <Suspense fallback={null}>
      <LegalTabs />
    </Suspense>
  );
}
