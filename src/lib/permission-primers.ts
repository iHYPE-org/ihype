/**
 * The six native capabilities, as `templates/permissions/Permissions.dc.html`
 * designs them: primer → OS prompt → denied fallback.
 *
 * ## Why a primer exists at all
 *
 * "A permission has one OS prompt per install. Spend it badly — at onboarding,
 * with no context — and it is gone for good." Our own sheet can be declined
 * harmlessly as many times as we like; the OS one cannot. So nothing here
 * calls a native API until the member has said yes to OUR sheet first.
 *
 * ## The rule that outranks the rest
 *
 * **Buying a ticket and opening a ticket must work with all six refused.** If a
 * flow breaks when everything here is denied, the flow is wrong — not the
 * fan's answer. Nothing in this module is allowed to become load-bearing for
 * the purchase or the wallet.
 *
 * ## Three of these have no OS prompt
 *
 * Wallet pay, share and offline storage never show a system dialog. They are
 * here anyway because each still needs the same three designed states: the
 * absence of a wallet button otherwise reads as a bug, and a share that
 * silently does nothing reads as a broken link. `prompts: false` marks them —
 * their `primer` copy is documentation of the fallback, not a gate.
 *
 * This module imports nothing. It is the copy and the policy; the sheet that
 * renders it and the call sites that trigger it live elsewhere, so both are
 * testable without a DOM.
 */

export type PermissionId =
  | 'push'
  | 'location'
  | 'camera'
  | 'wallet'
  | 'share'
  | 'offlineTickets';

export type PermissionPrimer = {
  id: PermissionId;
  /** Whether accepting this sheet leads to a real OS dialog. */
  prompts: boolean;
  /** The sheet's headline — a promise, not the capability's name. */
  title: string;
  /** What it is for, and what it is not for. */
  body: string;
  /** Accepting. Leads to the OS prompt where there is one. */
  acceptLabel: string;
  /** Declining. Always names the alternative rather than saying "no". */
  declineLabel: string;
  /** When this sheet is allowed to appear. Rendered on the sheet itself. */
  moment: string;
  /** What the member gets when they refuse. Never an error state. */
  deniedTitle: string;
  deniedBody: string;
};

/**
 * Copy is the design system's, verbatim. It is product copy under review, not
 * strings to paraphrase — the push sheet in particular earns its ask by naming
 * exactly three things and nothing else, and a fourth would be a lie.
 */
export const PERMISSION_PRIMERS: Record<PermissionId, PermissionPrimer> = {
  push: {
    id: 'push',
    prompts: true,
    title: "Doors at 8. We'll remind you.",
    body: 'Three things only: when a show you hold a ticket for is close, when a promoter payout lands, and when someone sends you a ticket. Nothing else, ever.',
    acceptLabel: 'Turn on reminders',
    declineLabel: 'Not now',
    moment: 'Fires after first ticket · not onboarding',
    deniedTitle: 'Nothing is lost',
    deniedBody: 'Every notice still arrives in the in-app centre with an unread dot on Me. The show page shows a “Doors 8pm” line in place of the reminder toggle.',
  },
  location: {
    id: 'location',
    prompts: true,
    title: "See what's on near you",
    body: 'The map opens where you are instead of where we guessed. We ask for the coarse, city-level version — not your exact position — and only while the app is open.',
    acceptLabel: 'Use my location',
    declineLabel: "I'll pick a city",
    moment: 'Fires on first Map open',
    deniedTitle: 'The city picker becomes the control',
    deniedBody: 'The map opens on the home city from Settings and the “Near me” chip is replaced by that city’s name, tappable to change. No empty state.',
  },
  camera: {
    id: 'camera',
    prompts: true,
    title: 'Scan them in at the door',
    body: "Point the camera at a fan's ticket code and it checks in. Nothing is recorded and no image is stored — the frame is read and dropped.",
    acceptLabel: 'Open the scanner',
    declineLabel: 'Check in by name instead',
    moment: 'Venue accounts only · never asked of a fan',
    deniedTitle: 'The scan reverses',
    deniedBody: 'The fan shows their code and the door taps it in from the guest list instead. Slower, works, and the venue is never blocked at 8pm by a permission.',
  },
  wallet: {
    id: 'wallet',
    prompts: false,
    title: 'Pay in two taps',
    body: 'Apple Pay and Google Pay run through Stripe, so we never see your card. Face ID confirms it. Card entry is always there if you’d rather.',
    acceptLabel: 'Pay',
    declineLabel: 'Use a card',
    moment: 'No OS prompt · needs merchant ID on file',
    deniedTitle: 'Card entry, same sheet',
    deniedBody: 'If the device has no wallet the button is not rendered at all — never rendered-then-failing. Stripe’s card fields take its place in the same position.',
  },
  share: {
    id: 'share',
    prompts: false,
    title: 'Share it, earn from it',
    body: 'Your HYPE Link carries your code. Anyone who buys through it puts you in the 10% promoter pool for that show. Any account can do this — there is nothing to sign up for.',
    acceptLabel: 'Share this show',
    declineLabel: 'Copy link',
    moment: 'No OS prompt · falls back to clipboard',
    deniedTitle: 'Copy, with proof it happened',
    deniedBody: 'The link goes to the clipboard and the button becomes “Copied” for two seconds. The code in the link is identical, so the promoter share still tracks.',
  },
  offlineTickets: {
    id: 'offlineTickets',
    prompts: false,
    title: 'Your ticket works with no signal',
    body: 'Venues are basements. Once a ticket is yours it is stored on the device and drawn from the code itself, so the wallet opens in airplane mode.',
    acceptLabel: 'Keep tickets on this device',
    declineLabel: 'Not now',
    moment: 'Fires on first ticket · IndexedDB',
    deniedTitle: 'Online-only, said plainly',
    deniedBody: 'The wallet carries a one-line note that tickets need signal to open, so nobody discovers it in a queue. Codes re-fetch the moment there is a connection.',
  },
};

/** What the member last told OUR sheet. Never what the OS thinks. */
export type PrimerDecision = 'accepted' | 'declined' | 'unasked';

const STORAGE_PREFIX = 'ihype.primer.';

export function primerStorageKey(id: PermissionId): string {
  return `${STORAGE_PREFIX}${id}`;
}

/**
 * Whether the sheet may be shown.
 *
 * A decline is remembered and NOT re-asked: "the route to Settings is offered
 * once and never nagged". The member can still reach the capability by using
 * the control it belongs to — declining the sheet turns the feature off, it
 * does not hide it.
 *
 * `osAlreadyDecided` short-circuits everything: if the OS has already granted
 * or denied, our sheet has nothing left to ask and showing it would be theatre.
 */
export function shouldShowPrimer({
  decision,
  osAlreadyDecided,
}: {
  decision: PrimerDecision;
  osAlreadyDecided: boolean;
}): boolean {
  if (osAlreadyDecided) return false;
  return decision === 'unasked';
}
