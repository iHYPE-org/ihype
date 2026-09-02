/**
 * The one HTML escaper for strings that end up inside markup we assemble by
 * hand — the newsletter confirm and unsubscribe pages, and every email body
 * built with a template literal.
 *
 * Found by the 2026-09-02 security sweep: `/api/newsletter/confirm` wrote
 * `Profile.name` straight into a `text/html` response with no escaping, and
 * a profile name is member-supplied free text. `/api/*` is outside the CSP
 * middleware matcher, so a name carrying markup ran as script on ihype.org
 * for whoever clicked the (real) confirmation link. The emails had the same
 * shape with a smaller blast radius — a show title rendering as a live link
 * under the iHYPE sender is a phishing vector, not script.
 *
 * Escapes the five characters that matter in both text and attribute
 * positions. Use it on EVERY interpolated value that came from a person or
 * the database; constants and server-built URLs do not need it.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
