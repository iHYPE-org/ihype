import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/*
  WHAT THIS GUARDS. A model that nothing CREATES rows in is a table the product
  cannot fill, however many places read it. Twice this repository kept exactly
  that: `AuxQueue`/`AuxItem` survived the 2026-07-03 dead-code sweep because a
  public page read them — the sweep had deleted their only writer in the same
  pass, so the page could only ever 404 from then on — and `PremiumInterest`
  outlived its form by seven weeks with an erasure DELETE and a privacy export
  as its only remaining statements. A reader kept a table alive after its
  writer had gone, and no instrument here asked the other question.

  So this asks it: for every model in schema.prisma, does some code path in
  src/ or workers/ CREATE a row? Either directly (`db.<model>.create`, `upsert`,
  `createMany`) or through a nested write on a relation field that points at
  the model (`slots: { create: … }`, `advertisingConfig: { create: … }`).
  Deletes and updates do not count — the erasure path deletes from every
  table it knows about, which is precisely what kept `PremiumInterest` looking
  alive. Seeds do not count either: a seed is a fixture, not the product.

  The three Auth.js adapter tables are the recorded exception: `PrismaAdapter`
  writes them from inside `@auth/prisma-adapter`, so no source here names the
  call.
*/

const CREATED_OUTSIDE_SRC = new Map<string, string>([
  ['Account', 'written by PrismaAdapter (src/lib/auth.ts) from inside @auth/prisma-adapter'],
  ['Session', 'written by PrismaAdapter from inside @auth/prisma-adapter'],
  ['VerificationToken', 'written by PrismaAdapter from inside @auth/prisma-adapter'],
]);

/**
 * Reference rows a MIGRATION inserts and the product only ever reads. The test
 * checks the claim: each must be named by an `INSERT INTO "<Model>"` under
 * prisma/migrations/, or the entry is a silence rather than a record.
 */
const CREATED_BY_MIGRATION_DML = new Map<string, string>([
  ['AdSlot', 'the four coverage-tier placements, inserted by 20260704020000_ad_scope_and_slots; the campaign route resolves one and never creates one'],
]);

type ModelInfo = { name: string; accessor: string; relationFields: Set<string> };

/** Every model, with the names of every relation field ON OTHER MODELS that points at it. */
export function parseModels(schema: string): ModelInfo[] {
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => ({ name, body }));
  const names = new Set(models.map((m) => m.name));
  const infos = new Map<string, ModelInfo>();
  for (const { name } of models) {
    infos.set(name, { name, accessor: name[0].toLowerCase() + name.slice(1), relationFields: new Set() });
  }
  for (const { body } of models) {
    for (const line of body.split('\n')) {
      const m = line.match(/^\s+(\w+)\s+(\w+)(\[\])?\??(?:\s|$)/);
      if (!m) continue;
      const [, field, type] = m;
      if (names.has(type)) infos.get(type)!.relationFields.add(field);
    }
  }
  return [...infos.values()];
}

const DIRECT_CREATE = /\.(create|createMany|createManyAndReturn|upsert)\s*\(/;

/** Models no source creates a row in — directly or through a nested relation write. */
export function modelsWithoutCreator(schema: string, sources: readonly string[]): string[] {
  const masked = sources.map((s) => maskComments(s) as string);
  const missing: string[] = [];
  for (const model of parseModels(schema)) {
    const direct = new RegExp(`\\b(?:db|tx|prisma|client)\\.${model.accessor}${DIRECT_CREATE.source}`);
    const nested = [...model.relationFields].map(
      (field) => new RegExp(`\\b${field}\\s*:\\s*\\{\\s*(?:create|createMany|connectOrCreate)\\s*:`),
    );
    const created = masked.some((src) => direct.test(src) || nested.some((re) => re.test(src)));
    if (!created) missing.push(model.name);
  }
  return missing;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '__tests__') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

describe('every Prisma model has a code path that creates rows in it', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('finds no model that only ever gets read, updated or deleted', () => {
    const sources = [...walk('src'), ...walk('workers')].map((f) => readFileSync(f, 'utf8'));
    const models = parseModels(schema);
    expect(models.length, 'the schema parse collected no models — refusing an empty scan').toBeGreaterThan(20);
    const missing = modelsWithoutCreator(schema, sources).filter(
      (m) => !CREATED_OUTSIDE_SRC.has(m) && !CREATED_BY_MIGRATION_DML.has(m),
    );
    expect(
      missing,
      'each of these has no create/upsert/nested-create anywhere in src/ or workers/: either it is a table nothing can fill (delete the model, park the drop) or a writer exists outside the product and belongs in CREATED_OUTSIDE_SRC with its reason',
    ).toEqual([]);
  });

  it('keeps both allowlists honest: every entry is still a model, and a migration really inserts the reference rows', () => {
    const names = new Set(parseModels(schema).map((m) => m.name));
    for (const model of CREATED_OUTSIDE_SRC.keys()) expect(names.has(model), model).toBe(true);
    const migrations = readdirSync('prisma/migrations')
      .filter((d) => statSync(join('prisma/migrations', d)).isDirectory())
      .map((d) => readFileSync(join('prisma/migrations', d, 'migration.sql'), 'utf8'))
      .join('\n');
    for (const model of CREATED_BY_MIGRATION_DML.keys()) {
      expect(names.has(model), model).toBe(true);
      expect(migrations.includes(`INSERT INTO "${model}"`), `${model}: no migration inserts into it`).toBe(true);
    }
  });

  it('proves the negative: a model with a reader and a delete but no creator is reported', () => {
    const fake = [
      'model Queue {\n  id String @id\n  items Item[]\n}',
      'model Item {\n  id String @id\n  queueId String\n  queue Queue @relation(fields: [queueId], references: [id])\n}',
      'model Note {\n  id String @id\n}',
    ].join('\n\n');
    const sources = [
      'const q = await db.queue.findUnique({ where: { slug } });',
      'await db.queue.deleteMany({ where: { userId } }); // db.queue.create( in a comment does not count',
      'await db.note.upsert({ where: { id }, update: {}, create: { id } });',
    ];
    expect(modelsWithoutCreator(fake, sources)).toEqual(['Queue', 'Item']);
    expect(modelsWithoutCreator(fake, [...sources, 'await db.queue.create({ data: { items: { create: [] } } })'])).toEqual([]);
  });
});
