import { useState, useRef, useEffect } from 'react';
import { User, LogIn, UserPlus, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function UserMenu({ onOpenProfile }) {
  const { user, openAuthModal, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-brand-500/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
        >
          <LogIn size={13} className="text-brand-600 dark:text-brand-400" />
          <span>Ingresar</span>
        </button>
        <button
          type="button"
          onClick={() => openAuthModal('register')}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 px-3 text-xs font-semibold text-white shadow-sm transition-all active:scale-95"
        >
          <UserPlus size={13} />
          <span className="hidden sm:inline">Registrarse</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm transition-all hover:border-brand-500/50 active:scale-95"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-[11px] dark:bg-brand-900/50 dark:text-brand-300">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="max-w-28 truncate">{user.name}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white p-2 shadow-xl backdrop-blur-md dark:bg-gray-900 z-50 animate-fade-in space-y-1">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={11} /> Usuario Registrado
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenProfile?.();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <User size={14} className="text-brand-600 dark:text-brand-400" />
            Mi Perfil
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}
