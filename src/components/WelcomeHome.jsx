import { LogIn, Moon, Sun, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './BrandLogo';

const HOW_IT_WORKS = [
  {
    title: 'Registra a tus clientes',
    description: 'Guarda cédula o RIF, teléfono y referencias. Cada cliente tiene su ficha con todos sus préstamos.',
  },
  {
    title: 'Emite el préstamo',
    description: 'Elige monto, moneda, tasa y plazo. El cronograma queda guardado con la tasa BCV del día.',
  },
  {
    title: 'Cobra y controla',
    description: 'Registra pagos y abonos en dólares o bolívares, sigue la mora y envía recordatorios por WhatsApp.',
  },
];

const SERVICIOS = [
  { title: 'Cartera de clientes', description: 'Fichas, historial y estado de cada cliente.' },
  { title: 'Cuotas y abonos', description: 'Cronograma, pagos parciales y abonos a capital que reducen el interés.' },
  { title: 'Mora y cobranza', description: 'Atrasos, mora diaria y agenda de cobros de la semana.' },
  { title: 'Reportes bimonetarios', description: 'Libro mayor, cobranza mensual y efecto de la tasa de cambio.' },
];

const FAQS = [
  {
    question: '¿PRGARCÍA otorga préstamos?',
    answer: 'No. PRGARCÍA es una herramienta para que tú gestiones tus préstamos. No presta dinero, no aprueba solicitudes ni intermedia pagos.',
  },
  {
    question: '¿Qué diferencia hay entre una tasa diaria, semanal, quincenal y mensual?',
    answer: 'La modalidad indica el período al que corresponde el porcentaje: 1, 7, 15 o 30 días. Puedes calcular el interés sobre el saldo pendiente (cada abono lo reduce) o fijo sobre el capital inicial, siempre por días exactos.',
  },
  {
    question: '¿De dónde sale la tasa BCV?',
    answer: 'La aplicación consulta las fuentes de referencia disponibles, que pueden retrasarse o fallar. Verifica siempre la tasa publicada en bcv.org.ve.',
  },
  {
    question: '¿Puedo simular en dólares y bolívares?',
    answer: 'Sí. Elige USD o VES y revisa la equivalencia calculada con la tasa indicada en la cotización.',
  },
  {
    question: '¿Se guardan mis cotizaciones?',
    answer: 'Solo si inicias sesión y eliges guardarlas. Puedes consultar las cotizaciones guardadas desde tu cuenta.',
  },
  {
    question: '¿PRGARCÍA envía automáticamente la propuesta por WhatsApp?',
    answer: 'No. La aplicación prepara un mensaje; tú lo revisas y decides si lo envías desde WhatsApp.',
  },
  {
    question: '¿Cuánto cuesta usar PRGARCÍA?',
    answer: 'El costo aún no está definido públicamente. Revisa las condiciones que se publiquen antes de usar el servicio.',
  },
];

export function WelcomeHome() {
  const { openAuthModal } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-surface-light text-slate-900 selection:bg-brand-700 selection:text-white dark:bg-surface-dark dark:text-slate-100">
      <header className="sticky top-0 z-30 shadow-xs">
        <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-surface-cardDark">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:px-6">
            <a href="/" className="no-underline" aria-label="PRGARCÍA, inicio">
              <BrandLogo size={38} />
            </a>
            <nav className="flex items-center gap-2" aria-label="Acceso a la cuenta">
              <button
                type="button"
                onClick={toggle}
                aria-label="Cambiar tema"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-brand-50 dark:border-slate-700 dark:bg-surface-cardDark dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button type="button" onClick={() => openAuthModal('login')} className="btn-secondary min-h-10 px-3 text-xs sm:px-4 sm:text-sm">
                <LogIn size={15} aria-hidden="true" />
                <span>Ingresar</span>
              </button>
              <button type="button" onClick={() => openAuthModal('register')} aria-label="Crear cuenta" className="btn-primary min-h-10 px-3 text-xs sm:px-4 sm:text-sm">
                <UserPlus size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Crear cuenta</span>
              </button>
            </nav>
          </div>
        </div>
        <div className="gold-rule h-[3px]" aria-hidden="true" />
      </header>

      <main>
        <section className="relative overflow-hidden bg-brand-900 text-white">
          <div aria-hidden="true" className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full border border-oro-500/30" />
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-80 w-80 rounded-full border border-oro-500/20" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24 lg:px-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-oro-300">Préstamos en dólares y bolívares</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
              Revisa cuánto pagarías antes de acordar un préstamo.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-brand-100 sm:text-lg">
              Clientes, cuotas, abonos, mora y cobranza en un solo lugar, con la tasa BCV del día y cálculos exactos al céntimo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => openAuthModal('register')} className="btn-gold min-h-12 px-6">
                Abrir mi cuenta
              </button>
              <button type="button" onClick={() => openAuthModal('login')} className="inline-flex min-h-12 items-center rounded-lg border border-brand-300 px-6 text-sm font-semibold text-white hover:bg-brand-800">
                Ya tengo una cuenta
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto -mt-8 max-w-6xl px-4 lg:px-6" aria-label="Servicios">
          <ul className="relative grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-saas dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map((item) => (
              <li key={item.title} className="bg-white p-5 dark:bg-surface-cardDark">
                <span aria-hidden="true" className="mb-3 block h-1 w-10 bg-oro-500" />
                <h2 className="text-sm font-bold text-brand-900 dark:text-white">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto max-w-5xl px-4 lg:px-6">
          <section className="border-b border-slate-200 py-12 dark:border-slate-800 sm:py-16" aria-labelledby="como-funciona">
            <h2 id="como-funciona" className="text-2xl font-bold text-brand-900 dark:text-white">Cómo funciona</h2>
            <ol className="mt-7 grid gap-7 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title} className="border-l-4 border-oro-500 pl-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-200">Paso {index + 1}</p>
                  <h3 className="mt-2 font-bold text-slate-950 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="py-12 sm:py-14" aria-labelledby="preguntas-frecuentes">
            <h2 id="preguntas-frecuentes" className="text-2xl font-bold text-brand-900 dark:text-white">Preguntas frecuentes</h2>
            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
              {FAQS.map((faq) => (
                <details key={faq.question} className="py-4">
                  <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">{faq.question}</summary>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">{faq.answer}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              PRGARCÍA es una herramienta de gestión. No otorga préstamos ni es una entidad financiera, y no está afiliada al Banco Central de Venezuela.
            </p>
          </section>
        </div>
      </main>

      <footer className="bg-brand-950 px-4 py-8 text-center text-sm text-brand-100">
        <div className="mb-4 flex justify-center"><BrandLogo inverse size={32} /></div>
        <p>PRGARCÍA™ · Gestión de préstamos USD y VES.</p>
        <p className="mt-1">© 2026 PRGARCÍA. Todos los derechos reservados.</p>
        <nav className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Información legal">
          <a href="/terminos" className="underline hover:text-oro-300">Términos</a>
          <a href="/privacidad" className="underline hover:text-oro-300">Privacidad</a>
          <a href="/aviso-legal" className="underline hover:text-oro-300">Aviso legal</a>
          <a href="mailto:{{EMAIL_CONTACTO}}" className="underline hover:text-oro-300">Contacto</a>
        </nav>
      </footer>
    </div>
  );
}
