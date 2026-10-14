import { CalendarClock, ChartColumn, HandCoins, Moon, Sun, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { CONTACT_EMAIL } from '../config';

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
  { icon: Users, title: 'Cartera de clientes', description: 'Fichas, historial y estado de cada cliente.' },
  { icon: CalendarClock, title: 'Cuotas y abonos', description: 'Cronograma, pagos parciales y abonos que reducen el interés.' },
  { icon: HandCoins, title: 'Mora y cobranza', description: 'Atrasos, mora diaria y agenda de cobros de la semana.' },
  { icon: ChartColumn, title: 'Reportes en USD y Bs.', description: 'Libro mayor, cobranza mensual y efecto de la tasa.' },
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
    <div className="min-h-screen bg-white text-[#222222] selection:bg-brand-700 selection:text-white dark:bg-surface-dark dark:text-[#F5F5F7]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-surface-dark/95">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-3 px-4 lg:px-6">
          <a href="/" className="no-underline" aria-label="PRGARCÍA, inicio">
            <BrandLogo />
          </a>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Acceso a la cuenta">
            <button
              type="button"
              onClick={toggle}
              aria-label="Cambiar tema"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" onClick={() => openAuthModal('login')} className="btn-ghost rounded-full">
              Ingresar
            </button>
            <button type="button" onClick={() => openAuthModal('register')} className="btn-primary min-h-10 rounded-full px-4 py-2 text-sm">
              Crear cuenta
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-6">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
              Préstamos en dólares y bolívares
            </p>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Revisa cuánto pagarías antes de acordar un préstamo.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Clientes, cuotas, abonos, mora y cobranza en un solo lugar, con la tasa BCV del día y cálculos exactos al céntimo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => openAuthModal('register')} className="btn-primary min-h-12 px-7 text-base">
                Empezar gratis
              </button>
              <button type="button" onClick={() => openAuthModal('login')} className="btn-secondary min-h-12 px-6">
                Ya tengo una cuenta
              </button>
            </div>
          </div>

          {/* Tarjeta de ejemplo: muestra cómo se ve un préstamo dentro de la app. */}
          <div aria-hidden="true" className="relative mx-auto w-full max-w-sm">
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-brand-50 dark:bg-brand-950/60" />
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-surface-cardDark">
              <p className="text-sm text-slate-600 dark:text-slate-400">Préstamo #12 · María Pérez</p>
              <p className="num mt-1 text-4xl font-extrabold">$ 1.250,00</p>
              <p className="num mt-1 text-sm text-slate-600 dark:text-slate-400">≈ Bs. 65.432,10</p>
              <div className="my-5 h-px bg-slate-200 dark:bg-slate-800" />
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600 dark:text-slate-400">Próxima cuota</dt><dd className="font-semibold">15/11 · $ 218,40</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600 dark:text-slate-400">Interés</dt><dd className="font-semibold">Sobre saldo</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600 dark:text-slate-400">Estado</dt><dd><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Al día</span></dd></div>
              </dl>
              <div className="mt-6 rounded-lg bg-brand-700 py-3 text-center text-sm font-semibold text-white">Registrar pago</div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 lg:px-6" aria-label="Servicios">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                <Icon size={26} className="text-brand-700 dark:text-brand-400" aria-hidden="true" />
                <h2 className="mt-4 text-base font-semibold">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto max-w-5xl px-4 lg:px-6">
          <section className="border-b border-slate-200 py-14 dark:border-slate-800 sm:py-20" aria-labelledby="como-funciona">
            <h2 id="como-funciona" className="text-2xl font-bold tracking-tight">Cómo funciona</h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{index + 1}</span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="py-14 sm:py-16" aria-labelledby="preguntas-frecuentes">
            <h2 id="preguntas-frecuentes" className="text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {faq.question}
                    <span aria-hidden="true" className="text-xl leading-none text-slate-500 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{faq.answer}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              PRGARCÍA es una herramienta de gestión. No otorga préstamos ni es una entidad financiera, y no está afiliada al Banco Central de Venezuela.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-surface-muted px-4 py-10 text-sm text-slate-600 dark:border-slate-800 dark:bg-surface-cardDark dark:text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:px-2">
          <div>
            <p className="font-semibold text-[#222222] dark:text-white">PRGARCÍA™ · Gestión de préstamos USD y VES.</p>
            <p className="mt-1">© 2026 PRGARCÍA. Todos los derechos reservados.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Información legal">
            <a href="/terminos" className="hover:underline">Términos</a>
            <a href="/privacidad" className="hover:underline">Privacidad</a>
            <a href="/aviso-legal" className="hover:underline">Aviso legal</a>
            {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">Contacto</a>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
