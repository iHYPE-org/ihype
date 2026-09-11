import { ORG_IDENTITY, formatAddress } from '@/lib/org-identity';
import { getServerT } from '@/lib/i18n/server';

/**
 * Who is behind iHYPE, on the public record.
 *
 * Rendered inside `TransparencyPanel`, which is the one component both the
 * PUBLIC hub (`/info?tab=transparency`, reachable logged out) and the
 * signed-in shell (`/app/me/info/transparency`) render — so the two surfaces
 * cannot disagree about the organisation's own identity, which is the single
 * worst thing for them to disagree about.
 *
 * The LABELS are furniture and translate. The VALUES do not: an EIN, a
 * registered legal name and a postal address are identifiers, and a localised
 * one is a different identifier. That is the same rule the legal documents
 * follow — see `LegalLanguageNotice`.
 *
 * A field that is not configured renders nothing at all rather than a dash or
 * a placeholder; see `org-identity.ts` for why an invented EIN is worse than
 * an absent one.
 */
export async function OrganizationFacts() {
  const t = await getServerT();
  const org = ORG_IDENTITY;
  const address = formatAddress(org.address);

  const rows: { key: string; label: string; value: string }[] = [];

  if (org.legalName) {
    rows.push({ key: 'legal', label: t('orgFacts.legalName', 'Legal name'), value: org.legalName });
  }
  rows.push({ key: 'status', label: t('orgFacts.taxStatus', 'Tax status'), value: org.taxStatus });
  if (org.ein) {
    rows.push({ key: 'ein', label: t('orgFacts.ein', 'EIN'), value: org.ein });
  }
  if (address) {
    rows.push({ key: 'address', label: t('orgFacts.address', 'Registered address'), value: address });
  }
  rows.push({
    key: 'founded',
    label: t('orgFacts.founded', 'Founded'),
    value: `${org.foundedIn} · ${org.foundedYear}`,
  });

  return (
    <section className="org-facts" aria-labelledby="org-facts-head">
      <p className="lp-hype-eyebrow" style={{ color: 'var(--accent-text)' }}>
        {t('orgFacts.eyebrow', 'THE ORGANISATION')}
      </p>
      <h2 className="lp-section-head" id="org-facts-head">
        {t('orgFacts.heading', 'Who runs iHYPE')}
      </h2>
      <p className="org-facts-lede">
        {t(
          'orgFacts.lede',
          'iHYPE is operated as a nonprofit. These are the details a funder, a venue or a regulator would ask for, published here so nobody has to ask.',
        )}
      </p>
      <dl className="org-facts-list">
        {rows.map((row) => (
          <div className="org-facts-row" key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <div className="org-facts-row">
          <dt>{t('orgFacts.contact', 'Contact')}</dt>
          <dd>
            <a href={`mailto:${org.contactEmail}`}>{org.contactEmail}</a>
          </dd>
        </div>
        <div className="org-facts-row">
          <dt>{t('orgFacts.website', 'Website')}</dt>
          <dd>
            <a href={org.website}>{org.website.replace(/^https:\/\//, '')}</a>
          </dd>
        </div>
      </dl>
    </section>
  );
}
