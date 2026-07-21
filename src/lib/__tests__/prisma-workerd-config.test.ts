import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the Prisma-on-Cloudflare-Workers configuration.
 *
 * A sitewide production outage (DESIGN_SYNC rows 171-176) was caused by a
 * single import changing from '@prisma/client/wasm' to '@prisma/client'
 * during an unrelated migration, and five deploy-and-retest cycles were
 * spent rediscovering the working combination. Prisma 7 (2026-07-21 dependency
 * bump) removed the '/wasm' subpath entirely — '@prisma/client/edge' is its
 * replacement: an explicit, unconditional subpath that always resolves to the
 * wasm/workerd build, unlike the plain '@prisma/client' entry, which still
 * lists the "node" condition before "workerd" and would reintroduce the same
 * outage one directory level deeper. These assertions pin the two
 * load-bearing halves of that config so the same regression fails in CI
 * instead of in production:
 *
 * - db.ts must use the /edge subpath, never the plain '@prisma/client' entry.
 * - schema.prisma must keep prisma-client-js + engineType = "client",
 *   the generator combination that emits the WASM query-compiler client
 *   (and its workerd loader) that /edge resolves to.
 *
 * If you change either value intentionally, verify auth (magic-link,
 * register) live on Workers before merging — local Node cannot surface
 * this class of failure — then update this test.
 */
describe('Prisma workerd configuration', () => {
  const root = join(__dirname, '..', '..', '..');

  it('db.ts imports PrismaClient from the /edge entrypoint', () => {
    const dbSource = readFileSync(join(root, 'src/lib/db.ts'), 'utf8');
    expect(dbSource).toMatch(/from '@prisma\/client\/edge'/);
    expect(dbSource).not.toMatch(/import\s+\{[^}]*PrismaClient[^}]*\}\s+from\s+'@prisma\/client'/);
  });

  it('schema.prisma keeps prisma-client-js with engineType = "client"', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
    const generatorBlock = schema.match(/generator client \{[\s\S]*?\}/)?.[0] ?? '';
    expect(generatorBlock).toContain('provider   = "prisma-client-js"');
    expect(generatorBlock).toContain('engineType = "client"');
    // The generator must NOT set a custom output path: the client has to land
    // in node_modules so Next.js's default server-external handling leaves its
    // conditional (workerd vs node) resolution to the OpenNext/wrangler stage.
    expect(generatorBlock).not.toContain('output');
  });
});
