import Link from 'next/link';
import { getServerI18n } from '@/lib/i18n/server';
import { formatDate } from '@/lib/format-locale';
import { LEGAL_LAST_UPDATED, PRIVACY, TERMS, type LegalClause } from '@/lib/legal-document';
import { DocumentPartAnchor } from './DocumentPartAnchor';
import { LegalLanguageNotice } from './LegalLanguageNotice';

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
 * The clauses live in `src/lib/legal-document.ts`, which the public `/info`
 * page renders too — one text, two surfaces (2026-09-25).
 *
 * `TERMS` and `PRIVACY` are binding text and stay English; the furniture
 * around them is translated. See `LegalLanguageNotice` for the whole
 * reasoning, and note that the privacy part OFFERS GDPR and CCPA rights,
 * which is the product addressing readers in jurisdictions whose consumer law
 * may require the terms themselves in the local language. That is a question
 * for a lawyer before marketing there, not one a wrapping pass can settle.
 */
function Clauses({ sections, offset }: { sections: readonly LegalClause[]; offset: number }) {
  return (
    <>
      {sections.map(({ heading, body }, index) => (
        <section className="mmm-document-section" key={heading}>
          <span>{String(offset + index + 1).padStart(2, '0')}</span>
          <div><h3>{heading}</h3><p>{body}</p></div>
        </section>
      ))}
    </>
  );
}

export async function MmmLegal() {
  const { t, locale } = await getServerI18n();
  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {t('mmmLegal.backToInfo', 'Info')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmLegal.crumbLegal', 'Me · Info · Legal')}</p>
        <h1>{t('mmmLegal.legalTitle', 'Terms and privacy')}</h1>
        <p>{t('mmmLegal.lastUpdatedLabel', 'Last updated')} {formatDate(locale, new Date(`${LEGAL_LAST_UPDATED}T12:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' })}</p>
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
