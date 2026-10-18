/**
 * calculator.js — Adaptador de la calculadora sobre el núcleo financiero.
 *
 * La lógica vive en `shared/finance/` y opera en centavos enteros; aquí se
 * expone la API que usa la interfaz (montos en unidades para presentación).
 */

import { convertCents, fromCents, simpleInterestCents, toCents } from '../../shared/finance/money.js';
import { daysBetween, isISODate, toDisplayDate } from '../../shared/finance/dates.js';
import {
  FREQUENCY_DAYS,
  LIMITS,
  RATE_MODE_DAYS,
  buildSchedule,
  installmentCount,
  normalizeLoanTerms,
  openLoanPeriodInterestCents,
} from '../../shared/finance/schedule.js';
import { addDaysISO } from '../../shared/finance/dates.js';

export const DIAS_POR_MODALIDAD = RATE_MODE_DAYS;
export const DIAS_POR_FRECUENCIA = FREQUENCY_DAYS;

export const MONEDAS = {
  USD: { simbolo: '$', nombre: 'USD ($ Divisas)', decimales: 2 },
  VES: { simbolo: 'Bs.', nombre: 'VES (Bs Digitales)', decimales: 2 },
};

export const METODOS_INTERES = {
  interes_fijo: 'Interés fijo sobre capital inicial',
  saldo_insoluto: 'Interés sobre saldo pendiente',
};

export function calcularDiasExactos(fechaInicio, fechaFin) {
  if (!isISODate(fechaInicio) || !isISODate(fechaFin)) return 0;
  return Math.max(0, daysBetween(fechaInicio, fechaFin));
}

export function calcularInteresSimple(monto, tasa, modalidad, dias) {
  if (!monto || monto <= 0 || !tasa || tasa <= 0 || !dias || dias <= 0) return 0;
  return fromCents(simpleInterestCents(toCents(monto), tasa, dias, RATE_MODE_DAYS[modalidad] ?? 1));
}

export function calcularNumeroCuotas(diasTotales, frecuencia) {
  return installmentCount(diasTotales, frecuencia);
}

/** Convierte entre USD y VES redondeando al centavo. Devuelve 0 si la tasa no es válida. */
export function convertirMoneda(monto, tasaBCV, de, a) {
  if (!Number.isFinite(tasaBCV) || tasaBCV <= 0 || !Number.isFinite(monto)) return 0;
  try {
    return fromCents(convertCents(toCents(monto), tasaBCV, de, a));
  } catch {
    return 0;
  }
}

export function formatearMoneda(monto, moneda = 'USD') {
  if (monto === null || monto === undefined || Number.isNaN(Number(monto))) return '—';
  const cfg = MONEDAS[moneda] ?? MONEDAS.USD;
  const formatted = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: cfg.decimales,
    maximumFractionDigits: cfg.decimales,
  }).format(monto);
  return `${cfg.simbolo} ${formatted}`;
}

function validarTasaCambio(tasaBCV) {
  return Number.isFinite(tasaBCV) && tasaBCV >= 0.000001 && tasaBCV <= LIMITS.maxExchangeRate;
}

/** La tasa de cambio es opcional: sin ella no se calculan equivalencias. */
function tasaCambioInvalida(tasaBCV) {
  return tasaBCV !== undefined && tasaBCV !== null && tasaBCV !== '' && !validarTasaCambio(tasaBCV);
}

/**
 * Ejecuta la simulación completa del préstamo.
 * Los montos devueltos están en unidades (no centavos) y cuadran al centavo.
 */
export function simularPrestamo(params) {
  const {
    monto, moneda, tasa, modalidadTasa, fechaInicio, fechaFin, frecuenciaPago, tasaBCV,
    metodoInteres = 'interes_fijo', tipoPlazo = 'fijo',
  } = params;

  if (tipoPlazo === 'abierto') return simularPrestamoAbierto(params);

  const normalized = normalizeLoanTerms({
    principal: Number.isFinite(monto) ? monto : NaN,
    currency: moneda,
    ratePercent: tasa,
    rateMode: modalidadTasa,
    startDate: fechaInicio,
    endDate: fechaFin,
    frequency: frecuenciaPago,
    method: metodoInteres,
  });
  const errores = normalized.ok ? [] : [...normalized.errors];
  if (tasaCambioInvalida(tasaBCV)) errores.push('La tasa BCV debe ser mayor a 0 y dentro del rango permitido.');
  if (errores.length) return { valido: false, errores };

  const { terms } = normalized;
  const plan = buildSchedule(terms);
  const cuotas = plan.installments;
  const primera = cuotas[0];
  const ultima = cuotas.at(-1);
  const intervaloPago = FREQUENCY_DAYS[frecuenciaPago];
  const monedaAlterna = moneda === 'USD' ? 'VES' : 'USD';
  const alterna = (cents) => (validarTasaCambio(tasaBCV) ? fromCents(convertCents(cents, tasaBCV, moneda, monedaAlterna)) : null);

  const interes = fromCents(plan.interestCents);
  const montoNormalizado = fromCents(terms.principalCents);

  return {
    valido: true,
    errores: [],
    monto: montoNormalizado, moneda, tasa: terms.ratePercent, modalidadTasa, fechaInicio, fechaFin,
    frecuenciaPago, tasaBCV, metodoInteres, tipoPlazo: 'fijo',
    diasTotales: plan.totalDays,
    interes,
    totalPagar: fromCents(plan.totalCents),
    numeroCuotas: cuotas.length,
    intervaloPago,
    diasPrimeraCuota: primera.days,
    diasUltimaCuota: ultima.days,
    tieneCuotaRemanente: cuotas.length > 1 && ultima.days !== intervaloPago,
    montoCuota: fromCents(primera.totalCents),
    interesXCuota: fromCents(primera.interestCents),
    cuotaInicial: fromCents(primera.totalCents),
    cuotaFinal: fromCents(ultima.totalCents),
    monedaAlterna,
    interesAlterna: alterna(plan.interestCents),
    totalAlterna: alterna(plan.totalCents),
    cuotaAlterna: alterna(primera.totalCents),
    cuotaFinalAlterna: alterna(ultima.totalCents),
    tasaEfectivaDiaria: (interes / montoNormalizado / plan.totalDays) * 100,
    rendimientoPorcentaje: (interes / montoNormalizado) * 100,
  };
}

