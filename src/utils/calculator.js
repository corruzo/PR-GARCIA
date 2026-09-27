/**
 * calculator.js — Utilidades matemáticas para cálculo de préstamos e intereses.
 * Contexto: Venezuela / Interés Simple con días reales.
 *
 * EXPORTACIONES PRINCIPALES:
 *   calcularDiasExactos(inicio, fin)       → número de días entre dos fechas
 *   calcularInteresSimple(params)          → objeto con todos los resultados
 *   calcularCuotas(params)                 → array de cuotas detalladas
 *   convertirMoneda(monto, tasa, de, a)    → conversión USD ↔ VES
 *   formatearMoneda(monto, moneda)         → string formateado
 */

import { differenceInDays, parseISO, isValid, addDays, format } from 'date-fns';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Días equivalentes por modalidad de tasa */
export const DIAS_POR_MODALIDAD = {
  diaria:    1,
  semanal:   7,
  quincenal: 15,
  mensual:   30,
};

/** Días entre pagos según frecuencia */
export const DIAS_POR_FRECUENCIA = {
  diario:    1,
  semanal:   7,
  quincenal: 15,
  mensual:   30,
};

export const MONEDAS = {
  USD: { simbolo: '$', nombre: 'USD ($ Divisas)', decimales: 2 },
  VES: { simbolo: 'Bs.', nombre: 'VES (Bs Digitales)', decimales: 2 },
};

// ─── Funciones base ───────────────────────────────────────────────────────────

/**
 * Calcula días exactos entre dos fechas usando date-fns.
 * @param {string|Date} fechaInicio
 * @param {string|Date} fechaFin
 * @returns {number} días exactos (mínimo 0)
 */
export function calcularDiasExactos(fechaInicio, fechaFin) {
  const inicio = typeof fechaInicio === 'string' ? parseISO(fechaInicio) : fechaInicio;
  const fin    = typeof fechaFin    === 'string' ? parseISO(fechaFin)    : fechaFin;

  if (!isValid(inicio) || !isValid(fin)) return 0;

  const dias = differenceInDays(fin, inicio);
  return Math.max(0, dias);
}

/**
 * Calcula el interés generado bajo la fórmula de Interés Simple.
 *
 * Fórmula:
 *   - Tasa Diaria:    I = P × (r/100) × d
 *   - Tasa Semanal:   I = P × (r/100) × (d / 7)
 *   - Tasa Quincenal: I = P × (r/100) × (d / 15)
 *   - Tasa Mensual:   I = P × (r/100) × (d / 30)
 *
 * @param {number}  monto        Capital principal
 * @param {number}  tasa         Tasa de interés en porcentaje (ej: 5 para 5%)
 * @param {string}  modalidad    'diaria' | 'semanal' | 'quincenal' | 'mensual'
 * @param {number}  dias         Días totales del préstamo
 * @returns {number}             Interés total generado
 */
export function calcularInteresSimple(monto, tasa, modalidad, dias) {
  if (!monto || monto <= 0 || !tasa || tasa <= 0 || !dias || dias <= 0) return 0;

  const tasaDecimal = tasa / 100;
  const divisor     = DIAS_POR_MODALIDAD[modalidad] ?? 1;

  return monto * tasaDecimal * (dias / divisor);
}

/**
 * Calcula el número de cuotas según la frecuencia y los días totales.
 * La última cuota cubre los días restantes si no es divisible exactamente.
 *
 * @param {number} diasTotales
 * @param {string} frecuencia  'diario' | 'semanal' | 'quincenal' | 'mensual'
 * @returns {number} número de cuotas (mínimo 1)
 */
export function calcularNumeroCuotas(diasTotales, frecuencia) {
  if (!diasTotales || diasTotales <= 0) return 0;
  const intervalo = DIAS_POR_FRECUENCIA[frecuencia] ?? 1;
  return Math.ceil(diasTotales / intervalo);
}

