/**
 * money.js — Aritmética monetaria exacta en centavos enteros.
 *
 * Reglas:
 *   - Todo monto persistido o sumado se representa como entero de centavos.
 *   - Las tasas (interés y cambio) se escalan a enteros con RATE_SCALE para
 *     operar con BigInt y redondear una sola vez, con redondeo bancario
 *     (mitad al par), igual que `round_half_even` en las migraciones SQL.
 */

export const CURRENCIES = Object.freeze({ USD: 'USD', VES: 'VES' });
export const RATE_DECIMALS = 8;
export const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);
/** Mayor monto admitido en centavos (≈ 90 billones de unidades). */
export const MAX_CENTS = 9_000_000_000_000_000;

export function isCurrency(value) {
  return value === 'USD' || value === 'VES';
}

/** División entera de BigInt con redondeo mitad al par. */
export function divRoundHalfEven(numerator, denominator) {
  if (denominator === 0n) throw new RangeError('División entre cero');
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  let quotient = abs / denominator;
  const twiceRemainder = (abs % denominator) * 2n;
  if (twiceRemainder > denominator || (twiceRemainder === denominator && quotient % 2n === 1n)) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
}

/**
 * Convierte un decimal (number o string "1234.56") en un BigInt escalado.
 * Lanza RangeError si no es un número finito con a lo sumo `decimals` decimales
 * significativos tras redondear.
 */
export function toScaled(value, decimals) {
  const text = typeof value === 'number' ? numberToPlainString(value) : String(value ?? '').trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new RangeError(`Valor numérico inválido: ${value}`);
  const [, sign, intPart, fracPart = ''] = match;
  const scale = 10n ** BigInt(decimals);
  const kept = fracPart.slice(0, decimals).padEnd(decimals, '0');
  let scaled = BigInt(intPart) * scale + BigInt(kept || '0');
  const rest = fracPart.slice(decimals);
  if (rest) {
    // Redondeo mitad al par sobre los dígitos sobrantes.
    const restValue = BigInt(rest);
    const half = 5n * 10n ** BigInt(rest.length - 1);
    if (restValue > half || (restValue === half && scaled % 2n === 1n)) scaled += 1n;
  }
  return sign ? -scaled : scaled;
}

function numberToPlainString(value) {
  if (!Number.isFinite(value)) throw new RangeError(`Valor numérico inválido: ${value}`);
  // toPrecision(15) elimina el ruido binario (0.1 + 0.2 → "0.300000000000000").
  const text = Number(value.toPrecision(15)).toString();
  if (!/e/i.test(text)) return text;
  return value.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
}

/** Monto decimal → centavos enteros (Number seguro). */
export function toCents(value) {
  const cents = toScaled(value, 2);
  if (cents > BigInt(MAX_CENTS) || cents < -BigInt(MAX_CENTS)) {
    throw new RangeError('Monto fuera del rango permitido');
  }
  return Number(cents);
}

/** Centavos → número decimal para presentación. */
export function fromCents(cents) {
  return Number(cents) / 100;
}

/** Tasa decimal (ej. 36.5 Bs/USD o 7 %) → BigInt escalado a RATE_DECIMALS. */
export function toRateUnits(rate) {
  return toScaled(rate, RATE_DECIMALS);
}

export function isValidCents(value) {
  return Number.isSafeInteger(value) && Math.abs(value) <= MAX_CENTS;
}

export function assertCents(value, label = 'monto') {
  if (!isValidCents(value)) throw new RangeError(`El ${label} debe ser un entero de centavos válido`);
  return value;
}

/** Suma exacta de centavos. */
export function sumCents(values) {
  return values.reduce((total, value) => total + assertCents(value), 0);
}

/**
 * Reparte `totalCents` en partes proporcionales a `weights` sin perder
 * centavos (método del mayor residuo; empates a favor de las primeras).
 */
export function allocateCents(totalCents, weights) {
  assertCents(totalCents);
  if (!weights.length) return [];
  const big = weights.map((weight) => {
    if (!Number.isSafeInteger(weight) || weight < 0) throw new RangeError('Pesos inválidos');
    return BigInt(weight);
  });
  const weightSum = big.reduce((a, b) => a + b, 0n);
  if (weightSum === 0n) throw new RangeError('La suma de pesos debe ser mayor a cero');
  const total = BigInt(totalCents);
  const sign = total < 0n ? -1n : 1n;
  const absTotal = total * sign;
  const parts = big.map((weight) => (absTotal * weight) / weightSum);
  const remainders = big.map((weight, index) => ({ index, remainder: (absTotal * weight) % weightSum }));
  let leftover = absTotal - parts.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : a.index - b.index));
  for (let i = 0; leftover > 0n; i += 1, leftover -= 1n) {
    parts[remainders[i % remainders.length].index] += 1n;
  }
  return parts.map((part) => Number(part * sign));
}

/** Divide en `n` partes iguales; los centavos sobrantes van a las primeras. */
export function splitEvenly(totalCents, n) {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('Número de partes inválido');
  return allocateCents(totalCents, Array.from({ length: n }, () => 1));
}

/**
 * Convierte centavos entre USD y VES con una tasa VES por 1 USD.
 * Redondea una sola vez al centavo (mitad al par).
 */
export function convertCents(cents, rate, from, to) {
  assertCents(cents);
  if (!isCurrency(from) || !isCurrency(to)) throw new RangeError('Moneda inválida');
  if (from === to) return cents;
  const rateUnits = toRateUnits(rate);
  if (rateUnits <= 0n) throw new RangeError('La tasa de cambio debe ser mayor a cero');
  const amount = BigInt(cents);
  const result = from === 'USD'
    ? divRoundHalfEven(amount * rateUnits, RATE_SCALE)
    : divRoundHalfEven(amount * RATE_SCALE, rateUnits);
  return Number(result);
}

/**
 * Interés simple exacto: principal × (tasa/100) × (días / díasBase).
 * `ratePercent` es el porcentaje por período base (ej. 7 → 7 % quincenal).
 */
export function simpleInterestCents(principalCents, ratePercent, days, baseDays) {
  assertCents(principalCents, 'capital');
  if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('Días inválidos');
  if (!Number.isSafeInteger(baseDays) || baseDays <= 0) throw new RangeError('Base de días inválida');
  const rateUnits = toRateUnits(ratePercent);
  const numerator = BigInt(principalCents) * rateUnits * BigInt(days);
  const denominator = 100n * RATE_SCALE * BigInt(baseDays);
  return Number(divRoundHalfEven(numerator, denominator));
}

/** Aplica un porcentaje a un monto en centavos (ej. 5 % de 1000 → 50). */
export function percentOfCents(cents, percent) {
  assertCents(cents);
  return Number(divRoundHalfEven(BigInt(cents) * toRateUnits(percent), 100n * RATE_SCALE));
}
