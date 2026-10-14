import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, HandCoins, RefreshCw } from 'lucide-react';
import { addDaysISO, todayCaracas, toDisplayDate } from '../../../shared/finance/dates.js';
import { AGING_LABELS, buildPaymentReminder } from '../../../shared/finance/report.js';
import { agendaCobranza } from '../../../shared/finance/cobranza.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { Contacto } from '../cartera/Contacto';
import { ErrorBox, Loading, Money } from '../cartera/ui';

function loadCobranza() {
  const hasta = addDaysISO(todayCaracas(), 7);
  return Promise.all([api.listCuotasPendientes({ hasta }), api.listPrestamos(), api.getAntiguedad()])
    .then(([cuotas, prestamos, antiguedad]) => ({ cuotas, prestamos, antiguedad }));
}

function fechaLarga(iso) {
  const texto = new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const TONOS = {
  rojo: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100',
  ambar: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
  neutro: 'border-slate-200 bg-white text-[#222222] dark:border-slate-700 dark:bg-surface-cardDark dark:text-white',
};

function Total({ tono, icon: Icon, titulo, montos, detalle }) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${TONOS[tono]}`}>
      <p className="flex items-center gap-2 text-base font-bold"><Icon size={22} aria-hidden="true" />{titulo}</p>
      <div className="mt-2 space-y-1">
        {montos.length === 0 ? <p className="text-2xl font-extrabold">—</p> : montos.map(([moneda, cents]) => (
          <p key={moneda} className="text-3xl font-extrabold leading-tight"><Money cents={cents} currency={moneda} /></p>
        ))}
      </div>
      {detalle && <p className="mt-1 text-base">{detalle}</p>}
    </div>
  );
}

function Seccion({ titulo, icon: Icon, children, cantidad }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
        <Icon size={24} aria-hidden="true" /> {titulo}
        <span className="rounded-full bg-slate-200 px-3 py-0.5 text-base font-bold text-[#222222] dark:bg-slate-700 dark:text-white">{cantidad}</span>
      </h2>
      <ul className="grid gap-4 lg:grid-cols-2">{children}</ul>
    </section>
  );
}

function TarjetaCobro({ item, tipo, navigate }) {
  const p = item.prestamo;
  const montoHoy = item.atrasadoCents + item.hoyCents;
  const monto = tipo === 'semana' ? item.semanaCents : montoHoy;
  const mensaje = buildPaymentReminder({
    clienteNombre: p.cliente_nombre, numero: p.numero, moneda: p.moneda,
    exigibleCents: monto, moraCents: item.moraCents,
    proximoVencimiento: item.proximaFecha ?? todayCaracas(), diasAtraso: tipo === 'atrasado' ? item.diasAtraso : 0,
  });

  return (
    <li className={`rounded-2xl border-2 bg-white p-5 dark:bg-surface-cardDark ${tipo === 'atrasado' ? 'border-red-300 dark:border-red-900' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold leading-snug text-[#222222] dark:text-white">{p.cliente_nombre}</p>
          <p className="text-base text-slate-700 dark:text-slate-200">Préstamo #{p.numero}{p.tipo_plazo === 'abierto' ? ' · sin fecha de fin' : ''}</p>
        </div>
        {tipo === 'atrasado' && (
          <span className="rounded-full bg-red-700 px-3 py-1 text-base font-bold text-white">
            {item.diasAtraso} {item.diasAtraso === 1 ? 'día' : 'días'} de atraso
          </span>
        )}
        {tipo === 'hoy' && <span className="rounded-full bg-amber-500 px-3 py-1 text-base font-bold text-[#222222]">Vence hoy</span>}
      </div>

      <div className="mt-4">
        <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
          {tipo === 'semana' ? `Vence el ${fechaLarga(item.proximaFecha).toLowerCase()}` : 'Debe cobrar hoy'}
        </p>
        <p className="text-3xl font-extrabold leading-tight text-[#222222] dark:text-white"><Money cents={monto} currency={p.moneda} /></p>
        {item.moraCents > 0 && (
          <p className="text-base text-red-800 dark:text-red-300">Incluye <Money cents={item.moraCents} currency={p.moneda} /> de mora</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" className="btn-primary min-h-12 text-base" onClick={() => navigate('prestamos', p.id)}>
          <HandCoins size={20} aria-hidden="true" /> Registrar pago
        </button>
        {p.cliente_telefono
          ? <Contacto telefono={p.cliente_telefono} nombre={p.cliente_nombre} mensaje={mensaje} />
          : <p className="self-center text-base text-slate-700 dark:text-slate-200">Sin teléfono registrado</p>}
      </div>
    </li>
  );
}

export function CobranzaView({ navigate }) {
  const remote = useRemote(loadCobranza, []);
  const agenda = useMemo(
    () => (remote.data ? agendaCobranza(remote.data.prestamos, remote.data.cuotas) : null),
    [remote.data],
  );

  if (remote.loading) return <Loading label="Preparando los cobros de hoy…" />;
  if (remote.error) return <ErrorBox message={remote.error} onRetry={remote.reload} />;

  const totales = Object.entries(agenda.totales);
  const montos = (key) => totales.filter(([, t]) => t[key] > 0).map(([moneda, t]) => [moneda, t[key]]);
  const atrasados = totales.reduce((s, [, t]) => s + t.prestamosAtrasados, 0);
  const nada = !agenda.atrasados.length && !agenda.hoy.length && !agenda.semana.length;
  const antiguedad = (remote.data.antiguedad ?? []).slice().sort((a, b) => a.moneda.localeCompare(b.moneda) || a.tramo.localeCompare(b.tramo));

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Cobranza</h1>
          <p className="mt-1 text-lg text-slate-700 dark:text-slate-200">{fechaLarga(todayCaracas())}</p>
        </div>
        <button type="button" className="btn-secondary min-h-12 text-base" onClick={remote.reload}>
          <RefreshCw size={18} aria-hidden="true" /> Actualizar
        </button>
      </div>

      {nada ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 size={48} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">No hay cobros pendientes esta semana</p>
          <p className="text-base text-emerald-900 dark:text-emerald-200">Todos tus clientes están al día.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Total tono="rojo" icon={AlertTriangle} titulo="Atrasado" montos={montos('atrasadoCents')}
            detalle={atrasados ? `${atrasados} ${atrasados === 1 ? 'préstamo' : 'préstamos'} en mora` : 'Nadie atrasado'} />
          <Total tono="ambar" icon={Clock} titulo="Vence hoy" montos={montos('hoyCents')}
            detalle={agenda.hoy.length ? `${agenda.hoy.length} ${agenda.hoy.length === 1 ? 'cliente' : 'clientes'} al día` : 'Nadie más vence hoy'} />
          <Total tono="neutro" icon={CalendarClock} titulo="Próximos 7 días" montos={montos('semanaCents')}
            detalle={`${agenda.conVencimientoSemana} ${agenda.conVencimientoSemana === 1 ? 'préstamo con cuota' : 'préstamos con cuota'}`} />
        </div>
      )}

      {agenda.atrasados.length > 0 && (
        <Seccion titulo="Cobrar primero: atrasados" icon={AlertTriangle} cantidad={agenda.atrasados.length}>
          {agenda.atrasados.map((item) => <TarjetaCobro key={item.prestamo.id} item={item} tipo="atrasado" navigate={navigate} />)}
        </Seccion>
      )}
      {agenda.hoy.length > 0 && (
        <Seccion titulo="Vencen hoy" icon={Clock} cantidad={agenda.hoy.length}>
          {agenda.hoy.map((item) => <TarjetaCobro key={item.prestamo.id} item={item} tipo="hoy" navigate={navigate} />)}
        </Seccion>
      )}
      {agenda.semana.length > 0 && (
        <Seccion titulo="Esta semana" icon={CalendarClock} cantidad={agenda.semana.length}>
          {agenda.semana.map((item) => <TarjetaCobro key={item.prestamo.id} item={item} tipo="semana" navigate={navigate} />)}
        </Seccion>
      )}

      {antiguedad.length > 0 && (
        <details className="rounded-2xl border-2 border-slate-200 p-5 dark:border-slate-700">
          <summary className="cursor-pointer text-lg font-bold">Ver antigüedad de la cartera</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-base">
              <caption className="sr-only">Saldo pendiente por días de atraso</caption>
              <thead>
                <tr className="border-b-2 border-slate-200 text-left dark:border-slate-700">
                  <th scope="col" className="py-2 pr-3">Atraso</th>
                  <th scope="col" className="py-2 pr-3 text-right">Préstamos</th>
                  <th scope="col" className="py-2 text-right">Capital pendiente</th>
                </tr>
              </thead>
              <tbody>
                {antiguedad.map((row) => (
                  <tr key={`${row.moneda}-${row.tramo}`} className="border-b border-slate-100 dark:border-slate-800">
                    <th scope="row" className="py-3 pr-3 text-left font-semibold">{AGING_LABELS[row.tramo]} <span className="text-slate-700 dark:text-slate-300">({row.moneda})</span></th>
                    <td className="py-3 pr-3 text-right">{row.prestamos}</td>
                    <td className="py-3 text-right font-semibold"><Money cents={row.capital_pendiente_cents} currency={row.moneda} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="text-base text-slate-700 dark:text-slate-200">
        Los montos incluyen la mora calculada hasta hoy ({toDisplayDate(todayCaracas())}).
      </p>
    </div>
  );
}
