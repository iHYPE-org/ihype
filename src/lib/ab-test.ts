export function getABBucket(userId: string, testName: string): 'A' | 'B' {
  const hash = [...`${testName}:${userId}`].reduce((acc, c) => acc ^ c.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'A' : 'B';
}

export function isInVariant(userId: string, testName: string): boolean {
  return getABBucket(userId, testName) === 'B';
}
