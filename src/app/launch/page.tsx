import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';

export const metadata = {
  title: 'Founding Scene Launch | iHYPE',
  description:
    'Join the first iHYPE artist, venue, promoter, media, and supporter cohort building a fairer independent music network.',
};

const cohorts = [
  {
    title: 'Artists',
    target: '25 founding artists',
    copy: 'Publish music, join coordinated discovery drops, and turn listener response into visible demand for bookings.',
    href: '/for-artists',
    cta: 'Join as an artist',
  },
  {
    title: 'Venues',
    target: '5 founding venues',
    copy: 'Scout emerging acts with better local signal, list events without buyer fees, and help shape the venue workflow.',
    href: '/for-venues',
    cta: 'Join as a venue',
  },
  {
    title: 'Partners & media',
    target: '5 distribution partners',
    copy: 'Contribute a newsletter placement, calendar listing, interview, showcase slot, artist introduction, or sponsorship.',
    href: '/support',
    cta: 'Start a partnership',
  },
];

const sprint = [
  ['Day 1', 'Join the founding cohort', 'Artists, venues, DJs, partners, and fans claim their role and profile.'],
  ['Day 2', 'Build the launch roster', 'The first cohort submits music, dates, pages, and showcase availability.'],
  ['Day 3', 'Prepare the share kit', 'Each participant receives coordinated copy, clips, artwork, and a tracked link.'],
  ['Day 4', 'Activate partners', 'Venues, media, radio, colleges, and arts partners schedule their distribution action.'],
  ['Day 5', 'Announce the showcase', 'The first discovery showcase opens RSVPs and listener reminders.'],
  ['Day 6', 'Release together', 'The cohort publishes in one concentrated window instead of whispering separately into the void.'],
  ['Day 7', 'Publish the signal', 'iHYPE shares the first scene chart, results, clips, and booking-interest report.'],
];

