import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/*
  WHAT THIS GUARDS. A column that no product code reads or writes is storage
  for a feature that is gone, and it survives because the two paths that
  enumerate "everything we hold about a person" — erasure and export — name it
  in order to null or redact it. Twice this repository read that as use: the
  2026-09-06 drop migration kept `Profile.pageDraft`/`pagePublished` on the
  sentence "the erasure path still nulls them", and `TicketOrder.paymentTokenRef`
  was written `null` on every order for a stored-token charge model that was
  never built. Seven columns were found that way on 2026-09-14
  (DESIGN_SYNC row 445); `model-writers.test.ts` asks the same question of
  whole tables.

  So this asks it of every scalar column: does its name appear anywhere in
  `src/` or `workers/` OUTSIDE the erasure path, the privacy export and the
  tests? The match is by bare name, so a column sharing its name with another
  model's field passes on the collision — this is a floor, not a census. What
  it cannot miss is a name that appears nowhere at all.

  Exempt by shape, not by list: `@id`, `@updatedAt` and `@default(now())`/
  `@default(cuid())`/`@default(uuid())` columns (the database fills them), and
  the scalar half of a relation (`slotId` is reached through `slot`). The
  Auth.js adapter's `Account` columns are the one recorded exception: written
  by `PrismaAdapter` from inside the package, never by a name in this tree.
*/

const WRITTEN_OUTSIDE_SRC = new Map<string, string>([
  ['Account', 'every column is written by PrismaAdapter (src/lib/auth.ts) from inside @auth/prisma-adapter'],
]);

/** Files whose naming of a column is bookkeeping about it, not use of it. */
const BOOKKEEPING = [/\/privacy-actions\.ts$/, /\/api\/privacy\/export\/route\.ts$/, /__tests__/];

type Column = { model: string; field: string };

/** Every scalar column the database does not fill by itself. */
export function candidateColumns(schema: string): Column[] {
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => ({ name, body }));
  const names = new Set(models.map((m) => m.name));
  const out: Column[] = [];
  for (const { name, body } of models) {
    const fkScalars = new Set(
      [...body.matchAll(/@relation\(\s*fields:\s*\[([^\]]*)\]/g)].flatMap(([, list]) => list.split(',').map((s) => s.trim())),
    );
    for (const line of body.split('\n')) {
      const m = line.match(/^\s+(\w+)\s+(\w+)(\[\])?\??(?:\s+(.*))?$/);
      if (!m) continue;
      const [, field, type, , attrs = ''] = m;
      if (names.has(type)) continue;
      if (fkScalars.has(field)) continue;
      if (/@id\b|@updatedAt\b|@default\((?:now|cuid|uuid|autoincrement)\(\)\)/.test(attrs)) continue;
      out.push({ model: name, field });
    }
  }
  return out;
}

/** Columns whose name appears in no source that is not bookkeeping. */
export function columnsReadByNothing(schema: string, sources: readonly { path: string; text: string }[]): Column[] {
  const live = sources
    .filter(({ path }) => !BOOKKEEPING.some((re) => re.test(path)))
    .map(({ text }) => maskComments(text) as string)
    .join('\n');
  return candidateColumns(schema).filter(({ field }) => !new RegExp(`\\b${field}\\b`).test(live));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

describe('every column is read or written by something other than erasure and export', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('finds no column named only by the paths that null or redact it', () => {
    const sources = [...walk('src'), ...walk('workers')].map((path) => ({ path, text: readFileSync(path, 'utf8') }));
    const candidates = candidateColumns(schema);
    expect(candidates.length, 'the schema parse collected almost no columns — refusing an empty scan').toBeGreaterThan(200);
    const dead = columnsReadByNothing(schema, sources).filter(({ model }) => !WRITTEN_OUTSIDE_SRC.has(model));
    expect(
      dead.map(({ model, field }) => `${model}.${field}`),
      'each of these is named by nothing but erasure, export or a test: drop the column (park the migration with its count) or record who writes it in WRITTEN_OUTSIDE_SRC',
    ).toEqual([]);
  });

  it('keeps the exception list honest: every entry is still a model', () => {
    const names = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map(([, n]) => n));
    for (const model of WRITTEN_OUTSIDE_SRC.keys()) expect(names.has(model), model).toBe(true);
  });

  it('proves the negative: a column nulled by erasure and nothing else is reported; a read anywhere else clears it', () => {
    const fake = [
      'model Profile {',
      '  id        String   @id @default(cuid())',
      '  slug      String',
      '  pageDraft String?',
      '  slotId    String',
      '  slot      Slot     @relation(fields: [slotId], references: [id])',
      '  updatedAt DateTime @updatedAt',
      '}',
      'model Slot {\n  id String @id\n}',
    ].join('\n');
    const erasure = { path: 'src/lib/privacy-actions.ts', text: 'await db.profile.update({ data: { pageDraft: null, slug: anon } })' };
    const page = { path: 'src/app/x/page.tsx', text: '// pageDraft in a comment does not count\nconst s = profile.slug;' };
    expect(columnsReadByNothing(fake, [erasure, page])).toEqual([{ model: 'Profile', field: 'pageDraft' }]);
    expect(columnsReadByNothing(fake, [erasure, page, { path: 'src/lib/x.ts', text: 'select: { pageDraft: true }' }])).toEqual([]);
  });
});
