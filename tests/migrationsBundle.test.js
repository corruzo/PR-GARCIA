import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { OUTPUT_DIR, buildParts } from '../scripts/bundle-migrations.mjs';

test('supabase/instalar/*.sql match the migrations (run npm run db:bundle)', () => {
  const parts = buildParts();
  assert.deepEqual(readdirSync(OUTPUT_DIR).sort(), parts.map((p) => p.name).sort());
  for (const part of parts) {
    assert.equal(readFileSync(join(OUTPUT_DIR, part.name), 'utf8'), part.content, part.name);
    assert.ok(part.content.split('\n').length <= 600, `${part.name} debe ser corto para el SQL Editor`);
  }
});
