import { lazy, Suspense, useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Landmark, RotateCcw } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { WelcomeHome } from './components/WelcomeHome';
import { AuthProvider, useAuth } from './context/AuthContext';
import { simularPrestamo, generarCronograma } from './utils/calculator';
import { supabase } from './utils/supabase/client';
import { getCachedBCV } from './services/bcvService';
import { normalizePlainText } from './utils/inputValidation';
import { useHashRoute } from './features/cartera/router';
import { NAV_ITEMS } from './features/cartera/navigation';

const Header = lazy(() => import('./components/Header').then(module => ({ default: module.Header })));
const LoanForm = lazy(() => import('./components/LoanForm').then(module => ({ default: module.LoanForm })));
const ResultPanel = lazy(() => import('./components/ResultPanel').then(module => ({ default: module.ResultPanel })));
const CronogramaTable = lazy(() => import('./components/CronogramaTable').then(module => ({ default: module.CronogramaTable })));
const ProfileModal = lazy(() => import('./components/ProfileModal').then(module => ({ default: module.ProfileModal })));
const SavedQuotesView = lazy(() => import('./components/SavedQuotesView').then(module => ({ default: module.SavedQuotesView })));
const ClientesView = lazy(() => import('./features/clientes/ClientesView').then(module => ({ default: module.ClientesView })));
const PrestamosView = lazy(() => import('./features/prestamos/PrestamosView').then(module => ({ default: module.PrestamosView })));
const CobranzaView = lazy(() => import('./features/cobranza/CobranzaView').then(module => ({ default: module.CobranzaView })));
const ReportesView = lazy(() => import('./features/reportes/ReportesView').then(module => ({ default: module.ReportesView })));

