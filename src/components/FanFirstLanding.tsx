import { IhypeMark } from '@/components/brand/IhypeMark';
import Link from 'next/link';
import './fan-first-landing.css';
import { getServerT } from '@/lib/i18n/server';

export async function FanFirstLanding() {
  const t = await getServerT();
  const sections = [
    ['mission', t('fanFirstLanding.mission', 'Mission')],
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
          </div>
        </section>

        <section id="story" className="fan-entry-section">
          <h2>{t('fanFirstLanding.story', 'Our story')}</h2>
          <p>{t('fanFirstLanding.storyBody', 'We started in Portland, Maine, to make it easier to find the music being made down the street. Now we’re building iHYPE city by city with the fans, artists, and venues who know their scenes best.')}</p>
        </section>

        <section id="transparency" className="fan-entry-section">
          <h2>{t('fanFirstLanding.transparency', 'Transparency')}</h2>
          <p>{t('fanFirstLanding.transparencyBody', 'iHYPE is free to use, including listening and publishing. Our only paid service is radio-style ads for music. We take no cut of ticket sales and never sell your data.')}</p>
          <Link className="fan-entry-secondary" href="/info?tab=transparency">{t('fanFirstLanding.readPublicRecord', 'See our public record')}</Link>
        </section>

        <footer aria-label={t('fanFirstLanding.footerLabel', 'Site information')} className="fan-entry-legal">
          <div className="fan-entry-legal-links">
            <Link href="/support">{t('fanFirstLanding.support', 'Support')}</Link>
            <Link href="/advertise">{t('fanFirstLanding.advertise', 'Advertise')}</Link>
            <Link href="/info?tab=transparency">{t('fanFirstLanding.nonprofit', 'A 501(c)(3) nonprofit')}</Link>
          </div>
          <p>{'© 2026 ihype.org'}</p>
        </footer>
      </div>
    </div>
  );
}
