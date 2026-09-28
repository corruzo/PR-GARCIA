export const MAX_PERSON_NAME_LENGTH = 120;

export function normalizePlainText(value, maxLength = MAX_PERSON_NAME_LENGTH) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}