export default async function LaunchPage() {
  const t = await getServerT();
  return (
    <div style={{ paddingBottom: '6rem' }}>
      <section style={{ padding: 'clamp(4rem, 10vw, 8rem) 0 3rem' }}>
        <div className="container">
          <p
            style={{
              fontFamily: 'var(--f-m)',
              fontSize: '0.75rem',
              letterSpacing: '.2em',
              color: 'var(--accent-text)',
              textTransform: 'uppercase',
              marginBottom: '0.8rem',
            }}
          >
            {t('launchPage.eyebrow', 'Founding scene launch')}
          </p>
          <h1
            style={{
              fontFamily: 'var(--f-d)',
              fontWeight: 800,
              fontSize: 'clamp(3rem, 8vw, 6rem)',
              lineHeight: 0.95,
              letterSpacing: '-0.045em',
              color: 'var(--ink)',
              margin: '0 0 1.4rem',
              maxWidth: '12ch',
            }}
          >
            {t('launchPage.heroTitle', 'Help independent music travel farther, faster.')}
          </h1>
          <p
            style={{
              fontFamily: 'var(--f-b)',
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              lineHeight: 1.65,
              color: 'var(--ink-2)',
              maxWidth: '62ch',
              margin: '0 0 2rem',
            }}
          >
            {t('launchPage.heroBody', 'iHYPE is assembling a concentrated launch cohort in Maine: 25 artists, 5 venues, 10 DJs or promoters, and 5 distribution partners. The goal is not empty national reach. It is enough local activity to turn discovery into attendance, demand, and paid bookings.')}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link
              href="/register"
              style={{
                display: 'inline-block',
                padding: '0.9rem 1.6rem',
                borderRadius: 999,
                background: 'var(--accent)',
                color: 'var(--ink-on-accent)',
                fontFamily: 'var(--f-d)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('launchPage.joinCta', 'Join the founding cohort →')}
            </Link>
            <Link
              href="/support"
              style={{
                display: 'inline-block',
                padding: '0.9rem 1.6rem',
                borderRadius: 999,
                border: '1px solid var(--hair-160)',
                color: 'var(--ink)',
                fontFamily: 'var(--f-d)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('launchPage.partnerCta', 'Partner with iHYPE')}
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container">
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            {cohorts.map((cohort, i) => (
              <article
                key={cohort.title}
                style={{
                  padding: '1.6rem',
                  borderRadius: 18,
                  border: '1px solid var(--hair-80)',
                  background: 'var(--hair-35)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--f-m)',
                    fontSize: '0.72rem',
                    letterSpacing: '.14em',
                    color: 'var(--accent-text)',
                    textTransform: 'uppercase',
                    margin: '0 0 0.55rem',
                  }}
                >
                  {t(`launchPage.cohortTarget${i}`, cohort.target)}
                </p>
                <h2
                  style={{
                    fontFamily: 'var(--f-d)',
                    fontSize: '1.5rem',
                    color: 'var(--ink)',
                    margin: '0 0 0.65rem',
                  }}
                >
                  {t(`launchPage.cohortTitle${i}`, cohort.title)}
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--f-b)',
                    lineHeight: 1.6,
                    color: 'var(--ink-2)',
                    margin: '0 0 1rem',
                  }}
                >
                  {t(`launchPage.cohortCopy${i}`, cohort.copy)}
                </p>
                <Link href={cohort.href} style={{ color: 'var(--accent-text)', fontFamily: 'var(--f-d)', fontWeight: 700 }}>
                  {t(`launchPage.cohortCta${i}`, cohort.cta)} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <p
            style={{
              fontFamily: 'var(--f-m)',
              fontSize: '0.75rem',
              letterSpacing: '.2em',
              color: 'var(--accent-text)',
              textTransform: 'uppercase',
              marginBottom: '0.6rem',
            }}
          >
            {t('launchPage.sprintEyebrow', 'Seven-day activation')}
          </p>
          <h2
            style={{
              fontFamily: 'var(--f-d)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              letterSpacing: '-0.035em',
              color: 'var(--ink)',
              margin: '0 0 1.5rem',
            }}
          >
            {t('launchPage.sprintTitle', 'One coordinated signal beats a month of random posting.')}
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {sprint.map(([day, title, copy], i) => (
              <div
                key={day}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '6rem 1fr',
                  gap: '1rem',
                  padding: '1rem 1.2rem',
                  borderRadius: 14,
                  border: '1px solid var(--hair-70)',
                  background: 'var(--hair-25)',
                }}
              >
                <strong style={{ fontFamily: 'var(--f-m)', color: 'var(--accent-text)', fontSize: '0.8rem' }}>{t(`launchPage.sprintDay${i}`, day)}</strong>
                <div>
                  <strong style={{ fontFamily: 'var(--f-d)', color: 'var(--ink)' }}>{t(`launchPage.sprintStepTitle${i}`, title)}</strong>
                  <p style={{ fontFamily: 'var(--f-b)', color: 'var(--ink-2)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
                    {t(`launchPage.sprintStepCopy${i}`, copy)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <div
            style={{
              padding: 'clamp(2rem, 5vw, 3.5rem)',
              borderRadius: 24,
              border: '1px solid rgba(var(--accent-rgb),.22)',
              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),.1), rgba(var(--accent-2-rgb),.05), transparent)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--f-d)',
                fontWeight: 800,
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: 'var(--ink)',
                margin: '0 0 0.9rem',
              }}
            >
              {t('launchPage.closingTitle', 'Bring one useful resource.')}
            </h2>
            <p style={{ fontFamily: 'var(--f-b)', color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: '62ch' }}>
              {t('launchPage.closingBody', "A newsletter placement, calendar listing, artist introduction, venue slot, interview, sponsorship, volunteer hour, or donation can move the launch forward. Specific help travels faster than ceremonial enthusiasm, humanity's most renewable but least convertible resource.")}
            </p>
            <Link
              href="/support"
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                padding: '0.9rem 1.6rem',
                borderRadius: 999,
                background: 'var(--accent)',
                color: 'var(--ink-on-accent)',
                fontFamily: 'var(--f-d)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('launchPage.closingCta', 'Offer support or partnership →')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
