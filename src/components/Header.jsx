import { CircleHelp, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import { InfoModal } from './InfoModal';
import { UserMenu } from './UserMenu';
import { SidebarMobile } from './SidebarMobile';
import { BrandLogo } from './BrandLogo';
import { RateTicker } from './RateTicker';
import { handleTabKeyDown } from '../utils/keyboardTabs';
import { NAV_ITEMS } from '../features/cartera/navigation';

export function Header({ activeTab, onChangeTab, onOpenProfile, historyCount = 0 }) {
  const { dark, toggle } = useTheme();
  const [showInfo, setShowInfo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <header className="app-header sticky top-0 z-30 shadow-xs">
      <RateTicker />

      {/* Barra de marca */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-surface-cardDark">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSidebar(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-brand-800 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              onClick={() => onChangeTab?.('calculator')}
              className="rounded-lg text-left focus-visible:outline-none"
              aria-label="PRGARCÍA, ir al inicio"
            >
              <BrandLogo size={38} />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              aria-label="Cómo se calcula"
              title="Cómo se calcula"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CircleHelp size={18} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label="Cambiar tema"
              title="Cambiar tema"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <UserMenu onOpenProfile={onOpenProfile} />
          </div>
        </div>
      </div>

      {/* Barra de navegación institucional (escritorio) */}
      <nav aria-label="Módulos" className="hidden bg-brand-800 dark:bg-brand-900 lg:block">
        <div role="tablist" aria-label="Vistas de la cuenta" className="mx-auto flex max-w-6xl items-stretch px-2 lg:px-4">
          {NAV_ITEMS.map(({ id, label, icon: Icon, countKey }) => {
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
                className={`relative flex h-12 items-center gap-2 px-4 text-[13px] font-semibold transition-colors focus-visible:z-10 ${
                  active ? 'bg-brand-900 text-white dark:bg-brand-950' : 'text-brand-100 hover:bg-brand-700 hover:text-white'
                }`}
              >
                <Icon size={15} aria-hidden="true" className={active ? 'text-oro-400' : ''} />
                <span>{label}</span>
                {countKey === 'history' && historyCount > 0 && (
                  <span className="rounded-full bg-oro-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-950">{historyCount}</span>
                )}
                {active && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-oro-500" />}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="gold-rule h-[3px] lg:hidden" aria-hidden="true" />

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
