import { describe, expect, it } from 'vitest';
import { WELCOME_PATH, isSafeLocalRedirect, resolvePostAuthRedirect } from '@/lib/auth-redirects';

describe('auth redirects', () => {
  it('sends empty auth redirects to Welcome first', () => {
    expect(resolvePostAuthRedirect(undefined)).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect(null)).toBe(WELCOME_PATH);
  });

  it('normalizes transitional auth routes to Welcome', () => {
    expect(resolvePostAuthRedirect('/auth/landing')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/auth/landing?module=tool-hub')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/auth/magic')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/auth/magic?token=abc')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/workbench')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/workbench?tool=settings')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/dashboard')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/dashboard?tab=tickets')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/login')).toBe(WELCOME_PATH);
    expect(resolvePostAuthRedirect('/login?callbackUrl=/home')).toBe(WELCOME_PATH);
  });

  it('preserves safe in-app callback destinations', () => {
    expect(resolvePostAuthRedirect('/radio/studio')).toBe('/radio/studio');
    expect(resolvePostAuthRedirect('/shows/my-show')).toBe('/shows/my-show');
  });

  it('rejects external or malformed callback destinations', () => {
    expect(isSafeLocalRedirect('https://example.com')).toBe(false);
    expect(isSafeLocalRedirect('//example.com')).toBe(false);
    expect(isSafeLocalRedirect('/\\example.com')).toBe(false);
    expect(isSafeLocalRedirect('/home\nx')).toBe(false);
  });
});
