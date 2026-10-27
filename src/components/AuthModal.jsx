import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Mail, Lock, X, LogIn, UserPlus, AlertCircle, Eye, EyeOff, CheckCircle, ShieldAlert, ArrowLeft, Smartphone } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { OtpInput } from './auth/OtpInput';
import { SocialLogin } from './auth/SocialLogin';
import { MAX_PERSON_NAME_LENGTH, normalizePlainText, passwordIssue } from '../utils/inputValidation';

/** Modal de acceso. Se monta al abrirse, así cada apertura empieza con el formulario limpio. */
export function AuthModal() {
  const { isAuthModalOpen, authModalTab } = useAuth();
  return isAuthModalOpen ? <AuthModalContent key={authModalTab} /> : null;
}

function AuthModalContent() {
  const { closeAuthModal, authModalTab, login, register, resetPasswordForEmail, verifyOtpAndSetPassword, loginWithProvider, supabaseReady } = useAuth();

  // Tabs: 'login' | 'register' | 'forgot' | 'otp'
  const [tab, setTab]                   = useState(authModalTab);
  const [name, setName]                 = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [cargando, setCargando]         = useState(false);
  // El código de 6 dígitos sirve para confirmar el registro o para recuperar la contraseña.
  const [otpPurpose, setOtpPurpose]     = useState('recovery');

  // State for OTP Code boxes (6 digits)
  const [otpDigits, setOtpDigits]       = useState(['', '', '', '', '', '']);

  const emailInputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (tab !== 'otp') {
      // No roba el foco si la persona ya está escribiendo en otro campo del modal.
      const timer = setTimeout(() => {
        if (!dialogRef.current?.contains(document.activeElement)) emailInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [tab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (tab === 'otp') {
      const code = otpDigits.join('');
      if (code.length < 6) {
        setError('Ingresa el código completo de 6 dígitos.');
        return;
      }
      const recovery = otpPurpose === 'recovery';
      if (recovery && passwordIssue(password)) {
        setError(passwordIssue(password));
        return;
      }
      setCargando(true);
      try {
        await verifyOtpAndSetPassword(email, code, recovery ? password : null);
        setSuccess(recovery ? '¡Contraseña restablecida e inicio de sesión correcto!' : '¡Cuenta confirmada!');
      } catch (err) {
        setError(err?.message || 'Código de verificación inválido o expirado.');
      } finally {
        setCargando(false);
      }
      return;
    }

    if (tab === 'forgot') {
      if (!email.trim() || !email.includes('@')) {
        setError('Ingresa un correo electrónico válido.');
        return;
      }
      setCargando(true);
      try {
        await resetPasswordForEmail(email);
        setSuccess(`Si ${email} está asociado a una cuenta, recibirás instrucciones. Revisa tu bandeja o spam.`);
        setOtpPurpose('recovery');
        setPassword('');
        setTab('otp');
      } catch (err) {
        setError(err?.message || 'No se pudo verificar el correo electrónico.');
      } finally {
        setCargando(false);
      }
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!password || (tab === 'register' && passwordIssue(password))) {
      setError(tab === 'register' ? passwordIssue(password) : 'Ingresa tu contraseña.');
      return;
    }
    if (tab === 'register' && !name.trim()) {
      setError('Por favor ingresa tu nombre completo.');
      return;
    }

    setCargando(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      const msg = err?.message || 'Ocurrió un error al procesar la solicitud.';
      if (msg.startsWith('✉️')) {
        setSuccess(msg.replace('✉️ ', ''));
        setOtpPurpose('signup');
        setTab('otp');
      } else {
        setError(msg);
      }
    } finally {
      setCargando(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setError('');
    setSuccess('');
    setCargando(true);
    try {
      await loginWithProvider(provider);
    } catch (err) {
      setError(err?.message || `No se pudo iniciar sesión con ${provider}.`);
    } finally {
      setCargando(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 overlay-safe backdrop-blur-sm animate-fade-in"
      role="presentation"
      onClick={closeAuthModal}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-saas-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Modal */}
        <header className="relative flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            {tab === 'forgot' || tab === 'otp' ? (
              <button
                type="button"
                onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors mr-1"
                title="Volver"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm shadow-brand-500/30">
                {tab === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              </div>
            )}
            <div>
              <h2 id="auth-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                {tab === 'login' && 'Iniciar Sesión'}
                {tab === 'register' && 'Crear Cuenta'}
                {tab === 'forgot' && 'Recuperar Contraseña'}
                {tab === 'otp' && (otpPurpose === 'signup' ? 'Confirma tu correo' : 'Nueva contraseña')}
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">PRGARCÍA · Gestión de préstamos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Supabase status warning if unconfigured */}
        {!supabaseReady && (
          <div className="mx-6 mt-4 flex items-start gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
            <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Modo Demostración Local (Supabase no conectado).
            </p>
          </div>
        )}

        {/* Tab Switcher (Solo para Login y Registro) */}
        {(tab === 'login' || tab === 'register') && (
          <div className="grid grid-cols-2 p-1.5 mx-6 mt-5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                tab === 'login'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                tab === 'register'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Registrarse
            </button>
          </div>
        )}

        {/* Form Content */}
        <form key={tab} onSubmit={handleSubmit} className="p-6 space-y-4 animate-fade-in">

          {/* Feedback messages */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 animate-fade-in">
              <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 animate-fade-in">
              <CheckCircle size={15} className="text-brand-500 mt-0.5 shrink-0" />
              <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{success}</span>
            </div>
          )}

          {/* OTP Code Box Grid */}
          {tab === 'otp' && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <Smartphone className="mx-auto text-brand-500 mb-2" size={28} />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Ingresa el código de 6 dígitos que enviamos a {email || 'tu correo'}.
                </p>
              </div>

              <OtpInput digits={otpDigits} onChange={setOtpDigits} />
            </div>
          )}

          {/* Forgot Password instruction */}
          {tab === 'forgot' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Ingresa el correo asociado a tu cuenta para enviarte las instrucciones de restablecimiento.
            </p>
          )}

          {/* Register Name input */}
          {tab === 'register' && (
            <div>
              <label htmlFor="auth-name" className="label-base">Nombre completo</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-name"
                  type="text"
                  maxLength={MAX_PERSON_NAME_LENGTH}
                  placeholder="Ej: María González"
                  value={name}
                  onChange={(e) => setName(normalizePlainText(e.target.value))}
                  disabled={cargando}
                  className="input-base pl-11"
                />
              </div>
            </div>
          )}

          {/* Email input (login, register, forgot) */}
          {tab !== 'otp' && (
            <div>
              <label htmlFor="auth-email" className="label-base">Correo electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  ref={emailInputRef}
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={cargando}
                  className="input-base pl-11"
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {/* Contraseña (login, register, otp) */}
          {(tab === 'login' || tab === 'register' || (tab === 'otp' && otpPurpose === 'recovery')) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="label-base mb-0">
                  {tab === 'otp' ? 'Nueva Contraseña' : 'Contraseña'}
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setError(''); setSuccess(''); }}
                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tab === 'otp' ? 'Ingresa tu nueva contraseña' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={cargando}
                  className="input-base pl-11 pr-11"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {tab === 'register' && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Tu contraseña se guarda protegida. Nunca te la pediremos por correo.</p>
              )}
            </div>
          )}

          {/* Submit CTA Button */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-sm font-bold text-white shadow-sm hover:shadow-md hover:shadow-brand-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {cargando ? (
              <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                {tab === 'login' && 'Entrar'}
                {tab === 'register' && 'Crear mi cuenta'}
                {tab === 'forgot' && 'Enviar Código de Recuperación'}
                {tab === 'otp' && 'Verificar Código'}
              </>
            )}
          </button>

          {(tab === 'login' || tab === 'register') && <SocialLogin disabled={cargando} onLogin={handleSocialLogin} />}

        </form>
      </section>
    </div>,
    document.body,
  );
}
