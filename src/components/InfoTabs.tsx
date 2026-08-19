'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

type TabId = 'trust' | 'transparency' | 'privacy' | 'terms' | 'charter' | 'dmca';

const TABS: { id: TabId; label: string }[] = [
  { id: 'trust', label: 'Trust & Safety' },
  { id: 'transparency', label: 'Transparency' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'charter', label: 'The Charter' },
  { id: 'dmca', label: 'DMCA' },
];

/**
 * Trust & Safety and Transparency are server components with live Prisma
 * aggregates, so they are handed in as already-rendered slots rather than
 * imported here — a client component cannot query the database. Same shape
 * the /payouts hub uses for its panels.
 */
type InfoTabsProps = { trustPanel: ReactNode; transparencyPanel: ReactNode };

function InfoTabs({ trustPanel, transparencyPanel }: InfoTabsProps) {
  const searchParams = useSearchParams();
  const paramTab = searchParams.get('tab');
  const initialTab = TABS.some((tb) => tb.id === paramTab) ? (paramTab as TabId) : 'trust';
  const [tab, setTab] = useState<TabId>(initialTab);
  const { t, locale } = useI18n();

  // Arriving at /info?tab=privacy from somewhere else on /info is a soft nav:
  // the route is unchanged, so React keeps this component mounted and the
  // useState initialiser above never runs again. Without this the tab silently
  // stays where it was — which is what the charter tab's own "Privacy Policy"
  // link did.
  useEffect(() => {
    if (TABS.some((tb) => tb.id === paramTab)) setTab(paramTab as TabId);
  }, [paramTab]);

  const activeIndex = TABS.findIndex((tb) => tb.id === tab);
  const tabLabel = (i: number) => t(`legalPage.tabLabel${i}`, TABS[i].label);

  // Roving focus, per the design system's ARIA-patterns card: a tablist is one
  // tab stop and the arrow keys move within it. Home/End jump to the ends.
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    let next = -1;
    if (delta !== 0) next = (activeIndex + delta + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`legal-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div className="legal-wrap">
      <div className="legal-label">{t('infoPage.label', 'Info')}</div>
      {/* The heading names the DOCUMENT, not the hub. It used to read "How
          iHYPE works, in public." on all six tabs, which is a hierarchy
          problem on screen and a correctness one on paper: the print rules
          below hide the tab strip, so "Print / Save as PDF" on the Privacy tab
          produced a PDF that named the policy nowhere at all. The hub sentence
          is not lost — it is the standfirst underneath, which is what
          Instrument Serif is reserved for (editorial only). */}
      <h1 className="legal-h1">{tabLabel(activeIndex)}</h1>
      <p className="legal-standfirst">{t('infoPage.heading', 'How iHYPE works, in public.')}</p>
      <div className="legal-updated-row">
        <p className="legal-updated">{t('legalPage.lastUpdated', 'Last updated: June 20, 2026 · iHYPE · Portland, ME')}</p>
        <button className="legal-print-btn" onClick={() => window.print()} type="button">{t('legalPage.printButton', 'Print / Save as PDF')}</button>
      </div>

      <div className="legal-seg" role="tablist" aria-label={t('infoPage.label', 'Info')}>
        {TABS.map((tb, i) => (
          <button
            key={tb.id}
            id={`legal-tab-${tb.id}`}
            role="tab"
            type="button"
            aria-selected={tab === tb.id}
            aria-controls={`legal-panel-${tb.id}`}
            tabIndex={tab === tb.id ? 0 : -1}
            className={`legal-seg-btn${tab === tb.id ? ' active' : ''}`}
            onClick={() => setTab(tb.id)}
            onKeyDown={onTabKeyDown}
          >
            {tabLabel(i)}
          </button>
        ))}
      </div>

      {/* The policies are translated into 12 locales and only one of them is
          the text that binds. Specified by `templates/legal/` (`lgTransNotice`)
          and rendered by nothing until now. */}
      {locale !== 'en' && (
        <div className="legal-trans-notice">
          <p>{t('infoPage.translationNotice', 'This translation is provided for convenience. The English version of these policies is the legally binding text.')}</p>
        </div>
      )}

      <div className={`legal-doc${tab === 'trust' ? ' active' : ''}`} role="tabpanel" id="legal-panel-trust" aria-labelledby="legal-tab-trust">
        {trustPanel}
      </div>

      <div className={`legal-doc${tab === 'transparency' ? ' active' : ''}`} role="tabpanel" id="legal-panel-transparency" aria-labelledby="legal-tab-transparency">
        {transparencyPanel}
      </div>

      <div className={`legal-doc legal-doc-prose${tab === 'privacy' ? ' active' : ''}`} role="tabpanel" id="legal-panel-privacy" aria-labelledby="legal-tab-privacy">
        <h2>{t('legalPage.privacy.collectTitle', 'What we collect')}</h2>
        <p>{t('legalPage.privacy.collectBody', 'iHYPE collects the minimum data necessary to operate: your email address, display name, account role, city, genre preferences, and ticket purchase history. We do not sell this data. We do not share it with advertisers. We do not use it to train AI models.')}</p>
        <h2>{t('legalPage.privacy.paymentTitle', 'Payment data')}</h2>
        <p>{t('legalPage.privacy.paymentBody', 'Payments are processed by Apple Pay and Stripe. iHYPE never stores card numbers or bank account details. Payout routing information for artists and venues is encrypted at rest and visible only to you and our payments processor.')}</p>
        <h2>{t('legalPage.privacy.analyticsTitle', 'Analytics')}</h2>
        <p>{t('legalPage.privacy.analyticsBody', 'We collect anonymous, aggregated usage data to understand how the app is used and improve it. This data cannot be used to identify you. You can opt out in Settings → Privacy.')}</p>
        <h2>{t('legalPage.privacy.referralTitle', 'Referral links')}</h2>
        <p>{t('legalPage.privacy.referralBody', 'When you share a referral link, we track click-throughs and purchases associated with that link to calculate your promoter pool share. This data is visible to you in your Pages dashboard.')}</p>
        <h2>{t('legalPage.privacy.rightsTitle', 'Data rights (GDPR & CCPA)')}</h2>
        <p>
          {t('legalPage.privacy.rightsBodyIntro', "If you're in the EU/EEA/UK, you have rights under GDPR: access, rectification, erasure, portability, restriction, and objection to processing. California residents have equivalent rights under CCPA, including opting out of data sales (we don't sell data, but the right still applies). Our lawful basis for processing is contract performance (running your account, tickets, and payouts) and legitimate interest (product analytics, fraud prevention). Exercise any of these rights instantly in")} <Link href="/support">{t('legalPage.privacy.supportPrivacyLink', 'Support → Privacy')}</Link> {t('legalPage.privacy.rightsBodyOutro', '(report a concern, request deletion, detach identity early, download your data) or email')} <a href="mailto:admin@ihype.org">admin@ihype.org</a>. {t('legalPage.privacy.rightsBodyClose', 'We respond within 30 days.')}
        </p>
        <h2>{t('legalPage.privacy.cookiesTitle', 'Cookies')}</h2>
        <p>{t('legalPage.privacy.cookiesBody', "Essential cookies keep you signed in and remember your preferences — these can't be turned off without breaking the app. Optional analytics cookies help us understand usage in aggregate; you can decline these from the consent banner or reset your choice by clearing site data. We do not use third-party advertising or tracking cookies.")}</p>
        <h2>{t('legalPage.privacy.securityTitle', 'Security')}</h2>
        <p>{t('legalPage.privacy.securityBody', 'Data in transit is encrypted (TLS). Data at rest, including payout routing details, is encrypted. Access to user data is limited to the systems and staff that need it to operate the platform. We do not use your data to train AI models.')}</p>
        <h2>{t('legalPage.privacy.subprocessorsTitle', 'Subprocessors')}</h2>
        <p>{t('legalPage.privacy.subprocessorsIntro', 'We use a small number of vendors to run iHYPE, each bound by its own data protection terms:')} <strong>Stripe</strong> {t('legalPage.privacy.subprocessorsStripe', '(payment processing and artist/venue payouts — holds card and bank details, iHYPE never does)')}, <strong>Supabase</strong> {t('legalPage.privacy.subprocessorsSupabase', '(database hosting)')}, <strong>Cloudflare</strong> {t('legalPage.privacy.subprocessorsCloudflare', '(application hosting, media storage, and bot protection)')}, <strong>Resend</strong> {t('legalPage.privacy.subprocessorsResend', '(delivering account and notification emails)')}, {t('legalPage.privacy.subprocessorsAnd', 'and')} <strong>Sentry</strong> {t('legalPage.privacy.subprocessorsSentry', '(error monitoring, configured to exclude personal data from reports)')}. {t('legalPage.privacy.subprocessorsOutro', 'None of these vendors may use your data for their own purposes.')}</p>
        <h2>{t('legalPage.privacy.contactTitle', 'Contact')}</h2>
        <p>{t('legalPage.privacy.contactBody', 'Privacy questions:')} <a href="mailto:admin@ihype.org">admin@ihype.org</a></p>
      </div>

      <div className={`legal-doc legal-doc-prose${tab === 'terms' ? ' active' : ''}`} role="tabpanel" id="legal-panel-terms" aria-labelledby="legal-tab-terms">
        <h2>{t('legalPage.terms.whoTitle', 'Who can use iHYPE')}</h2>
        <p>{t('legalPage.terms.whoBody', 'You must be 13 or older to use iHYPE. To purchase tickets, you must be 18 or the age of majority in your jurisdiction. By creating an account you agree to these terms.')}</p>
        <h2>{t('legalPage.terms.ticketsTitle', 'Tickets')}</h2>
        <p>{t('legalPage.terms.ticketsBody', 'All tickets are sold at face value. iHYPE charges $0 in platform fees — this is locked in our charter and cannot be changed. Ticket purchases are final. Refunds are issued only if an event is cancelled by the organizer.')}</p>
        <h2>{t('legalPage.terms.splitTitle', 'The 70/20/10 split')}</h2>
        <p>{t('legalPage.terms.splitBody', 'Every ticket sold through iHYPE splits as follows: 70% to the artist, 20% to the venue, 10% to the promoter pool (distributed proportionally among referrers). iHYPE receives 0%. This is a founding constraint, not a policy — it cannot be altered by management, the board, or investors.')}</p>
        <h2>{t('legalPage.terms.referralsTitle', 'Promoter referrals')}</h2>
        <p>{t('legalPage.terms.referralsBody', 'Fans and DJs may share a HYPE Link to any event. If a ticket is purchased through your link, you receive your proportional share of the 10% promoter pool. Manipulating referral tracking (e.g. purchasing through your own link) is prohibited and will result in account termination.')}</p>
        <h2>{t('legalPage.terms.contentTitle', 'Content')}</h2>
        <p>{t('legalPage.terms.contentBody', 'You are responsible for content you post (artist pages, radio shows, event listings). You grant iHYPE a non-exclusive license to display this content within the platform. iHYPE does not claim ownership of your music, images, or likeness.')}</p>
        <h2>{t('legalPage.terms.refundsTitle', 'Refunds')}</h2>
        <p>{t('legalPage.terms.refundsBody', 'Ticket prices are final. Refunds are issued only if a show is cancelled by the organizer; refund requests for cancelled shows must be made within 14 days. There are no refunds for personal reasons.')}</p>
        <h2>{t('legalPage.terms.liabilityTitle', 'Limitation of liability')}</h2>
        <p>{t('legalPage.terms.liabilityBody', 'iHYPE provides the platform "as is." We are not liable for lost data, service interruptions, or shows cancelled or altered by venues or artists.')}</p>
        <h2>{t('legalPage.terms.changesTitle', 'Changes to these terms')}</h2>
        <p>{t('legalPage.terms.changesBody', 'We may update these terms. Material changes will be announced at least 30 days in advance. Continued use after a change means you accept it.')}</p>
        <h2>{t('legalPage.terms.terminationTitle', 'Termination')}</h2>
        <p>{t('legalPage.terms.terminationBody', 'We may suspend or delete your account if you violate these terms. You can delete your account at any time from Settings.')}</p>
        <h2>{t('legalPage.terms.contactTitle', 'Contact')}</h2>
        <p>{t('legalPage.terms.contactBody', 'Legal questions:')} <a href="mailto:admin@ihype.org">admin@ihype.org</a></p>
      </div>

      <div className={`legal-doc legal-doc-prose${tab === 'charter' ? ' active' : ''}`} role="tabpanel" id="legal-panel-charter" aria-labelledby="legal-tab-charter">
        <h2>{t('legalPage.charter.problemTitle', 'The problem we built this to fix')}</h2>
        <p>{t('legalPage.charter.problemBody', "We built iHYPE after living this problem as a band that went to New York City to try to make it. We had to pay to play, accept exposure-only gigs, find fans ourselves, find venues ourselves, and watch everyone take a piece. That system asks musicians to do every job except make music, while fans still struggle to discover them. iHYPE connects local discovery, genuine fan demand, booking, and ticket income so artists, venues, and DJs can spend less time fighting the system and more time building the scene.")}</p>
        <h2>{t('legalPage.charter.constraintTitle', 'The founding constraint')}</h2>
        <p>{t('legalPage.charter.constraintBody', "iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales. This commitment is embedded in the company's founding documents and cannot be amended by management, board resolution, investor pressure, or acquisition.")}</p>
        <h2>{t('legalPage.charter.splitTitle', 'The split')}</h2>
        {/* Static bar and static percentages, unlike the standalone /charter
            page this was folded in from. That version counted up from 0 when an
            IntersectionObserver fired — inside a tab panel that starts hidden,
            a missed observer would leave the platform's defining number reading
            "0% artist · 0% venue · 0% promoters". Not a trade worth an
            animation. */}
        <div className="charter-split-bar" aria-hidden="true">
          <div style={{ flex: 70, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
          <div style={{ flex: 20, background: 'var(--role-venue)' }} />
          <div style={{ flex: 10, background: 'var(--role-fan)' }} />
        </div>
        <p className="legal-split-display">{t('legalPage.charter.splitDisplay', '70% artist · 20% venue · 10% promoters · 0% iHYPE.')}</p>
        <div className="charter-callout">
          <p>{t('legalPage.charter.splitBody', 'This is not a pricing strategy. It is a constraint. We built the business model around it, not the other way around. Anyone can get paid to promote a show through their own referral link — real word-of-mouth income, not payola.')}</p>
        </div>
        <h2>{t('charterPage.promotersHead', 'Promoters and the 10%')}</h2>
        <p>{t('charterPage.promotersBody', "The 10% promoter pool is distributed among everyone whose HYPE Links contributed to ticket sales for an event. There is no promoter role and no promoter account: promoting is something every account can do.")}</p>
        <p><Link href="/me/promote" className="charter-inline-link">{t('charterPage.promoteDashboardLink', 'See a promoting dashboard →')}</Link></p>
        <h2>{t('legalPage.charter.openTitle', 'Open by design')}</h2>
        <p>{t('legalPage.charter.openBody', 'Our code and our moderation heuristics are published for public audit. Nothing about how the split is calculated, how uploads are screened, or how the platform ranks anything is a secret — anyone can check that it does exactly what we say.')}</p>
        <h2>{t('legalPage.charter.dataTitle', 'Your data is never for sale')}</h2>
        <p>{t('legalPage.charter.dataBodyIntro', 'iHYPE does not aggregate user data for resale and never sells it to advertisers or anyone else — not now, not after an acquisition. This is a charter commitment, not a policy that can be quietly reversed. See our')} <Link href="/info?tab=privacy">{t('legalPage.charter.privacyPolicyLink', 'Privacy Policy')}</Link> {t('legalPage.charter.dataBodyOutro', 'for exactly what we collect and why.')}</p>
        <h2>{t('legalPage.charter.voteTitle', 'You get a vote')}</h2>
        <p>{t('legalPage.charter.voteBody', 'Fan users are treated as stakeholders, not just customers. Every proposed product feature change is put through a vote on the Community page, where every fan account gets a voice. The result becomes part of the public product record so platform direction cannot be quietly rewritten behind closed doors.')}</p>
        <p><Link href="/community" className="charter-inline-link">{t('legalPage.charter.communityVoteLink', 'See Community proposals and votes →')}</Link></p>
        <h2>{t('legalPage.charter.boardTitle', 'Independent annual oversight')}</h2>
        <p>{t('legalPage.charter.boardBody', 'A three-person corporate board, whose members are unrelated to the two founders, performs annual checks and balances over the organization. The board reviews governance, finances, compensation, compliance, and mission alignment. It retains the fiduciary responsibilities required of a nonprofit board; community feature votes govern product direction without replacing those legal duties.')}</p>
        <h2>{t('legalPage.charter.fundedTitle', 'Funded like radio, not like Big Tech')}</h2>
        <p>{t('legalPage.charter.fundedBody', 'iHYPE is funded entirely by advertising, the same way terrestrial radio has always worked — and those ads are restricted to music-related sources only, forever. No user-data resale funds this platform, and no other category of advertiser will ever be let in to change that.')}</p>
        <h2>{t('legalPage.charter.nonprofitTitle', 'A scene-run 501(c)(3)')}</h2>
        <p>{t('legalPage.charter.nonprofitBody', 'iHYPE is a certified 501(c)(3) philanthropic platform. It has no outside owners waiting for a return and no investor distribution hiding behind the mission. Revenue exists to keep the infrastructure working, compensate the small team fairly, and advance the local-music mission.')}</p>
        <h2>{t('legalPage.charter.revenueTitle', 'Where advertising revenue goes')}</h2>
        <ol>
          <li>{t('legalPage.charter.revenueInfrastructure', 'First: infrastructure and necessary operating vendors — hosting, storage, email, payments, security, monitoring, and the tools required to keep iHYPE reliable.')}</li>
          <li>{t('legalPage.charter.revenueCompensation', 'Second, only when sustainably affordable: fair, fully disclosed compensation for the two employees who operate the platform. iHYPE may never be large enough to become their only employment; the goal is eventually to let both founders focus on it full-time so its systems, privacy, and local-scene mission remain protected for the long term. The intended all-in ceiling is $100,000 per employee per year, including benefits, and actual compensation must still be reasonable for the work and the organization’s circumstances.')}</li>
          <li>{t('legalPage.charter.revenueMission', 'Then: remaining resources stay with the mission — improving the platform and strengthening local scenes. They are not distributed to founders, investors, or private owners.')}</li>
        </ol>
        <p>{t('legalPage.charter.compensationGovernance', 'The ceiling is not a target, entitlement, or promise of payment. Founder compensation will not be self-approved. It must be approved in advance by conflict-free members of the independent three-person board using appropriate comparable compensation data, documented at the time of approval, reviewed through the board’s annual checks and balances, and published through iHYPE’s transparency reporting.')}</p>
        {/* Only the part /charter said that this tab did not. Its full
            paragraph opened with the same sentence as fundedBody above, so
            folding it in verbatim would have printed that sentence twice. */}
        <p>{t('legalPage.charter.processingFeeBody', 'None of it touches the ticket split. Tickets are processed directly through Stripe; the card-processing fee (2.9% + $0.30; AMEX 3.5% + $0.30) is the only charge above face value, passed through at cost.')}</p>
        <p><Link href="/advertise" className="charter-inline-link">{t('charterPage.advertisingLink', 'See how advertising works →')}</Link></p>
        <h2>{t('legalPage.charter.leanTitle', 'Why so few people run this')}</h2>
        <p>{t('legalPage.charter.leanBody', "iHYPE is run by two people, leaning on AI automation to keep operating costs at the absolute minimum. That's deliberate: a lean operation is a sustainable operation, and there's no boardroom of investors around to talk us into breaking any of the above.")}</p>
        <h2>{t('legalPage.charter.whyLockTitle', 'Why lock it in?')}</h2>
        <p>{t('legalPage.charter.whyLockBody', 'Because every platform that started with good intentions eventually faced a board meeting where fees made sense. We wanted to make that conversation impossible. The charter is the answer to "what if the company needs revenue?" — the answer is: find another way. Not this.')}</p>
        <h2>{t('legalPage.charter.lockedMeansTitle', 'What "locked in" means')}</h2>
        <p>{t('legalPage.charter.lockedMeansBody', 'The 70/20/10 split is a condition of incorporation. Changing it would require dissolving the company and re-incorporating under a different structure. No board vote, no shareholder approval, no acquisition clause overrides it.')}</p>
        <h2>{t('charterPage.makesRealHead', 'What actually makes this real')}</h2>
        <p>{t('charterPage.makesRealBody', 'A charter is just a promise on paper until a fan buys a ticket. Every dollar that hits this split exists because someone hyped an artist, showed up, and paid face value instead of going through a scalper. Artists write the songs, venues open the doors — but fans are the ones who make the 70/20/10 mean anything at all.')}</p>
        <p><Link href="/info?tab=transparency" className="charter-inline-link">{t('charterPage.transparencyLink', 'See it in the live numbers →')}</Link></p>
        <h2>{t('legalPage.terms.contactTitle', 'Contact')}</h2>
        <p>
          {t('charterPage.questionsPrefix', 'Questions about the charter:')} <a href="mailto:admin@ihype.org">admin@ihype.org</a><br />
          {t('charterPage.footerCompanyLine', 'iHYPE Inc. · Founded Portland, ME · 2026 ·')} <a href="https://ihype.org">ihype.org</a>
        </p>
      </div>

      <div className={`legal-doc legal-doc-prose${tab === 'dmca' ? ' active' : ''}`} role="tabpanel" id="legal-panel-dmca" aria-labelledby="legal-tab-dmca">
        <h2>{t('legalPage.dmca.title', 'DMCA & copyright takedown')}</h2>
        <p>{t('legalPage.dmca.intro', 'iHYPE is built for independent music, so rights handling is clear and serious. Do not upload songs, artwork, samples, or logos unless you own them or have permission to use them on iHYPE. Uploads are screened by AI on submission, and rights holders can report unauthorized media at any time.')}</p>
        <h2>{t('legalPage.dmca.howToFileTitle', 'How to file a takedown')}</h2>
        <p>{t('legalPage.dmca.howToFileBodyIntro', 'To report infringing content, email')} <a href="mailto:admin@ihype.org">admin@ihype.org</a> {t('legalPage.dmca.howToFileBodyOutro', 'with your contact details, the infringing URL (e.g.')} <em>ihype.org/tracks/…</em>{t('legalPage.dmca.howToFileBodyEnd', '), a description of your original work, and a good-faith statement that you are the rights holder or authorized to act for them. We acknowledge every valid request within 48 hours and remove confirmed infringing content within 5 business days.')}</p>
        <h2>{t('legalPage.dmca.counterNoticeTitle', 'Counter-notice & repeat infringers')}</h2>
        <p>{t('legalPage.dmca.counterNoticeBody', 'If your content was removed and you believe it was in error, you may submit a counter-notice to the same address. Accounts that repeatedly upload unauthorized content lose upload privileges and may be terminated. Knowingly false claims may carry legal liability.')}</p>
        <h2>{t('legalPage.dmca.contactTitle', 'Contact')}</h2>
        <p>{t('legalPage.dmca.contactBody', 'DMCA agent:')} <a href="mailto:admin@ihype.org">admin@ihype.org</a> · {t('legalPage.dmca.contactLocation', 'iHYPE Inc., Portland, ME')}</p>
      </div>

      <style>{`
        .legal-wrap { max-width: 760px; margin: 0 auto; padding: 3rem 2rem 6rem; }
        .legal-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: .65rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px; }
        .legal-h1 { font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: clamp(1.75rem, 6vw, 2.4rem); letter-spacing: -.04em; line-height: .95; margin-bottom: .75rem; color: var(--ink); }
        @media (max-width: 480px) {
          .legal-wrap { padding: 2rem 1.1rem 4rem; }
        }
        /* Instrument Serif, italic — the design system reserves it for
           editorial voice, and the hub's one-line statement of intent is
           exactly that. It was the h1 until the heading was given to the
           document; nothing about the sentence changed. */
        .legal-standfirst { font-family: var(--f-s, 'Instrument Serif', serif); font-style: italic; font-size: 1.12rem; line-height: 1.45; color: var(--ink-2); margin: 0 0 1.1rem; }
        .legal-updated { font-size: .9rem; color: var(--ink-2); line-height: 1.75; margin-bottom: 0; }
        /* Reads before any policy text, so it is not inside the reading
           measure below — a caveat about the whole page, not a section of one. */
        .legal-trans-notice { border: 1px solid var(--line); border-radius: var(--radius-card, 18px); background: rgba(var(--surface-tint-rgb),.04); padding: 14px 16px; margin-bottom: 2rem; }
        .legal-trans-notice p { font-size: .8rem; color: var(--ink-2); line-height: 1.6; margin: 0; }
        .legal-updated-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: .85rem; }
        .legal-print-btn { flex-shrink: 0; font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 0.7813rem; letter-spacing: .08em; text-transform: uppercase; background: transparent; border: 1px solid var(--line); color: var(--ink-2); padding: 8px 14px; border-radius: 999px; cursor: pointer; }
        .legal-print-btn:hover { color: var(--ink); border-color: var(--ink-2); }
        /* Wraps rather than scrolls. This was overflow-x:auto with
           width:fit-content, written when there were four tabs; at six it
           overflows inside the shell's content column and the browser draws a
           native horizontal scrollbar — unthemed, and the only one on the
           page. The mobile block below already hid that bar, so the defect
           only ever showed at desktop widths. Wrapping means the strip cannot
           scroll at any width, so there is nothing to hide. */
        .legal-seg { display: flex; flex-wrap: wrap; gap: 4px; border-radius: 12px; border: 1px solid var(--line); max-width: 100%; width: 100%; padding: 4px; margin-bottom: 2.5rem; box-sizing: border-box; }
        .legal-seg-btn { flex: 1 1 auto; padding: 9px 20px; border: none; border-radius: 9px; background: transparent; color: var(--ink-2); font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: .82rem; cursor: pointer; transition: all .15s; white-space: nowrap; }
        @media (max-width: 480px) {
          .legal-seg { width: 100%; border-radius: 10px; }
          /* Six tabs at phone width wrap onto two or three rows rather than
             being squeezed into six ~60px columns, which overlapped the
             labels into an unreadable smear. The scrollbar-hiding rules that
             used to live here are gone with the scrolling. */
          .legal-seg-btn { flex: 1 1 auto; padding: 10px 12px; font-size: 0.7813rem; line-height: 1.25; text-align: center; white-space: nowrap; min-height: 44px; display: flex; align-items: center; justify-content: center; }
        }
        .legal-seg-btn.active { background: rgba(var(--accent-rgb),.1); color: var(--accent-text); }
        .legal-doc { display: none; }
        .legal-doc.active { display: block; }
        /* A READING MEASURE, on the four documents that are prose.
           The .legal-wrap box is the template's 760px and stays that — it is
           the frame for the masthead and the tab strip. But 760 less 2rem of
           padding either side sets body text on a 696px line, and measured in
           Chromium against the real Work Sans face at .9rem that is a MEDIAN
           OF 99 CHARACTERS per line, against the ~66-80 prose is read at. The
           six longest documents on the site were the widest-set ones.
           35rem is 560px, measured at 79 characters — the top of that band,
           and as narrow as the column can go without looking thin inside a
           760px frame. rem rather than px so the measure still holds when
           Settings → Text size scales the root font.
           (a7aa5d5 set /community-rules, /ticket-policy and /copyright to the
           trust-policy template's 640px on the same .9rem body. Measured the
           same way that is 89 characters, not the ~72 that commit estimated —
           those three want the same narrowing, and are not this component.)
           Left-aligned inside the wrap rather than re-centred, so the eyebrow,
           heading, tab strip and body all share one left edge.
           Trust & Safety and Transparency are deliberately NOT in this class —
           they are stat grids and card rows from a different template, not
           prose, and a 560px box would collapse their three- and four-column
           layouts. */
        .legal-doc-prose { max-width: 35rem; }
        .legal-doc h2 { font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: 1.15rem; letter-spacing: -.02em; margin: 2.5rem 0 .6rem; color: var(--ink); }
        .legal-doc p { font-size: .9rem; color: var(--ink-2); line-height: 1.75; margin-bottom: .85rem; }
        .legal-doc ol { color: var(--ink-2); font-size: .9rem; line-height: 1.75; padding-left: 1.25rem; }
        .legal-doc li + li { margin-top: .65rem; }
        .legal-doc a { color: var(--accent-text); }
        .legal-split-display { font-family: var(--f-d, 'Bricolage Grotesque', sans-serif) !important; font-weight: 800; font-size: 1.5rem; letter-spacing: -.03em; color: var(--ink) !important; line-height: 1.3; margin: 1rem 0 !important; }
        /* Carried over from the standalone /charter page's own <style> block
           when it was folded into this tab. */
        .charter-split-bar { display: flex; height: 14px; border-radius: var(--radius-pill, 9999px); overflow: hidden; margin: 1.5rem 0 0; gap: 4px; }
        .charter-split-bar div { border-radius: var(--radius-pill, 9999px); }
        /* --radius-card, not a literal 16px: it is the radius Design System 8
           added for exactly this shape, and rule 35 asks new work to use it. */
        .charter-callout { background: rgba(var(--accent-rgb),.06); border: 1px solid rgba(var(--accent-rgb),.15); border-radius: var(--radius-card, 18px); padding: 20px 24px; margin: 0 0 1rem; }
        .charter-callout p { margin: 0 !important; color: var(--ink) !important; font-family: var(--f-s, 'Instrument Serif', serif); font-style: italic; font-size: 1.12rem !important; line-height: 1.55 !important; }
        .charter-inline-link { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 0.7813rem; letter-spacing: .04em; border-bottom: 1px solid currentColor; }
        @media print {
          .legal-seg { display: none !important; }
          .legal-print-btn { display: none !important; }
          html, body { background: #fff !important; color: #111 !important; }
          .legal-wrap { max-width: 100% !important; padding: 1.5rem !important; }
          .legal-h1, .legal-doc h2 { color: #111 !important; }
          .legal-doc p, .legal-standfirst { color: #333 !important; }
          /* The measure is the browser's page box on paper, not a CSS width. */
          .legal-doc-prose { max-width: none !important; }
          /* Prints with the policy it qualifies — a PDF of a translated policy
             is exactly the artifact someone would read as the binding text. */
          .legal-trans-notice { border-color: #999 !important; background: none !important; }
          .legal-trans-notice p { color: #111 !important; }
          .legal-doc a { color: #111 !important; text-decoration: underline; }
          .charter-callout p { color: #111 !important; }
          /* A flat bar prints as three grey blocks with no legend — the
             percentages beside it already carry the number. */
          .charter-split-bar { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function InfoTabsShell({ trustPanel, transparencyPanel }: InfoTabsProps) {
  return (
    <Suspense fallback={null}>
      <InfoTabs trustPanel={trustPanel} transparencyPanel={transparencyPanel} />
    </Suspense>
  );
}
