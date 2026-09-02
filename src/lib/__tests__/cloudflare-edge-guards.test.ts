import { describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL_DEFAULT,
  RATE_LIMIT_RULES,
  adminAccessApp,
  isAuthError,
  planAccessApp,
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
    expect(app.policies[0].include).toEqual([{ email: { email: ADMIN_EMAIL_DEFAULT } }]);
  });

  it('finds an existing application by either domain field and recognises an allowing policy', () => {
    const desired = adminAccessApp();
    expect(planAccessApp([{ id: 'a', domain: 'ihype.org/admin' }], desired).action).toBe('exists');
    expect(planAccessApp([{ id: 'a', domain: 'other.ihype.org', self_hosted_domains: ['ihype.org/admin'] }], desired).action).toBe('exists');
    expect(planAccessApp([{ id: 'a', domain: 'ihype.org' }], desired).action).toBe('create');
    expect(policyAllows([{ decision: 'allow', include: [{ email: { email: 'ADMIN@ihype.org' } }] }], ADMIN_EMAIL_DEFAULT)).toBe(true);
    expect(policyAllows([{ decision: 'deny', include: [{ email: { email: ADMIN_EMAIL_DEFAULT } }] }], ADMIN_EMAIL_DEFAULT)).toBe(false);
    expect(policyAllows([{ decision: 'allow', include: [{ email_domain: { domain: 'ihype.org' } }] }], ADMIN_EMAIL_DEFAULT)).toBe(false);
  });
});
