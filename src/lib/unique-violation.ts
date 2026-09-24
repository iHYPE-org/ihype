/**
 * True when a Prisma write failed on a unique constraint (P2002).
 *
 * The show toggles (reaction, attendee opt-in, RSVP, setlist vote) read then
 * create against a unique index, so a double-tap sends two creates and the
 * second used to answer 500 (2026-09-24, DESIGN_SYNC row 513). Losing that
 * race means the row the member asked for already exists — the toggle is in
 * the state they wanted — so callers treat it as success, not as a fault.
 * Duck-typed on `code` so it needs no Prisma runtime import.
 */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}