/**
 * Préstamo abierto (sin fecha de fin): el capital se paga cuando el cliente
 * pueda y cada período genera interés sobre el capital pendiente.
 */
function simularPrestamoAbierto({ monto, moneda, tasa, modalidadTasa, fechaInicio, frecuenciaPago, tasaBCV }) {
  const intervalo = FREQUENCY_DAYS[frecuenciaPago];
  // Se validan monto, tasa y modalidades con un período de referencia.
  const normalized = normalizeLoanTerms({
    principal: Number.isFinite(monto) ? monto : NaN,
    currency: moneda,
    ratePercent: tasa,
    rateMode: modalidadTasa,
    startDate: fechaInicio,
    endDate: intervalo && fechaInicio ? addDaysISO(fechaInicio, intervalo) : fechaInicio,
    frequency: frecuenciaPago,
    method: 'saldo_insoluto',
  });
  const errores = normalized.ok ? [] : [...normalized.errors];
  if (tasaCambioInvalida(tasaBCV)) errores.push('La tasa BCV debe ser mayor a 0 y dentro del rango permitido.');
  if (errores.length) return { valido: false, errores };

  const { terms } = normalized;
  const interesCents = openLoanPeriodInterestCents({
    principalCents: terms.principalCents, ratePercent: terms.ratePercent, rateMode: modalidadTasa, frequency: frecuenciaPago,
  });
  const montoNormalizado = fromCents(terms.principalCents);
  const interesPeriodo = fromCents(interesCents);
  return {
    valido: true,
    errores: [],
    abierto: true,
    tipoPlazo: 'abierto',
    metodoInteres: 'saldo_insoluto',
    monto: montoNormalizado, moneda, tasa: terms.ratePercent, modalidadTasa, fechaInicio, frecuenciaPago, tasaBCV,
    fechaFin: null,
    diasPeriodo: intervalo,
    interesPeriodo,
    primerVencimiento: addDaysISO(fechaInicio, intervalo),
    // Campos compatibles con el historial de cotizaciones.
    interes: interesPeriodo,
    totalPagar: montoNormalizado,
    rendimientoPorcentaje: (interesPeriodo / montoNormalizado) * 100,
    monedaAlterna: moneda === 'USD' ? 'VES' : 'USD',
    interesPeriodoAlterna: validarTasaCambio(tasaBCV) ? fromCents(convertCents(interesCents, tasaBCV, moneda, moneda === 'USD' ? 'VES' : 'USD')) : null,
    montoAlterna: validarTasaCambio(tasaBCV) ? fromCents(convertCents(terms.principalCents, tasaBCV, moneda, moneda === 'USD' ? 'VES' : 'USD')) : null,
  };
}

/**
 * Genera el cronograma de pagos detallado a partir de `simularPrestamo()`.
 * @returns {Array<{cuota,fecha,fechaISO,diasPeriodo,capital,interes,total,saldo,totalAlterna}>}
 */
export function generarCronograma(resultado) {
  if (!resultado?.valido || resultado.abierto) return [];
  const normalized = normalizeLoanTerms({
    principal: resultado.monto,
    currency: resultado.moneda,
    ratePercent: resultado.tasa,
    rateMode: resultado.modalidadTasa,
    startDate: resultado.fechaInicio,
    endDate: resultado.fechaFin,
    frequency: resultado.frecuenciaPago,
    method: resultado.metodoInteres ?? 'interes_fijo',
  });
  if (!normalized.ok || tasaCambioInvalida(resultado.tasaBCV)) return [];

  const { moneda, monedaAlterna, tasaBCV } = resultado;
  return buildSchedule(normalized.terms).installments.map((cuota) => ({
    cuota: cuota.number,
    fecha: toDisplayDate(cuota.dueDate),
    fechaISO: cuota.dueDate,
    diasPeriodo: cuota.days,
    capital: fromCents(cuota.principalCents),
    interes: fromCents(cuota.interestCents),
    total: fromCents(cuota.totalCents),
    saldo: fromCents(cuota.balanceCents),
    totalAlterna: validarTasaCambio(tasaBCV) ? fromCents(convertCents(cuota.totalCents, tasaBCV, moneda, monedaAlterna)) : null,
  }));
}
