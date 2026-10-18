/** Traduce los mensajes de Supabase Auth a textos para la persona, sin revelar si un correo tiene cuenta. */
export function translateSupabaseError(message = '') {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';

  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'El registro de nuevas cuentas está deshabilitado. Contacta al administrador.';

  // Mensajes genéricos: no revelan si un correo tiene cuenta.
  if (
    m.includes('user not found') ||
    m.includes('email not found') ||
    m.includes('unable to find') ||
    m.includes('no user') ||
    m.includes('not registered')
  )
    return 'No se pudo completar la operación con esos datos. Verifica el correo e inténtalo de nuevo.';

  if (m.includes('token has expired') || m.includes('otp has expired'))
    return 'El código de 6 dígitos ha expirado. Solicita un nuevo código.';

  if (m.includes('invalid token') || m.includes('invalid otp') || m.includes('token is invalid'))
    return 'El código de 6 dígitos ingresado es incorrecto.';

  if (m.includes('email not confirmed'))
    return 'Tu cuenta aún no ha sido confirmada. Revisa tu correo electrónico.';

  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'No se pudo crear la cuenta. Si ya tienes una, inicia sesión o recupera tu contraseña.';

  if (m.includes('password should be at least') || m.includes('weak password') || m.includes('password should contain'))
    return 'La contraseña es muy débil: usa al menos 8 caracteres con letras y números.';

  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Demasiados intentos. Espera un momento antes de intentar de nuevo.';

  if (m.includes('network') || m.includes('fetch'))
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.';

  // Devolver el mensaje original si no hay traducción
  return message;
}
