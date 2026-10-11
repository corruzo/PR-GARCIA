/**
 * Utilidades para probar las migraciones SQL contra un Postgres local.
 * Se activan con PGTEST_URL (ej. postgres://postgres@localhost:5433/postgres);
 * sin esa variable las pruebas de base de datos se omiten.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const PG_URL = process.env.PGTEST_URL || '';
export const skipDb = PG_URL ? false : 'PGTEST_URL no está definido';

const root = new URL('../../', import.meta.url).pathname;

function urlFor(database) {
  const url = new URL(PG_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

export function psql(database, sql, { json = false } = {}) {
  const result = spawnSync('psql', [urlFor(database), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const error = new Error(result.stderr.trim() || `psql terminó con código ${result.status}`);
    error.stderr = result.stderr;
    throw error;
  }
  const out = result.stdout.trim();
  if (!json) return out;
  try {
    return JSON.parse(out);
  } catch {
    return JSON.parse(out.split('\n').at(-1));
  }
}

/** Crea una base nueva con el bootstrap local y todas las migraciones. */
export function createTestDatabase() {
  const name = `prgarcia_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  psql(new URL(PG_URL).pathname.slice(1) || 'postgres', `create database ${name};`);
  // PGTEST_FROM=instalar prueba los archivos de supabase/instalar/ (los que se pegan en Supabase).
  const source = process.env.PGTEST_FROM === 'instalar' ? 'supabase/instalar' : 'supabase/migrations';
  const files = [
    join(root, 'supabase/tests/bootstrap_local.sql'),
    ...readdirSync(join(root, source)).filter((f) => f.endsWith('.sql')).sort()
      .map((f) => join(root, source, f)),
  ];
  for (const file of files) psql(name, `\\i ${file}`);
  return name;
}

export function dropTestDatabase(name) {
  psql(new URL(PG_URL).pathname.slice(1) || 'postgres', `drop database if exists ${name} with (force);`);
}

/** SQL para actuar como un usuario autenticado dentro de una sesión. */
export function asUser(userId, sql, { today } = {}) {
  return [
    `set request.jwt.claim.sub = '${userId}';`,
    today ? `set app.fecha_hoy = '${today}';` : '',
    'set role authenticated;',
    sql,
  ].join('\n');
}
