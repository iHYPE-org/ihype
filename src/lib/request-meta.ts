function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || '';
}

export function readClientAddress(request: Request | undefined) {
  if (!request) {
    return 'unknown';
  }

  const cfConnectingIp = firstHeaderValue(request.headers.get('cf-connecting-ip'));
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const realIp = firstHeaderValue(request.headers.get('x-real-ip'));
  if (realIp) {
    return realIp;
  }

  const forwardedFor = firstHeaderValue(request.headers.get('x-forwarded-for'));
  if (forwardedFor) {
    return forwardedFor;
  }

  return 'unknown';
}
