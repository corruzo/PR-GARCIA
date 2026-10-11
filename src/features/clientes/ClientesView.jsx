import { useMemo, useState } from 'react';
import { ArrowLeft, Phone, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { DOCUMENT_TYPES, validateCliente } from '../../../shared/finance/input.js';
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
        subtitle={`${c.tipo_documento}-${c.numero_documento}${c.telefono ? ` · ${c.telefono}` : ''}`}
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

function ClientesLista({ creating, navigate }) {
  const clientes = useRemote(() => api.listClientes(), []);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/[.\s-]/g, '');
    if (!term) return clientes.data ?? [];
    return (clientes.data ?? []).filter((c) =>
      c.nombre.toLowerCase().replace(/\s/g, '').includes(term) || c.numero_documento.toLowerCase().includes(term)
      || (c.telefono ?? '').replace(/\D/g, '').includes(term));
  }, [clientes.data, search]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Clientes"
        subtitle="Cartera de personas y empresas a las que prestas."
        actions={!creating && <button type="button" className="btn-primary" onClick={() => navigate('clientes', 'nuevo')}><UserPlus size={16} /> Nuevo cliente</button>}
      />

      {creating && (
        <Card title="Nuevo cliente">
          <ClienteForm onSaved={(saved) => navigate('clientes', saved.id)} onCancel={() => navigate('clientes')} />
        </Card>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <label htmlFor="clientes-buscar" className="sr-only">Buscar clientes</label>
        <input id="clientes-buscar" className="input-base pl-10" placeholder="Buscar por nombre, cédula o teléfono…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {clientes.loading ? <Loading label="Cargando clientes…" /> : clientes.error ? (
        <ErrorBox message={clientes.error} onRetry={clientes.reload} />
      ) : filtered.length === 0 ? (
        <Empty title={search ? 'Ningún cliente coincide con la búsqueda' : 'Aún no tienes clientes'}>
          {!search && 'Registra tu primer cliente para emitir préstamos a su nombre.'}
        </Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => navigate('clientes', c.id)} className="glass-card glass-card-hover flex w-full items-start justify-between gap-3 rounded-2xl p-4 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{c.nombre}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{c.tipo_documento}-{c.numero_documento}</span>
                  {c.telefono && <span className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Phone size={12} aria-hidden="true" />{c.telefono}</span>}
                </span>
                {c.estado !== 'activo' && <Badge tone={c.estado === 'bloqueado' ? 'red' : 'gray'}>{c.estado}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

