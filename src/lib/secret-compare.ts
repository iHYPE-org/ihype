export function constantTimeEqual(left: string | undefined | null, right: string | undefined | null) {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }

  return diff === 0;
}

export function verifyBearerToken(authHeader: string | null | undefined, expectedSecret: string | undefined | null) {
  const secret = expectedSecret?.trim();
  if (!secret) {
    return false;
  }

  const header = authHeader ?? '';
  const provided = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';

  return constantTimeEqual(provided, secret);
}
