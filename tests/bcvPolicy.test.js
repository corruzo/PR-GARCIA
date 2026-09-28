import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BCV_REFRESH_INTERVAL_MS,
  createInMemoryRateLimiter,
  isReasonableBCVRate,
  shouldPersistBCVRate,
} from '../shared/bcvPolicy.js';

test('BCV rates must be finite, positive, and safely representable', () => {
  assert.equal(isReasonableBCVRate(100), true);
  assert.equal(isReasonableBCVRate(0), false);
  assert.equal(isReasonableBCVRate(-1), false);
  assert.equal(isReasonableBCVRate(Number.NaN), false);
  assert.equal(isReasonableBCVRate(Number.POSITIVE_INFINITY), false);
  assert.equal(isReasonableBCVRate(Number.MAX_SAFE_INTEGER + 1), false);
});

test('BCV rate changes above twenty percent are rejected', () => {
  assert.equal(isReasonableBCVRate(120, 100), true);
  assert.equal(isReasonableBCVRate(80, 100), true);
  assert.equal(isReasonableBCVRate(121, 100), false);
});

test('a BCV rate is persisted when missing, changed, or older than ten minutes', () => {
  const now = Date.now();
  const recent = { value: 100, fetchedAt: new Date(now - BCV_REFRESH_INTERVAL_MS + 1).toISOString() };
  const old = { value: 100, fetchedAt: new Date(now - BCV_REFRESH_INTERVAL_MS).toISOString() };

  assert.equal(shouldPersistBCVRate(null, 100, now), true);
  assert.equal(shouldPersistBCVRate(recent, 100, now), false);
  assert.equal(shouldPersistBCVRate(recent, 101, now), true);
  assert.equal(shouldPersistBCVRate(old, 100, now), true);
});

test('the in-memory rate limit separates clients and expires old requests', () => {
  const allowRequest = createInMemoryRateLimiter({ maxRequests: 2, windowMs: 1000 });

  assert.equal(allowRequest('client-a', 1000), true);
  assert.equal(allowRequest('client-a', 1100), true);
  assert.equal(allowRequest('client-a', 1200), false);
  assert.equal(allowRequest('client-b', 1200), true);
  assert.equal(allowRequest('client-a', 2001), true);
});