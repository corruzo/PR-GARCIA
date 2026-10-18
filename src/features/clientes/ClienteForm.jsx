import { useState } from 'react';
import { DOCUMENT_TYPES, validateCliente } from '../../../shared/finance/input.js';
import { fromCents } from '../../../shared/finance/money.js';
import * as api from '../cartera/api';
import { ErrorBox, Field } from '../cartera/ui';

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

export function ClienteForm({ cliente, onSaved, onCancel }) {
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
export function ClienteRapido({ onSaved, onCancel }) {
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
