/**
 * quoteMessage.js — Texto de la cotización para enviar por WhatsApp.
 * Los montos van solo en la moneda del préstamo; la nota de pago explica que
 * se usa la tasa BCV del día del pago y qué se puede pagar en bolívares.
 */
import { paymentTermsNote } from '../../shared/finance/report.js';
import { toDisplayDate } from '../../shared/finance/dates.js';
import { formatearMoneda } from './calculator.js';
import { MODALIDADES_TASA, PERIODO, cuotasTexto } from '../../shared/catalogos.js';

/** Cuotas que se listan una por una; con más, se resume el resto (WhatsApp corta los enlaces largos). */
const MAX_CUOTAS_LISTADAS = 12;

const MODALIDAD = Object.fromEntries(Object.entries(MODALIDADES_TASA).map(([k, v]) => [k, v.toLowerCase()]));

function formatPercent(value) {
  return `${Number(value).toLocaleString('es-VE', { maximumFractionDigits: 6 })} %`;
}

/**
 * @param {object} params
 * @param {object} params.resultado   Salida de simularPrestamo()
 * @param {Array}  params.cronograma  Salida de generarCronograma() (préstamos con fecha)
 * @param {string} params.fechaHoy    'dd/MM/yyyy'
 */
export function buildQuoteMessage({ resultado, cronograma = [], fechaHoy }) {
  const { moneda } = resultado;
  const fmt = (v) => formatearMoneda(v, moneda);
  const tasa = `${formatPercent(resultado.tasa)} ${MODALIDAD[resultado.modalidadTasa] ?? ''}`.trim();
  const lines = ['Hola, estas son las condiciones del préstamo:', ''];

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
    const linea = (c) => `• Cuota ${c.cuota} (${c.fecha}): ${fmt(c.total)}`;
    const cuotas = cronograma.length <= MAX_CUOTAS_LISTADAS
      ? cronograma.map(linea)
      : [...cronograma.slice(0, MAX_CUOTAS_LISTADAS - 2).map(linea),
        `• … ${cronograma.length - MAX_CUOTAS_LISTADAS + 1} cuotas más`, linea(cronograma.at(-1))];
    lines.push(
      `• Monto: ${fmt(resultado.monto)}`,
      `• Tasa: ${tasa}`,
      `• Plazo: ${resultado.diasTotales} días, ${cuotasTexto(resultado.numeroCuotas, resultado.frecuenciaPago)}`,
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