/**
 * Convierte entre USD y VES.
 * @param {number} monto
 * @param {number} tasaBCV   Tasa BCV (VES por 1 USD)
 * @param {'USD'|'VES'} de   Moneda origen
 * @param {'USD'|'VES'} a    Moneda destino
 * @returns {number}
 */
export function convertirMoneda(monto, tasaBCV, de, a) {
  if (!tasaBCV || tasaBCV <= 0) return 0;
  if (de === a) return monto;
  if (de === 'USD' && a === 'VES') return monto * tasaBCV;
  if (de === 'VES' && a === 'USD') return monto / tasaBCV;
  return monto;
}

/**
 * Formatea un número como moneda según el tipo.
 * @param {number}        monto
 * @param {'USD'|'VES'}   moneda
 * @returns {string}
 */
export function formatearMoneda(monto, moneda = 'USD') {
  if (isNaN(monto) || monto === null) return '—';
  const cfg = MONEDAS[moneda];
  const formatted = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: cfg.decimales,
    maximumFractionDigits: cfg.decimales,
  }).format(monto);
  return `${cfg.simbolo} ${formatted}`;
}

// ─── Función principal de simulación ─────────────────────────────────────────

/**
 * Ejecuta la simulación completa del préstamo.
 *
 * @param {Object} params
 * @param {number}           params.monto         Capital principal
 * @param {'USD'|'VES'}      params.moneda        Moneda del préstamo
 * @param {number}           params.tasa          Tasa de interés (%)
 * @param {'diaria'|'semanal'|'quincenal'|'mensual'} params.modalidadTasa
 * @param {string}           params.fechaInicio   ISO date string 'YYYY-MM-DD'
 * @param {string}           params.fechaFin      ISO date string 'YYYY-MM-DD'
 * @param {string}           params.frecuenciaPago
 * @param {number}           params.tasaBCV       Tasa del día (VES por USD)
 *
 * @returns {Object} Resultado completo de la simulación
 */
export function simularPrestamo(params) {
  const {
    monto, moneda, tasa, modalidadTasa,
    fechaInicio, fechaFin, frecuenciaPago, tasaBCV,
  } = params;

  // Validaciones
  const errores = [];
  if (!monto || monto <= 0)    errores.push('El monto debe ser mayor a 0.');
  if (!tasa  || tasa  <= 0)    errores.push('La tasa de interés debe ser mayor a 0.');
  if (!fechaInicio)             errores.push('Ingresa la fecha de inicio.');
  if (!fechaFin)                errores.push('Ingresa la fecha de fin.');
  if (!tasaBCV || tasaBCV <= 0) errores.push('La tasa BCV debe ser mayor a 0.');

  if (errores.length > 0) return { valido: false, errores };

  const diasTotales = calcularDiasExactos(fechaInicio, fechaFin);
  if (diasTotales <= 0) return { valido: false, errores: ['La fecha de fin debe ser posterior a la fecha de inicio.'] };

  // Cálculos principales
  const interes       = calcularInteresSimple(monto, tasa, modalidadTasa, diasTotales);
  const totalPagar    = monto + interes;
  const numeroCuotas  = calcularNumeroCuotas(diasTotales, frecuenciaPago);
  const capitalXCuota = numeroCuotas > 0 ? monto / numeroCuotas : monto;
  const intervaloPago = DIAS_POR_FRECUENCIA[frecuenciaPago] ?? 1;

  const diasPrimeraCuota = Math.min(intervaloPago, diasTotales);
  const interesPrimeraCuota = interes * (diasPrimeraCuota / diasTotales);
  const diasUltimaCuota = numeroCuotas > 1
    ? (diasTotales - intervaloPago * (numeroCuotas - 1))
    : diasPrimeraCuota;
  const interesUltimaCuota = interes * (diasUltimaCuota / diasTotales);

  const cuotaInicial = capitalXCuota + interesPrimeraCuota;
  const cuotaFinal = numeroCuotas > 1 ? capitalXCuota + interesUltimaCuota : cuotaInicial;
  const tieneCuotaRemanente = numeroCuotas > 1 && diasUltimaCuota !== intervaloPago;

  const montoCuota = cuotaInicial;
  const interesXCuota = interesPrimeraCuota;

  // Moneda alterna
  const monedaAlterna = moneda === 'USD' ? 'VES' : 'USD';
  const interesAlterna   = convertirMoneda(interes, tasaBCV, moneda, monedaAlterna);
  const totalAlterna     = convertirMoneda(totalPagar, tasaBCV, moneda, monedaAlterna);
  const cuotaAlterna     = convertirMoneda(montoCuota, tasaBCV, moneda, monedaAlterna);
  const cuotaFinalAlterna = convertirMoneda(cuotaFinal, tasaBCV, moneda, monedaAlterna);

  // Rentabilidad
  const tasaEfectivaDiaria   = diasTotales > 0 ? (interes / monto / diasTotales) * 100 : 0;
  const rendimientoPorcentaje = monto > 0 ? (interes / monto) * 100 : 0;

  return {
    valido: true,
    errores: [],
    // Inputs normalizados
    monto, moneda, tasa, modalidadTasa, fechaInicio, fechaFin,
    frecuenciaPago, tasaBCV,
    // Resultados
    diasTotales,
    interes,
    totalPagar,
    numeroCuotas,
    intervaloPago,
    diasPrimeraCuota,
    diasUltimaCuota,
    tieneCuotaRemanente,
    montoCuota,
    interesXCuota,
    cuotaInicial,
    cuotaFinal,
    // Moneda alterna
    monedaAlterna,
    interesAlterna,
    totalAlterna,
    cuotaAlterna,
    cuotaFinalAlterna,
    // Métricas
    tasaEfectivaDiaria,
    rendimientoPorcentaje,
  };
}

