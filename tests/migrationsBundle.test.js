import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bundleMigrations } from '../scripts/bundle-migrations.mjs';

test('supabase/instalar_todo.sql matches the migrations (run npm run db:bundle)', () => {
  const bundled = readFileSync(new URL('../supabase/instalar_todo.sql', import.meta.url), 'utf8');
  assert.equal(bundled, bundleMigrations());
});
