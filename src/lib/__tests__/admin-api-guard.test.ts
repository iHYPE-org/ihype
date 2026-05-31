import { readFileSync } from 'fs';
import { relative } from 'path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';

const ADMIN_API_EXCEPTIONS = new Set([
  'src/app/api/admin/setup/route.ts'
]);

describe('admin API guard coverage', () => {
  it('keeps every admin API route behind an explicit admin guard', () => {
    const routeFiles = globSync('src/app/api/admin/**/route.{ts,tsx}', { nodir: true }).sort();
    expect(routeFiles.length).toBeGreaterThan(0);

    const unguarded = routeFiles.filter((file) => {
      const normalized = relative(process.cwd(), file).replace(/\\/g, '/');
      if (ADMIN_API_EXCEPTIONS.has(normalized)) return false;

      const source = readFileSync(file, 'utf8');
      return !source.includes('isAdminSession(') && !source.includes('requireAdminApi(');
    });

    expect(unguarded).toEqual([]);
  });
});