/**
 * Genera el cronograma de pagos detallado.
 * @param {Object} resultado  Salida de simularPrestamo()
 * @returns {Array<{cuota,fecha,diasPeriodo,capital,interes,total,saldo,totalAlterna}>}
 */
export function generarCronograma(resultado) {
  if (!resultado?.valido) return [];

  const {
    monto, interes, numeroCuotas, fechaInicio, fechaFin,
    frecuenciaPago, tasaBCV, moneda, monedaAlterna,
  } = resultado;

  const intervalo = DIAS_POR_FRECUENCIA[frecuenciaPago] ?? 1;
  const capitalBaseCuota = Number((monto / numeroCuotas).toFixed(2));
  const inicio = parseISO(fechaInicio);

  const cuotas = [];
  let saldo = monto;
  let capitalAcumulado = 0;
  let fechaAnterior = inicio;

  for (let i = 0; i < numeroCuotas; i++) {
    const esUltima = i === numeroCuotas - 1;
    // En la última cuota ajustamos centavos remanentes para que la suma del capital sea exacto
    const cap = esUltima ? Number((monto - capitalAcumulado).toFixed(2)) : capitalBaseCuota;
    capitalAcumulado += cap;

    const fechaCuota = esUltima
      ? parseISO(fechaFin)
      : addDays(inicio, (i + 1) * intervalo);
    const diasPeriodo = calcularDiasExactos(fechaAnterior, fechaCuota);
    const int = interes * (diasPeriodo / resultado.diasTotales);
    const tot = cap + int;
    saldo = esUltima ? 0 : Math.max(0, Number((saldo - cap).toFixed(2)));
    fechaAnterior = fechaCuota;

    cuotas.push({
      cuota:        i + 1,
      fecha:        format(fechaCuota, 'dd/MM/yyyy'),
      diasPeriodo:  diasPeriodo,
      capital:      cap,
      interes:      int,
      total:        tot,
      saldo:        saldo,
      totalAlterna: convertirMoneda(tot, tasaBCV, moneda, monedaAlterna),
    });
  }

  return cuotas;
}

