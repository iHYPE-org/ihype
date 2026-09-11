/**
 * Which routes own the whole screen, and therefore render NONE of the
 * member chrome the root layout mounts (the site header, the tab bar and
 * the player dock).
 *
 * WHY THIS IS A MODULE AND NOT A STYLESHEET RULE. It used to be one:
 * `body:has(.ops-shell) { … display: none }` in globals.css, on the stated
 * reasoning that "the root layout has no path awareness, so a page that owns
 * the whole screen has to say so in markup rather than the layout guessing".
 *
 * The reasoning was wrong on its premise and the consequence was visible in
 * production. The root layout CAN know the path — middleware has set
 * `x-pathname` on every request since long before that rule was written — and
 * a marker in markup only works once the markup exists. `/admin`'s layout is
 * ASYNC: it awaits `auth()`, `cookies()` and a database lookup for the device
 * registration before it renders `AdminShell`. For the whole of that wait the
 * document has a root layout and no `.ops-shell`, so the `:has()` matches
 * nothing and the member header, the tab bar and the "NOW PLAYING" dock all
 * paint over the operator console — reported by the owner with a screenshot
 * showing exactly that, on a page whose own console had finished rendering.
 *
 * A CSS rule keyed on a descendant cannot hide chrome that renders BEFORE the
 * descendant. The path is known at the top of the request; ask it there.
 *
 * The globals.css block stays as the second copy of the same decision — it
 * also flattens `.site-shell` padding, which is layout rather than presence.
 */
const WHOLE_SCREEN_PREFIXES = ['/admin'] as const;

export function ownsWholeScreen(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return WHOLE_SCREEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
