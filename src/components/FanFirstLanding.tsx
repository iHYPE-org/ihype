import type { ReactNode } from 'react';
import { NearbyShowsWidget } from '@/components/NearbyShowsWidget';
import { IhypeMark } from '@/components/brand/IhypeMark';
import Link from 'next/link';
import { RequestBetaAccessForm } from '@/components/RequestBetaAccessForm';
import { ShareButton } from '@/components/ShareButton';
import './fan-first-landing.css';
import { getServerT } from '@/lib/i18n/server';

export async function FanFirstLanding({ stats, discovery }: { stats: ReactNode; discovery: ReactNode }) {
  const t = await getServerT();
  const sections = [
    ['mission', t('fanFirstLanding.mission', 'Mission')],
    ['discover', t('fanFirstLanding.discover', 'Discover')],
    ['grow-your-scene', t('fanFirstLanding.growYourScene', 'Grow your scene')],
    ['story', t('fanFirstLanding.story', 'Our story')],
    ['transparency', t('fanFirstLanding.transparency', 'Transparency')],
  ] as const;

  return (
    <div className="fan-entry">
      <header aria-label="iHYPE" className="fan-entry-header">
        <Link aria-label={t('fanFirstLanding.home', 'iHYPE home')} className="fan-entry-logo" href="/">
          <IhypeMark size={16} />
        </Link>
        <nav aria-label={t('fanFirstLanding.accountNav', 'Account')} className="fan-entry-nav">
          <Link className="fan-entry-signin" href="/login">{t('fanFirstLanding.signIn', 'Sign in')}</Link>
          <a className="fan-entry-join" href="#request-access">{t('fanFirstLanding.requestAccess', 'Request access')}</a>
        </nav>
      </header>

      <nav className="fan-entry-subnav" aria-label={t('fanFirstLanding.sectionNav', 'On this page')}>
        <ul>
          {sections.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
        </ul>
      </nav>

      <div className="fan-entry-main">
        <section id="mission" className="fan-entry-hero">
          <div className="fan-entry-copy">
            <p className="fan-entry-kicker">{t('fanFirstLanding.kicker', 'Private alpha')} · Portland, ME</p>
            <h1>{t('fanFirstLanding.missionHeadline', 'Your music scene starts with you.')}</h1>
            <p className="fan-entry-lead">
              {t('fanFirstLanding.missionBody', 'Find local artists. Catch their next show. HYPE the music you want more people to hear. iHYPE is free and nonprofit.')}
            </p>
            <div className="fan-entry-nav fan-entry-mission-actions">
              <a className="fan-entry-join" href="#discover">{t('fanFirstLanding.discoverLocalMusic', 'Discover local music')}</a>
            </div>
          </div>
        </section>

        <section id="discover" className="fan-entry-section">
          <h2>{t('fanFirstLanding.discoverLocalMusic', 'Discover local music')}</h2>
          {discovery}
          <NearbyShowsWidget />
        </section>

        <section id="grow-your-scene" className="fan-entry-section">
          <h2>{t('fanFirstLanding.growYourScene', 'Grow your scene')}</h2>
          <p>{t('fanFirstLanding.growYourSceneBody', 'Every HYPE helps people find the artists and shows you love. Share iHYPE with a friend, a local band, or your favorite venue. Then pick a show and go together.')}</p>
          <div className="fan-entry-nav">
            <ShareButton path="/" title="iHYPE" includeReferral={false} label={t('fanFirstLanding.shareApp', 'Share iHYPE')} />
          </div>
        </section>

        <section id="story" className="fan-entry-section">
          <h2>{t('fanFirstLanding.story', 'Our story')}</h2>
          <p>{t('fanFirstLanding.storyBody', 'We started in Portland, Maine, to make it easier to find the music being made down the street. Now we’re building iHYPE city by city with the fans, artists, and venues who know their scenes best.')}</p>
          <div className="fan-entry-nav">
            <Link className="fan-entry-secondary" href="/for-artists">{t('fanFirstLanding.forArtists', 'For artists')}</Link>
            <Link className="fan-entry-secondary" href="/for-venues">{t('fanFirstLanding.forVenues', 'For venues')}</Link>
          </div>
        </section>

        <section id="transparency" className="fan-entry-section">
          <h2>{t('fanFirstLanding.transparency', 'Transparency')}</h2>
          <p>{t('fanFirstLanding.transparencyBody', 'iHYPE is free to use, including listening and publishing. Our only paid service is radio-style ads for music. We take no cut of ticket sales and never sell your data.')}</p>
          <div aria-label={t('fanFirstLanding.statsLabel', 'Live iHYPE platform statistics')} className="fan-entry-stats">
            {stats}
          </div>
          <Link className="fan-entry-secondary" href="/info?tab=transparency">{t('fanFirstLanding.readPublicRecord', 'See our public record')}</Link>
        </section>

        <section id="request-access" className="fan-entry-section">
          <h2>{t('fanFirstLanding.requestAccess', 'Request access')}</h2>
          <div className="fan-entry-request">
            <p className="fan-entry-request-lead">
              {t('fanFirstLanding.requestLead', 'We are opening the app city by city. Leave your email and we will send you an invite when we reach yours.')}
            </p>
            <RequestBetaAccessForm defaultOpen />
          </div>
        </section>

        <footer aria-label={t('fanFirstLanding.footerLabel', 'Site information')} className="fan-entry-legal">
          <Link href="/support">{t('fanFirstLanding.support', 'Support')}</Link>
          <Link href="/advertise">{t('fanFirstLanding.advertise', 'Advertise')}</Link>
          <span>
            <Link href="/info?tab=transparency">{t('fanFirstLanding.nonprofit', 'A 501(c)(3) nonprofit')}</Link>
            {' · © 2026 ihype.org'}
          </span>
        </footer>
      </div>
    </div>
  );
}
