import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databasePath = resolve(process.cwd(), 'data', 'prestamo.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS tasa_bcv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tasa REAL NOT NULL CHECK (tasa > 0),
    fuente TEXT NOT NULL,
    fecha_hora TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'ok'
  );

  CREATE INDEX IF NOT EXISTS idx_tasa_bcv_fecha_hora
    ON tasa_bcv (fecha_hora DESC);
`);

export function saveBCVRate({ rate, source, official = true, fetchedAt = new Date().toISOString() }) {
  database.prepare(`
    INSERT INTO tasa_bcv (tasa, fuente, fecha_hora, estado)
    VALUES (?, ?, ?, ?)
  `).run(rate, source, fetchedAt, official ? 'ok' : 'referencial');

  return getLatestBCVRate();
}

export function getLatestBCVRate() {
  return database.prepare(`
    SELECT tasa AS value, fuente AS source, fecha_hora AS fetchedAt, estado AS status
    FROM tasa_bcv
    ORDER BY estado = 'ok' DESC, fecha_hora DESC, id DESC
    LIMIT 1
  `).get() || null;
}

export { databasePath };
