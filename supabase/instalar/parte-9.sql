-- PRGARCÍA · Instalación, parte 9 de 12. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 12) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261014000300_correcciones_anulaciones.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261014000300') then raise exception 'La migración 20261014000300 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  motivo text := public.fin_texto_seguro(p_motivo, 300);
  pg public.pagos;
  p public.prestamos;
  a record;
  m record;
  original uuid;
  asiento uuid;
  linea record;
begin
  if motivo is null then raise exception 'Indica el motivo de la anulación' using errcode = '22023'; end if;
  select * into pg from public.pagos where id = p_pago_id and user_id = uid;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0002'; end if;
  select * into p from public.prestamos where id = pg.prestamo_id for update;
  select * into pg from public.pagos where id = p_pago_id for update;
  if pg.estado <> 'aplicado' then raise exception 'El pago ya está anulado' using errcode = '22023'; end if;
  if exists (select 1 from public.pagos where prestamo_id = pg.prestamo_id and estado = 'aplicado'
             and (fecha, created_at) > (pg.fecha, pg.created_at)) then
    raise exception 'Solo se puede anular el último pago del préstamo' using errcode = '22023';
  end if;
  for a in select * from public.aplicaciones_pago where pago_id = pg.id loop
    if a.cuota_id is null then
      update public.prestamos set capital_pagado_cents = capital_pagado_cents - a.monto_cents where id = pg.prestamo_id;
      continue;
    end if;
    update public.cuotas set
      mora_pagada_cents = mora_pagada_cents - case when a.concepto = 'mora' then a.monto_cents else 0 end,
      interes_pagado_cents = interes_pagado_cents - case when a.concepto = 'interes' then a.monto_cents else 0 end,
      capital_pagado_cents = capital_pagado_cents - case when a.concepto = 'capital' then a.monto_cents else 0 end,
      interes_descontado_cents = interes_descontado_cents - case when a.concepto = 'descuento_interes' then a.monto_cents else 0 end
    where id = a.cuota_id;
  end loop;
  for m in select * from public.pagos_mora where pago_id = pg.id order by id desc loop
    update public.cuotas set mora_devengada_cents = mora_devengada_cents - m.mora_cents,
      mora_calculada_hasta = m.calculada_hasta_anterior
    where id = m.cuota_id;
  end loop;
  update public.pagos set estado = 'anulado', anulado_motivo = motivo, anulado_en = now() where id = pg.id;
  if p.estado = 'pagado' then update public.prestamos set estado = 'activo' where id = p.id; end if;
  perform public.fin_actualizar_estados(p.id, pg.fecha);
  if p.tipo_plazo = 'abierto' then
    perform public.fin_recalcular_abierto_desde(p.id, pg.fecha);
    perform public.fin_sincronizar_abierto(p.id, public.fin_hoy());
    perform public.fin_actualizar_estados(p.id, pg.fecha);
  end if;
  select id into original from public.asientos where pago_id = pg.id and tipo = 'cobro';
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, pago_id, moneda, tasa_cambio, descripcion)
  values (uid, public.fin_hoy(), 'reverso_cobro', p.id, pg.id, p.moneda, pg.tasa_cambio,
    'Anulación de cobro préstamo #' || p.numero || ': ' || motivo)
  returning id into asiento;
  for linea in select * from public.asiento_lineas where asiento_id = original loop
    insert into public.asiento_lineas (asiento_id, user_id, cuenta, debe_cents, haber_cents, equivalente_usd_cents,
      moneda_original, monto_original_cents)
    values (asiento, uid, linea.cuenta, linea.haber_cents, linea.debe_cents, linea.equivalente_usd_cents,
      linea.moneda_original, linea.monto_original_cents);
  end loop;
  perform public.fin_validar_asiento(asiento);
