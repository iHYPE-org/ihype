from pathlib import Path
import re

path = Path('src/app/shows/[slug]/page.tsx')
text = path.read_text(encoding='utf-8')

anchor = "  const isShowOwner = Boolean(session?.user?.id) && session?.user?.id === show.creatorId;\n"
if text.count(anchor) != 1:
    raise RuntimeError('show page owner anchor was not found exactly once')

replacement = anchor + """
  const recentTicketOrders = isShowOwner || isAdminSession(session)
    ? await db.ticketOrder.findMany({
        where: { showId: show.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          status: true,
          totalTaxCents: true,
          quantity: true,
          totalChargeCents: true,
          subtotalCents: true,
          venuePayoutCents: true,
          artistPayoutCents: true,
          promoterPayoutCents: true,
          tickets: { select: { reassignCount: true } },
        },
      })
    : [];
"""
text = text.replace(anchor, replacement, 1)

pattern = re.compile(
    r"\n\s*\{show\.ticketOrders\.length \? \([\s\S]*?\n\s*\) : null\}"
    r"\n\s*\{show\.isTicketed && show\.ticketOrders\.length > 0 && \([\s\S]*?\n\s*\)\}"
    r"(?=\n\s*\{show\.isRadioShow)",
)
match = pattern.search(text)
if not match:
    raise RuntimeError('ticket-order presentation block was not found')

safe_block = """

            {recentTicketOrders.length ? (
              <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                <h2>Recent ticket order totals</h2>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th><th>Tax</th><th>Qty</th><th>Total</th><th>Venue</th><th>Artist</th><th>Promoter</th>
                      <th title="Total reassignments across all tickets in this order">Passed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTicketOrders.map((order) => {
                      const totalPassed = order.tickets.reduce((sum, ticket) => sum + ticket.reassignCount, 0);
                      return (
                        <tr key={order.id}>
                          <td>{order.status}</td>
                          <td>{formatCurrencyFromCents(order.totalTaxCents)}</td>
                          <td>{order.quantity}</td>
                          <td>{formatCurrencyFromCents(order.totalChargeCents || order.subtotalCents)}</td>
                          <td>{formatCurrencyFromCents(order.venuePayoutCents)}</td>
                          <td>{formatCurrencyFromCents(order.artistPayoutCents)}</td>
                          <td>{formatCurrencyFromCents(order.promoterPayoutCents)}</td>
                          <td style={totalPassed > 0 ? { color: 'var(--accent-3)', fontWeight: 600 } : { color: 'var(--muted)' }}>
                            {totalPassed > 0 ? `${totalPassed}×` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {show.isTicketed && canWatch && currentFan?.role === 'FAN' && (
              <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                <h2>Transfer your ticket</h2>
                <p className="subtitle" style={{ marginBottom: '1rem' }}>Can&apos;t make it? You can transfer your ticket to a friend without a fee.</p>
                <p className="meta">Use the secure link in your ticket email, or go to <Link href="/home">your dashboard</Link> to manage your orders.</p>
              </div>
            )}
"""

text = text[:match.start()] + safe_block + text[match.end():]
path.write_text(text, encoding='utf-8')

lint_path = Path('scripts/lint-source.mjs')
lint_text = lint_path.read_text(encoding='utf-8')
old_policy = """const privacyExport = await text('src/app/api/privacy/export/route.ts');
for (const forbiddenInclude of ['issuedTickets: true', 'followers: true', 'receivedBookingRequests: true']) {
  if (privacyExport.includes(forbiddenInclude)) {
    fail('src/app/api/privacy/export/route.ts', `third-party relation must not be exported: ${forbiddenInclude}`);
  }
}
"""
new_policy = """const privacyExport = await text('src/app/api/privacy/export/route.ts');
for (const relation of ['issuedTickets', 'followers', 'receivedBookingRequests']) {
  const broadRelationLoad = new RegExp(`^\\\\s{10}${relation}: true,`, 'm');
  if (broadRelationLoad.test(privacyExport)) {
    fail('src/app/api/privacy/export/route.ts', `third-party relation records must not be exported: ${relation}`);
  }
}
"""
if lint_text.count(old_policy) != 1:
    raise RuntimeError('privacy export source-policy anchor was not found exactly once')
lint_path.write_text(lint_text.replace(old_policy, new_policy, 1), encoding='utf-8')

print('Ticket-order page data and privacy source policy corrected.')
