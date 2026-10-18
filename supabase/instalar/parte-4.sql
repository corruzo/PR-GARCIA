-- PRGARCÍA · Instalación, parte 4 de 12. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 12) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261012000100_prestamos_abiertos.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261012000100') then raise exception 'La migración 20261012000100 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
alter table public.prestamos
  add column if not exists tipo_plazo text not null default 'fijo',
  add column if not exists capital_pagado_cents bigint not null default 0;
alter table public.prestamos alter column fecha_fin drop not null;
alter table public.prestamos
  add constraint prestamos_tipo_plazo_check check (tipo_plazo in ('fijo', 'abierto')),
  add constraint prestamos_plazo_coherente check (
    (tipo_plazo = 'fijo' and fecha_fin is not null and capital_pagado_cents = 0)
    or (tipo_plazo = 'abierto' and fecha_fin is null and metodo_interes = 'saldo_insoluto')),
  add constraint prestamos_capital_pagado_check check (capital_pagado_cents between 0 and capital_cents);
alter table public.aplicaciones_pago alter column cuota_id drop not null;
alter table public.aplicaciones_pago
  add constraint aplicaciones_cuota_requerida check (cuota_id is not null or concepto = 'capital');
create or replace function public.fin_capital_abierto_al(p_prestamo_id uuid, p_fecha date)
returns bigint language sql stable set search_path = '' as $$
  select p.capital_cents - coalesce((
    select sum(a.monto_cents)
    from public.aplicaciones_pago a join public.pagos pg on pg.id = a.pago_id
    where pg.prestamo_id = p.id and pg.estado = 'aplicado' and pg.fecha <= p_fecha
      and a.concepto = 'capital' and a.cuota_id is null), 0)
  from public.prestamos p where p.id = p_prestamo_id;
$$;
create or replace function public.fin_sincronizar_abierto(p_prestamo_id uuid, p_hasta date)
returns integer language plpgsql set search_path = '' as $$
declare
  p public.prestamos;
  intervalo integer;
  base integer;
  inicio date;
  ultimo integer;
  saldo bigint;
  creadas integer := 0;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  if not found or p.tipo_plazo <> 'abierto' or p.estado <> 'activo' then return 0; end if;
  intervalo := public.fin_dias_frecuencia(p.frecuencia_pago);
  base := public.fin_dias_modalidad(p.modalidad_tasa);
  select coalesce(max(numero), 0), max(fecha_vencimiento) into ultimo, inicio
  from public.cuotas where prestamo_id = p.id;
  inicio := coalesce(inicio, p.fecha_inicio);
  while inicio <= p_hasta loop
    saldo := public.fin_capital_abierto_al(p.id, inicio);
    exit when saldo <= 0;
    creadas := creadas + 1;
    if creadas > 4000 then raise exception 'Demasiados períodos pendientes de generar'; end if;
    ultimo := ultimo + 1;
    insert into public.cuotas (prestamo_id, user_id, numero, fecha_vencimiento, dias, capital_cents, interes_cents)
    values (p.id, p.user_id, ultimo, inicio + intervalo, intervalo, 0,
      public.fin_interes_simple(saldo, p.tasa_interes, intervalo, base));
    inicio := inicio + intervalo;
  end loop;
  return creadas;
end;
$$;
create or replace function public.fin_actualizar_estados(p_prestamo_id uuid, p_fecha date)
returns void language plpgsql set search_path = '' as $$
begin
  update public.cuotas c set
    estado = case
      when c.capital_pagado_cents = c.capital_cents
       and c.interes_pagado_cents + c.interes_descontado_cents = c.interes_cents
       and c.mora_pagada_cents = c.mora_devengada_cents then 'pagada'
      when c.capital_pagado_cents > 0 or c.interes_pagado_cents > 0 or c.mora_pagada_cents > 0 then 'parcial'
      else 'pendiente' end,
    pagada_en = case
      when c.capital_pagado_cents = c.capital_cents
       and c.interes_pagado_cents + c.interes_descontado_cents = c.interes_cents
       and c.mora_pagada_cents = c.mora_devengada_cents then coalesce(c.pagada_en, p_fecha)
      else null end
  where c.prestamo_id = p_prestamo_id and c.estado <> 'anulada';
  update public.prestamos p set estado = case
    when not exists (select 1 from public.cuotas where prestamo_id = p.id and estado <> 'pagada')
     and (p.tipo_plazo = 'fijo' or p.capital_pagado_cents >= p.capital_cents) then 'pagado'
    else 'activo' end
  where p.id = p_prestamo_id and p.estado in ('activo', 'pagado');
