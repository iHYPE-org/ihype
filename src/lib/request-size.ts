export function exceedsDeclaredRequestSize(request: Request, maxBytes: number): boolean {
  const value = request.headers.get('content-length');
  if (!value) return false;

  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes >= 0 && bytes > maxBytes;
}
