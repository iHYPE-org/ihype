import { describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL_DEFAULT,
  ADMIN_EMAILS_DEFAULT,
  adminEmailList,
  RATE_LIMIT_RULES,
  adminAccessApp,
  isAuthError,
  planAccessApp,
  planAccessPolicy,
  planRateLimitRules,
  policyAllows,
  ruleMatches,
} from '../../../scripts/cloudflare-edge-guards.mjs';

describe('cloudflare edge guards — the rate-limit rules', () => {
  it('uses at most the five rules a Business zone allows, each counting per data centre and IP', () => {
    expect(RATE_LIMIT_RULES.length).toBeLessThanOrEqual(5);
    for (const rule of RATE_LIMIT_RULES) {
      expect(rule.ratelimit.characteristics).toContain('cf.colo.id');
      expect(rule.ratelimit.characteristics).toContain('ip.src');
      // Cloudflare's own rule: the data-centre id is a characteristic, never an expression field.
      expect(rule.expression).not.toContain('cf.colo.id');
      expect(rule.action).toBe('block');
    }
  });

  it('stays a flood backstop above the app\'s own per-IP buckets', () => {
    const auth = RATE_LIMIT_RULES.find((r: { description: string }) => r.description.includes('auth'))!;
    // The strictest app bucket on these paths is 20 passkey option requests a
    // minute per IP; a venue's shared wifi must not be locked out of signup.
    expect(auth.ratelimit.requests_per_period / (auth.ratelimit.period / 60)).toBeGreaterThanOrEqual(100);
    expect(auth.expression).toContain('/api/auth/');
    expect(auth.expression).toContain('/api/register');
    const analytics = RATE_LIMIT_RULES.find((r: { description: string }) => r.description.includes('analytics'))!;
    expect(analytics.expression).toContain('/api/analytics/track');
    expect(analytics.ratelimit.requests_per_period).toBeGreaterThan(auth.ratelimit.requests_per_period);
  });

  it('plans creates, updates and no-ops by description and leaves foreign rules alone', () => {
    const [auth, analytics] = RATE_LIMIT_RULES;
    const existing = [
      { id: 'r1', description: auth.description, expression: auth.expression, action: 'block', ratelimit: { ...auth.ratelimit, requests_per_period: 30 } },
      { id: 'r2', description: analytics.description, expression: analytics.expression, action: 'block', ratelimit: { ...analytics.ratelimit, characteristics: ['ip.src', 'cf.colo.id'] } },
      { id: 'r3', description: 'Somebody else\'s rule', expression: 'true', action: 'block', ratelimit: { characteristics: ['cf.colo.id', 'ip.src'], period: 10, requests_per_period: 1, mitigation_timeout: 10 } },
    ];
    const plan = planRateLimitRules(existing);
    expect(plan.create).toEqual([]);
    expect(plan.update.map((r: { id?: string }) => r.id)).toEqual(['r1']);
    expect(plan.unchanged.map((r: { id?: string }) => r.id)).toEqual(['r2']);
    expect(planRateLimitRules([]).create).toHaveLength(RATE_LIMIT_RULES.length);
  });

  it('treats a disabled copy of a rule as needing an update', () => {
    const [auth] = RATE_LIMIT_RULES;
    expect(ruleMatches({ ...auth, enabled: false }, auth)).toBe(false);
    expect(ruleMatches({ ...auth, enabled: true }, auth)).toBe(true);
  });
});

describe('cloudflare edge guards — reading the API honestly', () => {
  it('never mistakes a rejected token for an empty zone or account', () => {
    // What api.cloudflare.com actually answers to a malformed bearer token (probed 2026-09-02).
    expect(isAuthError({ status: 400, json: { errors: [{ code: 6003, message: 'Invalid request headers' }] } })).toBe(true);
    expect(isAuthError({ status: 403, json: { errors: [{ code: 10000, message: 'Authentication error' }] } })).toBe(true);
    // A missing ruleset or an unknown identifier is a real not-found, not an auth failure.
    expect(isAuthError({ status: 404, json: { errors: [{ code: 7003, message: 'Could not route to …' }] } })).toBe(false);
    expect(isAuthError({ status: 200, json: { success: true, result: [] } })).toBe(false);
  });
});

