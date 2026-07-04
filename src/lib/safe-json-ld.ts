// JSON.stringify does not escape "</script>", so embedding untrusted text
// (show titles, descriptions, profile names) straight into a JSON-LD
// <script> tag lets it break out into raw HTML. Escaping '<' to its unicode
// form is JSON-safe and defeats that without touching the parsed data.
export function toSafeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
