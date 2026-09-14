import { NextResponse } from 'next/server';

/**
 * The answer a read route gives when its PRIMARY read failed.
 *
 * Four routes used to catch that read to `[]` and answer 200 with an empty
 * collection — `{ rows: [] }`, `{ tracks: [] }`, `{ loved: [], nearby: [],
 * matches: [] }`, a sparkline of zeros — so no client could tell "there is
 * nothing" from "the database did not answer", and every empty-state sentence
 * downstream became a claim over a failed read (DESIGN_SYNC row 451; rows
 * 408 and 450 taught the clients to branch on a non-2xx, which only works if
 * the route sends one). A 503 with `Retry-After` is the shape `/api/stations`
 * already uses for RADIO_PAUSED and the ticket purchase route for
 * PAYMENTS_UNAVAILABLE: a monitor reads it as an outage rather than our bug,
 * and a client reads it as "not yet", never as "none".
 *
 * Secondary reads — a ranking signal, a genre list for a picker — may still
 * degrade to empty, with a comment saying so; this is for the read the
 * response IS.
 */
export const READ_UNAVAILABLE_CODE = 'READ_UNAVAILABLE' as const;

export function readUnavailableResponse(what: string): NextResponse {
  return NextResponse.json(
    { error: `${what} could not be read right now. Try again in a moment.`, code: READ_UNAVAILABLE_CODE },
    { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'private, no-store' } },
  );
}
