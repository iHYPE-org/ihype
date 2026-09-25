import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import { DocumentPartAnchor } from './DocumentPartAnchor';
import { LegalLanguageNotice } from './LegalLanguageNotice';

const TERMS = [
  ['Who can use iHYPE', 'You must be 13 or older to use iHYPE. To purchase tickets, you must be 18 or the age of majority in your jurisdiction. By creating an account you agree to these terms.'],
  ['Tickets', 'All tickets are sold at face value. iHYPE charges $0 in platform fees—this is locked in our charter and cannot be changed. Ticket purchases are final. Refunds are issued only if an event is cancelled by the organizer.'],
  ['The ticket split', 'Stripe’s card fee is taken off each ticket’s face value first; what is left splits 75% to the artist and 25% to the venue. iHYPE receives 0%. The venue is the seller of record on every sale. iHYPE’s 0% is a founding constraint, not a policy—it cannot be altered by management, the board, or investors.'],
  ['HYPE Link referrals', 'Any member may share a HYPE Link to any event. A ticket purchased through your link is recorded as your referral; a HYPE Link earns no share of the ticket. Manipulating referral tracking, including purchasing through your own link, is prohibited and may result in account termination.'],
  ['Content', 'You are responsible for content you post, including artist pages, tracks, and event listings. You grant iHYPE a non-exclusive license to display this content within the platform. iHYPE does not claim ownership of your music, images, or likeness.'],
  ['Refunds', 'Ticket prices are final. Refunds are issued only if a show is cancelled by the organizer; refund requests for cancelled shows must be made within 14 days. There are no refunds for personal reasons.'],
  ['Limitation of liability', 'iHYPE provides the platform “as is.” We are not liable for lost data, service interruptions, or shows cancelled or altered by venues or artists.'],
  ['Changes to these terms', 'We may update these terms. Material changes will be announced at least 30 days in advance. Continued use after a change means you accept it.'],
  ['Termination', 'We may suspend or delete your account if you violate these terms. You can delete your account at any time from Settings.'],
] as const;

const PRIVACY = [
  ['What we collect', 'iHYPE collects the minimum data necessary to operate: your email address, display name, account role, city, genre preferences and ticket purchase history. We do not sell this data, share it with advertisers or use it to train AI models.'],
  ['Payment data', 'Payments are processed by Apple Pay and Stripe. iHYPE never stores card numbers or bank account details. Payout routing information for artists and venues is encrypted at rest and visible only to you and our payments processor.'],
  ['Analytics', 'We collect anonymous, aggregated usage data to understand how the app is used and improve it. This data cannot identify you, and optional analytics can be disabled in Account and privacy.'],
  ['Referral links', 'When you share a HYPE Link, we track click-throughs and purchases associated with it so the referral can be credited to you. A HYPE Link earns no share of the ticket.'],
  ['Data rights', 'People covered by GDPR or CCPA may request access, correction, deletion, portability, restriction or objection. Our lawful bases are operating your account and legitimate interests such as fraud prevention. Requests receive a response within 30 days.'],
  ['Cookies', 'Essential cookies keep you signed in and remember preferences. Optional analytics cookies measure aggregate usage. We do not use third-party advertising or tracking cookies.'],
  ['Security', 'Data is encrypted in transit and at rest. Access is limited to the systems and staff needed to operate the platform, and personal data is excluded from error reports wherever possible.'],
  ['Subprocessors', 'Stripe handles payments and payouts; Supabase hosts database services; Cloudflare provides application hosting, media storage and bot protection; Resend delivers email; and Sentry monitors errors. These vendors may not use your data for their own purposes.'],
] as const;

/**
 * ONE LEGAL DOCUMENT, TWO PARTS — the terms and the privacy policy.
 *
 * They used to be two routes rendering two articles with identical furniture:
 * the same back link, the same `Me · Info · Legal` eyebrow, the same numbered
 * clause list, the same contact section, differing only in the title. That is
 * why the owner read them as the same document and asked for one of them to
 * go ("Terms of Service & Privacy Policy are the same"). Deleting the privacy
 * policy was the wrong half to act on — its data-rights and subprocessor
 * clauses are what GDPR and CCPA readers are owed, and nothing in the terms
 * carries them — so what was folded is the PRESENTATION. One document, one
 * "last updated", one back link, one contact, and clause numbers that run
 * straight through both parts, which is what says "one agreement" structurally
 * rather than in a sentence.
 *
 * `/app/me/info/privacy` still resolves — it forwards to the privacy part's
 * anchor — because that URL is in signup consent copy, the cookie banner and
 * installed service-worker caches.
 *
 * `TERMS` and `PRIVACY` are binding text and stay English; the furniture
 * around them is translated. See `LegalLanguageNotice` for the whole
 * reasoning, and note that the privacy part OFFERS GDPR and CCPA rights,
 * which is the product addressing readers in jurisdictions whose consumer law
 * may require the terms themselves in the local language. That is a question
 * for a lawyer before marketing there, not one a wrapping pass can settle.
 */
function Clauses({ sections, offset }: { sections: readonly (readonly [string, string])[]; offset: number }) {
  return (
    <>
      {sections.map(([heading, body], index) => (
        <section className="mmm-document-section" key={heading}>
          <span>{String(offset + index + 1).padStart(2, '0')}</span>
          <div><h3>{heading}</h3><p>{body}</p></div>
        </section>
      ))}
    </>
  );
}

export async function MmmLegal() {
  const t = await getServerT();
  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {t('mmmLegal.backToInfo', 'Info')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmLegal.crumbLegal', 'Me · Info · Legal')}</p>
        <h1>{t('mmmLegal.legalTitle', 'Terms and privacy')}</h1>
        <p>{t('mmmLegal.lastUpdatedJune2026', 'Last updated June 20, 2026')}</p>
      </header>
      <LegalLanguageNotice />
      <DocumentPartAnchor />
      <div className="mmm-document-sections">
        <h2 className="mmm-document-part" id="terms" tabIndex={-1}>{t('mmmLegal.partTerms', 'Terms of service')}</h2>
        <Clauses sections={TERMS} offset={0} />
        <h2 className="mmm-document-part" id="privacy" tabIndex={-1}>{t('mmmLegal.partPrivacy', 'Privacy policy')}</h2>
        <Clauses sections={PRIVACY} offset={TERMS.length} />
        <section className="mmm-document-section">
          <span>{String(TERMS.length + PRIVACY.length + 1).padStart(2, '0')}</span>
          <div>
            <h3>{t('mmmLegal.contactAndRequests', 'Contact and requests')}</h3>
            <p>
              <a href="mailto:admin@ihype.org">admin@ihype.org</a>
              {' · '}
              {t('mmmLegal.exportsAlsoIn', 'You can also manage exports and deletion in')}{' '}
              <Link href="/app/me/settings#privacy">{t('mmmLegal.accountAndPrivacy', 'Account and privacy')}</Link>.
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
