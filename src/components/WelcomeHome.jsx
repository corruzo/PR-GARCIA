import { LogIn, Moon, Sun, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const HOW_IT_WORKS = [
  {
    title: 'Ingresa las condiciones',
    description: 'Elige moneda, monto, porcentaje y período de la tasa, además de las fechas del préstamo.',
  },
  {
    title: 'Revisa el resultado',
    description: 'Consulta el total de intereses, el total a pagar y el cronograma estimado en USD y VES.',
  },
  {
    title: 'Guarda o comparte',
    description: 'Si tienes una cuenta, guarda la cotización. También puedes revisar y compartir una propuesta por WhatsApp.',
  },
];

const FAQS = [
  {
    question: '¿PRGARCÍA otorga préstamos?',
    answer: 'No. PRGARCÍA es una herramienta informativa de simulación. No presta dinero, no aprueba solicitudes ni intermedia pagos.',
  },
  {
    question: '¿Qué diferencia hay entre una tasa diaria, semanal, quincenal y mensual?',
    answer: 'La modalidad indica el período al que corresponde el porcentaje: 1, 7, 15 o 30 días. La aplicación usa interés simple sobre el capital y distribuye el interés según los días del cronograma.',
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-brand-700 selection:text-white dark:bg-[#0F172A] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:px-6">
          <a href="/" className="flex items-center gap-2.5 text-slate-950 no-underline dark:text-white">
            <img src="/logo-mark.svg" alt="" width="40" height="40" />
            <span className="font-extrabold">PRGARCÍA™</span>
          </a>
          <nav className="flex items-center gap-2" aria-label="Acceso a la cuenta">
            <button
              type="button"
              onClick={toggle}
              aria-label="Cambiar tema"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
      </header>

      <main className="mx-auto max-w-5xl px-4 lg:px-6">
        <section className="border-b border-slate-200 py-14 dark:border-slate-800 sm:py-20">
          <p className="mb-3 text-sm font-bold text-brand-profundo dark:text-brand-menta">Calculadora de cuotas en Venezuela</p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-slate-950 dark:text-white sm:text-5xl">
            Revisa cuánto pagarías antes de acordar un préstamo.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:text-lg">
            PRGARCÍA calcula una estimación de intereses simples y cuotas en dólares o bolívares, con una referencia de tasa BCV. Introduce las condiciones y revisa cómo se distribuyen los pagos.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => openAuthModal('register')} className="btn-primary min-h-12 px-6">
              Crear una cuenta
            </button>
            <button type="button" onClick={() => openAuthModal('login')} className="btn-secondary min-h-12 px-6">
              Ya tengo una cuenta
            </button>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            PRGARCÍA es una herramienta informativa. No otorga préstamos ni es una entidad financiera, y no está afiliada al Banco Central de Venezuela.
          </p>
        </section>

        <section className="border-b border-slate-200 py-12 dark:border-slate-800 sm:py-14" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="text-2xl font-bold text-slate-950 dark:text-white">Cómo funciona</h2>
          <ol className="mt-7 grid gap-7 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="border-l-2 border-brand-700 pl-4 dark:border-brand-menta">
                <p className="text-xs font-bold uppercase text-brand-profundo dark:text-brand-menta">Paso {index + 1}</p>
                <h3 className="mt-2 font-bold text-slate-950 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-10 border-b border-slate-200 py-12 dark:border-slate-800 sm:grid-cols-2 sm:py-14">
          <div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">Una referencia para comparar</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              La tasa BCV sirve como referencia para expresar equivalencias entre USD y VES. Puede haber retrasos o fallos de consulta: verifica el valor en bcv.org.ve antes de acordar un pago.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">Para personas y comercios</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Puede ser útil para prestamistas, comerciantes y personas que quieran comparar escenarios de pago. El resultado es una estimación; confirma por escrito las condiciones con la otra parte.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-14" aria-labelledby="preguntas-frecuentes">
          <h2 id="preguntas-frecuentes" className="text-2xl font-bold text-slate-950 dark:text-white">Preguntas frecuentes</h2>
          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
            {FAQS.map((faq) => (
              <details key={faq.question} className="py-4">
                <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">{faq.question}</summary>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">{faq.answer}</p>
              </details>
            ))}
          </div>
          <button type="button" onClick={() => openAuthModal('register')} className="btn-primary mt-8 min-h-12 px-6">
            <UserPlus size={16} aria-hidden="true" /> Crear una cuenta
          </button>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <p>PRGARCÍA™ · Calculadora de préstamos USD y VES.</p>
        <p className="mt-1">© 2026 PRGARCÍA. Todos los derechos reservados.</p>
        <nav className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Información legal">
          <a href="/terminos" className="underline">Términos</a>
          <a href="/privacidad" className="underline">Privacidad</a>
          <a href="/aviso-legal" className="underline">Aviso legal</a>
          <a href="mailto:{{EMAIL_CONTACTO}}" className="underline">Contacto</a>
        </nav>
      </footer>
    </div>
  );
}