import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { isAdminSession } from '@/lib/permissions';
import { DEFAULT_TTL_DAYS, DEFAULT_USES, planReviewLink, reviewLinkBaseUrl, validateMintOptions } from '@/lib/review-access';

export const dynamic = 'force-dynamic';

/**
 * Mints the store-review sign-in link. Admin only. Read
 * `src/lib/review-access.ts` first — it carries why this exists instead of the
 * password it replaced.
 *
 * ## The account
 *
 * One row, created on first mint so there is nothing to seed and nothing to
 * remember, and reused after that so a second mint does not accumulate review
 * accounts. `role: 'FAN'` on create only: an operator who deliberately raised
 * it should not have that silently reset, and `clampAdminRole` in `auth.ts`
 * refuses ADMIN to any address off the admin allowlist regardless.
 *
 * ## The secret is returned exactly once
 *
 * Only the SHA-256 hash is stored, like every other magic link, so a database
 * reader cannot sign in as anybody and nobody — including an administrator —
 * can recover the URL later. Losing it costs one more mint; being able to
 * recover it would make the row itself a credential.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { uses?: unknown; ttlDays?: unknown; label?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* An empty body is the ordinary case — the console's button sends none and
       takes the defaults. Only a malformed one lands here, and the validation
       below rejects anything it produced. */
  }

  const options = {
    uses: typeof body.uses === 'number' ? body.uses : DEFAULT_USES,
    ttlDays: typeof body.ttlDays === 'number' ? body.ttlDays : DEFAULT_TTL_DAYS,
  };
  const valid = validateMintOptions(options);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.reason }, { status: 400 });
  }

  const rawLabel = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : '';
  const label = rawLabel || `Store review — minted ${new Date().toISOString().slice(0, 10)}`;

  /* Derived from configuration rather than the request, so a link minted
     through a preview or a proxied host cannot hand a reviewer a URL that only
     resolves inside that network. Same resolution order the emailed link uses,
     shared rather than restated — two copies of "where does this site live"
     is how one of them ends up wrong. */
  const baseUrl = reviewLinkBaseUrl();

  try {
    const user = await db.user.upsert({
      where: { email: REVIEW_ACCOUNT_EMAIL },
      update: {},
      create: {
        email: REVIEW_ACCOUNT_EMAIL,
        name: 'App Review',
        /* `User.username` is `@unique` and required. A fixed handle rather
           than a de-duplicated stem: there is exactly one review account, so a
           collision means a member already holds the handle, and failing
           loudly then is better than signing a reviewer into `app-review2`. */
        username: 'app-review',
        role: 'FAN',
        /* The address is ours by construction and has no mailbox, so an
           unverified account would be nagged for a code it can never receive. */
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    const plan = planReviewLink(options);

    await db.magicLinkToken.create({
      data: {
        token: plan.tokenHash,
        userId: user.id,
        expiresAt: plan.expiresAt,
        remainingUses: plan.remainingUses,
        label,
      },
    });

    /* The response carries the secret. `no-store` so no shared cache anywhere
       between here and the console holds a sign-in URL. */
    return NextResponse.json(
      {
        url: `${baseUrl}/api/auth/magic?token=${plan.token}`,
        expiresAt: plan.expiresAt.toISOString(),
        uses: plan.remainingUses,
        label,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    log.error('[review-link]', error instanceof Error ? error : { error: String(error) }, 'could not mint a store-review sign-in link');
    return NextResponse.json({ error: 'Could not mint a link.' }, { status: 500 });
  }
}

/**
 * Lists what is outstanding, and revokes.
 *
 * A link that cannot be seen cannot be revoked, and one nobody can revoke is a
 * standing credential — so the console needs both halves or neither is real.
 * The token hash is never returned: it is not the secret, but it is the lookup
 * key, and there is no reason for it to leave the database.
 */
export async function GET() {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const links = await db.magicLinkToken.findMany({
      where: { user: { email: REVIEW_ACCOUNT_EMAIL } },
      select: { id: true, label: true, createdAt: true, expiresAt: true, used: true, remainingUses: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ links }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    log.error('[review-link]', error instanceof Error ? error : { error: String(error) }, 'could not list store-review links');
    return NextResponse.json({ error: 'Could not read the links.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Which link?' }, { status: 400 });

  try {
    /* Scoped to the review account's own tokens, so this endpoint can never be
       turned into "delete any member's pending magic link". */
    const removed = await db.magicLinkToken.deleteMany({
      where: { id, user: { email: REVIEW_ACCOUNT_EMAIL } },
    });
    if (removed.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('[review-link]', error instanceof Error ? error : { error: String(error) }, 'could not revoke a store-review link');
    return NextResponse.json({ error: 'Could not revoke the link.' }, { status: 500 });
  }
}

/**
 * Fixed rather than configurable. A settable address would mean this endpoint
 * can mint a sign-in link for an address an administrator names, which is a
 * strictly larger power than "sign in as the review account" and is one typo
 * away from minting one for a member.
 */
const REVIEW_ACCOUNT_EMAIL = 'app-review@ihype.org';
