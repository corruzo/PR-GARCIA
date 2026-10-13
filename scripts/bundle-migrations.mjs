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
];

/** Quita líneas vacías y comentarios de línea completa (no toca código). */
export function compactSql(sql) {
  return sql
    .split('\n')
    .filter((line) => line.trim() !== '' && !/^\s*--/.test(line))
    .join('\n');
}

export function buildParts() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const assigned = PARTS.flat();
  const missing = files.filter((f) => !assigned.some((prefix) => f.startsWith(prefix)));
  if (missing.length) throw new Error(`Migraciones sin parte asignada: ${missing.join(', ')}`);

  return PARTS.map((prefixes, index) => {
    const names = prefixes.map((prefix) => files.find((f) => f.startsWith(prefix)));
    const body = names.map((name) => `-- ${name}\n${compactSql(readFileSync(join(migrationsDir, name), 'utf8'))}`).join('\n');
    return {
      name: `parte-${index + 1}.sql`,
      content: [
        `-- PRGARCÍA · Instalación, parte ${index + 1} de ${PARTS.length}. Generado por npm run db:bundle.`,
        `-- Ejecuta las partes en orden (1 a 6) en Supabase → SQL Editor, una sola vez cada una.`,
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
