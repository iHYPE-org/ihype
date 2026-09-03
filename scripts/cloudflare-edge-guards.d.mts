/**
 * Types for the parts of `cloudflare-edge-guards.mjs` the unit tests import.
 * The script itself stays plain JavaScript so it runs with `node` in the
 * workflow with no build step.
 */

export const ZONE_NAME_DEFAULT: string;
export const ADMIN_EMAIL_DEFAULT: string;
/** Every address the Access application admits; mirrors DEFAULT_ADMIN_EMAILS in src/lib/admin-allowlist.ts. */
export const ADMIN_EMAILS_DEFAULT: string[];
/** One address, a comma-separated list, or an array → de-duplicated lowercase list (defaults when empty). */
export function adminEmailList(value?: string | readonly string[] | null): string[];

export type RateLimitSpec = {
  characteristics: string[];
  period: number;
  requests_per_period: number;
  mitigation_timeout: number;
};

export type RateLimitRule = {
  id?: string;
  description: string;
  expression: string;
  action: string;
  enabled?: boolean;
  ratelimit: RateLimitSpec;
};

export const RATE_LIMIT_RULES: RateLimitRule[];

export type AccessPolicy = {
  name?: string;
  decision: string;
  precedence?: number;
  include: Array<Record<string, unknown>>;
};

export type AccessApp = {
  id?: string;
  name?: string;
  type?: string;
  domain?: string;
  self_hosted_domains?: string[];
  session_duration?: string;
  auto_redirect_to_identity?: boolean;
  http_only_cookie_attribute?: boolean;
  policies?: AccessPolicy[];
};

export function adminAccessApp(zoneName?: string, adminEmail?: string | readonly string[]): Required<Pick<AccessApp, 'name' | 'type' | 'domain' | 'self_hosted_domains' | 'session_duration' | 'policies'>> & AccessApp;

export function ruleMatches(existing: Partial<RateLimitRule> | null | undefined, desired: RateLimitRule): boolean;

export function planRateLimitRules(
  existingRules: Array<Partial<RateLimitRule>> | null | undefined,
  desired?: RateLimitRule[],
): { create: RateLimitRule[]; update: RateLimitRule[]; unchanged: RateLimitRule[] };

export function policyAllows(policies: AccessPolicy[] | null | undefined, adminEmail: string | readonly string[]): boolean;

export function planAccessApp(
  existingApps: AccessApp[] | null | undefined,
  desired: AccessApp,
): { action: 'create' | 'exists'; app: AccessApp | null };

export function isAuthError(result: { status: number; json?: { errors?: Array<{ code?: number | string; message?: string }>; [key: string]: unknown } | null }): boolean;
