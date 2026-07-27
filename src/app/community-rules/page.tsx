import { TrustPolicyPage } from '@/components/TrustPolicyPage';
import { getLocale, getT } from '@/lib/i18n/server';

export const metadata = { title: 'Community Rules | iHYPE.org' };

export default async function CommunityRulesPage() {
  const t = getT(await getLocale());
  return (
    <TrustPolicyPage
      badge={t('communityRulesPage.badge', 'Community')}
      title={t('communityRulesPage.title', 'Keep the scene safe enough to grow')}
      intro={t('communityRulesPage.intro', 'iHYPE should be useful, human, and fair. That means no harassment, fraud, manipulation, or unsafe content.')}
      sections={[
        { title: t('communityRulesPage.respectPeopleTitle', 'Respect people'), body: t('communityRulesPage.respectPeopleBody', 'No harassment, threats, hate, doxxing, impersonation, or targeted abuse of fans, artists, venues, promoters, staff, or volunteers.') },
        { title: t('communityRulesPage.respectSignalTitle', 'Respect the signal'), body: t('communityRulesPage.respectSignalBody', 'Do not use bots, fake accounts, paid manipulation, or hidden incentives to distort hype, rankings, playlists, or recommendations.') },
        { title: t('communityRulesPage.respectVenuesFansTitle', 'Respect venues and fans'), body: t('communityRulesPage.respectVenuesFansBody', 'Event, ticket, safety, accessibility, and venue information should be accurate and corrected quickly when it changes.') },
        { title: t('communityRulesPage.reportProblemsTitle', 'Report problems'), body: t('communityRulesPage.reportProblemsBody', 'Users should report unsafe content, rights concerns, fraud, impersonation, or ticket issues so admins can review them in the beta console.') }
      ]}
    />
  );
}
