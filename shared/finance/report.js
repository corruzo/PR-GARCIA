/**
 * report.js — Utilidades de presentación de cartera y cobranza (puras).
 */

import { fromCents } from './money.js';
import { toDisplayDate } from './dates.js';

const SYMBOL = { USD: '$', VES: 'Bs.' };

export function formatCents(cents, currency = 'USD') {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return '—';
  const formatted = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(fromCents(Number(cents)));
  return `${SYMBOL[currency] ?? ''} ${formatted}`.trim();
}

export const AGING_LABELS = Object.freeze({
  '0_al_dia': 'Al día',
  '1_1_30': '1 a 30 días',
  '2_31_60': '31 a 60 días',
  '3_61_90': '61 a 90 días',
  '4_mas_90': 'Más de 90 días',
});

/** Tramo de atraso para un número de días. */
export function agingBucket(days) {
  if (!days || days <= 0) return '0_al_dia';
  if (days <= 30) return '1_1_30';
  if (days <= 60) return '2_31_60';
  if (days <= 90) return '3_61_90';
  return '4_mas_90';
}

/** Teléfono venezolano a formato internacional para wa.me (o null). */
export function toWhatsAppNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('58') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `58${digits.slice(1)}`;
  if (digits.length === 10) return `58${digits}`;
  return digits.length >= 8 ? digits : null;
}

/**
 * Condiciones de pago para los mensajes al cliente.
 * Los montos se expresan en la moneda del préstamo; los pagos usan la tasa
 * oficial del dólar (BCV) vigente el día en que se pagan.
 */
export function paymentTermsNote(currency) {
  const base = 'Los pagos se calculan con la tasa oficial del dólar (BCV) vigente el día del pago.';
  return currency === 'USD'
    ? `${base} Los intereses puedes pagarlos en bolívares a esa tasa; el capital se paga únicamente en dólares.`
    : `${base} Puedes pagar en bolívares o en dólares.`;
}

/** Mensaje de recordatorio de cobro (texto plano para compartir). */
export function buildPaymentReminder({ clienteNombre, numero, moneda, exigibleCents, moraCents = 0, proximoVencimiento, diasAtraso = 0 }) {
  const lines = [`Hola ${clienteNombre || ''}`.trim() + ',', ''];
  if (diasAtraso > 0) {
    lines.push(`Tu préstamo #${numero} tiene ${diasAtraso} día(s) de atraso.`);
    lines.push(`Monto pendiente a la fecha: ${formatCents(exigibleCents, moneda)}${moraCents > 0 ? ` (incluye ${formatCents(moraCents, moneda)} de mora)` : ''}.`);
  } else if (proximoVencimiento) {
    lines.push(`Te recordamos que tu préstamo #${numero} tiene una cuota con vencimiento el ${toDisplayDate(proximoVencimiento)}.`);
    if (exigibleCents > 0) lines.push(`Monto: ${formatCents(exigibleCents, moneda)}.`);
  }
  lines.push('', paymentTermsNote(moneda), '', 'Gracias. — PRGARCÍA');
  return lines.join('\n');
}

/**
 * Serializa filas a CSV (separador ';' para Excel en español) y neutraliza
 * celdas que empiezan con = + - @ para evitar inyección de fórmulas.
 */
export function toCSV(columns, rows) {
  const escape = (value) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((c) => escape(c.label)).join(';');
  const body = rows.map((row) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(';'));
  return `﻿${[header, ...body].join('\r\n')}`;
}

/** Centavos → texto decimal con coma para CSV ("1234,56"). */
export function centsToCSV(cents) {
  if (cents === null || cents === undefined) return '';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  return `${negative ? '-' : ''}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}
