/**
 * AuthContext.jsx — Proveedor global de autenticación para PRGARCIA.
 *
 * BLINDAJE TOTAL:
 *  - Supabase es la ÚNICA fuente de autenticación.
 *  - NO existe fallback a localStorage para login ni registro.
 *  - Sin cuenta en Supabase = sin acceso. Punto.
 *  - El draftformulario del usuario sí se guarda en localStorage
 *    (es solo data local de conveniencia, no auth).
 *
 * Sistema multicuenta:
 *  - Cualquier persona puede crear su cuenta desde la app (email + password).
 *  - Cada usuario ve solo sus propios datos.
 *  - onAuthStateChange escucha cambios en tiempo real (logout en otra pestaña, etc.)
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';

// ─── Contexto ─────────────────────────────────────────────────────────────────

const AuthContext = createContext({
  user:             null,
  loading:          true,
  supabaseReady:    false,
  isAuthModalOpen:  false,
  authModalTab:     'login',
  openAuthModal:    () => {},
  closeAuthModal:   () => {},
  login:            async () => {},
  register:         async () => {},
  logout:           async () => {},
});

// ─── Helper: mapear usuario de Supabase al formato interno ────────────────────

function mapSupabaseUser(sbUser) {
  return {
    id:        sbUser.id,
    email:     sbUser.email,
    name:      sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
    avatarUrl: sbUser.user_metadata?.avatar_url || null,
    createdAt: sbUser.created_at,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser]                       = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab]       = useState('login');

  // ── Inicialización de sesión ──────────────────────────────────────────────

  useEffect(() => {
    if (!supabase) {
      // Supabase no configurado (variables de entorno ausentes).
      // La app arrancará pero NADIE podrá autenticarse.
      console.error(
        '[PRGARCIA Auth] ¡Supabase no está configurado!\n' +
        'Agrega VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel.'
      );
      setLoading(false);
      return;
    }

    // Obtener sesión activa al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    // Listener para cambios de sesión en tiempo real:
    // LOGIN, LOGOUT, TOKEN_REFRESHED, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      // No cambiamos loading aquí — ya fue seteado arriba
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Modal ─────────────────────────────────────────────────────────────────

  const openAuthModal  = (tab = 'login') => { setAuthModalTab(tab); setIsAuthModalOpen(true); };
  const closeAuthModal = () => setIsAuthModalOpen(false);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = async (email, password) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible. Contacta al administrador.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Traducir errores comunes de Supabase al español
      const msg = translateSupabaseError(error.message);
      throw new Error(msg);
    }

    // onAuthStateChange actualizará el estado automáticamente
    closeAuthModal();
    return mapSupabaseUser(data.user);
  };

  // ── Registro ──────────────────────────────────────────────────────────────

  const register = async (name, email, password) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible. Contacta al administrador.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });

    if (error) {
      const msg = translateSupabaseError(error.message);
      throw new Error(msg);
    }

    // Si Supabase requiere confirmación de email, data.user existirá pero
    // data.session será null. Lo manejamos:
    if (data.user && !data.session) {
      // Usuario creado pero pendiente de confirmar email
      throw new Error(
        '✉️ Cuenta creada. Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.'
      );
    }

    closeAuthModal();
    return data.user ? mapSupabaseUser(data.user) : null;
  };

  // ── Recuperación de Contraseña & OTP ──────────────────────────────────────

  const resetPasswordForEmail = async (email) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible. Contacta al administrador.');
    }

    // Usar signInWithOtp con shouldCreateUser: false
    // Si el correo NO existe en la base de datos de Supabase, devolverá un error impidiendo el envío.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      const msg = translateSupabaseError(error.message);
      throw new Error(msg);
    }

    return true;
  };

  const verifyOtpAndSetPassword = async (email, token, newPassword) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible. Contacta al administrador.');
    }

    // 1. Verificar OTP token (tipo 'email' o fallback 'recovery')
    let verifyRes = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (verifyRes.error) {
      verifyRes = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });
    }

    if (verifyRes.error) {
      const msg = translateSupabaseError(verifyRes.error.message);
      throw new Error(msg);
    }

    // 2. Si hay nueva contraseña, actualizarla en Supabase
    if (newPassword) {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        const msg = translateSupabaseError(updateError.message);
        throw new Error(msg);
      }
    }

    closeAuthModal();
    return verifyRes.data?.user ? mapSupabaseUser(verifyRes.data.user) : null;
  };

  const updatePassword = async (newPassword) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible.');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      const msg = translateSupabaseError(error.message);
      throw new Error(msg);
    }

    return true;
  };

  const updateProfile = async (name) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible.');
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    if (error) {
      const msg = translateSupabaseError(error.message);
      throw new Error(msg);
    }

    if (data?.user) {
      setUser(mapSupabaseUser(data.user));
    }

    return true;
  };

  // ── Login Social (Google / Apple) ──────────────────────────────────────────

  const loginWithProvider = async (provider) => {
    if (!supabase) {
      throw new Error('El sistema de autenticación no está disponible. Contacta al administrador.');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider.toLowerCase(),
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      const msg = translateSupabaseError(error.message);
      throw new Error(msg);
    }

    return data;
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      // onAuthStateChange → SIGNED_OUT → setUser(null) automáticamente
    }
    setUser(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        supabaseReady:  Boolean(supabase),
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        loginWithProvider,
        resetPasswordForEmail,
        verifyOtpAndSetPassword,
        updatePassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Utilidad: traducción de errores de Supabase ──────────────────────────────

function translateSupabaseError(message = '') {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';

  if (
    m.includes('signups not allowed') ||
    m.includes('signup is disabled') ||
    m.includes('user not found') ||
    m.includes('email not found') ||
    m.includes('unable to find') ||
    m.includes('no user') ||
    m.includes('not registered')
  )
    return 'No existe ninguna cuenta registrada con este correo electrónico. Verifica la dirección o regístrate.';

  if (m.includes('token has expired') || m.includes('otp has expired'))
    return 'El código de 6 dígitos ha expirado. Solicita un nuevo código.';

  if (m.includes('invalid token') || m.includes('invalid otp') || m.includes('token is invalid'))
    return 'El código de 6 dígitos ingresado es incorrecto.';

  if (m.includes('email not confirmed'))
    return 'Tu cuenta aún no ha sido confirmada. Revisa tu correo electrónico.';

  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Este correo ya tiene una cuenta registrada. Intenta iniciar sesión.';

  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.';

  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Demasiados intentos. Espera un momento antes de intentar de nuevo.';

  if (m.includes('network') || m.includes('fetch'))
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.';

  if (m.includes('signup is disabled'))
    return 'El registro de nuevas cuentas está deshabilitado. Contacta al administrador.';

  // Devolver el mensaje original si no hay traducción
  return message;
}
