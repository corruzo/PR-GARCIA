/**
 * schedule.js — Términos del préstamo y cronograma de cuotas en centavos.
 *
 * Métodos de interés:
 *   - 'interes_fijo'    Interés simple sobre el capital original durante todo
 *                       el plazo, repartido entre cuotas según sus días.
 *   - 'saldo_insoluto'  Interés simple de cada período sobre el saldo pendiente.
 * En ambos el capital se amortiza en partes iguales (centavos sobrantes en
 * las primeras cuotas), y la última cuota vence exactamente en la fecha fin.
 */

import { allocateCents, isCurrency, simpleInterestCents, splitEvenly, toCents, toRateUnits } from './money.js';
import { addDaysISO, daysBetween, isISODate } from './dates.js';

export const RATE_MODE_DAYS = Object.freeze({ diaria: 1, semanal: 7, quincenal: 15, mensual: 30 });
export const FREQUENCY_DAYS = Object.freeze({ diario: 1, semanal: 7, quincenal: 15, mensual: 30 });
export const INTEREST_METHODS = Object.freeze(['interes_fijo', 'saldo_insoluto']);

export const LIMITS = Object.freeze({
  maxRatePercent: 1000,
  maxTermDays: 3660,
  maxInstallments: 600,
  maxExchangeRate: 1e12,
});

/**
 * Valida y normaliza los términos. Acepta montos y tasas como number o string.
 * @returns {{ ok: true, terms } | { ok: false, errors: string[] }}
 */
export function normalizeLoanTerms(input) {
  const errors = [];
  const terms = {
    currency: input?.currency,
    ratePercent: input?.ratePercent,
    rateMode: input?.rateMode,
    startDate: input?.startDate,
    endDate: input?.endDate,
    frequency: input?.frequency,
    method: input?.method ?? 'interes_fijo',
  };

  try {
    terms.principalCents = Number.isSafeInteger(input?.principalCents)
      ? input.principalCents
      : toCents(input?.principal);
    if (terms.principalCents < 1) throw new RangeError();
  } catch {
    errors.push('Ingresa un monto mayor a 0 y dentro del rango permitido.');
  }

  try {
    const rate = Number(input?.ratePercent);
    if (!Number.isFinite(rate) || toRateUnits(rate) <= 0n || rate > LIMITS.maxRatePercent) throw new RangeError();
    terms.ratePercent = rate;
  } catch {
    errors.push(`Ingresa una tasa mayor a 0 y de hasta ${LIMITS.maxRatePercent} %.`);
  }

  if (!isCurrency(terms.currency)) errors.push('Selecciona la moneda del préstamo (USD o VES).');
  if (!(terms.rateMode in RATE_MODE_DAYS)) errors.push('Selecciona la modalidad de la tasa.');
  if (!(terms.frequency in FREQUENCY_DAYS)) errors.push('Selecciona la frecuencia de pago.');
  if (!INTEREST_METHODS.includes(terms.method)) errors.push('Selecciona el método de interés.');
  if (!isISODate(terms.startDate)) errors.push('Ingresa la fecha de inicio.');
  if (!isISODate(terms.endDate)) errors.push('Ingresa la fecha de fin.');

  if (!errors.length) {
    terms.totalDays = daysBetween(terms.startDate, terms.endDate);
    if (terms.totalDays <= 0) errors.push('La fecha de fin debe ser posterior a la fecha de inicio.');
    else if (terms.totalDays > LIMITS.maxTermDays) errors.push('El plazo no puede superar 10 años.');
    else if (Math.ceil(terms.totalDays / FREQUENCY_DAYS[terms.frequency]) > LIMITS.maxInstallments) {
      errors.push(`El préstamo no puede tener más de ${LIMITS.maxInstallments} cuotas.`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, terms };
}

export function installmentCount(totalDays, frequency) {
  if (!totalDays || totalDays <= 0) return 0;
  return Math.ceil(totalDays / (FREQUENCY_DAYS[frequency] ?? 1));
}

/**
 * Genera el cronograma a partir de términos ya normalizados.
 * @returns {{ totalDays, interestCents, totalCents, installments: Array }}
 */
export function buildSchedule(terms) {
  const { principalCents, ratePercent, rateMode, startDate, endDate, frequency, method } = terms;
  const totalDays = daysBetween(startDate, endDate);
  const interval = FREQUENCY_DAYS[frequency];
  const baseDays = RATE_MODE_DAYS[rateMode];
  const count = installmentCount(totalDays, frequency);

  const dueDates = Array.from({ length: count }, (_, i) =>
    (i === count - 1 ? endDate : addDaysISO(startDate, (i + 1) * interval)));
  const periodDays = dueDates.map((date, i) => daysBetween(i === 0 ? startDate : dueDates[i - 1], date));
  const capital = splitEvenly(principalCents, count);

  let interest;
  if (method === 'saldo_insoluto') {
    let balance = principalCents;
    interest = capital.map((cap, i) => {
      const value = simpleInterestCents(balance, ratePercent, periodDays[i], baseDays);
      balance -= cap;
      return value;
    });
  } else {
    const total = simpleInterestCents(principalCents, ratePercent, totalDays, baseDays);
    interest = allocateCents(total, periodDays);
  }

  let balance = principalCents;
  const installments = dueDates.map((dueDate, i) => {
    balance -= capital[i];
    return {
      number: i + 1,
      dueDate,
      days: periodDays[i],
      principalCents: capital[i],
      interestCents: interest[i],
      totalCents: capital[i] + interest[i],
      balanceCents: balance,
    };
  });

  const interestCents = interest.reduce((a, b) => a + b, 0);
  return { totalDays, interestCents, totalCents: principalCents + interestCents, installments };
}
