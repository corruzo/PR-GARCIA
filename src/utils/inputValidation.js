export const MAX_PERSON_NAME_LENGTH = 120;

export function normalizePlainText(value, maxLength = MAX_PERSON_NAME_LENGTH) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}
export const MIN_PASSWORD_LENGTH = 8;

/** Devuelve el problema de una contraseña nueva, o '' si es aceptable. */
export function passwordIssue(password) {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(value) || !/[0-9]/.test(value)) return 'La contraseña debe combinar letras y números.';
  return '';
}
