import { CircleHelp, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { useState } from 'react';
import { InfoModal } from './InfoModal';
import { UserMenu } from './UserMenu';
import { SidebarMobile } from './SidebarMobile';
import { BrandLogo } from './BrandLogo';
import { RateTicker } from './RateTicker';
import { handleTabKeyDown } from '../utils/keyboardTabs';
import { NAV_ITEMS } from '../features/cartera/navigation';

export function Header({ activeTab, onChangeTab, onOpenProfile }) {
  const { dark, toggle } = useTheme();
  const [showInfo, setShowInfo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <>
      <header className="app-header pt-safe sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-surface-dark/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:h-20 lg:px-6">
          <button
            type="button"
            onClick={() => onChangeTab?.('calculator')}
            className="shrink-0 rounded-lg"
            aria-label="PRGARCÍA, ir a la calculadora"
          >
            <BrandLogo />
          </button>

          {/* Navegación de escritorio: íconos con etiqueta y subrayado activo (estilo categorías). */}
          <nav aria-label="Módulos" className="hidden lg:block">
            <div role="tablist" aria-label="Vistas de la cuenta" className="flex items-center gap-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    id={`tab-${id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls="app-tab-panel"
                    tabIndex={active ? 0 : -1}
                    onKeyDown={handleTabKeyDown}
                    onClick={() => onChangeTab?.(id)}
                    className={`group relative flex flex-col items-center gap-1 px-3 pb-2 pt-1 text-xs font-semibold transition-colors ${
                      active ? 'text-[#222222] dark:text-white' : 'text-slate-600 hover:text-[#222222] dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <span className="relative">
                      <Icon size={20} aria-hidden="true" className={active ? 'text-brand-700 dark:text-brand-400' : ''} />
                    </span>
                    <span>{label}</span>
                    <span aria-hidden="true" className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-colors ${
                      active ? 'bg-brand-700 dark:bg-brand-400' : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                    }`} />
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <RateTicker />
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              aria-label="Cómo se calcula"
              title="Cómo se calcula"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:flex"
            >
              <CircleHelp size={18} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label="Cambiar tema"
              title="Cambiar tema"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:flex"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden lg:block"><UserMenu onOpenProfile={onOpenProfile} /></div>
            <button
              type="button"
              onClick={() => setShowSidebar(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-[#222222] shadow-pill dark:border-slate-700 dark:text-white lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Barra inferior en móvil, como en las apps nativas. */}
      <nav aria-label="Módulos" className="pb-safe px-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-surface-dark/95 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV_ITEMS.filter((item) => item.mobile).map(({ id, label, shortLabel, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTab?.(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  active ? 'text-brand-700 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon size={22} aria-hidden="true" strokeWidth={active ? 2.4 : 1.8} />
                <span>{shortLabel ?? label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />
      <SidebarMobile
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}
