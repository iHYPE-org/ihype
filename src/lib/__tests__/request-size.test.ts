import { describe, expect, it } from 'vitest';
import { exceedsDeclaredRequestSize } from '../request-size';

describe('exceedsDeclaredRequestSize', () => {
  it('rejects a declared body larger than the limit', () => {
    const request = new Request('https://ihype.org/upload', {
      headers: { 'content-length': '21' },
    });
    expect(exceedsDeclaredRequestSize(request, 20)).toBe(true);
  });

  it.each([null, 'invalid', '-1', '20'])('does not reject %s', (contentLength) => {
    const headers = contentLength === null ? undefined : { 'content-length': contentLength };
    const request = new Request('https://ihype.org/upload', { headers });
    expect(exceedsDeclaredRequestSize(request, 20)).toBe(false);
  });
});
