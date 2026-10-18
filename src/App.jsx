import { lazy, Suspense, useState, useEffect } from 'react';
import { AuthModal } from './components/AuthModal';
import { WelcomeHome } from './components/WelcomeHome';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { useHashRoute } from './features/cartera/router';
import { NAV_ITEMS } from './features/cartera/navigation';
import { CONTACT_EMAIL } from './config';

const Header = lazy(() => import('./components/Header').then(module => ({ default: module.Header })));
const ProfileModal = lazy(() => import('./components/ProfileModal').then(module => ({ default: module.ProfileModal })));
const CalculadoraView = lazy(() => import('./features/calculadora/CalculadoraView').then(module => ({ default: module.CalculadoraView })));
const ClientesView = lazy(() => import('./features/clientes/ClientesView').then(module => ({ default: module.ClientesView })));
const PrestamosView = lazy(() => import('./features/prestamos/PrestamosView').then(module => ({ default: module.PrestamosView })));
const CobranzaView = lazy(() => import('./features/cobranza/CobranzaView').then(module => ({ default: module.CobranzaView })));
const ReportesView = lazy(() => import('./features/reportes/ReportesView').then(module => ({ default: module.ReportesView })));

function AppContent() {
  const { user, loading } = useAuth();
  const [route, navigate] = useHashRoute();
  const activeTab = route.view;
  const [prestamoPrefill, setPrestamoPrefill] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) return;

    const originalContent = robotsMeta.content;
    robotsMeta.content = user ? 'noindex,nofollow' : originalContent;
    return () => {
      robotsMeta.content = originalContent;
    };
  }, [user]);

  const convertirEnPrestamo = (prefill) => {
    setPrestamoPrefill(prefill);
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
      />

      <main id="app-tab-panel" role="tabpanel" aria-label={NAV_ITEMS.find((item) => item.id === activeTab)?.label} tabIndex={0} className="mx-auto max-w-6xl px-4 pt-6 pb-28 lg:px-6 lg:py-9">

        <Suspense fallback={<div className="min-h-40" aria-label="Cargando módulo" />}>
          {activeTab === 'calculator' && <CalculadoraView onConvertir={convertirEnPrestamo} />}
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
            {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`} className="underline">Contacto</a>}
          </nav>
        </footer>

      </main>

      <AuthModal />
      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
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
