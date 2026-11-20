import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_CONFIG, isSafeSiteUrl, readProfileSiteConfig, siteConfigSchema } from '@/lib/profile-site';

describe('artist and venue public sites', () => {
  it('starts unpublished with contact hidden', () => {
    expect(readProfileSiteConfig(null)).toEqual(DEFAULT_SITE_CONFIG);
    expect(readProfileSiteConfig(null).sections.contact).toBe(false);
  });
  it('never accepts arbitrary HTML or script settings', () => {
    expect(siteConfigSchema.safeParse({ ...DEFAULT_SITE_CONFIG, html: '<script />' }).success).toBe(false);
    expect(readProfileSiteConfig({ published: true })).toEqual(DEFAULT_SITE_CONFIG);
  });
  it('accepts explicit theme and section choices', () => {
    const config = siteConfigSchema.parse({ ...DEFAULT_SITE_CONFIG, theme: 'paper', published: true });
    expect(config.published).toBe(true);
  });
  it('allows only absolute https merchandise links', () => {
    expect(isSafeSiteUrl('https://example.com/merch')).toBe(true);
    expect(isSafeSiteUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeSiteUrl('http://example.com')).toBe(false);
  });
});
