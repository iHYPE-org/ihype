import type { ReactNode } from 'react';

/**
 * One panel of a public profile's fixed subnav.
 *
 * Every tab renders through here so an empty one looks deliberate rather than
 * broken. `empty` is the sentence a member sees when the artist or venue has
 * not filled that section in — it is required, and it must say what is
 * missing rather than "Nothing here": a member who taps Merch wants to know
 * whether this artist sells none, not that a container has no children.
 */
export function ProfilePanel({
  tabId,
  title,
  empty,
  isEmpty,
  children,
}: {
  tabId: string;
  title: string;
  empty: string;
  isEmpty: boolean;
  children?: ReactNode;
}) {
  return (
    /* A real tabpanel, named by the dial's current tab. `tabId` is required
       rather than optional so a new panel cannot be added without one — an
       unlabelled panel is the failure that is invisible until someone
       navigates here with a screen reader. */
    <section
      aria-labelledby={`tunertab-${tabId}`}
      className="profile-panel"
      id={`tunerpanel-${tabId}`}
      role="tabpanel"
      tabIndex={0}
    >
      <h2 className="profile-panel-title">{title}</h2>
      {isEmpty ? <p className="profile-panel-empty">{empty}</p> : children}
    </section>
  );
}

/**
 * Owner-authored copy from a `*Content` column.
 *
 * These columns hold whatever the page editor saved — usually plain text,
 * sometimes JSON from an older editor revision. It is rendered as TEXT, never
 * as markup: this is copy a member of the public typed, on a page other
 * members read, so treating it as HTML would be a stored-XSS hole. Paragraphs
 * split on blank lines, which is the only formatting carried across.
 *
 * A JSON blob is unwrapped when it is a recognisable `{ body }` shape and
 * otherwise skipped, because printing a raw object at someone is worse than
 * showing them the empty state.
 */
export function RichContent({ value }: { value: string | null | undefined }) {
  const text = unwrap(value);
  if (!text) return null;
  return (
    <div className="profile-prose">
      {text
        .split(/\n{2,}/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => (
          // eslint-disable-next-line react/no-array-index-key -- paragraphs of one
          // blob have no id; the list is re-rendered whole or not at all.
          <p key={i}>{para}</p>
        ))}
    </div>
  );
}

/** Returns readable copy, or null when there is nothing worth showing. */
export function unwrap(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed.trim() || null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const body = (parsed as Record<string, unknown>).body
        ?? (parsed as Record<string, unknown>).text
        ?? (parsed as Record<string, unknown>).content;
      if (typeof body === 'string') return body.trim() || null;
    }
    return null;
  } catch {
    // Not JSON after all — a paragraph that happens to open with a brace.
    return trimmed;
  }
}
