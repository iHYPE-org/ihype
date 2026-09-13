import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import { LegalLanguageNotice } from './LegalLanguageNotice';

const DMCA = [
  ['Rights come first', 'Do not upload songs, artwork, samples or logos unless you own them or have permission to use them on iHYPE. Uploads are screened on submission, and rights holders may report unauthorized media at any time.'],
  ['How to file a takedown', 'Email the DMCA agent with your contact details, the infringing iHYPE URL, a description of the original work and a good-faith statement that you are the rights holder or authorized to act for them. Valid requests are acknowledged within 48 hours and confirmed infringement is removed within five business days.'],
  ['Counter-notice', 'If your content was removed in error, you may submit a counter-notice to the same address. Include the removed URL, why removal was mistaken and your contact details.'],
  ['Repeat infringers', 'Accounts that repeatedly upload unauthorized content lose upload privileges and may be terminated. Knowingly false claims may carry legal liability.'],
] as const;

/**
 * `DMCA` above is binding text and stays English; the page around it is
 * translated. See `LegalLanguageNotice` for why the notice is the translated
 * part rather than the document.
 *
 * This file rendered the privacy policy too, behind a `kind` prop, until
 * 2026-09-13. Privacy is part of the one legal document now — see `MmmLegal`
 * — and the takedown process stayed its own page on purpose: it is a
 * procedure a rights holder follows, not a term anyone agreed to at signup.
 */
export async function MmmDmca() {
  const t = await getServerT();
  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {t('mmmLegal.backToInfo', 'Info')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmLegal.crumbLegal', 'Me · Info · Legal')}</p>
        <h1>{t('mmmLegal.dmcaTitle', 'DMCA')}</h1>
        <p>{t('mmmLegal.dmcaLede', 'Copyright reporting and counter-notice process.')}</p>
      </header>
      <LegalLanguageNotice />
      <div className="mmm-document-sections">
        {DMCA.map(([heading, body], index) => (
          <section className="mmm-document-section" key={heading}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h2>{heading}</h2><p>{body}</p></div>
          </section>
        ))}
        <section className="mmm-document-section">
          <span>{String(DMCA.length + 1).padStart(2, '0')}</span>
          <div>
            <h2>{t('mmmLegal.dmcaAgent', 'DMCA agent')}</h2>
            <p>
              <a href="mailto:admin@ihype.org">admin@ihype.org</a>
              {/* i18n-exempt: `iHYPE Inc.` is the registered entity name and
                  Portland, ME is a place — neither is translated, in any
                  locale, because a translated corporate name identifies
                  nobody. */}
              {' · iHYPE Inc., Portland, ME'}
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
