/**
 * Une supabase/migrations/*.sql (en orden) en supabase/instalar_todo.sql,
 * para pegarlo de una sola vez en el SQL Editor de Supabase.
 * Uso: npm run db:bundle
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const dir = join(root, 'supabase/migrations');

export function bundleMigrations() {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const parts = files.map((f) => `-- ┏━━ ${f} ━━┓\n${readFileSync(join(dir, f), 'utf8').trim()}\n`);
  return [
    '-- PRGARCÍA · Instalación completa de la base de datos.',
    '-- Archivo generado por `npm run db:bundle`; no lo edites a mano.',
    '-- Pégalo completo en Supabase → SQL Editor → Run. Ejecútalo una sola vez en un proyecto nuevo.',
    '',
    'begin;',
    '',
    ...parts,
    'commit;',
    '',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(join(root, 'supabase/instalar_todo.sql'), bundleMigrations());
  console.log('supabase/instalar_todo.sql actualizado');
}
