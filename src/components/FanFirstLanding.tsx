import type { ReactNode } from 'react';
import { NearbyShowsWidget } from '@/components/NearbyShowsWidget';
import { IhypeMark } from '@/components/brand/IhypeMark';
import Link from 'next/link';
import { RequestBetaAccessForm } from '@/components/RequestBetaAccessForm';
import { getServerT } from '@/lib/i18n/server';

/** The public landing page keeps account requests available alongside guest discovery. */
export async function FanFirstLanding({ stats, discovery }: { stats: ReactNode; discovery: ReactNode }) {
  const t = await getServerT();
  return (
    <div className="fan-entry">
      <header aria-label="iHYPE" className="fan-entry-header">
        <Link aria-label={t('fanFirstLanding.home', 'iHYPE home')} className="fan-entry-logo" href="/">
          <IhypeMark size={16} />
        </Link>
        <nav aria-label={t('fanFirstLanding.accountNav', 'Account')} className="fan-entry-nav">
          <Link className="fan-entry-signin" href="/login">{t('fanFirstLanding.signIn', 'Sign in')}</Link>
          <a className="fan-entry-join" href="#discover">{t('fanFirstLanding.discoverLocalMusic', 'Discover local music')}</a>
        </nav>
      </header>

      <div className="fan-entry-main">
        <section className="fan-entry-hero">
          <div className="fan-entry-copy">
            {/* The city stays in English: it is a place, not a word. */}
            <p className="fan-entry-kicker">{t('fanFirstLanding.kicker', 'Private alpha')} · Portland, ME</p>
            <h1>{t('fanFirstLanding.headlineOne', 'The free app for')}<br /><span>{t('fanFirstLanding.headlineTwo', 'local music.')}</span></h1>
            <p className="fan-entry-lead">
              {t('fanFirstLanding.lead', 'Stream music from artists in your own city — all of it free, none of it behind a subscription. Find the shows they are playing this week, and HYPE the ones you want more people to hear.')}
            </p>

            <div className="fan-entry-nav">
              <a className="fan-entry-join" href="#discover">{t('fanFirstLanding.discoverLocalMusic', 'Discover local music')}</a>
              <Link className="fan-entry-secondary" href="/for-artists">{t('fanFirstLanding.forArtists', 'For artists')}</Link>
              <Link className="fan-entry-secondary" href="/for-venues">{t('fanFirstLanding.forVenues', 'For venues')}</Link>
            </div>
          </div>
        </section>

        <section id="discover" aria-label={t('fanFirstLanding.discoverLocalMusic', 'Discover local music')}>
          {discovery}
          <NearbyShowsWidget />
        </section>

        <section className="fan-entry-hero">
          <div className="fan-entry-copy">
            <div className="fan-entry-actions" id="request-access">
              <div className="fan-entry-request">
                <p className="fan-entry-request-lead">
                  {t('fanFirstLanding.requestLead', 'We are opening the app city by city. Leave your email and we will send you an invite when we reach yours.')}
                </p>
                <RequestBetaAccessForm defaultOpen />
              </div>
            </div>

            <p className="fan-entry-secondary-line">
              {t('fanFirstLanding.alreadyInvited', 'Already invited?')} <Link className="fan-entry-secondary" href="/login">{t('fanFirstLanding.signIn', 'Sign in')}</Link>
            </p>

            {/* This line used to read "No ads between songs", which was false
                and is the one claim on this page the product contradicts
                directly: show-composer.ts injects `kind: 'AD'` breaks into a
                a show's sequence every `advertising.frequency` tracks, and
                ShowSequencePlayer plays them. Ads are how the platform is
                funded — the charter takes 0% of a ticket — so denying them on
                the front page misstated the business model, not a detail.

                The model is a radio one, and the copy now says so. Two facts
                back it: the spots are audio only (the banner-ad system was
                retired outright — see the AdSubmission row in CLAUDE.md), and
                every advertiser category on offer is music-industry —
                AdvertiserCategory is LABEL, VENUE_PROMOTER, GEAR, TICKETING,
                MERCH, TOUR and nothing else.

                Note the column is nullable, so "music-only" describes what
                signup offers rather than a constraint the database enforces.
                If that ever needs to be a promise rather than a practice, make
                the field required before strengthening this line. */}
            <p className="fan-entry-assurance">
              {t('fanFirstLanding.assuranceFree', 'Free forever')} <i aria-hidden="true">·</i> {t('fanFirstLanding.assuranceAds', 'Funded like radio, with music-only ads')} <i aria-hidden="true">·</i> {t('fanFirstLanding.assuranceData', 'We never sell your data')}
            </p>
          </div>

        </section>

        <section aria-label={t('fanFirstLanding.statsLabel', 'Live iHYPE platform statistics')} className="fan-entry-stats">
          {stats}
        </section>

        {/* The obligations, and they are obligations rather than decoration:
            the App Store and Play listings both require a policy URL that
            resolves without an account, and a consent link nobody can open is
            not consent. They used to ride on the sitewide `SiteFooter`, which
            was old-design chrome on every page; this is the logged-out front
            door, so they live here now. A signed-in member reaches the same
            destinations through ME. */}
        <footer aria-label={t('fanFirstLanding.footerLabel', 'Site information')} className="fan-entry-legal">
          {/* ONE LINK INTO /info, AND IT IS THE 501(c)(3) CLAIM (owner, with a
              screenshot: "Remove transparency and info & legal now that A
              501c3 link has all that"). A separate "Info & legal" and
              "Transparency" pair sat above it pointing at the same hub, so the
              row read as three doors into one room.
              Nothing became unreachable: the claim lands on the transparency
              tab, and `/info`'s own tab strip carries Trust & Safety, Privacy,
              Terms, the Charter and DMCA from there. Consent does not depend on
              this row either — signup links Terms and Privacy directly, and so
              does the cookie banner. */}
          <Link href="/support">{t('fanFirstLanding.support', 'Support')}</Link>
          <Link href="/advertise">{t('fanFirstLanding.advertise', 'Advertise')}</Link>
          {/* "501(c)(3)" is a US tax designation and `ihype.org` is the one
              domain this product may name; both stay verbatim in every locale.
              The claim LINKS to where it is backed: a tax status asserted in a
              footer with nothing behind it is the same defect as a control
              nothing reads. */}
          <span>
            <Link href="/info?tab=transparency">{t('fanFirstLanding.nonprofit', 'A 501(c)(3) nonprofit')}</Link>
            {' · © 2026 ihype.org'}
          </span>
        </footer>
      </div>
    </div>
  );
}
