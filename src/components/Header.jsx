import { CircleHelp, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import { InfoModal } from './InfoModal';
import { UserMenu } from './UserMenu';
import { SidebarMobile } from './SidebarMobile';
import { handleTabKeyDown } from '../utils/keyboardTabs';
import { NAV_ITEMS } from '../features/cartera/navigation';

export function Header({ activeTab, onChangeTab, onOpenProfile, historyCount = 0 }) {
  const { dark, toggle } = useTheme();
  const [showInfo, setShowInfo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <header className="app-header sticky top-0 z-30 border-b border-gray-200/80 bg-white/85 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-950/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
        
        {/* Marca + Hamburguesa Móvil */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSidebar(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 lg:hidden hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Abrir menú"
          >
            <Menu size={20} />
          </button>

          <button
            type="button"
            onClick={() => onChangeTab?.('calculator')}
            className="flex items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-esmeralda focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
          >
            <img src="/logo-mark.svg" alt="" width="36" height="36" className="h-9 w-9 shrink-0" />
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">PRGARCÍA</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Préstamos y cartera</p>
            </div>
          </button>
        </div>

        {/* NAVEGACIÓN TOPBAR - Solo visible en Laptops (lg:) */}
        <nav role="tablist" aria-label="Vistas de la cuenta" className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          {NAV_ITEMS.map(({ id, label, icon: Icon, countKey }) => (
            <button
              key={id}
              type="button"
              id={`tab-${id}`}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls="app-tab-panel"
              tabIndex={activeTab === id ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              onClick={() => onChangeTab?.(id)}
              title={label}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === id
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="sr-only xl:not-sr-only">{label}</span>
              {countKey === 'history' && historyCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {historyCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Acciones del Sistema - Solo en Desktop */}
        <div className="hidden lg:flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label="Cómo se calcula"
            title="Cómo se calcula"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <CircleHelp size={18} />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Cambiar tema"
            title="Cambiar tema"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-800 mx-0.5" />
          <UserMenu onOpenProfile={onOpenProfile} />
        </div>
      </div>

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />
      <SidebarMobile
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        onOpenProfile={onOpenProfile}
        historyCount={historyCount}
      />
    </header>
  );
}