end;
$$;
create or replace function public.anular_pagos_desde(p_pago_id uuid, p_motivo text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  objetivo public.pagos;
  siguiente uuid;
  total integer := 0;
begin
  select * into objetivo from public.pagos where id = p_pago_id and user_id = uid;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0002'; end if;
  if objetivo.estado <> 'aplicado' then raise exception 'El pago ya está anulado' using errcode = '22023'; end if;
  perform 1 from public.prestamos where id = objetivo.prestamo_id for update;
  loop
    select id into siguiente from public.pagos
    where prestamo_id = objetivo.prestamo_id and estado = 'aplicado'
      and (fecha, created_at) >= (objetivo.fecha, objetivo.created_at)
    order by fecha desc, created_at desc limit 1;
    exit when siguiente is null;
    perform public.anular_pago(siguiente, p_motivo);
    total := total + 1;
  end loop;
  return total;
end;
$$;
create or replace function public.fin_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Los registros de % no se pueden modificar', tg_table_name using errcode = '42501';
  end if;
  if pg_trigger_depth() <= 1 then
    raise exception 'Los registros de % no se pueden borrar', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;
create or replace function public.fin_pago_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() <= 1 then
      raise exception 'Los pagos no se pueden borrar; anúlalos' using errcode = '42501';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - array['estado', 'anulado_motivo', 'anulado_en'])
     <> (to_jsonb(old) - array['estado', 'anulado_motivo', 'anulado_en'])
     or (old.estado = 'anulado' and new.estado <> 'anulado') then
    raise exception 'Un pago solo admite su anulación' using errcode = '42501';
  end if;
  return new;
end;
$$;
create or replace function public.fin_sin_borrado()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception 'Los registros de % no se pueden borrar; anúlalos', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;
drop trigger if exists auditoria_inmutable on public.auditoria;
create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.fin_inmutable();
drop trigger if exists asientos_inmutable on public.asientos;
create trigger asientos_inmutable before update or delete on public.asientos
  for each row execute function public.fin_inmutable();
drop trigger if exists asiento_lineas_inmutable on public.asiento_lineas;
create trigger asiento_lineas_inmutable before update or delete on public.asiento_lineas
  for each row execute function public.fin_inmutable();
drop trigger if exists aplicaciones_pago_inmutable on public.aplicaciones_pago;
create trigger aplicaciones_pago_inmutable before update or delete on public.aplicaciones_pago
  for each row execute function public.fin_inmutable();
drop trigger if exists pagos_mora_inmutable on public.pagos_mora;
create trigger pagos_mora_inmutable before update or delete on public.pagos_mora
  for each row execute function public.fin_inmutable();
drop trigger if exists pagos_inmutable on public.pagos;
create trigger pagos_inmutable before update or delete on public.pagos
  for each row execute function public.fin_pago_inmutable();
drop trigger if exists prestamos_sin_borrado on public.prestamos;
create trigger prestamos_sin_borrado before delete on public.prestamos
  for each row execute function public.fin_sin_borrado();
drop trigger if exists cuotas_sin_borrado on public.cuotas;
create trigger cuotas_sin_borrado before delete on public.cuotas
  for each row execute function public.fin_sin_borrado();
create or replace function public.fin_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb := to_jsonb(coalesce(new, old));
  dueno uuid := (fila ->> 'user_id')::uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;
  if not exists (select 1 from auth.users where id = dueno) then
    return coalesce(new, old);
  end if;
  insert into public.auditoria (user_id, actor_id, tabla, registro_id, accion, antes, despues)
  values (dueno, auth.uid(), tg_table_name, (fila ->> 'id')::uuid, tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.fin_auditar() from public, anon, authenticated;
delete from public.auditoria a where not exists (select 1 from auth.users u where u.id = a.user_id);
alter table public.auditoria drop constraint if exists auditoria_user_fk;
alter table public.auditoria
  add constraint auditoria_user_fk foreign key (user_id) references auth.users (id) on delete cascade;
revoke execute on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;
revoke execute on function public.anular_pagos_desde(uuid, text) from public, anon;
grant execute on function public.anular_pagos_desde(uuid, text) to authenticated;
revoke execute on function public.fin_inmutable(), public.fin_pago_inmutable(), public.fin_sin_borrado() from public, anon, authenticated;
insert into public.app_migraciones (version) values ('20261014000300') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261014000300') on conflict do nothing;
commit;