end;
$$;
create or replace function public.anular_prestamo(p_prestamo_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  p public.prestamos;
  asiento uuid;
  motivo text := public.fin_texto_seguro(p_motivo, 300);
begin
  if motivo is null then raise exception 'Indica el motivo de la anulación' using errcode = '22023'; end if;
  select * into p from public.prestamos where id = p_prestamo_id and user_id = uid for update;
  if not found then raise exception 'Préstamo no encontrado' using errcode = 'P0002'; end if;
  if p.estado <> 'activo' then raise exception 'Solo se pueden anular préstamos activos' using errcode = '22023'; end if;
  if p.capital_pagado_cents > 0 or exists (select 1 from public.cuotas where prestamo_id = p.id
             and (capital_pagado_cents > 0 or interes_pagado_cents > 0 or mora_pagada_cents > 0)) then
    raise exception 'El préstamo tiene pagos aplicados; anula primero los pagos' using errcode = '22023';
  end if;
  update public.prestamos set estado = 'anulado', anulado_motivo = motivo where id = p.id;
  update public.cuotas set estado = 'anulada' where prestamo_id = p.id;
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, moneda, tasa_cambio, descripcion)
  values (uid, public.fin_hoy(), 'anulacion_prestamo', p.id, p.moneda, p.tasa_cambio,
    'Anulación préstamo #' || p.numero || ': ' || motivo)
  returning id into asiento;
  perform public.fin_linea(asiento, uid, 'caja', p.capital_cents, 0, p.moneda, p.tasa_cambio, p.moneda, p.capital_cents);
  perform public.fin_linea(asiento, uid, 'cartera_capital', 0, p.capital_cents, p.moneda, p.tasa_cambio);
  perform public.fin_validar_asiento(asiento);
