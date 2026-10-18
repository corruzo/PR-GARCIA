import { useMemo, useState } from 'react';
import { ChevronRight, Search, UserPlus, X } from 'lucide-react';
import { iniciales, resumenPorCliente } from '../../../shared/finance/cobranza.js';
import { Contacto } from '../cartera/Contacto';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { Card, Empty, ErrorBox, Loading, Money } from '../cartera/ui';
import { ClienteRapido } from './ClienteForm';

const FILTROS_CLIENTES = [
  { value: 'todos', label: 'Todos' },
  { value: 'saldo', label: 'Con deuda' },
  { value: 'mora', label: 'En mora' },
];

function EstadoCliente({ cliente, resumen }) {
  if (cliente.estado !== 'activo') {
    return <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-800 dark:bg-slate-700 dark:text-white">{cliente.estado === 'bloqueado' ? 'Bloqueado' : 'Inactivo'}</span>;
  }
  if (resumen?.enMora) {
    return <span className="rounded-full bg-red-700 px-3 py-1 text-sm font-bold text-white">En mora · {resumen.diasAtraso} {resumen.diasAtraso === 1 ? 'día' : 'días'}</span>;
  }
  if (resumen?.activos) {
    return <span className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-bold text-white">Al día</span>;
  }
  return <span className="rounded-full border-2 border-slate-300 px-3 py-0.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Sin préstamos</span>;
}

function ClienteTarjeta({ cliente, resumen, onOpen }) {
  const saldos = Object.entries(resumen?.saldo ?? {}).filter(([, cents]) => cents > 0);
  return (
    <li className={`rounded-2xl border-2 bg-white p-4 dark:bg-surface-cardDark sm:p-5 ${resumen?.enMora ? 'border-red-300 dark:border-red-900' : 'border-slate-200 dark:border-slate-700'}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-4 text-left">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white">
          {iniciales(cliente.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-snug text-[#222222] dark:text-white sm:text-xl">{cliente.nombre}</span>
          <span className="mt-0.5 block text-base text-slate-700 dark:text-slate-200">
            {cliente.numero_documento ? `${cliente.tipo_documento}-${cliente.numero_documento}` : 'Sin cédula registrada'}
          </span>
          {cliente.telefono && <span className="block text-base text-slate-700 dark:text-slate-200">{cliente.telefono}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <EstadoCliente cliente={cliente} resumen={resumen} />
            {saldos.map(([moneda, cents]) => (
              <span key={moneda} className="text-base font-semibold text-[#222222] dark:text-white">
                Debe <Money cents={cents} currency={moneda} />
              </span>
            ))}
          </span>
        </span>
        <ChevronRight size={24} className="mt-4 shrink-0 text-slate-500" aria-hidden="true" />
      </button>
      {cliente.telefono && (
        <div className="mt-4 border-t-2 border-slate-100 pt-4 dark:border-slate-800">
          <Contacto telefono={cliente.telefono} nombre={cliente.nombre} />
        </div>
      )}
    </li>
  );
}

function loadClientes() {
  return Promise.all([api.listClientes(), api.listPrestamos()]).then(([clientes, prestamos]) => ({ clientes, prestamos }));
}

export function ClientesLista({ creating, navigate }) {
  const remote = useRemote(loadClientes, []);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const resumen = useMemo(() => resumenPorCliente(remote.data?.prestamos ?? []), [remote.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return (remote.data?.clientes ?? []).filter((c) => {
      const r = resumen.get(c.id);
      if (filtro === 'saldo' && !r?.activos) return false;
      if (filtro === 'mora' && !r?.enMora) return false;
      if (!term) return true;
      return c.nombre.toLowerCase().includes(term)
        || (digits && ((c.numero_documento ?? '').includes(digits) || (c.telefono ?? '').replace(/\D/g, '').includes(digits)));
    }).sort((a, b) => (resumen.get(b.id)?.diasAtraso ?? 0) - (resumen.get(a.id)?.diasAtraso ?? 0) || a.nombre.localeCompare(b.nombre));
  }, [remote.data, resumen, search, filtro]);

  const enMora = [...resumen.values()].filter((r) => r.enMora).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Clientes</h1>
          {remote.data && (
            <p className="mt-1 text-base text-slate-700 dark:text-slate-200">
              {remote.data.clientes.length} {remote.data.clientes.length === 1 ? 'cliente' : 'clientes'}
              {enMora > 0 && <> · <strong className="text-red-700 dark:text-red-400">{enMora} en mora</strong></>}
            </p>
          )}
        </div>
        {!creating && (
          <button type="button" className="btn-primary min-h-14 text-base sm:w-auto" onClick={() => navigate('clientes', 'nuevo')}>
            <UserPlus size={22} aria-hidden="true" /> Nuevo cliente
          </button>
        )}
      </div>

      {creating && (
        <Card title="Nuevo cliente">
          <ClienteRapido onSaved={(saved) => navigate('clientes', saved.id)} onCancel={() => navigate('clientes')} />
        </Card>
      )}

      <div className="relative">
        <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300" aria-hidden="true" />
        <label htmlFor="clientes-buscar" className="sr-only">Buscar clientes</label>
        <input id="clientes-buscar" type="search" className="input-base min-h-14 pl-12 pr-12 text-lg" placeholder="Buscar por nombre, cédula o teléfono"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && (
          <button type="button" aria-label="Borrar búsqueda" onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filtrar clientes" className="flex flex-wrap gap-2">
        {FILTROS_CLIENTES.map((f) => (
          <button key={f.value} type="button" aria-pressed={filtro === f.value} onClick={() => setFiltro(f.value)}
            className={`min-h-12 rounded-full border-2 px-5 text-base font-semibold transition-colors ${
              filtro === f.value
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-300 text-[#222222] hover:bg-slate-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {remote.loading ? <Loading label="Cargando clientes…" /> : remote.error ? (
        <ErrorBox message={remote.error} onRetry={remote.reload} />
      ) : filtered.length === 0 ? (
        <Empty title={search || filtro !== 'todos' ? 'Ningún cliente coincide' : 'Aún no tienes clientes'}>
          {!search && filtro === 'todos' && 'Pulsa «Nuevo cliente»: solo necesitas el nombre.'}
        </Empty>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {filtered.map((c) => (
            <ClienteTarjeta key={c.id} cliente={c} resumen={resumen.get(c.id)} onOpen={() => navigate('clientes', c.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
