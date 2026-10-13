/**
 * input.js — Lectura y validación de datos escritos por el usuario.
 * Todo lo que llega aquí se valida también en la base de datos; esto solo
 * permite dar errores claros antes de enviar.
 */

import { toCents, toRateUnits } from './money.js';

/**
 * Convierte texto de monto ("1.234,56", "1234.56", "1 234") en centavos.
 * @returns {number|null} centavos, o null si el texto no es un monto válido.
 */
export function parseAmountInput(text) {
  let value = String(text ?? '').replace(/[\s$]|Bs\.?/gi, '');
  if (!value || /[^0-9.,]/.test(value)) return null;
  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  const decimalAt = Math.max(lastDot, lastComma);
  if (decimalAt >= 0) {
    const decimals = value.slice(decimalAt + 1);
    const integer = value.slice(0, decimalAt);
    const separator = value[decimalAt];
    // "1.234" o "1,234" con un solo separador y 3 dígitos se lee como miles.
    const isThousands = decimals.length === 3 && !integer.includes(separator === '.' ? ',' : '.')
      && value.split(separator).length === 2 && integer.length <= 3 && integer.length > 0;
    value = isThousands
      ? integer + decimals
      : `${integer.replace(/[.,]/g, '')}.${decimals}`;
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  try {
    return toCents(value);
  } catch {
    return null;
  }
}

/** Lee una tasa (interés o cambio) con hasta 8 decimales. */
export function parseRateInput(text) {
  const value = String(text ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  if (toRateUnits(value) <= 0n) return null;
  const [int, dec = ''] = value.split('.');
  return Number(`${int}.${dec.slice(0, 8)}`);
}

export const DOCUMENT_TYPES = Object.freeze({
  V: 'Venezolano (V)',
  E: 'Extranjero (E)',
  J: 'Jurídico (J)',
  G: 'Gubernamental (G)',
  P: 'Pasaporte (P)',
});

const UNSAFE = /[<>]/;

function optionalText(value, max, label, errors) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length > max || UNSAFE.test(text)) {
    errors[label] = `Máximo ${max} caracteres, sin < ni >.`;
  }
  return text;
}

/**
 * Valida y normaliza un cliente con las mismas reglas que la tabla `clientes`.
 * @returns {{ ok: boolean, value: object, errors: Record<string,string> }}
 */
export function validateCliente(input) {
  const errors = {};
  const tipo = String(input?.tipo_documento ?? 'V').toUpperCase();
  const numero = String(input?.numero_documento ?? '').toUpperCase().replace(/[\s.-]/g, '');
  const nombre = String(input?.nombre ?? '').trim().replace(/\s+/g, ' ');
  const telefono = String(input?.telefono ?? '').trim();
  const email = String(input?.email ?? '').trim();

  if (!(tipo in DOCUMENT_TYPES)) errors.tipo_documento = 'Selecciona el tipo de documento.';
  if (numero && !/^[0-9A-Z]{4,20}$/.test(numero)) errors.numero_documento = 'Entre 4 y 20 dígitos o letras.';
  if (nombre.length < 2 || nombre.length > 120 || UNSAFE.test(nombre)) errors.nombre = 'Entre 2 y 120 caracteres, sin < ni >.';
  if (telefono && !/^\+?[0-9 ()-]{7,20}$/.test(telefono)) errors.telefono = 'Usa solo dígitos, espacios, guiones o paréntesis.';
  if (email && (email.length > 254 || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email))) errors.email = 'Correo no válido.';

  let limite = null;
  if (String(input?.limite_credito ?? '').trim()) {
    limite = parseAmountInput(input.limite_credito);
    if (limite === null) errors.limite_credito = 'Monto no válido.';
  }

  const value = {
    tipo_documento: tipo,
    numero_documento: numero || null,
    nombre,
    telefono: telefono || null,
    email: email || null,
    direccion: optionalText(input?.direccion, 300, 'direccion', errors),
    referencia: optionalText(input?.referencia, 300, 'referencia', errors),
    notas: optionalText(input?.notas, 1000, 'notas', errors),
    limite_credito_cents: limite,
    moneda_limite: input?.moneda_limite === 'VES' ? 'VES' : 'USD',
  };
  return { ok: Object.keys(errors).length === 0, value, errors };
}
