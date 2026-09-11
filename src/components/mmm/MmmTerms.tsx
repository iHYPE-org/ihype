import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import { LegalLanguageNotice } from './LegalLanguageNotice';

const TERMS = [
  ['Who can use iHYPE', 'You must be 13 or older to use iHYPE. To purchase tickets, you must be 18 or the age of majority in your jurisdiction. By creating an account you agree to these terms.'],
  ['Tickets', 'All tickets are sold at face value. iHYPE charges $0 in platform fees—this is locked in our charter and cannot be changed. Ticket purchases are final. Refunds are issued only if an event is cancelled by the organizer.'],
  ['The 70/20/10 split', 'Every ticket sold through iHYPE splits as follows: 70% to the artist, 20% to the venue, 10% to the promoter pool, distributed proportionally among referrers. iHYPE receives 0%. This is a founding constraint, not a policy—it cannot be altered by management, the board, or investors.'],
  ['Promoter referrals', 'Fans and DJs may share a HYPE Link to any event. If a ticket is purchased through your link, you receive your proportional share of the 10% promoter pool. Manipulating referral tracking, including purchasing through your own link, is prohibited and may result in account termination.'],
  ['Content', 'You are responsible for content you post, including artist pages, radio shows, and event listings. You grant iHYPE a non-exclusive license to display this content within the platform. iHYPE does not claim ownership of your music, images, or likeness.'],
  ['Refunds', 'Ticket prices are final. Refunds are issued only if a show is cancelled by the organizer; refund requests for cancelled shows must be made within 14 days. There are no refunds for personal reasons.'],
  ['Limitation of liability', 'iHYPE provides the platform “as is.” We are not liable for lost data, service interruptions, or shows cancelled or altered by venues or artists.'],
  ['Changes to these terms', 'We may update these terms. Material changes will be announced at least 30 days in advance. Continued use after a change means you accept it.'],
  ['Termination', 'We may suspend or delete your account if you violate these terms. You can delete your account at any time from Settings.'],
] as const;

/**
 * THE TERMS ARE ENGLISH ON PURPOSE; THE WAY IN IS NOT.
 *
 * `TERMS` above is binding text and is deliberately not translated — see
 * `LegalLanguageNotice` for the whole reasoning. What IS translated is the
 * furniture: how you got here, what this document is called, when it changed
 * and who to write to. Refusing to translate a heading that reads "Terms of
 * service" protects nobody and leaves a reader unable to tell what they are
 * looking at.
 */
export async function MmmTerms() {
  const t = await getServerT();
  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {t('mmmLegal.backToInfo', 'Info')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmLegal.crumbLegal', 'Me · Info · Legal')}</p>
        <h1>{t('mmmLegal.termsTitle', 'Terms of service')}</h1>
        <p>{t('mmmLegal.lastUpdatedJune2026', 'Last updated June 20, 2026')}</p>
      </header>
      <LegalLanguageNotice />
      <div className="mmm-document-sections">
        {TERMS.map(([title, body], index) => (
          <section className="mmm-document-section" key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h2>{title}</h2><p>{body}</p></div>
          </section>
        ))}
        <section className="mmm-document-section">
          <span>10</span>
          <div><h2>{t('mmmLegal.contact', 'Contact')}</h2><p>{t('mmmLegal.legalQuestions', 'Legal questions:')} <a href="mailto:admin@ihype.org">admin@ihype.org</a></p></div>
        </section>
      </div>
    </article>
  );
}
