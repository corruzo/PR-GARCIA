import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Mail, Lock, X, LogIn, UserPlus, AlertCircle, Eye, EyeOff, CheckCircle, ShieldAlert, KeyRound, ArrowLeft, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalTab, login, register, resetPasswordForEmail, verifyOtpAndSetPassword, loginWithProvider, supabaseReady } = useAuth();
  
  // Tabs: 'login' | 'register' | 'forgot' | 'otp'
  const [tab, setTab]                   = useState(authModalTab);
  const [name, setName]                 = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [cargando, setCargando]         = useState(false);

  // State for OTP Code boxes (6 digits)
  const [otpDigits, setOtpDigits]       = useState(['', '', '', '', '', '']);
  const otpRefs                         = useRef([]);

  const emailInputRef = useRef(null);

  useEffect(() => {
    setTab(authModalTab);
    setError('');
    setSuccess('');
    setOtpDigits(['', '', '', '', '', '']);
  }, [authModalTab, isAuthModalOpen]);

  useEffect(() => {
    if (isAuthModalOpen && tab !== 'otp') {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [isAuthModalOpen, tab]);

  if (!isAuthModalOpen) return null;

  // Handle OTP digit changes
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    // Auto-advance focus to next box
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

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
      if (!password || password.length < 6) {
        setError('Ingresa tu nueva contraseña (mínimo 6 caracteres).');
        return;
      }
      setCargando(true);
      try {
        await verifyOtpAndSetPassword(email, code, password);
        setSuccess('¡Contraseña restablecida e inicio de sesión correcto!');
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
        setSuccess(`Código de verificación enviado a ${email}. Revisa tu bandeja o spam.`);
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
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onClick={closeAuthModal}
    >
      <section
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-esmeralda text-white shadow-sm shadow-brand-500/30">
                {tab === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              </div>
            )}
            <div>
              <h2 id="auth-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                {tab === 'login' && 'Iniciar Sesión'}
                {tab === 'register' && 'Crear Cuenta'}
                {tab === 'forgot' && 'Recuperar Contraseña'}
                {tab === 'otp' && 'Verificación OTP'}
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">PRGARCÍA · Calculadora</p>
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
                  Ingresa el código de 6 dígitos que enviamos a tu dispositivo.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 my-4">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-xl font-bold font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-xs"
                  />
                ))}
              </div>
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
              <label className="label-base">Nombre completo</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej: María González"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={cargando}
                  className="input-base pl-11"
                />
              </div>
            </div>
          )}

          {/* Email input (login, register, forgot) */}
          {tab !== 'otp' && (
            <div>
              <label className="label-base">Correo electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
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
          {(tab === 'login' || tab === 'register' || tab === 'otp') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label-base mb-0">
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Submit CTA Button */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-sm font-bold text-white shadow-sm hover:shadow-md hover:shadow-brand-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {cargando ? (
              <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                {tab === 'login' && 'Entrar a la Calculadora'}
                {tab === 'register' && 'Crear mi cuenta'}
                {tab === 'forgot' && 'Enviar Código de Recuperación'}
                {tab === 'otp' && 'Verificar Código'}
              </>
            )}
          </button>

          {/* Social Logins (Google & Apple) for Login/Register */}
          {(tab === 'login' || tab === 'register') && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
              <div className="relative text-center my-2">
                <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 relative z-10">
                  O continuar con
                </span>
                <div className="absolute inset-y-1/2 inset-x-0 border-t border-slate-100 dark:border-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('Google')}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-all active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialLogin('Apple')}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-all active:scale-[0.98]"
                >
                  <svg className="w-4 h-4 fill-current text-slate-900 dark:text-white" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.36c.64-.78 1.08-1.85.96-2.92-.93.04-2.06.62-2.73 1.4-.59.69-1.11 1.79-.97 2.85 1.05.08 2.1-.55 2.74-1.33z"/>
                  </svg>
                  <span>Apple</span>
                </button>
              </div>
            </div>
          )}

        </form>
      </section>
    </div>,
    document.body,
  );
}
