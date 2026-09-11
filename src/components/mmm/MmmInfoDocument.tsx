import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';
import { LegalLanguageNotice } from './LegalLanguageNotice';

const PRIVACY = [
  ['What we collect', 'iHYPE collects the minimum data necessary to operate: your email address, display name, account role, city, genre preferences and ticket purchase history. We do not sell this data, share it with advertisers or use it to train AI models.'],
  ['Payment data', 'Payments are processed by Apple Pay and Stripe. iHYPE never stores card numbers or bank account details. Payout routing information for artists and venues is encrypted at rest and visible only to you and our payments processor.'],
  ['Analytics', 'We collect anonymous, aggregated usage data to understand how the app is used and improve it. This data cannot identify you, and optional analytics can be disabled in Account and privacy.'],
  ['Referral links', 'When you share a HYPE Link, we track click-throughs and purchases associated with it so your proportional promoter-pool share can be calculated.'],
  ['Data rights', 'People covered by GDPR or CCPA may request access, correction, deletion, portability, restriction or objection. Our lawful bases are operating your account and legitimate interests such as fraud prevention. Requests receive a response within 30 days.'],
  ['Cookies', 'Essential cookies keep you signed in and remember preferences. Optional analytics cookies measure aggregate usage. We do not use third-party advertising or tracking cookies.'],
  ['Security', 'Data is encrypted in transit and at rest. Access is limited to the systems and staff needed to operate the platform, and personal data is excluded from error reports wherever possible.'],
  ['Subprocessors', 'Stripe handles payments and payouts; Supabase hosts database services; Cloudflare provides application hosting, media storage and bot protection; Resend delivers email; and Sentry monitors errors. These vendors may not use your data for their own purposes.'],
] as const;

const DMCA = [
  ['Rights come first', 'Do not upload songs, artwork, samples or logos unless you own them or have permission to use them on iHYPE. Uploads are screened on submission, and rights holders may report unauthorized media at any time.'],
  ['How to file a takedown', 'Email the DMCA agent with your contact details, the infringing iHYPE URL, a description of the original work and a good-faith statement that you are the rights holder or authorized to act for them. Valid requests are acknowledged within 48 hours and confirmed infringement is removed within five business days.'],
  ['Counter-notice', 'If your content was removed in error, you may submit a counter-notice to the same address. Include the removed URL, why removal was mistaken and your contact details.'],
  ['Repeat infringers', 'Accounts that repeatedly upload unauthorized content lose upload privileges and may be terminated. Knowingly false claims may carry legal liability.'],
] as const;

/**
 * `PRIVACY` and `DMCA` above are binding text and stay English; the page
 * around them is translated. See `LegalLanguageNotice` for why the notice is
 * the translated part rather than the document.
 *
 * Worth knowing while reading this file: the privacy policy OFFERS GDPR and
 * CCPA rights, which is the product addressing readers in jurisdictions whose
 * consumer law may require the terms themselves in the local language. That
 * is a question for a lawyer before marketing there, not a thing a wrapping
 * pass can settle.
 */
export async function MmmInfoDocument({ kind }: { kind: 'privacy' | 'dmca' }) {
  const t = await getServerT();
  const privacy = kind === 'privacy';
  const title = privacy ? t('mmmLegal.privacyTitle', 'Privacy policy') : t('mmmLegal.dmcaTitle', 'DMCA');
  const sections = privacy ? PRIVACY : DMCA;
  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {t('mmmLegal.backToInfo', 'Info')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmLegal.crumbLegal', 'Me · Info · Legal')}</p>
        <h1>{title}</h1>
        <p>{privacy
          ? t('mmmLegal.privacyLede', 'Your data is never the product.')
          : t('mmmLegal.dmcaLede', 'Copyright reporting and counter-notice process.')}</p>
      </header>
      <LegalLanguageNotice />
      <div className="mmm-document-sections">
        {sections.map(([heading, body], index) => (
          <section className="mmm-document-section" key={heading}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h2>{heading}</h2><p>{body}</p></div>
          </section>
        ))}
        <section className="mmm-document-section">
          <span>{String(sections.length + 1).padStart(2, '0')}</span>
          <div>
            <h2>{privacy ? t('mmmLegal.contactAndRequests', 'Contact and requests') : t('mmmLegal.dmcaAgent', 'DMCA agent')}</h2>
            <p>
              <a href="mailto:admin@ihype.org">admin@ihype.org</a>
              {/* i18n-exempt: `iHYPE Inc.` is the registered entity name and
                  Portland, ME is a place — neither is translated, in any
                  locale, because a translated corporate name identifies
                  nobody. */}
              {privacy ? (
                <> · {t('mmmLegal.exportsAlsoIn', 'You can also manage exports and deletion in')}{' '}
                  <Link href="/app/me/settings#privacy">{t('mmmLegal.accountAndPrivacy', 'Account and privacy')}</Link>.</>
              ) : ' · iHYPE Inc., Portland, ME'}
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
