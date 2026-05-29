import { TrustPolicyPage } from '@/components/TrustPolicyPage';

export const metadata = { title: 'Terms | iHYPE.org' };

export default function TermsPage() {
  return (
    <TrustPolicyPage
      badge="Terms"
      title="Simple platform terms"
      intro="These beta terms summarize the core rules while final counsel-reviewed terms are prepared."
      lastUpdated="May 29, 2026"
      sections={[
        { title: 'Use iHYPE lawfully', body: 'Users may not abuse the service, misrepresent identity, manipulate hype, scrape accounts, or interfere with platform security.' },
        { title: 'Own or control uploads', body: 'Artists and promoters must have the rights needed for any media, images, logos, or show material they upload or use.' },
        { title: 'No guaranteed outcomes', body: 'iHYPE supports discovery and community signal, but does not guarantee bookings, ticket sales, payouts, rankings, or promotion.' },
        { title: 'Beta changes', body: 'Features, policies, and account flows may change during beta as safety, compliance, and community needs become clearer.' }
      ]}
    />
  );
}
