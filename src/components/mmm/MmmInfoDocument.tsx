import Link from 'next/link';

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

export function MmmInfoDocument({ kind }: { kind: 'privacy' | 'dmca' }) {
  const privacy = kind === 'privacy';
  const title = privacy ? 'Privacy policy' : 'DMCA';
  const sections = privacy ? PRIVACY : DMCA;
  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ Info</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">Me · Info · Legal</p>
        <h1>{title}</h1>
        <p>{privacy ? 'Your data is never the product.' : 'Copyright reporting and counter-notice process.'}</p>
      </header>
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
            <h2>{privacy ? 'Contact and requests' : 'DMCA agent'}</h2>
            <p>
              <a href="mailto:admin@ihype.org">admin@ihype.org</a>
              {privacy ? <> · You can also manage exports and deletion in <Link href="/app/me/settings#privacy">Account and privacy</Link>.</> : ' · iHYPE Inc., Portland, ME'}
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