// ─── Tests / Helpers de verificación ─────────────────────────────────────────

/**
 * Ejecuta assertions básicas en consola (modo desarrollo).
 * Llamar con: import { runTests } from './utils/calculator.js'; runTests();
 */
export function runTests() {
  const assert = (condicion, msg) => {
    if (!condicion) console.error(`❌ FAIL: ${msg}`);
    else            console.log( `✅ OK:   ${msg}`);
  };

  // Test 1: Días exactos
  assert(calcularDiasExactos('2024-01-01', '2024-01-31') === 30, 'Enero: 30 días');
  assert(calcularDiasExactos('2024-01-01', '2024-02-01') === 31, 'Enero completo: 31 días');
  assert(calcularDiasExactos('2024-01-15', '2024-01-15') === 0,  'Misma fecha: 0 días');

  // Test 2: Interés Simple Diario
  // 1000 USD × 5% diario × 30 días = 1500 USD interés
  assert(Math.abs(calcularInteresSimple(1000, 5, 'diaria', 30) - 1500) < 0.01, 'IS Diario: 1000×5%×30=1500');

  // Test 3: Interés Simple Semanal
  // 1000 USD × 10% semanal × (14/7) semanas = 200 USD
  assert(Math.abs(calcularInteresSimple(1000, 10, 'semanal', 14) - 200) < 0.01, 'IS Semanal: 1000×10%×2sem=200');

  // Test 4: Interés Simple Quincenal con base de 15 días
  // 1000 USD × 5% quincenal × (15/15) quincenas = 50 USD
  assert(Math.abs(calcularInteresSimple(1000, 5, 'quincenal', 15) - 50) < 0.01, 'IS Quincenal: 1000×5%×1quincena=50');

  // Test 5: Número de cuotas
  assert(calcularNumeroCuotas(30, 'semanal')   === 5,  '30 días, pago semanal → 5 cuotas');
  assert(calcularNumeroCuotas(30, 'quincenal') === 2,  '30 días, pago quincenal → 2 cuotas');
  assert(calcularNumeroCuotas(31, 'quincenal') === 3,  '31 días, pago quincenal → 3 cuotas');

  // Test 6: Conversión de moneda
  assert(convertirMoneda(100, 36.5, 'USD', 'VES') === 3650, 'USD→VES: 100×36.5=3650');
  assert(Math.abs(convertirMoneda(3650, 36.5, 'VES', 'USD') - 100) < 0.01, 'VES→USD: 3650/36.5=100');

  // Test 8: Cuota remanente con días exactos (ej: 37 días con pago quincenal -> cuotas: 15d, 15d, 7d remanentes)
  const simRemanente = simularPrestamo({
    monto: 1000, moneda: 'USD', tasa: 10, modalidadTasa: 'quincenal',
    fechaInicio: '2024-01-01', fechaFin: '2024-02-07', // 37 días
    frecuenciaPago: 'quincenal', tasaBCV: 36.5,
  });
  assert(simRemanente.diasTotales === 37, 'Sim Remanente: 37 días totales');
  assert(simRemanente.numeroCuotas === 3, 'Sim Remanente: 3 cuotas');
  assert(simRemanente.tieneCuotaRemanente === true, 'Sim Remanente: detecta cuota remanente');
  assert(simRemanente.diasUltimaCuota === 7, 'Sim Remanente: última cuota son 7 días exactos');

  const crono = generarCronograma(simRemanente);
  assert(crono[0].diasPeriodo === 15, 'Cronograma C1: 15 días');
  assert(crono[1].diasPeriodo === 15, 'Cronograma C2: 15 días');
  assert(crono[2].diasPeriodo === 7,  'Cronograma C3: 7 días exactos');
  assert(Math.abs(crono[2].interes - 46.67) < 0.1, `Cronograma C3 Interés exacto (7d): got ${crono[2].interes.toFixed(2)}`);

  console.log('— Tests completados —');
}
