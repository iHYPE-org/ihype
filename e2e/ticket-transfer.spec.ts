import { expect, test } from '@playwright/test';
import {
  applySessionCookie,
  canSeedSession,
  seedSessionCookie,
  seedShowWithTicket,
} from './fixtures/session';

/**
 * Ticket transfer by code, end to end across TWO accounts.
 *
 * Why this suite exists rather than a unit test: the thing that was broken
 * about transfer was never the arithmetic, it was WHERE THE TICKET ENDS UP. The
 * pre-existing email transfer rewrites `Ticket.holderEmail` and leaves
 * `TicketOrder.buyerUserId` alone, while every ticket list in the app reads
 * `where: { buyerUserId }` — so it left the order in the sender's list and never
 * put it in the recipient's. No single-account test can see that; it needs a
 * second account to look at the same order from.
 *
 * Driven through the API rather than the UI on purpose. The claim form and the
 * transfer panel are thin wrappers over these two calls, and asserting the
 * OWNERSHIP MOVE is the contract — a UI-driven version would be slower and
 * would fail for reasons that have nothing to do with whose ticket it is.
 */

const SENDER = 'transfer-sender@example.com';
const RECIPIENT = 'transfer-recipient@example.com';

test.describe('ticket transfer by code', () => {
  test.skip(!canSeedSession(), 'needs a seeded database and AUTH_SECRET');

  test('a code moves the order to the claiming account and kills the old QR', async ({ browser }, testInfo) => {
    const sender = await seedSessionCookie(SENDER);
    /* Keyed on the RETRY, because claiming is irreversible: attempt 1 moves the
       order to the recipient, so a retry re-running against the same order finds
       the sender is no longer the holder and fails on a completely misleading
       assertion. Diagnosed exactly that way — the first run failed on the last
       line and the two retries then failed on the first. A test that mutates
       state it cannot restore has to seed its own. */
    const show = await seedShowWithTicket({
      buyerUserId: sender.user.id,
      buyerEmail: SENDER,
      key: `transfer-${testInfo.retry}`,
    });

    const senderContext = await browser.newContext();
    await applySessionCookie(senderContext, SENDER);
    const recipientContext = await browser.newContext();
    await applySessionCookie(recipientContext, RECIPIENT);

    // The ticket page is reachable by the holder, and offers the transfer.
    const beforePage = await senderContext.newPage();
    await beforePage.goto(`/app/me/tickets/${show.serializedId}`);
    /* Wait on the page's own heading first, with room to spare. The dev server
       is supervised and restarts itself when its proxy worker dies mid-response
       (see scripts/e2e-workerd.mjs), so a request can land in the gap; without
       this the run failed on a 5s text timeout and passed on retry, reported as
       flake with nothing to do with tickets. */
    await expect(beforePage.getByRole('heading', { name: show.title })).toBeVisible({ timeout: 20_000 });
    await expect(beforePage.getByText(/Transfer this ticket/i).first()).toBeVisible();

    /* The endpoints are addressed by the ORDER id, under a param still named
       `serializedId` — an inconsistency inherited from the email transfer
       route. The fixture hands it over rather than a spec re-deriving it. */
    const mint = await senderContext.request.post(`/api/tickets/${show.orderId}/transfer-code`);
    expect(mint.status(), await mint.text()).toBe(200);
    const { code } = await mint.json() as { code: string };
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

    // The sender cannot claim their own code — it is meant for someone else.
    const selfClaim = await senderContext.request.post('/api/tickets/claim', {
      data: { code },
    });
    expect(selfClaim.status()).toBe(409);

    // The recipient claims it.
    const claim = await recipientContext.request.post('/api/tickets/claim', { data: { code } });
    expect(claim.status(), await claim.text()).toBe(200);
    const claimed = await claim.json() as { claimed: boolean; ticketCount: number };
    expect(claimed.claimed).toBe(true);
    expect(claimed.ticketCount).toBeGreaterThan(0);

    // Single use: the same code cannot be spent twice, by anyone.
    const replay = await recipientContext.request.post('/api/tickets/claim', { data: { code } });
    expect(replay.status()).toBe(404);

    /* The old QR is dead, asserted against the page a member would actually
       open. This is the property the email transfer was fixed for and the one a
       transfer must never lose: the sender may already have screenshotted the
       QR, so if the serialized id survived they would still hold a scannable
       copy and whoever scanned first would win.

       Asserted on the PAGE rather than `GET /api/tickets/[serializedId]`, which
       an earlier draft of this test used — there is no such endpoint, so it
       would have returned 404 whatever the transfer did. A green vacuous
       assertion is worse than none. */
    await beforePage.goto(`/app/me/tickets/${show.serializedId}`);
    await expect(beforePage.getByText(/No such ticket/i)).toBeVisible();

    /* Ownership moved, asserted where ownership is DEFINED rather than where it
       is displayed: minting is gated on `buyerUserId`, so the sender losing that
       right and the recipient gaining it is the same fact the ticket lists read.

       An earlier draft asserted the show title in the recipient's ME instead and
       failed while the transfer was demonstrably correct — the database showed
       the order moved and the ids rotated. The assertion was about ME's closed
       accordion, not about transfer. A test should fail for its own subject. */
    const senderRetry = await senderContext.request.post(`/api/tickets/${show.orderId}/transfer-code`);
    expect(senderRetry.status()).toBe(404);
    const recipientMint = await recipientContext.request.post(`/api/tickets/${show.orderId}/transfer-code`);
    expect(recipientMint.status(), await recipientMint.text()).toBe(200);
  });

  test('a mistyped code is refused, and confusable characters are not', async ({ browser }, testInfo) => {
    const sender = await seedSessionCookie(`typo-${SENDER}`);
    // Own order per attempt, same reason as above.
    const show = await seedShowWithTicket({
      buyerUserId: sender.user.id,
      buyerEmail: `typo-${SENDER}`,
      key: `typo-${testInfo.retry}`,
    });
    const senderContext = await browser.newContext();
    await applySessionCookie(senderContext, `typo-${SENDER}`);
    const recipientContext = await browser.newContext();
    await applySessionCookie(recipientContext, `typo-${RECIPIENT}`);

    const mint = await senderContext.request.post(`/api/tickets/${show.orderId}/transfer-code`);
    expect(mint.status()).toBe(200);
    const { code } = await mint.json() as { code: string };

    // Nonsense is a 400, not a 404: the shape is wrong, so nothing was looked up.
    const nonsense = await recipientContext.request.post('/api/tickets/claim', { data: { code: 'nope' } });
    expect(nonsense.status()).toBe(400);

    /* Lowercased and unhyphenated still claims. A code is read aloud and typed
       by someone who did not choose it; refusing it for its case would send
       people back to the sender for a screenshot. */
    const relaxed = code.replace('-', '').toLowerCase();
    const claim = await recipientContext.request.post('/api/tickets/claim', { data: { code: relaxed } });
    expect(claim.status(), await claim.text()).toBe(200);
  });
});
