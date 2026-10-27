import { BadgePercent, CalendarClock, ChartColumn, HandCoins, Landmark, Moon, Sun, Users } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { BrandLogo } from './BrandLogo';
import { CONTACT_EMAIL } from '../config';

const FUNCIONES = [
  { icon: Users, title: 'Clientes en segundos', description: 'Crea al cliente solo con su nombre mientras haces el préstamo y completa su ficha después. Cada ficha reúne sus préstamos, pagos y contacto.' },
  { icon: Landmark, title: 'Préstamos a tu manera', description: 'En dólares o bolívares, con tasa diaria, semanal, quincenal o mensual. Con cuotas y fecha de fin, o sin fecha de fin pagando intereses por período.' },
  { icon: BadgePercent, title: 'Interés sobre lo que se debe', description: 'Cada abono a capital baja los intereses desde el día del pago. Elige si el abono reduce el plazo o el monto de las cuotas.' },
  { icon: HandCoins, title: 'Pagos en USD o Bs.', description: 'Registra pagos, abonos y cancelaciones totales en cualquiera de las dos monedas, convertidos a la tasa BCV del día. Un pago mal anotado se anula con su motivo.' },
  { icon: CalendarClock, title: 'Cobranza del día', description: 'Al entrar ves quién está atrasado, quién vence hoy y qué viene en la semana, con la mora calculada y botones para escribir por WhatsApp o llamar.' },
  { icon: ChartColumn, title: 'Reportes claros', description: 'Capital en la calle, antigüedad de la deuda, intereses cobrados y efecto del tipo de cambio. Todo se exporta en CSV.' },
];

const HOW_IT_WORKS = [
  {
    title: 'Estima y comparte',
    description: 'Usa la calculadora para ver la cuota o los intereses por período y envía la propuesta por WhatsApp.',
  },
  {
    title: 'Conviértela en préstamo',
    description: 'Con un toque los datos pasan al préstamo real. Elige o crea al cliente y el préstamo queda guardado con su cronograma de cobros.',
  },
  {
    title: 'Cobra y registra',
    description: 'Cada día la cobranza te dice a quién cobrar. Anota el pago y los saldos, la mora y los reportes se actualizan solos.',
  },
];

const FAQS = [
  {
    question: '¿Qué pasa si mi cliente abona al capital?',
    answer: 'El interés se calcula sobre el saldo pendiente: lo que abone deja de generar interés desde la fecha del pago. Puedes elegir si el abono acorta el plazo o baja el monto de las cuotas restantes.',
  },
  {
    question: '¿Puedo registrar préstamos sin fecha de fin?',
    answer: 'Sí. En un préstamo sin fecha de fin el cliente paga los intereses de cada período sobre el capital que debe y abona al capital cuando puede, hasta pagarlo completo.',
  },
  {
    question: '¿Cómo se manejan los pagos en bolívares?',
    answer: 'Cada pago se convierte a la tasa BCV del día en que se paga. En préstamos en dólares, los intereses y la mora pueden pagarse en bolívares, pero el capital se paga en dólares. Los préstamos en bolívares aceptan ambas monedas.',
  },
  {
    question: '¿Cómo se calcula la mora?',
    answer: 'Tú defines el porcentaje de mora diaria y los días de gracia de cada préstamo. La mora corre solo sobre lo vencido y aparece sumada en la cobranza del día.',
  },
  {
    question: '¿Puedo corregir un pago mal registrado?',
    answer: 'Sí. El pago se anula indicando el motivo y los saldos se recalculan. El registro original queda en el historial para que siempre sepas qué pasó.',
  },
  {
    question: '¿De dónde sale la tasa BCV?',
    answer: 'Se lee directamente del sitio oficial del Banco Central de Venezuela cada día. Si pactaste otra tasa con tu cliente, puedes escribirla al registrar el pago.',
  },
  {
    question: '¿Quién puede ver mis clientes y préstamos?',
    answer: 'Solo tu cuenta. Cada registro está protegido en la base de datos para que nadie más pueda leerlo, y cada cambio queda en una bitácora que no se puede alterar.',
  },
  {
    question: '¿Funciona en el teléfono?',
    answer: 'Sí. Está pensada primero para el teléfono, con letra grande y botones cómodos. Puedes instalarla en la pantalla de inicio y consultar lo último que viste aunque no tengas conexión.',
  },
  {
    question: '¿PRGARCÍA presta dinero o cobra por mí?',
    answer: 'No. Es una herramienta para que administres tus propios préstamos. No presta dinero, no procesa pagos y no envía mensajes sin que tú los revises.',
  },
  {
    question: '¿Cuánto cuesta?',
    answer: 'Por ahora es gratis. Si algún día hay planes de pago, se anunciarán con anticipación y nada se cobrará sin tu aceptación.',
  },
];

export function WelcomeHome() {
  const { openAuthModal } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-white text-[#222222] selection:bg-brand-700 selection:text-white dark:bg-surface-dark dark:text-[#F5F5F7]">
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-surface-dark/95">
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
              Tus préstamos y cobros en dólares y bolívares, en orden.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Registra clientes, crea préstamos con cuotas o sin fecha de fin, anota pagos a la tasa BCV del día y sabe cada mañana a quién cobrar.
              Los intereses bajan con cada abono a capital, calculados al céntimo.
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

        <section className="mx-auto max-w-6xl px-4 lg:px-6" aria-labelledby="funciones">
          <h2 id="funciones" className="text-2xl font-bold tracking-tight sm:text-3xl">Todo lo que necesitas para prestar con orden</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="rounded-2xl border-2 border-slate-200 p-6 dark:border-slate-800">
                <Icon size={28} className="text-brand-700 dark:text-brand-400" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
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
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-400">{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="border-b border-slate-200 py-14 dark:border-slate-800 sm:py-16" aria-labelledby="para-quien">
            <h2 id="para-quien" className="text-2xl font-bold tracking-tight">Para quién es</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Para personas y pequeños negocios que prestan su propio dinero a clientes, familiares o empleados y hoy llevan las cuentas en un cuaderno,
              una hoja de cálculo o de memoria. Si cobras por semana, por quincena o por mes, en dólares o en bolívares, PRGARCÍA hace las cuentas por ti.
            </p>
          </section>

          <section className="py-14 sm:py-16" aria-labelledby="preguntas-frecuentes">
            <h2 id="preguntas-frecuentes" className="text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    {faq.question}
                    <span aria-hidden="true" className="text-xl leading-none text-slate-500 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">{faq.answer}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
              PRGARCÍA es una herramienta de gestión. No otorga préstamos ni es una entidad financiera, y no está afiliada al Banco Central de Venezuela.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-surface-muted px-4 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-sm text-slate-600 dark:border-slate-800 dark:bg-surface-cardDark dark:text-slate-400">
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