end;
$$;
drop function if exists public.emitir_prestamo(uuid, text, bigint, numeric, text, text, text, date, date, numeric, text, numeric, integer, text, text, uuid);
create or replace function public.emitir_prestamo(
  p_cliente_id uuid,
  p_moneda text,
  p_capital_cents bigint,
  p_tasa_interes numeric,
  p_modalidad_tasa text,
  p_frecuencia_pago text,
  p_metodo_interes text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_tasa_cambio numeric,
  p_fuente_tasa_cambio text,
  p_tasa_mora_diaria numeric default 0,
  p_dias_gracia integer default 0,
  p_notas text default null,
  p_cotizacion_origen text default null,
  p_idempotency_key uuid default null,
  p_tipo_plazo text default 'fijo'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  existente uuid;
  cliente_estado text;
  nuevo_id uuid;
  nuevo_numero integer;
  interes_total bigint;
  asiento uuid;
begin
  if p_idempotency_key is not null then
    select id into existente from public.prestamos where user_id = uid and idempotency_key = p_idempotency_key;
    if found then return existente; end if;
  end if;
  if p_tipo_plazo is null or p_tipo_plazo not in ('fijo', 'abierto') then
    raise exception 'Tipo de plazo inválido' using errcode = '22023';
  end if;
  if p_tipo_plazo = 'abierto' then
    if p_fecha_fin is not null then raise exception 'Un préstamo abierto no lleva fecha de fin' using errcode = '22023'; end if;
    perform public.fin_validar_terminos(p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_inicio + coalesce(public.fin_dias_frecuencia(p_frecuencia_pago), 1), p_frecuencia_pago, 'saldo_insoluto');
  else
    perform public.fin_validar_terminos(p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes);
  end if;
  if p_tasa_interes <> round(p_tasa_interes, 8) then raise exception 'La tasa admite hasta 8 decimales' using errcode = '22023'; end if;
  if p_tasa_cambio is null or p_tasa_cambio <= 0 or p_tasa_cambio > 1000000000000 or p_tasa_cambio <> round(p_tasa_cambio, 8) then
    raise exception 'Tasa de cambio inválida' using errcode = '22023';
  end if;
  if p_tasa_mora_diaria is null or p_tasa_mora_diaria < 0 or p_tasa_mora_diaria > 5 then
    raise exception 'La mora diaria debe estar entre 0 y 5 %%' using errcode = '22023';
  end if;
  if p_dias_gracia is null or p_dias_gracia not between 0 and 60 then
    raise exception 'Los días de gracia deben estar entre 0 y 60' using errcode = '22023';
  end if;
  if p_fecha_inicio > public.fin_hoy() + 30 then
    raise exception 'La fecha de inicio no puede ser más de 30 días en el futuro' using errcode = '22023';
  end if;
  select estado into cliente_estado from public.clientes where id = p_cliente_id and user_id = uid;
  if not found then raise exception 'Cliente no encontrado' using errcode = 'P0002'; end if;
  if cliente_estado <> 'activo' then raise exception 'El cliente no está activo' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('prestamos:' || uid::text, 0));
  select coalesce(max(numero), 0) + 1 into nuevo_numero from public.prestamos where user_id = uid;
  if p_tipo_plazo = 'abierto' then
    interes_total := 0;
  else
    select coalesce(sum(c.interes_cents), 0) into interes_total
    from public.fin_cronograma(p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes) c;
  end if;
  insert into public.prestamos (user_id, numero, cliente_id, moneda, capital_cents, tasa_interes, modalidad_tasa,
    frecuencia_pago, metodo_interes, fecha_inicio, fecha_fin, interes_total_cents, total_cents, tasa_cambio,
    fuente_tasa_cambio, tasa_mora_diaria, dias_gracia, notas, cotizacion_origen, idempotency_key, tipo_plazo)
  values (uid, nuevo_numero, p_cliente_id, p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
    p_frecuencia_pago, case when p_tipo_plazo = 'abierto' then 'saldo_insoluto' else p_metodo_interes end, p_fecha_inicio, p_fecha_fin, interes_total, p_capital_cents + interes_total,
    p_tasa_cambio, coalesce(public.fin_texto_seguro(p_fuente_tasa_cambio, 80), 'manual'), p_tasa_mora_diaria,
    p_dias_gracia, public.fin_texto_seguro(p_notas, 1000), public.fin_texto_seguro(p_cotizacion_origen, 64),
    p_idempotency_key, p_tipo_plazo)
  returning id into nuevo_id;
  if p_tipo_plazo = 'fijo' then
    insert into public.cuotas (prestamo_id, user_id, numero, fecha_vencimiento, dias, capital_cents, interes_cents)
    select nuevo_id, uid, c.numero, c.fecha_vencimiento, c.dias, c.capital_cents, c.interes_cents
    from public.fin_cronograma(p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes) c;
  end if;
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, moneda, tasa_cambio, descripcion)
  values (uid, p_fecha_inicio, 'desembolso', nuevo_id, p_moneda, p_tasa_cambio, 'Desembolso préstamo #' || nuevo_numero)
  returning id into asiento;
  perform public.fin_linea(asiento, uid, 'cartera_capital', p_capital_cents, 0, p_moneda, p_tasa_cambio);
  perform public.fin_linea(asiento, uid, 'caja', 0, p_capital_cents, p_moneda, p_tasa_cambio, p_moneda, p_capital_cents);
  perform public.fin_validar_asiento(asiento);
  if p_tipo_plazo = 'abierto' then
    perform public.fin_sincronizar_abierto(nuevo_id, public.fin_hoy());
  end if;
  return nuevo_id;
end;
$$;
insert into public.app_migraciones (version) values ('20261012000100') on conflict do nothing;
commit;
