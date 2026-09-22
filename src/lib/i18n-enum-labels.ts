/**
 * Translations for the labels that live in ENUMERATIONS — a tab list, a role
 * card, a stat catalogue — drawn at the moment they render.
 *
 * Every helper is a switch of LITERAL `t('key', 'English')` calls keyed on the
 * English the enumeration declares, the way `mmm-shell-labels.ts` translates
 * the dock and the strips. That shape is load-bearing: `extract-i18n-keys.mjs`
 * collects exactly `t('key', 'English')` and `apply-i18n-batch.mjs` refuses a
 * key the extractor cannot see, so a template key — `t(\`payoutsPage.tab.${id}\`)`
 * — is a key no translation can ever be applied to. On 2026-09-14 the
 * member-facing surface carried 29 such families (DESIGN_SYNC row 422): the
 * join page's role cards, the payouts and site tabs, the accessibility theme
 * names, the profile editor's sections and stat board, the cancellation
 * reasons, the trust categories, the launch page — every one English in all
 * eleven locales by construction, and every one invisible to the audit that
 * measures translation gaps, because that audit reads the same extractor.
 *
 * The unknown-value branch returns the English it was handed, so a new entry
 * in an enumeration renders correctly before anyone adds its case here; the
 * unit test drives every known value through an identity `t` and asserts the
 * English comes back unchanged, so a case cannot silently rename a label.
 */

export type Translate = (key: string, fallback?: string) => string;

export function joinRoleLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Fan': return t('joinPage.role.fan', 'Fan');
    case 'Artist': return t('joinPage.role.artist', 'Artist');
    case 'Venue': return t('joinPage.role.venue', 'Venue');
    case 'Advertiser': return t('joinPage.role.advertiser', 'Advertiser');
    default: return english;
  }
}

export function joinRoleHelp(t: Translate, english: string): string {
  switch (english) {
    case 'Discover, hype, and buy tickets fee-free.': return t('joinPage.roleHelp.fan', 'Discover, hype, and buy tickets fee-free.');
    case '70% of every ticket, your own page and shows.': return t('joinPage.roleHelp.artist', '70% of every ticket, your own page and shows.');
    case '20% of every gate and real demand data.': return t('joinPage.roleHelp.venue', '20% of every gate and real demand data.');
    case 'Music-only campaigns with no access to personal user data.': return t('joinPage.roleHelp.advertiser', 'Music-only campaigns with no access to personal user data.');
    default: return english;
  }
}

export function launchCohortTitle(t: Translate, english: string): string {
  switch (english) {
    case 'Artists': return t('launchPage.cohort.artists.title', 'Artists');
    case 'Venues': return t('launchPage.cohort.venues.title', 'Venues');
    case 'Partners & media': return t('launchPage.cohort.partners.title', 'Partners & media');
    default: return english;
  }
}

export function launchCohortTarget(t: Translate, english: string): string {
  switch (english) {
    case '25 founding artists': return t('launchPage.cohort.artists.target', '25 founding artists');
    case '5 founding venues': return t('launchPage.cohort.venues.target', '5 founding venues');
    case '5 distribution partners': return t('launchPage.cohort.partners.target', '5 distribution partners');
    default: return english;
  }
}

export function launchCohortCopy(t: Translate, english: string): string {
  switch (english) {
    case 'Publish music, join coordinated discovery drops, and turn listener response into visible demand for bookings.':
      return t('launchPage.cohort.artists.copy', 'Publish music, join coordinated discovery drops, and turn listener response into visible demand for bookings.');
    case 'Scout emerging acts with better local signal, list events without buyer fees, and help shape the venue workflow.':
      return t('launchPage.cohort.venues.copy', 'Scout emerging acts with better local signal, list events without buyer fees, and help shape the venue workflow.');
    case 'Contribute a newsletter placement, calendar listing, interview, showcase slot, artist introduction, or sponsorship.':
      return t('launchPage.cohort.partners.copy', 'Contribute a newsletter placement, calendar listing, interview, showcase slot, artist introduction, or sponsorship.');
    default: return english;
  }
}

export function launchCohortCta(t: Translate, english: string): string {
  switch (english) {
    case 'Join as an artist': return t('launchPage.cohort.artists.cta', 'Join as an artist');
    case 'Join as a venue': return t('launchPage.cohort.venues.cta', 'Join as a venue');
    case 'Start a partnership': return t('launchPage.cohort.partners.cta', 'Start a partnership');
    default: return english;
  }
}

