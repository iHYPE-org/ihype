import { TrustPolicyPage } from '@/components/TrustPolicyPage';
import { getLocale, getT } from '@/lib/i18n/server';

export const metadata = { title: 'Copyright | iHYPE.org' };

export default async function CopyrightPage() {
  const t = getT(await getLocale());
  return (
    <TrustPolicyPage
      badge={t('copyrightPage.badge', 'Copyright')}
      title={t('copyrightPage.title', 'Copyright and media rights')}
      intro={t('copyrightPage.intro', 'iHYPE is built for independent music, which means rights handling needs to be clear and serious.')}
      sections={[
        { title: t('copyrightPage.uploadAuthorityTitle', 'Upload authority'), body: t('copyrightPage.uploadAuthorityBody', 'Do not upload songs, videos, artwork, samples, or logos unless you own them or have permission to use them on iHYPE.') },
        { title: t('copyrightPage.reportsTitle', 'Reports'), body: t('copyrightPage.reportsBody', 'Rights holders should report unauthorized media through the content report flow or support channel with enough detail to identify the asset.') },
        { title: t('copyrightPage.reviewTitle', 'Review'), body: t('copyrightPage.reviewBody', 'Reported media can be hidden, removed, or restricted while iHYPE reviews ownership, license, and safety concerns.') },
        { title: t('copyrightPage.repeatIssuesTitle', 'Repeat issues'), body: t('copyrightPage.repeatIssuesBody', 'Accounts that repeatedly upload unauthorized content may lose upload privileges or account access.') }
      ]}
    />
  );
}
