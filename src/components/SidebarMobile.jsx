import { createPortal } from 'react-dom';
import { X, Calculator, User, LogOut, Sun, Moon, CircleHelp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { InfoModal } from './InfoModal';
import { useState } from 'react';
import { handleTabKeyDown } from '../utils/keyboardTabs';
import { NAV_ITEMS } from '../features/cartera/navigation';

export function SidebarMobile({ open, onClose, activeTab, onChangeTab, onOpenProfile, historyCount = 0 }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [showInfo, setShowInfo] = useState(false);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-gray-950/50 backdrop-blur-sm animate-fade-in lg:hidden"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className="w-72 max-w-[80vw] h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col justify-between p-5 animate-slide-right overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Encabezado Sidebar */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="brand-mark flex h-8 w-8 items-center justify-center rounded-lg">
                <Calculator size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">PRGARCÍA</p>
                <p className="text-[10px] text-gray-400">Menú Principal</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
            {NAV_ITEMS.map(({ id, label, icon: Icon, countKey }) => (
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
                    ? 'bg-brand-700 text-white shadow-md shadow-brand-600/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{label}</span>
                </div>
                {countKey === 'history' && historyCount > 0 && (
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                    activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}>
                    {historyCount}
                  </span>
                )}
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
              {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
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