export function launchSprintDay(t: Translate, english: string): string {
  switch (english) {
    case 'Day 1': return t('launchPage.sprint.day1', 'Day 1');
    case 'Day 2': return t('launchPage.sprint.day2', 'Day 2');
    case 'Day 3': return t('launchPage.sprint.day3', 'Day 3');
    case 'Day 4': return t('launchPage.sprint.day4', 'Day 4');
    case 'Day 5': return t('launchPage.sprint.day5', 'Day 5');
    case 'Day 6': return t('launchPage.sprint.day6', 'Day 6');
    case 'Day 7': return t('launchPage.sprint.day7', 'Day 7');
    default: return english;
  }
}

export function launchSprintTitle(t: Translate, english: string): string {
  switch (english) {
    case 'Join the founding cohort': return t('launchPage.sprint.step1Title', 'Join the founding cohort');
    case 'Build the launch roster': return t('launchPage.sprint.step2Title', 'Build the launch roster');
    case 'Prepare the share kit': return t('launchPage.sprint.step3Title', 'Prepare the share kit');
    case 'Activate partners': return t('launchPage.sprint.step4Title', 'Activate partners');
    case 'Announce the showcase': return t('launchPage.sprint.step5Title', 'Announce the showcase');
    case 'Release together': return t('launchPage.sprint.step6Title', 'Release together');
    case 'Publish the signal': return t('launchPage.sprint.step7Title', 'Publish the signal');
    default: return english;
  }
}

export function launchSprintCopy(t: Translate, english: string): string {
  switch (english) {
    case 'Artists, venues, DJs, partners, and fans claim their role and profile.':
      return t('launchPage.sprint.step1Copy', 'Artists, venues, DJs, partners, and fans claim their role and profile.');
    case 'The first cohort submits music, dates, pages, and showcase availability.':
      return t('launchPage.sprint.step2Copy', 'The first cohort submits music, dates, pages, and showcase availability.');
    case 'Each participant receives coordinated copy, clips, artwork, and a tracked link.':
      return t('launchPage.sprint.step3Copy', 'Each participant receives coordinated copy, clips, artwork, and a tracked link.');
    case 'Venues, media, radio, colleges, and arts partners schedule their distribution action.':
      return t('launchPage.sprint.step4Copy', 'Venues, media, radio, colleges, and arts partners schedule their distribution action.');
    case 'The first discovery showcase opens RSVPs and listener reminders.':
      return t('launchPage.sprint.step5Copy', 'The first discovery showcase opens RSVPs and listener reminders.');
    case 'The cohort publishes in one concentrated window instead of whispering separately into the void.':
      return t('launchPage.sprint.step6Copy', 'The cohort publishes in one concentrated window instead of whispering separately into the void.');
    case 'iHYPE shares the first scene chart, results, clips, and booking-interest report.':
      return t('launchPage.sprint.step7Copy', 'iHYPE shares the first scene chart, results, clips, and booking-interest report.');
    default: return english;
  }
}

export function infoTabLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Trust & Safety': return t('infoTabs.trust', 'Trust & Safety');
    case 'Transparency': return t('infoTabs.transparency', 'Transparency');
    case 'Privacy Policy': return t('infoTabs.privacy', 'Privacy Policy');
    case 'Terms of Service': return t('infoTabs.terms', 'Terms of Service');
    case 'The Charter': return t('infoTabs.charter', 'The Charter');
    case 'DMCA': return t('infoTabs.dmca', 'DMCA');
    default: return english;
  }
}

export function payoutTabLabel(t: Translate, english: string): string {
  switch (english) {
    case 'History': return t('payoutsPage.tab.history', 'History');
    case 'Settings': return t('payoutsPage.tab.settings', 'Settings');
    case 'This show': return t('payoutsPage.tab.show', 'This show');
    default: return english;
  }
}

/** `'console'` is the stored id of the DEFAULT theme; since 2026-09-05 that is the Apple Music light look, so it reads "Light". */
export function themeLabel(t: Translate, name: string): string {
  switch (name) {
    case 'console': return t('appShell.a11y.theme.light', 'Light');
    case 'dark': return t('appShell.a11y.theme.dark', 'Dark');
    case 'flowery': return t('appShell.a11y.theme.flowery', 'Flowery');
    case 'street': return t('appShell.a11y.theme.street', 'Street');
    case 'metal': return t('appShell.a11y.theme.metal', 'Metal');
    case 'classical': return t('appShell.a11y.theme.classical', 'Classical');
    default: return name ? name[0].toUpperCase() + name.slice(1) : name;
  }
}

