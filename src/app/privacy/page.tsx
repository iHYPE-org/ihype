import { TrustPolicyPage } from '@/components/TrustPolicyPage';

export const metadata = { title: 'Privacy Policy | iHYPE.org' };

export default function PrivacyPage() {
  return (
    <TrustPolicyPage
      badge="Privacy"
      title="Your privacy at iHYPE"
      intro="We collect only what we need to run the platform. We don't sell your data and we never will."
      sections={[
        {
          title: 'Data we collect',
          body: 'Email address (required for login), username, display name, location (city/country — optional, shown on profile), bio and profile content you create, usage signals such as hypes and show listens.'
        },
        {
          title: 'How we use it',
          body: 'Authentication and account security, music discovery (matching fans to artists, venues, and shows nearby), transactional emails such as OTP codes and ticket confirmations, and weekly digest emails you can unsubscribe from at any time.'
        },
        {
          title: 'Third-party services',
          body: 'Resend (email delivery), Stripe (payment processing — only if you purchase tickets), Prisma Accelerate (database connection pooling). Each vendor processes minimal data needed for their service.'
        },
        {
          title: 'Your rights',
          body: 'You may access, export, or delete your data at any time from /settings/data. Account deletion removes your profile, posts, and personal information within 30 days. Exported data arrives as JSON.'
        },
        {
          title: 'Cookies',
          body: 'We use one essential session cookie (next-auth.session-token) for authentication. No advertising, analytics, or tracking cookies are set. You may dismiss the cookie notice once and it will not reappear.'
        },
        {
          title: 'Contact',
          body: 'Questions about privacy? Email privacy@ihype.org or use the support form. For DMCA takedown requests visit /dmca.'
        }
      ]}
    />
  );
}
