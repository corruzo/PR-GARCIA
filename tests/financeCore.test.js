import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateCents, convertCents, divRoundHalfEven, percentOfCents, simpleInterestCents, splitEvenly, toCents,
} from '../shared/finance/money.js';
import { addDaysISO, daysBetween, isISODate, todayCaracas } from '../shared/finance/dates.js';
import { buildSchedule, normalizeLoanTerms } from '../shared/finance/schedule.js';

test('toCents parses decimals without binary noise and rounds half-even', () => {
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents('1234.565'), 123456);
  assert.equal(toCents('1234.575'), 123458);
  assert.equal(toCents(1.005), 100);
  assert.equal(toCents('100'), 10000);
  assert.throws(() => toCents('12,5'));
  assert.throws(() => toCents(Number.NaN));
  assert.throws(() => toCents(1e17));
});

test('divRoundHalfEven rounds ties to even in both signs', () => {
  assert.equal(divRoundHalfEven(5n, 2n), 2n);
  assert.equal(divRoundHalfEven(7n, 2n), 4n);
  assert.equal(divRoundHalfEven(-5n, 2n), -2n);
  assert.equal(divRoundHalfEven(-7n, 2n), -4n);
});

test('allocations never lose or create cents', () => {
  assert.deepEqual(splitEvenly(10001, 3), [3334, 3334, 3333]);
  assert.deepEqual(allocateCents(24667, [15, 15, 7]), [10000, 10000, 4667]);
  for (let total = 0; total < 500; total += 37) {
    const parts = allocateCents(total, [3, 1, 4, 1, 5]);
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
  }
  assert.deepEqual(allocateCents(-100, [1, 2]), [-33, -67]);
});

test('currency conversion is symmetric to the cent with high-precision rates', () => {
  assert.equal(convertCents(10000, 36.5, 'USD', 'VES'), 365000);
  assert.equal(convertCents(365000, 36.5, 'VES', 'USD'), 10000);
  assert.equal(convertCents(100, '852.4168', 'USD', 'VES'), 85242);
  assert.equal(convertCents(500, 1, 'USD', 'USD'), 500);
  assert.throws(() => convertCents(100, 0, 'USD', 'VES'));
  assert.throws(() => convertCents(100, 36, 'USD', 'EUR'));
});

test('simple interest is exact on the cent', () => {
  assert.equal(simpleInterestCents(100000, 5, 30, 1), 150000);
  assert.equal(simpleInterestCents(100000, 10, 14, 7), 20000);
  assert.equal(simpleInterestCents(100000, 10, 37, 15), 24667);
  assert.equal(percentOfCents(100000, 2.5), 2500);
});

test('calendar dates ignore timezones and validate impossible days', () => {
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(addDaysISO('2024-12-25', 10), '2025-01-04');
  assert.equal(isISODate('2025-02-29'), false);
  assert.equal(isISODate('2024-02-29'), true);
  assert.equal(todayCaracas(Date.UTC(2026, 0, 2, 3, 0)), '2026-01-01');
});

const baseTerms = {
  principal: 1000, currency: 'USD', ratePercent: 10, rateMode: 'quincenal',
  startDate: '2024-01-01', endDate: '2024-02-07', frequency: 'quincenal',
};

test('remnant installment covers only its exact days', () => {
  const { terms } = normalizeLoanTerms(baseTerms);
  const plan = buildSchedule(terms);
  assert.deepEqual(plan.installments.map((c) => c.days), [15, 15, 7]);
  assert.equal(plan.installments[2].interestCents, 4667);
  assert.equal(plan.interestCents, 24667);
  assert.equal(plan.installments.reduce((s, c) => s + c.totalCents, 0), plan.totalCents);
  assert.equal(plan.installments.at(-1).balanceCents, 0);
  assert.equal(plan.installments.at(-1).dueDate, '2024-02-07');
});

test('declining-balance method charges less interest than flat interest', () => {
  const flat = buildSchedule(normalizeLoanTerms(baseTerms).terms);
  const declining = buildSchedule(normalizeLoanTerms({ ...baseTerms, method: 'saldo_insoluto' }).terms);
  // 1000×10%×15/15 + 666.67×10%×15/15 + 333.33×10%×7/15
  assert.deepEqual(declining.installments.map((c) => c.interestCents), [10000, 6667, 1556]);
  assert.ok(declining.interestCents < flat.interestCents);
});

test('loan terms reject unsafe or incoherent input', () => {
  assert.equal(normalizeLoanTerms({ ...baseTerms, principal: -1 }).ok, false);
  assert.equal(normalizeLoanTerms({ ...baseTerms, ratePercent: 5000 }).ok, false);
  assert.equal(normalizeLoanTerms({ ...baseTerms, currency: 'EUR' }).ok, false);
  assert.equal(normalizeLoanTerms({ ...baseTerms, method: 'frances' }).ok, false);
  assert.equal(normalizeLoanTerms({ ...baseTerms, endDate: '2040-01-01' }).ok, false);
  assert.equal(normalizeLoanTerms({ ...baseTerms, frequency: 'diario', endDate: '2026-01-01' }).ok, false);
});
