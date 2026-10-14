import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { DOCUMENT_TYPES, validateCliente } from '../../../shared/finance/input.js';
import { iniciales, resumenPorCliente } from '../../../shared/finance/cobranza.js';
import { Contacto } from '../cartera/Contacto';
import { fromCents } from '../../../shared/finance/money.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Money, PageHeader, PrestamoBadge } from '../cartera/ui';

const EMPTY_FORM = {
  tipo_documento: 'V', numero_documento: '', nombre: '', telefono: '', email: '',
  direccion: '', referencia: '', notas: '', limite_credito: '', moneda_limite: 'USD',
};

function toForm(cliente) {
  if (!cliente) return EMPTY_FORM;
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries(Object.entries(cliente).map(([k, v]) => [k, v ?? ''])),
    limite_credito: cliente.limite_credito_cents != null ? String(fromCents(cliente.limite_credito_cents)) : '',
  };
}

function ClienteForm({ cliente, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(cliente));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const result = validateCliente(form);
    setErrors(result.errors);
    if (!result.ok) return;
    setSaving(true);
    setSubmitError('');
    try {
      const estado = ['activo', 'bloqueado', 'inactivo'].includes(form.estado) ? form.estado : 'activo';
      const saved = cliente
        ? await api.updateCliente(cliente.id, { ...result.value, estado })
        : await api.createCliente(result.value);
      onSaved(saved);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const input = (key, props = {}) => (
    <Field id={`cliente-${key}`} label={props.label} error={errors[key]} hint={props.hint}>
      {(a11y) => (
        <input {...a11y} className="input-base" value={form[key]} onChange={set(key)} maxLength={props.maxLength}
          type={props.type || 'text'} inputMode={props.inputMode} autoComplete={props.autoComplete || 'off'} required={props.required} />
      )}
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field id="cliente-tipo" label="Tipo" error={errors.tipo_documento}>
          {(a11y) => (
            <select {...a11y} className="input-base" value={form.tipo_documento} onChange={set('tipo_documento')}>
              {Object.entries(DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
        </Field>
        {input('numero_documento', { label: 'Número de documento', inputMode: 'numeric', maxLength: 24, required: true, hint: 'Cédula o RIF sin puntos.' })}
      </div>
      {input('nombre', { label: 'Nombre completo', maxLength: 120, required: true, autoComplete: 'name' })}
      <div className="grid gap-4 sm:grid-cols-2">
        {input('telefono', { label: 'Teléfono (WhatsApp)', type: 'tel', inputMode: 'tel', maxLength: 20, hint: 'Ej. 0414-1234567' })}
        {input('email', { label: 'Correo', type: 'email', inputMode: 'email', maxLength: 254 })}
      </div>
      {input('direccion', { label: 'Dirección', maxLength: 300 })}
      {input('referencia', { label: 'Referencia personal', maxLength: 300, hint: 'Nombre y teléfono de un contacto.' })}
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        {input('limite_credito', { label: 'Límite de crédito (opcional)', inputMode: 'decimal', maxLength: 24 })}
        <Field id="cliente-moneda-limite" label="Moneda">
          {(a11y) => (
            <select {...a11y} className="input-base" value={form.moneda_limite} onChange={set('moneda_limite')}>
              <option value="USD">USD</option>
              <option value="VES">VES</option>
            </select>
          )}
        </Field>
      </div>
      <Field id="cliente-notas" label="Notas" error={errors.notas}>
        {(a11y) => <textarea {...a11y} className="input-base min-h-20" maxLength={1000} value={form.notas} onChange={set('notas')} />}
      </Field>
      {cliente && (
        <Field id="cliente-estado" label="Estado">
          {(a11y) => (
            <select {...a11y} className="input-base" value={form.estado} onChange={set('estado')}>
              <option value="activo">Activo</option>
              <option value="bloqueado">Bloqueado (no recibe préstamos)</option>
              <option value="inactivo">Inactivo</option>
            </select>
          )}
        </Field>
      )}
      <ErrorBox message={submitError} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Registrar cliente'}</button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}

/** Alta rápida: solo el nombre (y teléfono si lo tienes a mano). */
function ClienteRapido({ onSaved, onCancel }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const result = validateCliente({ nombre, telefono });
    setErrors(result.errors);
    if (!result.ok) return;
    setSaving(true);
    setSubmitError('');
    try {
      onSaved(await api.createCliente({ nombre: result.value.nombre, telefono: result.value.telefono }));
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rapido-nombre" label="Nombre" error={errors.nombre}>
          {(a11y) => <input {...a11y} className="input-base" maxLength={120} autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />}
        </Field>
        <Field id="rapido-telefono" label="Teléfono (opcional)" error={errors.telefono}>
          {(a11y) => <input {...a11y} className="input-base" type="tel" inputMode="tel" maxLength={20} value={telefono} onChange={(e) => setTelefono(e.target.value)} />}
        </Field>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">La cédula, dirección y referencias se completan después en la ficha del cliente.</p>
      <ErrorBox message={submitError} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear cliente'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function ClienteDetalle({ id, navigate }) {
  const cliente = useRemote(() => api.getCliente(id), [id]);
  const prestamos = useRemote(() => api.listPrestamos({ clienteId: id }), [id]);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (cliente.loading) return <Loading label="Cargando cliente…" />;
  if (cliente.error) return <ErrorBox message={cliente.error} onRetry={cliente.reload} />;
  const c = cliente.data;

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar a ${c.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteCliente(c.id);
      navigate('clientes');
    } catch (error) {
      setDeleteError(error.message);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" className="btn-ghost -ml-3" onClick={() => navigate('clientes')}><ArrowLeft size={16} /> Clientes</button>
      <PageHeader
        title={c.nombre}
        subtitle={`${c.numero_documento ? `${c.tipo_documento}-${c.numero_documento}` : 'Sin documento'}${c.telefono ? ` · ${c.telefono}` : ''}`}
        actions={(
          <>
            <button type="button" className="btn-primary" disabled={c.estado !== 'activo'} onClick={() => navigate('prestamos', 'nuevo', { cliente: c.id })}>
              <Plus size={16} /> Nuevo préstamo
            </button>
            {!editing && <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Editar datos</button>}
          </>
        )}
      />
      {c.estado !== 'activo' && <Badge tone="amber">Cliente {c.estado}: no puede recibir préstamos nuevos</Badge>}

      {!editing && (!c.numero_documento || !c.telefono) && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-100 sm:flex-row sm:items-center sm:justify-between">
          <span>Completa la ficha: {[!c.numero_documento && 'cédula o RIF', !c.telefono && 'teléfono'].filter(Boolean).join(' y ')}.</span>
          <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Completar ficha</button>
        </div>
      )}

      {editing && (
        <Card title="Editar cliente">
          <ClienteForm cliente={c} onSaved={() => { setEditing(false); cliente.reload(); }} onCancel={() => setEditing(false)} />
        </Card>
      )}

      <Card title="Préstamos">
        {prestamos.loading ? <Loading /> : prestamos.error ? <ErrorBox message={prestamos.error} onRetry={prestamos.reload} /> : prestamos.data.length === 0 ? (
          <Empty title="Sin préstamos todavía">Usa «Nuevo préstamo» para emitir el primero.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {prestamos.data.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate('prestamos', p.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">Préstamo #{p.numero}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Capital <Money cents={p.capital_cents} currency={p.moneda} /> · pendiente <Money cents={p.capital_pendiente_cents + p.interes_pendiente_cents} currency={p.moneda} /></span>
                  </span>
                  <PrestamoBadge prestamo={p} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {c.notas && <Card title="Notas"><p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{c.notas}</p></Card>}

      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={eliminar} className="btn-ghost text-red-700 dark:text-red-300"><Trash2 size={16} /> Eliminar cliente</button>
        <ErrorBox message={deleteError} />
      </div>
    </div>
  );
}

export function ClientesView({ route, navigate }) {
  if (route.id && route.id !== 'nuevo') return <ClienteDetalle id={route.id} navigate={navigate} />;
  return <ClientesLista creating={route.id === 'nuevo'} navigate={navigate} />;
}

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

function ClientesLista({ creating, navigate }) {
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
