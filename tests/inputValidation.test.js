import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_PERSON_NAME_LENGTH, normalizePlainText } from '../src/utils/inputValidation.js';

test('plain-text names remove HTML delimiters and stay within the maximum length', () => {
  const name = normalizePlainText('<b>María</b> '.repeat(20));

  assert.equal(name.includes('<'), false);
  assert.equal(name.includes('>'), false);
  assert.match(normalizePlainText('<b>María</b>'), /^María$/);
  assert.equal(name.length, MAX_PERSON_NAME_LENGTH);
});

test('plain-text normalization accepts an empty optional name', () => {
  assert.equal(normalizePlainText(null), '');
});