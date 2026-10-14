-- PRGARCÍA · Instalación, parte 3 de 8. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 8) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261011000300_reportes_bimonetarios.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261011000300') then raise exception 'La migración 20261011000300 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
create or replace function public.fin_tasa_actual()
returns numeric language sql stable security definer set search_path = '' as $$
  select tasa from public.tasa_bcv where estado = 'ok' order by fecha_hora desc limit 1;
$$;
revoke execute on function public.fin_tasa_actual() from public, anon;
grant execute on function public.fin_tasa_actual() to authenticated;
create or replace view public.v_cartera_antiguedad with (security_invoker = true) as
select
  r.user_id,
  r.moneda,
  case
    when r.dias_atraso = 0 then '0_al_dia'
    when r.dias_atraso <= 30 then '1_1_30'
    when r.dias_atraso <= 60 then '2_31_60'
    when r.dias_atraso <= 90 then '3_61_90'
    else '4_mas_90' end as tramo,
  count(*) as prestamos,
  sum(r.capital_pendiente_cents)::bigint as capital_pendiente_cents,
  sum(r.interes_pendiente_cents)::bigint as interes_pendiente_cents,
  sum(r.mora_pendiente_cents)::bigint as mora_pendiente_cents,
  sum(r.exigible_hoy_cents)::bigint as exigible_hoy_cents
from public.v_prestamos_resumen r
where r.estado = 'activo'
group by r.user_id, r.moneda, 3;
create or replace view public.v_cobranza_mensual with (security_invoker = true) as
with esperado as (
  select c.user_id, p.moneda, date_trunc('month', c.fecha_vencimiento)::date as mes,
         sum(c.capital_cents + c.interes_cents - c.interes_descontado_cents)::bigint as esperado_cents
  from public.cuotas c join public.prestamos p on p.id = c.prestamo_id
  where c.estado <> 'anulada'
  group by 1, 2, 3
), cobrado as (
  select pg.user_id, p.moneda, date_trunc('month', pg.fecha)::date as mes,
         sum(pg.monto_prestamo_cents)::bigint as cobrado_cents,
         sum(public.fin_convertir(pg.monto_prestamo_cents, pg.tasa_cambio, p.moneda, 'USD'))::bigint as cobrado_usd_cents
  from public.pagos pg join public.prestamos p on p.id = pg.prestamo_id
  where pg.estado = 'aplicado'
  group by 1, 2, 3
)
select coalesce(e.user_id, c.user_id) as user_id, coalesce(e.moneda, c.moneda) as moneda,
       coalesce(e.mes, c.mes) as mes, coalesce(e.esperado_cents, 0) as esperado_cents,
       coalesce(c.cobrado_cents, 0) as cobrado_cents, coalesce(c.cobrado_usd_cents, 0) as cobrado_usd_cents
from esperado e full join cobrado c on c.user_id = e.user_id and c.moneda = e.moneda and c.mes = e.mes;
create or replace view public.v_libro_mayor with (security_invoker = true) as
select l.user_id, a.moneda, l.cuenta,
       sum(l.debe_cents)::bigint as debe_cents, sum(l.haber_cents)::bigint as haber_cents,
       sum(l.debe_cents - l.haber_cents)::bigint as saldo_cents,
       sum(case when l.debe_cents > 0 then l.equivalente_usd_cents else -l.equivalente_usd_cents end)::bigint as saldo_usd_historico_cents
from public.asiento_lineas l join public.asientos a on a.id = l.asiento_id
group by l.user_id, a.moneda, l.cuenta;
create or replace function public.reporte_diferencial_cambiario(p_tasa_actual numeric default null)
returns table (
  prestamo_id uuid, numero integer, cliente_nombre text, tasa_desembolso numeric, tasa_actual numeric,
  capital_pendiente_ves_cents bigint, pendiente_usd_desembolso_cents bigint, pendiente_usd_actual_cents bigint,
  diferencial_no_realizado_usd_cents bigint, capital_cobrado_ves_cents bigint,
  cobrado_usd_desembolso_cents bigint, cobrado_usd_real_cents bigint, diferencial_realizado_usd_cents bigint
) language plpgsql stable security invoker set search_path = '' as $$
declare
  tasa numeric := coalesce(p_tasa_actual, public.fin_tasa_actual());
