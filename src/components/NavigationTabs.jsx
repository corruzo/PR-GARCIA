import { Zap, Sliders, Bookmark } from 'lucide-react';

export function NavigationTabs({ activeTab, onChangeTab, historyCount = 0 }) {
  const tabs = [
    {
      id: 'quick',
      label: 'Calculadora Rápida',
      badge: 'Calle',
      icon: Zap,
    },
    {
      id: 'advanced',
      label: 'Simulador Avanzado',
      badge: 'Detallado',
      icon: Sliders,
    },
    {
      id: 'saved',
      label: 'Mis Cotizaciones',
      count: historyCount,
      icon: Bookmark,
    },
  ];

  return (
    <nav className="mb-6 flex justify-center">
      <div className="inline-flex w-full sm:w-auto p-1.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm backdrop-blur overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400'} />
              <span>{tab.label}</span>
              
              {tab.badge && (
                <span className={`px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {tab.badge}
                </span>
              )}

              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
