import { randomBytes } from 'node:crypto';

export function createHexId(bytes = 16) {
  return `0x${randomBytes(bytes).toString('hex')}`;
}
