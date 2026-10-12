/**
 * quoteMessage.js — Texto de la cotización para enviar por WhatsApp.
 * Los montos van solo en la moneda del préstamo; la nota de pago explica que
 * se usa la tasa BCV del día del pago y qué se puede pagar en bolívares.
 */
import { paymentTermsNote } from '../../shared/finance/report.js';
import { toDisplayDate } from '../../shared/finance/dates.js';
import { formatearMoneda } from './calculator.js';
import { normalizePlainText } from './inputValidation.js';

const MODALIDAD = { diaria: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' };
const PERIODO = { diario: 'día', semanal: 'semana', quincenal: 'quincena', mensual: 'mes' };
const FRECUENCIA_PLURAL = { diario: 'diarias', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' };

function formatPercent(value) {
  return `${Number(value).toLocaleString('es-VE', { maximumFractionDigits: 6 })} %`;
}

/**
 * @param {object} params
 * @param {object} params.resultado   Salida de simularPrestamo()
 * @param {Array}  params.cronograma  Salida de generarCronograma() (préstamos con fecha)
 * @param {string} params.nombreCliente
 * @param {string} params.fechaHoy    'dd/MM/yyyy'
 */
export function buildQuoteMessage({ resultado, cronograma = [], nombreCliente = '', fechaHoy }) {
  const { moneda } = resultado;
  const fmt = (v) => formatearMoneda(v, moneda);
  const nombre = normalizePlainText(nombreCliente).trim() || 'estimado cliente';
  const tasa = `${formatPercent(resultado.tasa)} ${MODALIDAD[resultado.modalidadTasa] ?? ''}`.trim();
  const lines = [`Hola ${nombre}, estas son las condiciones de tu préstamo:`, ''];

  if (resultado.abierto) {
    const periodo = PERIODO[resultado.frecuenciaPago] ?? 'período';
    lines.push(
      `• Monto: ${fmt(resultado.monto)}`,
      `• Interés: ${tasa} sobre el capital que debas`,
      `• Intereses por ${periodo}: ${fmt(resultado.interesPeriodo)} mientras debas ${fmt(resultado.monto)}`,
      `• Primer pago de intereses: ${toDisplayDate(resultado.primerVencimiento)}`,
      '',
      `Sin fecha de fin: pagas los intereses cada ${periodo} y abonas al capital cuando puedas. Cada abono reduce los intereses desde el día en que lo haces.`,
    );
  } else {
    const cuotas = cronograma.map((c) => `• Cuota ${c.cuota} (${c.fecha}): ${fmt(c.total)}`);
    lines.push(
      `• Monto: ${fmt(resultado.monto)}`,
      `• Tasa: ${tasa}`,
      `• Plazo: ${resultado.diasTotales} días, ${resultado.numeroCuotas} cuota(s) ${FRECUENCIA_PLURAL[resultado.frecuenciaPago] ?? ''}`.trim(),
      `• Intereses: ${fmt(resultado.interes)}`,
      `• Total a pagar: ${fmt(resultado.totalPagar)}`,
      '',
      '*Cuotas:*',
      ...cuotas,
    );
  }

  lines.push('', paymentTermsNote(moneda), '', `Fecha: ${fechaHoy}`, '— PRGARCÍA');
  return lines.join('\n');
}
