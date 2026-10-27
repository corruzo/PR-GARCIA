import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Calendar, ShieldCheck, LogOut, X, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { MAX_PERSON_NAME_LENGTH, normalizePlainText, passwordIssue } from '../utils/inputValidation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ProfileModal({ open, onClose }) {
  const { user, logout, updatePassword, updateProfile } = useAuth();
  
  const [showNameForm, setShowNameForm]         = useState(false);
  const [newName, setNewName]                   = useState('');
  const [loadingName, setLoadingName]           = useState(false);
  const [nameError, setNameError]               = useState('');
  const [nameSuccess, setNameSuccess]           = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showPass, setShowPass]                 = useState(false);
  const [loadingPass, setLoadingPass]           = useState(false);
  const [passError, setPassError]               = useState('');
  const [passSuccess, setPassSuccess]           = useState('');

  if (!open || !user) return null;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleOpenNameForm = () => {
    setNewName(user?.name || '');
    setNameError('');
    setNameSuccess('');
    setShowNameForm(true);
  };

  const handleChangeName = async (e) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!newName.trim()) {
      setNameError('El nombre no puede estar vacío.');
      return;
    }

    setLoadingName(true);
    try {
      await updateProfile(newName.trim());
      setNameSuccess('¡Nombre actualizado exitosamente!');
      setTimeout(() => {
        setNameSuccess('');
        setShowNameForm(false);
      }, 1500);
    } catch (err) {
      setNameError(err?.message || 'No se pudo actualizar el nombre.');
    } finally {
      setLoadingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (user.hasPassword && !currentPassword) {
      setPassError('Ingresa tu contraseña actual.');
      return;
    }
    const passwordProblem = passwordIssue(newPassword);
    if (passwordProblem) {
      setPassError(passwordProblem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Las contraseñas no coinciden.');
      return;
    }

    setLoadingPass(true);
    try {
      await updatePassword(newPassword, currentPassword);
      setPassSuccess('¡Contraseña actualizada exitosamente!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPassSuccess('');
        setShowPasswordForm(false);
      }, 2000);
    } catch (err) {
      setPassError(err?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setLoadingPass(false);
    }
  };

  const fechaRegistro = user.createdAt
    ? format(new Date(user.createdAt), "d 'de' MMMM, yyyy", { locale: es })
    : 'Cuenta Activa';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overlay-safe backdrop-blur-sm animate-fade-in"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-saas-modal max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <header className="relative flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-brand-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 font-extrabold text-xl backdrop-blur">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 id="profile-title" className="text-base font-extrabold leading-tight">
                {user.name}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-100">
                <ShieldCheck size={12} /> Usuario Registrado
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar perfil"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Detalles del Perfil */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 p-4 border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <Mail size={16} className="text-brand-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Correo Electrónico</span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">{user.email}</span>
              </div>
            </div>

            <div className="border-t border-slate-200/60 dark:border-slate-800 pt-2.5 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <Calendar size={16} className="text-brand-500 shrink-0" />
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Miembro desde</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{fechaRegistro}</span>
              </div>
            </div>
          </div>

          {/* Sección Cambiar Nombre */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {!showNameForm ? (
              <button
                type="button"
                onClick={handleOpenNameForm}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-bold transition-all shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <User size={15} className="text-brand-500" />
                  <span>Cambiar Nombre de Usuario</span>
                </div>
                <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold">Editar →</span>
              </button>
            ) : (
              <form onSubmit={handleChangeName} className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User size={14} className="text-brand-500" /> Cambiar Nombre
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNameForm(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                  >
                    Cancelar
                  </button>
                </div>

                {nameError && (
                  <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle size={14} className="shrink-0 text-red-500" />
                    <span>{nameError}</span>
                  </div>
                )}

                {nameSuccess && (
                  <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 text-xs text-brand-700 dark:text-brand-300">
                    <CheckCircle size={14} className="shrink-0 text-brand-500" />
                    <span>{nameSuccess}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="profile-new-name" className="label-base">Nuevo Nombre</label>
                  <input
                    id="profile-new-name"
                    type="text"
                    maxLength={MAX_PERSON_NAME_LENGTH}
                    placeholder="Tu nombre completo"
                    value={newName}
                    onChange={(e) => setNewName(normalizePlainText(e.target.value))}
                    disabled={loadingName}
                    className="input-base min-h-10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingName}
                  className="w-full flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-xs font-bold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {loadingName ? 'Guardando…' : 'Guardar Nuevo Nombre'}
                </button>
              </form>
            )}
          </div>

          {/* Sección Cambiar Contraseña */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-bold transition-all shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <KeyRound size={15} className="text-brand-500" />
                  <span>Cambiar Contraseña</span>
                </div>
                <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold">Editar →</span>
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <KeyRound size={14} className="text-brand-500" /> Cambiar Contraseña
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                  >
                    Cancelar
                  </button>
                </div>

                {passError && (
                  <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle size={14} className="shrink-0 text-red-500" />
                    <span>{passError}</span>
                  </div>
                )}

                {passSuccess && (
                  <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 text-xs text-brand-700 dark:text-brand-300">
                    <CheckCircle size={14} className="shrink-0 text-brand-500" />
                    <span>{passSuccess}</span>
                  </div>
                )}

                {user.hasPassword && (
                  <div>
                    <label htmlFor="profile-current-password" className="label-base">Contraseña actual</label>
                    <input
                      id="profile-current-password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={loadingPass}
                      className="input-base min-h-10"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="profile-new-password" className="label-base">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      id="profile-new-password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres, con letras y números"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loadingPass}
                      className="input-base pr-10 min-h-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-confirm-password" className="label-base">Confirmar Nueva Contraseña</label>
                  <input
                    id="profile-confirm-password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loadingPass}
                    className="input-base min-h-10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingPass}
                  className="w-full flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-xs font-bold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {loadingPass ? 'Guardando…' : 'Guardar Nueva Contraseña'}
                </button>
              </form>
            )}
          </div>

          {/* Botón de Cerrar Sesión */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-200 active:scale-95"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

