/**
 * THE ONE LEGAL TEXT: the terms of service and the privacy policy, as data.
 *
 * Until 2026-09-25 iHYPE published two texts that were meant to be the same
 * agreement and were not: the public `/info` hub carried its own prose
 * (translated into eleven locales, under a banner saying the English governs)
 * and the signed-in shell carried `MmmLegal`'s English clauses. They differed
 * in wording across a dozen clauses, and nothing decided which one bound. The
 * owner's instruction was to combine them ("Combine legal of both together"),
 * so this module is now the only place either document is written, and both
 * surfaces render it:
 *
 *   /info?tab=terms (and ?tab=privacy)  InfoTabs, the public page
 *   /app/me/info/terms                   MmmLegal, the signed-in page
 *
 * The merge took the fuller wording of each clause and removed what is no
 * longer true: the 18+ ticket-purchase clause (the owner removed the 18+
 * requirement site-wide on 2026-09-25; 13+ is the only age rule), and any
 * licence over radio shows, a content type the product no longer offers.
 *
 * THIS TEXT IS ENGLISH AND STAYS ENGLISH. It is binding, and a machine
 * translation of binding text creates a second text that can only ever bind
 * iHYPE to something it did not mean. Each surface shows a TRANSLATED notice
 * saying so (see `LegalLanguageNotice`). The public page used to translate the
 * clauses themselves; that is what created the second text, and the keys are
 * gone.
 *
 * Change a clause here and bump `LEGAL_LAST_UPDATED`. The terms promise that
 * material changes are announced 30 days ahead; that is an operator duty this
 * file cannot perform.
 */

export type LegalClause = { heading: string; body: string };

/** ISO date of the last change to either part. Rendered in the reader's locale. */
export const LEGAL_LAST_UPDATED = '2026-09-25';

export const TERMS: readonly LegalClause[] = [
  {
    heading: 'Who can use iHYPE',
    body: 'You must be 13 or older to use iHYPE. By creating an account you agree to these terms.',
  },
  {
    heading: 'Tickets',
    body: 'All tickets are sold at face value, plus any sales tax that applies where the show takes place. iHYPE charges $0 in platform fees — this is locked in our charter and cannot be changed. Ticket purchases are final. Refunds are issued only if an event is cancelled by the organizer.',
  },
  {
    heading: 'The ticket split',
    body: 'Stripe’s card fee is taken off each ticket’s face value first; what is left splits 75% to the artist and 25% to the venue. iHYPE receives 0%. The venue is the seller of record on every sale and is responsible for the sales tax on it. iHYPE’s 0% is a founding constraint, not a policy — it cannot be altered by management, the board, or investors.',
  },
  {
    heading: 'HYPE Link referrals',
    body: 'Any member may share a HYPE Link to any event. A ticket purchased through your link is recorded as your referral; a HYPE Link earns no share of the ticket. Manipulating referral tracking, including purchasing through your own link, is prohibited and may result in account termination.',
  },
  {
    heading: 'Content',
    body: 'You are responsible for the content you post, including artist and venue pages, tracks, artwork and event listings. You grant iHYPE a non-exclusive license to host, stream and display this content within the platform. iHYPE does not claim ownership of your music, images, or likeness.',
  },
  {
    heading: 'Refunds',
    body: 'Ticket prices are final. Refunds are issued only if a show is cancelled by the organizer; refund requests for cancelled shows must be made within 14 days. There are no refunds for personal reasons.',
  },
  {
    heading: 'Limitation of liability',
    body: 'iHYPE provides the platform “as is.” We are not liable for lost data, service interruptions, or shows cancelled or altered by venues or artists.',
  },
  {
    heading: 'Changes to these terms',
    body: 'We may update these terms. Material changes will be announced at least 30 days in advance. Continued use after a change means you accept it.',
  },
  {
    heading: 'Termination',
    body: 'We may suspend or delete your account if you violate these terms. You can delete your account at any time from Settings.',
  },
];

export const PRIVACY: readonly LegalClause[] = [
  {
    heading: 'What we collect',
    body: 'iHYPE collects the minimum data necessary to operate: your email address, display name, account role, city, genre preferences and ticket purchase history. We do not sell this data, we do not share it with advertisers, and we do not use it to train AI models.',
  },
  {
    heading: 'Payment data',
    body: 'Payments are processed by Apple Pay and Stripe. iHYPE never stores card numbers or bank account details. Payout routing information for artists and venues is encrypted at rest and visible only to you and our payments processor.',
  },
  {
    heading: 'Analytics',
    body: 'We collect anonymous, aggregated usage data to understand how the app is used and improve it. This data cannot be used to identify you, and optional analytics can be turned off in Account and privacy in Settings.',
  },
  {
    heading: 'Referral links',
    body: 'When you share a HYPE Link, we track click-throughs and purchases associated with it so the referral is credited to you. A HYPE Link earns no share of the ticket. This data is visible to you in Settings.',
  },
  {
    heading: 'Data rights (GDPR and CCPA)',
    body: 'If you are in the EU, EEA or UK, you have rights under the GDPR to access, rectification, erasure, portability, restriction and objection to processing. California residents have equivalent rights under the CCPA, including the right to opt out of data sales (we do not sell data, but the right still applies). Our lawful bases are contract performance (running your account, tickets and payouts) and legitimate interest (product analytics and fraud prevention). You can export or delete your data from Account and privacy in Settings, or write to admin@ihype.org. We respond within 30 days.',
  },
  {
    heading: 'Cookies',
    body: 'Essential cookies keep you signed in and remember your preferences; they cannot be turned off without breaking the app. Optional analytics cookies measure usage in aggregate; you can decline them from the consent banner, or reset your choice by clearing site data. We do not use third-party advertising or tracking cookies.',
  },
  {
    heading: 'Security',
    body: 'Data in transit is encrypted with TLS, and data at rest, including payout routing details, is encrypted. Access to user data is limited to the systems and staff that need it to operate the platform, and personal data is excluded from error reports wherever possible.',
  },
  {
    heading: 'Subprocessors',
    body: 'We use a small number of vendors to run iHYPE, each bound by its own data protection terms: Stripe (payment processing and artist and venue payouts — it holds card and bank details; iHYPE never does), Supabase (database hosting), Cloudflare (application hosting, media storage and bot protection), Resend (account and notification email) and Sentry (error monitoring, configured to exclude personal data). None of these vendors may use your data for their own purposes.',
  },
];
