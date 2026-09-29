import { useState } from 'react';
import { LogIn, UserPlus, Zap, Shield, DollarSign, ArrowRight, CheckCircle2, Moon, Sun, ChevronRight, Sparkles, MessageCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const ONBOARDING_STEPS = [
  {
    id: 'step1',
    title: 'Simulación de Préstamos en Segundos',
    description: 'Calcula cuotas exactas con tasa simple diaria, semanal, quincenal o mensual por días reales transcurridos.',
    icon: Zap,
    graphic: (
      <div className="w-full h-44 bg-gradient-to-br from-brand-50 to-emerald-100/40 dark:from-slate-800/80 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-brand-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs">
          Interés Real
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-md">
            <DollarSign size={24} />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Capital Simulado</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">$1,000.00 USD</p>
          </div>
        </div>
        <div className="mt-4 w-full bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 text-xs flex justify-between items-center shadow-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">Cuotas Quincenales (2x)</span>
          <span className="font-bold text-brand-600 dark:text-brand-400 font-mono">$535.00 USD</span>
        </div>
      </div>
    ),
  },
  {
    id: 'step2',
    badge: 'Multi-Moneda',
    title: 'Anclaje a Tasa BCV Oficial',
    description: 'Convierte automáticamente entre Dólares y Bolívares con la tasa de cambio oficial del BCV en tiempo real.',
    icon: RefreshCw,
    graphic: (
      <div className="w-full h-44 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-slate-800/80 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="flex items-center justify-center gap-4 w-full">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center shadow-xs w-1/2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Divisas</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">$100 USD</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            ⇄
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center shadow-xs w-1/2">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">BCV Oficial</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">Bs. Ref.</span>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">Protección cambiaria garantizada para cobro de cuotas</p>
      </div>
    ),
  },
  {
    id: 'step3',
    badge: 'Compartir Instantáneo',
    title: 'Cotizaciones Listas para WhatsApp',
    description: 'Envía propuestas financieras profesionales a tus clientes con un solo clic o copia la propuesta al portapapeles.',
    icon: MessageCircle,
    graphic: (
      <div className="w-full h-44 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-center items-center p-5 text-white relative overflow-hidden shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="text-emerald-400" size={20} />
          <span className="text-xs font-bold tracking-wide">Mensaje Directo</span>
        </div>
        <p className="text-xs text-slate-300 text-center line-clamp-3 leading-relaxed max-w-xs">
          "Hola, los datos de tu préstamo son: Capital $1,000.00 USD. Total a cobrar: $1,070.00 USD en 2 cuotas quincenales..."
        </p>
        <span className="mt-3 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-semibold">
          ✓ Formateado y listo
        </span>
      </div>
    ),
  },
];

const PUBLIC_FAQS = [
  {
    question: '¿PRGARCÍA otorga préstamos?',
    answer: 'No. PRGARCÍA es una herramienta para simular cuotas; no presta dinero ni aprueba solicitudes.',
  },
  {
    question: '¿Qué diferencia hay entre una tasa diaria, semanal, quincenal y mensual?',
    answer: 'La modalidad indica el período al que corresponde el porcentaje: 1, 7, 15 o 30 días. La simulación aplica interés simple según los días transcurridos.',
  },
  {
    question: '¿De dónde sale la tasa BCV?',
    answer: 'La aplicación consulta las fuentes de referencia configuradas y muestra el origen y la fecha disponibles. Puedes contrastar la publicación en bcv.org.ve.',
  },
  {
    question: '¿Puedo simular en dólares y bolívares?',
    answer: 'Sí. Puedes elegir USD o VES y consultar la equivalencia en la otra moneda usando la tasa indicada en la simulación.',
  },
  {
    question: '¿Se guardan mis cotizaciones?',
    answer: 'Las cotizaciones guardadas se asocian a tu cuenta cuando inicias sesión y eliges guardarlas.',
  },
  {
    question: '¿La calculadora envía el mensaje por WhatsApp automáticamente?',
    answer: 'No. Al elegir compartir, se prepara el texto y WhatsApp se abre para que revises y envíes el mensaje.',
  },
  {
    question: '¿Cuánto cuesta usar PRGARCÍA?',
    answer: 'El precio todavía no está definido públicamente. Revisa las condiciones que se publiquen antes de usar el servicio.',
  },
];

export function WelcomeLanding() {
  const { openAuthModal } = useAuth();
  const { dark, toggle } = useTheme();
  const [activeStep, setActiveStep] = useState(0);

  const currentStep = ONBOARDING_STEPS[activeStep];

  const handleNext = () => {
    if (activeStep < ONBOARDING_STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      openAuthModal('register');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Header SaaS Minimalista */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="" width="40" height="40" className="h-10 w-10 shrink-0" />
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">PRGARCÍA</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Calculadora</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggle}
              aria-label="Cambiar tema"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-xs"
            >
              <LogIn size={15} />
              <span>Iniciar Sesión</span>
            </button>

            <button
              type="button"
              onClick={() => openAuthModal('register')}
              aria-label="Crear cuenta"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 px-4 text-xs font-bold text-white shadow-sm hover:shadow-md hover:shadow-brand-500/20 transition-all active:scale-95"
            >
              <UserPlus size={15} />
              <span className="hidden sm:inline">Crear Cuenta</span>
            </button>
          </div>
        </div>
      </header>

      {/* Onboarding & Presentation Main */}
      <main className="mx-auto max-w-4xl px-4 py-8 lg:py-12 flex-1 flex flex-col items-center justify-center text-center">
        <section className="mb-8 max-w-3xl space-y-4">
          <h1 className="text-3xl font-extrabold leading-tight text-slate-950 dark:text-white">
            Simula préstamos en dólares y bolívares
          </h1>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            PRGARCÍA es una calculadora para estimar cuotas de un préstamo con interés simple y consultar su equivalencia en USD y VES usando una referencia de tasa BCV. Tú decides las condiciones; la herramienta no otorga préstamos ni sustituye un acuerdo entre las partes.
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">PRGARCÍA es una herramienta informativa. No es una entidad financiera ni está afiliada al Banco Central de Venezuela.</p>
          <button type="button" onClick={() => openAuthModal('register')} className="btn-primary">
            Crear una cuenta
          </button>
        </section>

        {/* Onboarding Visual Card Container */}
        <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-saas relative transition-all duration-300">

          {/* Header Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-900 text-brand-700 dark:text-brand-300 text-xs font-bold mb-6">
            <Sparkles size={14} className="text-brand-500" />
            <span>{currentStep.badge}</span>
          </div>

          {/* Graphic Element */}
          <div className="mb-6">
            {currentStep.graphic}
          </div>

          {/* Step Text Info */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
            {currentStep.title}
          </h2>

          <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed max-w-md mx-auto">
            {currentStep.description}
          </p>

          {/* Pagination Indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {ONBOARDING_STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(idx)}
                aria-label={`Ir al paso ${idx + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${idx === activeStep ? 'w-8 bg-brand-500' : 'w-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300'
                  }`}
              />
            ))}
          </div>

          {/* Onboarding Controls */}
          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-3 py-2 rounded-xl transition-colors"
            >
              Comenzar
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold text-sm shadow-sm hover:shadow-md hover:shadow-brand-500/20 transition-all active:scale-[0.98]"
            >
              <span>{activeStep === ONBOARDING_STEPS.length - 1 ? 'Empezar Ahora' : 'Siguiente'}</span>
              <ChevronRight size={16} />
            </button>
          </div>

        </div>

        {/* Quick Features List */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-10 w-full max-w-3xl text-left">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-xs mb-1">
              <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
              <span>Matemática Exacta</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Interés simple ajustado por días exactos sin sobrecostos.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-xs mb-1">
              <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
              <span>Doble Moneda</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Visualiza montos simultáneamente en USD y Bolívares.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-xs mb-1">
              <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
              <span>Privado y Seguro</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Tus cotizaciones quedan protegidas y guardadas en tu cuenta.
            </p>
          </div>
        </div>

        <section className="mt-12 w-full max-w-3xl space-y-5 text-left">
          <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">Cómo funciona</h2>
          <ol className="grid gap-5 sm:grid-cols-3">
            <li className="space-y-2"><h3 className="font-bold text-slate-900 dark:text-white">1. Elige monto y tasa</h3><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Indica el capital, la moneda, el porcentaje y el período de la tasa, junto con las fechas del préstamo.</p></li>
            <li className="space-y-2"><h3 className="font-bold text-slate-900 dark:text-white">2. Revisa las cuotas</h3><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Consulta el total y el cronograma en la moneda elegida, con equivalencia en dólares y bolívares.</p></li>
            <li className="space-y-2"><h3 className="font-bold text-slate-900 dark:text-white">3. Guarda o comparte</h3><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Con una cuenta puedes guardar cotizaciones. También puedes preparar una propuesta para revisar y compartir por WhatsApp.</p></li>
          </ol>

          <h2 className="pt-5 text-2xl font-extrabold text-slate-950 dark:text-white">Por qué consultar una referencia BCV</h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Una referencia común ayuda a expresar equivalencias entre USD y VES con una fecha y un origen visibles. Las tasas pueden cambiar; revisa el dato mostrado y contrástalo con la publicación del Banco Central de Venezuela antes de acordar un pago.</p>

          <h2 className="pt-5 text-2xl font-extrabold text-slate-950 dark:text-white">Para quién es</h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Puede servir a prestamistas, comerciantes y personas que quieran explorar escenarios de pago antes de conversar las condiciones de un préstamo. El resultado es una simulación, no una oferta ni una aprobación de crédito.</p>

          <h2 className="pt-5 text-2xl font-extrabold text-slate-950 dark:text-white">Preguntas frecuentes</h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {PUBLIC_FAQS.map((item) => (
              <details key={item.question} className="py-4">
                <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">{item.question}</summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
          <button type="button" onClick={() => openAuthModal('register')} className="btn-primary">Crear una cuenta</button>
        </section>

      </main>

      {/* SaaS Footer */}
      <footer className="py-5 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
        <p>
          PRGARCÍA · Calculadora de préstamos. Verifica la tasa en{' '}
          <a href="https://www.bcv.org.ve" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-profundo dark:hover:text-brand-menta">bcv.org.ve</a>.
        </p>
        <p className="mt-1">© 2026 PRGARCÍA. Todos los derechos reservados.</p>
        <nav className="mt-2 flex justify-center gap-4" aria-label="Información legal">
          <a href="/terminos">Términos</a>
          <a href="/privacidad">Privacidad</a>
          <a href="/aviso-legal">Aviso legal</a>
        </nav>
      </footer>
    </div>
  );
}
