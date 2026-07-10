import { describe, expect, it } from 'vitest';
import { validatePublicHttpUrl } from '@/lib/safe-external-url';

describe('validatePublicHttpUrl', () => {
  it('accepts ordinary public https and http URLs', () => {
    expect(validatePublicHttpUrl('https://yourband.com')?.hostname).toBe('yourband.com');
    expect(validatePublicHttpUrl('http://www.example.org/about')?.pathname).toBe('/about');
    expect(validatePublicHttpUrl('https://sub.domain.co.uk/path?x=1')).not.toBeNull();
  });

  it('rejects non-http protocols', () => {
    expect(validatePublicHttpUrl('ftp://example.com')).toBeNull();
    expect(validatePublicHttpUrl('file:///etc/passwd')).toBeNull();
    expect(validatePublicHttpUrl('javascript:alert(1)')).toBeNull();
    expect(validatePublicHttpUrl('gopher://example.com')).toBeNull();
  });

  it('rejects unparseable input', () => {
    expect(validatePublicHttpUrl('not a url')).toBeNull();
    expect(validatePublicHttpUrl('')).toBeNull();
  });

  it('rejects credentials and explicit ports', () => {
    expect(validatePublicHttpUrl('https://user:pass@example.com')).toBeNull();
    expect(validatePublicHttpUrl('https://user@example.com')).toBeNull();
    expect(validatePublicHttpUrl('https://example.com:8080')).toBeNull();
    expect(validatePublicHttpUrl('http://example.com:22')).toBeNull();
  });

  it('rejects IP literals', () => {
    expect(validatePublicHttpUrl('http://127.0.0.1/admin')).toBeNull();
    expect(validatePublicHttpUrl('http://10.0.0.1')).toBeNull();
    expect(validatePublicHttpUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(validatePublicHttpUrl('http://[::1]/')).toBeNull();
    expect(validatePublicHttpUrl('http://[fd00::1]/')).toBeNull();
  });

  it('rejects local and internal hostnames', () => {
    expect(validatePublicHttpUrl('http://localhost')).toBeNull();
    expect(validatePublicHttpUrl('http://localhost/x')).toBeNull();
    expect(validatePublicHttpUrl('http://foo.localhost')).toBeNull();
    expect(validatePublicHttpUrl('http://printer.local')).toBeNull();
    expect(validatePublicHttpUrl('http://db.internal')).toBeNull();
    expect(validatePublicHttpUrl('http://nas.home.arpa')).toBeNull();
    expect(validatePublicHttpUrl('http://router')).toBeNull();
  });

  it('rejects our own domain to avoid recursive fetches', () => {
    expect(validatePublicHttpUrl('https://api.ihype.org/internal')).toBeNull();
  });
});
