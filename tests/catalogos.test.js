import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FRECUENCIAS, METODOS_INTERES, METODOS_PAGO, MODALIDADES_TASA, TIPOS_PLAZO, opciones } from '../shared/catalogos.js';
import { toDisplayDateCaracas, toDisplayDateTimeCaracas } from '../shared/finance/dates.js';

// Los catálogos de la interfaz deben coincidir con las restricciones CHECK de la base.
const esquema = readFileSync(new URL('../supabase/esquema/esquema_completo.sql', import.meta.url), 'utf8');

function valoresCheck(columna) {
  const m = esquema.match(new RegExp(`\\(${columna} = ANY \\(ARRAY\\[([^\\]]+)\\]`));
  assert.ok(m, `no se encontró el CHECK de ${columna}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

test('catalog keys match the database CHECK constraints', () => {
  assert.deepEqual(Object.keys(METODOS_PAGO).sort(), valoresCheck('metodo'));
  assert.deepEqual(Object.keys(FRECUENCIAS).sort(), valoresCheck('frecuencia_pago'));
  assert.deepEqual(Object.keys(MODALIDADES_TASA).sort(), valoresCheck('modalidad_tasa'));
  assert.deepEqual(Object.keys(METODOS_INTERES).sort(), valoresCheck('metodo_interes'));
  assert.deepEqual(Object.keys(TIPOS_PLAZO).sort(), valoresCheck('tipo_plazo'));
});

test('opciones() turns a catalog into select options', () => {
  assert.deepEqual(opciones({ a: 'A' }), [{ value: 'a', label: 'A' }]);
});

test('dates are shown in Caracas time', () => {
  // 00:40 UTC del 14/10 es todavía 13/10 en Caracas (UTC−4).
  assert.equal(toDisplayDateCaracas('2026-10-14T00:40:00Z'), '13/10/2026');
  assert.match(toDisplayDateTimeCaracas('2026-10-14T00:40:00Z'), /^13\/10\/2026/);
  assert.equal(toDisplayDateCaracas('no es fecha'), '');
});
