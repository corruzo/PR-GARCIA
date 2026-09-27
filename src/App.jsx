import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { Header } from './components/Header';
import { LoanForm } from './components/LoanForm';
import { ResultPanel } from './components/ResultPanel';
import { CronogramaTable } from './components/CronogramaTable';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { WelcomeLanding } from './components/WelcomeLanding';
import { SavedQuotesView } from './components/SavedQuotesView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { simularPrestamo, generarCronograma } from './utils/calculator';
import { supabase } from './utils/supabase/client';
import { getCachedBCV } from './services/bcvService';

const HOY = format(new Date(), 'yyyy-MM-dd');
const DEFAULTS = {
  nombreCliente:  '',
  monto:         '',
  moneda:        'USD',
  tasa:          '7',
  modalidadTasa: 'quincenal',
  fechaInicio:   HOY,
  fechaFin:      '',
  frecuenciaPago:'quincenal',
  tasaBCV:       '',
};
const DRAFT_KEY = 'prgarcia.loan.draft.v1';
const DRAFT_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutos de inactividad
const HISTORY_KEY = 'prgarcia.quotes.history.v1';

function loadDraft() {
  try {
    // Si existía un borrador antiguo persistido en localStorage, lo eliminamos
    if (localStorage.getItem(DRAFT_KEY)) {
      localStorage.removeItem(DRAFT_KEY);
    }

    const saved = sessionStorage.getItem(DRAFT_KEY);
    if (!saved) return DEFAULTS;

    const parsed = JSON.parse(saved);

    // Soporte para estructura { values, timestamp } o retrocompatibilidad directa
    const draftValues = parsed.values || parsed;
    const timestamp = parsed.timestamp;

    // Si ha pasado más de 30 minutos desde la última edición, el borrador expira
    if (timestamp && (Date.now() - timestamp > DRAFT_EXPIRATION_MS)) {
      sessionStorage.removeItem(DRAFT_KEY);
      return DEFAULTS;
    }

    const draft = { ...DEFAULTS, ...draftValues };
    if (draft.modalidadTasa === 'mensual') draft.modalidadTasa = 'quincenal';
    if (draft.frecuenciaPago === 'mensual') draft.frecuenciaPago = 'quincenal';
    return draft;
  } catch {
    return DEFAULTS;
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('calculator'); // 'calculator' | 'saved'
  const [showProfile, setShowProfile] = useState(false);
  const [values, setValues] = useState(loadDraft);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cargar historial de Supabase
  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // Transformar de la DB al formato del frontend
        const formatted = data.map(row => ({
          id: row.id,
          createdAt: row.created_at,
          values: row.prestamo_data.values,
          resultado: row.prestamo_data.resultado
        }));
        setHistory(formatted);
      }
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [user]);

  const currencyColors = values.moneda === 'USD'
    ? {
      '--currency-main': '#2563eb',
      '--currency-dark-accent': '#93c5fd',
      '--currency-soft': '#eff6ff',
      '--currency-border': '#bfdbfe',
    }
    : {
      '--currency-main': '#059669',
      '--currency-dark-accent': '#6ee7b7',
      '--currency-soft': '#ecfdf5',
      '--currency-border': '#a7f3d0',
    };

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleResetForm = () => {
    setValues(DEFAULTS);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore
    }
  };

  const isFormDirty = useMemo(() => {
    return Boolean(values.monto || values.nombreCliente || values.fechaFin);
  }, [values]);

  // Guardado de datos en sessionStorage de manera temporal con la estampa de tiempo
  useEffect(() => {
    const payload = {
      values,
      timestamp: Date.now(),
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors if private window restricts it
    }
  }, [values]);

  // Expiración automática por inactividad (30 minutos)
  useEffect(() => {
    const checkExpiration = () => {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (parsed.timestamp && (Date.now() - parsed.timestamp > DRAFT_EXPIRATION_MS)) {
          sessionStorage.removeItem(DRAFT_KEY);
          setValues(DEFAULTS);
        }
      } catch {
        // Ignore
      }
    };

    const interval = setInterval(checkExpiration, 60 * 1000); // Revisar cada minuto
    window.addEventListener('focus', checkExpiration);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkExpiration);
    };
  }, []);

  const resultado = useMemo(() => {
    const { monto, tasa, fechaFin, tasaBCV } = values;
    if (!monto || !tasa || !fechaFin || !tasaBCV) return null;
    return simularPrestamo({
      ...values,
      monto:   parseFloat(monto)   || 0,
      tasa:    parseFloat(tasa)    || 0,
      tasaBCV: parseFloat(tasaBCV) || 0,
    });
  }, [values]);

  // Detectar si la tasa fue modificada manualmente respecto a la tasa oficial del BCV
  const tasaBCVPersonalizada = useMemo(() => {
    const valorCampo = parseFloat(values.tasaBCV);
    if (!valorCampo || valorCampo <= 0) return false;
    const cached = getCachedBCV();
    if (!cached?.rate) return false;
    return Math.abs(valorCampo - cached.rate) > 0.01;
  }, [values.tasaBCV]);

  const cronograma = useMemo(() => generarCronograma(resultado), [resultado]);

  const guardarCotizacion = async () => {
    if (!resultado?.valido || !user) return false;
    const payload = {
      user_id: user.id,
      prestamo_data: {
        values: { ...values },
        resultado: { ...resultado }
      }
    };
    
    const { data, error } = await supabase
      .from('user_history')
      .insert([payload])
      .select()
      .single();

    if (!error && data) {
      const newItem = {
        id: data.id,
        createdAt: data.created_at,
        values: data.prestamo_data.values,
        resultado: data.prestamo_data.resultado
      };
      setHistory(prev => [newItem, ...prev].slice(0, 30));
      return true;
    }
    return false;
  };

  const eliminarCotizacion = async (id) => {
    const { error } = await supabase.from('user_history').delete().eq('id', id).eq('user_id', user.id);
    if (!error) {
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const limpiarCotizaciones = async () => {
    const { error } = await supabase.from('user_history').delete().eq('user_id', user.id);
    if (!error) {
      setHistory([]);
    }
  };

  const abrirCotizacion = (item) => {
    setValues({ ...DEFAULTS, ...item.values });
    setActiveTab('calculator');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
      </div>
    );
  }

  // GUARDIÁN DE AUTENTICACIÓN: Si no hay sesión, muestra el Recibidor / Landing
  if (!user) {
    return (
      <>
        <WelcomeLanding />
        <AuthModal />
      </>
    );
  }

  return (
    <div
      className="currency-app app-canvas min-h-screen bg-surface-light dark:bg-surface-dark transition-colors duration-300"
      style={currencyColors}
    >
      <Header
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenProfile={() => setShowProfile(true)}
        historyCount={history.length}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-9">

        {/* 1. CALCULADORA UNIFICADA Y SIMPLIFICADA */}
        {activeTab === 'calculator' && (
          <div className="space-y-6 animate-fade-in">
            <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
              {/* Formulario */}
              <section>
                <div className="page-intro mb-5 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">
                      Nuevo Préstamo
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Ingresa los datos para calcular las cuotas.
                    </p>
                  </div>
                  {isFormDirty && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700/80 rounded-lg transition-colors border border-gray-200/60 dark:border-gray-700/60 shadow-sm"
                      title="Reiniciar y limpiar borrador"
                    >
                      <RotateCcw size={13} />
                      <span>Limpiar</span>
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <LoanForm values={values} onChange={handleChange} />
                </div>
              </section>

              {/* Resultados (Ocultos hasta completar) */}
              <aside className="mt-6 lg:mt-0 lg:sticky lg:top-20">
                {resultado?.valido ? (
                  <>
                    <div className="mb-4 hidden lg:block">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">Resumen</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Detalles de la cotización</p>
                    </div>

                    <div className="rounded-2xl border bg-white dark:bg-gray-900/80 border-gray-200/50 dark:border-gray-700/50 p-5 shadow-sm">
                      <div className="lg:hidden mb-4">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">Resumen</h2>
                      </div>
                      <ResultPanel resultado={resultado} nombreCliente={values.nombreCliente} onSaveQuote={guardarCotizacion} tasaBCVPersonalizada={tasaBCVPersonalizada} />
                    </div>
                  </>
                ) : (
                  <div className="hidden lg:flex flex-col items-center justify-center p-10 text-center text-gray-400 dark:text-gray-600 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl h-[400px]">
                    <p className="text-sm font-semibold">Comienza a calcular</p>
                    <p className="text-xs mt-2">Ingresa un monto para ver el resumen y el cronograma de pagos.</p>
                  </div>
                )}
              </aside>
            </div>

            {/* Cronograma de pagos */}
            {resultado?.valido && (
              <CronogramaTable resultado={resultado} cronograma={cronograma} />
            )}
          </div>
        )}

        {/* 2. MODO MIS COTIZACIONES GUARDADAS */}
        {activeTab === 'saved' && (
          <SavedQuotesView
            items={history}
            onOpen={abrirCotizacion}
            onDelete={eliminarCotizacion}
            onClear={limpiarCotizaciones}
          />
        )}

        {/* Footer */}
        <footer className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            PRGARCÍA · Calculadora de Préstamos
            Verifica la tasa BCV en{' '}
            <a href="https://www.bcv.org.ve" target="_blank" rel="noopener noreferrer"
               className="underline hover:text-brand-600 transition-colors">bcv.org.ve</a>
          </p>
        </footer>

      </main>

      <AuthModal />
      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        totalQuotes={history.length}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
