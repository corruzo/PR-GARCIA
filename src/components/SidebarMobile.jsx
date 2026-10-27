import { createPortal } from 'react-dom';
import { X, User, LogOut, Sun, Moon, CircleHelp } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { InfoModal } from './InfoModal';
import { useState } from 'react';
import { handleTabKeyDown } from '../utils/keyboardTabs';
import { NAV_ITEMS } from '../features/cartera/navigation';
import { BrandLogo } from './BrandLogo';

export function SidebarMobile({ open, onClose, activeTab, onChangeTab, onOpenProfile }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [showInfo, setShowInfo] = useState(false);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm animate-fade-in lg:hidden"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className="sidebar-safe w-72 max-w-[85vw] h-full bg-white dark:bg-surface-cardDark border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between p-5 animate-slide-right overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Encabezado Sidebar */}
          <div className="-mx-5 -mt-5 flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <BrandLogo size={32} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Perfil del Usuario Resumido */}
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-600/20 shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Enlaces de Navegación */}
          <nav role="tablist" aria-label="Vistas de la cuenta" className="space-y-1.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-controls="app-tab-panel"
                tabIndex={activeTab === id ? 0 : -1}
                onKeyDown={handleTabKeyDown}
                onClick={() => {
                  onChangeTab(id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === id
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{label}</span>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile?.();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <User size={16} className="text-brand-600 dark:text-brand-400" />
              <span>Mi Perfil</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <CircleHelp size={16} className="text-gray-500" />
              <span>Cómo se calcula</span>
            </button>
          </nav>
        </div>

        {/* Footer Sidebar: Tema + Logout */}
        <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={toggle}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <span className="flex items-center gap-2">
              {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-brand-600" />}
              <span>{dark ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />
    </div>,
    document.body,
  );
}
