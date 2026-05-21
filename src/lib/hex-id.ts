import { randomBytes } from 'node:crypto';
export { normalizeHexId, shortenHexId } from '@/lib/hex-id-display';

export function createHexId(bytes = 16) {
  return `0x${randomBytes(bytes).toString('hex')}`;
}
