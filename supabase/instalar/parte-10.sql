-- PRGARCÍA · Instalación, parte 10 de 11. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 11) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261014000400_correcciones_permisos.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261014000400') then raise exception 'La migración 20261014000400 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
create or replace view public.v_cuotas_estado with (security_invoker = true) as
select
  c.id, c.prestamo_id, c.user_id, c.numero, c.fecha_vencimiento, c.dias,
  c.capital_cents, c.interes_cents, c.capital_pagado_cents, c.interes_pagado_cents, c.interes_descontado_cents,
  case when c.estado = 'anulada' then 0 else c.capital_cents - c.capital_pagado_cents end as capital_pendiente_cents,
  case when c.estado = 'anulada' then 0 else c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents end as interes_pendiente_cents,
  case when c.estado = 'anulada' then 0 else c.mora_devengada_cents - c.mora_pagada_cents
    + public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, public.fin_hoy()) end as mora_pendiente_cents,
  c.mora_pagada_cents,
  c.estado, c.pagada_en,
  case when c.estado in ('pagada', 'anulada') then 0
       else greatest(public.fin_hoy() - c.fecha_vencimiento, 0) end as dias_atraso,
  case
    when c.estado = 'anulada' then 'anulada'
    when c.estado = 'pagada' then 'pagada'
    when c.fecha_vencimiento < public.fin_hoy() then 'vencida'
    when c.fecha_vencimiento = public.fin_hoy() then 'vence_hoy'
    when c.fecha_vencimiento <= public.fin_hoy() + 7 then 'por_vencer'
    else 'al_dia' end as situacion
from public.cuotas c
join public.prestamos p on p.id = c.prestamo_id;
create or replace view public.v_prestamos_resumen with (security_invoker = true) as
select
  p.id, p.user_id, p.numero, p.cliente_id, cl.nombre as cliente_nombre,
  cl.tipo_documento || '-' || cl.numero_documento as cliente_documento, cl.telefono as cliente_telefono,
  p.moneda, p.capital_cents, p.interes_total_cents, p.total_cents, p.tasa_interes, p.modalidad_tasa,
  p.frecuencia_pago, p.metodo_interes, p.fecha_inicio, p.fecha_fin, p.tasa_cambio, p.fuente_tasa_cambio,
  p.tasa_mora_diaria, p.dias_gracia, p.estado, p.notas, p.created_at,
  (case when p.estado = 'anulado' then 0
        when p.tipo_plazo = 'abierto' then p.capital_cents - p.capital_pagado_cents
        else coalesce(sum(v.capital_pendiente_cents), 0) end)::bigint as capital_pendiente_cents,
  coalesce(sum(v.interes_pendiente_cents), 0)::bigint as interes_pendiente_cents,
  coalesce(sum(v.mora_pendiente_cents), 0)::bigint as mora_pendiente_cents,
  (coalesce(sum(v.capital_pagado_cents + v.interes_pagado_cents + v.mora_pagada_cents), 0) + p.capital_pagado_cents)::bigint as cobrado_cents,
  coalesce(sum(v.capital_pendiente_cents + v.interes_pendiente_cents + v.mora_pendiente_cents)
    filter (where v.situacion in ('vencida', 'vence_hoy')), 0)::bigint as exigible_hoy_cents,
  coalesce(max(v.dias_atraso), 0) as dias_atraso,
  min(v.fecha_vencimiento) filter (where v.situacion not in ('pagada', 'anulada')) as proximo_vencimiento,
  count(*) filter (where v.situacion = 'vencida') as cuotas_vencidas,
  count(*) filter (where v.situacion = 'pagada') as cuotas_pagadas,
  count(*) filter (where v.situacion <> 'anulada') as cuotas_total,
  p.tipo_plazo,
  coalesce(sum(v.interes_cents - v.interes_descontado_cents) filter (where v.situacion <> 'anulada'), 0)::bigint as interes_generado_cents
from public.prestamos p
join public.clientes cl on cl.id = p.cliente_id
left join public.v_cuotas_estado v on v.prestamo_id = p.id
group by p.id, cl.id;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
revoke execute on function
  public.fin_hoy(),
  public.fin_div_half_even(numeric, numeric),
  public.fin_interes_simple(bigint, numeric, integer, integer),
  public.fin_convertir(bigint, numeric, text, text),
  public.fin_repartir(bigint, bigint[]),
  public.fin_dias_modalidad(text),
  public.fin_dias_frecuencia(text),
  public.fin_validar_terminos(text, bigint, numeric, text, date, date, text, text),
  public.fin_cronograma(bigint, numeric, text, date, date, text, text),
  public.fin_texto_seguro(text, integer),
  public.fin_mora_adicional(public.cuotas, numeric, integer, date),
  public.fin_touch_updated_at(),
  public.previsualizar_cronograma(bigint, numeric, text, date, date, text, text),
  public.fin_validar_tasa_cambio(numeric, boolean),
  public.fin_formato_monto(bigint),
  public.fin_devengar_mora(uuid, date, uuid),
  public.fin_recalcular_abierto_desde(uuid, date),
  public.fin_inmutable(),
  public.fin_pago_inmutable(),
  public.fin_sin_borrado()
from public, anon;
revoke execute on function
  public.fin_devengar_mora(uuid, date, uuid),
  public.fin_recalcular_abierto_desde(uuid, date),
  public.fin_validar_tasa_cambio(numeric, boolean),
  public.fin_texto_seguro(text, integer),
  public.fin_touch_updated_at(),
  public.fin_inmutable(),
  public.fin_pago_inmutable(),
  public.fin_sin_borrado()
from authenticated;
grant execute on function
  public.fin_hoy(),
  public.fin_div_half_even(numeric, numeric),
  public.fin_interes_simple(bigint, numeric, integer, integer),
  public.fin_convertir(bigint, numeric, text, text),
  public.fin_dias_modalidad(text),
  public.fin_dias_frecuencia(text),
  public.fin_mora_adicional(public.cuotas, numeric, integer, date),
  public.fin_repartir(bigint, bigint[]),
  public.fin_validar_terminos(text, bigint, numeric, text, date, date, text, text),
  public.fin_cronograma(bigint, numeric, text, date, date, text, text),
  public.previsualizar_cronograma(bigint, numeric, text, date, date, text, text)
to authenticated;
revoke execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean) to authenticated;
revoke execute on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;
revoke execute on function public.anular_pagos_desde(uuid, text) from public, anon;
grant execute on function public.anular_pagos_desde(uuid, text) to authenticated;
insert into public.app_migraciones (version) values ('20261014000400') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261014000400') on conflict do nothing;
commit;