export function cancellationReasonLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Artist can no longer perform': return t('eventCancellationFlow.reason.artist', 'Artist can no longer perform');
    case 'Venue issue / closure': return t('eventCancellationFlow.reason.venue', 'Venue issue / closure');
    case 'Low ticket sales': return t('eventCancellationFlow.reason.lowSales', 'Low ticket sales');
    case 'Other': return t('eventCancellationFlow.reason.other', 'Other');
    default: return english;
  }
}

export function analyticsRangeLabel(t: Translate, english: string): string {
  switch (english) {
    case '7 Days': return t('artistsSlugAnalyticsPage.range.7d', '7 Days');
    case '30 Days': return t('artistsSlugAnalyticsPage.range.30d', '30 Days');
    case 'YTD': return t('artistsSlugAnalyticsPage.range.ytd', 'YTD');
    default: return english;
  }
}

export function askStatusLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Pending': return t('fansSlugPage.askStatus.pending', 'Pending');
    case 'Booked': return t('fansSlugPage.askStatus.booked', 'Booked');
    case 'Passed': return t('fansSlugPage.askStatus.passed', 'Passed');
    default: return english;
  }
}

export function trustCategoryLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Track uploads': return t('trustSafetyPanel.category.track', 'Track uploads');
    case 'Profiles': return t('trustSafetyPanel.category.profile', 'Profiles');
    case 'Profile images': return t('trustSafetyPanel.category.profileImage', 'Profile images');
    case 'Shows': return t('trustSafetyPanel.category.show', 'Shows');
    case 'Comments': return t('trustSafetyPanel.category.comment', 'Comments');
    case 'Ad audio spots': return t('trustSafetyPanel.category.adAudio', 'Ad audio spots');
    default: return english;
  }
}

export function pagesTabLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Search': return t('pagesHome.tab.search', 'Search');
    case 'My Page': return t('pagesHome.tab.myPage', 'My Page');
    case 'Network': return t('pagesHome.tab.network', 'Network');
    case 'Creator': return t('pagesHome.tab.creator', 'Creator');
    default: return english;
  }
}

export function profileTypeLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Artist': return t('pagesHome.type.artist', 'Artist');
    case 'Venue': return t('pagesHome.type.venue', 'Venue');
    case 'Fan': return t('pagesHome.type.fan', 'Fan');
    default: return english;
  }
}

export function netFilterLabel(t: Translate, english: string): string {
  switch (english) {
    case 'All': return t('pagesHome.netFilter.all', 'All');
    case 'Artists': return t('pagesHome.netFilter.artists', 'Artists');
    case 'Venues': return t('pagesHome.netFilter.venues', 'Venues');
    case 'Fans': return t('pagesHome.netFilter.fans', 'Fans');
    default: return english;
  }
}

export function createCardName(t: Translate, english: string): string {
  switch (english) {
    case 'Artist Page': return t('pagesHome.createCard.artist.name', 'Artist Page');
    case 'Venue Page': return t('pagesHome.createCard.venue.name', 'Venue Page');
    default: return english;
  }
}

export function createCardDesc(t: Translate, english: string): string {
  switch (english) {
    case 'Upload tracks, list shows, sell tickets. Keep 70%.': return t('pagesHome.createCard.artist.desc', 'Upload tracks, list shows, sell tickets. Keep 70%.');
    case 'Book from the demand radar. Keep 20% of every room.': return t('pagesHome.createCard.venue.desc', 'Book from the demand radar. Keep 20% of every room.');
    default: return english;
  }
}

export function editorSectionLabel(t: Translate, english: string): string {
  switch (english) {
    case 'About': return t('pageEditor.section.about', 'About');
    case 'Media': return t('pageEditor.section.media', 'Media');
    case 'Press kit': return t('pageEditor.section.pressKit', 'Press kit');
    case 'Stats': return t('pageEditor.section.stats', 'Stats');
    case 'Event Info': return t('pageEditor.section.eventInfo', 'Event Info');
    case 'Contact': return t('pageEditor.section.contact', 'Contact');
    default: return english;
  }
}