const HOY = format(new Date(), 'yyyy-MM-dd');
const DEFAULTS = {
  nombreCliente:  '',
  monto:         '',
  moneda:        'USD',
  tasa:          '8',
  modalidadTasa: 'semanal',
  fechaInicio:   HOY,
  fechaFin:      '',
  frecuenciaPago:'semanal',
  metodoInteres: 'saldo_insoluto',
  tipoPlazo:     'abierto',
  tasaBCV:       '',
};
// Borradores y cotizaciones guardadas antes de existir el selector usaban interés fijo.
const METODO_ANTERIOR = 'interes_fijo';
// …y siempre tenían fecha de fin.
const ANTERIORES = { metodoInteres: METODO_ANTERIOR, tipoPlazo: 'fijo' };
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

    const draft = { ...DEFAULTS, ...ANTERIORES, ...draftValues };
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
  const [route, navigate] = useHashRoute();
  const activeTab = route.view;
  const [prestamoPrefill, setPrestamoPrefill] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [values, setValues] = useState(loadDraft);
  const [history, setHistory] = useState([]);
  const [historyOwnerId, setHistoryOwnerId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const currentHistory = user && historyOwnerId === user.id ? history : [];
  const currentHistoryError = user && historyOwnerId === user.id ? historyError : '';

  useEffect(() => {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) return;

    const originalContent = robotsMeta.content;
    robotsMeta.content = user ? 'noindex,nofollow' : originalContent;
    return () => {
      robotsMeta.content = originalContent;
    };
  }, [user]);

  // Cargar historial de Supabase
  useEffect(() => {
    let cancelled = false;

    if (!user) return undefined;

    const fetchHistory = async () => {
      setLoadingHistory(true);

      try {
        const { data, error } = await supabase
          .from('user_history')
          .select('id,created_at,prestamo_data')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const formatted = data.map(row => ({
          id: row.id,
          createdAt: row.created_at,
          values: row.prestamo_data.values,
          resultado: row.prestamo_data.resultado,
        }));
        setHistoryError('');
        setHistory(formatted);
        setHistoryOwnerId(user.id);
      } catch {
        if (cancelled) return;
        setHistory([]);
        setHistoryOwnerId(user.id);
        setHistoryError('No pudimos cargar tus cotizaciones. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [user, historyReloadKey]);


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
    if (!monto || !tasa || !tasaBCV || (values.tipoPlazo !== 'abierto' && !fechaFin)) return null;
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
        values: { ...values, nombreCliente: normalizePlainText(values.nombreCliente) },
        resultado: { ...resultado }
      }
    };
    
    const { data, error } = await supabase
      .from('user_history')
      .insert([payload])
      .select('id,created_at,prestamo_data')
      .single();

    if (!error && data) {
      const newItem = {
        id: data.id,
        createdAt: data.created_at,
        values: data.prestamo_data.values,
        resultado: data.prestamo_data.resultado
      };
      setHistoryOwnerId(user.id);
      setHistory(prev => [newItem, ...(historyOwnerId === user.id ? prev : [])].slice(0, 30));
      return true;
    }
    return false;
  };

  const eliminarCotizacion = async (id) => {
    try {
      const { error } = await supabase.from('user_history').delete().eq('id', id).eq('user_id', user.id);
      if (error) return false;
      setHistory(prev => prev.filter(item => item.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  const limpiarCotizaciones = async () => {
    try {
      const { error } = await supabase.from('user_history').delete().eq('user_id', user.id);
      if (error) return false;
      setHistory([]);
      return true;
    } catch {
      return false;
    }
  };

  const abrirCotizacion = (item) => {
    setValues({ ...DEFAULTS, ...ANTERIORES, ...item.values });
    navigate('calculator');
  };

  const convertirEnPrestamo = () => {
    if (!resultado?.valido) return;
    setPrestamoPrefill({
      moneda: resultado.moneda,
      monto: resultado.monto,
      tasa: resultado.tasa,
      modalidadTasa: resultado.modalidadTasa,
      frecuenciaPago: resultado.frecuenciaPago,
      metodoInteres: resultado.metodoInteres,
      tipoPlazo: resultado.tipoPlazo,
      fechaInicio: resultado.fechaInicio,
      fechaFin: resultado.fechaFin,
      tasaBCV: resultado.tasaBCV,
    });
    navigate('prestamos', 'nuevo');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-700" aria-hidden="true" />
        <span className="sr-only">Cargando tu sesión…</span>
      </div>
    );
  }

  // GUARDIÁN DE AUTENTICACIÓN: Si no hay sesión, muestra el Recibidor / Landing
  if (!user) {
    return (
      <>
        <WelcomeHome />
        <AuthModal />
      </>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen" aria-label="Cargando calculadora" />}>
      <div
        className="currency-app app-canvas min-h-screen bg-surface-light dark:bg-surface-dark transition-colors duration-300"
      >
      <Header
        activeTab={activeTab}
        onChangeTab={(view) => navigate(view)}
        onOpenProfile={() => setShowProfile(true)}
        historyCount={currentHistory.length}
      />

      <main id="app-tab-panel" role="tabpanel" aria-label={NAV_ITEMS.find((item) => item.id === activeTab)?.label} tabIndex={0} className="mx-auto max-w-6xl px-4 pt-6 pb-28 lg:px-6 lg:py-9">

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
                    <button type="button" onClick={convertirEnPrestamo} className="btn-secondary mt-3 w-full">
                      <Landmark size={16} aria-hidden="true" /> Convertir en préstamo
                    </button>
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
            items={currentHistory}
            loading={loadingHistory}
            error={currentHistoryError}
            onOpen={abrirCotizacion}
            onDelete={eliminarCotizacion}
            onClear={limpiarCotizaciones}
            onRetry={() => setHistoryReloadKey(current => current + 1)}
          />
        )}

        <Suspense fallback={<div className="min-h-40" aria-label="Cargando módulo" />}>
          {activeTab === 'clientes' && <ClientesView route={route} navigate={navigate} />}
          {activeTab === 'prestamos' && (
            <PrestamosView route={route} navigate={navigate} prefill={prestamoPrefill} onPrefillUsed={() => setPrestamoPrefill(null)} />
          )}
          {activeTab === 'cobranza' && <CobranzaView navigate={navigate} />}
          {activeTab === 'reportes' && <ReportesView />}
        </Suspense>

        {/* Footer */}
        <footer className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            PRGARCÍA · Gestión de préstamos.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">© 2026 PRGARCÍA. Todos los derechos reservados.</p>
          <nav className="mt-2 flex flex-wrap justify-center gap-4 text-xs" aria-label="Información legal">
            <a href="/terminos" className="underline">Términos</a>
            <a href="/privacidad" className="underline">Privacidad</a>
            <a href="/aviso-legal" className="underline">Aviso legal</a>
            <a href="mailto:{{EMAIL_CONTACTO}}" className="underline">Contacto</a>
          </nav>
        </footer>

      </main>

      <AuthModal />
      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        totalQuotes={currentHistory.length}
      />
      </div>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
