import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// El respaldo de estructura debe contener todo lo que crean las migraciones.
const root = new URL('../', import.meta.url).pathname;
const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
const sql = migrations.map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8')).join('\n');
const esquema = readFileSync(join(root, 'supabase/esquema/esquema_completo.sql'), 'utf8');

const nombres = (regex) => [...new Set([...sql.matchAll(regex)].map((m) => m[1].toLowerCase()))];

test('supabase/esquema/esquema_completo.sql includes every table, view, function and trigger of the migrations', () => {
  const faltan = [];
  for (const t of nombres(/create table (?:if not exists )?public\.(\w+)/gi)) if (!esquema.includes(`CREATE TABLE public.${t} (`)) faltan.push(`tabla ${t}`);
  for (const v of nombres(/create (?:or replace )?view public\.(\w+)/gi)) if (!esquema.includes(`CREATE VIEW public.${v} `)) faltan.push(`vista ${v}`);
  for (const f of nombres(/create (?:or replace )?function public\.(\w+)/gi)) if (!esquema.includes(`FUNCTION public.${f}(`)) faltan.push(`función ${f}`);
  for (const g of nombres(/create trigger (\w+)/gi)) if (!esquema.includes(`CREATE TRIGGER ${g} `)) faltan.push(`trigger ${g}`);
  assert.deepEqual(faltan, [], 'Regenera el respaldo con scripts/volcar-esquema.sh');
});

test('the schema backup registers the latest migration', () => {
  const ultima = migrations.at(-1).slice(0, 14);
  assert.ok(esquema.includes(`('${ultima}')`), `falta la migración ${ultima} en el registro del respaldo`);
});
