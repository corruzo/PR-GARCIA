/**
 * dates.js — Fechas de calendario ISO (YYYY-MM-DD) sin zona horaria.
 * Se operan en UTC para que el conteo de días no dependa del huso del equipo.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function parseISODate(value) {
  const match = ISO_DATE.exec(String(value ?? ''));
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const time = Date.UTC(y, m - 1, d);
  const date = new Date(time);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return time;
}

export function isISODate(value) {
  return parseISODate(value) !== null;
}

export function formatISODate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDaysISO(value, days) {
  const time = parseISODate(value);
  if (time === null) throw new RangeError(`Fecha inválida: ${value}`);
  return formatISODate(time + days * MS_PER_DAY);
}

/** Días calendario de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from, to) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (a === null || b === null) throw new RangeError('Fecha inválida');
  return Math.round((b - a) / MS_PER_DAY);
}

/** Fecha de hoy en Caracas (UTC−4, sin horario de verano). */
export function todayCaracas(now = Date.now()) {
  return formatISODate(now - 4 * 3_600_000);
}

/** "2026-01-08" → "08/01/2026" */
export function toDisplayDate(value) {
  const match = ISO_DATE.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}
