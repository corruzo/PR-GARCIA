/**
 * api.js — Acceso a datos de cartera (Supabase).
 *
 * Lecturas: tablas y vistas protegidas por RLS.
 * Escrituras: clientes directamente (RLS); préstamos y pagos solo vía RPC,
 * que validan y recalculan en el servidor dentro de una transacción.
 */
import { supabase } from '../../utils/supabase/client';

const KNOWN_MESSAGES = [
  [/duplicate key.*clientes_user_id_tipo_documento/i, 'Ya existe un cliente con ese documento.'],
  [/violates foreign key constraint.*prestamos/i, 'No se puede eliminar: el cliente tiene préstamos registrados.'],
  [/check constraint/i, 'Algún dato no cumple el formato permitido. Revisa los campos.'],
  [/permission denied|row-level security|JWT/i, 'Tu sesión no tiene permiso para esta acción. Vuelve a iniciar sesión.'],
  [/Failed to fetch|NetworkError|network/i, 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'],
  [/Could not find the function|does not exist/i, 'La base de datos no está actualizada. Aplica las migraciones pendientes (docs/CAMBIOS_SUPABASE.md).'],
];

/** Traduce un error de Supabase/Postgres a un mensaje para el usuario. */
export function friendlyError(error) {
  const message = String(error?.message || error || '');
  for (const [pattern, text] of KNOWN_MESSAGES) {
    if (pattern.test(message)) return text;
  }
  // Las RPC lanzan mensajes en español pensados para el usuario (errcode 22023/P0002).
  if (['22023', 'P0002', 'P0001'].includes(error?.code) && message) return message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
  return data;
}

// ─── Clientes ───────────────────────────────────────────────────────────────

const CLIENTE_COLUMNS = 'id,tipo_documento,numero_documento,nombre,telefono,email,direccion,referencia,notas,limite_credito_cents,moneda_limite,estado,created_at';

export function listClientes() {
  return run(client().from('clientes').select(CLIENTE_COLUMNS).order('nombre'));
}

export function getCliente(id) {
  return run(client().from('clientes').select(CLIENTE_COLUMNS).eq('id', id).single());
}

export function createCliente(value) {
  return run(client().from('clientes').insert(value).select(CLIENTE_COLUMNS).single());
}

export function updateCliente(id, value) {
  return run(client().from('clientes').update(value).eq('id', id).select(CLIENTE_COLUMNS).single());
}

export function deleteCliente(id) {
  return run(client().from('clientes').delete().eq('id', id));
}

// ─── Préstamos ──────────────────────────────────────────────────────────────

export function listPrestamos({ clienteId } = {}) {
  let query = client().from('v_prestamos_resumen').select('*').order('numero', { ascending: false });
  if (clienteId) query = query.eq('cliente_id', clienteId);
  return run(query);
}

export function getPrestamo(id) {
  return run(client().from('v_prestamos_resumen').select('*').eq('id', id).single());
}

export function listCuotas(prestamoId) {
  return run(client().from('v_cuotas_estado').select('*').eq('prestamo_id', prestamoId).order('numero'));
}

export function emitirPrestamo(params) {
  return run(client().rpc('emitir_prestamo', {
    p_cliente_id: params.clienteId,
    p_moneda: params.moneda,
    p_capital_cents: params.capitalCents,
    p_tasa_interes: params.tasaInteres,
    p_modalidad_tasa: params.modalidadTasa,
    p_frecuencia_pago: params.frecuenciaPago,
    p_metodo_interes: params.metodoInteres,
    p_fecha_inicio: params.fechaInicio,
    p_fecha_fin: params.fechaFin,
    p_tasa_cambio: params.tasaCambio,
    p_fuente_tasa_cambio: params.fuenteTasaCambio,
    p_tasa_mora_diaria: params.tasaMoraDiaria,
    p_dias_gracia: params.diasGracia,
    p_notas: params.notas || null,
    p_cotizacion_origen: params.cotizacionOrigen || null,
    p_idempotency_key: params.idempotencyKey,
  }));
}

export function anularPrestamo(id, motivo) {
  return run(client().rpc('anular_prestamo', { p_prestamo_id: id, p_motivo: motivo }));
}

// ─── Pagos ──────────────────────────────────────────────────────────────────

export function listPagos(prestamoId) {
  return run(client().from('pagos')
    .select('id,fecha,tipo,modo_abono,metodo,referencia,notas,moneda_pago,monto_pago_cents,tasa_cambio,monto_prestamo_cents,estado,anulado_motivo,created_at,aplicaciones_pago(concepto,monto_cents)')
    .eq('prestamo_id', prestamoId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false }));
}

export function registrarPago(params) {
  return run(client().rpc('registrar_pago', {
    p_prestamo_id: params.prestamoId,
    p_fecha: params.fecha,
    p_moneda_pago: params.moneda,
    p_monto_pago_cents: params.montoCents,
    p_tasa_cambio: params.tasaCambio,
    p_tipo: params.tipo,
    p_modo_abono: params.modoAbono,
    p_metodo: params.metodo,
    p_referencia: params.referencia || null,
    p_notas: params.notas || null,
    p_idempotency_key: params.idempotencyKey,
  }));
}

export function anularPago(id, motivo) {
  return run(client().rpc('anular_pago', { p_pago_id: id, p_motivo: motivo }));
}

// ─── Cobranza y reportes ────────────────────────────────────────────────────

export function listCuotasPendientes({ hasta }) {
  return run(client().from('v_cuotas_estado')
    .select('id,prestamo_id,numero,fecha_vencimiento,capital_pendiente_cents,interes_pendiente_cents,mora_pendiente_cents,dias_atraso,situacion')
    .in('situacion', ['vencida', 'vence_hoy', 'por_vencer', 'al_dia'])
    .lte('fecha_vencimiento', hasta)
    .order('fecha_vencimiento'));
}

export function getAntiguedad() {
  return run(client().from('v_cartera_antiguedad').select('*'));
}

export function getCobranzaMensual() {
  return run(client().from('v_cobranza_mensual').select('*').order('mes', { ascending: false }).limit(24));
}

export function getLibroMayor() {
  return run(client().from('v_libro_mayor').select('*'));
}

export function getDiferencialCambiario(tasaActual) {
  return run(client().rpc('reporte_diferencial_cambiario', { p_tasa_actual: tasaActual ?? null }));
}

export function listAuditoria({ limit = 50 } = {}) {
  return run(client().from('auditoria').select('id,tabla,registro_id,accion,antes,despues,creado_en')
    .order('creado_en', { ascending: false }).limit(limit));
}

/** Monto que salda el préstamo completo en `fecha` (solo interés ganado en saldo insoluto). */
export function montoCancelacion(prestamoId, fecha) {
  return run(client().rpc('monto_cancelacion', { p_prestamo_id: prestamoId, p_fecha: fecha }));
}
