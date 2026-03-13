import {
  ARTIST_UPLOAD_POLICY_EFFECTIVE_DATE,
  artistUploadPolicySections
} from '@/lib/artist-upload-policy';

export function ArtistUploadPolicy({ audienceLabel }: { audienceLabel: string }) {
  return (
    <section className="panel policy-panel">
      <div className="policy-header">
        <div className="badge">Required policy</div>
        <h2>iHYPE.org Artist Upload &amp; Limited Use License Policy</h2>
        <p className="kicker">
          Effective Date: {ARTIST_UPLOAD_POLICY_EFFECTIVE_DATE}. This policy is shown during {audienceLabel} signup
          because artist uploads and promoter-curated streaming shows both rely on the same limited-use license rules.
        </p>
      </div>

      <div className="policy-sections">
        {artistUploadPolicySections.map((section) => (
          <article className="policy-section" key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul className="launch-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.closing ? <p>{section.closing}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