export function statOptionLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Total Hypes': return t('pageEditor.statOption.hypeTotal', 'Total Hypes');
    case 'Followers': return t('pageEditor.statOption.followerCount', 'Followers');
    case 'Monthly Listeners': return t('pageEditor.statOption.monthlyListeners', 'Monthly Listeners');
    case 'Track Completion': return t('pageEditor.statOption.trackCompletionRate', 'Track Completion');
    case 'Tickets Sold': return t('pageEditor.statOption.ticketsSold', 'Tickets Sold');
    case 'Shows Attended': return t('pageEditor.statOption.showsAttended', 'Shows Attended');
    case 'Artists Hyped': return t('pageEditor.statOption.artistsHyped', 'Artists Hyped');
    case 'Tickets Bought': return t('pageEditor.statOption.ticketsBought', 'Tickets Bought');
    case 'Asks': return t('pageEditor.statOption.asksMade', 'Asks');
    case 'Asks Booked': return t('pageEditor.statOption.asksBooked', 'Asks Booked');
    default: return english;
  }
}

export function statBoardLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Listens': return t('pageEditor.statBoard.listens', 'Listens');
    case 'Completed listens': return t('pageEditor.statBoard.completedListens', 'Completed listens');
    case 'Follows': return t('pageEditor.statBoard.follows', 'Follows');
    case 'Hypes': return t('pageEditor.statBoard.hypes', 'Hypes');
    case 'Past events': return t('pageEditor.statBoard.pastEvents', 'Past events');
    case 'Upcoming events': return t('pageEditor.statBoard.upcomingEvents', 'Upcoming events');
    case 'Total tickets sold': return t('pageEditor.statBoard.ticketsSold', 'Total tickets sold');
    case 'Recommendations': return t('pageEditor.statBoard.recommendations', 'Recommendations');
    case 'Requests': return t('pageEditor.statBoard.requests', 'Requests');
    case 'Booking requests': return t('pageEditor.statBoard.bookingRequests', 'Booking requests');
    default: return english;
  }
}

/** Keyed on the sentence, not the tile key: `follows` carries one hint on an artist board and another on a venue board. */
export function statBoardHint(t: Translate, english: string): string {
  switch (english) {
    case 'Fans who have played one of your tracks.': return t('pageEditor.statBoardHint.listens', 'Fans who have played one of your tracks.');
    case 'Plays that reached the end of the track.': return t('pageEditor.statBoardHint.completedListens', 'Plays that reached the end of the track.');
    case 'Fans following this profile.': return t('pageEditor.statBoardHint.followsProfile', 'Fans following this profile.');
    case 'Fans following this venue.': return t('pageEditor.statBoardHint.followsVenue', 'Fans following this venue.');
    case 'Hypes this profile has received.': return t('pageEditor.statBoardHint.hypesProfile', 'Hypes this profile has received.');
    case 'Hypes this venue has received.': return t('pageEditor.statBoardHint.hypesVenue', 'Hypes this venue has received.');
    case 'Shows you played or promoted that have happened.': return t('pageEditor.statBoardHint.pastEventsArtist', 'Shows you played or promoted that have happened.');
    case 'Shows hosted here that have happened.': return t('pageEditor.statBoardHint.pastEventsVenue', 'Shows hosted here that have happened.');
    case 'Shows on the calendar, including one on stage now.': return t('pageEditor.statBoardHint.upcomingEvents', 'Shows on the calendar, including one on stage now.');
    case 'Paid tickets across those shows.': return t('pageEditor.statBoardHint.ticketsSoldArtist', 'Paid tickets across those shows.');
    case 'Paid tickets across shows hosted here.': return t('pageEditor.statBoardHint.ticketsSoldVenue', 'Paid tickets across shows hosted here.');
    case 'Venues whose demand radar is recommending you right now.': return t('pageEditor.statBoardHint.recommendationsArtist', 'Venues whose demand radar is recommending you right now.');
    case 'Acts your demand radar is recommending right now.': return t('pageEditor.statBoardHint.recommendationsVenue', 'Acts your demand radar is recommending right now.');
    case 'Fans who asked a venue to book you.': return t('pageEditor.statBoardHint.requestsArtist', 'Fans who asked a venue to book you.');
    case 'Fans who asked you to book someone.': return t('pageEditor.statBoardHint.requestsVenue', 'Fans who asked you to book someone.');
    case 'Your outreach to artists, every status.': return t('pageEditor.statBoardHint.bookingRequests', 'Your outreach to artists, every status.');
    default: return english;
  }
}

export function verifyProofLine(t: Translate, english: string): string {
  switch (english) {
    case 'A link to your Spotify, Bandcamp, or SoundCloud profile with at least one published track':
      return t('verifyForm.proof.artistLink', 'A link to your Spotify, Bandcamp, or SoundCloud profile with at least one published track');
    case 'A screenshot of a past show booking or contract':
      return t('verifyForm.proof.artistBooking', 'A screenshot of a past show booking or contract');
    case 'Social media profile showing your music':
      return t('verifyForm.proof.artistSocial', 'Social media profile showing your music');
    case 'Business license or permits for the venue':
      return t('verifyForm.proof.venueLicense', 'Business license or permits for the venue');
    case 'Official venue website or Google Maps listing':
      return t('verifyForm.proof.venueWebsite', 'Official venue website or Google Maps listing');
    case 'A recent event poster or booking invoice':
      return t('verifyForm.proof.venuePoster', 'A recent event poster or booking invoice');
    default: return english;
  }
}

