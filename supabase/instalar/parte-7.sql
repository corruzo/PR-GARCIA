-- PRGARCÍA · Instalación, parte 7 de 12. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 12) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261014000100_correcciones_auditoria.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261014000100') then raise exception 'La migración 20261014000100 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
create table if not exists public.app_migraciones (
  version text primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
insert into public.app_migraciones (version) values
  ('20261011000000'), ('20261011000100'), ('20261011000200'), ('20261011000300'),
  ('20261011000400'), ('20261012000100'), ('20261012000200'), ('20261013000100')
on conflict do nothing;
create or replace function public.fin_hoy()
returns date language sql stable set search_path = '' as $$
  select coalesce(
    case when session_user::text not in ('authenticator', 'anon', 'authenticated')
         then nullif(current_setting('app.fecha_hoy', true), '')::date end,
    (now() at time zone 'America/Caracas')::date
  );
$$;
create or replace function public.fin_formato_monto(p_cents bigint)
returns text language sql immutable strict set search_path = '' as $$
  select translate(to_char(p_cents / 100.0, 'FM999,999,999,999,990.00'), ',.', '.,');
$$;
update public.tasa_bcv set estado = 'ok' where estado is null or estado not in ('ok', 'referencial');
alter table public.tasa_bcv drop constraint if exists tasa_bcv_estado_check;
alter table public.tasa_bcv add constraint tasa_bcv_estado_check check (estado in ('ok', 'referencial'));
create or replace function public.fin_validar_tasa_cambio(p_tasa numeric, p_confirmada boolean)
returns void language plpgsql stable set search_path = '' as $$
declare
  ref numeric;
  ref_fecha timestamptz;
begin
  select t.tasa, t.fecha_hora into ref, ref_fecha
  from public.tasa_bcv t where t.estado = 'ok' order by t.fecha_hora desc limit 1;
  if ref is null or ref <= 0 or ref_fecha < now() - interval '15 days' then return; end if;
  if abs(p_tasa - ref) / ref > 0.20 and not coalesce(p_confirmada, false) then
    raise exception 'La tasa de cambio % se aleja más del 20 %% de la tasa BCV registrada (%). Revísala o confirma que es correcta.',
      replace(trim_scale(p_tasa)::text, '.', ','), replace(trim_scale(round(ref, 4))::text, '.', ',')
      using errcode = '22023', hint = 'confirmar_tasa';
  end if;
end;
$$;
create table public.pagos_mora (
  id bigint generated always as identity primary key,
  pago_id uuid not null,
  user_id uuid not null,
  cuota_id uuid not null references public.cuotas (id) on delete cascade,
  mora_cents bigint not null check (mora_cents >= 0),
  calculada_hasta_anterior date,
  foreign key (pago_id, user_id) references public.pagos (id, user_id) on delete cascade
);
create index pagos_mora_pago_idx on public.pagos_mora (pago_id);
alter table public.pagos_mora enable row level security;
create policy pagos_mora_select on public.pagos_mora for select to authenticated using (user_id = auth.uid());
revoke all on public.pagos_mora from anon;
revoke insert, update, delete, truncate on public.pagos_mora from authenticated;
grant select on public.pagos_mora to authenticated;
create or replace function public.fin_devengar_mora(p_prestamo_id uuid, p_hasta date, p_pago_id uuid)
returns void language plpgsql set search_path = '' as $$
declare
  p public.prestamos;
  c public.cuotas;
  extra bigint;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  for c in select * from public.cuotas where prestamo_id = p_prestamo_id and estado <> 'anulada' order by numero loop
    extra := public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, p_hasta);
    if extra > 0 or (c.fecha_vencimiento < p_hasta and coalesce(c.mora_calculada_hasta, c.fecha_vencimiento) < p_hasta) then
      insert into public.pagos_mora (pago_id, user_id, cuota_id, mora_cents, calculada_hasta_anterior)
      values (p_pago_id, p.user_id, c.id, extra, c.mora_calculada_hasta);
      update public.cuotas set mora_devengada_cents = mora_devengada_cents + extra, mora_calculada_hasta = p_hasta
      where id = c.id;
    end if;
  end loop;