begin
  if tasa is null or tasa <= 0 then raise exception 'No hay una tasa de cambio disponible' using errcode = '22023'; end if;
  return query
  with cobros as (
    select pg.prestamo_id, sum(a.monto_cents)::bigint as capital_ves,
           sum(public.fin_convertir(a.monto_cents, pg.tasa_cambio, 'VES', 'USD'))::bigint as capital_usd_real
    from public.aplicaciones_pago a join public.pagos pg on pg.id = a.pago_id
    where a.concepto = 'capital' and pg.estado = 'aplicado'
    group by pg.prestamo_id
  )
  select r.id, r.numero, r.cliente_nombre, r.tasa_cambio::numeric, tasa,
         r.capital_pendiente_cents,
         public.fin_convertir(r.capital_pendiente_cents, r.tasa_cambio, 'VES', 'USD'),
         public.fin_convertir(r.capital_pendiente_cents, tasa, 'VES', 'USD'),
         public.fin_convertir(r.capital_pendiente_cents, tasa, 'VES', 'USD')
           - public.fin_convertir(r.capital_pendiente_cents, r.tasa_cambio, 'VES', 'USD'),
         coalesce(cb.capital_ves, 0),
         public.fin_convertir(coalesce(cb.capital_ves, 0), r.tasa_cambio, 'VES', 'USD'),
         coalesce(cb.capital_usd_real, 0),
         coalesce(cb.capital_usd_real, 0) - public.fin_convertir(coalesce(cb.capital_ves, 0), r.tasa_cambio, 'VES', 'USD')
  from public.v_prestamos_resumen r
  left join cobros cb on cb.prestamo_id = r.id
  where r.moneda = 'VES' and r.estado <> 'anulado'
  order by r.numero;
end;
$$;
revoke execute on function public.reporte_diferencial_cambiario(numeric) from public, anon;
grant execute on function public.reporte_diferencial_cambiario(numeric) to authenticated;
grant select on public.v_cartera_antiguedad, public.v_cobranza_mensual, public.v_libro_mayor to authenticated;
revoke all on public.v_cartera_antiguedad, public.v_cobranza_mensual, public.v_libro_mayor from anon;
insert into public.app_migraciones (version) values ('20261011000300') on conflict do nothing;
-- 20261011000400_auditoria.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261011000400') then raise exception 'La migración 20261011000400 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
create table public.auditoria (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  actor_id uuid,
  tabla text not null,
  registro_id uuid not null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);
create index auditoria_user_fecha_idx on public.auditoria (user_id, creado_en desc);
create index auditoria_registro_idx on public.auditoria (registro_id);
alter table public.auditoria enable row level security;
create policy auditoria_select on public.auditoria for select to authenticated using (user_id = auth.uid());
revoke all on public.auditoria from anon;
revoke insert, update, delete, truncate on public.auditoria from authenticated;
grant select on public.auditoria to authenticated;
create or replace function public.fin_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb := to_jsonb(coalesce(new, old));
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;
  insert into public.auditoria (user_id, actor_id, tabla, registro_id, accion, antes, despues)
  values ((fila ->> 'user_id')::uuid, auth.uid(), tg_table_name, (fila ->> 'id')::uuid, tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.fin_auditar() from public, anon, authenticated;
create trigger clientes_auditoria after insert or update or delete on public.clientes
  for each row execute function public.fin_auditar();
create trigger prestamos_auditoria after insert or update or delete on public.prestamos
  for each row execute function public.fin_auditar();
create trigger pagos_auditoria after insert or update or delete on public.pagos
  for each row execute function public.fin_auditar();
insert into public.app_migraciones (version) values ('20261011000400') on conflict do nothing;
commit;
