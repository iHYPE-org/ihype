/**
 * Where a show reminder points, and how it is found again.
 *
 * ## The link was a cuid in a path keyed on a slug
 *
 * `POST /api/shows/[showId]/remind` resolves the show by primary key and then
 * wrote `link: '/shows/' + id`. `/shows/[slug]` resolves `where: { slug }` and
 * nothing else, so every reminder notification a fan has ever set pointed at a
 * URL that cannot resolve — and `NotificationsList` pushes `n.link` on a tap,
 * so the one control that exists to bring somebody back to a show delivered
 * them to the not-found page instead.
 *
 * Nothing caught it because the WRITE and the READ agreed: the route found its
 * own row by the same wrong key, and the show page read the button's lit state
 * by the same wrong key again. The toggle therefore worked perfectly. Only the
 * destination was wrong, and only a member tapping the notification would ever
 * find out. Same shape as the `/artists/<ownerId>` link in DESIGN_SYNC row 385:
 * an id in a path keyed on a slug, in code where every internal check passes.
 *
 * ## Why this is a module rather than two template literals
 *
 * Three places name this key — the route's write, the route's toggle lookup,
 * and the show page's lit-state read — and the defect above is exactly what
 * happens when they agree with each other and not with the router. They read
 * it from here now, so the link a member taps and the key the product looks it
 * up by cannot drift apart again.
 */

/** The link a reminder notification carries. `/shows/[slug]` is a SLUG route. */
export function showReminderLink(slug: string): string {
  return `/shows/${slug}`;
}

/**
 * Every key a reminder for this show may be stored under.
 *
 * The migration rewrites the stored cuid links onto the slug, so in a settled
 * database the first entry is the only one that matches. The legacy key stays
 * in the lookup because a reminder set between the deploy and the migration
 * would otherwise be invisible to its own toggle — the member would press the
 * button and get a SECOND notification rather than clearing the first.
 */
export function showReminderLinkKeys(slug: string, id: string): string[] {
  return [showReminderLink(slug), `/shows/${id}`];
}
