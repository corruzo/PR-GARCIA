import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toDisplayDate } from '../../../shared/finance/dates.js';
import { FRECUENCIA_ADJETIVO as FRECUENCIA } from '../../../shared/catalogos.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { Empty, ErrorBox, Loading, Money, PageHeader, PrestamoBadge, SegmentedControl } from '../cartera/ui';

const FILTROS = [
  { value: 'activos', label: 'Activos' },
  { value: 'mora', label: 'En mora' },
  { value: 'pagados', label: 'Pagados' },
  { value: 'todos', label: 'Todos' },
];

export function PrestamosLista({ navigate }) {
  const prestamos = useRemote(() => api.listPrestamos(), []);
  const [filtro, setFiltro] = useState('activos');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (prestamos.data ?? []).filter((p) => {
      if (filtro === 'activos' && p.estado !== 'activo') return false;
      if (filtro === 'mora' && !(p.estado === 'activo' && p.cuotas_vencidas > 0)) return false;
      if (filtro === 'pagados' && p.estado !== 'pagado') return false;
      if (!term) return true;
      return p.cliente_nombre.toLowerCase().includes(term) || String(p.numero) === term.replace('#', '')
        || (p.cliente_documento ?? '').toLowerCase().includes(term);
    });
  }, [prestamos.data, filtro, search]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Préstamos" subtitle="Cartera emitida, saldos y vencimientos."
        actions={<button type="button" className="btn-primary" onClick={() => navigate('prestamos', 'nuevo')}><Plus size={16} /> Nuevo préstamo</button>} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="prestamos-buscar" className="sr-only">Buscar préstamos</label>
          <input id="prestamos-buscar" className="input-base pl-10" placeholder="Cliente, cédula o número…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <SegmentedControl label="Mostrar" value={filtro} onChange={setFiltro} options={FILTROS} />
      </div>
      {prestamos.loading ? <Loading label="Cargando préstamos…" /> : prestamos.error ? (
        <ErrorBox message={prestamos.error} onRetry={prestamos.reload} />
      ) : filtered.length === 0 ? (
        <Empty title="No hay préstamos en esta vista">Emite un préstamo desde aquí o desde la ficha de un cliente.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => navigate('prestamos', p.id)} className="glass-card glass-card-hover flex w-full flex-col gap-3 rounded-2xl p-4 text-left">
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">#{p.numero} · {p.cliente_nombre}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Capital <Money cents={p.capital_cents} currency={p.moneda} /> · {p.tipo_plazo === 'abierto' ? `sin fecha de fin · interés ${FRECUENCIA[p.frecuencia_pago]}` : FRECUENCIA[p.frecuencia_pago]}</span>
                  </span>
                  <PrestamoBadge prestamo={p} />
                </span>
                {p.estado === 'activo' && (
                  <span className="grid w-full grid-cols-2 gap-2 text-xs">
                    <span><span className="block text-slate-500 dark:text-slate-400">Pendiente</span><Money className="font-bold" cents={p.capital_pendiente_cents + p.interes_pendiente_cents + p.mora_pendiente_cents} currency={p.moneda} /></span>
                    <span><span className="block text-slate-500 dark:text-slate-400">Próximo vencimiento</span>{p.proximo_vencimiento ? toDisplayDate(p.proximo_vencimiento) : '—'}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
