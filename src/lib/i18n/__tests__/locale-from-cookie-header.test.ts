import { describe, expect, it } from 'vitest';
import { localeFromCookieHeader } from '../locales';

describe('localeFromCookieHeader', () => {
  it('reads the locale cookie out of a raw Cookie header', () => {
    expect(localeFromCookieHeader('a=1; ihype_locale=es; b=2')).toBe('es');
  });
  it('is null, never a default, when the header carries no supported value', () => {
    expect(localeFromCookieHeader(null)).toBeNull();
    expect(localeFromCookieHeader('a=1')).toBeNull();
    expect(localeFromCookieHeader('ihype_locale=tlh')).toBeNull();
    expect(localeFromCookieHeader('ihype_locale=')).toBeNull();
  });
  it('is not fooled by a cookie whose name merely ends in the same letters', () => {
    expect(localeFromCookieHeader('xihype_locale=es')).toBeNull();
  });
});
