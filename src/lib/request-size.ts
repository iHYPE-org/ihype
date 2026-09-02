/**
 * Refuse an upload before its body is buffered.
 *
 * `Content-Length` is what lets a route answer 413 before `request.formData()`
 * reads the whole body into the 128 MB isolate. A body with NO length and a
 * chunked transfer is the same problem in a different coat: the route cannot
 * know how big it is until it has all of it. Browsers always send a length
 * for a `FormData` body, so refusing a chunked upload turns away no real
 * client (security sweep, 2026-09-02). A request carrying neither header —
 * an in-process `Request` object in a test, or an HTTP/2 hop that dropped the
 * framing — is still let through to the per-file `size` check that follows.
 */
export function exceedsDeclaredRequestSize(request: Request, maxBytes: number): boolean {
  const value = request.headers.get('content-length');
  if (!value) {
    const transfer = request.headers.get('transfer-encoding')?.toLowerCase() ?? '';
    return transfer.includes('chunked');
  }

  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes >= 0 && bytes > maxBytes;
}