describe('cloudflare edge guards — Access in front of /admin', () => {
  it('covers the admin pages, not the admin API the pages fetch', () => {
    const app = adminAccessApp();
    expect(app.domain).toBe('ihype.org/admin');
    expect(app.self_hosted_domains).toEqual(['ihype.org/admin']);
    expect(app.domain).not.toContain('/api/');
    expect(app.type).toBe('self_hosted');
    expect(app.policies[0].decision).toBe('allow');
    expect(app.policies[0].include).toEqual(ADMIN_EMAILS_DEFAULT.map((email: string) => ({ email: { email } })));
    expect(ADMIN_EMAILS_DEFAULT).toEqual(['admin@ihype.org', 'staff@ihype.org']);
    // The edge gate must name the same people as the app's allowlist.
    expect(adminEmailList('  Staff@iHYPE.org, admin@ihype.org ,staff@ihype.org')).toEqual(['staff@ihype.org', 'admin@ihype.org']);
    expect(adminEmailList('')).toEqual(ADMIN_EMAILS_DEFAULT);
  });

  it('finds an existing application by either domain field and recognises an allowing policy', () => {
    const desired = adminAccessApp();
    expect(planAccessApp([{ id: 'a', domain: 'ihype.org/admin' }], desired).action).toBe('exists');
    expect(planAccessApp([{ id: 'a', domain: 'other.ihype.org', self_hosted_domains: ['ihype.org/admin'] }], desired).action).toBe('exists');
    expect(planAccessApp([{ id: 'a', domain: 'ihype.org' }], desired).action).toBe('create');
    expect(policyAllows([{ decision: 'allow', include: [{ email: { email: 'ADMIN@ihype.org' } }] }], ADMIN_EMAIL_DEFAULT)).toBe(true);
    expect(policyAllows([{ decision: 'deny', include: [{ email: { email: ADMIN_EMAIL_DEFAULT } }] }], ADMIN_EMAIL_DEFAULT)).toBe(false);
    expect(policyAllows([{ decision: 'allow', include: [{ email_domain: { domain: 'ihype.org' } }] }], ADMIN_EMAIL_DEFAULT)).toBe(false);
    // A policy that admits only the first operator does not count as admitting both.
    expect(policyAllows([{ decision: 'allow', include: [{ email: { email: ADMIN_EMAIL_DEFAULT } }] }], ADMIN_EMAILS_DEFAULT)).toBe(false);
    expect(policyAllows([{ decision: 'allow', include: ADMIN_EMAILS_DEFAULT.map((email: string) => ({ email: { email } })) }], ADMIN_EMAILS_DEFAULT)).toBe(true);
  });
});

/**
 * Adding the second administrator to an application that already had one.
 *
 * The first real apply failed here: the script POSTed a new allow policy at
 * precedence 1 beside the existing one and Cloudflare answered
 * `12130 … policy precedences must be unique`. The policy this script owns is
 * rewritten in place instead — and two allow policies on one application would
 * be the wrong shape regardless, because the single-address one would survive
 * beside the pair.
 */
describe('cloudflare edge guards — the allow policy', () => {
  const desired = adminAccessApp().policies[0];

  it('rewrites the policy it owns rather than adding a second at the same precedence', () => {
    const existing = {
      id: 'pol_1',
      name: 'iHYPE admin (allow)',
      decision: 'allow',
      precedence: 1,
      include: [{ email: { email: ADMIN_EMAIL_DEFAULT } }],
    };
    const plan = planAccessPolicy([existing], desired);
    expect(plan.action).toBe('update');
    expect(plan.id).toBe('pol_1');
    // The precedence it already holds — changing it would collide all over again.
    expect(plan.policy.precedence).toBe(1);
    expect(policyAllows([plan.policy], ADMIN_EMAILS_DEFAULT)).toBe(true);
  });

  it('leaves an owned policy alone once it admits everybody', () => {
    const existing = { id: 'pol_1', ...desired };
    expect(planAccessPolicy([existing], desired).action).toBe('unchanged');
  });

  it('creates past the highest precedence in use, never at 1', () => {
    // Someone else's policies occupy 1 and 2; a new one has to clear them.
    const plan = planAccessPolicy(
      [{ id: 'a', name: 'Contractors', decision: 'allow', precedence: 1, include: [] },
       { id: 'b', name: 'Deny the rest', decision: 'deny', precedence: 2, include: [] }],
      desired,
    );
    expect(plan.action).toBe('create');
    expect(plan.id).toBeNull();
    expect(plan.policy.precedence).toBe(3);
  });

  it('never rewrites a policy it does not own, even one that allows an admin', () => {
    const handWritten = {
      id: 'pol_x', name: 'Ops on call', decision: 'allow', precedence: 4,
      include: [{ email: { email: ADMIN_EMAIL_DEFAULT } }],
    };
    const plan = planAccessPolicy([handWritten], desired);
    expect(plan.action).toBe('create');
    expect(plan.policy.precedence).toBe(5);
  });
});
