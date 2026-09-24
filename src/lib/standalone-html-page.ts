import { NextResponse } from 'next/server';
import { OG } from '@/app/api/og/palette';
import { escapeHtml } from '@/lib/html-escape';

/**
 * The page a member lands on from an email link — unsubscribe, newsletter
 * confirm, newsletter unsubscribe — answered as a hand-built document with no
 * stylesheet, because those routes sit outside the app and outside the CSP
 * middleware.
 *
 * THREE COPIES OF THIS PAINTED `var(--bg)` AND `var(--accent)` INTO A DOCUMENT
 * THAT LOADS NO STYLESHEET (2026-09-24, DESIGN_SYNC row 513). Neither resolves,
 * so the ground was the browser's white and the heading and link inherited the
 * literal `#eef1f6` beside them — DS8's off-white, about 1.1:1 on white. The
 * member who clicked "unsubscribe" was told the result in near-invisible ink,
 * measured on production. A document with no stylesheet paints with literals;
 * these come from `OG`, whose every value `brand-assets.test.ts` holds to
 * `:root`, so they cannot drift from the product the way the three copies did.
 *
 * `heading` and `body` are escaped HERE, not by callers, because one of them
 * carries `Profile.name` — member-supplied text (the 2026-09-02 sweep).
 */
export function standaloneHtmlPage(rawHeading: string, rawBody: string, status: number): NextResponse {
  const heading = escapeHtml(rawHeading);
  const body = escapeHtml(rawBody);
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${heading} — iHYPE</title>
  </head>
  <body style="margin:0;background:${OG.bg};color:${OG.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
      <h1 style="font-size:28px;margin:0 0 12px;">${heading}</h1>
      <p style="margin:0 0 24px;color:${OG.ink3};line-height:1.5;">${body}</p>
      <a href="https://ihype.org/" style="color:${OG.accent};font-weight:600;">Back to iHYPE</a>
    </div>
  </body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}
