/** Configuración pública de la app (variables VITE_* definidas al compilar). */

const email = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim();

/** Correo de contacto del pie de página; vacío = el enlace no se muestra. */
export const CONTACT_EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) ? email : '';