end;
$$;
create or replace function public.fin_recalcular_abierto_desde(p_prestamo_id uuid, p_desde date)
returns void language plpgsql set search_path = '' as $$
declare
  p public.prestamos;
  c public.cuotas;
  base integer;
  nuevo bigint;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  if not found or p.tipo_plazo <> 'abierto' then return; end if;
  base := public.fin_dias_modalidad(p.modalidad_tasa);
  for c in
    select * from public.cuotas
    where prestamo_id = p.id and estado <> 'anulada' and fecha_vencimiento - dias > p_desde
    order by numero for update
  loop
    nuevo := public.fin_interes_simple(public.fin_capital_abierto_al(p.id, c.fecha_vencimiento - c.dias), p.tasa_interes, c.dias, base);
    if nuevo < c.interes_pagado_cents + c.interes_descontado_cents then
      raise exception 'No se puede recalcular el período #%: tiene pagos aplicados', c.numero using errcode = '22023';
    end if;
    if nuevo <> c.interes_cents then
      update public.cuotas set interes_cents = nuevo where id = c.id;
    end if;
  end loop;
end;
$$;
drop function if exists public.emitir_prestamo(uuid, text, bigint, numeric, text, text, text, date, date, numeric, text, numeric, integer, text, text, uuid, text);
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
  p_tipo_plazo text default 'fijo',
  p_confirmar_tasa boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  existente uuid;
  cl public.clientes;
  nuevo_id uuid;
  nuevo_numero integer;
  interes_total bigint;
  asiento uuid;
  usado bigint;
  solicitado bigint;
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
  perform public.fin_validar_tasa_cambio(p_tasa_cambio, p_confirmar_tasa);
  if p_tasa_mora_diaria is null or p_tasa_mora_diaria < 0 or p_tasa_mora_diaria > 5 then
    raise exception 'La mora diaria debe estar entre 0 y 5 %%' using errcode = '22023';
  end if;
  if p_dias_gracia is null or p_dias_gracia not between 0 and 60 then
    raise exception 'Los días de gracia deben estar entre 0 y 60' using errcode = '22023';
  end if;
  if p_fecha_inicio > public.fin_hoy() + 30 then
    raise exception 'La fecha de inicio no puede ser más de 30 días en el futuro' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('prestamos:' || uid::text, 0));
  select * into cl from public.clientes where id = p_cliente_id and user_id = uid;
  if not found then raise exception 'Cliente no encontrado' using errcode = 'P0002'; end if;
  if cl.estado <> 'activo' then raise exception 'El cliente no está activo' using errcode = '22023'; end if;
  if cl.limite_credito_cents is not null then
    select coalesce(sum(public.fin_convertir(
      case when pr.tipo_plazo = 'abierto' then pr.capital_cents - pr.capital_pagado_cents
           else (select coalesce(sum(c.capital_cents - c.capital_pagado_cents), 0)
                 from public.cuotas c where c.prestamo_id = pr.id and c.estado <> 'anulada')::bigint end,
      p_tasa_cambio, pr.moneda, cl.moneda_limite)), 0)
      into usado
    from public.prestamos pr
    where pr.cliente_id = cl.id and pr.user_id = uid and pr.estado = 'activo';
    solicitado := public.fin_convertir(p_capital_cents, p_tasa_cambio, p_moneda, cl.moneda_limite);
    if usado + solicitado > cl.limite_credito_cents then
      raise exception 'El préstamo supera el límite de crédito del cliente: disponible % %.',
        public.fin_formato_monto(greatest(cl.limite_credito_cents - usado, 0)), cl.moneda_limite
        using errcode = '22023';
    end if;
  end if;
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
  values (uid, nuevo_numero, cl.id, p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
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
revoke execute on function public.emitir_prestamo(uuid, text, bigint, numeric, text, text, text, date, date, numeric, text, numeric, integer, text, text, uuid, text, boolean) from public, anon;
grant execute on function public.emitir_prestamo(uuid, text, bigint, numeric, text, text, text, date, date, numeric, text, numeric, integer, text, text, uuid, text, boolean) to authenticated;
revoke execute on function public.fin_devengar_mora(uuid, date, uuid), public.fin_recalcular_abierto_desde(uuid, date),
  public.fin_validar_tasa_cambio(numeric, boolean), public.fin_formato_monto(bigint) from public, anon, authenticated;
insert into public.app_migraciones (version) values ('20261014000100') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261014000100') on conflict do nothing;
commit;
