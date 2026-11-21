import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatDoorTime } from '@/lib/format-locale';
import { DEFAULT_SITE_CONFIG, isPublicSiteEligible, isSafeSiteUrl, readProfileSiteConfig, siteConfigSchema } from '@/lib/profile-site';

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
  it('never publishes an undiscoverable or unverified identity', () => {
    expect(isPublicSiteEligible({
      type: 'ARTIST', verificationStatus: 'VERIFIED', discoverable: true,
    })).toBe(true);
    expect(isPublicSiteEligible({
      type: 'VENUE', verificationStatus: 'VERIFIED', discoverable: false,
    })).toBe(false);
    expect(isPublicSiteEligible({
      type: 'ARTIST', verificationStatus: 'PENDING', discoverable: true,
    })).toBe(false);
    expect(isPublicSiteEligible({
      type: 'LISTENER', verificationStatus: 'VERIFIED', discoverable: true,
    })).toBe(false);
  });
  it('formats upcoming-show calendar dates in venue local time', () => {
    const instant = new Date('2026-03-15T01:00:00.000Z');
    const venueDay = formatDoorTime('en', instant, 'America/New_York', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const utcDay = formatDoorTime('en', instant, 'UTC', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    expect(venueDay).toBe('Mar 14, 2026');
    expect(utcDay).toBe('Mar 15, 2026');
    const publicSite = readFileSync('src/app/site/[slug]/page.tsx', 'utf8');
    expect(publicSite).toContain('formatDoorTime(locale, show.startsAt, show.timeZone');
  });

  it('allows only absolute https merchandise links', () => {
    expect(isSafeSiteUrl('https://example.com/merch')).toBe(true);
    expect(isSafeSiteUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeSiteUrl('http://example.com')).toBe(false);
  });
});
