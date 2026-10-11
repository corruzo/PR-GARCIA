import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHash, parseHash } from '../src/features/cartera/router.js';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

test('hash routes are parsed and validated', () => {
  assert.deepEqual(parseHash(''), { view: 'calculator', id: null, params: {} });
  assert.deepEqual(parseHash(`#/prestamos/${ID}`), { view: 'prestamos', id: ID, params: {} });
  assert.deepEqual(parseHash(`#/prestamos/nuevo?cliente=${ID}&x=<script>`), { view: 'prestamos', id: 'nuevo', params: { cliente: ID } });
  assert.deepEqual(parseHash('#/clientes/../../etc'), { view: 'clientes', id: null, params: {} });
  assert.deepEqual(parseHash('#/admin'), { view: 'calculator', id: null, params: {} });
  assert.equal(buildHash('prestamos', 'nuevo', { cliente: ID }), `#/prestamos/nuevo?cliente=${ID}`);
});
