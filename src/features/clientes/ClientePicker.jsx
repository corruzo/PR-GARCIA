import { useId, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { validateCliente } from '../../../shared/finance/input.js';
import * as api from '../cartera/api';
import { ErrorBox } from '../cartera/ui';

function documento(c) {
  return c.numero_documento ? `${c.tipo_documento}-${c.numero_documento}` : 'Sin documento';
}

/**
 * Busca un cliente activo o lo crea al instante solo con su nombre.
 * Los demás datos (documento, teléfono…) se completan después en su ficha.
 */
export function ClientePicker({ clientes, value, onChange, onCreated, error }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const activos = useMemo(() => clientes.filter((c) => c.estado === 'activo'), [clientes]);
  const seleccionado = clientes.find((c) => c.id === value);
  const nombre = query.trim().replace(/\s+/g, ' ');

  const resultados = useMemo(() => {
    const term = nombre.toLowerCase();
    const digits = term.replace(/\D/g, '');
    const list = term
      ? activos.filter((c) => c.nombre.toLowerCase().includes(term)
        || (digits && ((c.numero_documento ?? '').includes(digits) || (c.telefono ?? '').replace(/\D/g, '').includes(digits))))
      : activos;
    return list.slice(0, 6);
  }, [activos, nombre]);

  const existeIgual = activos.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase());

  const crear = async () => {
    const result = validateCliente({ nombre });
    if (!result.ok) {
      setCreateError(result.errors.nombre ?? 'Revisa el nombre.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const nuevo = await api.createCliente({ nombre: result.value.nombre });
      onCreated?.(nuevo);
      onChange(nuevo.id);
      setQuery('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700">
        <span className="flex min-w-0 items-center gap-3">
          <Check size={18} className="shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{seleccionado.nombre}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{documento(seleccionado)}</span>
          </span>
        </span>
        <button type="button" className="btn-ghost" aria-label="Cambiar de cliente" onClick={() => onChange('')}>
          <X size={16} aria-hidden="true" /> Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="label-base">Cliente</label>
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          id={inputId}
          className="input-base pl-10"
          placeholder="Escribe el nombre o la cédula…"
          value={query}
          maxLength={120}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          onChange={(e) => { setQuery(e.target.value); setCreateError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (resultados.length === 1) onChange(resultados[0].id);
              else if (nombre && !existeIgual && resultados.length === 0) crear();
            }
          }}
        />
      </div>
      {error && <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800" aria-label="Clientes encontrados">
        {resultados.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onChange(c.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="truncate font-medium">{c.nombre}</span>
              <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">{documento(c)}</span>
            </button>
          </li>
        ))}
        {nombre && !existeIgual && (
          <li>
            <button type="button" onClick={crear} disabled={creating}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-slate-800">
              <Plus size={16} aria-hidden="true" />
              {creating ? 'Creando…' : `Crear cliente «${nombre}»`}
            </button>
          </li>
        )}
        {!nombre && activos.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">Escribe el nombre para crear tu primer cliente.</li>
        )}
      </ul>
      {nombre && !existeIgual && (
        <p className="text-xs text-slate-600 dark:text-slate-400">Solo se pide el nombre; el resto se completa luego en su ficha.</p>
      )}
      <ErrorBox message={createError} />
    </div>
  );
}
