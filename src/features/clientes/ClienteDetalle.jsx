import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { Badge, Card, Empty, ErrorBox, Loading, Money, PageHeader, PrestamoBadge } from '../cartera/ui';
import { useAccion } from '../cartera/useAccion';
import { useMotivoDialog } from '../cartera/useMotivoDialog';
import { ClienteForm } from './ClienteForm';

export function ClienteDetalle({ id, navigate }) {
  const cliente = useRemote(() => api.getCliente(id), [id]);
  const prestamos = useRemote(() => api.listPrestamos({ clienteId: id }), [id]);
  const [editing, setEditing] = useState(false);
  const accion = useAccion();
  const confirmar = useMotivoDialog();

  if (cliente.loading) return <Loading label="Cargando cliente…" />;
  if (cliente.error) return <ErrorBox message={cliente.error} onRetry={cliente.reload} />;
  const c = cliente.data;

  const eliminar = async () => {
    const ok = await confirmar.pedir({
      titulo: `Eliminar a ${c.nombre}`, aviso: 'Esta acción no se puede deshacer.', confirmar: 'Eliminar', conMotivo: false,
    });
    if (ok) accion.run(() => api.deleteCliente(c.id), () => navigate('clientes'));
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
        <button type="button" onClick={eliminar} disabled={accion.busy} className="btn-ghost text-red-700 dark:text-red-300"><Trash2 size={16} /> Eliminar cliente</button>
        <ErrorBox message={accion.error} />
      </div>
      {confirmar.dialogo}
    </div>
  );
}
