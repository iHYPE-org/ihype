import { TrustPolicyPage } from '@/components/TrustPolicyPage';

export const metadata = { title: 'Copyright | iHYPE.org' };

export default function CopyrightPage() {
  return (
    <TrustPolicyPage
      badge="Copyright"
      title="Copyright and media rights"
      intro="iHYPE is built for independent music, which means rights handling needs to be clear and serious."
      sections={[
        { title: 'Upload authority', body: 'Do not upload songs, artwork, samples, or logos unless you own them or have permission to use them on iHYPE.' },
        { title: 'Reports', body: 'Rights holders should report unauthorized media through the content report flow or support channel with enough detail to identify the asset.' },
        { title: 'Review', body: 'Reported media can be hidden, removed, or restricted while iHYPE reviews ownership, license, and safety concerns.' },
        { title: 'Repeat issues', body: 'Accounts that repeatedly upload unauthorized content may lose upload privileges or account access.' }
      ]}
    />
  );
}