export function showTabLabel(t: Translate, english: string): string {
  switch (english) {
    case 'About': return t('showTabs.about', 'About');
    case 'Lineup': return t('showTabs.lineup', 'Lineup');
    case 'Venue': return t('showTabs.venue', 'Venue');
    default: return english;
  }
}

export function supportCategoryLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Ticket issue': return t('supportForm.category.ticketIssue', 'Ticket issue');
    case 'Payment / Payout': return t('supportForm.category.paymentPayout', 'Payment / Payout');
    case 'Account / Login': return t('supportForm.category.accountLogin', 'Account / Login');
    case 'Verification': return t('supportForm.category.verification', 'Verification');
    case 'Privacy / Data': return t('supportForm.category.privacyData', 'Privacy / Data');
    case 'Bug report': return t('supportForm.category.bugReport', 'Bug report');
    case 'Other': return t('supportForm.category.other', 'Other');
    default: return english;
  }
}

/**
 * `showRowTrail()` returns its label as the English the row test pins;
 * `ProfileRow` draws whatever it is handed, so the pane translates here.
 */
export function showTrailLabel(t: Translate, english: string): string {
  switch (english) {
    case 'On stage now': return t('showRow.trail.onStageNow', 'On stage now');
    case 'On sale': return t('showRow.trail.onSale', 'On sale');
    case 'Tickets soon': return t('showRow.trail.ticketsSoon', 'Tickets soon');
    default: return english;
  }
}

/** `formatTicketPrice()` answers a formatted amount or the word `Free`; only the word needs a dictionary. */
export function ticketPriceLabel(t: Translate, english: string): string {
  switch (english) {
    case 'Free': return t('showRow.price.free', 'Free');
    default: return english;
  }
}

/** The ME activity row's title when the show it belongs to is gone (`mmm-me.ts` names the fallback, `MmmMe` draws it). */
export function meActivityFallbackTitle(t: Translate, english: string): string {
  switch (english) {
    case 'Ticket order': return t('mmmMe.activity.ticketOrder', 'Ticket order');
    case 'Show payout': return t('mmmMe.activity.showPayout', 'Show payout');
    case 'Show settlement': return t('mmmMe.activity.showSettlement', 'Show settlement');
    default: return english;
  }
}

/**
 * What a PENDING payable is waiting for, keyed on the `kind` that
 * `describePayableRelease()` (src/lib/payout-release.ts) returns.
 *
 * Switching on a state rather than on English is the one departure from this
 * module's rule, and it is the right one here: there is no English label in
 * the enumeration to key on — the state is computed — while the shape that
 * matters (a switch of literal `t('key', 'English')` calls, so the extractor
 * and the applier can both see them) is unchanged. `releasesOn` arrives
 * already formatted, because only the caller knows the member's locale.
 *
 * Until 2026-09-15 every one of these read "Released automatically once the
 * show ends", unconditionally, including over a tax entry nothing releases and
 * over a payee with no account to release to.
 */
export function payoutReleaseLabel(t: Translate, kind: string, opts?: { releasesOn?: string; holdDays?: number }): string {
  switch (kind) {
    case 'manual-remittance':
      return t('payoutsHistoryPanel.release.manual', 'Tax. Remitted by hand — no automatic payout runs against this.');
    case 'no-destination':
      return t('payoutsHistoryPanel.release.noDestination', 'Waiting on a payout account. Connect one under Settings and this is released on the next run.');
    case 'awaiting-show':
      return t('payoutsHistoryPanel.release.awaitingShow', 'Released about {days} days after the show, once it has ended.')
        .replace('{days}', String(opts?.holdDays ?? 10));
    case 'holding':
      return t('payoutsHistoryPanel.release.holding', 'The show has ended. Held until {date} in case of a card dispute, then released.')
        .replace('{date}', opts?.releasesOn ?? '');
    case 'due':
      return t('payoutsHistoryPanel.release.due', 'Due now — the next payout run pays this.');
    default:
      return t('payoutsHistoryPanel.release.unknown', 'We could not read this show, so we cannot say when this is released.');
  }
}
