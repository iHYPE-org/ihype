import { TrustPolicyPage } from '@/components/TrustPolicyPage';
import { getServerT } from '@/lib/i18n/server';

/**
 * The public account-deletion page, and why it has to be a PUBLIC page.
 *
 * Google Play's Data Safety form requires a deletion URL that a reviewer can
 * open with no account and no app installed, for any app that lets people sign
 * in. iHYPE has had working deletion since privacy-actions.ts was written —
 * `executeAccountErasure`, reachable from Settings — but only from behind a
 * session, which is exactly the thing the requirement is about. Without this
 * page the Data Safety form cannot be completed and the listing cannot be
 * submitted.
 *
 * It is in `PUBLIC_EXACT` (src/lib/auth-redirects.ts) for the same reason the
 * `.well-known` prefix is: the app is default-deny, so a page nobody added to
 * that list answers a redirect to /login. A store reviewer following the URL
 * would see a sign-in wall — the precise failure the URL exists to prevent —
 * and nothing in this repository would report it.
 *
 * EVERY SENTENCE HERE IS CHECKED AGAINST `executeAccountErasure`, not against
 * what a deletion page usually says. The two claims most tempting to get wrong:
 * deletion from Settings runs IMMEDIATELY (the route awaits the erasure and
 * returns `deleted: true`, it does not queue a request), and the account row is
 * NOT hard-deleted — it is emptied, because `Show.creator` cascades and a hard
 * delete of an organiser would destroy every buyer's ticket and every other
 * party's payout record. Saying "everything is deleted" would be false, and
 * false in the direction that matters to a regulator.
 */
export const metadata = {
  title: 'Delete your account | iHYPE.org',
  description: 'How to delete your iHYPE account and what happens to your data.',
};

export default async function DeleteAccountPage() {
  const t = await getServerT();
  return (
    <TrustPolicyPage
      badge={t('deleteAccountPage.badge', 'Account deletion')}
      title={t('deleteAccountPage.title', 'Delete your iHYPE account')}
      intro={t(
        'deleteAccountPage.intro',
        'You can delete your account yourself, at any time, without asking us. This page explains how, exactly what is removed, and the short list of records we keep — and why.',
      )}
      sections={[
        {
          title: t('deleteAccountPage.inAppTitle', 'Delete it yourself'),
          body: t(
            'deleteAccountPage.inAppBody',
            'Sign in and go to Me, then Settings — or open ihype.org/settings, which lands in the same place. Choose Delete account and type DELETE to confirm. Deletion runs immediately: it is not a request that waits for us to action it, and there is no cancellation period. You are signed out on every device as it completes. The iPhone and Android apps use this same screen, so the steps are identical there.',
          ),
        },
        {
          title: t('deleteAccountPage.noAccessTitle', 'If you cannot sign in'),
          body: t(
            'deleteAccountPage.noAccessBody',
            'Email admin@ihype.org from the address on the account and ask us to delete it. We confirm the request belongs to you before running it, and complete it within 30 days. If you have lost the only passkey on an account that has no email address, say so in the message and we will tell you what else can identify it.',
          ),
        },
        {
          title: t('deleteAccountPage.deletedTitle', 'What is deleted'),
          body: t(
            'deleteAccountPage.deletedBody',
            'Your sign-in credentials — passkeys, sign-in links and every active session. Push subscriptions and device tokens. Notifications and notification settings. Playlists, saved tracks, follows, RSVPs, comments, listening history and badges. Your hype votes, with the public counts on the shows and profiles you hyped reduced to match. Booking and venue requests you sent. Your newsletter subscription. Any tracks you uploaded, including the audio files and artwork themselves. Profile pages you own are emptied, and any connected Stripe payout account is disconnected so it cannot receive future payouts.',
          ),
        },
        {
          title: t('deleteAccountPage.keptTitle', 'What is kept, and why'),
          body: t(
            'deleteAccountPage.keptBody',
            'Ticket orders, tickets and payout records survive, with your name, email address and location removed and replaced with "Deleted user". They cannot be deleted outright: a ticket order is also a record of somebody else\'s purchase and of money owed to an artist and a venue, and financial records are kept as a legal obligation. Support requests you sent are kept with your name and email removed. Security log entries are kept without your IP address and are deleted entirely after 90 days. Your account row itself stays behind as an empty shell holding no personal information — deleting it would destroy other people\'s tickets and payments, not just yours.',
          ),
        },
        {
          title: t('deleteAccountPage.finalTitle', 'It cannot be undone'),
          body: t(
            'deleteAccountPage.finalBody',
            'There is no recovery window and no way for us to restore an account after erasure — the credentials that identify you are gone. If you want to keep a copy of your data, export it from Settings before you delete. If you only want to remove some of it, Support offers two narrower options: clearing your hype history without deleting the account, and detaching the location and IP metadata from your activity log ahead of the automatic 30-day window.',
          ),
        },
      ]}
    />
  );
}
