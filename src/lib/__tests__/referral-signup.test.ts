/**
 * A signup through a member's HYPE link credits that member (2026-09-24,
 * DESIGN_SYNC row 513).
 *
 * `/h/<code>` and `/invite/<code>` both send `/register?ref=<code>`, and the
 * register route has always read `body.ref`; nothing in between read the
 * query or sent the field, so every link signup credited nobody and every
 * member's "friends who joined" read 0. The acceptance walk POSTs `ref` to the
 * route directly, which is why it passed. This holds the hop it skips.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('referral code on signup', () => {
  it('the register page reads ?ref= and hands it to the form', () => {
    const page = readFileSync('src/app/register/page.tsx', 'utf8');
    expect(page).toMatch(/ref\?: string \| string\[\]/);
    expect(page).toMatch(/<RegisterScreen[^>]*initialRef=\{initialRef\}/);
  });

  it('the form sends it in the /api/register body', () => {
    const form = readFileSync('src/components/AuthRegister.tsx', 'utf8');
    const body = form.slice(form.indexOf("postJson<{ id: string }>('/api/register'"));
    expect(body.slice(0, 800)).toMatch(/ref: initialRef \|\| undefined/);
  });

  it('the route falls back to the HYPE-link cookie when the body carries none', () => {
    const route = readFileSync('src/app/api/register/route.ts', 'utf8');
    expect(route).toMatch(/referral: body\.ref \?\? hypeCodeRef \?\? \(await readReferralCookie\(\)\)/);
  });
});
