/**
 * Genera supabase/instalar/parte-N.sql a partir de supabase/migrations/*.sql
 * para pegarlos en el SQL Editor de Supabase (que limita el tamaño de cada
 * consulta). Cada parte agrupa migraciones completas, sin comentarios ni
 * líneas vacías, y corre dentro de una transacción.
 * Uso: npm run db:bundle
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const migrationsDir = join(root, 'supabase/migrations');
export const OUTPUT_DIR = join(root, 'supabase/instalar');

/** Migraciones de cada parte, por prefijo de nombre. */
export const PARTS = [
  ['20261011000000', '20261011000100'],
  ['20261011000200'],
  ['20261011000300', '20261011000400'],
  ['20261012000100'],
  ['20261012000200'],
  ['20261013000100'],
  ['20261014000100'],
  ['20261014000200'],
];

/** Quita líneas vacías y comentarios de línea completa (no toca código). */
export function compactSql(sql) {
  return sql
    .split('\n')
    .filter((line) => line.trim() !== '' && !/^\s*--/.test(line))
    .join('\n');
}

/**
 * Envuelve una migración para que se registre en app_migraciones y se niegue a
 * ejecutarse dos veces (pegar una parte repetida aborta sin tocar nada).
 */
export function guardMigration(name, sql) {
  const version = name.slice(0, 14);
  return [
    `-- ${name}`,
    'create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());',
    'alter table public.app_migraciones enable row level security;',
    'revoke all on public.app_migraciones from anon, authenticated;',
    `do $guard$ begin if exists (select 1 from public.app_migraciones where version = '${version}') then raise exception 'La migración ${version} ya está aplicada: no repitas esta parte.'; end if; end $guard$;`,
    compactSql(sql),
    `insert into public.app_migraciones (version) values ('${version}') on conflict do nothing;`,
  ].join('\n');
}

export function buildParts() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const assigned = PARTS.flat();
  const missing = files.filter((f) => !assigned.some((prefix) => f.startsWith(prefix)));
  if (missing.length) throw new Error(`Migraciones sin parte asignada: ${missing.join(', ')}`);

  return PARTS.map((prefixes, index) => {
    const names = prefixes.map((prefix) => files.find((f) => f.startsWith(prefix)));
    const body = names.map((name) => guardMigration(name, readFileSync(join(migrationsDir, name), 'utf8'))).join('\n');
    return {
      name: `parte-${index + 1}.sql`,
      content: [
        `-- PRGARCÍA · Instalación, parte ${index + 1} de ${PARTS.length}. Generado por npm run db:bundle.`,
        `-- Ejecuta en orden solo las partes que aún no aplicaste (1 a ${PARTS.length}) en Supabase → SQL Editor, una sola vez cada una.`,
        'begin;',
        body,
        'commit;',
        '',
      ].join('\n'),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const part of buildParts()) {
    writeFileSync(join(OUTPUT_DIR, part.name), part.content);
    console.log(`supabase/instalar/${part.name}: ${part.content.split('\n').length} líneas`);
  }
}
